from datetime import datetime, timedelta, timezone
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext

from ..config import settings

pwd_context = CryptContext(schemes=["bcrypt_sha256", "bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(*, user_id: int, role: str, subject: str) -> str:
    issued_at = datetime.now(timezone.utc)
    expire = issued_at + timedelta(
        minutes=settings.jwt_access_token_expires_minutes
    )
    payload = {
        "sub": subject,
        "uid": user_id,
        "role": role,
        "iat": issued_at,
        "nbf": issued_at,
        "jti": str(uuid4()),
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("Invalid token") from exc

    if not isinstance(payload.get("uid"), int):
        raise ValueError("Invalid token")
    if not isinstance(payload.get("role"), str):
        raise ValueError("Invalid token")
    if not isinstance(payload.get("jti"), str):
        raise ValueError("Invalid token")
    return payload
