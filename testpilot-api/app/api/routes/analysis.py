from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.routes.generation import generate_output
from app.database import get_db
from app.schemas.analysis import AnalyzeRequest
from app.schemas.generation import GenerateRequest

router = APIRouter()


@router.post("/{project_id}/analyze")
def analyze_requirement(project_id: str, payload: AnalyzeRequest, db: Session = Depends(get_db)) -> dict:
    result = generate_output(
        project_id, GenerateRequest(target="analysis", requirement_id=payload.requirement_id), db
    )
    return {
        "project_id": project_id,
        "requirement_id": payload.requirement_id,
        **result["content"],
    }
