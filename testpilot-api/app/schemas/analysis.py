from pydantic import BaseModel


class AnalyzeRequest(BaseModel):
    requirement_id: str
