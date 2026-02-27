from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.player import Position


class PlayerPublicResponse(BaseModel):
    """
    Returned to all users (including anonymous).
    Salary is the Capology public estimate — never the SD override.
    """
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
    last_synced_at: datetime

    model_config = {"from_attributes": True}


class PlayerSDResponse(PlayerPublicResponse):
    """
    Returned ONLY to Sport Directors and Admins.
    Adds the override salary if one exists.
    """
    override_annual_salary: Optional[float] = None    # SD's private value
    override_contract_years: Optional[int] = None
    override_acquisition_fee: Optional[float] = None
    has_override: bool = False


class SalaryOverrideRequest(BaseModel):
    """Sport Director sets the real salary for a player."""
    annual_salary: float
    contract_length_years: int
    contract_expiry_year: int
    acquisition_fee: float = 0.0
    acquisition_year: int = 0
    notes: str = ""


class SalaryOverrideResponse(BaseModel):
    id: str
    player_id: str
    club_id: str
    annual_salary: float
    contract_length_years: int
    contract_expiry_year: int
    acquisition_fee: float
    notes: str
    updated_at: datetime

    model_config = {"from_attributes": True}