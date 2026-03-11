from fastapi import APIRouter, Depends, Query, HTTPException
from app.schemas.club import ClubResponse, ClubRevenueUpdate
from app.schemas.player import PlayerPublicResponse, PlayerSDResponse
from app.services import club_service, player_service
from app.core.deps import get_optional_user, require_sport_director, require_user
from app.models.user import User

router = APIRouter(prefix="/clubs", tags=["Clubs"])


@router.get(
    "/{api_football_id}",
    response_model=ClubResponse,
    summary="Get club profile",
)
async def get_club(api_football_id: int, season: int = Query(2025)):
    """No auth required. First call fetches from API-Football and syncs squad."""
    return await club_service.get_or_sync_club(api_football_id, season)


@router.get(
    "/{api_football_id}/squad",
    summary="Get club squad",
)
async def get_squad(
    api_football_id: int,
    viewer: User | None = Depends(get_optional_user),
):
    """
    Returns all squad players.
    - Anonymous / regular users: public salary estimates (Capology/Groq/position)
    - Sport Directors / Admins: SD override salaries + full amortization details
    """
    from app.models.club import Club
    club = await Club.find_one(Club.api_football_id == api_football_id)
    if not club:
        await club_service.get_or_sync_club(api_football_id)
        club = await Club.find_one(Club.api_football_id == api_football_id)
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")
    return await player_service.list_squad(str(club.id), viewer)


@router.patch(
    "/{api_football_id}/revenue",
    response_model=ClubResponse,
    summary="Set club annual revenue for FFP calculations",
    description="""
Set the club's annual revenue used for FFP Squad Cost Ratio and Break-Even calculations.

**Role behaviour:**
- **Admin / Sport Director** — sets the **official** authoritative revenue. Cannot be overridden by users.
- **Authenticated User** — may set a personal revenue estimate **only if** no official revenue has been configured by SD/Admin.

This allows users to experiment with FFP projections when official data is not yet set.
""",
)
async def update_revenue(
    api_football_id: int,
    body: ClubRevenueUpdate,
    user: User = Depends(require_user),   # any authenticated user can call this
):
    return await club_service.update_club_revenue(
        api_football_id, body, str(user.id), user.role
    )


@router.post(
    "/{api_football_id}/sync",
    summary="Force re-sync club squad — Sport Directors / Admins only",
)
async def force_sync(
    api_football_id: int,
    season: int = Query(2025),
    user: User = Depends(require_sport_director),
):
    from app.models.club import Club
    club = await Club.find_one(Club.api_football_id == api_football_id)
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")
    count = await club_service.sync_squad(club, season)
    return {"message": f"Synced {count} players", "club": club.name}