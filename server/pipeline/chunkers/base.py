"""
pipeline/chunkers/base.py
Abstract base class and the Chunk dataclass — the contract every chunker must satisfy.
This module has NO imports from fastapi, features/, or api/.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List


@dataclass
class Chunk:
    """
    A single semantic unit extracted from source code.

    Attributes:
        content:    The raw source text of this chunk.
        file_path:  Relative path from the zip root (e.g. "src/loader.py").
        chunk_id:   Globally unique ID within the repo.
                    AST format:   "{file_path}::{node_name}"
                                  e.g. "loader.py::DataLoader.__init__"
                    Fixed format: "{file_path}::chunk_{index}"
                                  e.g. "loader.py::chunk_0"
        start_line: 1-indexed line where this chunk starts.
        end_line:   1-indexed line where this chunk ends (inclusive).
        node_type:  "function" | "class" | "method" | "module" | "fixed"
        metadata:   Extra k/v pairs stored in ChromaDB metadata.
                    Typical keys: "name" (node name), "class_name" (for methods).
    """

    content: str
    file_path: str
    chunk_id: str
    start_line: int
    end_line: int
    node_type: str
    metadata: dict = field(default_factory=dict)

    @property
    def token_count(self) -> int:
        """Rough token estimate: 1 token ~ 4 characters."""
        return len(self.content) // 4


class BaseChunker(ABC):
    """Abstract base class for all chunking strategies."""

    @abstractmethod
    def chunk(self, source_code: str, file_path: str) -> List[Chunk]:
        """
        Split source_code into a list of Chunks.

        Must be:
        - Deterministic: same input always produces same output.
        - Complete: every byte of source_code is covered by at least one chunk.
        - Non-overlapping (for AST): each semantic unit is its own chunk.

        Args:
            source_code: Full text content of a Python source file.
            file_path:   Relative path from the zip root.

        Returns:
            Ordered list of Chunk objects.
        """
        ...
