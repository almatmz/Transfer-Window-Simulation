from __future__ import annotations

import logging
from typing import Optional

from app.models.club import Club
from app.models.player import Player
from app.models.player_override import PlayerOverride
from app.models.squad_override import SquadOverride, OverrideAction

logger = logging.getLogger(__name__)


#  Serializers 

def _player_to_dict(
    p: Player,
    admin_ov: Optional[PlayerOverride] = None,
    sd_ov: Optional[PlayerOverride] = None,
    loan_badge: Optional[str] = None,   # "loan_in" | "loan_out" | None
) -> dict:
    """
    Serialize a Player to dict applying PlayerOverride priority (SD > Admin > DB).
    Adds loan badge fields if the player is on loan in/out.
    """
    data = {
        "id": str(p.id),
        "api_football_id": p.api_football_id,
        "name": p.name,
        "full_name": getattr(p, "full_name", ""),
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
        # Loan OUT fields (player is at another club)
        "loaned_out": getattr(p, "loaned_out", False),
        "loaned_out_to_club": getattr(p, "loaned_out_to_club", None),
        "loaned_out_end_date": (
            getattr(p, "loaned_out_end_date", None).isoformat()
            if getattr(p, "loaned_out_end_date", None) else None
        ),
        "loan_option_to_buy": getattr(p, "loan_option_to_buy", False),
        "loan_option_to_buy_fee": getattr(p, "loan_option_to_buy_fee", None),
        "data_source": "db",
        # Loan badge — tells the frontend how to display this player
        "squad_loan_status": loan_badge,  # None | "loan_in" | "loan_out"
    }

    # Apply admin override
    if admin_ov:
        _apply_override(data, admin_ov, "admin_override")

    # Apply SD override (highest priority)
    if sd_ov:
        _apply_override(data, sd_ov, "sd_override")

    return data


def _apply_override(data: dict, ov: PlayerOverride, source_label: str) -> None:
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
        "acquisition_fee": "acquisition_fee",
        "transfermarkt_url": "transfermarkt_url",
        # Loan IN
        "is_on_loan": "is_on_loan",
        "loan_from_club": "loan_from_club",
        "loan_from_club_id": "loan_from_club_id",
        "loan_option_to_buy": "loan_option_to_buy",
        "loan_option_to_buy_fee": "loan_option_to_buy_fee",
        "loan_wage_contribution_pct": "loan_wage_contribution_pct",
        # Loan OUT
        "loaned_out": "loaned_out",
        "loaned_out_to_club": "loaned_out_to_club",
        "loaned_out_to_club_id": "loaned_out_to_club_id",
        "loaned_out_fee": "loaned_out_fee",
        "loaned_out_option_to_buy": "loaned_out_option_to_buy",
        "loaned_out_option_to_buy_fee": "loaned_out_option_to_buy_fee",
        "loaned_out_wage_contribution_pct": "loaned_out_wage_contribution_pct",
    }
    changed = False
    for ov_field, data_field in field_map.items():
        val = getattr(ov, ov_field, None)
        if val is not None:
            data[data_field] = val
            changed = True
    for date_field in (
        "date_of_birth", "contract_expiry_date", "contract_signing_date",
        "loan_start_date", "loan_end_date",
        "loaned_out_start_date", "loaned_out_end_date",
    ):
        val = getattr(ov, date_field, None)
        if val is not None:
            data[date_field] = val.isoformat()
            changed = True
    if ov.annual_salary is not None:
        data["estimated_annual_salary"] = ov.annual_salary
        data["salary_source"] = source_label
        changed = True
    if changed:
        data["data_source"] = source_label


def _override_to_dict(ov: SquadOverride) -> dict:
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
        "loaned_out": False,
        "loaned_out_to_club": None,
        "loaned_out_end_date": None,
        "squad_loan_status": None,
        "data_source": f"squad_override:{ov.set_by_role}",
    }


# Main function 

async def get_effective_squad(
    club_api_football_id: int,
    view_season: int,
    viewer_id: str | None,
    viewer_role: str,
) -> dict:
    """
    Returns effective squad for a club/season/viewer.

    LOAN INJECTION:
      - Finds players with Player.loaned_out_to_club_id == this club
      - Injects them with squad_loan_status="loan_in"
      - Players loaned OUT are kept in squad with squad_loan_status="loan_out"
    """
    is_sd = viewer_role in ("admin", "sport_director") and viewer_id is not None

    #  1. Resolve club 
    club_doc = await Club.find_one(Club.api_football_id == club_api_football_id)
    if not club_doc:
        return {
            "players": [], "expired_contracts": [],
            "admin_additions": [], "admin_removals": [],
            "sd_additions": [], "sd_removals": [],
            "season_year": view_season,
        }
    club_id_str = str(club_doc.id)

    #  2. Load own players
    own_players = await Player.find(
        Player.club_id == club_id_str,
        Player.is_sold == False,  # noqa: E712
    ).to_list()

    #  3. Find players loaned IN to this club 
    # SOURCE A: Players whose loaned_out_to_club_id matches this club
    #           (set directly on the Player document via loan deal or admin override)
    players_loaned_in_directly = await Player.find(
        Player.loaned_out_to_club_id == str(club_api_football_id),
        Player.is_sold == False,  # noqa: E712
    ).to_list()
    # Exclude players already in this club's own squad (avoid duplicates)
    own_player_ids_set = {str(p.id) for p in own_players}
    players_loaned_in_directly = [
        p for p in players_loaned_in_directly
        if str(p.id) not in own_player_ids_set
    ]

    # Loan status is determined solely from Player.loaned_out_to_club_id
    # (set when a loan is confirmed via PlayerOverride or admin action)
    loaned_in_players: list[Player] = players_loaned_in_directly

    # ── 4. Bulk load PlayerOverrides for ALL players (own + loaned-in) ───────
    all_player_ids = [str(p.id) for p in own_players + loaned_in_players]

    admin_ovs_raw = await PlayerOverride.find(
        {"player_id": {"$in": all_player_ids}, "set_by_role": "admin"}
    ).to_list()
    admin_ov_map = {ov.player_id: ov for ov in admin_ovs_raw}

    sd_ov_map: dict[str, PlayerOverride] = {}
    if is_sd and viewer_id:
        sd_ovs_raw = await PlayerOverride.find(
            {"player_id": {"$in": all_player_ids},
             "set_by_user_id": viewer_id,
             "set_by_role": "sport_director"}
        ).to_list()
        sd_ov_map = {ov.player_id: ov for ov in sd_ovs_raw}

    # 5. Serialize own players 
    active: list[dict] = []
    expired: list[dict] = []

    for p in own_players:
        pid = str(p.id)
        admin_ov = admin_ov_map.get(pid)
        sd_ov = sd_ov_map.get(pid) if is_sd else None

        # Determine loan badge for own players
        loaned_out = getattr(p, "loaned_out", False)
        loan_badge = "loan_out" if loaned_out else None

        merged = _player_to_dict(p, admin_ov, sd_ov, loan_badge=loan_badge)

        expiry = merged.get("contract_expiry_year") or 0
        if expiry > 0 and expiry < view_season:
            expired.append(merged)
        else:
            active.append(merged)

    #  6. Inject loaned-in players 
    for p in loaned_in_players:
        pid = str(p.id)
        admin_ov = admin_ov_map.get(pid)
        sd_ov = sd_ov_map.get(pid) if is_sd else None
        merged = _player_to_dict(p, admin_ov, sd_ov, loan_badge="loan_in")

        # Inject loan info from player's loaned_out fields
        merged["is_on_loan"] = True
        merged["loan_from_club"] = p.loan_from_club or getattr(p, "loaned_out_to_club", None)
        lo_end = getattr(p, "loaned_out_end_date", None)
        merged["loan_end_date"] = lo_end.isoformat() if lo_end else None
        pct = getattr(p, "loaned_out_wage_contribution_pct", 100.0)
        merged["loan_wage_contribution_pct"] = pct
        merged["loan_option_to_buy"] = getattr(p, "loaned_out_option_to_buy", False)
        merged["loan_option_to_buy_fee"] = getattr(p, "loaned_out_option_to_buy_fee", None)
        merged["estimated_annual_salary"] = p.estimated_annual_salary * pct / 100
        merged["salary_source"] = "loaned_in"

        lo_end_date = getattr(p, "loaned_out_end_date", None)
        loan_end_year = lo_end_date.year if lo_end_date else 0
        if loan_end_year > 0 and loan_end_year < view_season:
            expired.append(merged)
        else:
            active.append(merged)

    #  7. Admin SquadOverrides (add/remove whole players) 
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

    #  8. SD SquadOverrides 
    sd_additions: list[dict] = []
    sd_removals: list[int] = []

    if is_sd:
        sd_squad_ovs = await SquadOverride.find(
            SquadOverride.club_api_football_id == club_api_football_id,
            SquadOverride.set_by_user_id == viewer_id,
            SquadOverride.season_year == view_season,
            SquadOverride.is_active == True,  # noqa: E712
        ).to_list()

        for ov in sd_squad_ovs:
            if ov.set_by_role == "admin":
                continue
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