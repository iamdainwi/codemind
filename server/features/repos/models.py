"""
features/repos/models.py
MongoDB document shape for an indexed repository.
"""
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


class RepoDocument(BaseModel):
    """Represents a repository document as stored in MongoDB."""
    id: str | None = None
    user_id: str
    name: str                                  # original zip filename
    strategy: Literal["ast", "fixed", "both"]  # "both" after full ingest
    status: Literal["pending", "indexing", "ready", "error"]
    file_count: int = 0
    chunk_count_ast: int = 0
    chunk_count_fixed: int = 0
    duration_ms_ast: int = 0
    duration_ms_fixed: int = 0
    skipped_files: int = 0
    error_message: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
