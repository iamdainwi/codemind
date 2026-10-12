"""
pipeline/chunkers/ast_chunker.py

THE RESEARCH CONTRIBUTION — AST-aware Python code chunker.

Uses tree-sitter to parse Python source into an Abstract Syntax Tree,
then extracts top-level functions, classes, and methods as individual chunks.

Key principle: semantic boundaries are never crossed.
A function definition is always one complete chunk.
A class body is one chunk; each method within it is also a separate chunk.

This is the strategy being validated against fixed-window chunking.
"""
import logging
from typing import List

import tree_sitter_python as tspython
from tree_sitter import Language, Parser, Node

from pipeline.chunkers.base import BaseChunker, Chunk

logger = logging.getLogger(__name__)

# Build the Python language once at module import
_PY_LANGUAGE = Language(tspython.language())
_PARSER: Parser | None = None


def _get_parser() -> Parser:
    global _PARSER
    if _PARSER is None:
        _PARSER = Parser(_PY_LANGUAGE)
    return _PARSER


class ASTChunker(BaseChunker):
    """
    AST-aware chunker for Python source code.

    Extraction strategy:
    1. Parse the file into an AST with tree-sitter.
    2. Walk the top-level nodes of the module.
    3. For each function_definition -> one chunk (node_type="function").
    4. For each class_definition -> one chunk for the class body (node_type="class"),
       plus one chunk per method_definition (node_type="method").
    5. Everything else (imports, module-level statements) -> one "module" chunk
       per contiguous block (node_type="module").
    6. Fallback: if parsing fails, the entire file is a single "module" chunk.
    """

    def chunk(self, source_code: str, file_path: str) -> List[Chunk]:
        """
        Parse source_code and return semantically meaningful chunks.
        Deterministic — same input always produces same output.
        """
        if not source_code.strip():
            return []

        chunks: List[Chunk] = []

        try:
            parser = _get_parser()
            tree = parser.parse(source_code.encode("utf-8"))
            root = tree.root_node

            if root.has_error:
                logger.warning(
                    "AST parse errors in %s — falling back to module chunk.", file_path
                )
                return self._fallback_chunk(source_code, file_path)

            lines = source_code.splitlines(keepends=True)
            chunk_index = 0

            for node in root.children:
                if node.type == "function_definition":
                    chunk = self._node_to_chunk(
                        node, source_code, file_path, "function", chunk_index
                    )
                    chunks.append(chunk)
                    chunk_index += 1

                elif node.type == "class_definition":
                    # Class-level chunk (includes the full class body)
                    class_chunk = self._node_to_chunk(
                        node, source_code, file_path, "class", chunk_index
                    )
                    chunks.append(class_chunk)
                    chunk_index += 1

                    # Additional per-method chunks for fine-grained retrieval
                    class_name = self._get_identifier(node)
                    for child in node.children:
                        if child.type == "block":
                            for method_node in child.children:
                                if method_node.type == "function_definition":
                                    method_chunk = self._node_to_chunk(
                                        method_node,
                                        source_code,
                                        file_path,
                                        "method",
                                        chunk_index,
                                        class_name=class_name,
                                    )
                                    chunks.append(method_chunk)
                                    chunk_index += 1

                else:
                    # Module-level statement (imports, assignments, etc.)
                    # Group consecutive non-function/class nodes into one chunk
                    if chunks and chunks[-1].node_type == "module":
                        # Extend the last module chunk
                        last = chunks[-1]
                        extra = self._node_text(node, source_code)
                        end_line = node.end_point[0] + 1
                        chunks[-1] = Chunk(
                            content=last.content + "\n" + extra,
                            file_path=file_path,
                            chunk_id=last.chunk_id,
                            start_line=last.start_line,
                            end_line=end_line,
                            node_type="module",
                            metadata=last.metadata,
                        )
                    else:
                        module_chunk = self._node_to_chunk(
                            node, source_code, file_path, "module", chunk_index
                        )
                        chunks.append(module_chunk)
                        chunk_index += 1

        except Exception as exc:
            logger.error(
                "AST chunking failed for %s: %s. Using fallback.", file_path, exc
            )
            return self._fallback_chunk(source_code, file_path)

        if not chunks:
            return self._fallback_chunk(source_code, file_path)

        return chunks

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _node_to_chunk(
        self,
        node: Node,
        source_code: str,
        file_path: str,
        node_type: str,
        index: int,
        class_name: str | None = None,
    ) -> Chunk:
        name = self._get_identifier(node)
        start_line = node.start_point[0] + 1
        end_line = node.end_point[0] + 1
        content = self._node_text(node, source_code)

        # Build chunk_id following the project convention
        if class_name and node_type == "method":
            chunk_id = f"{file_path}::{class_name}.{name}"
        elif name:
            chunk_id = f"{file_path}::{name}"
        else:
            chunk_id = f"{file_path}::{node_type}_{index}"

        metadata: dict = {
            "file_path": file_path,
            "node_type": node_type,
            "start_line": start_line,
            "end_line": end_line,
        }
        if name:
            metadata["name"] = name
        if class_name:
            metadata["class_name"] = class_name

        return Chunk(
            content=content,
            file_path=file_path,
            chunk_id=chunk_id,
            start_line=start_line,
            end_line=end_line,
            node_type=node_type,
            metadata=metadata,
        )

    @staticmethod
    def _get_identifier(node: Node) -> str:
        """Extract the name identifier from a function or class definition node."""
        for child in node.children:
            if child.type == "identifier":
                return child.text.decode("utf-8")
        return ""

    @staticmethod
    def _node_text(node: Node, source_code: str) -> str:
        """Extract the raw source text for a node."""
        start_byte = node.start_byte
        end_byte = node.end_byte
        return source_code.encode("utf-8")[start_byte:end_byte].decode("utf-8")

    def _fallback_chunk(self, source_code: str, file_path: str) -> List[Chunk]:
        """Return the entire file as a single module chunk."""
        line_count = source_code.count("\n") + 1
        return [
            Chunk(
                content=source_code,
                file_path=file_path,
                chunk_id=f"{file_path}::module_0",
                start_line=1,
                end_line=line_count,
                node_type="module",
                metadata={"file_path": file_path, "node_type": "module"},
            )
        ]
