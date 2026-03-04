"""
Simulation + SimulationTransfer (unified).

Single TransferEntry replaces 4 separate BuyEntry/SellEntry/LoanInEntry/LoanOutEntry.
Projections are NEVER stored — always calculated on-the-fly.
"""
from beanie import Document
from pydantic import Field, BaseModel
from datetime import datetime
from typing import Optional
from enum import Enum


class WindowType(str, Enum):
    SUMMER = "summer"
    WINTER = "winter"


class TransferType(str, Enum):
    BUY = "buy"
    SELL = "sell"
    LOAN_IN = "loan_in"
    LOAN_OUT = "loan_out"


class TransferSimulation(Document):
    user_id: str
    club_id: str                    # Club._id (ObjectId as str)
    club_api_football_id: int       # denormalized for convenience
    club_name: str

    name: str
    season_year: int = 2025
    window_type: WindowType = WindowType.SUMMER

    is_public: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "transfer_simulations"
        indexes = ["user_id", "club_id", "club_api_football_id"]


class SimulationTransfer(Document):
    """
    One entry per transfer action in a simulation.
    Type determines which fields are relevant:

    BUY:      transfer_fee, annual_salary, contract_length_years
    SELL:     transfer_fee (player_id required — real squad player)
    LOAN_IN:  annual_salary, loan_wage_contribution_pct, loan_fee
    LOAN_OUT: loan_wage_contribution_pct, loan_fee_received (player_id required)
    """
    simulation_id: str
    type: TransferType

    # Player reference — use real player if in squad, otherwise free-text for new buys
    player_id: Optional[str] = None          # Player._id if real squad player
    player_api_football_id: Optional[int] = None
    player_name: str = ""
    position: str = "UNKNOWN"
    age: int = 0
    nationality: str = ""

    # Common financial fields
    transfer_fee: float = Field(default=0.0, ge=0)
    annual_salary: float = Field(default=0.0, ge=0)
    contract_length_years: int = Field(default=1, ge=1, le=10)

    # Loan specific
    loan_fee: float = 0.0
    loan_fee_received: float = 0.0
    loan_wage_contribution_pct: float = Field(
        default=50.0, ge=0, le=100,
        description="% of wages YOUR club pays. Buy: 0. Sell/LoanOut: relief %."
    )

    # Option to buy (loan_in only)
    option_to_buy_enabled: bool = False
    option_to_buy_fee: float = 0.0

    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "simulation_transfers"
        indexes = ["simulation_id"]