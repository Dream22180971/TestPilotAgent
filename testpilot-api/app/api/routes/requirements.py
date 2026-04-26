from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.requirement import RequirementCreate
from app.services.db_store import DatabaseStore

router = APIRouter()
store = DatabaseStore()


@router.post("/{project_id}/requirements")
def save_requirement(project_id: str, payload: RequirementCreate, db: Session = Depends(get_db)) -> dict:
    if not store.get_project(db, project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    requirement = store.save_requirement(db, project_id, payload.raw_input, payload.extra_context)
    return {
        "project_id": project_id,
        "requirement_id": requirement["id"],
        "raw_input": requirement["raw_input"],
        "extra_context": requirement["extra_context"],
        "status": "saved",
    }
