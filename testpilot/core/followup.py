"""Follow-up processing: modify existing output based on user instruction via LLM."""

from __future__ import annotations

from sqlalchemy.orm import Session

from testpilot.core.db_store import DatabaseStore
from testpilot.core.llm_client import llm_client
from testpilot.core.prompt_loader import render_prompt

store = DatabaseStore()


def _collect_document_context(db: Session, project_id: str) -> dict | None:
    docs = store.list_documents(db, project_id)
    if not docs:
        return None
    relevant_texts = []
    relevant_filenames = []
    for doc in docs:
        preview = doc.get("text_preview", "")
        full_text = doc.get("extracted_text", "")
        if preview and full_text != preview:
            relevant_texts.append(f"[File: {doc['filename']}] {full_text}")
            relevant_filenames.append(doc["filename"])
    if not relevant_texts:
        return None
    return {
        "has_documents": True,
        "filenames": relevant_filenames,
        "combined_text": "\n\n---\n\n".join(relevant_texts),
    }


def process_followup(db: Session, project_id: str, target: str, instruction: str) -> dict:
    existing = store.get_output(db, project_id, target)
    if not existing:
        return {
            "project_id": project_id,
            "target": target,
            "instruction": instruction,
            "status": "not_found",
            "detail": f"No existing output found for target '{target}'. Generate it first.",
        }

    if llm_client.available:
        try:
            doc_context = _collect_document_context(db, project_id)
            doc_text = ""
            if doc_context and doc_context.get("has_documents"):
                doc_text = f"\n\n## 参考上传文档\n{doc_context['combined_text']}"

            system = render_prompt("system_prompt")
            prompt_text = render_prompt("followup_regenerate")
            user = (
                f"{prompt_text}\n\n"
                f"## 目标模块\n{target}\n\n"
                f"## 当前输出\n{existing['content']}\n\n"
                f"## 用户要求\n{instruction}"
                f"{doc_text}"
            )
            result = llm_client.chat_structured(system, user)
            record = store.save_output(db, project_id, target, result)
            return {
                "project_id": project_id,
                "target": target,
                "instruction": instruction,
                "status": "completed",
                "content": record["content"],
            }
        except Exception:
            pass

    return {
        "project_id": project_id,
        "target": target,
        "instruction": instruction,
        "status": "completed",
        "content": existing["content"],
        "note": "LLM unavailable; returned existing content unchanged.",
    }
