"""
SquadOverride — lets Admin and Sport Directors add / remove players from a
club's base squad for a given season.

Visibility rules
────────────────
• Admin overrides   → visible to ALL users in the effective squad
• SD overrides      → visible ONLY to the SD who set them (private)
• Regular users     → 403 on POST / DELETE; GET /effective shows admin-only overrides
"""
from __future__ import annotations

from beanie import Document
from pydantic import Field
from datetime import datetime, date
from typing import Optional
from enum import Enum


class OverrideAction(str, Enum):
    ADD = "add"       # add a player to the squad
    REMOVE = "remove" # remove a player from the squad


class SquadOverride(Document):
    club_api_football_id: int = Field(
        ..., description="Which club's squad is being modified"
    )
    set_by_user_id: str = Field(
        ..., description="User._id of the Admin or Sport Director"
    )
    set_by_role: str = Field(..., description="admin | sport_director")

    action: OverrideAction

    # For REMOVE: api_football_player_id is sufficient.
    # For ADD: fill in the player info below (may be a real player from another
    #          club or a completely custom entry).
    api_football_player_id: Optional[int] = None
    player_name: str = ""
    position: str = "UNKNOWN"
    age: Optional[int] = None
    nationality: str = ""
    transfer_value: float = 0.0
    annual_salary: float = 0.0
    contract_signing_date: Optional[date] = None
    contract_expiry_year: int = 0
    contract_length_years: int = 0
    is_on_loan: bool = False
    loan_from_club: Optional[str] = None
    loan_end_date: Optional[date] = None
    acquisition_fee: float = 0.0
    photo_url: str = ""

    notes: str = ""
    season_year: int = 2026   # which season this override applies to
    is_active: bool = True    # soft-delete flag

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "squad_overrides"
        indexes = [
            "club_api_football_id",
            "set_by_user_id",
            "set_by_role",
            "action",
            "is_active",
        ]