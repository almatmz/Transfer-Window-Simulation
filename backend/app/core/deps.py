"""
FastAPI dependency injection.

Usage in endpoints:
    current_user = Depends(get_current_user)           # any logged-in user
    current_user = Depends(require_sport_director)     # SD or Admin only
    current_user = Depends(require_admin)              # Admin only
    optional_user = Depends(get_optional_user)         # None if not logged in
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.security import decode_token, UserRole, role_gte
from app.models.user import User

bearer = HTTPBearer(auto_error=False)


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> User | None:
    """Returns the authenticated user, or None if no token provided."""
    if not credentials:
        return None
    try:
        payload = decode_token(credentials.credentials, token_type="access")
        user = await User.get(payload["sub"])
        if not user or not user.is_active:
            return None
        return user
    except Exception:
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> User:
    """Requires a valid authenticated user. Raises 401 if not authenticated."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_token(credentials.credentials, token_type="access")
    user = await User.get(payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


def require_role(minimum_role: UserRole):
    """Factory: returns a dependency that enforces a minimum role."""
    async def _check(user: User = Depends(get_current_user)) -> User:
        if not role_gte(user.role, minimum_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {minimum_role.value}",
            )
        return user
    return _check


require_user = require_role(UserRole.USER)
require_sport_director = require_role(UserRole.SPORT_DIRECTOR)
require_admin = require_role(UserRole.ADMIN)