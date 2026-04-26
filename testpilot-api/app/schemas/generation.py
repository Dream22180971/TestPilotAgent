from pydantic import BaseModel


class GenerateRequest(BaseModel):
    target: str
    requirement_id: str
    regenerate: bool = False


class FollowupRequest(BaseModel):
    target: str
    instruction: str
    requirement_id: str = ""


class ExportRequest(BaseModel):
    format: str
    targets: list[str]
