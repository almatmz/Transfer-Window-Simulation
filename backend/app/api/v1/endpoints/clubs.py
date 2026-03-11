from fastapi import APIRouter, Depends, Query, HTTPException
from app.schemas.club import ClubResponse, ClubRevenueUpdate
from app.services import club_service, player_service
from app.core.deps import get_optional_user, require_sport_director, require_user
from app.models.user import User

router = APIRouter(prefix="/clubs", tags=["Clubs"])


@router.get(
    "/{api_football_id}",
    response_model=ClubResponse,
    summary="Get club profile",
    description="""
Returns club profile. The `annual_revenue` field is personalised:
- **Admin/Sport Director** set revenue → shown to **everyone** (`revenue_source: official`)
- **You** have set a personal revenue override → shown only to **you** (`revenue_source: user_override`)
- Not configured → `annual_revenue: 0`, `revenue_source: none`
""",
)
async def get_club(
    api_football_id: int,
    season: int = Query(2025),
    viewer: User | None = Depends(get_optional_user),
):
    viewer_id = str(viewer.id) if viewer else None
    return await club_service.get_or_sync_club(api_football_id, season, viewer_id)


@router.get(
    "/{api_football_id}/squad",
    summary="Get club squad",
)
async def get_squad(
    api_football_id: int,
    viewer: User | None = Depends(get_optional_user),
):
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
    summary="Set revenue for FFP calculations",
    description="""
**Role behaviour — strictly isolated:**

| Role | What happens |
|------|-------------|
| **Admin / Sport Director** | Sets the **official** club revenue — visible to ALL users. Cannot be overridden by users. |
| **Authenticated User** | Saves a **personal** revenue estimate — stored only for you, invisible to others. If official revenue exists, yours is ignored in FFP but kept for your reference. |

This means users can freely experiment with different revenue assumptions
without polluting the data for others.
""",
)
async def update_revenue(
    api_football_id: int,
    body: ClubRevenueUpdate,
    user: User = Depends(require_user),
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