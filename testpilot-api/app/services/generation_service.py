from __future__ import annotations

from app.services.memory_store import extract_roles, infer_modules


def build_analysis(project: dict, requirement: dict, doc_context: dict | None = None) -> dict:
    raw_input = requirement["raw_input"]
    extra_context = requirement.get("extra_context") or {}
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

    business_rules: list[str] = []
    if doc_context and doc_context.get("has_documents"):
        filenames = "、".join(doc_context.get("filenames", []))
        business_rules.append(f"分析已结合上传文档：{filenames}。")

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
        "business_rules": business_rules,
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


def generate_test_strategy(project: dict, analysis: dict) -> dict:
    modules = [module["name"] for module in analysis.get("modules", [])]
    risks = analysis.get("risks", [])[:3]
    return {
        "overview": f"围绕 {', '.join(modules)} 等模块开展功能验证，优先保障主流程可用，再覆盖异常与边界。",
        "scope": modules or ["核心流程"],
        "out_of_scope": ["性能压测", "安全渗透测试"],
        "test_levels": ["冒烟测试", "功能测试", "回归测试"],
        "test_types": project.get("test_types", ["功能测试"]),
        "tools_and_env": "测试环境 1 套；用例由 TestPilot 生成，执行以手工 + 接口工具为主。",
        "risks_and_mitigation": [{"risk": risk, "mitigation": "评审时补充场景与测试数据"} for risk in risks],
        "entry_criteria": ["需求评审通过", "测试环境可用", "测试数据准备完成"],
        "exit_criteria": ["P0/P1 用例执行率 100%", "缺陷全部关闭或经评审延期"],
    }


def generate_test_plan(analysis: dict) -> dict:
    modules = [module["name"] for module in analysis.get("modules", [])]
    scope = "、".join(modules) or "核心流程"
    return {
        "overview": f"针对 {scope} 的测试实施计划，分阶段推进设计与执行。",
        "phases": [
            {
                "name": "测试设计",
                "tasks": ["拆解测试点", "编写并评审测试用例"],
                "estimated_days": "2",
                "deliverables": ["测试用例文档", "测试数据清单"],
            },
            {
                "name": "测试执行",
                "tasks": ["冒烟执行", "全量执行", "缺陷提交与跟踪"],
                "estimated_days": "3",
                "deliverables": ["执行记录", "缺陷清单"],
            },
            {
                "name": "回归与收尾",
                "tasks": ["缺陷回归", "输出测试报告"],
                "estimated_days": "1",
                "deliverables": ["测试报告"],
            },
        ],
        "resource_estimate": "测试工程师 1 人，约 6 人日。",
        "schedule_summary": "设计 2 天 → 执行 3 天 → 回归收尾 1 天。",
        "dependencies": ["需求文档冻结", "测试环境就绪"],
    }


def generate_test_script(project: dict, analysis: dict) -> dict:
    modules = [module["name"] for module in analysis.get("modules", [])]
    module = modules[0] if modules else "core"
    func_name = "test_" + module
    code = (
        f'"""Generated by TestPilot — {module} module smoke tests."""\n'
        "\n"
        "\n"
        f"def {func_name}_happy_path():\n"
        f'    """{module} 主流程冒烟。"""\n'
        "    # TODO: 接入真实接口/页面驱动\n"
        "    assert True\n"
        "\n"
        "\n"
        f"def {func_name}_abnormal():\n"
        f'    """{module} 异常场景。"""\n'
        "    # TODO: 补充异常数据构造\n"
        "    assert True\n"
    )
    return {
        "language": project.get("script_language", "Python"),
        "framework": "pytest",
        "files": [{"filename": f"test_{module}.py", "language": "Python", "code": code}],
        "setup_instructions": "pip install pytest && pytest -v",
    }
