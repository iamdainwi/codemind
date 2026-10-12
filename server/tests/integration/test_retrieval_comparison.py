"""
tests/integration/test_retrieval_comparison.py
KEY RESEARCH EVIDENCE TEST:
Generates empirical evidence comparing AST-based chunking vs. fixed-window chunking
on function-level codebase question-answering retrieval queries.
Results are tagged with [RESEARCH] for easy grep/extraction into paper tables.
"""
from pathlib import Path
import pytest
from core.config import settings
from features.eval.metrics import precision_at_k, recall_at_k, mrr
from pipeline.indexer import ingest_zip
from pipeline.retriever import retrieve
from tests.conftest import OLLAMA_AVAILABLE


@pytest.mark.asyncio
@pytest.mark.skipif(not OLLAMA_AVAILABLE, reason="Ollama embedding service not running locally")
async def test_ast_precision_higher_than_fixed(sample_zip: Path):
    """
    RESEARCH HYPOTHESIS: AST P@5 >= Fixed P@5 for semantic code queries.
    Validates that AST-aware chunking maintains semantic boundaries,
    producing cleaner similarity matching for function/class queries.
    """
    repo_id = "research_test_001"

    # Index both strategies
    await ingest_zip(sample_zip, repo_id, strategy="ast")
    await ingest_zip(sample_zip, repo_id, strategy="fixed")

    test_cases = [
        {
            "query": "How is DataLoader initialized and what are its parameters?",
            "relevant_ids": {"dataloader.py::DataLoader.__init__"},
        },
        {
            "query": "How does TransformerBlock calculate forward attention?",
            "relevant_ids": {"models.py::TransformerBlock.forward"},
        },
        {
            "query": "Where is the cross entropy loss calculated?",
            "relevant_ids": {"utils.py::calculate_loss"},
        },
    ]

    ast_p_scores = []
    fixed_p_scores = []

    for case in test_cases:
        query = case["query"]
        relevant = case["relevant_ids"]

        ast_results = retrieve(query, repo_id, strategy="ast", k=5)
        fixed_results = retrieve(query, repo_id, strategy="fixed", k=5)

        ast_retrieved_ids = [r.chunk_id for r in ast_results]
        fixed_retrieved_ids = [r.chunk_id for r in fixed_results]

        ast_p = precision_at_k(ast_retrieved_ids, relevant, k=5)
        fixed_p = precision_at_k(fixed_retrieved_ids, relevant, k=5)
        ast_mrr = mrr(ast_retrieved_ids, relevant)
        fixed_mrr = mrr(fixed_retrieved_ids, relevant)

        ast_p_scores.append(ast_p)
        fixed_p_scores.append(fixed_p)

        # Print for research paper evidence capture (visible with pytest -s)
        print(f"\n[RESEARCH] Query: '{query}'")
        print(f"  AST   Precision@5: {ast_p:.4f} | MRR: {ast_mrr:.4f}")
        print(f"  Fixed Precision@5: {fixed_p:.4f} | MRR: {fixed_mrr:.4f}")
        print(f"  Delta: {ast_p - fixed_p:+.4f}")

    avg_ast_p = sum(ast_p_scores) / len(ast_p_scores)
    avg_fixed_p = sum(fixed_p_scores) / len(fixed_p_scores)

    print(f"\n[RESEARCH] OVERALL AVERAGE:")
    print(f"  AST   Mean Precision@5: {avg_ast_p:.4f}")
    print(f"  Fixed Mean Precision@5: {avg_fixed_p:.4f}")
    print(f"  Hypothesis Confirmed: {avg_ast_p >= avg_fixed_p}")

    assert avg_ast_p >= avg_fixed_p
