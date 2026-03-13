from __future__ import annotations

from beanie import Document
from pydantic import Field
from datetime import datetime, date
from typing import Optional


class ContractExtension(Document):
    #  Identity 
    player_id: str = Field(..., description="Reference to Player._id")
    player_api_football_id: int
    club_id: str = Field(..., description="Reference to Club._id")
    club_api_football_id: int

    set_by_user_id: str
    set_by_role: str = Field(..., description="'admin' | 'sport_director'")

    #  Extension terms 
    new_contract_expiry_year: int = Field(..., ge=2025, le=2045)
    new_contract_length_years: int = Field(..., ge=1, le=10)
    new_annual_salary: Optional[float] = Field(
        default=None, ge=0,
        description="New salary after extension. None = keep current salary.",
    )
    extension_start_year: int = Field(
        ..., ge=2025, le=2045,
        description="Year from which the new terms take effect (usually current season)",
    )
    signing_bonus: float = Field(
        default=0.0, ge=0,
        description="One-off signing bonus — amortized over new contract length for FFP",
    )
    signing_bonus_amortization: float = Field(
        default=0.0,
        description="Computed: signing_bonus / new_contract_length_years",
    )

    notes: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "contract_extensions"
        indexes = [
            "player_id",
            "player_api_football_id",
            "club_id",
            "set_by_user_id",
            "set_by_role",
        ]