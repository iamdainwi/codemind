"""
features/eval/models.py
MongoDB document shapes for evaluation runs and results.
"""
from datetime import datetime
from pydantic import BaseModel, Field


class EvalRunDocument(BaseModel):
    """Represents one complete evaluation run (both strategies) for a repo."""
    id: str | None = None
    repo_id: str
    user_id: str
    dataset_id: str
    status: str = "pending"  # "pending" | "running" | "complete" | "error"
    error_message: str | None = None
    ast_metrics: dict | None = None
    fixed_metrics: dict | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: datetime | None = None
