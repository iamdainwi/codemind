"""
tests/unit/test_metrics.py
Unit tests verifying pure metric computation functions in features/eval/metrics.py.
"""
import pytest
from features.eval.metrics import (
    precision_at_k,
    recall_at_k,
    mrr,
    rouge_l,
    boundary_accuracy,
    chunk_size_stats,
    compute_all_metrics,
)


def test_precision_at_k():
    retrieved = ["a", "b", "c"]
    relevant = {"a", "c", "d"}
    assert precision_at_k(retrieved, relevant, k=3) == pytest.approx(2 / 3)
    assert precision_at_k([], relevant, k=3) == 0.0
    assert precision_at_k(retrieved, set(), k=3) == 0.0


def test_recall_at_k():
    retrieved = ["a", "b", "c"]
    relevant = {"a", "c", "d"}
    assert recall_at_k(retrieved, relevant, k=3) == pytest.approx(2 / 3)
    assert recall_at_k(retrieved, set(), k=3) == 0.0


def test_mrr_first_hit():
    retrieved = ["x", "a", "b"]
    relevant = {"a"}
    assert mrr(retrieved, relevant) == pytest.approx(0.5)  # 1/rank_2


def test_mrr_top_hit():
    retrieved = ["target", "other"]
    relevant = {"target"}
    assert mrr(retrieved, relevant) == pytest.approx(1.0)


def test_mrr_no_hit():
    retrieved = ["x", "y", "z"]
    relevant = {"a"}
    assert mrr(retrieved, relevant) == 0.0


def test_rouge_l_perfect():
    assert rouge_l("hello world", "hello world") == pytest.approx(1.0)


def test_rouge_l_zero_overlap():
    assert rouge_l("cats sleep", "dogs run") == pytest.approx(0.0)


def test_boundary_accuracy():
    ast_types = ["function", "class", "method", "function"]
    assert boundary_accuracy(ast_types) == pytest.approx(1.0)

    fixed_types = ["fixed", "fixed", "fixed", "fixed"]
    assert boundary_accuracy(fixed_types) == pytest.approx(0.0)

    mixed_types = ["function", "fixed", "method", "fixed"]
    assert boundary_accuracy(mixed_types) == pytest.approx(0.5)


def test_chunk_size_stats():
    sizes = [100, 200, 300]
    stats = chunk_size_stats(sizes)
    assert stats["mean"] == 200.0
    assert stats["min"] == 100
    assert stats["max"] == 300
    assert stats["count"] == 3


def test_compute_all_metrics():
    res = compute_all_metrics(
        retrieved_ids=["a", "b"],
        relevant_ids={"a"},
        generated_answer="test output answer",
        reference_answer="test output answer",
        chunk_token_counts=[50, 60],
        chunk_node_types=["function", "method"],
        k=2,
    )
    assert res["precision_at_k"] == pytest.approx(0.5)
    assert res["recall_at_k"] == pytest.approx(1.0)
    assert res["mrr"] == pytest.approx(1.0)
    assert res["rouge_l"] == pytest.approx(1.0)
    assert res["boundary_accuracy"] == pytest.approx(1.0)
