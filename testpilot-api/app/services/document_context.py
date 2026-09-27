"""Collect uploaded-document text as extra LLM context for a project."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.services.db_store import DatabaseStore

store = DatabaseStore()


def collect_document_context(db: Session, project_id: str, requirement_text: str = "") -> dict | None:
    """Documents of this project whose text is not already in the requirement.

    Uploading a document also copies its text into the requirement box, so
    documents already contained in `requirement_text` are skipped to avoid
    sending the same content to the model twice.
    """
    texts: list[str] = []
    filenames: list[str] = []
    for doc in store.list_documents(db, project_id):
        full_text = (doc.get("extracted_text") or "").strip()
        if not full_text or full_text in requirement_text:
            continue
        texts.append(f"[File: {doc['filename']}] {full_text}")
        filenames.append(doc["filename"])

    if not texts:
        return None
    return {
        "has_documents": True,
        "filenames": filenames,
        "combined_text": "\n\n---\n\n".join(texts),
    }
