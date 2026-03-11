from beanie import Document
from pydantic import Field
from datetime import datetime


class UserRevenueOverride(Document):
    user_id: str = Field(..., description="Reference to User._id")
    club_api_football_id: int = Field(..., description="API-Football club ID")
    annual_revenue: float = Field(..., gt=0)
    season_year: int

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "user_revenue_overrides"
        indexes = [
            "user_id",
            "club_api_football_id",
            [("user_id", 1), ("club_api_football_id", 1)],  # compound unique
        ]