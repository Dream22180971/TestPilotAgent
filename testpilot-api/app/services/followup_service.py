"""Follow-up processing: use the LLM to revise an existing output per user instruction.

The revision must still match the module's schema; otherwise the saved output
is left untouched and the call reports "failed".
"""

from __future__ import annotations

import json
import logging

from sqlalchemy.orm import Session

from app.services.db_store import DatabaseStore
from app.services.document_context import collect_document_context
from app.services.llm_client import llm_client
from app.services.llm_generation_service import parse_llm_json, validate_output
from app.services.prompt_loader import render_prompt

logger = logging.getLogger(__name__)
store = DatabaseStore()


def _history_text(db: Session, project_id: str, target: str, limit: int = 3) -> str:
    """Recent finished rounds on this module, so "按你刚才的建议补充" has context."""
    rounds = [
        r for r in store.list_followups(db, project_id)
        if r["target"] == target and r["status"] in ("answered", "proposed", "applied", "discarded")
    ][-limit:]
    if not rounds:
        return ""
    lines = [f"- 用户：{r['instruction']}\n  AI：{r['reply']}（{STATUS_ZH.get(r['status'], r['status'])}）" for r in rounds]
    return "\n\n## 本模块近期追问记录\n" + "\n".join(lines)


STATUS_ZH = {"answered": "仅回答", "proposed": "待确认", "applied": "已应用修订", "discarded": "用户放弃了该修订"}


def stream_followup_proposal(db: Session, project_id: str, target: str, instruction: str):
    """Answer a follow-up and record it, without touching the module output.

    Yields {"record": dict} first, then {"reasoning": str} deltas, then the
    final {"record": dict} (status answered / proposed / error). A proposed
    revision is only saved to the module by apply_followup after the user confirms.
    """
    existing = store.get_output(db, project_id, target)
    if not existing:
        yield {"error": "尚未生成该模块，请先生成。"}
        return
    if not llm_client.available:
        yield {"error": "未配置模型，追问需要 AI 模式。"}
        return

    history = _history_text(db, project_id, target)
    record = store.create_followup(db, project_id, target, instruction)
    yield {"record": record}

    doc_context = collect_document_context(db, project_id)
    doc_text = f"\n\n## 参考上传文档\n{doc_context['combined_text']}" if doc_context else ""
    user = (
        f"【要求：全程使用简体中文思考（thinking），输出值均为中文】\n\n"
        f"{render_prompt('followup_proposal')}\n\n"
        f"## 目标模块\n{target}\n\n"
        f"## 当前输出\n{json.dumps(existing['content'], ensure_ascii=False, indent=1)}"
        f"{history}\n\n"
        f"## 用户追问\n{instruction}"
        f"{doc_text}"
    )

    finished = False
    try:
        full = ""
        for chunk in llm_client.chat_stream(render_prompt("system_prompt"), user):
            if "reasoning" in chunk:
                yield chunk
            elif "content" in chunk:
                full += chunk["content"]
            elif "done" in chunk:
                full = chunk["done"]
        answer = parse_llm_json(full)

        revised = answer.get("revised")
        if isinstance(revised, dict) and revised:
            try:
                revised = validate_output(target, revised)
            except Exception as e:
                logger.warning("Follow-up revision for %s/%s has invalid shape: %s", project_id, target, e)
                revised = None
        else:
            revised = None
        changes = answer.get("changes")

        record = store.update_followup(
            db,
            record["id"],
            status="proposed" if revised else "answered",
            reply=str(answer.get("reply") or ""),
            changes=[str(c) for c in changes] if isinstance(changes, list) and revised else [],
            revised=revised,
        )
        finished = True
        yield {"record": record}
    except Exception as e:
        logger.warning("Follow-up for %s/%s failed: %s", project_id, target, e)
        record = store.update_followup(db, record["id"], status="error", detail=f"AI 回复失败：{e}")
        finished = True
        yield {"record": record}
    finally:
        # Client disconnected mid-answer: don't leave the round stuck in "thinking".
        if not finished:
            store.update_followup(db, record["id"], status="error", detail="已中断")


def apply_followup(db: Session, project_id: str, followup_id: str) -> dict:
    """Save a proposed revision the user confirmed and mark the round applied."""
    record = store.get_followup(db, followup_id)
    if not record or record["project_id"] != project_id:
        raise LookupError("追问记录不存在")
    if record["status"] != "proposed" or not record["revised"]:
        raise ValueError("该追问没有待确认的修订")
    output = store.save_output(db, project_id, record["target"], validate_output(record["target"], record["revised"]))
    record = store.update_followup(db, followup_id, status="applied")
    return {"record": record, "content": output["content"]}


def discard_followup(db: Session, project_id: str, followup_id: str) -> dict:
    record = store.get_followup(db, followup_id)
    if not record or record["project_id"] != project_id:
        raise LookupError("追问记录不存在")
    if record["status"] != "proposed":
        raise ValueError("该追问没有待确认的修订")
    return {"record": store.update_followup(db, followup_id, status="discarded")}


def process_followup(db: Session, project_id: str, target: str, instruction: str) -> dict:
    base = {"project_id": project_id, "target": target, "instruction": instruction}

    existing = store.get_output(db, project_id, target)
    if not existing:
        return {
            **base,
            "status": "not_found",
            "detail": f"No existing output found for target '{target}'. Generate it first.",
        }

    if not llm_client.available:
        return {**base, "status": "failed", "content": existing["content"], "detail": "未配置模型，追问修订需要 AI 模式。"}

    doc_context = collect_document_context(db, project_id)
    doc_text = ""
    if doc_context:
        doc_text = f"\n\n## 参考上传文档\n{doc_context['combined_text']}"

    user = (
        f"{render_prompt('followup_regenerate')}\n\n"
        f"## 目标模块\n{target}\n\n"
        f"## 当前输出\n{json.dumps(existing['content'], ensure_ascii=False, indent=1)}\n\n"
        f"## 用户要求\n{instruction}"
        f"{doc_text}"
    )

    try:
        revised = validate_output(target, parse_llm_json(llm_client.chat(render_prompt("system_prompt"), user)))
    except Exception as e:
        logger.warning("Follow-up for %s/%s failed: %s", project_id, target, e)
        return {**base, "status": "failed", "content": existing["content"], "detail": f"修订失败：{e}"}

    record = store.save_output(db, project_id, target, revised)
    return {**base, "status": "completed", "content": record["content"]}
