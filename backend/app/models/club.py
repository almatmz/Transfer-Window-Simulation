from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import datetime


class FinancialProfile(Document):
    """Embedded financial profile — not a standalone collection."""
    annual_revenue: float = Field(..., gt=0, description="Total annual revenue in EUR")
    wage_budget: float = Field(..., gt=0, description="Total annual wage budget in EUR")
    transfer_budget: float = Field(..., ge=0, description="Available transfer budget in EUR")
    season_year: int = Field(..., description="e.g. 2024 for the 2024/25 season")


class Club(Document):
    name: str = Field(..., min_length=2, max_length=100)
    short_name: str = Field(..., min_length=2, max_length=10, description="e.g. MCI, LFC")
    country: str = Field(..., min_length=2, max_length=60)
    league: str = Field(..., min_length=2, max_length=60)
    annual_revenue: float = Field(..., gt=0)
    wage_budget: float = Field(..., gt=0)
    transfer_budget: float = Field(..., ge=0)
    season_year: int = Field(..., description="Current season start year")

    projection_years: int = Field(default=3, ge=1, le=5)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "clubs"
        indexes = [
            "name",
            "league",
        ]