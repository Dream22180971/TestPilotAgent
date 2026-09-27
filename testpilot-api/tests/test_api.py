import json

from app.services.llm_client import llm_client
from app.services.llm_generation_service import build_prompts, parse_llm_json, validate_output

ALL_TARGETS = ["analysis", "test_strategy", "test_plan", "test_points", "test_cases", "test_design"]


def _sse_events(body: str) -> list[tuple[str, dict]]:
    events = []
    for frame in body.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in frame.splitlines())
        events.append((lines["event"], json.loads(lines["data"])))
    return events


def test_stream_all_without_saved_analysis_generates_every_module(client, project, requirement):
    resp = client.post(
        f"/api/projects/{project['id']}/generate/stream",
        json={"target": "all", "requirement_id": requirement["requirement_id"]},
    )
    events = _sse_events(resp.text)
    assert [e for e, _ in events if e == "error"] == []
    done_targets = [d["target"] for e, d in events if e == "module_done"]
    assert done_targets == ALL_TARGETS
    assert events[-1][0] == "done"
    assert set(events[-1][1]["content"]) == set(ALL_TARGETS)


def test_single_target_generates_missing_upstream(client, project, requirement):
    resp = client.post(
        f"/api/projects/{project['id']}/generate",
        json={"target": "test_cases", "requirement_id": requirement["requirement_id"]},
    )
    assert resp.status_code == 200
    assert resp.json()["content"]["cases"]
    snapshot = client.get(f"/api/projects/{project['id']}/snapshot").json()
    assert {"analysis", "test_points", "test_cases"} <= set(snapshot["outputs"])
    assert snapshot["requirement"]["id"] == requirement["requirement_id"]


def test_unknown_target_is_rejected(client, project, requirement):
    resp = client.post(
        f"/api/projects/{project['id']}/generate",
        json={"target": "test_script", "requirement_id": requirement["requirement_id"]},
    )
    assert resp.status_code == 400


def test_analyze_returns_full_analysis_shape(client, project, requirement):
    resp = client.post(f"/api/projects/{project['id']}/analyze", json={"requirement_id": requirement["requirement_id"]})
    body = resp.json()
    for key in ["business_goal", "roles", "modules", "core_flows", "business_rules", "constraints", "risks", "unknowns"]:
        assert key in body


def test_partial_llm_analysis_is_normalized():
    out = validate_output("analysis", {"business_goal": "下单", "modules": ["登录", {"name": "支付"}]})
    assert out["modules"] == [{"name": "登录", "description": ""}, {"name": "支付", "description": ""}]
    assert out["business_rules"] == [] and out["unknowns"] == []


def test_parse_llm_json_tolerates_fences_and_chatter():
    assert parse_llm_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert parse_llm_json('好的，结果如下：{"a": 2} 以上') == {"a": 2}


def test_prompts_include_uploaded_documents():
    project = {"system_type": "Web", "test_types": [], "script_language": "Python"}
    requirement = {"raw_input": "下单", "extra_context": {}}
    doc = {"has_documents": True, "filenames": ["prd.md"], "combined_text": "退款需在 7 天内完成"}
    _, user = build_prompts(project, requirement, "test_points", {"modules": []}, None, doc)
    assert "退款需在 7 天内完成" in user


def test_followup_without_llm_reports_failure(client, project, requirement):
    pid = project["id"]
    client.post(f"/api/projects/{pid}/generate", json={"target": "test_points", "requirement_id": requirement["requirement_id"]})
    resp = client.post(f"/api/projects/{pid}/followup", json={"target": "test_points", "instruction": "补充并发场景"})
    assert resp.json()["status"] == "failed"


def test_export_unknown_project_is_404(client):
    resp = client.post("/api/projects/proj_missing/export", json={"format": "json", "targets": ["test_points"]})
    assert resp.status_code == 404


def test_export_xlsx_includes_analysis(client, project, requirement):
    pid = project["id"]
    client.post(f"/api/projects/{pid}/generate", json={"target": "all", "requirement_id": requirement["requirement_id"]})
    resp = client.post(f"/api/projects/{pid}/export", json={"format": "xlsx", "targets": ALL_TARGETS})
    assert resp.status_code == 200 and resp.json()["data"]


def test_cors_rejects_foreign_origin(client):
    resp = client.options("/api/settings/models", headers={
        "Origin": "https://evil.example", "Access-Control-Request-Method": "POST",
    })
    assert "access-control-allow-origin" not in resp.headers


def test_stored_key_is_not_sent_to_another_base_url(monkeypatch):
    monkeypatch.setattr(llm_client, "_api_key", "sk-secret")
    monkeypatch.setattr(llm_client, "_base_url", "https://dashscope.aliyuncs.com/compatible-mode/v1")
    assert llm_client.probe_credentials(None, "https://evil.example/v1") == ("", "https://evil.example/v1")
    assert llm_client.probe_credentials(None, None)[0] == "sk-secret"


def test_changing_base_url_requires_key(client, monkeypatch, tmp_path):
    from app.api.routes import settings

    monkeypatch.setattr(settings, "ENV_PATH", tmp_path / ".env")  # never touch the real .env
    resp = client.post("/api/settings", json={"base_url": "https://evil.example/v1"})
    assert resp.status_code == 400


def _fake_stream(answer: dict):
    def chat_stream(system, user, temperature=0.3):
        yield {"reasoning": "思考中"}
        yield {"done": json.dumps(answer, ensure_ascii=False)}
    return chat_stream


def _points(client, pid, rid):
    client.post(f"/api/projects/{pid}/generate", json={"target": "test_points", "requirement_id": rid})
    return client.get(f"/api/projects/{pid}/snapshot").json()["outputs"]["test_points"]


def test_followup_question_answers_without_changing_output(client, project, requirement, monkeypatch):
    pid = project["id"]
    before = _points(client, pid, requirement["requirement_id"])
    monkeypatch.setattr(llm_client, "_api_key", "sk-test")
    monkeypatch.setattr(llm_client, "chat_stream", _fake_stream({"reply": "建议补充并发场景", "changes": [], "revised": None}))
    resp = client.post(f"/api/projects/{pid}/followup/stream", json={"target": "test_points", "instruction": "还有什么补充吗"})
    events = _sse_events(resp.text)
    assert [e for e, _ in events] == ["record", "reasoning", "record"]
    record = events[-1][1]
    assert record["status"] == "answered" and record["reply"] == "建议补充并发场景"
    assert client.get(f"/api/projects/{pid}/snapshot").json()["outputs"]["test_points"] == before
    # the round is kept as history
    history = client.get(f"/api/projects/{pid}/followups").json()
    assert [(h["instruction"], h["status"]) for h in history] == [("还有什么补充吗", "answered")]


def test_followup_revision_is_saved_only_after_apply(client, project, requirement, monkeypatch):
    pid = project["id"]
    before = _points(client, pid, requirement["requirement_id"])
    revised = {"rows": before["rows"] + [{"module": "支付", "scenario": "并发", "point": "并发支付", "type": "边界", "priority": "高"}]}
    monkeypatch.setattr(llm_client, "_api_key", "sk-test")
    monkeypatch.setattr(llm_client, "chat_stream", _fake_stream({"reply": "已补充", "changes": ["新增并发支付"], "revised": revised}))
    resp = client.post(f"/api/projects/{pid}/followup/stream", json={"target": "test_points", "instruction": "补充并发"})
    record = _sse_events(resp.text)[-1][1]
    assert record["status"] == "proposed" and record["changes"] == ["新增并发支付"]
    assert client.get(f"/api/projects/{pid}/snapshot").json()["outputs"]["test_points"] == before

    applied = client.post(f"/api/projects/{pid}/followups/{record['id']}/apply")
    assert applied.status_code == 200 and applied.json()["record"]["status"] == "applied"
    snapshot = client.get(f"/api/projects/{pid}/snapshot").json()
    assert len(snapshot["outputs"]["test_points"]["rows"]) == len(before["rows"]) + 1
    assert snapshot["followups"][0]["status"] == "applied"
    # applying twice is refused
    assert client.post(f"/api/projects/{pid}/followups/{record['id']}/apply").status_code == 409


def test_followup_discard_keeps_output(client, project, requirement, monkeypatch):
    pid = project["id"]
    before = _points(client, pid, requirement["requirement_id"])
    monkeypatch.setattr(llm_client, "_api_key", "sk-test")
    monkeypatch.setattr(llm_client, "chat_stream", _fake_stream({"reply": "改", "changes": ["x"], "revised": {"rows": []}}))
    record = _sse_events(client.post(f"/api/projects/{pid}/followup/stream", json={"target": "test_points", "instruction": "删光"}).text)[-1][1]
    assert client.post(f"/api/projects/{pid}/followups/{record['id']}/discard").json()["record"]["status"] == "discarded"
    assert client.get(f"/api/projects/{pid}/snapshot").json()["outputs"]["test_points"] == before
