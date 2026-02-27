from fastapi import APIRouter, Depends
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, RefreshRequest
from app.schemas.user import UserResponse, UserUpdateRequest
from app.services import auth_service
from app.core.deps import get_current_user
from app.models.user import User
from datetime import datetime

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest):
    """Register a new user. Returns access + refresh tokens immediately."""
    return await auth_service.register(body)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    """Login with email + password."""
    return await auth_service.login(body)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest):
    """Exchange a refresh token for a new access token."""
    return await auth_service.refresh(body)


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Get the authenticated user's profile."""
    return UserResponse(
        id=str(user.id),
        email=user.email,
        username=user.username,
        role=user.role,
        full_name=user.full_name,
        club_affiliation=user.club_affiliation,
        created_at=user.created_at,
    )


@router.patch("/me", response_model=UserResponse)
async def update_me(body: UserUpdateRequest, user: User = Depends(get_current_user)):
    """Update own profile (name, username, club affiliation)."""
    update = body.model_dump(exclude_unset=True)
    update["updated_at"] = datetime.utcnow()
    await user.set(update)
    return UserResponse(
        id=str(user.id),
        email=user.email,
        username=user.username,
        role=user.role,
        full_name=user.full_name,
        club_affiliation=user.club_affiliation,
        created_at=user.created_at,
    )