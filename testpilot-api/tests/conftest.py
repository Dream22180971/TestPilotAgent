import os
import tempfile
from pathlib import Path

import pytest

# Point the app at a throwaway SQLite file before app.database is imported.
_DB_FILE = Path(tempfile.mkdtemp()) / "test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.as_posix()}"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services.llm_client import llm_client  # noqa: E402


@pytest.fixture()
def client(monkeypatch):
    # Rule-engine mode: tests never reach a real model.
    monkeypatch.setattr(llm_client, "_api_key", "")
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def project(client):
    resp = client.post("/api/projects", json={
        "name": "电商下单", "system_type": "Web", "test_types": ["功能测试"], "script_language": "Python",
    })
    return resp.json()


@pytest.fixture()
def requirement(client, project):
    resp = client.post(f"/api/projects/{project['id']}/requirements", json={
        "raw_input": "用户登录后下单并支付，支付失败可重试",
        "extra_context": {"business_flow": "登录-下单-支付", "roles": ["买家"], "non_functional": []},
    })
    return resp.json()
