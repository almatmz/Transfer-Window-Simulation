from fastapi import APIRouter, Depends, Query
from app.schemas.club import ClubResponse, ClubRevenueUpdate
from app.schemas.player import PlayerPublicResponse, PlayerSDResponse
from app.services import club_service, player_service
from app.core.deps import get_optional_user, require_sport_director
from app.models.user import User

router = APIRouter(prefix="/clubs", tags=["Clubs"])


@router.get(
    "/{api_football_id}",
    response_model=ClubResponse,
    summary="Get club profile — fetches and caches from API-Football if not yet loaded",
)
async def get_club(api_football_id: int, season: int = Query(2024)):
    """No auth required. First call fetches from API-Football and syncs squad."""
    return await club_service.get_or_sync_club(api_football_id, season)


@router.get(
    "/{api_football_id}/squad",
    summary="Get club squad — public data for all, salary overrides visible to Sport Directors",
)
async def get_squad(
    api_football_id: int,
    viewer: User | None = Depends(get_optional_user),
):
    """
    Returns all squad players.
    - Regular users / anonymous: Capology salary estimates
    - Sport Directors / Admins: Override salaries shown if set
    """
    from app.models.club import Club
    club = await Club.find_one(Club.api_football_id == api_football_id)
    if not club:
        # Trigger sync first
        await club_service.get_or_sync_club(api_football_id)
        club = await Club.find_one(Club.api_football_id == api_football_id)
    return await player_service.list_squad(str(club.id), viewer)


@router.patch(
    "/{api_football_id}/revenue",
    response_model=ClubResponse,
    summary="Set club annual revenue — Sport Directors / Admins only",
    description="Revenue is needed for FFP calculations. Only sport directors with club access can set this.",
)
async def update_revenue(
    api_football_id: int,
    body: ClubRevenueUpdate,
    user: User = Depends(require_sport_director),
):
    return await club_service.update_club_revenue(api_football_id, body, str(user.id))


@router.post(
    "/{api_football_id}/sync",
    summary="Force re-sync club squad from API-Football — Sport Directors / Admins only",
)
async def force_sync(
    api_football_id: int,
    season: int = Query(2024),
    user: User = Depends(require_sport_director),
):
    from app.models.club import Club
    club = await Club.find_one(Club.api_football_id == api_football_id)
    if not club:
        raise ValueError("Club not found")
    count = await club_service.sync_squad(club, season)
    return {"message": f"Synced {count} players", "club": club.name}