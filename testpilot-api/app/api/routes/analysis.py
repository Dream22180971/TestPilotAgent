from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.analysis import AnalyzeRequest
from app.services.db_store import DatabaseStore
from app.services.generation_service import build_analysis as rule_build_analysis
from app.services.llm_generation_service import analyze_with_llm
from app.api.routes.generation import _collect_document_context

router = APIRouter()
store = DatabaseStore()


@router.post("/{project_id}/analyze")
def analyze_requirement(project_id: str, payload: AnalyzeRequest, db: Session = Depends(get_db)) -> dict:
    project = store.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    requirement = store.get_requirement(db, payload.requirement_id)
    if not requirement or requirement["project_id"] != project_id:
        raise HTTPException(status_code=404, detail="Requirement not found")

    # Collect document context for LLM analysis
    doc_context = _collect_document_context(db, project_id, payload.requirement_id)

    # Try LLM first, fall back to rule engine
    content = analyze_with_llm(project, requirement, doc_context) or rule_build_analysis(project, requirement)

    # Save analysis as output for later reference
    store.save_output(db, project_id, "analysis", content)

    return {
        "project_id": project_id,
        "requirement_id": payload.requirement_id,
        **content,
    }
