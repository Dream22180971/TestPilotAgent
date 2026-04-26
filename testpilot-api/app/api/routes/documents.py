from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.db_store import DatabaseStore
from app.services.document_parser import parse_document

router = APIRouter()
store = DatabaseStore()

ALLOWED_EXTENSIONS = {".txt", ".pdf", ".docx"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.get("/{project_id}/documents")
def list_documents(project_id: str, db: Session = Depends(get_db)) -> list[dict]:
    """List all uploaded documents for a project."""
    if not store.get_project(db, project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    return store.list_documents(db, project_id)


@router.get("/{project_id}/documents/{document_id}")
def get_document(project_id: str, document_id: str, db: Session = Depends(get_db)) -> dict:
    """Get a single document by ID."""
    doc = store.get_document(db, document_id)
    if not doc or doc["project_id"] != project_id:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{project_id}/documents/{document_id}")
def delete_document(project_id: str, document_id: str, db: Session = Depends(get_db)) -> dict:
    """Delete a document."""
    doc = store.get_document(db, document_id)
    if not doc or doc["project_id"] != project_id:
        raise HTTPException(status_code=404, detail="Document not found")
    store.delete_document(db, document_id)
    return {"status": "deleted", "document_id": document_id}


@router.post("/{project_id}/documents")
async def upload_document(project_id: str, file: UploadFile, db: Session = Depends(get_db)) -> dict:
    if not store.get_project(db, project_id):
        raise HTTPException(status_code=404, detail="Project not found")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    ext = f".{file.filename.rsplit('.', 1)[-1].lower()}" if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file extension: {ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    result = parse_document(content, ext, file.filename)

    doc = store.save_document(
        db,
        project_id=project_id,
        filename=file.filename,
        file_format=ext.lstrip("."),
        extracted_text=result["text"],
        text_preview=result["text"][:500],
        page_count=result.get("page_count", 0),
    )

    return {
        "project_id": project_id,
        "document_id": doc["id"],
        "filename": doc["filename"],
        "file_format": doc["file_format"],
        "text_preview": doc["text_preview"],
        "page_count": doc["page_count"],
        "status": "parsed",
    }
