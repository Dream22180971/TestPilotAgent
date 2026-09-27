from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.project import ProjectCreate, ProjectResponse
from app.services.db_store import DatabaseStore

router = APIRouter()
store = DatabaseStore()


@router.post("", response_model=ProjectResponse)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)) -> ProjectResponse:
    project = store.create_project(db, payload.model_dump())
    return ProjectResponse(**project)


@router.get("")
def list_projects(db: Session = Depends(get_db)) -> dict:
    return {"items": store.list_projects(db)}


@router.get("/{project_id}")
def get_project(project_id: str, db: Session = Depends(get_db)) -> dict:
    project = store.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/{project_id}/snapshot")
def get_project_snapshot(project_id: str, db: Session = Depends(get_db)) -> dict:
    """Latest requirement + every saved output, for reopening a project."""
    if not store.get_project(db, project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    return {
        "requirement": store.get_latest_requirement(db, project_id),
        "outputs": {o["target"]: o["content"] for o in store.list_outputs(db, project_id)},
        "followups": store.list_followups(db, project_id),
    }
