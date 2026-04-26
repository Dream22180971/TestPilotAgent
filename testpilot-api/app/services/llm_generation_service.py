"""LLM-powered generation service with Pydantic schema validation.

Falls back to rule-based generation_service when LLM is unavailable.
"""

from __future__ import annotations

from typing import Any

from app.schemas.output_schemas import (
    SCHEMA_MAP,
    TestCasesOutput,
    TestPlanOutput,
    TestPointsOutput,
    TestScriptsOutput,
    TestStrategyOutput,
)
from app.services import generation_service as rule_service
from app.services.llm_client import llm_client
from app.services.prompt_loader import render_prompt

TARGET_SCHEMA = {
    "analysis": None,
    "test_strategy": TestStrategyOutput,
    "test_plan": TestPlanOutput,
    "test_points": TestPointsOutput,
    "test_cases": TestCasesOutput,
    "test_script": TestScriptsOutput,
}

TARGET_PROMPT = {
    "analysis": "requirement_analysis",
    "test_strategy": "test_strategy",
    "test_plan": "test_plan",
    "test_points": "test_points",
    "test_cases": "test_cases",
    "test_script": "test_script",
}


def _build_context(
    project: dict,
    requirement: dict,
    doc_context: dict | None = None,
) -> str:
    """Build a context string from project and requirement for prompts."""
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


def analyze_with_llm(project: dict, requirement: dict, doc_context: dict | None = None) -> dict[str, Any] | None:
    """Use LLM to analyze requirements. Returns None to trigger fallback."""
    if not llm_client.available:
        return None

    context = _build_context(project, requirement, doc_context)
    system = render_prompt("system_prompt")
    user = f"{render_prompt('requirement_analysis')}\n\n{context}"

    try:
        result = llm_client.chat_structured(system, user)
        result.setdefault("modules", [])
        result.setdefault("roles", [])
        result.setdefault("core_flows", [])
        result.setdefault("unknowns", [])
        result.setdefault("risks", [])
        return result
    except Exception:
        return None


def generate_with_llm(
    project: dict,
    requirement: dict,
    target: str,
    analysis: dict | None = None,
    previous_output: dict | None = None,
    doc_context: dict | None = None,
) -> dict[str, Any] | None:
    """Generate structured output using LLM for the given target.

    Falls back to rule engine if LLM is unavailable or fails.
    """
    if not llm_client.available:
        return None

    prompt_name = TARGET_PROMPT.get(target)
    if not prompt_name:
        return None

    context = _build_context(project, requirement)
    if analysis:
        context += f"\n\n## 需求分析结果\n{analysis}"

    if doc_context and doc_context.get("has_documents"):
        context += f"\n\n## 上传文档参考"
        context += f"\n文档列表：{', '.join(doc_context['filenames'])}"
        context += f"\n\n{doc_context['combined_text']}"

    system = render_prompt("system_prompt")
    prompt_text = render_prompt(prompt_name)
    user = f"{prompt_text}\n\n{context}"

    if previous_output:
        user += f"\n\n## 当前已有输出（供参考）\n{previous_output}"

    try:
        result = llm_client.chat_structured(system, user)
        schema_cls = TARGET_SCHEMA.get(target)
        if schema_cls:
            validated = schema_cls(**result)
            return validated.model_dump()
        return result
    except Exception:
        return None
