import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.schemas.generation import FollowupRequest
from app.services.db_store import DatabaseStore
from app.services.followup_service import (
    apply_followup,
    discard_followup,
    process_followup,
    stream_followup_proposal,
)

router = APIRouter()
store = DatabaseStore()


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _require_project(db: Session, project_id: str) -> None:
    if not store.get_project(db, project_id):
        raise HTTPException(status_code=404, detail="Project not found")


@router.post("/{project_id}/followup")
def followup(project_id: str, payload: FollowupRequest, db: Session = Depends(get_db)) -> dict:
    """One-shot revise-and-save (kept for API clients; the web app uses stream + apply)."""
    _require_project(db, project_id)
    return process_followup(db, project_id, payload.target, payload.instruction)


@router.get("/{project_id}/followups")
def list_followups(project_id: str, db: Session = Depends(get_db)) -> list[dict]:
    """Follow-up history (revision log) of the project, oldest first."""
    _require_project(db, project_id)
    return store.list_followups(db, project_id)


@router.post("/{project_id}/followup/stream")
def followup_stream(project_id: str, payload: FollowupRequest):
    """SSE: `record` (the saved round), `reasoning` deltas, final `record` or `error`.
    The module output is not changed until the round is applied."""

    def event_stream():
        db = SessionLocal()
        try:
            if not store.get_project(db, project_id):
                yield _sse("error", {"message": "Project not found"})
                return
            for chunk in stream_followup_proposal(db, project_id, payload.target, payload.instruction):
                if "reasoning" in chunk:
                    yield _sse("reasoning", {"delta": chunk["reasoning"]})
                elif "record" in chunk:
                    yield _sse("record", chunk["record"])
                elif "error" in chunk:
                    yield _sse("error", {"message": chunk["error"]})
        except Exception as e:
            yield _sse("error", {"message": str(e)})
        finally:
            db.close()

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    })


@router.post("/{project_id}/followups/{followup_id}/apply")
def followup_apply(project_id: str, followup_id: str, db: Session = Depends(get_db)) -> dict:
    """Apply a proposed revision the user confirmed."""
    _require_project(db, project_id)
    try:
        return apply_followup(db, project_id, followup_id)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"修订内容格式不正确：{e}")


@router.post("/{project_id}/followups/{followup_id}/discard")
def followup_discard(project_id: str, followup_id: str, db: Session = Depends(get_db)) -> dict:
    _require_project(db, project_id)
    try:
        return discard_followup(db, project_id, followup_id)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
