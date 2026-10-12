"""
pipeline/chunkers/fixed_chunker.py

THE BASELINE — Fixed-window (naive) chunker.

Splits source code by character count with configurable size and overlap.
This is the standard approach used by most generic RAG systems.
It has NO awareness of code structure — it will freely split across
function boundaries, class definitions, and logical code blocks.

This is intentional: the cross-boundary splits are documented in tests
as the core weakness that AST chunking addresses.

Research Note: The boundary violations created by this chunker are
measured and quantified in tests/unit/test_fixed_chunker.py and
tests/integration/test_retrieval_comparison.py.
"""
import logging
from typing import List

from pipeline.chunkers.base import BaseChunker, Chunk

logger = logging.getLogger(__name__)

# Defaults validated against common RAG literature
DEFAULT_CHUNK_SIZE = 1000     # characters
DEFAULT_CHUNK_OVERLAP = 200   # characters


class FixedChunker(BaseChunker):
    """
    Fixed-window character-based chunker.

    Splits the source text into overlapping windows of a fixed character size.
    Has no awareness of Python syntax, indentation, or semantic boundaries.

    Args:
        chunk_size:    Number of characters per chunk. Default 1000.
        chunk_overlap: Number of characters to overlap between adjacent chunks. Default 200.
    """

    def __init__(
        self,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
    ) -> None:
        if chunk_overlap >= chunk_size:
            raise ValueError("chunk_overlap must be smaller than chunk_size.")
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk(self, source_code: str, file_path: str) -> List[Chunk]:
        """
        Split source_code into fixed-size character windows.
        Overlap creates redundancy between adjacent chunks.
        """
        if not source_code.strip():
            return []

        chunks: List[Chunk] = []
        step = self.chunk_size - self.chunk_overlap
        start = 0
        index = 0

        while start < len(source_code):
            end = min(start + self.chunk_size, len(source_code))
            window = source_code[start:end]

            start_line = source_code[:start].count("\n") + 1
            end_line = source_code[:end].count("\n") + 1

            chunk_id = f"{file_path}::chunk_{index}"
            chunks.append(
                Chunk(
                    content=window,
                    file_path=file_path,
                    chunk_id=chunk_id,
                    start_line=start_line,
                    end_line=end_line,
                    node_type="fixed",
                    metadata={
                        "file_path": file_path,
                        "node_type": "fixed",
                        "chunk_index": index,
                        "chunk_size": self.chunk_size,
                        "chunk_overlap": self.chunk_overlap,
                        "start_line": start_line,
                        "end_line": end_line,
                    },
                )
            )

            start += step
            index += 1

        logger.debug(
            "FixedChunker: %d chunks from %s (size=%d, overlap=%d)",
            len(chunks),
            file_path,
            self.chunk_size,
            self.chunk_overlap,
        )
        return chunks
