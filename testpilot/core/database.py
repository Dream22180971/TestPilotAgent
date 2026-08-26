import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session


def _default_database_url() -> str:
    base = Path.home() / ".testpilot"
    base.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{base / 'testpilot.db'}"


DATABASE_URL = (
    os.environ.get("TESTPILOT_DATABASE_URL")
    or os.environ.get("DATABASE_URL")
    or _default_database_url()
)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def create_tables() -> None:
    from testpilot.core.models import Base
    Base.metadata.create_all(bind=engine)


def get_session() -> Session:
    return SessionLocal()
