from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import HTTPException

from app.core.security import UserRole
from app.models.player import Player, Position
from app.models.player_override import PlayerOverride
from app.models.user import User
from app.schemas.player import (
    PlayerPublicResponse,
    PlayerSDResponse,
    PlayerOverrideRequest,
    PlayerOverrideResponse,
)
from app.utils.amortization import (
    calculate_annual_amortization,
    remaining_book_value,
)

_NOW_YEAR = 2026


#Override loader helpers 

async def _get_admin_override(player_id: str) -> Optional[PlayerOverride]:
    """Returns the single Admin override for a player, or None."""
    return await PlayerOverride.find_one(
        PlayerOverride.player_id == player_id,
        PlayerOverride.set_by_role == "admin",
    )


async def _get_sd_override(player_id: str, user_id: str) -> Optional[PlayerOverride]:
    """Returns this SD's own override for a player, or None."""
    return await PlayerOverride.find_one(
        PlayerOverride.player_id == player_id,
        PlayerOverride.set_by_user_id == user_id,
        PlayerOverride.set_by_role == "sport_director",
    )


# Merge helper 

def _merge(player: Player, admin_ov: Optional[PlayerOverride], sd_ov: Optional[PlayerOverride]) -> dict:
    """
    Build the merged player data dict applying override priority.
    Priority: SD override > Admin override > raw DB Player fields.
    Only non-None override fields replace the base value.
    """
    # Start with raw DB values
    data = {
        "name": player.name,
        "full_name": player.full_name,
        "date_of_birth": player.date_of_birth,
        "age": player.age,
        "nationality": player.nationality,
        "position": player.position,
        "photo_url": player.photo_url,
        "transfer_value": player.transfer_value,
        "transfer_value_currency": player.transfer_value_currency,
        "annual_salary": player.estimated_annual_salary,
        "salary_source": player.salary_source,
        "contract_signing_date": player.contract_signing_date,
        "contract_expiry_date": player.contract_expiry_date,
        "contract_expiry_year": player.contract_expiry_year,
        "contract_length_years": player.contract_length_years,
        "acquisition_fee": player.acquisition_fee,
        "acquisition_year": player.acquisition_year,
        "is_on_loan": player.is_on_loan,
        "loan_from_club": player.loan_from_club,
        "loan_from_club_id": player.loan_from_club_id,
        "loan_start_date": player.loan_start_date,
        "loan_end_date": player.loan_end_date,
        "loan_fee": player.loan_fee,
        "loan_wage_contribution_pct": None,
        "transfermarkt_url": player.transfermarkt_url,
        "data_source": "db",
    }

    # Apply admin override (layer 2)
    if admin_ov:
        for field in _override_fields():
            val = getattr(admin_ov, field, None)
            if val is not None:
                _apply_field(data, field, val)
        # annual_salary maps to estimated_annual_salary
        if admin_ov.annual_salary is not None:
            data["annual_salary"] = admin_ov.annual_salary
            data["salary_source"] = "admin_override"
        data["data_source"] = "admin_override"

    # Apply SD override (layer 1 — highest priority)
    if sd_ov:
        for field in _override_fields():
            val = getattr(sd_ov, field, None)
            if val is not None:
                _apply_field(data, field, val)
        if sd_ov.annual_salary is not None:
            data["annual_salary"] = sd_ov.annual_salary
            data["salary_source"] = "sd_override"
        data["data_source"] = "sd_override"

    return data


def _override_fields() -> list[str]:
    return [
        "name", "full_name", "date_of_birth", "age", "nationality", "position",
        "photo_url", "transfer_value", "transfer_value_currency",
        "contract_signing_date", "contract_expiry_date", "contract_expiry_year",
        "contract_length_years", "acquisition_fee", "acquisition_year",
        "is_on_loan", "loan_from_club", "loan_from_club_id", "loan_start_date",
        "loan_end_date", "loan_fee", "loan_wage_contribution_pct",
        "transfermarkt_url",
    ]


def _apply_field(data: dict, field: str, val) -> None:
    """Apply one override field, mapping override field names to data dict keys."""
    data[field] = val


#Serializers 

def _to_public(player: Player, merged: dict) -> PlayerPublicResponse:
    """Build the public response from a merged data dict."""
    pos = merged["position"]
    # Ensure position is always a valid Position enum value
    if isinstance(pos, str):
        try:
            pos = Position(pos)
        except ValueError:
            pos = Position.UNKNOWN

    return PlayerPublicResponse(
        id=str(player.id),
        api_football_id=player.api_football_id,
        name=merged["name"],
        full_name=merged["full_name"] or "",
        age=merged["age"] or 0,
        date_of_birth=merged["date_of_birth"],
        nationality=merged["nationality"] or "",
        position=pos,
        photo_url=merged["photo_url"] or "",
        transfer_value=merged["transfer_value"] or 0.0,
        transfer_value_currency=merged["transfer_value_currency"] or "EUR",
        estimated_annual_salary=merged["annual_salary"] or 0.0,
        salary_source=merged["salary_source"],
        contract_expiry_year=merged["contract_expiry_year"] or 0,
        contract_length_years=merged["contract_length_years"] or 0,
        contract_signing_date=merged["contract_signing_date"],
        contract_expiry_date=merged["contract_expiry_date"],
        is_on_loan=merged["is_on_loan"] or False,
        loan_from_club=merged["loan_from_club"],
        loan_end_date=merged["loan_end_date"],
        transfermarkt_url=merged["transfermarkt_url"],
        data_source=merged["data_source"],
        last_synced_at=player.last_synced_at,
    )


def _to_sd(
    player: Player,
    merged: dict,
    admin_ov: Optional[PlayerOverride],
    sd_ov: Optional[PlayerOverride],
) -> PlayerSDResponse:
    """Build the SD/Admin response with full override metadata."""
    base = _to_public(player, merged)

    # Compute amortization from merged values
    fee = merged.get("acquisition_fee") or 0.0
    years = merged.get("contract_length_years") or 0
    acq_year = merged.get("acquisition_year") or 0

    annual_amort = calculate_annual_amortization(fee, years) if fee > 0 and years > 0 else None
    elapsed = (_NOW_YEAR - acq_year) if acq_year else 0
    rbv = remaining_book_value(fee, years, elapsed) if (fee > 0 and years > 0 and acq_year) else None

    return PlayerSDResponse(
        **base.model_dump(),
        # Admin override metadata
        has_admin_override=admin_ov is not None,
        admin_override_id=str(admin_ov.id) if admin_ov else None,
        admin_annual_salary=admin_ov.annual_salary if admin_ov else None,
        admin_contract_expiry_year=admin_ov.contract_expiry_year if admin_ov else None,
        admin_contract_length_years=admin_ov.contract_length_years if admin_ov else None,
        admin_transfer_value=admin_ov.transfer_value if admin_ov else None,
        admin_is_on_loan=admin_ov.is_on_loan if admin_ov else None,
        admin_notes=admin_ov.notes if admin_ov else None,
        # SD override metadata
        has_sd_override=sd_ov is not None,
        sd_override_id=str(sd_ov.id) if sd_ov else None,
        sd_annual_salary=sd_ov.annual_salary if sd_ov else None,
        sd_contract_expiry_year=sd_ov.contract_expiry_year if sd_ov else None,
        sd_contract_length_years=sd_ov.contract_length_years if sd_ov else None,
        sd_transfer_value=sd_ov.transfer_value if sd_ov else None,
        sd_is_on_loan=sd_ov.is_on_loan if sd_ov else None,
        sd_notes=sd_ov.notes if sd_ov else None,
        # Computed
        annual_amortization=annual_amort,
        remaining_book_value=rbv,
        seasons_elapsed=elapsed if acq_year else None,
        # Loan details
        loan_fee=merged.get("loan_fee"),
        loan_from_club_id=merged.get("loan_from_club_id"),
        loan_start_date=merged.get("loan_start_date"),
        loan_wage_contribution_pct=merged.get("loan_wage_contribution_pct"),
    )



async def _find_player(api_football_id: int) -> Player:
    player = await Player.find_one(Player.api_football_id == api_football_id)
    if not player:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Player {api_football_id} not found. "
                "Load their club's squad first via GET /api/v1/clubs/{club_id}/squad"
            ),
        )
    return player


def _is_sd(viewer: User | None) -> bool:
    return viewer is not None and viewer.role in (UserRole.SPORT_DIRECTOR, UserRole.ADMIN)


async def get_player_by_api_id(
    api_football_id: int,
    viewer: User | None,
) -> PlayerPublicResponse | PlayerSDResponse:
    player = await _find_player(api_football_id)
    player_id = str(player.id)

    admin_ov = await _get_admin_override(player_id)

    if _is_sd(viewer):
        sd_ov = await _get_sd_override(player_id, str(viewer.id))
        merged = _merge(player, admin_ov, sd_ov)
        return _to_sd(player, merged, admin_ov, sd_ov)
    else:
        # Regular users and guests only see admin override merged into base
        merged = _merge(player, admin_ov, None)
        return _to_public(player, merged)


async def list_squad(
    club_id: str,
    viewer: User | None,
) -> list[PlayerPublicResponse | PlayerSDResponse]:
    players = await Player.find(
        Player.club_id == club_id,
        Player.is_sold == False,  # noqa: E712
    ).to_list()

    if not players:
        return []

    is_sd = _is_sd(viewer)
    viewer_id = str(viewer.id) if viewer else None
    player_ids = [str(p.id) for p in players]

    # Bulk load admin overrides — 1 query for all players
    admin_ovs_list = await PlayerOverride.find(
        {"player_id": {"$in": player_ids}, "set_by_role": "admin"}
    ).to_list()
    admin_ov_map: dict[str, PlayerOverride] = {ov.player_id: ov for ov in admin_ovs_list}

    # Bulk load this SD's overrides — 1 query (only if SD/Admin)
    sd_ov_map: dict[str, PlayerOverride] = {}
    if is_sd and viewer_id:
        sd_ovs_list = await PlayerOverride.find(
            {"player_id": {"$in": player_ids}, "set_by_user_id": viewer_id, "set_by_role": "sport_director"}
        ).to_list()
        sd_ov_map = {ov.player_id: ov for ov in sd_ovs_list}

    result = []
    for player in players:
        pid = str(player.id)
        admin_ov = admin_ov_map.get(pid)

        if is_sd:
            sd_ov = sd_ov_map.get(pid)
            merged = _merge(player, admin_ov, sd_ov)
            result.append(_to_sd(player, merged, admin_ov, sd_ov))
        else:
            merged = _merge(player, admin_ov, None)
            result.append(_to_public(player, merged))

    return result


# Override CRUD 

async def set_player_override(
    api_football_id: int,
    data: PlayerOverrideRequest,
    setter: User,
) -> PlayerOverrideResponse:
    """
    Admin or SD sets a player override.

    Admin   → set_by_role = "admin" → one per player, last write wins
    SD      → set_by_role = "sport_director" → one per (player, user), private
    """
    player = await _find_player(api_football_id)
    player_id = str(player.id)
    now = datetime.utcnow()
    role = setter.role.value  # "admin" | "sport_director"

    # Admins always write to the single admin override slot
    # SDs write to their own private slot
    if role == "admin":
        existing = await _get_admin_override(player_id)
    else:
        existing = await _get_sd_override(player_id, str(setter.id))

    override_data = data.model_dump(exclude_unset=False)
    override_data["updated_at"] = now

    if existing:
        await existing.set(override_data)
        await existing.sync()
        override = existing
    else:
        override = PlayerOverride(
            player_id=player_id,
            club_id=player.club_id,
            set_by_user_id=str(setter.id),
            set_by_role=role,
            **override_data,
        )
        await override.insert()

    # Compute amortization for response
    fee = data.acquisition_fee or 0.0
    years = data.contract_length_years or 0
    annual_amort = calculate_annual_amortization(fee, years) if fee > 0 and years > 0 else 0.0

    return PlayerOverrideResponse(
        id=str(override.id),
        player_id=override.player_id,
        player_name=player.name,
        club_id=override.club_id,
        set_by_role=override.set_by_role,
        set_by_user_id=override.set_by_user_id,
        name=override.name,
        full_name=override.full_name,
        age=override.age,
        nationality=override.nationality,
        position=override.position,
        transfer_value=override.transfer_value,
        annual_salary=override.annual_salary,
        contract_signing_date=override.contract_signing_date,
        contract_expiry_date=override.contract_expiry_date,
        contract_expiry_year=override.contract_expiry_year,
        contract_length_years=override.contract_length_years,
        acquisition_fee=override.acquisition_fee,
        acquisition_year=override.acquisition_year,
        is_on_loan=override.is_on_loan,
        loan_from_club=override.loan_from_club,
        loan_end_date=override.loan_end_date,
        loan_fee=override.loan_fee,
        loan_wage_contribution_pct=override.loan_wage_contribution_pct,
        transfermarkt_url=override.transfermarkt_url,
        notes=override.notes,
        annual_amortization=annual_amort,
        created_at=override.created_at,
        updated_at=override.updated_at,
    )


async def delete_player_override(
    api_football_id: int,
    deleter: User,
) -> dict:
    """
    Delete YOUR override for a player.

    Admin   → deletes the admin override → everyone falls back to raw DB
    SD      → deletes their own SD override → they fall back to admin override (or raw DB)
    """
    player = await _find_player(api_football_id)
    player_id = str(player.id)
    role = deleter.role.value

    if role == "admin":
        override = await _get_admin_override(player_id)
    else:
        override = await _get_sd_override(player_id, str(deleter.id))

    if not override:
        raise HTTPException(
            status_code=404,
            detail="No override found to delete.",
        )

    await override.delete()

    fallback = "raw DB data"
    if role == "sport_director":
        admin_ov = await _get_admin_override(player_id)
        if admin_ov:
            fallback = "admin override"

    return {
        "message": f"Override deleted. You now see: {fallback}.",
        "player_api_football_id": api_football_id,
        "deleted_role": role,
    }


async def get_all_overrides_for_player(
    api_football_id: int,
    viewer: User,
) -> dict:
    """
    Returns all overrides for a player visible to this viewer.
    Admin sees both the admin override and all SD overrides.
    SD sees the admin override and their own SD override only.
    """
    player = await _find_player(api_football_id)
    player_id = str(player.id)
    role = viewer.role.value

    admin_ov = await _get_admin_override(player_id)
    result: dict = {
        "player_api_football_id": api_football_id,
        "player_name": player.name,
        "admin_override": _serialize_override(admin_ov, player.name) if admin_ov else None,
        "sd_overrides": [],
    }

    if role == "admin":
        # Admin sees ALL SD overrides
        all_sd = await PlayerOverride.find(
            PlayerOverride.player_id == player_id,
            PlayerOverride.set_by_role == "sport_director",
        ).to_list()
        result["sd_overrides"] = [_serialize_override(ov, player.name) for ov in all_sd]
    else:
        # SD sees only their own
        sd_ov = await _get_sd_override(player_id, str(viewer.id))
        if sd_ov:
            result["sd_overrides"] = [_serialize_override(sd_ov, player.name)]

    return result


def _serialize_override(ov: PlayerOverride, player_name: str) -> PlayerOverrideResponse:
    fee = ov.acquisition_fee or 0.0
    years = ov.contract_length_years or 0
    annual_amort = calculate_annual_amortization(fee, years) if fee > 0 and years > 0 else 0.0

    return PlayerOverrideResponse(
        id=str(ov.id),
        player_id=ov.player_id,
        player_name=player_name,
        club_id=ov.club_id,
        set_by_role=ov.set_by_role,
        set_by_user_id=ov.set_by_user_id,
        name=ov.name,
        full_name=ov.full_name,
        age=ov.age,
        nationality=ov.nationality,
        position=ov.position,
        transfer_value=ov.transfer_value,
        annual_salary=ov.annual_salary,
        contract_signing_date=ov.contract_signing_date,
        contract_expiry_date=ov.contract_expiry_date,
        contract_expiry_year=ov.contract_expiry_year,
        contract_length_years=ov.contract_length_years,
        acquisition_fee=ov.acquisition_fee,
        acquisition_year=ov.acquisition_year,
        is_on_loan=ov.is_on_loan,
        loan_from_club=ov.loan_from_club,
        loan_end_date=ov.loan_end_date,
        loan_fee=ov.loan_fee,
        loan_wage_contribution_pct=ov.loan_wage_contribution_pct,
        transfermarkt_url=ov.transfermarkt_url,
        notes=ov.notes,
        annual_amortization=annual_amort,
        created_at=ov.created_at,
        updated_at=ov.updated_at,
    )