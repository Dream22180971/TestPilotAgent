from __future__ import annotations

from collections.abc import Iterable


def infer_modules(text: str) -> list[dict[str, str]]:
    candidates = {
        "login": "登录",
        "sign in": "登录",
        "register": "注册",
        "order": "下单",
        "payment": "支付",
        "pay": "支付",
        "search": "查询",
        "report": "报表",
        "登录": "登录",
        "注册": "注册",
        "下单": "下单",
        "支付": "支付",
        "查询": "查询",
        "报表": "报表",
    }
    found: list[str] = []
    lower_text = text.lower()
    for keyword, label in candidates.items():
        if keyword in lower_text and label not in found:
            found.append(label)
    if not found:
        found = ["核心流程"]
    return [{"name": label, "description": f"围绕{label}的需求场景"} for label in found]


def extract_roles(extra_context: dict, raw_input: str) -> list[str]:
    roles = extra_context.get("roles")
    if isinstance(roles, Iterable) and not isinstance(roles, (str, bytes, dict)):
        values = [str(item) for item in roles if str(item).strip()]
        if values:
            return values
    text = f"{raw_input} {extra_context}".lower()
    guessed: list[str] = []
    if "admin" in text or "管理员" in text:
        guessed.append("管理员")
    if any(token in text for token in ["user", "用户", "客户"]):
        guessed.append("普通用户")
    return guessed or ["待补充"]
