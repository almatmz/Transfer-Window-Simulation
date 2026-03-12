"""
squad_override_service.py

Builds the "effective squad" for a given club, season, and viewer.

Effective squad = base squad (DB players, expired contracts removed)
               + Admin SquadOverrides      (visible to all)
               + Viewer's own SD overrides (visible only to that SD)
"""
from __future__ import annotations

import logging
from datetime import date

from app.models.club import Club
from app.models.player import Player
from app.models.squad_override import SquadOverride, OverrideAction

logger = logging.getLogger(__name__)


def _player_to_dict(p: Player) -> dict:
    """Serialize a Player document to a plain dict for the squad response."""
    return {
        "id": str(p.id),
        "api_football_id": p.api_football_id,
        "name": p.name,
        "full_name": p.full_name,
        "age": p.age,
        "date_of_birth": p.date_of_birth.isoformat() if p.date_of_birth else None,
        "nationality": p.nationality,
        "position": p.position,
        "photo_url": p.photo_url,
        "transfer_value": p.transfer_value,
        "transfer_value_currency": p.transfer_value_currency,
        "estimated_annual_salary": p.estimated_annual_salary,
        "salary_source": p.salary_source,
        "contract_expiry_year": p.contract_expiry_year,
        "contract_expiry_date": (
            p.contract_expiry_date.isoformat() if p.contract_expiry_date else None
        ),
        "contract_length_years": p.contract_length_years,
        "contract_signing_date": (
            p.contract_signing_date.isoformat() if p.contract_signing_date else None
        ),
        "is_on_loan": p.is_on_loan,
        "loan_from_club": p.loan_from_club,
        "loan_end_date": p.loan_end_date.isoformat() if p.loan_end_date else None,
        "acquisition_fee": p.acquisition_fee,
        "transfermarkt_url": p.transfermarkt_url,
        "source": "db",
    }


def _override_to_dict(ov: SquadOverride) -> dict:
    """Serialize a SquadOverride (ADD action) to a player-like dict."""
    return {
        "id": str(ov.id),
        "api_football_id": ov.api_football_player_id,
        "name": ov.player_name,
        "full_name": ov.player_name,
        "age": ov.age,
        "date_of_birth": None,
        "nationality": ov.nationality,
        "position": ov.position,
        "photo_url": ov.photo_url,
        "transfer_value": ov.transfer_value,
        "transfer_value_currency": "EUR",
        "estimated_annual_salary": ov.annual_salary,
        "salary_source": "squad_override",
        "contract_expiry_year": ov.contract_expiry_year,
        "contract_expiry_date": None,
        "contract_length_years": ov.contract_length_years,
        "contract_signing_date": (
            ov.contract_signing_date.isoformat()
            if ov.contract_signing_date
            else None
        ),
        "is_on_loan": ov.is_on_loan,
        "loan_from_club": ov.loan_from_club,
        "loan_end_date": ov.loan_end_date.isoformat() if ov.loan_end_date else None,
        "acquisition_fee": ov.acquisition_fee,
        "transfermarkt_url": None,
        "source": f"override:{ov.set_by_role}",
    }


async def get_effective_squad(
    club_api_football_id: int,
    view_season: int,
    viewer_id: str | None,
    viewer_role: str,
) -> dict:
    """
    Returns the effective squad for a given season and viewer.

    Algorithm:
      1. Resolve club MongoDB _id from api_football_id.
      2. Load all non-sold players for this club using club_id string (reliable).
      3. Split into active / expired based on contract_expiry_year vs view_season.
      4. Apply Admin SquadOverrides (visible to all viewers).
      5. If viewer is Admin or SD: also apply their own SD SquadOverrides.
      6. Return merged squad + metadata.
    """

    #  1. Resolve club _id 
    club_doc = await Club.find_one(Club.api_football_id == club_api_football_id)
    if not club_doc:
        return {
            "players": [],
            "expired_contracts": [],
            "admin_additions": [],
            "admin_removals": [],
            "sd_additions": [],
            "sd_removals": [],
            "season_year": view_season,
        }
    club_id_str = str(club_doc.id)

    #  2. Load players by club_id string (always reliably set)
    all_players = await Player.find(
        Player.club_id == club_id_str,
        Player.is_sold == False,  # noqa: E712
    ).to_list()

    #  3. Split active vs expired 
    active: list[dict] = []
    expired: list[dict] = []

    for p in all_players:
        if p.contract_expiry_year > 0 and p.contract_expiry_year < view_season:
            expired.append(_player_to_dict(p))
        else:
            active.append(_player_to_dict(p))

    # 4. Admin SquadOverrides (visible to everyone)
    admin_overrides = await SquadOverride.find(
        SquadOverride.club_api_football_id == club_api_football_id,
        SquadOverride.set_by_role == "admin",
        SquadOverride.season_year == view_season,
        SquadOverride.is_active == True,  # noqa: E712
    ).to_list()

    admin_additions: list[dict] = []
    admin_removals: list[int] = []

    for ov in admin_overrides:
        if ov.action == OverrideAction.REMOVE and ov.api_football_player_id:
            admin_removals.append(ov.api_football_player_id)
        elif ov.action == OverrideAction.ADD:
            admin_additions.append(_override_to_dict(ov))

    active = [p for p in active if p.get("api_football_id") not in admin_removals]
    active.extend(admin_additions)

    #  5. Viewer's own SD overrides (Admin / SD viewers only)
    sd_additions: list[dict] = []
    sd_removals: list[int] = []

    can_see_own_sd = viewer_role in ("admin", "sport_director") and viewer_id

    if can_see_own_sd:
        sd_overrides = await SquadOverride.find(
            SquadOverride.club_api_football_id == club_api_football_id,
            SquadOverride.set_by_user_id == viewer_id,
            SquadOverride.season_year == view_season,
            SquadOverride.is_active == True,  # noqa: E712
        ).to_list()

        for ov in sd_overrides:
            if ov.set_by_role == "admin":
                continue  # already applied above
            if ov.action == OverrideAction.REMOVE and ov.api_football_player_id:
                sd_removals.append(ov.api_football_player_id)
            elif ov.action == OverrideAction.ADD:
                sd_additions.append(_override_to_dict(ov))

        active = [p for p in active if p.get("api_football_id") not in sd_removals]
        active.extend(sd_additions)

    return {
        "players": active,
        "expired_contracts": expired,
        "admin_additions": admin_additions,
        "admin_removals": admin_removals,
        "sd_additions": sd_additions,
        "sd_removals": sd_removals,
        "season_year": view_season,
    }