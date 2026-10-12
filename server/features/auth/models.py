"""
features/auth/models.py
MongoDB document shape for a user.
"""
from datetime import datetime
from pydantic import BaseModel, Field
from bson import ObjectId


class UserDocument(BaseModel):
    """Represents a user document as stored in MongoDB."""
    id: str | None = None              # MongoDB _id as string
    username: str
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
