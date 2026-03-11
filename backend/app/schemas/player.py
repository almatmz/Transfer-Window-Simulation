from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional
from app.models.player import Position


class PlayerPublicResponse(BaseModel):
    id: str
    api_football_id: int
    name: str
    age: int
    nationality: str
    position: Position
    photo_url: str
    transfer_value: float
    transfer_value_currency: str
    estimated_annual_salary: float
    salary_source: str
    contract_expiry_year: int
    contract_length_years: int
    last_synced_at: datetime

    model_config = {"from_attributes": True}


class PlayerSDResponse(PlayerPublicResponse):
    """
    Returned ONLY to Sport Directors and Admins.
    Adds the override salary and full contract details.
    """
    override_annual_salary: Optional[float] = None
    override_contract_years: Optional[int] = None
    override_contract_expiry_year: Optional[int] = None
    override_acquisition_fee: Optional[float] = None
    override_acquisition_year: Optional[int] = None
    override_contract_signing_date: Optional[date] = None
    has_override: bool = False

    # Computed amortization fields (from override if set, else from player)
    annual_amortization: Optional[float] = None
    remaining_book_value: Optional[float] = None
    seasons_elapsed: Optional[int] = None


class SalaryOverrideRequest(BaseModel):
    """Sport Director / Admin sets the real salary and contract details for a player."""
    annual_salary: float = Field(..., gt=0)
    contract_length_years: int = Field(..., ge=1, le=10)
    contract_expiry_year: int = Field(..., ge=2020, le=2040)
    contract_signing_date: Optional[date] = None
    acquisition_fee: float = Field(default=0.0, ge=0)
    acquisition_year: int = Field(default=0, ge=0)
    notes: str = ""


class SalaryOverrideResponse(BaseModel):
    id: str
    player_id: str
    club_id: str
    annual_salary: float
    contract_length_years: int
    contract_expiry_year: int
    contract_signing_date: Optional[date] = None
    acquisition_fee: float
    acquisition_year: int
    annual_amortization: float = 0.0     # computed: fee / years
    notes: str
    updated_at: datetime

    model_config = {"from_attributes": True}