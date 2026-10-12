"""
tests/unit/test_ast_chunker.py
Unit tests verifying AST-aware code chunking via tree-sitter.
Provides critical evidence that AST chunking preserves semantic units.
"""
import pytest
from pipeline.chunkers.ast_chunker import ASTChunker
from pipeline.chunkers.fixed_chunker import FixedChunker


def test_function_becomes_one_chunk():
    code = "def add(a, b):\n    return a + b\n"
    chunks = ASTChunker().chunk(code, "math.py")
    assert len(chunks) == 1
    assert chunks[0].node_type == "function"
    assert chunks[0].qualified_name == "add"
    assert chunks[0].chunk_id == "math.py::add"


def test_class_and_methods_are_separate_chunks():
    code = "class Foo:\n    def bar(self): pass\n    def baz(self): pass\n"
    chunks = ASTChunker().chunk(code, "foo.py")
    types = [c.node_type for c in chunks]
    assert "class" in types
    assert types.count("method") == 2

    method_names = [c.qualified_name for c in chunks if c.node_type == "method"]
    assert "Foo.bar" in method_names
    assert "Foo.baz" in method_names


def test_fixed_chunker_crosses_function_boundaries():
    """
    Research Evidence: Proves fixed chunker violates semantic boundaries
    by slicing through independent functions without structural awareness.
    """
    code = "def alpha():\n    return 1\ndef beta():\n    return 2\n"
    chunks = FixedChunker(chunk_size=60, chunk_overlap=0).chunk(code, "f.py")
    multi_fn = [c for c in chunks if "alpha" in c.content and "beta" in c.content]
    assert len(multi_fn) > 0  # Fixed chunker DOES cross boundaries — this is the problem


def test_ast_chunk_ids_are_unique():
    code = "def foo(): pass\ndef bar(): pass\n"
    chunks = ASTChunker().chunk(code, "test.py")
    ids = [c.chunk_id for c in chunks]
    assert len(ids) == len(set(ids))
    assert len(ids) == 2


def test_empty_python_file():
    code = "   \n\n  "
    chunks = ASTChunker().chunk(code, "empty.py")
    assert len(chunks) == 0


def test_syntax_error_fallback():
    """Fallback creates a module-level chunk on severely malformed code."""
    malformed_code = "def unclosed_function("
    chunks = ASTChunker().chunk(malformed_code, "broken.py")
    assert len(chunks) >= 1
