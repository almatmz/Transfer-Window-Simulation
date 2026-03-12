from beanie import Document
from pydantic import Field
from datetime import datetime, date
from typing import Optional


class SalaryOverride(Document):
    player_id: str = Field(..., description="Reference to Player._id")
    club_id: str = Field(..., description="Reference to Club._id")
    set_by_user_id: str = Field(
        ..., description="User._id of the sport director or admin"
    )

    annual_salary: float = Field(..., gt=0, description="Annual gross salary EUR")

    contract_length_years: int = Field(..., ge=1, le=10)
    contract_expiry_year: int
    contract_signing_date: Optional[date] = None   # exact date of signing

    acquisition_fee: float = Field(default=0.0, ge=0)
    acquisition_year: int = Field(default=0)       # calendar year signed

    # ── Loan override (SD can confirm / correct loan status) ──────────────────
    is_on_loan: bool = False
    loan_from_club: Optional[str] = None           # parent club name
    loan_end_date: Optional[date] = None           # when loan ends
    loan_fee_paid: float = 0.0                     # fee THIS club paid for the loan
    loan_wage_contribution_pct: float = 100.0      # % of wages THIS club covers

    notes: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "salary_overrides"
        indexes = ["player_id", "club_id", "set_by_user_id"]