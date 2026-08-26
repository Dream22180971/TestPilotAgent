"""LLM client wrapper for OpenAI-compatible APIs (Aliyun DashScope / OpenAI)."""

import json
import logging
from typing import Any

from openai import OpenAI

from testpilot.core.config import llm_settings

logger = logging.getLogger(__name__)


class LLMClient:
    """Thin wrapper around OpenAI-compatible client (DashScope / OpenAI)."""

    def __init__(self) -> None:
        self._client: OpenAI | None = None

    def _cfg(self) -> dict:
        return llm_settings()

    @property
    def available(self) -> bool:
        return bool(self._cfg()["api_key"])

    def _ensure_client(self) -> OpenAI:
        cfg = self._cfg()
        if self._client is None:
            self._client = OpenAI(api_key=cfg["api_key"], base_url=cfg["base_url"])
        return self._client

    def chat(self, system_prompt: str, user_prompt: str, temperature: float = 0.3) -> str:
        cfg = self._cfg()
        if not cfg["available"]:
            raise RuntimeError("LLM not available (DASHSCOPE_API_KEY / LLM_API_KEY not set)")

        try:
            resp = self._ensure_client().chat.completions.create(
                model=cfg["model"],
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
        raw = self.chat(system_prompt, user_prompt, temperature)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("First LLM call returned invalid JSON, retrying...")
            raw = self.chat(system_prompt, user_prompt, temperature + 0.1)
            return json.loads(raw)


llm_client = LLMClient()
