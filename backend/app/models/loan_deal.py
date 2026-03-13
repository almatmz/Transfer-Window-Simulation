from __future__ import annotations

from beanie import Document
from pydantic import Field
from datetime import datetime, date
from typing import Optional, Literal


class LoanDeal(Document):
    player_id: str = Field(..., description="Reference to Player._id")
    player_api_football_id: int = Field(..., description="For quick lookups")
    club_id: str = Field(..., description="Reference to Club._id (the club creating this deal)")
    club_api_football_id: int

    set_by_user_id: str = Field(..., description="User._id who set this deal")
    set_by_role: str = Field(..., description="'admin' | 'sport_director'")

    loan_direction: Literal["in", "out"] = Field(
        ...,
        description=(
            "'in' = receiving player on loan from another club\n"
            "'out' = sending this player to another club on loan"
        ),
    )

    #  Counterpart club
    counterpart_club_name: str = ""         # the other club in the deal
    counterpart_club_api_football_id: Optional[int] = None

    #  Loan period 
    loan_start_date: Optional[date] = None
    loan_end_date: Optional[date] = None
    loan_season: str = ""                   # e.g. "2025/26"

    loan_fee: float = Field(
        default=0.0, ge=0,
        description="Fee paid/received for the loan itself",
    )
    annual_salary: float = Field(
        default=0.0, ge=0,
        description="Player's annual salary during the loan",
    )
    wage_contribution_pct: float = Field(
        default=100.0, ge=0, le=100,
        description=(
            "loan_in: % of wages THIS club pays (e.g. 50 = parent club pays the other half)\n"
            "loan_out: % of wages the RECEIVING club pays"
        ),
    )

    #  Option to buy 
    has_option_to_buy: bool = False
    option_to_buy_fee: Optional[float] = Field(
        default=None, ge=0,
        description="Transfer fee if the option/obligation to buy is exercised",
    )
    option_is_obligation: bool = False      # True = must buy, False = optional
    option_contract_years: Optional[int] = Field(
        default=None, ge=1, le=10,
        description="Contract length if option is exercised",
    )
    option_annual_salary: Optional[float] = Field(
        default=None, ge=0,
        description="New annual salary if option is exercised (may differ from loan salary)",
    )
    option_exercised: bool = False          # SD/Admin marks this when option is triggered
    option_exercised_at: Optional[datetime] = None

    notes: str = ""
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "loan_deals"
        indexes = [
            "player_id",
            "player_api_football_id",
            "club_id",
            "club_api_football_id",
            "set_by_user_id",
            "set_by_role",
            "loan_direction",
            "is_active",
        ]