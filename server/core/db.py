"""
core/db.py
Async MongoDB client singleton via motor.
Usage: from core.db import get_db; db = await get_db()
"""
import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from core.config import settings

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None


def get_mongo_client() -> AsyncIOMotorClient:
    """Return the shared motor client, creating it on first call."""
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.MONGODB_URI)
        logger.info("MongoDB client created: %s", settings.MONGODB_URI)
    return _client


def get_db() -> AsyncIOMotorDatabase:
    """Return the application database handle."""
    return get_mongo_client()[settings.MONGODB_DB]


async def close_mongo_client() -> None:
    """Cleanly close the motor client on app shutdown."""
    global _client
    if _client is not None:
        _client.close()
        _client = None
        logger.info("MongoDB client closed.")
