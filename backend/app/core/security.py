from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from jose import JWTError, jwt

from app.core.config import settings

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 72  

def create_access_token(
    data: dict[str, Any],
    expires_delta: timedelta | None = None,
) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("sub") is None:
            raise credentials_exception
        return payload
    except JWTError:
        raise credentials_exception


#  FFP status helper  
def get_ffp_status(wages: float, revenue: float) -> str:
    """
        "GREEN"  — ratio ≤ 70% (safe)
        "YELLOW" — ratio 70–80% (warning)
        "RED"    — ratio > 80% (high risk)
    """
    ratio = (wages / revenue) if revenue > 0 else 1.0
    if ratio > 0.8:
        return "RED"
    if ratio > 0.7:
        return "YELLOW"
    return "GREEN"


def calculate_amortization(fee: float, years: int) -> float:
    """Calculates annual accounting cost of a player."""
    return fee / years if years > 0 else 0