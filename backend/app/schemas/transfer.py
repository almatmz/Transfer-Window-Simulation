from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from app.models.transfer import TransferType, WindowType


class CreateSimulationRequest(BaseModel):
    club_api_football_id: int
    name: str = Field(..., min_length=1, max_length=100)
    season_year: int = Field(default=2025, ge=2020, le=2040)
    window_type: WindowType = WindowType.SUMMER


class AddTransferRequest(BaseModel):
    type: TransferType
    player_name: str = Field(..., min_length=1)
    position: str = "UNKNOWN"
    age: int = Field(default=0, ge=0, le=50)
    nationality: str = ""

    # Common
    transfer_fee: float = Field(default=0.0, ge=0)
    annual_salary: float = Field(default=0.0, ge=0)
    contract_length_years: int = Field(default=1, ge=1, le=10)

    # Loan specific
    loan_fee: float = Field(default=0.0, ge=0)
    loan_fee_received: float = Field(default=0.0, ge=0)
    loan_wage_contribution_pct: float = Field(
        default=50.0, ge=0, le=100,
        description="% of wages YOUR club pays. 50=split. 100=you pay all. 0=them pays all."
    )

    # Option to buy
    option_to_buy_enabled: bool = False
    option_to_buy_fee: float = Field(default=0.0, ge=0)

    # Optional: link to real squad player
    player_api_football_id: Optional[int] = None


class SimulationTransferResponse(BaseModel):
    id: str
    simulation_id: str
    type: str
    player_name: str
    position: str
    age: int
    transfer_fee: float
    annual_salary: float
    contract_length_years: int
    loan_fee: float
    loan_fee_received: float
    loan_wage_contribution_pct: float
    option_to_buy_enabled: bool
    option_to_buy_fee: float
    created_at: datetime


class SimulationResponse(BaseModel):
    id: str
    club_name: str
    club_api_football_id: int
    name: str
    season_year: int
    window_type: str
    transfers: list[SimulationTransferResponse] = []
    is_public: bool
    created_at: datetime
    updated_at: datetime