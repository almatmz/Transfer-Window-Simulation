from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, Literal


class LoanDealRequest(BaseModel):
    loan_direction: Literal["in", "out"]

    counterpart_club_name: str = ""
    counterpart_club_api_football_id: Optional[int] = None

    loan_start_date: Optional[date] = None
    loan_end_date: Optional[date] = None
    loan_season: str = ""

    loan_fee: float = Field(default=0.0, ge=0)
    annual_salary: float = Field(default=0.0, ge=0)
    wage_contribution_pct: float = Field(
        default=100.0, ge=0, le=100,
        description=(
            "loan_in: % of wages your club pays. "
            "loan_out: % of wages the receiving club pays."
        ),
    )

    has_option_to_buy: bool = False
    option_to_buy_fee: Optional[float] = Field(default=None, ge=0)
    option_is_obligation: bool = False
    option_contract_years: Optional[int] = Field(default=None, ge=1, le=10)
    option_annual_salary: Optional[float] = Field(default=None, ge=0)
    option_exercised: bool = False

    notes: str = ""


class LoanDealResponse(BaseModel):
    id: str
    player_id: str
    player_name: str
    club_id: str
    club_api_football_id: int
    set_by_role: str
    set_by_user_id: str

    loan_direction: str
    counterpart_club_name: str
    counterpart_club_api_football_id: Optional[int] = None

    loan_start_date: Optional[date] = None
    loan_end_date: Optional[date] = None
    loan_season: str = ""

    loan_fee: float
    annual_salary: float
    wage_contribution_pct: float

    # Computed: positive = wage cost added, negative = wage relief
    effective_wage_impact: float = 0.0

    has_option_to_buy: bool
    option_to_buy_fee: Optional[float] = None
    option_is_obligation: bool
    option_contract_years: Optional[int] = None
    option_annual_salary: Optional[float] = None
    option_exercised: bool
    option_exercised_at: Optional[datetime] = None

    notes: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ExerciseOptionRequest(BaseModel):
    """Mark a loan option to buy as exercised — triggers a permanent transfer."""
    notes: str = ""