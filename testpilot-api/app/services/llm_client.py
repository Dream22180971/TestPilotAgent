"""LLM client wrapper for OpenAI-compatible APIs (Aliyun DashScope / OpenAI).

Configuration sources (highest priority first):
  1. Runtime updates via `llm_client.update_config()` (saved by /api/settings)
  2. testpilot-api/.env loaded at startup (python-dotenv)
  3. Environment variables:
     - DASHSCOPE_API_KEY: Aliyun DashScope API key (takes priority)
     - LLM_API_KEY: Fallback API key (empty = fallback to rule engine)
     - LLM_BASE_URL: Base URL (default: DashScope compatible-mode)
     - LLM_MODEL: Model name
"""

import json
import logging
import os
from typing import Any

from openai import OpenAI

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
DEFAULT_MODEL = "qwen3-vl-flash-2026-01-22"


class LLMClient:
    """Thin wrapper around OpenAI-compatible client (DashScope / OpenAI).

    Keeps a mutable runtime config so the settings API can hot-swap
    the API key / model without a server restart.
    """

    def __init__(self) -> None:
        dashscope_key = os.environ.get("DASHSCOPE_API_KEY", "")
        self._api_key = dashscope_key or os.environ.get("LLM_API_KEY", "")
        self._base_url = os.environ.get("LLM_BASE_URL", DEFAULT_BASE_URL)
        self._model = os.environ.get("LLM_MODEL", DEFAULT_MODEL)
        self._client: OpenAI | None = None

    def update_config(
        self,
        api_key: str | None = None,
        model: str | None = None,
        base_url: str | None = None,
    ) -> None:
        """Hot-swap runtime config; pass None to keep the current value."""
        if api_key:
            self._api_key = api_key.strip()
        if model:
            self._model = model.strip()
        if base_url:
            self._base_url = base_url.strip()
        self._client = None

    @property
    def client(self) -> OpenAI:
        if self._client is None:
            self._client = OpenAI(api_key=self._api_key, base_url=self._base_url)
        return self._client

    @property
    def available(self) -> bool:
        return bool(self._api_key)

    def status(self) -> dict[str, Any]:
        """Current config for the settings UI (API key masked)."""
        masked = ""
        if self._api_key:
            key = self._api_key
            masked = f"{key[:4]}***{key[-4:]}" if len(key) > 10 else "***"
        return {
            "configured": self.available,
            "api_key_masked": masked,
            "model": self._model,
            "base_url": self._base_url,
        }

    def test_connection(
        self,
        api_key: str | None = None,
        model: str | None = None,
        base_url: str | None = None,
        timeout: float = 30.0,
    ) -> dict[str, Any]:
        """Validate config without mutating runtime state.

        1. GET /models — proves connectivity + key (some providers skip it).
        2. Minimal chat — proves the specific model accepts requests.
        """
        import time

        key = (api_key or self._api_key or "").strip()
        url = (base_url or self._base_url or "").strip()
        mdl = (model or self._model or "").strip()
        if not key:
            return {"ok": False, "error": "未配置 API Key"}

        probe = OpenAI(api_key=key, base_url=url, timeout=timeout)
        result: dict[str, Any] = {"ok": False, "models": [], "chat_ok": False}

        try:
            start = time.monotonic()
            result["models"] = [m.id for m in probe.models.list()]
            result["models_ok"] = True
        except Exception as e:
            result["models_ok"] = False
            result["models_error"] = str(e)

        try:
            start = time.monotonic()
            probe.chat.completions.create(
                model=mdl,
                temperature=0,
                max_tokens=8,
                messages=[{"role": "user", "content": "ping"}],
            )
            result["chat_ok"] = True
            result["latency_ms"] = int((time.monotonic() - start) * 1000)
        except Exception as e:
            result["chat_error"] = str(e)

        result["ok"] = result["chat_ok"]
        if result["ok"]:
            result["model"] = mdl
        return result

    def chat(self, system_prompt: str, user_prompt: str, temperature: float = 0.3) -> str:
        """Send a chat completion request and return the content string."""
        if not self.available:
            raise RuntimeError("LLM not configured (no API key)")

        try:
            resp = self.client.chat.completions.create(
                model=self._model,
                temperature=temperature,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
        except Exception as e:
            logger.error(f"LLM chat error: {e}")
            raise
        return resp.choices[0].message.content or ""

    def chat_structured(self, system_prompt: str, user_prompt: str, temperature: float = 0.3) -> dict[str, Any]:
        """Send a chat completion and parse the response as JSON.

        Retries once on JSON parse failure.
        """
        raw = self.chat(system_prompt, user_prompt, temperature)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("First LLM call returned invalid JSON, retrying...")
            raw = self.chat(system_prompt, user_prompt, temperature + 0.1)
            return json.loads(raw)


llm_client = LLMClient()
