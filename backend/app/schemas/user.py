from pydantic import BaseModel, EmailStr
from datetime import datetime
from app.core.security import UserRole


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    username: str
    role: UserRole
    full_name: str
    club_affiliation: str
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdateRequest(BaseModel):
    full_name: str | None = None
    username: str | None = None
    club_affiliation: str | None = None


class AdminUserUpdateRequest(BaseModel):
    """Admin-only: change role or activate/deactivate users."""
    role: UserRole | None = None
    is_active: bool | None = None
    club_affiliation: str | None = None