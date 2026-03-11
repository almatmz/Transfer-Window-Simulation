from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class ClubResponse(BaseModel):
    id: str
    api_football_id: int
    name: str
    short_name: str
    country: str
    league: str
    logo_url: str
    season_year: int
    annual_revenue: float = 0.0          # effective revenue (official > user)
    revenue_configured: bool = False
    last_synced_at: datetime

    model_config = {"from_attributes": True}


class ClubSearchResult(BaseModel):
    api_football_id: int
    name: str
    country: str
    league: str
    logo_url: str


class ClubRevenueUpdate(BaseModel):
    """
    Set club annual revenue for FFP calculations.

    - ADMIN / SPORT_DIRECTOR: sets authoritative official revenue.
    - USER (authenticated): sets a personal estimate ONLY when no official
      revenue has been configured by SD/admin.
    """
    annual_revenue: float = Field(..., gt=0, description="Annual revenue in EUR")
    season_year: int = Field(..., ge=2020, le=2030)