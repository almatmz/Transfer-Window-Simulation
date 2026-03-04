from beanie import Document
from pydantic import Field
from datetime import datetime


class Club(Document):
    api_football_id: int = Field(..., description="API-Football club ID")
    name: str
    country: str = ""
    league: str = ""
    league_id: int = 0
    logo_url: str = ""

    # Financial — must be set before FFP dashboard works
    annual_revenue: float = 0.0
    equity_injection_limit: float = 60_000_000.0   # UEFA default
    season_year: int = 2025

    last_synced_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "clubs"
        indexes = ["api_football_id", "name"]