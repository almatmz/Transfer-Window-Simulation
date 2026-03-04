from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class ContractResponse(BaseModel):
    id: str
    player_id: str
    player_name: str
    position: str
    contract_type: str
    contract_start_year: int
    contract_expiry_year: int
    annual_salary: float
    acquisition_fee: float
    amortization_per_year: float
    remaining_book_value: float
    loan_wage_contribution_pct: float
    data_source: str
    is_active: bool


class SquadPlayerResponse(BaseModel):
    player_id: str
    api_football_id: int
    name: str
    age: int
    position: str
    nationality: str
    photo_url: str
    contract_expiry_year: int
    has_contract: bool
    # SD/Admin only — None for public users
    annual_salary: Optional[float] = None
    amortization_per_year: Optional[float] = None
    data_source: Optional[str] = None


class CreateContractRequest(BaseModel):
    player_api_football_id: int
    contract_start_year: int
    contract_expiry_year: int
    annual_salary: float = Field(..., gt=0)
    acquisition_fee: float = Field(default=0.0, ge=0)
    contract_type: str = "permanent"
    parent_club_id: Optional[str] = None
    loan_fee: float = 0.0
    loan_wage_contribution_pct: float = 50.0
    option_to_buy_enabled: bool = False
    option_to_buy_fee: float = 0.0


class ExtendContractRequest(BaseModel):
    new_expiry_year: int = Field(..., ge=2025, le=2040)
    new_annual_salary: float = Field(..., gt=0)