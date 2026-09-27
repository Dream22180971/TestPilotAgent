import json
import time

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.schemas.generation import GenerateRequest
from app.services.db_store import DatabaseStore
from app.services.document_context import collect_document_context
from app.services.generation_service import (
    build_analysis,
    generate_test_cases,
    generate_test_design,
    generate_test_plan,
    generate_test_points,
    generate_test_strategy,
)
from app.services.llm_client import llm_client
from app.services.llm_generation_service import generate_with_llm_stream

router = APIRouter()
store = DatabaseStore()

# Pipeline order: every target only depends on targets before it.
TARGETS = ["analysis", "test_strategy", "test_plan", "test_points", "test_cases", "test_design"]

TARGET_LABELS_ZH = {
    "analysis": "需求分析", "test_strategy": "测试策略", "test_plan": "测试计划",
    "test_points": "测试点", "test_cases": "测试用例", "test_design": "测试设计",
}


class PipelineError(Exception):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _rule_generate(target: str, project: dict, requirement: dict, basis, doc_context):
    if target == "analysis":
        return build_analysis(project, requirement, doc_context)
    if target == "test_points":
        return generate_test_points(basis)
    if target == "test_cases":
        return generate_test_cases(basis)
    if target == "test_strategy":
        return generate_test_strategy(project, basis)
    if target == "test_plan":
        return generate_test_plan(basis)
    if target == "test_design":
        return generate_test_design(project, basis)
    raise ValueError(f"Unknown target: {target}")


def _run_target(project: dict, requirement: dict, target: str, basis, previous_content, doc_context):
    """Generator: yield SSE frames while generating one target.

    The `return` value is the generated content, with the rule-engine
    fallback applied when the LLM is unavailable or fails.
    """
    label = TARGET_LABELS_ZH.get(target, target)

    if llm_client.available:
        yield _sse("status", {"target": target, "stage": "llm", "message": f"AI 正在生成{label}…"})
        result = None
        for chunk in generate_with_llm_stream(project, requirement, target, basis, previous_content, doc_context):
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

    content = _rule_generate(target, project, requirement, basis, doc_context)
    yield _sse("stage_done", {"target": target, "via": "rule"})
    return content


def _pipeline(db: Session, project_id: str, payload: GenerateRequest):
    """Generator shared by the streaming and plain endpoints.

    Yields SSE frames; its `return` value is {target: content} for every
    module produced. Missing upstream modules (analysis, test points) are
    generated on the way instead of feeding None into later stages.
    """
    project = store.get_project(db, project_id)
    if not project:
        raise PipelineError(404, "Project not found")
    requirement = store.get_requirement(db, payload.requirement_id)
    if not requirement or requirement["project_id"] != project_id:
        raise PipelineError(404, "Requirement not found")
    if payload.target != "all" and payload.target not in TARGETS:
        raise PipelineError(400, f"Unsupported target: {payload.target}. Supported: all, {', '.join(TARGETS)}")

    doc_context = collect_document_context(db, project_id, requirement.get("raw_input", ""))
    targets = TARGETS if payload.target == "all" else [payload.target]
    yield _sse("status", {"stage": "start", "targets": targets, "message": "任务开始"})

    results: dict = {}

    def stored(target: str):
        out = store.get_output(db, project_id, target)
        return out["content"] if out else None

    def produce(target: str, basis, previous):
        content = yield from _run_target(project, requirement, target, basis, previous, doc_context)
        store.save_output(db, project_id, target, content)
        results[target] = content
        yield _sse("module_done", {"target": target, "content": content})
        return content

    # "all" re-runs analysis so the pipeline follows the latest requirement text;
    # a single target reuses the saved analysis when there is one.
    analysis = None if "analysis" in targets else stored("analysis")
    if analysis is None:
        analysis = yield from produce("analysis", None, None)

    for target in targets:
        if target == "analysis":
            continue
        if target == "test_cases":
            points = results.get("test_points") or (None if payload.regenerate else stored("test_points"))
            if points is None:
                points = yield from produce("test_points", analysis, None)
            basis = points
        else:
            basis = analysis
        yield from produce(target, basis, stored(target))

    return results


@router.post("/{project_id}/generate")
def generate_output(project_id: str, payload: GenerateRequest, db: Session = Depends(get_db)) -> dict:
    """Blocking variant of /generate/stream (same pipeline, frames discarded)."""
    runner = _pipeline(db, project_id, payload)
    try:
        while True:
            next(runner)
    except StopIteration as stop:
        results = stop.value
    except PipelineError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))

    return {
        "project_id": project_id,
        "target": payload.target,
        "requirement_id": payload.requirement_id,
        "status": "completed",
        "content": results if payload.target == "all" else results[payload.target],
    }


@router.post("/{project_id}/generate/stream")
def generate_output_stream(project_id: str, payload: GenerateRequest):
    """SSE: status / reasoning / stage_done / module_done / done / error."""

    def event_stream():
        db = SessionLocal()
        start = time.monotonic()
        try:
            results = yield from _pipeline(db, project_id, payload)
            yield _sse("done", {
                "project_id": project_id,
                "target": payload.target,
                "requirement_id": payload.requirement_id,
                "status": "completed",
                "content": results if payload.target == "all" else results.get(payload.target, {}),
                "elapsed_ms": int((time.monotonic() - start) * 1000),
            })
        except Exception as e:
            yield _sse("error", {"message": str(e)})
        finally:
            db.close()

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    })
