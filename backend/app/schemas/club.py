from pydantic import BaseModel
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
    last_synced_at: datetime

    model_config = {"from_attributes": True}


class ClubSearchResult(BaseModel):
    """Lightweight result for search listings."""
    api_football_id: int
    name: str
    country: str
    league: str
    logo_url: str


class ClubRevenueUpdate(BaseModel):
    """Sport Directors / Admins can set the club's annual revenue for FFP calculations."""
    annual_revenue: float
    season_year: int