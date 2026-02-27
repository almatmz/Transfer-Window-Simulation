from beanie import Document
from pydantic import Field, EmailStr
from datetime import datetime
from app.core.security import UserRole


class User(Document):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    hashed_password: str
    role: UserRole = Field(default=UserRole.USER)
    is_active: bool = True

    full_name: str = ""
    club_affiliation: str = ""     

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "users"
        indexes = ["email", "username"]