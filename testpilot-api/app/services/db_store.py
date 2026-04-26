from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy.orm import Session

from app.models import ProjectModel, RequirementModel, OutputModel, DocumentModel


class DatabaseStore:

    def create_project(self, db: Session, payload: dict) -> dict:
        project_id = f"proj_{uuid4().hex[:8]}"
        now = datetime.now(timezone.utc)
        project = ProjectModel(
            id=project_id,
            name=payload["name"],
            system_type=payload["system_type"],
            test_types=payload.get("test_types", []),
            script_language=payload.get("script_language", "Python"),
            output_language=payload.get("output_language", "中文"),
            created_at=now,
            updated_at=now,
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        return project.to_dict()

    def list_projects(self, db: Session) -> list[dict]:
        projects = db.query(ProjectModel).order_by(ProjectModel.updated_at.desc()).all()
        return [p.to_dict() for p in projects]

    def get_project(self, db: Session, project_id: str) -> dict | None:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        return project.to_dict() if project else None

    def save_requirement(self, db: Session, project_id: str, raw_input: str, extra_context: dict) -> dict:
        requirement_id = f"req_{uuid4().hex[:8]}"
        now = datetime.now(timezone.utc)
        record = RequirementModel(
            id=requirement_id,
            project_id=project_id,
            raw_input=raw_input,
            extra_context=extra_context,
            created_at=now,
        )
        db.add(record)

        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if project:
            project.updated_at = now

        db.commit()
        db.refresh(record)
        return record.to_dict()

    def get_requirement(self, db: Session, requirement_id: str) -> dict | None:
        record = db.query(RequirementModel).filter(RequirementModel.id == requirement_id).first()
        return record.to_dict() if record else None

    def save_output(self, db: Session, project_id: str, target: str, content: dict) -> dict:
        now = datetime.now(timezone.utc)
        existing = db.query(OutputModel).filter(
            OutputModel.project_id == project_id,
            OutputModel.target == target,
        ).first()

        if existing:
            existing.content = content
            existing.status = "completed"
            existing.updated_at = now
            record = existing
        else:
            record = OutputModel(
                project_id=project_id,
                target=target,
                status="completed",
                content=content,
                updated_at=now,
            )
            db.add(record)

        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if project:
            project.updated_at = now
            project.last_generated_module = target

        db.commit()
        db.refresh(record)
        return record.to_dict()

    def get_output(self, db: Session, project_id: str, target: str) -> dict | None:
        record = db.query(OutputModel).filter(
            OutputModel.project_id == project_id,
            OutputModel.target == target,
        ).first()
        return record.to_dict() if record else None

    def save_document(self, db: Session, project_id: str, filename: str, file_format: str, extracted_text: str, text_preview: str, page_count: int = 0) -> dict:
        doc_id = f"doc_{uuid4().hex[:8]}"
        now = datetime.now(timezone.utc)
        doc = DocumentModel(
            id=doc_id,
            project_id=project_id,
            filename=filename,
            file_format=file_format,
            extracted_text=extracted_text,
            text_preview=text_preview,
            page_count=page_count,
            created_at=now,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        return doc.to_dict()

    def list_documents(self, db: Session, project_id: str) -> list[dict]:
        docs = db.query(DocumentModel).filter(DocumentModel.project_id == project_id).order_by(DocumentModel.created_at.desc()).all()
        return [d.to_dict() for d in docs]

    def get_document(self, db: Session, document_id: str) -> dict | None:
        doc = db.query(DocumentModel).filter(DocumentModel.id == document_id).first()
        return doc.to_dict() if doc else None

    def delete_document(self, db: Session, document_id: str) -> None:
        doc = db.query(DocumentModel).filter(DocumentModel.id == document_id).first()
        if doc:
            db.delete(doc)
            db.commit()
