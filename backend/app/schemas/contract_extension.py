from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class ContractExtensionRequest(BaseModel):
    new_contract_expiry_year: int = Field(..., ge=2025, le=2045)
    new_contract_length_years: int = Field(..., ge=1, le=10)
    new_annual_salary: Optional[float] = Field(default=None, ge=0)
    extension_start_year: int = Field(..., ge=2025, le=2045)
    signing_bonus: float = Field(default=0.0, ge=0)
    notes: str = ""


class ContractExtensionResponse(BaseModel):
    id: str
    player_id: str
    player_name: str
    club_id: str
    set_by_role: str        # "admin" | "sport_director" | "user"
    set_by_user_id: str

    new_contract_expiry_year: int
    new_contract_length_years: int
    new_annual_salary: Optional[float] = None
    extension_start_year: int
    signing_bonus: float
    signing_bonus_amortization: float   # computed: signing_bonus / new_contract_length_years

    notes: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}