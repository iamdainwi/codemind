"""
tests/integration/test_chat_stream.py
Integration tests for RAG streaming generation pipeline.
"""
import pytest
from features.chat.service import stream_rag_response
from tests.conftest import OLLAMA_AVAILABLE


@pytest.mark.asyncio
@pytest.mark.skipif(not OLLAMA_AVAILABLE, reason="Ollama LLM service not running locally")
async def test_chat_stream_tokens():
    """
    Verifies that stream_rag_response yields valid SSE formatted chunks
    ending with data: [DONE].
    """
    repo_id = "test_repo_001"
    user_id = "test_user_001"
    query = "Explain what DataLoader does."

    tokens = []
    async for sse_chunk in stream_rag_response(query, repo_id, user_id):
        assert sse_chunk.startswith("data: ")
        assert sse_chunk.endswith("\n\n")
        tokens.append(sse_chunk)

    assert len(tokens) > 0
    assert tokens[-1] == "data: [DONE]\n\n"
    print(f"\n[RESEARCH] Chat stream completed with {len(tokens)} SSE tokens received.")
