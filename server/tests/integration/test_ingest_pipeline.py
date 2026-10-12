"""
tests/integration/test_ingest_pipeline.py
Integration test for the ingest pipeline with dual strategies.
"""
from pathlib import Path
import pytest
from pipeline.indexer import ingest_zip


@pytest.mark.asyncio
async def test_dual_ingest_pipeline(sample_zip: Path, monkeypatch):
    """
    Verifies that ingest_zip processes sample_python_repo.zip under both AST
    and Fixed chunking strategies, generating the appropriate chunk counts.
    """
    def mock_embed(chunks):
        return [[0.01 * (i % 10)] * 384 for i in range(len(chunks))]

    monkeypatch.setattr("pipeline.indexer.embed_chunks", mock_embed)

    # Ingest using AST strategy
    ast_result = await ingest_zip(sample_zip, "test_repo_001", strategy="ast")
    assert ast_result.repo_id == "test_repo_001"
    assert ast_result.strategy == "ast"
    assert ast_result.file_count == 4
    assert ast_result.chunk_count > 0

    # Ingest using Fixed strategy
    fixed_result = await ingest_zip(sample_zip, "test_repo_001", strategy="fixed")
    assert fixed_result.repo_id == "test_repo_001"
    assert fixed_result.strategy == "fixed"
    assert fixed_result.file_count == 4
    assert fixed_result.chunk_count > 0

    print(f"\n[RESEARCH] Dual Ingest Complete: AST={ast_result.chunk_count} chunks, Fixed={fixed_result.chunk_count} chunks")

