"""
core/chroma.py
ChromaDB embedded client singleton.
All collections follow the naming convention: repo_{repo_id}_{strategy}
"""
import logging
import chromadb
from chromadb import Collection
from core.config import settings

logger = logging.getLogger(__name__)

_client: chromadb.PersistentClient | None = None


def get_chroma_client() -> chromadb.PersistentClient:
    """Return the shared ChromaDB persistent client."""
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
        logger.info("ChromaDB client created at: %s", settings.CHROMA_PERSIST_DIR)
    return _client


def get_collection(repo_id: str, strategy: str) -> Collection:
    """
    Get or create a ChromaDB collection for a repo+strategy pair.
    Naming convention: repo_{repo_id}_{strategy}
    """
    name = f"repo_{repo_id}_{strategy}"
    client = get_chroma_client()
    collection = client.get_or_create_collection(
        name=name,
        metadata={"repo_id": repo_id, "strategy": strategy},
    )
    return collection


def delete_collection(repo_id: str, strategy: str) -> None:
    """Delete the ChromaDB collection for a repo+strategy pair."""
    name = f"repo_{repo_id}_{strategy}"
    client = get_chroma_client()
    try:
        client.delete_collection(name=name)
        logger.info("Deleted ChromaDB collection: %s", name)
    except Exception as exc:
        logger.warning("Could not delete collection %s: %s", name, exc)


def collection_exists(repo_id: str, strategy: str) -> bool:
    """Check if a collection already exists for this repo+strategy."""
    name = f"repo_{repo_id}_{strategy}"
    client = get_chroma_client()
    existing = [c.name for c in client.list_collections()]
    return name in existing
