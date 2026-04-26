"""Pydantic schemas for structured LLM output validation."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ModuleInfo(BaseModel):
    name: str
    description: str = ""


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


class ScriptFile(BaseModel):
    filename: str
    language: str
    code: str


class TestScriptsOutput(BaseModel):
    language: str = "Python"
    framework: str = ""
    files: list[ScriptFile] = Field(default_factory=list)
    setup_instructions: str = ""


# Map of target -> Pydantic model class for validation
SCHEMA_MAP = {
    "test_strategy": TestStrategyOutput,
    "test_plan": TestPlanOutput,
    "test_points": TestPointsOutput,
    "test_cases": TestCasesOutput,
    "test_script": TestScriptsOutput,
}
