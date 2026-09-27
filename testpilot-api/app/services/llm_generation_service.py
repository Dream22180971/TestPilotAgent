"""LLM-powered generation with Pydantic schema validation.

Callers fall back to the rule engine (generation_service) when these
functions yield/return None.
"""

from __future__ import annotations

import json
import re
from typing import Any

from app.schemas.output_schemas import SCHEMA_MAP
from app.services.llm_client import llm_client
from app.services.prompt_loader import render_prompt

TARGET_PROMPT = {
    "analysis": "requirement_analysis",
    "test_strategy": "test_strategy",
    "test_plan": "test_plan",
    "test_points": "test_points",
    "test_cases": "test_cases",
    "test_design": "test_design",
}

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)


def parse_llm_json(raw: str) -> dict[str, Any]:
    """Parse a model answer as a JSON object, tolerating ```json fences
    and chatter around the object (seen with some OpenAI-compatible hosts)."""
    text = _FENCE_RE.sub("", raw.strip())
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start < 0 or end <= start:
            raise
        return json.loads(text[start : end + 1])


def validate_output(target: str, content: dict[str, Any]) -> dict[str, Any]:
    """Coerce content into the target's schema; raises on invalid shape."""
    schema_cls = SCHEMA_MAP.get(target)
    return schema_cls(**content).model_dump() if schema_cls else content


def _as_prompt_text(value: Any) -> str:
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, indent=1)
    return str(value)


def _build_context(project: dict, requirement: dict, doc_context: dict | None = None) -> str:
    """Build a context string from project, requirement and uploaded documents."""
    extra = requirement.get("extra_context", {}) or {}
    parts = [
        f"## 项目信息\n系统类型: {project.get('system_type', '')}",
        f"测试类型: {', '.join(project.get('test_types', []))}",
        f"脚本语言: {project.get('script_language', '')}",
        f"输出语言: {project.get('output_language', '中文')}",
        f"\n## 需求正文\n{requirement.get('raw_input', '')}",
    ]
    if extra.get("business_flow"):
        parts.append(f"\n## 核心业务流程\n{extra['business_flow']}")
    if extra.get("roles"):
        parts.append(f"\n## 用户角色\n{', '.join(str(r) for r in extra['roles'])}")
    if extra.get("non_functional"):
        nf = extra["non_functional"]
        if isinstance(nf, list):
            parts.append(f"\n## 非功能要求\n{chr(10).join('- ' + str(item) for item in nf)}")
        else:
            parts.append(f"\n## 非功能要求\n{nf}")
    if doc_context and doc_context.get("has_documents"):
        parts.append("\n## 上传文档参考")
        parts.append(f"文档列表：{', '.join(doc_context['filenames'])}")
        parts.append(f"\n{doc_context['combined_text']}")
    return "\n".join(parts)


def build_prompts(
    project: dict,
    requirement: dict,
    target: str,
    basis: Any = None,
    previous_output: Any = None,
    doc_context: dict | None = None,
) -> tuple[str, str] | None:
    """Assemble (system, user) prompts for a target; None if target unknown.

    `basis` is the upstream output this target builds on: the requirement
    analysis for most targets, the test points for test_cases.
    """
    prompt_name = TARGET_PROMPT.get(target)
    if not prompt_name:
        return None

    context = _build_context(project, requirement, doc_context)
    if basis:
        heading = "测试点" if target == "test_cases" else "需求分析结果"
        context += f"\n\n## {heading}\n{_as_prompt_text(basis)}"

    system = render_prompt("system_prompt")
    # 思考语言提示放在 user 最前——部分模型（如 MiMo）思考语言跟随输入语言主导
    user = f"【要求：全程使用简体中文思考（thinking），输出值均为中文】\n\n{render_prompt(prompt_name)}\n\n{context}"

    if previous_output:
        user += f"\n\n## 当前已有输出（供参考）\n{_as_prompt_text(previous_output)}"
    return system, user


def generate_with_llm_stream(
    project: dict,
    requirement: dict,
    target: str,
    basis: Any = None,
    previous_output: Any = None,
    doc_context: dict | None = None,
):
    """Yield {"reasoning": str} deltas while the model thinks, then a final
    {"result": dict} (validated output) or {"result": None} on failure."""
    prompts = build_prompts(project, requirement, target, basis, previous_output, doc_context)
    if prompts is None:
        yield {"result": None}
        return
    system, user = prompts

    full = ""
    try:
        for chunk in llm_client.chat_stream(system, user):
            if "reasoning" in chunk:
                yield chunk
            elif "content" in chunk:
                full += chunk["content"]
            elif "done" in chunk:
                full = chunk["done"]
    except Exception:
        yield {"result": None}
        return

    try:
        yield {"result": validate_output(target, parse_llm_json(full))}
    except Exception:
        yield {"result": None}
