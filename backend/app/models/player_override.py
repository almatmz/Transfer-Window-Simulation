from __future__ import annotations

from beanie import Document
from pydantic import Field
from datetime import datetime, date
from typing import Optional


class PlayerOverride(Document):
    #  Who / what 
    player_id: str = Field(..., description="Reference to Player._id")
    club_id: str = Field(..., description="Reference to Club._id")
    set_by_user_id: str = Field(..., description="User._id who set this override")
    set_by_role: str = Field(..., description="'admin' | 'sport_director'")

    # Bio fields (all optional — None = don't override) 
    name: Optional[str] = None
    full_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    age: Optional[int] = None
    nationality: Optional[str] = None
    second_nationality: Optional[str] = None
    position: Optional[str] = None           # Position enum value as string
    photo_url: Optional[str] = None

    # Financial / market value
    transfer_value: Optional[float] = None
    transfer_value_currency: Optional[str] = None

    #  Salary 
    annual_salary: Optional[float] = Field(default=None, ge=0)

    #  Contract 
    contract_signing_date: Optional[date] = None
    contract_expiry_date: Optional[date] = None
    contract_expiry_year: Optional[int] = None
    contract_length_years: Optional[int] = None

    #  Transfer / acquisition 
    acquisition_fee: Optional[float] = None
    acquisition_year: Optional[int] = None

    #  Loan IN — player is on loan from another club 
    is_on_loan: Optional[bool] = None
    loan_from_club: Optional[str] = None
    loan_from_club_id: Optional[str] = None
    loan_start_date: Optional[date] = None
    loan_end_date: Optional[date] = None
    loan_fee: Optional[float] = None
    loan_option_to_buy: Optional[bool] = None
    loan_option_to_buy_fee: Optional[float] = None
    loan_wage_contribution_pct: Optional[float] = None  # % of wages THIS club pays

    #  Loan OUT — player has been sent to another club on loan 
    loaned_out: Optional[bool] = None
    loaned_out_to_club: Optional[str] = None
    loaned_out_to_club_id: Optional[str] = None
    loaned_out_start_date: Optional[date] = None
    loaned_out_end_date: Optional[date] = None
    loaned_out_fee: Optional[float] = None
    loaned_out_option_to_buy: Optional[bool] = None
    loaned_out_option_to_buy_fee: Optional[float] = None
    loaned_out_wage_contribution_pct: Optional[float] = None  # % receiving club pays

    #  Transfermarkt 
    transfermarkt_url: Optional[str] = None
    transfermarkt_id: Optional[str] = None

    notes: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "player_overrides"
        indexes = [
            "player_id",
            "set_by_user_id",
            "set_by_role",
            "club_id",
        ]