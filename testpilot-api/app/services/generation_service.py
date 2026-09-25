"""Thin bridge to testpilot.core.rule_engine (single source of truth)."""
from testpilot.core.rule_engine import (  # noqa: F401
    build_analysis,
    extract_roles,
    generate_test_cases,
    generate_test_plan,
    generate_test_points,
    generate_test_script,
    generate_test_strategy,
    infer_modules,
)
