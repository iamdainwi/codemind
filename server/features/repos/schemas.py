"""
features/repos/schemas.py
Pydantic request/response schemas for the repos API endpoints.
These are used only in api/v1/repos.py.
"""
from datetime import datetime
from typing import Literal
from pydantic import BaseModel


class RepoUploadResponse(BaseModel):
    repo_id: str
    name: str
    status: str
    message: str


class RepoSummary(BaseModel):
    repo_id: str
    name: str
    status: str
    file_count: int
    chunk_count_ast: int
    chunk_count_fixed: int
    created_at: datetime


class RepoDetail(RepoSummary):
    duration_ms_ast: int
    duration_ms_fixed: int
    skipped_files: int
    error_message: str | None
