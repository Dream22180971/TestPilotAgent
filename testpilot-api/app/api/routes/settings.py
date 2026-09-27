"""Runtime LLM settings: view and update model config without a restart."""

import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.llm_client import DEFAULT_MODEL, llm_client

router = APIRouter()

# testpilot-api/.env — persists runtime config across restarts
# settings.py → parents[3] = testpilot-api/
ENV_PATH = Path(__file__).resolve().parents[3] / ".env"

ENV_KEYS = {
    "api_key": "DASHSCOPE_API_KEY",
    "model": "LLM_MODEL",
    "base_url": "LLM_BASE_URL",
}


class SettingsUpdate(BaseModel):
    api_key: str | None = None
    model: str | None = None
    base_url: str | None = None


def _check_env_value(value: str) -> str:
    """Values are written as KEY="value" lines; refuse anything that could
    break out of the line or the quotes."""
    value = value.strip()
    if any(ch in value for ch in ('"', "\n", "\r")):
        raise HTTPException(status_code=400, detail="配置值不能包含引号或换行")
    return value


def _read_env_file() -> dict[str, str]:
    values: dict[str, str] = {}
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            values[key.strip()] = val.strip().strip('"').strip("'")
    return values


def _write_env_key(key: str, value: str) -> None:
    """Update or append one KEY=VALUE line while preserving the rest."""
    lines = []
    if ENV_PATH.exists():
        lines = ENV_PATH.read_text(encoding="utf-8").splitlines()

    replaced = False
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith(f"{key}=") or stripped.startswith(f"{key} ="):
            lines[i] = f'{key}="{value}"'
            replaced = True
            break
    if not replaced:
        lines.append(f'{key}="{value}"')

    ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


@router.get("")
def get_settings() -> dict:
    """Current LLM config (API key masked)."""
    status = llm_client.status()
    env = _read_env_file()
    # Persisted values that differ from what the process picked up at startup
    # (e.g. user edited .env manually after start) are surfaced too.
    return {
        **status,
        "default_model": DEFAULT_MODEL,
        "env_file": str(ENV_PATH),
        "env_has_key": bool(env.get("DASHSCOPE_API_KEY") or env.get("LLM_API_KEY")),
    }


@router.post("/test")
def test_connection(payload: SettingsUpdate) -> dict:
    """Test connectivity with the posted (or current) config, without saving."""
    return llm_client.test_connection(
        api_key=payload.api_key, model=payload.model, base_url=payload.base_url
    )


@router.post("/models")
def fetch_models(payload: SettingsUpdate) -> dict:
    """Fetch the provider's model list without saving or changing state."""
    import time

    from openai import OpenAI

    key, url = llm_client.probe_credentials(payload.api_key, payload.base_url)
    if not key:
        return {"ok": False, "models": [], "error": "未配置 API Key（更换 Base URL 时需同时填写对应的 Key）"}

    probe = OpenAI(api_key=key, base_url=url, timeout=20.0)
    try:
        start = time.monotonic()
        models = sorted(m.id for m in probe.models.list())
        return {"ok": True, "models": models, "latency_ms": int((time.monotonic() - start) * 1000)}
    except Exception as e:
        return {"ok": False, "models": [], "error": str(e)}


@router.post("")
def update_settings(payload: SettingsUpdate) -> dict:
    """Update LLM config: hot-swap the running client and persist to .env."""
    values = {field: _check_env_value(v) for field in ENV_KEYS if (v := getattr(payload, field))}
    if not values:
        return {"status": "no_change", **llm_client.status()}

    # A new endpoint must come with its own key, so the saved key is never
    # silently redirected to a different host.
    new_url = values.get("base_url")
    if new_url and new_url.rstrip("/") != llm_client.status()["base_url"].rstrip("/") and "api_key" not in values:
        raise HTTPException(status_code=400, detail="更换 Base URL 时请同时填写该服务的 API Key")

    llm_client.update_config(**values)

    for field, value in values.items():
        os.environ[ENV_KEYS[field]] = value
        _write_env_key(ENV_KEYS[field], value)

    return {"status": "saved", **llm_client.status()}
