"""Minimal .env loader: reads cwd/.env then ~/.testpilot/.env (first wins)."""

import os
from pathlib import Path


def load_env() -> None:
    candidates = [Path.cwd() / ".env", Path.home() / ".testpilot" / ".env"]
    for path in candidates:
        if not path.is_file():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


def llm_settings() -> dict:
    load_env()
    api_key = os.environ.get("DASHSCOPE_API_KEY", "") or os.environ.get("LLM_API_KEY", "")
    return {
        "api_key": api_key,
        "base_url": os.environ.get("LLM_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
        "model": os.environ.get("LLM_MODEL", "qwen-plus"),
        "available": bool(api_key),
    }
