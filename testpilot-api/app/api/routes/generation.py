from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.generation import GenerateRequest
from app.services.db_store import DatabaseStore
from app.services.generation_service import build_analysis as rule_build_analysis
from app.services.generation_service import (
    generate_test_cases,
    generate_test_plan,
    generate_test_points,
    generate_test_design,
    generate_test_strategy,
)
from app.services.llm_generation_service import analyze_with_llm, generate_with_llm

router = APIRouter()
store = DatabaseStore()

TARGETS = ["analysis", "test_strategy", "test_plan", "test_points", "test_cases", "test_design"]


@router.post("/{project_id}/generate")
def generate_output(project_id: str, payload: GenerateRequest, db: Session = Depends(get_db)) -> dict:
    project = store.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    requirement = store.get_requirement(db, payload.requirement_id)
    if not requirement or requirement["project_id"] != project_id:
        raise HTTPException(status_code=404, detail="Requirement not found")

    target = payload.target

    if target == "all":
        return _generate_all(project, requirement, db, project_id, payload)
    elif target not in TARGETS:
        raise HTTPException(status_code=400, detail=f"Unsupported target: {target}. Supported: {', '.join(TARGETS)}")
    else:
        return _generate_single(target, project, requirement, db, project_id, payload)


def _generate_single(
    target: str,
    project: dict,
    requirement: dict,
    db: Session,
    project_id: str,
    payload: GenerateRequest,
) -> dict:
    # For test_cases we need test_points first
    if target == "test_cases":
        points_output = store.get_output(db, project_id, "test_points")
        if not points_output or payload.regenerate:
            _generate_single("test_points", project, requirement, db, project_id, payload)
            points_output = store.get_output(db, project_id, "test_points")

    # Collect document context early — used by both analysis and generation
    doc_context = _collect_document_context(db, project_id, payload.requirement_id)

    # Get or generate analysis for context
    analysis_output = store.get_output(db, project_id, "analysis")
    analysis = analysis_output["content"] if analysis_output else (
        analyze_with_llm(project, requirement, doc_context)
        or rule_build_analysis(project, requirement, doc_context)
    )

    # Get previous output for context
    previous = store.get_output(db, project_id, target)
    previous_content = previous["content"] if previous else None

    # Try LLM first, fall back to rule engine
    if target == "test_points":
        content = generate_with_llm(
            project, requirement, target, analysis, previous_content, doc_context
        ) or generate_test_points(analysis)
    elif target == "test_cases":
        points_output = store.get_output(db, project_id, "test_points")
        pts = points_output["content"] if points_output else {"rows": []}
        content = generate_with_llm(
            project, requirement, target, str(pts), previous_content, doc_context
        ) or generate_test_cases(pts)
    elif target == "test_strategy":
        content = generate_with_llm(
            project, requirement, target, str(analysis), previous_content, doc_context
        ) or generate_test_strategy(project, analysis)
    elif target == "test_plan":
        content = generate_with_llm(
            project, requirement, target, str(analysis), previous_content, doc_context
        ) or generate_test_plan(analysis)
    elif target == "test_design":
        content = generate_with_llm(
            project, requirement, target, str(analysis), previous_content, doc_context
        ) or generate_test_design(project, analysis)
    else:
        content = analysis

    record = store.save_output(db, project_id, target, content)
    return {
        "project_id": project_id,
        "target": target,
        "requirement_id": payload.requirement_id,
        "status": record["status"],
        "content": record["content"],
    }


def _generate_all(
    project: dict,
    requirement: dict,
    db: Session,
    project_id: str,
    payload: GenerateRequest,
) -> dict:
    # Collect document context early
    doc_context = _collect_document_context(db, project_id, payload.requirement_id)

    # Get or generate analysis
    analysis_output = store.get_output(db, project_id, "analysis")
    analysis = analysis_output["content"] if analysis_output else (
        analyze_with_llm(project, requirement, doc_context)
        or rule_build_analysis(project, requirement, doc_context)
    )
    store.save_output(db, project_id, "analysis", analysis)

    results = {"analysis": analysis}
    for t in [t for t in TARGETS if t != "analysis"]:
        prev = store.get_output(db, project_id, t)
        prev_content = prev["content"] if prev else None

        if t == "test_points":
            content = generate_with_llm(
                project, requirement, t, str(analysis), prev_content, doc_context
            ) or generate_test_points(analysis)
        elif t == "test_cases":
            points_output = store.get_output(db, project_id, "test_points")
            pts = points_output["content"] if points_output else {"rows": []}
            content = generate_with_llm(
                project, requirement, t, str(pts), prev_content, doc_context
            ) or generate_test_cases(pts)
        elif t == "test_strategy":
            content = generate_with_llm(
                project, requirement, t, str(analysis), prev_content, doc_context
            ) or generate_test_strategy(project, analysis)
        elif t == "test_plan":
            content = generate_with_llm(
                project, requirement, t, str(analysis), prev_content, doc_context
            ) or generate_test_plan(analysis)
        elif t == "test_design":
            content = generate_with_llm(
                project, requirement, t, str(analysis), prev_content, doc_context
            ) or generate_test_design(project, analysis)
        else:
            content = analysis

        store.save_output(db, project_id, t, content)
        results[t] = content

    return {
        "project_id": project_id,
        "target": "all",
        "requirement_id": payload.requirement_id,
        "status": "completed",
        "content": results,
    }


def _collect_document_context(db: Session, project_id: str, requirement_id: str) -> dict | None:
    """Collect all documents attached to this project that are linked to the given requirement."""
    docs = store.list_documents(db, project_id)
    if not docs:
        return None

    relevant_texts = []
    relevant_filenames = []
    for doc in docs:
        full_text = doc.get("extracted_text", "")
        if full_text.strip():
            relevant_texts.append(f"[File: {doc['filename']}] {full_text}")
            relevant_filenames.append(doc["filename"])

    if not relevant_texts:
        return None

    return {
        "has_documents": True,
        "filenames": relevant_filenames,
        "combined_text": "\n\n---\n\n".join(relevant_texts),
    }


# ---------------------------------------------------------------------------
# Streaming generation (SSE) — exposes model reasoning and task progress
# ---------------------------------------------------------------------------

import json as _json
import time as _time

from fastapi.responses import StreamingResponse

from app.database import SessionLocal
from app.services.llm_client import llm_client
from app.services.llm_generation_service import generate_with_llm_stream


def _sse(event: str, data: dict) -> str:
    return f"event: {event}" + chr(10) + "data: " + _json.dumps(data, ensure_ascii=False) + chr(10) * 2


TARGET_LABELS_ZH = {
    "analysis": "需求分析", "test_strategy": "测试策略", "test_plan": "测试计划",
    "test_points": "测试点", "test_cases": "测试用例", "test_design": "测试设计",
}


def _run_target(project: dict, requirement: dict, target: str, analysis, previous_content, doc_context):
    """Generator: yield SSE frames while generating one target.

    `return` value (StopIteration.value) is the generated content, with the
    rule-engine fallback applied when LLM is unavailable or fails.
    """
    label = TARGET_LABELS_ZH.get(target, target)

    if llm_client.available:
        yield _sse("status", {"target": target, "stage": "llm", "message": f"AI 正在生成{label}…"})
        result = None
        for chunk in generate_with_llm_stream(
            project, requirement, target,
            analysis if analysis is None or isinstance(analysis, str) else str(analysis),
            previous_content, doc_context,
        ):
            if "reasoning" in chunk:
                yield _sse("reasoning", {"target": target, "delta": chunk["reasoning"]})
            elif "result" in chunk:
                result = chunk["result"]
        if result is not None:
            yield _sse("stage_done", {"target": target, "via": "llm"})
            return result
        yield _sse("status", {"target": target, "stage": "fallback", "message": f"AI 生成失败，规则引擎兜底{label}…"})
    else:
        yield _sse("status", {"target": target, "stage": "rule", "message": f"规则引擎生成{label}…"})

    if target == "analysis":
        content = rule_build_analysis(project, requirement, doc_context)
    elif target == "test_points":
        content = generate_test_points(analysis)
    elif target == "test_cases":
        content = generate_test_cases(analysis)
    elif target == "test_strategy":
        content = generate_test_strategy(project, analysis)
    elif target == "test_plan":
        content = generate_test_plan(analysis)
    elif target == "test_design":
        content = generate_test_design(project, analysis)
    else:
        content = analysis
    yield _sse("stage_done", {"target": target, "via": "rule"})
    return content


def _drive(runner):
    """Iterate a _run_target generator: forward frames, capture return value."""
    while True:
        try:
            yield next(runner)
        except StopIteration as stop:
            return stop.value


@router.post("/{project_id}/generate/stream")
def generate_output_stream(project_id: str, payload: GenerateRequest):
    """SSE: status / reasoning / stage_done / module_done / done."""

    def event_stream():
        db = SessionLocal()
        start = _time.monotonic()
        try:
            project = store.get_project(db, project_id)
            if not project:
                yield _sse("error", {"message": "Project not found"})
                return
            requirement = store.get_requirement(db, payload.requirement_id)
            if not requirement or requirement["project_id"] != project_id:
                yield _sse("error", {"message": "Requirement not found"})
                return
            if payload.target not in TARGETS and payload.target != "all":
                yield _sse("error", {"message": f"Unsupported target: {payload.target}"})
                return

            doc_context = _collect_document_context(db, project_id, payload.requirement_id)
            targets = [t for t in TARGETS if t != "analysis"] if payload.target == "all" else [payload.target]

            yield _sse("status", {"stage": "start", "targets": targets, "message": "任务开始"})

            analysis_output = store.get_output(db, project_id, "analysis")
            analysis = analysis_output["content"] if analysis_output else None
            results: dict = {}

            if "analysis" in targets or payload.target == "analysis":
                content = yield from _drive(_run_target(project, requirement, "analysis", None, None, doc_context))
                store.save_output(db, project_id, "analysis", content)
                results["analysis"] = content
                yield _sse("module_done", {"target": "analysis", "content": content})

            for t in targets:
                if t == "analysis":
                    continue
                prev = store.get_output(db, project_id, t)
                prev_content = prev["content"] if prev else None
                analysis_ref = results.get("analysis") or analysis

                if t == "test_cases":
                    points_output = store.get_output(db, project_id, "test_points")
                    pts = points_output["content"] if points_output and not payload.regenerate else None
                    if pts is None:
                        pts = yield from _drive(_run_target(project, requirement, "test_points", analysis_ref, None, doc_context))
                        store.save_output(db, project_id, "test_points", pts)
                        results["test_points"] = pts
                        yield _sse("module_done", {"target": "test_points", "content": pts})
                    analysis_for_target = pts
                else:
                    analysis_for_target = analysis_ref

                content = yield from _drive(_run_target(project, requirement, t, analysis_for_target, prev_content, doc_context))
                store.save_output(db, project_id, t, content)
                results[t] = content
                yield _sse("module_done", {"target": t, "content": content})

            yield _sse("done", {
                "project_id": project_id,
                "target": payload.target,
                "requirement_id": payload.requirement_id,
                "status": "completed",
                "content": results if payload.target == "all" else results.get(payload.target, {}),
                "elapsed_ms": int((_time.monotonic() - start) * 1000),
            })
        except Exception as e:
            yield _sse("error", {"message": str(e)})
        finally:
            db.close()

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    })
