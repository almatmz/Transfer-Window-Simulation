from __future__ import annotations

import logging
from typing import Optional

from app.models.club import Club
from app.models.player import Player
from app.models.player_override import PlayerOverride
from app.models.squad_override import SquadOverride, OverrideAction
from app.models.loan_deal import LoanDeal

logger = logging.getLogger(__name__)



async def _get_admin_player_override(player_id: str) -> Optional[PlayerOverride]:
    return await PlayerOverride.find_one(
        PlayerOverride.player_id == player_id,
        PlayerOverride.set_by_role == "admin",
    )


async def _get_sd_player_override(
    player_id: str, viewer_id: str
) -> Optional[PlayerOverride]:
    return await PlayerOverride.find_one(
        PlayerOverride.player_id == player_id,
        PlayerOverride.set_by_user_id == viewer_id,
        PlayerOverride.set_by_role == "sport_director",
    )


# Player serializer with override 

def _player_to_dict(
    p: Player,
    admin_ov: Optional[PlayerOverride] = None,
    sd_ov: Optional[PlayerOverride] = None,
) -> dict:
    """
    Serialize a Player to dict, applying PlayerOverride priority:
      SD override > Admin override > raw DB values.
    Only non-None override fields replace the base value.
    """
    # Start with raw DB values
    data = {
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
        "loaned_out": getattr(p, "loaned_out", False),
        "loaned_out_to_club": getattr(p, "loaned_out_to_club", None),
        "loaned_out_end_date": (
            p.loaned_out_end_date.isoformat()
            if getattr(p, "loaned_out_end_date", None)
            else None
        ),
        "loan_option_to_buy": getattr(p, "loan_option_to_buy", False),
        "loan_option_to_buy_fee": getattr(p, "loan_option_to_buy_fee", None),
        "data_source": "db",
    }

    # Apply admin override (layer 2)
    if admin_ov:
        _apply_player_override(data, admin_ov, "admin_override")

    # Apply SD override (layer 1 — highest priority)
    if sd_ov:
        _apply_player_override(data, sd_ov, "sd_override")

    return data


def _apply_player_override(data: dict, ov: PlayerOverride, source_label: str) -> None:
    """Apply non-None fields from a PlayerOverride onto the data dict."""
    field_map = {
        "name": "name",
        "full_name": "full_name",
        "age": "age",
        "nationality": "nationality",
        "position": "position",
        "photo_url": "photo_url",
        "transfer_value": "transfer_value",
        "transfer_value_currency": "transfer_value_currency",
        "contract_expiry_year": "contract_expiry_year",
        "contract_length_years": "contract_length_years",
        "is_on_loan": "is_on_loan",
        "loan_from_club": "loan_from_club",
        "transfermarkt_url": "transfermarkt_url",
        "acquisition_fee": "acquisition_fee",
    }
    changed = False
    for ov_field, data_field in field_map.items():
        val = getattr(ov, ov_field, None)
        if val is not None:
            data[data_field] = val
            changed = True

    # Handle date fields (serialize to isoformat)
    if ov.date_of_birth is not None:
        data["date_of_birth"] = ov.date_of_birth.isoformat()
        changed = True
    if ov.contract_expiry_date is not None:
        data["contract_expiry_date"] = ov.contract_expiry_date.isoformat()
        changed = True
    if ov.contract_signing_date is not None:
        data["contract_signing_date"] = ov.contract_signing_date.isoformat()
        changed = True
    if ov.loan_end_date is not None:
        data["loan_end_date"] = ov.loan_end_date.isoformat()
        changed = True

    # annual_salary maps to estimated_annual_salary
    if ov.annual_salary is not None:
        data["estimated_annual_salary"] = ov.annual_salary
        data["salary_source"] = source_label
        changed = True

    if changed:
        data["data_source"] = source_label


def _override_to_dict(ov: SquadOverride) -> dict:
    """Serialize a SquadOverride ADD entry to a player-like dict."""
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
            ov.contract_signing_date.isoformat() if ov.contract_signing_date else None
        ),
        "is_on_loan": ov.is_on_loan,
        "loan_from_club": ov.loan_from_club,
        "loan_end_date": ov.loan_end_date.isoformat() if ov.loan_end_date else None,
        "acquisition_fee": ov.acquisition_fee,
        "transfermarkt_url": None,
        "data_source": f"squad_override:{ov.set_by_role}",
    }


# ─────────────────────── Main function ──────────────────────────────────────

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
      2. Load all non-sold players for this club using club_id string.
      3. For each player, load their PlayerOverrides (admin + SD if applicable).
      4. Serialize players with overrides applied.
      5. Split into active / expired based on MERGED contract_expiry_year.
      6. Apply SquadOverrides (add/remove entire players).
    """
    is_sd_viewer = viewer_role in ("admin", "sport_director") and viewer_id is not None

    # ── 1. Resolve club _id ──────────────────────────────────────────────────
    club_doc = await Club.find_one(Club.api_football_id == club_api_football_id)
    if not club_doc:
        return {
            "players": [], "expired_contracts": [],
            "admin_additions": [], "admin_removals": [],
            "sd_additions": [], "sd_removals": [],
            "season_year": view_season,
        }
    club_id_str = str(club_doc.id)

    # ── 2. Load players ──────────────────────────────────────────────────────
    all_players = await Player.find(
        Player.club_id == club_id_str,
        Player.is_sold == False,  # noqa: E712
    ).to_list()

    # ── 3 & 4. Serialize each player with PlayerOverrides applied ────────────
    active: list[dict] = []
    expired: list[dict] = []

    for p in all_players:
        player_id = str(p.id)

        # Load admin override (applies to everyone)
        admin_ov = await _get_admin_player_override(player_id)

        # Load SD's own override (applies only to SD/Admin viewers)
        sd_ov = None
        if is_sd_viewer:
            sd_ov = await _get_sd_player_override(player_id, viewer_id)

        merged = _player_to_dict(p, admin_ov, sd_ov)

        # ── 5. Split active vs expired using MERGED contract_expiry_year ────
        expiry = merged.get("contract_expiry_year") or 0
        if expiry > 0 and expiry < view_season:
            expired.append(merged)
        else:
            active.append(merged)

    # ── 6a. Admin SquadOverrides (add/remove whole players, visible to all) ──
    admin_squad_ovs = await SquadOverride.find(
        SquadOverride.club_api_football_id == club_api_football_id,
        SquadOverride.set_by_role == "admin",
        SquadOverride.season_year == view_season,
        SquadOverride.is_active == True,  # noqa: E712
    ).to_list()

    admin_additions: list[dict] = []
    admin_removals: list[int] = []

    for ov in admin_squad_ovs:
        if ov.action == OverrideAction.REMOVE and ov.api_football_player_id:
            admin_removals.append(ov.api_football_player_id)
        elif ov.action == OverrideAction.ADD:
            admin_additions.append(_override_to_dict(ov))

    active = [p for p in active if p.get("api_football_id") not in admin_removals]
    active.extend(admin_additions)

    # ── 6b. SD's own SquadOverrides (only for SD/Admin viewers) ─────────────
    sd_additions: list[dict] = []
    sd_removals: list[int] = []

    if is_sd_viewer:
        sd_squad_ovs = await SquadOverride.find(
            SquadOverride.club_api_football_id == club_api_football_id,
            SquadOverride.set_by_user_id == viewer_id,
            SquadOverride.season_year == view_season,
            SquadOverride.is_active == True,  # noqa: E712
        ).to_list()

        for ov in sd_squad_ovs:
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