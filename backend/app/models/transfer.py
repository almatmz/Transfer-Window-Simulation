from beanie import Document
from pydantic import Field, BaseModel, model_validator
from datetime import datetime
from enum import Enum
from typing import Optional
import re


class WindowType(str, Enum):
    SUMMER = "summer"
    WINTER = "winter"


class YearlyProjection(BaseModel):
    year: int
    revenue: float
    wage_bill: float
    amortization: float
    squad_cost: float
    squad_cost_ratio: float
    net_transfer_spend: float
    operating_result: float
    ffp_status: str


#  Loan duration helper 

def compute_loan_end_season(window_type: str, season: str, loan_duration_months: int) -> str:
    """
    Computes the season string when a loan expires.

    Examples:
      Summer 2026/27 + 12 months → "Summer 2027/28"  (full season loan)
      Summer 2026/27 +  6 months → "Winter 2026/27"  (half season loan)
      Winter 2026/27 + 12 months → "Winter 2027/28"
      Winter 2026/27 +  6 months → "Summer 2027/28"
    """
    match = re.search(r'(\d{4})', season)
    start_year = int(match.group(1)) if match else 2026

    is_summer = window_type.lower() == "summer"
    # Summer window opens ~month 6, Winter ~month 12
    start_month = 6 if is_summer else 12

    total_months = start_year * 12 + start_month + loan_duration_months
    end_year = total_months // 12
    end_month = total_months % 12
    if end_month == 0:
        end_month = 12
        end_year -= 1

    end_window = "Summer" if end_month <= 6 else "Winter"
    end_short = str(end_year + 1)[-2:]
    return f"{end_window} {end_year}/{end_short}"


#  Transfer entries 

class BuyEntry(BaseModel):
    """
    Buy a player permanently.
    Transfer fee is amortized over contract_length_years.
    Full annual_salary added to wage bill.
    """
    player_name: str
    position: str
    age: int = Field(..., ge=15, le=45)
    nationality: str = ""
    transfer_fee: float = Field(..., ge=0)
    annual_salary: float = Field(..., gt=0)
    contract_length_years: int = Field(..., ge=1, le=10)
    api_football_player_id: Optional[int] = None


class SellEntry(BaseModel):
    """
    Sell a player permanently.
    Removes their wages and remaining book value.
    Book profit/loss = sale_fee − remaining_book_value counted as relevant income.
    """
    player_name: str
    position: str
    transfer_fee: float = Field(..., ge=0)
    api_football_player_id: Optional[int] = None
    # Only needed if NOT linking a squad player
    annual_salary: float = Field(default=0.0, ge=0)
    contract_length_years: int = Field(default=1, ge=1, le=10)


class LoanInEntry(BaseModel):
    """
    Take a player on loan from another club.

    loan_duration_months: how long the loan lasts.
      Common values: 6 (half season), 12 (full season), 18 (1.5 seasons)

    loan_end_season: automatically computed — the season when the loan expires.
      Summer 2026/27 + 12 months → "Summer 2027/28"
      Summer 2026/27 +  6 months → "Winter 2026/27"

    wage_contribution_pct: % of wages YOUR club pays.
      50 = you pay half (most common), 100 = you pay all, 0 = parent pays all
    """
    player_name: str
    position: str
    age: Optional[int] = Field(default=None, ge=15, le=45)
    nationality: str = ""
    api_football_player_id: Optional[int] = None

    loan_fee: float = Field(default=0.0, ge=0)
    annual_salary: float = Field(..., gt=0)
    wage_contribution_pct: float = Field(
        default=50.0, ge=0, le=100,
        description="% of this player's salary YOUR club pays. Parent club pays the rest.",
    )

    loan_duration_months: int = Field(
        default=12, ge=1, le=36,
        description="How long the loan lasts. 6=half season, 12=full season, 18=1.5 seasons.",
    )
    loan_end_season: str = Field(
        default="",
        description="Auto-computed when simulation is created/updated. e.g. 'Summer 2027/28'",
    )

    has_option_to_buy: bool = False
    option_to_buy_fee: float = Field(default=0.0, ge=0)
    option_to_buy_year: int = Field(default=0, ge=0)


class LoanOutEntry(BaseModel):
    """
    Send one of your players on loan.

    loan_duration_months: how long the loan lasts.
    loan_end_season: automatically computed.

    wage_contribution_pct: % of salary YOUR club still pays.
      0 = fully off your books (best for FFP), 30 = you keep paying 30%
    """
    player_name: str
    position: str
    nationality: str = ""
    api_football_player_id: Optional[int] = None

    loan_fee_received: float = Field(default=0.0, ge=0)
    annual_salary: float = Field(default=0.0, ge=0)
    wage_contribution_pct: float = Field(
        default=0.0, ge=0, le=100,
        description="% of salary YOUR club still pays. 0 = fully off your books.",
    )

    loan_duration_months: int = Field(
        default=12, ge=1, le=36,
        description="How long the loan lasts. 6=half season, 12=full season.",
    )
    loan_end_season: str = Field(
        default="",
        description="Auto-computed. e.g. 'Winter 2026/27'",
    )

    has_option_to_buy: bool = False
    option_to_buy_fee: float = Field(default=0.0, ge=0)
    option_to_buy_year: int = Field(default=0, ge=0)


# ─── Simulation document ──────────────────────────────────────────────────────

class TransferSimulation(Document):
    user_id: str
    club_api_football_id: int
    club_name: str
    simulation_name: str
    window_type: WindowType = WindowType.SUMMER
    season: str = "2025/26"

    buys: list[BuyEntry] = Field(default_factory=list)
    sells: list[SellEntry] = Field(default_factory=list)
    loans_in: list[LoanInEntry] = Field(default_factory=list)
    loans_out: list[LoanOutEntry] = Field(default_factory=list)

    used_salary_overrides: bool = False
    projections: list[YearlyProjection] = Field(default_factory=list)

    total_buy_fees: float = 0.0
    total_sell_fees: float = 0.0
    total_loan_fees_paid: float = 0.0
    total_loan_fees_received: float = 0.0
    net_spend: float = 0.0
    overall_ffp_status: str = "PENDING"
    is_public: bool = False

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "transfer_simulations"
        indexes = ["user_id", "club_api_football_id", "season"]