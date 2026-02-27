from datetime import datetime
from fastapi import HTTPException, status

from app.models.user import User
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token, UserRole
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, RefreshRequest


async def register(data: RegisterRequest) -> TokenResponse:
    if await User.find_one(User.email == data.email):
        raise HTTPException(status_code=409, detail="Email already registered")
    if await User.find_one(User.username == data.username):
        raise HTTPException(status_code=409, detail="Username already taken")

    user = User(
        email=data.email,
        username=data.username,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role=UserRole.USER,
    )
    await user.insert()
    return _issue_tokens(user)


async def login(data: LoginRequest) -> TokenResponse:
    user = await User.find_one(User.email == data.email)
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")
    return _issue_tokens(user)


async def refresh(data: RefreshRequest) -> TokenResponse:
    payload = decode_token(data.refresh_token, token_type="refresh")
    user = await User.get(payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")
    return _issue_tokens(user)


def _issue_tokens(user: User) -> TokenResponse:
    payload = {"sub": str(user.id), "role": user.role.value}
    return TokenResponse(
        access_token=create_access_token(payload),
        refresh_token=create_refresh_token(payload),
        role=user.role.value,
    )