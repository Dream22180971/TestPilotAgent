from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, Text, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class ProjectModel(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    system_type = Column(String, nullable=False)
    test_types = Column(JSON, nullable=False)
    script_language = Column(String, nullable=False)
    output_language = Column(String, default="中文")
    last_generated_module = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    requirements = relationship("RequirementModel", back_populates="project", cascade="all, delete-orphan")
    outputs = relationship("OutputModel", back_populates="project", cascade="all, delete-orphan")
    documents = relationship("DocumentModel", back_populates="project", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "system_type": self.system_type,
            "test_types": self.test_types,
            "script_language": self.script_language,
            "output_language": self.output_language,
            "last_generated_module": self.last_generated_module,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class RequirementModel(Base):
    __tablename__ = "requirements"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    raw_input = Column(Text, default="")
    extra_context = Column(JSON, default=dict)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    project = relationship("ProjectModel", back_populates="requirements")

    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "raw_input": self.raw_input,
            "extra_context": self.extra_context,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class OutputModel(Base):
    __tablename__ = "outputs"
    __table_args__ = (UniqueConstraint("project_id", "target"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    target = Column(String, nullable=False)
    status = Column(String, default="completed")
    content = Column(JSON, nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    project = relationship("ProjectModel", back_populates="outputs")

    def to_dict(self):
        return {
            "project_id": self.project_id,
            "target": self.target,
            "status": self.status,
            "content": self.content,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class DocumentModel(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    filename = Column(String, nullable=False)
    file_format = Column(String, nullable=False)
    extracted_text = Column(Text, default="")
    text_preview = Column(String(500), default="")
    page_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    project = relationship("ProjectModel", back_populates="documents")

    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "filename": self.filename,
            "file_format": self.file_format,
            "extracted_text": self.extracted_text,
            "text_preview": self.text_preview,
            "page_count": self.page_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
