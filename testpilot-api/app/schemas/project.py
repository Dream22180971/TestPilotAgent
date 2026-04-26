from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    system_type: str
    test_types: list[str]
    script_language: str
    output_language: str = "中文"


class ProjectResponse(ProjectCreate):
    id: str
    created_at: str
    updated_at: str
    last_generated_module: str | None = None
