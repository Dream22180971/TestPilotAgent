from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.generation import FollowupRequest
from app.services.db_store import DatabaseStore
from app.services.followup_service import process_followup

router = APIRouter()
store = DatabaseStore()


@router.post("/{project_id}/followup")
def followup(project_id: str, payload: FollowupRequest, db: Session = Depends(get_db)) -> dict:
    if not store.get_project(db, project_id):
        raise HTTPException(status_code=404, detail="Project not found")

    result = process_followup(db, project_id, payload.target, payload.instruction)
    return result
