"""
tests/unit/test_fixed_chunker.py
Unit tests verifying the fixed-window chunking baseline.
"""
from pipeline.chunkers.fixed_chunker import FixedChunker


def test_fixed_chunker_chunk_size():
    code = "a" * 1500
    chunker = FixedChunker(chunk_size=500, chunk_overlap=100)
    chunks = chunker.chunk(code, "sample.py")
    assert len(chunks) > 1
    for c in chunks:
        assert c.node_type == "fixed"
        assert c.file_path == "sample.py"
        assert len(c.content) <= 500


def test_fixed_chunker_empty_input():
    chunks = FixedChunker().chunk("", "empty.py")
    assert len(chunks) == 0


def test_fixed_chunker_chunk_ids():
    code = "line 1\nline 2\nline 3\nline 4\nline 5\n"
    chunks = FixedChunker(chunk_size=15, chunk_overlap=0).chunk(code, "test.py")
    ids = [c.chunk_id for c in chunks]
    assert len(ids) == len(set(ids))
    assert all(cid.startswith("test.py::chunk_") for cid in ids)
