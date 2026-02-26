from pydantic import BaseModel, Field, model_validator
from typing import Optional
from datetime import datetime


class ClubCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, examples=["Manchester City"])
    short_name: str = Field(..., min_length=2, max_length=10, examples=["MCI"])
    country: str = Field(..., examples=["England"])
    league: str = Field(..., examples=["Premier League"])
    annual_revenue: float = Field(..., gt=0, examples=[750_000_000])
    wage_budget: float = Field(..., gt=0, examples=[400_000_000])
    transfer_budget: float = Field(..., ge=0, examples=[200_000_000])
    season_year: int = Field(..., examples=[2024])
    projection_years: int = Field(default=3, ge=1, le=5)

    @model_validator(mode="after")
    def wage_budget_cannot_exceed_revenue(self) -> "ClubCreate":
        if self.wage_budget > self.annual_revenue:
            raise ValueError("Wage budget cannot exceed annual revenue")
        return self


class ClubUpdate(BaseModel):
    name: Optional[str] = None
    short_name: Optional[str] = None
    annual_revenue: Optional[float] = Field(None, gt=0)
    wage_budget: Optional[float] = Field(None, gt=0)
    transfer_budget: Optional[float] = Field(None, ge=0)
    projection_years: Optional[int] = Field(None, ge=1, le=5)


class ClubResponse(BaseModel):
    id: str
    name: str
    short_name: str
    country: str
    league: str
    annual_revenue: float
    wage_budget: float
    transfer_budget: float
    season_year: int
    projection_years: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}