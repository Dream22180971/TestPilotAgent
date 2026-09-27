"""Pydantic schemas for structured LLM output validation."""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class ModuleInfo(BaseModel):
    name: str
    description: str = ""


class RequirementAnalysisOutput(BaseModel):
    """Every list defaults to empty so a partial LLM answer never breaks the UI."""

    business_goal: str = ""
    system_type: str = ""
    roles: list[str] = Field(default_factory=list)
    modules: list[ModuleInfo] = Field(default_factory=list)
    core_flows: list[str] = Field(default_factory=list)
    business_rules: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    unknowns: list[str] = Field(default_factory=list)
    test_focus: list[str] = Field(default_factory=list)

    @field_validator("modules", mode="before")
    @classmethod
    def _coerce_modules(cls, value):
        # Models sometimes answer ["登录", "支付"] instead of [{"name": ...}]
        if isinstance(value, list):
            return [{"name": v} if isinstance(v, str) else v for v in value]
        return value


class TestPoint(BaseModel):
    id: str = ""
    module: str
    scenario: str
    point: str
    type: str = "正常"
    priority: str = "中"


class TestPointsOutput(BaseModel):
    rows: list[TestPoint]


class TestCase(BaseModel):
    id: str = ""
    module: str
    scenario: str
    title: str
    preconditions: list[str] = Field(default_factory=list)
    steps: list[str]
    expected_results: list[str]
    priority: str = "中"


class TestCasesOutput(BaseModel):
    cases: list[TestCase]


class TestStrategyOutput(BaseModel):
    overview: str = ""
    scope: list[str] = Field(default_factory=list)
    out_of_scope: list[str] = Field(default_factory=list)
    test_levels: list[str] = Field(default_factory=list)
    test_types: list[str] = Field(default_factory=list)
    tools_and_env: str = ""
    risks_and_mitigation: list[dict[str, str]] = Field(default_factory=list)
    entry_criteria: list[str] = Field(default_factory=list)
    exit_criteria: list[str] = Field(default_factory=list)


class TestPhase(BaseModel):
    name: str
    tasks: list[str] = Field(default_factory=list)
    estimated_days: str = ""
    deliverables: list[str] = Field(default_factory=list)


class TestPlanOutput(BaseModel):
    overview: str = ""
    phases: list[TestPhase] = Field(default_factory=list)
    resource_estimate: str = ""
    schedule_summary: str = ""
    dependencies: list[str] = Field(default_factory=list)


class TestDesignOutput(BaseModel):
    """Test-design mind map as an indented Markdown outline."""

    markdown: str = ""


# Map of target -> Pydantic model class for validation
SCHEMA_MAP = {
    "analysis": RequirementAnalysisOutput,
    "test_strategy": TestStrategyOutput,
    "test_plan": TestPlanOutput,
    "test_points": TestPointsOutput,
    "test_cases": TestCasesOutput,
    "test_design": TestDesignOutput,
}
