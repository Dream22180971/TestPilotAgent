"""LLM client wrapper for OpenAI-compatible APIs (Aliyun DashScope / OpenAI).

Configurable via environment variables:
  - DASHSCOPE_API_KEY: Aliyun DashScope API key (takes priority)
  - LLM_API_KEY: Fallback API key (empty = fallback to rule engine)
  - LLM_BASE_URL: Base URL (default: DashScope compatible-mode)
  - LLM_MODEL: Model name (default: qwen-plus)
"""

import json
import logging
import os
from typing import Any

from openai import OpenAI

logger = logging.getLogger(__name__)

# Aliyun DashScope takes priority; fall back to generic LLM_API_KEY
_DASHSCOPE_KEY = os.environ.get("DASHSCOPE_API_KEY", "")
_API_KEY = _DASHSCOPE_KEY or os.environ.get("LLM_API_KEY", "")
_BASE_URL = os.environ.get("LLM_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
_MODEL = os.environ.get("LLM_MODEL", "qwen3-vl-flash-2026-01-22")


class LLMClient:
    """Thin wrapper around OpenAI-compatible client (DashScope / OpenAI)."""

    def __init__(self) -> None:
        self._client: OpenAI | None = None
        self._available: bool = bool(_API_KEY)

    @property
    def client(self) -> OpenAI:
        if self._client is None:
            self._client = OpenAI(api_key=_API_KEY, base_url=_BASE_URL)
        return self._client

    @property
    def available(self) -> bool:
        return self._available

    def chat(self, system_prompt: str, user_prompt: str, temperature: float = 0.3) -> str:
        """Send a chat completion request and return the content string."""
        if not self._available:
            raise RuntimeError("LLM not available (LLM_API_KEY not set)")

        try:
            resp = self.client.chat.completions.create(
                model=_MODEL,
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
