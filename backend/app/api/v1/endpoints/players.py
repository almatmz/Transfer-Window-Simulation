from fastapi import APIRouter, Depends
from app.schemas.player import SalaryOverrideRequest, SalaryOverrideResponse
from app.services import player_service
from app.core.deps import get_optional_user, require_sport_director
from app.models.user import User

router = APIRouter(prefix="/players", tags=["Players"])


@router.get(
    "/{api_football_id}",
    summary="Get player by API-Football ID",
    description=(
        "Use the `api_football_id` shown in the squad list (e.g. 984, 276).\n\n"
        "Regular users see the Capology salary estimate. "
        "Sport Directors / Admins also see their private salary override if one is set."
    ),
)
async def get_player(
    api_football_id: int,
    viewer: User | None = Depends(get_optional_user),
):
    return await player_service.get_player_by_api_id(api_football_id, viewer)


@router.put(
    "/{api_football_id}/salary-override",
    response_model=SalaryOverrideResponse,
    summary="Set real salary — Sport Directors / Admins only",
    description="Private. Never shown to regular users. Powers accurate FFP simulations.",
)
async def set_salary_override(
    api_football_id: int,
    body: SalaryOverrideRequest,
    user: User = Depends(require_sport_director),
):
    return await player_service.set_salary_override_by_api_id(api_football_id, body, user)


@router.delete(
    "/{api_football_id}/salary-override",
    summary="Remove salary override — reverts to Capology estimate",
)
async def delete_salary_override(
    api_football_id: int,
    user: User = Depends(require_sport_director),
):
    return await player_service.delete_salary_override_by_api_id(api_football_id, user)