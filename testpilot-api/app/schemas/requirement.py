from pydantic import BaseModel, Field


class RequirementCreate(BaseModel):
    raw_input: str = Field(default="")
    extra_context: dict = Field(default_factory=dict)
