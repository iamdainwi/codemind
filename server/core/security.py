"""
core/security.py
Session-based authentication helpers using itsdangerous signed cookies.
Sessions are stored as signed cookies (no server-side session store needed for MVP).
"""
import logging
from itsdangerous import TimestampSigner, BadSignature, SignatureExpired
from core.config import settings

logger = logging.getLogger(__name__)

_signer: TimestampSigner | None = None


def _get_signer() -> TimestampSigner:
    global _signer
    if _signer is None:
        _signer = TimestampSigner(settings.SESSION_SECRET_KEY)
    return _signer


def sign_user_id(user_id: str) -> str:
    """Create a signed session token from a user_id string."""
    return _get_signer().sign(user_id).decode()


def verify_session_token(token: str) -> str | None:
    """
    Verify a signed session token and return the user_id, or None if invalid/expired.
    Max age is read from settings.SESSION_MAX_AGE (seconds).
    """
    try:
        user_id_bytes = _get_signer().unsign(
            token, max_age=settings.SESSION_MAX_AGE
        )
        return user_id_bytes.decode()
    except (SignatureExpired, BadSignature) as exc:
        logger.debug("Session token invalid: %s", exc)
        return None


import bcrypt


def hash_password(plain: str) -> str:
    """Hash a plaintext password with bcrypt. Returns the hashed string."""
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return bcrypt.checkpw(plain.encode(), hashed.encode())
