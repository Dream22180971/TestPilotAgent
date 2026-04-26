from __future__ import annotations

from app.services.memory_store import extract_roles, infer_modules


def build_analysis(project: dict, requirement: dict) -> dict:
    raw_input = requirement["raw_input"]
    extra_context = requirement["extra_context"]
    source_text = " ".join(
        [
            raw_input,
            str(extra_context.get("business_flow", "")),
            " ".join(str(item) for item in extra_context.get("roles", [])),
        ]
    )
    modules = infer_modules(source_text)
    roles = extract_roles(extra_context, source_text)

    business_goal = raw_input.strip() or "根据补充上下文完成需求分析"
    core_flow = extra_context.get("business_flow") or "待补充核心业务流程"
    constraints: list[str] = []
    non_functional = extra_context.get("non_functional")
    if isinstance(non_functional, list):
        constraints.extend([str(item) for item in non_functional])

    risks = ["当前为规则驱动的基础分析，后续可接入大模型提升覆盖深度。"]
    if not raw_input.strip():
        risks.append("未提供明确需求正文，测试分析结果将依赖补充上下文。")

    unknowns = []
    if not extra_context.get("business_flow"):
        unknowns.append("未提供完整业务流程。")
    if not extra_context.get("roles"):
        unknowns.append("未明确用户角色和权限边界。")

    test_focus = [f"优先覆盖{module['name']}相关主流程与异常路径" for module in modules]

    return {
        "business_goal": business_goal,
        "system_type": project["system_type"],
        "roles": roles,
        "modules": modules,
        "core_flows": [core_flow],
        "business_rules": [],
        "constraints": constraints,
        "risks": risks,
        "unknowns": unknowns,
        "test_focus": test_focus,
    }


def generate_test_points(analysis: dict) -> dict:
    modules = analysis["modules"] or [{"name": "核心流程", "description": "围绕核心流程的需求场景"}]
    rows: list[dict] = []
    for module in modules:
        name = module["name"]
        rows.append(
            {
                "id": f"{name}-normal",
                "module": name,
                "scenario": f"{name}主流程",
                "point": f"验证{name}主流程可以正常完成，并且结果状态正确落库或展示。",
                "type": "正常",
                "priority": "高",
            }
        )
        rows.append(
            {
                "id": f"{name}-abnormal",
                "module": name,
                "scenario": f"{name}异常处理",
                "point": f"验证{name}异常输入或失败返回时，系统能给出明确提示并保持状态一致。",
                "type": "异常",
                "priority": "高",
            }
        )
        rows.append(
            {
                "id": f"{name}-boundary",
                "module": name,
                "scenario": f"{name}边界场景",
                "point": f"验证{name}边界条件、重复提交或空值输入时的拦截与保护逻辑。",
                "type": "边界",
                "priority": "中",
            }
        )
    return {"rows": rows}


def generate_test_cases(test_points_output: dict) -> dict:
    rows = test_points_output.get("rows", [])
    cases: list[dict] = []
    for index, point in enumerate(rows, start=1):
        cases.append(
            {
                "id": f"CASE-{index:03d}",
                "module": point["module"],
                "scenario": point["scenario"],
                "title": point["point"],
                "preconditions": ["系统已启动", "测试数据已准备"],
                "steps": [
                    f"进入{point['module']}相关操作页面或接口。",
                    f"执行场景：{point['scenario']}。",
                    "观察系统响应、页面提示和状态变化。",
                ],
                "expected_results": [
                    point["point"],
                    "系统返回结果与业务预期一致。",
                ],
                "priority": point["priority"],
            }
        )
    return {"cases": cases}
