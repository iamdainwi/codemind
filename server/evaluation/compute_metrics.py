"""
server/evaluation/compute_metrics.py
Reusable metric computation functions and CLI wrapper.
Imports pure metric implementations directly from features.eval.metrics.
"""
import sys
from pathlib import Path

# Ensure server package is in sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from features.eval.metrics import (
    precision_at_k,
    recall_at_k,
    mrr,
    rouge_l,
    chunk_size_stats,
    boundary_accuracy,
    compute_all_metrics,
)

__all__ = [
    "precision_at_k",
    "recall_at_k",
    "mrr",
    "rouge_l",
    "chunk_size_stats",
    "boundary_accuracy",
    "compute_all_metrics",
]

if __name__ == "__main__":
    print("Testing compute_metrics standalone:")
    test_retrieved = ["dataloader.py::DataLoader.__init__", "foo.py::bar"]
    test_relevant = {"dataloader.py::DataLoader.__init__"}
    print(f"P@1: {precision_at_k(test_retrieved, test_relevant, 1)}")
    print(f"P@5: {precision_at_k(test_retrieved, test_relevant, 5)}")
    print(f"MRR: {mrr(test_retrieved, test_relevant)}")
    print(f"ROUGE-L: {rouge_l('hello world', 'hello there world'):.4f}")
