"""Export service: generate downloadable files in Excel, JSON, or Markdown format."""

from __future__ import annotations

import io
import json
from typing import Any

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from sqlalchemy.orm import Session

from app.services.db_store import DatabaseStore

store = DatabaseStore()

WRAP = Alignment(wrap_text=True, vertical="top")
LONG_FIELDS = {"point", "title", "preconditions", "steps", "expected_results"}

STORE_TARGETS = ["analysis", "test_strategy", "test_plan", "test_points", "test_cases", "test_design"]
TARGET_LABELS = {
    "analysis": "需求分析",
    "test_strategy": "测试策略",
    "test_plan": "测试计划",
    "test_points": "测试点",
    "test_cases": "测试用例",
    "test_design": "测试设计",
}

# Excel column headers: schema field -> Chinese label
FIELD_LABELS = {
    "id": "编号", "module": "模块", "scenario": "场景", "point": "测试点", "type": "类型",
    "priority": "优先级", "title": "用例标题", "preconditions": "前置条件", "steps": "测试步骤",
    "expected_results": "预期结果",
    "business_goal": "业务目标", "system_type": "系统类型", "roles": "用户角色", "modules": "功能模块",
    "core_flows": "核心流程", "business_rules": "业务规则", "constraints": "约束条件", "risks": "风险",
    "unknowns": "待确认项", "test_focus": "测试重点",
    "overview": "概述", "scope": "测试范围", "out_of_scope": "不在范围内", "test_levels": "测试级别",
    "test_types": "测试类型", "tools_and_env": "工具与环境", "risks_and_mitigation": "风险与缓解",
    "entry_criteria": "准入标准", "exit_criteria": "准出标准",
    "phases": "阶段安排", "resource_estimate": "资源估算", "schedule_summary": "进度概要",
    "dependencies": "依赖", "markdown": "思维导图大纲",
}


def export_outputs(db: Session, project_id: str, export_format: str, targets: list[str]) -> Any:
    """Export specified outputs for a project in the given format.

    Returns a dict with either file content (as bytes in a dict for JSON response)
    or triggers a StreamingResponse from the route layer.
    """
    outputs: dict[str, Any] = {}
    for t in targets:
        if t in STORE_TARGETS:
            out = store.get_output(db, project_id, t)
            if out:
                outputs[t] = out["content"]

    if export_format == "json":
        return _export_json(project_id, outputs)
    elif export_format == "markdown" or export_format == "md":
        return _export_markdown(project_id, outputs)
    elif export_format == "xlsx" or export_format == "excel":
        return _export_excel(project_id, outputs)
    else:
        return {"project_id": project_id, "format": export_format, "targets": targets, "status": "unsupported_format"}


def _export_json(project_id: str, outputs: dict[str, Any]) -> dict:
    return {
        "project_id": project_id,
        "format": "json",
        "status": "ready",
        "data": outputs,
    }


def _export_markdown(project_id: str, outputs: dict[str, Any]) -> dict:
    lines = [f"# TestPilot 测试输出 - {project_id}\n"]

    for target_key, content in outputs.items():
        label = TARGET_LABELS.get(target_key, target_key)
        lines.append(f"## {label}\n")
        lines.append(_dict_to_md(content))
        lines.append("")

    return {
        "project_id": project_id,
        "format": "markdown",
        "status": "ready",
        "data": "\n".join(lines),
    }


def _export_excel(project_id: str, outputs: dict[str, Any]) -> dict:
    wb = Workbook()
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="0F766E", end_color="0F766E", fill_type="solid")

    for target_key, content in outputs.items():
        label = TARGET_LABELS.get(target_key, target_key)
        ws = wb.create_sheet(title=label[:31])  # Excel sheet name max 31 chars

        if target_key == "test_points":
            rows = content.get("rows", [])
            if rows:
                headers = list(rows[0].keys())
                _write_excel_rows(ws, headers, rows, header_font, header_fill)
        elif target_key == "test_cases":
            cases = content.get("cases", [])
            if cases:
                headers = list(cases[0].keys())
                _write_excel_rows(ws, headers, cases, header_font, header_fill)
        else:
            _write_dict_sheet(ws, content, header_font, header_fill)

    # Remove default sheet
    if "Sheet" in wb.sheetnames:
        del wb["Sheet"]

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    return {
        "project_id": project_id,
        "format": "xlsx",
        "status": "ready",
        "data": buf.getvalue().hex(),
        "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }


def _write_excel_rows(ws, headers, rows, header_font, header_fill):
    for col_idx, header in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col_idx, value=FIELD_LABELS.get(header, header))
        cell.font = header_font
        cell.fill = header_fill
        ws.column_dimensions[cell.column_letter].width = 40 if header in LONG_FIELDS else 14

    for row_idx, row in enumerate(rows, start=2):
        for col_idx, header in enumerate(headers, start=1):
            val = row.get(header, "")
            if isinstance(val, list):
                val = "\n".join(f"{i}. {v}" for i, v in enumerate(val, start=1))
            ws.cell(row=row_idx, column=col_idx, value=val).alignment = WRAP
    ws.freeze_panes = "A2"


def _write_dict_sheet(ws, content, header_font, header_fill):
    """Two-column key/value sheet: one field per row reads better than one wide row."""
    for col_idx, title in enumerate(["字段", "内容"], start=1):
        cell = ws.cell(row=1, column=col_idx, value=title)
        cell.font = header_font
        cell.fill = header_fill
    ws.column_dimensions["A"].width = 16
    ws.column_dimensions["B"].width = 90

    for row_idx, (key, val) in enumerate(content.items(), start=2):
        if isinstance(val, list):
            val = "\n".join(
                json.dumps(v, ensure_ascii=False) if isinstance(v, dict) else str(v) for v in val
            )
        elif isinstance(val, dict):
            val = json.dumps(val, ensure_ascii=False)
        ws.cell(row=row_idx, column=1, value=FIELD_LABELS.get(key, key)).font = Font(bold=True)
        ws.cell(row=row_idx, column=2, value=str(val)).alignment = WRAP


def _dict_to_md(data: Any, indent: int = 0) -> str:
    prefix = "  " * indent
    if isinstance(data, dict):
        lines = []
        for key, val in data.items():
            if isinstance(val, (dict, list)):
                lines.append(f"{prefix}- **{key}**:")
                lines.append(_dict_to_md(val, indent + 1))
            else:
                lines.append(f"{prefix}- **{key}**: {val}")
        return "\n".join(lines)
    elif isinstance(data, list):
        lines = []
        for item in data:
            if isinstance(item, (dict, list)):
                lines.append(_dict_to_md(item, indent))
            else:
                lines.append(f"{prefix}- {item}")
        return "\n".join(lines)
    else:
        return f"{prefix}{data}"
