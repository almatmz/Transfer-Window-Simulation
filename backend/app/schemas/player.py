from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional
from app.models.player import Position


class PlayerPublicResponse(BaseModel):
    """
    Served to ALL viewers including unauthenticated guests.
    If an Admin override exists, its values replace the raw DB values here.
    """
    id: str
    api_football_id: int
    name: str
    full_name: str = ""
    age: int
    date_of_birth: Optional[date] = None
    nationality: str
    position: Position
    photo_url: str

    transfer_value: float
    transfer_value_currency: str

    estimated_annual_salary: float
    salary_source: str

    contract_expiry_year: int
    contract_length_years: int
    contract_signing_date: Optional[date] = None
    contract_expiry_date: Optional[date] = None

    is_on_loan: bool = False
    loan_from_club: Optional[str] = None
    loan_end_date: Optional[date] = None

    transfermarkt_url: Optional[str] = None

    # Indicates which layer of data the viewer is seeing
    data_source: str = "db"   # "db" | "admin_override" | "sd_override"

    last_synced_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# SD / Admin response — adds override metadata + financial details
# ─────────────────────────────────────────────────────────────────────────────

class PlayerSDResponse(PlayerPublicResponse):
    """
    Returned ONLY to Sport Directors and Admins.

    The base fields (name, salary, contract, etc.) already reflect the
    merged priority view:
      SD's own override > Admin override > raw DB

    The override_* fields expose what each layer has set, so the SD
    can see exactly what is overriding what.
    """
    # ── What the Admin has overridden (visible to all SD/Admin) ───────────
    admin_override_id: Optional[str] = None
    admin_annual_salary: Optional[float] = None
    admin_contract_expiry_year: Optional[int] = None
    admin_contract_length_years: Optional[int] = None
    admin_transfer_value: Optional[float] = None
    admin_is_on_loan: Optional[bool] = None
    admin_notes: Optional[str] = None
    has_admin_override: bool = False

    # ── What THIS SD has overridden (private to them) ─────────────────────
    sd_override_id: Optional[str] = None
    sd_annual_salary: Optional[float] = None
    sd_contract_expiry_year: Optional[int] = None
    sd_contract_length_years: Optional[int] = None
    sd_transfer_value: Optional[float] = None
    sd_is_on_loan: Optional[bool] = None
    sd_notes: Optional[str] = None
    has_sd_override: bool = False

    # ── Computed amortization (from the merged view values above) ─────────
    annual_amortization: Optional[float] = None
    remaining_book_value: Optional[float] = None
    seasons_elapsed: Optional[int] = None

    # ── SD-only loan financial details ────────────────────────────────────
    loan_fee: Optional[float] = None
    loan_from_club_id: Optional[str] = None
    loan_start_date: Optional[date] = None
    loan_wage_contribution_pct: Optional[float] = None


# ─────────────────────────────────────────────────────────────────────────────
# Override request — used by both Admin and SD
# All fields are optional: only fields you send are overridden
# ─────────────────────────────────────────────────────────────────────────────

class PlayerOverrideRequest(BaseModel):
    """
    Admin or Sport Director overrides any subset of player fields.

    - Send only the fields you want to change.
    - Fields left out (or set to null) are NOT overridden — the next
      priority level's value will be used instead.
    - Admin overrides are visible to everyone.
    - SD overrides are visible only to that SD.
    """
    # Bio
    name: Optional[str] = None
    full_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    age: Optional[int] = Field(default=None, ge=0, le=60)
    nationality: Optional[str] = None
    position: Optional[str] = None   # use Position enum values: GK, CB, LB, etc.
    photo_url: Optional[str] = None

    # Financial
    transfer_value: Optional[float] = Field(default=None, ge=0)
    annual_salary: Optional[float] = Field(default=None, ge=0)

    # Contract
    contract_signing_date: Optional[date] = None
    contract_expiry_date: Optional[date] = None
    contract_expiry_year: Optional[int] = Field(default=None, ge=2020, le=2045)
    contract_length_years: Optional[int] = Field(default=None, ge=1, le=10)
    acquisition_fee: Optional[float] = Field(default=None, ge=0)
    acquisition_year: Optional[int] = Field(default=None, ge=2000, le=2045)

    # Loan IN — correct/set loan-from-another-club status
    is_on_loan: Optional[bool] = None
    loan_from_club: Optional[str] = None
    loan_from_club_id: Optional[str] = None
    loan_start_date: Optional[date] = None
    loan_end_date: Optional[date] = None
    loan_fee: Optional[float] = Field(default=None, ge=0)
    loan_option_to_buy: Optional[bool] = None
    loan_option_to_buy_fee: Optional[float] = Field(default=None, ge=0)
    loan_wage_contribution_pct: Optional[float] = Field(default=None, ge=0, le=100)

    # Loan OUT — correct/set loaned-out-to-another-club status
    loaned_out: Optional[bool] = None
    loaned_out_to_club: Optional[str] = None
    loaned_out_to_club_id: Optional[str] = None
    loaned_out_start_date: Optional[date] = None
    loaned_out_end_date: Optional[date] = None
    loaned_out_fee: Optional[float] = Field(default=None, ge=0)
    loaned_out_option_to_buy: Optional[bool] = None
    loaned_out_option_to_buy_fee: Optional[float] = Field(default=None, ge=0)
    loaned_out_wage_contribution_pct: Optional[float] = Field(default=None, ge=0, le=100)

    # Transfermarkt
    transfermarkt_url: Optional[str] = None

    notes: str = ""


# Override response

class PlayerOverrideResponse(BaseModel):
    id: str
    player_id: str
    player_name: str
    club_id: str
    set_by_role: str
    set_by_user_id: str

    # Only shows the fields that were actually overridden
    name: Optional[str] = None
    full_name: Optional[str] = None
    age: Optional[int] = None
    nationality: Optional[str] = None
    position: Optional[str] = None
    transfer_value: Optional[float] = None
    annual_salary: Optional[float] = None
    contract_signing_date: Optional[date] = None
    contract_expiry_date: Optional[date] = None
    contract_expiry_year: Optional[int] = None
    contract_length_years: Optional[int] = None
    acquisition_fee: Optional[float] = None
    acquisition_year: Optional[int] = None
    is_on_loan: Optional[bool] = None
    loan_from_club: Optional[str] = None
    loan_end_date: Optional[date] = None
    loan_fee: Optional[float] = None
    loan_wage_contribution_pct: Optional[float] = None
    transfermarkt_url: Optional[str] = None
    notes: str = ""

    # Computed amortization shown in response for convenience
    annual_amortization: float = 0.0

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


SalaryOverrideRequest = PlayerOverrideRequest
SalaryOverrideResponse = PlayerOverrideResponse