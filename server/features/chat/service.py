"""
features/chat/service.py
RAG chain construction and SSE streaming logic.
Uses LangChain with MongoDB-backed memory and ChromaDB retrieval.
"""
import json
import logging
from typing import AsyncGenerator

from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.schema.runnable import RunnablePassthrough
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.output_parsers import StrOutputParser

from core.ollama import get_llm
from features.chat.memory import get_message_history, clear_history
from pipeline.retriever import retrieve, format_context

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are CodeMind, an expert code assistant with deep knowledge of the provided codebase.

Use the retrieved code context below to answer the user's question accurately and concisely.
- Reference specific function names, class names, and file paths when relevant.
- If the context doesn't contain enough information, say so clearly.
- Keep answers focused on the codebase, not general programming advice.

Retrieved Context:
{context}
"""

_PROMPT = ChatPromptTemplate.from_messages([
    ("system", _SYSTEM_PROMPT),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{question}"),
])


async def stream_rag_response(
    query: str,
    repo_id: str,
    user_id: str,
    k: int = 5,
) -> AsyncGenerator[str, None]:
    """
    Full RAG pipeline with SSE-compatible token streaming.

    Retrieves top-k chunks from the AST collection (the primary strategy),
    constructs the prompt with chat history, and streams the LLM response.

    Yields:
        JSON-encoded SSE data strings: 'data: {"token": "..."}\n\n'
        Terminates with:              'data: [DONE]\n\n'

    Args:
        query:   User's natural language question.
        repo_id: Repository ID for ChromaDB collection lookup.
        user_id: Used to scope chat history in MongoDB.
        k:       Number of chunks to retrieve (default 5).
    """
    # Retrieve from the AST collection (primary/production strategy)
    results = retrieve(query, repo_id, strategy="ast", k=k)
    context = format_context(results)

    llm = get_llm()
    chain = _PROMPT | llm | StrOutputParser()

    chain_with_history = RunnableWithMessageHistory(
        chain,
        lambda session_id: get_message_history(user_id, repo_id),
        input_messages_key="question",
        history_messages_key="history",
    )

    session_id = f"{user_id}_{repo_id}"

    try:
        async for token in chain_with_history.astream(
            {"question": query, "context": context},
            config={"configurable": {"session_id": session_id}},
        ):
            yield f"data: {json.dumps({'token': token})}\n\n"
    except Exception as exc:
        logger.error("Streaming error for repo=%s user=%s: %s", repo_id, user_id, exc)
        yield f"data: {json.dumps({'error': str(exc)})}\n\n"
    finally:
        yield "data: [DONE]\n\n"


def clear_chat_history(user_id: str, repo_id: str) -> None:
    """Clear chat history for a user+repo session."""
    clear_history(user_id, repo_id)


def get_chat_history(user_id: str, repo_id: str) -> list[dict]:
    """
    Return the chat history as a list of {role, content} dicts.
    """
    history = get_message_history(user_id, repo_id)
    messages = history.messages
    result = []
    for msg in messages:
        role = "human" if msg.type == "human" else "assistant"
        result.append({"role": role, "content": msg.content})
    return result
