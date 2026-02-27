from datetime import datetime
from fastapi import HTTPException

from app.models.player import Player
from app.models.salary_override import SalaryOverride
from app.models.user import User
from app.schemas.player import (
    PlayerPublicResponse, PlayerSDResponse,
    SalaryOverrideRequest, SalaryOverrideResponse,
)
from app.core.security import UserRole


def _public(player: Player) -> PlayerPublicResponse:
    return PlayerPublicResponse(
        id=str(player.id),
        api_football_id=player.api_football_id,
        name=player.name,
        age=player.age,
        nationality=player.nationality,
        position=player.position,
        photo_url=player.photo_url,
        transfer_value=player.transfer_value,
        transfer_value_currency=player.transfer_value_currency,
        estimated_annual_salary=player.estimated_annual_salary,
        salary_source="capology_estimate",
        contract_expiry_year=player.contract_expiry_year,
        last_synced_at=player.last_synced_at,
    )


async def _sd_view(player: Player) -> PlayerSDResponse:
    override = await SalaryOverride.find_one(SalaryOverride.player_id == str(player.id))
    base = _public(player)
    return PlayerSDResponse(
        **base.model_dump(),
        override_annual_salary=override.annual_salary if override else None,
        override_contract_years=override.contract_length_years if override else None,
        override_acquisition_fee=override.acquisition_fee if override else None,
        has_override=override is not None,
    )


async def _find_player(api_football_id: int) -> Player:
    """Lookup by API-Football integer ID, not MongoDB ObjectId."""
    player = await Player.find_one(Player.api_football_id == api_football_id)
    if not player:
        raise HTTPException(
            status_code=404,
            detail=f"Player {api_football_id} not found. "
                   f"Load their club's squad first via GET /api/v1/clubs/{{club_id}}/squad"
        )
    return player


async def get_player_by_api_id(
    api_football_id: int, viewer: User | None
) -> PlayerPublicResponse | PlayerSDResponse:
    player = await _find_player(api_football_id)
    is_sd = viewer and viewer.role in (UserRole.SPORT_DIRECTOR, UserRole.ADMIN)
    return await _sd_view(player) if is_sd else _public(player)


async def list_squad(
    club_id: str, viewer: User | None
) -> list[PlayerPublicResponse | PlayerSDResponse]:
    players = await Player.find(Player.club_id == club_id).to_list()
    is_sd = viewer and viewer.role in (UserRole.SPORT_DIRECTOR, UserRole.ADMIN)
    if is_sd:
        return [await _sd_view(p) for p in players]
    return [_public(p) for p in players]


# ── Salary Overrides (Sport Directors only) ───────────────────────────────────

async def set_salary_override_by_api_id(
    api_football_id: int, data: SalaryOverrideRequest, setter: User
) -> SalaryOverrideResponse:
    player = await _find_player(api_football_id)
    existing = await SalaryOverride.find_one(SalaryOverride.player_id == str(player.id))
    now = datetime.utcnow()

    if existing:
        await existing.set({
            "annual_salary": data.annual_salary,
            "contract_length_years": data.contract_length_years,
            "contract_expiry_year": data.contract_expiry_year,
            "acquisition_fee": data.acquisition_fee,
            "acquisition_year": data.acquisition_year,
            "notes": data.notes,
            "set_by_user_id": str(setter.id),
            "updated_at": now,
        })
        override = existing
    else:
        override = SalaryOverride(
            player_id=str(player.id),
            club_id=player.club_id,
            set_by_user_id=str(setter.id),
            **data.model_dump(),
        )
        await override.insert()

    await player.set({"salary_source": "sd_override"})

    return SalaryOverrideResponse(
        id=str(override.id),
        player_id=override.player_id,
        club_id=override.club_id,
        annual_salary=override.annual_salary,
        contract_length_years=override.contract_length_years,
        contract_expiry_year=override.contract_expiry_year,
        acquisition_fee=override.acquisition_fee,
        notes=override.notes,
        updated_at=override.updated_at,
    )


async def delete_salary_override_by_api_id(api_football_id: int, requester: User) -> dict:
    player = await _find_player(api_football_id)
    override = await SalaryOverride.find_one(SalaryOverride.player_id == str(player.id))
    if not override:
        raise HTTPException(status_code=404, detail="No override found for this player")
    if str(override.set_by_user_id) != str(requester.id) and requester.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="You can only delete your own overrides")
    await override.delete()
    await player.set({"salary_source": "capology_estimate"})
    return {"message": "Salary override removed — reverted to Capology estimate"}