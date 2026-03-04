"""
PlayerContract — the heart of the financial system.

Every financial calculation derives from contracts, not players.

Rules:
- One active PERMANENT contract per player per club at a time
- Loan contracts have parent_club_id
- amortization_per_year is auto-calculated on save
- data_source tells you how trustworthy the numbers are
"""
from beanie import Document
from pydantic import Field, model_validator
from datetime import datetime
from typing import Optional
from enum import Enum


class ContractType(str, Enum):
    PERMANENT = "permanent"
    LOAN = "loan"


class DataSource(str, Enum):
    GROQ = "groq"           # AI estimated via Groq
    GEMINI = "gemini"       # AI estimated via Gemini
    OVERRIDE = "override"   # Manually set by Sport Director (most accurate)
    MANUAL = "manual"       # Entered manually (unknown source)
    MIGRATED = "migrated"   # Moved from old schema (treat as estimate)


class OptionToBuy(Document):
    enabled: bool = False
    option_fee: float = 0.0
    option_deadline: Optional[datetime] = None

    class Settings:
        name = "option_to_buy"


class PlayerContract(Document):
    player_id: str = Field(..., description="Reference to Player._id")
    club_id: str = Field(..., description="Reference to Club._id")
    player_name: str = ""    # denormalized for query convenience
    player_api_id: int = 0   # denormalized for query convenience

    contract_type: ContractType = ContractType.PERMANENT

    # Dates
    contract_start_year: int
    contract_expiry_year: int

    # Financials
    annual_salary: float = Field(..., gt=0, description="Gross annual salary EUR")

    # Permanent contract fields
    acquisition_fee: float = Field(default=0.0, ge=0)
    acquisition_year: int = 0
    amortization_per_year: float = 0.0   # AUTO-CALCULATED — do not set manually
    remaining_book_value: float = 0.0    # snapshot, recalculated by engine

    # Loan fields
    parent_club_id: Optional[str] = None           # required for loan
    loan_fee: float = 0.0
    loan_wage_contribution_pct: float = Field(
        default=50.0, ge=0, le=100,
        description="% of wages YOUR club pays. 50 = split equally."
    )

    # Option to buy (loan only)
    option_to_buy_enabled: bool = False
    option_to_buy_fee: float = 0.0
    option_to_buy_deadline_year: int = 0

    # Meta
    data_source: DataSource = DataSource.GROQ
    is_active: bool = True
    terminated_at: Optional[datetime] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    @model_validator(mode="after")
    def calculate_amortization(self) -> "PlayerContract":
        """Auto-calculate amortization on permanent contracts."""
        if self.contract_type == ContractType.PERMANENT:
            years = max(self.contract_expiry_year - self.contract_start_year, 1)
            if self.acquisition_fee > 0:
                self.amortization_per_year = self.acquisition_fee / years
            else:
                self.amortization_per_year = 0.0
            self.remaining_book_value = self.amortization_per_year * years
        else:
            self.amortization_per_year = 0.0  # loans: no amortization
        return self

    def get_remaining_book_value(self, current_season: int) -> float:
        """Dynamic book value based on current season."""
        if self.contract_type != ContractType.PERMANENT:
            return 0.0
        years_left = max(self.contract_expiry_year - current_season, 0)
        return self.amortization_per_year * years_left

    def get_years_remaining(self, current_season: int) -> int:
        return max(self.contract_expiry_year - current_season, 0)

    class Settings:
        name = "player_contracts"
        indexes = ["player_id", "club_id", "is_active", "contract_expiry_year"]