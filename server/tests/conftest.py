"""
server/tests/conftest.py
Shared pytest fixtures and test configurations for CodeMind.
"""
import os
import sys
from pathlib import Path
import pytest

# Ensure server package is on sys.path
SERVER_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVER_ROOT))

OLLAMA_AVAILABLE = os.getenv("OLLAMA_AVAILABLE", "false").lower() in ("true", "1", "yes")


@pytest.fixture
def sample_zip() -> Path:
    """Path to the curated sample repository ZIP fixture."""
    zip_path = SERVER_ROOT / "tests" / "fixtures" / "sample_python_repo.zip"
    if not zip_path.exists():
        pytest.fail(f"sample_python_repo.zip not found at {zip_path}")
    return zip_path


@pytest.fixture
def mock_embeddings():
    """Mock embeddings object returning deterministic vector embeddings."""
    class MockEmbeddings:
        def embed_documents(self, texts: list[str]) -> list[list[float]]:
            return [[float(len(t) % 10) / 10.0] * 384 for t in texts]

        def embed_query(self, text: str) -> list[float]:
            return [float(len(text) % 10) / 10.0] * 384

    return MockEmbeddings()
