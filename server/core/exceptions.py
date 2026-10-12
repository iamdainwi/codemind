"""
core/exceptions.py
Custom exception classes raised by features/ and pipeline/.
These are caught and converted to HTTPException only in api/.
"""


class CodeMindError(Exception):
    """Base exception for all CodeMind errors."""

    def __init__(self, message: str, code: str = "INTERNAL_ERROR") -> None:
        super().__init__(message)
        self.message = message
        self.code = code


class UserNotFoundError(CodeMindError):
    def __init__(self, username: str) -> None:
        super().__init__(f"User '{username}' not found.", code="USER_NOT_FOUND")


class UserAlreadyExistsError(CodeMindError):
    def __init__(self, username: str) -> None:
        super().__init__(f"Username '{username}' is already taken.", code="USER_ALREADY_EXISTS")


class InvalidCredentialsError(CodeMindError):
    def __init__(self) -> None:
        super().__init__("Invalid username or password.", code="INVALID_CREDENTIALS")


class RepoNotFoundError(CodeMindError):
    def __init__(self, repo_id: str) -> None:
        super().__init__(f"Repository '{repo_id}' not found.", code="REPO_NOT_FOUND")


class RepoAccessDeniedError(CodeMindError):
    def __init__(self, repo_id: str) -> None:
        super().__init__(
            f"Access denied to repository '{repo_id}'.", code="REPO_ACCESS_DENIED"
        )


class IngestError(CodeMindError):
    def __init__(self, detail: str) -> None:
        super().__init__(f"Ingest failed: {detail}", code="INGEST_ERROR")


class InvalidZipError(CodeMindError):
    def __init__(self) -> None:
        super().__init__("Uploaded file is not a valid ZIP archive.", code="INVALID_ZIP")


class EvalNotFoundError(CodeMindError):
    def __init__(self, repo_id: str) -> None:
        super().__init__(
            f"No evaluation results found for repo '{repo_id}'.", code="EVAL_NOT_FOUND"
        )


class UnauthenticatedError(CodeMindError):
    def __init__(self) -> None:
        super().__init__("Authentication required.", code="UNAUTHENTICATED")
