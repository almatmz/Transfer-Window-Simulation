from beanie import Document
from pydantic import Field, BaseModel
from datetime import datetime
from enum import Enum
from typing import Optional


class WindowType(str, Enum):
    SUMMER = "summer"
    WINTER = "winter"


class YearlyProjection(BaseModel):
    year: int
    revenue: float
    wage_bill: float
    amortization: float
    squad_cost: float
    squad_cost_ratio: float       # decimal e.g. 0.68 = 68%
    net_transfer_spend: float
    operating_result: float
    ffp_status: str


# ─── Individual transfer entries ──────────────────────────────────────────────

class BuyEntry(BaseModel):
    """Buy a player. Fee amortized over contract years. Full salary on wage bill."""
    player_name: str
    position: str
    age: int = Field(..., ge=15, le=45)
    nationality: str = ""
    transfer_fee: float = Field(..., ge=0)
    annual_salary: float = Field(..., gt=0)
    contract_length_years: int = Field(..., ge=1, le=10)
    api_football_player_id: Optional[int] = None   # if known (e.g. player from another club)


class SellEntry(BaseModel):
    """Sell a player. Removes their wages and book value from your books."""
    player_name: str
    position: str
    transfer_fee: float = Field(..., ge=0)
    # Link to squad player to auto-load salary + remaining amortization
    api_football_player_id: Optional[int] = None
    # Only needed if NOT linking a squad player
    annual_salary: float = Field(default=0.0, ge=0)
    contract_length_years: int = Field(default=1, ge=1, le=10)


class LoanInEntry(BaseModel):
    """
    Take a player on loan from another club.

    wage_contribution_pct: percentage of wages YOUR club pays.
    - 100 = you pay everything (rare)
    - 50  = you pay half, parent club pays half (common)
    - 0   = parent club pays everything (very rare)
    """
    player_name: str
    position: str
    age: Optional[int] = Field(default=None, ge=15, le=45)   # Optional if api_football_player_id set
    api_football_player_id: Optional[int] = None
    loan_fee: float = Field(default=0.0, ge=0)
    annual_salary: float = Field(..., gt=0)
    wage_contribution_pct: float = Field(
        default=50.0, ge=0, le=100,
        description="% of this player's salary YOUR club pays. Parent club pays the rest."
    )
    contract_length_years: int = Field(default=1, ge=1, le=3)
    has_option_to_buy: bool = False
    option_to_buy_fee: float = Field(default=0.0, ge=0)
    option_to_buy_year: int = Field(default=0, ge=0)


class LoanOutEntry(BaseModel):
    """
    Send one of your players on loan.

    wage_contribution_pct: percentage of wages YOUR club still pays.
    - 0   = fully off your books (loan club pays everything — best for FFP)
    - 30  = you keep paying 30%, loan club pays 70%
    - 100 = you pay everything (pointless loan — same as keeping them)
    """
    player_name: str
    position: str
    api_football_player_id: Optional[int] = None
    loan_fee_received: float = Field(default=0.0, ge=0)
    annual_salary: float = Field(default=0.0, ge=0)   # auto-loaded if api_football_player_id set
    wage_contribution_pct: float = Field(
        default=0.0, ge=0, le=100,
        description="% of salary YOUR club still pays. 0 = fully off your books."
    )
    contract_length_years: int = Field(default=1, ge=1, le=3)
    has_option_to_sell: bool = False
    option_to_sell_fee: float = Field(default=0.0, ge=0)
    option_to_sell_year: int = Field(default=0, ge=0)


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