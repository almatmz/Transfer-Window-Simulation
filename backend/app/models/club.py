from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional


class Club(Document):
    api_football_id: int = Field(..., description="API-Football club ID")
    name: str
    short_name: str = ""
    country: str
    league: str
    league_id: int = 0
    logo_url: str = ""

    annual_revenue: float = 0.0       
    season_year: int = 2026

    last_synced_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "clubs"
        indexes = ["api_football_id", "name", "league"]