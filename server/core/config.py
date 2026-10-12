"""
core/config.py
Single source of truth for all application configuration.
Reads from .env file via pydantic-settings.
"""
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # MongoDB
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "codemind"

    # ChromaDB (embedded local file mode)
    CHROMA_PERSIST_DIR: str = "./data/chroma"

    # Ollama
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_LLM_MODEL: str = "gemma4:e2b-mlx"
    OLLAMA_EMBED_MODEL: str = "embeddinggemma-2:570m"

    # Session (cookie-based auth)
    SESSION_SECRET_KEY: str = "dev-secret-change-me"
    SESSION_MAX_AGE: int = 86400  # seconds — 1 day

    # File upload
    UPLOAD_DIR: str = "./data/uploads"
    MAX_UPLOAD_SIZE_MB: int = 100

    # Testing flags
    OLLAMA_AVAILABLE: bool = False

    @field_validator("SESSION_SECRET_KEY")
    @classmethod
    def secret_must_be_set(cls, v: str) -> str:
        if v == "dev-secret-change-me":
            import warnings
            warnings.warn(
                "SESSION_SECRET_KEY is using the insecure default. "
                "Set a proper secret in .env before deploying.",
                stacklevel=2,
            )
        return v


settings = Settings()
