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

    official_annual_revenue: float = 0.0
    official_revenue_set_by: str = ""          # user_id of who set it
    official_revenue_season_year: int = 0

    user_annual_revenue: float = 0.0
    user_revenue_set_by: str = ""              # user_id of who set it
    user_revenue_season_year: int = 0

    season_year: int = 2026

    last_synced_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "clubs"
        indexes = ["api_football_id", "name", "league"]

    @property
    def effective_revenue(self) -> float:
        """
        Returns the authoritative revenue for FFP calculations.
        SD/Admin official revenue takes priority over user-set revenue.
        """
        if self.official_annual_revenue > 0:
            return self.official_annual_revenue
        return self.user_annual_revenue

    @property
    def revenue_configured(self) -> bool:
        return self.effective_revenue > 0