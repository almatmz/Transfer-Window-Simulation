from datetime import datetime
from fastapi import HTTPException

from app.core.config import settings
from app.core.security import UserRole
from app.models.player import Player
from app.models.salary_override import SalaryOverride
from app.models.user import User
from app.schemas.player import (
    PlayerPublicResponse,
    PlayerSDResponse,
    SalaryOverrideRequest,
    SalaryOverrideResponse,
)
from app.utils.amortization import (
    calculate_annual_amortization,
    remaining_book_value,
)

CURRENT_YEAR = settings.MAX_SIMULATION_FUTURE_YEARS  # re-use config year baseline
_NOW_YEAR = 2026


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
        salary_source=player.salary_source,
        contract_expiry_year=player.contract_expiry_year,
        contract_length_years=player.contract_length_years,
        last_synced_at=player.last_synced_at,
    )


async def _sd_view(player: Player) -> PlayerSDResponse:
    override = await SalaryOverride.find_one(SalaryOverride.player_id == str(player.id))
    base = _public(player)

    # Use override data if present, else player data for amortization
    if override:
        fee = override.acquisition_fee
        years = override.contract_length_years
        acq_year = override.acquisition_year or 0
    else:
        fee = player.acquisition_fee
        years = player.contract_length_years
        acq_year = player.acquisition_year or 0

    annual_amort = calculate_annual_amortization(fee, years)
    elapsed = (_NOW_YEAR - acq_year) if acq_year else 0
    rbv = remaining_book_value(fee, years, elapsed) if acq_year else None

    return PlayerSDResponse(
        **base.model_dump(),
        override_annual_salary=override.annual_salary if override else None,
        override_contract_years=override.contract_length_years if override else None,
        override_contract_expiry_year=override.contract_expiry_year if override else None,
        override_acquisition_fee=override.acquisition_fee if override else None,
        override_acquisition_year=override.acquisition_year if override else None,
        override_contract_signing_date=override.contract_signing_date if override else None,
        has_override=override is not None,
        annual_amortization=annual_amort if fee > 0 else None,
        remaining_book_value=rbv,
        seasons_elapsed=elapsed if acq_year else None,
    )


async def _find_player(api_football_id: int) -> Player:
    player = await Player.find_one(Player.api_football_id == api_football_id)
    if not player:
        raise HTTPException(
            status_code=404,
            detail=f"Player {api_football_id} not found. "
                   f"Load their club's squad first via GET /api/v1/clubs/{{club_id}}/squad",
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


# ── Salary Overrides (Sport Directors + Admins only) ─────────────────────────

async def set_salary_override_by_api_id(
    api_football_id: int, data: SalaryOverrideRequest, setter: User
) -> SalaryOverrideResponse:
    player = await _find_player(api_football_id)
    existing = await SalaryOverride.find_one(SalaryOverride.player_id == str(player.id))
    now = datetime.utcnow()

    annual_amort = calculate_annual_amortization(
        data.acquisition_fee, data.contract_length_years
    )

    if existing:
        await existing.set({
            "annual_salary": data.annual_salary,
            "contract_length_years": data.contract_length_years,
            "contract_expiry_year": data.contract_expiry_year,
            "contract_signing_date": data.contract_signing_date,
            "acquisition_fee": data.acquisition_fee,
            "acquisition_year": data.acquisition_year,
            "notes": data.notes,
            "set_by_user_id": str(setter.id),
            "updated_at": now,
        })
        override = existing
        await override.sync()
    else:
        override = SalaryOverride(
            player_id=str(player.id),
            club_id=player.club_id,
            set_by_user_id=str(setter.id),
            **data.model_dump(),
        )
        await override.insert()

    # Update player's salary_source flag & contract fields
    await player.set({
        "salary_source": "sd_override",
        "contract_expiry_year": data.contract_expiry_year,
        "contract_length_years": data.contract_length_years,
        "contract_signing_date": data.contract_signing_date,
        "acquisition_fee": data.acquisition_fee,
        "acquisition_year": data.acquisition_year,
    })

    return SalaryOverrideResponse(
        id=str(override.id),
        player_id=override.player_id,
        club_id=override.club_id,
        annual_salary=override.annual_salary,
        contract_length_years=override.contract_length_years,
        contract_expiry_year=override.contract_expiry_year,
        contract_signing_date=override.contract_signing_date,
        acquisition_fee=override.acquisition_fee,
        acquisition_year=override.acquisition_year,
        annual_amortization=annual_amort,
        notes=override.notes,
        updated_at=override.updated_at,
    )