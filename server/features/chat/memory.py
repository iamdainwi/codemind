"""
features/chat/memory.py
LangChain MongoDB-backed chat message history.
Session ID: "{user_id}_{repo_id}" — one history per user+repo pair.
Implements BaseChatMessageHistory using pymongo.
"""
from typing import List
import pymongo
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.messages import (
    BaseMessage,
    messages_from_dict,
    messages_to_dict,
)
from core.config import settings


class MongoDBChatMessageHistory(BaseChatMessageHistory):
    """
    Direct PyMongo-backed chat message history satisfying LangChain's BaseChatMessageHistory.
    Stores messages as serialized dicts in MongoDB under the session_id key.
    """

    def __init__(
        self,
        connection_string: str,
        session_id: str,
        database_name: str,
        collection_name: str = "chat_histories",
    ):
        self.session_id = session_id
        self._client = pymongo.MongoClient(connection_string, serverSelectionTimeoutMS=2000)
        self._collection = self._client[database_name][collection_name]

    @property
    def messages(self) -> List[BaseMessage]:
        try:
            doc = self._collection.find_one({"session_id": self.session_id})
            if not doc or "messages" not in doc:
                return []
            return messages_from_dict(doc["messages"])
        except Exception:
            return []

    def add_message(self, message: BaseMessage) -> None:
        try:
            serialized = messages_to_dict([message])[0]
            self._collection.update_one(
                {"session_id": self.session_id},
                {"$push": {"messages": serialized}},
                upsert=True,
            )
        except Exception:
            pass

    def clear(self) -> None:
        try:
            self._collection.delete_one({"session_id": self.session_id})
        except Exception:
            pass


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
