from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.generation import GenerateRequest
from app.services.db_store import DatabaseStore
from app.services.generation_service import build_analysis as rule_build_analysis
from app.services.generation_service import generate_test_cases, generate_test_points
from app.services.llm_generation_service import analyze_with_llm, generate_with_llm

router = APIRouter()
store = DatabaseStore()

TARGETS = ["analysis", "test_strategy", "test_plan", "test_points", "test_cases", "test_script"]


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
        analyze_with_llm(project, requirement, doc_context) or rule_build_analysis(project, requirement)
    )

    # Get previous output for context
    previous = store.get_output(db, project_id, target)
    previous_content = previous["content"] if previous else None

    # Try LLM first, fall back to rule engine
    if target == "test_points":
        content = generate_with_llm(project, requirement, target, analysis, previous_content, doc_context) or generate_test_points(analysis)
    elif target == "test_cases":
        points_output = store.get_output(db, project_id, "test_points")
        pts = points_output["content"] if points_output else {"rows": []}
        content = generate_with_llm(project, requirement, target, str(pts), previous_content, doc_context) or generate_test_cases(pts)
    else:
        content = generate_with_llm(project, requirement, target, str(analysis), previous_content, doc_context) or {"note": f"Rule engine fallback for {target}"}

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
        analyze_with_llm(project, requirement, doc_context) or rule_build_analysis(project, requirement)
    )
    store.save_output(db, project_id, "analysis", analysis)

    results = {"analysis": analysis}
    for t in [t for t in TARGETS if t != "analysis"]:
        prev = store.get_output(db, project_id, t)
        prev_content = prev["content"] if prev else None

        if t == "test_points":
            content = generate_with_llm(project, requirement, t, str(analysis), prev_content, doc_context) or generate_test_points(analysis)
        elif t == "test_cases":
            points_output = store.get_output(db, project_id, "test_points")
            pts = points_output["content"] if points_output else {"rows": []}
            content = generate_with_llm(project, requirement, t, str(pts), prev_content, doc_context) or generate_test_cases(pts)
        else:
            content = generate_with_llm(project, requirement, t, str(analysis), prev_content, doc_context) or {"note": f"Rule engine fallback for {t}"}

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

    # Find documents whose text preview was used as raw_input (i.e. uploaded docs)
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
