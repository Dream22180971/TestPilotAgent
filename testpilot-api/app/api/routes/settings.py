"""Runtime LLM settings: view and update model config without a restart."""

import os
from pathlib import Path

from fastapi import APIRouter
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

    key = (payload.api_key or llm_client._api_key or "").strip()
    url = (payload.base_url or llm_client._base_url or "").strip()
    if not key:
        return {"ok": False, "models": [], "error": "未配置 API Key"}

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
    if payload.api_key is None and payload.model is None and payload.base_url is None:
        return {"status": "no_change", **llm_client.status()}

    llm_client.update_config(api_key=payload.api_key, model=payload.model, base_url=payload.base_url)

    for field, env_key in ENV_KEYS.items():
        value = getattr(payload, field)
        if value:
            os.environ[env_key] = value.strip()
            _write_env_key(env_key, value.strip())

    return {"status": "saved", **llm_client.status()}
