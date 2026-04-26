from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.generation import ExportRequest
from app.services.db_store import DatabaseStore
from app.services.export_service import export_outputs

router = APIRouter()
store = DatabaseStore()


@router.post("/{project_id}/export")
def export_outputs_route(project_id: str, payload: ExportRequest, db: Session = Depends(get_db)):
    result = export_outputs(db, project_id, payload.format, payload.targets)
    return result
