from datetime import datetime, timedelta, timezone
from typing import Any
from enum import Enum

from fastapi import HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class UserRole(str, Enum):
    ANONYMOUS = "anonymous"
    USER = "user"
    SPORT_DIRECTOR = "sport_director"
    ADMIN = "admin"


# Role hierarchy — higher index = more permissions
ROLE_HIERARCHY = [
    UserRole.ANONYMOUS,
    UserRole.USER,
    UserRole.SPORT_DIRECTOR,
    UserRole.ADMIN,
]


def role_gte(role: UserRole, minimum: UserRole) -> bool:
    """Check if role meets or exceeds the minimum required role."""
    return ROLE_HIERARCHY.index(role) >= ROLE_HIERARCHY.index(minimum)


# ── Password ──────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode["exp"] = expire
    to_encode["type"] = "access"
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict[str, Any]) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode["exp"] = expire
    to_encode["type"] = "refresh"
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str, token_type: str = "access") -> dict[str, Any]:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("sub") is None:
            raise exc
        if payload.get("type") != token_type:
            raise exc
        return payload
    except JWTError:
        raise exc