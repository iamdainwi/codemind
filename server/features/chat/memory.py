"""
features/chat/memory.py
LangChain MongoDB-backed chat message history.
Session ID: "{user_id}_{repo_id}" — one history per user+repo pair.
"""
from langchain_community.chat_message_histories import MongoDBChatMessageHistory
from core.config import settings


def get_message_history(user_id: str, repo_id: str) -> MongoDBChatMessageHistory:
    """
    Return a MongoDBChatMessageHistory for the given user+repo session.
    LangChain's RunnableWithMessageHistory will call this factory automatically.
    """
    session_id = f"{user_id}_{repo_id}"
    return MongoDBChatMessageHistory(
        connection_string=settings.MONGODB_URI,
        session_id=session_id,
        database_name=settings.MONGODB_DB,
        collection_name="chat_histories",
    )


def clear_history(user_id: str, repo_id: str) -> None:
    """Clear the chat history for a user+repo session."""
    history = get_message_history(user_id, repo_id)
    history.clear()
