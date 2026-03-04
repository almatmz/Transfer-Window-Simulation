from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class ClubResponse(BaseModel):
    id: str
    api_football_id: int
    name: str
    country: str
    league: str
    logo_url: str
    annual_revenue: float
    equity_injection_limit: float
    season_year: int
    revenue_configured: bool
    last_synced_at: datetime


class ClubRevenueUpdate(BaseModel):
    annual_revenue: float = Field(..., gt=0, description="Annual revenue in EUR, must be > 0")
    equity_injection_limit: Optional[float] = Field(None, ge=0, description="UEFA equity limit, default 60M")
    season_year: Optional[int] = Field(None, ge=2020, le=2040)


class ClubSearchResult(BaseModel):
    api_football_id: int
    name: str
    country: str
    logo_url: str