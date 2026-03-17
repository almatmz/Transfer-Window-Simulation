from fastapi import APIRouter, Depends, Query, HTTPException
from app.schemas.club import ClubResponse, ClubRevenueUpdate
from app.services import club_service
from app.services.squad_override_service import get_effective_squad
from app.core.deps import get_optional_user, require_sport_director, require_user
from app.models.user import User

router = APIRouter(prefix="/clubs", tags=["Clubs"])


@router.get(
    "/{api_football_id}",
    response_model=ClubResponse,
    summary="Get club profile",
    description="""
Returns club profile with personalised revenue:

| Viewer | Revenue shown |
|--------|--------------|
| **Guest** | Official revenue (if set by admin) or 0 |
| **User** | Their personal override (if set), else official, else 0 |
| **Admin/SD** | Official revenue they control |
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
    summary="Get club squad with optional season projection",
    description="""
Returns the **base squad** for a given season.

`view_season` (default: 2026): players whose contracts expired before this year
are moved to `expired_contracts`.

Players loaned IN from other clubs appear with `squad_loan_status: "loan_in"`.
Players loaned OUT appear with `squad_loan_status: "loan_out"` (still in squad).
""",
)
async def get_squad(
    api_football_id: int,
    view_season: int = Query(
        default=2026,
        description="Season year to project. Players with expired contracts excluded.",
    ),
    viewer: User | None = Depends(get_optional_user),
):
    from app.models.club import Club
    club = await Club.find_one(Club.api_football_id == api_football_id)
    if not club:
        await club_service.get_or_sync_club(api_football_id)
        club = await Club.find_one(Club.api_football_id == api_football_id)
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")

    viewer_id   = str(viewer.id) if viewer else None
    viewer_role = viewer.role.value if viewer else "anonymous"

    squad_data = await get_effective_squad(
        club_api_football_id=api_football_id,
        view_season=view_season,
        viewer_id=viewer_id,
        viewer_role=viewer_role,
    )
    is_sd = viewer and viewer.role.value in ("admin", "sport_director")

    return {
        "club_id": str(club.id),
        "club_api_football_id": api_football_id,
        "club_name": club.name,
        "season_year": view_season,
        "players": squad_data["players"],
        "expired_contracts": squad_data["expired_contracts"],
        "total_players": len(squad_data["players"]),
        "admin_additions": squad_data["admin_additions"],
        "admin_removals": squad_data["admin_removals"],
        **({"sd_additions": squad_data["sd_additions"],
            "sd_removals": squad_data["sd_removals"]} if is_sd else {}),
        "data_sources": ["api_football", "capology", "apify_transfermarkt"],
    }


@router.patch(
    "/{api_football_id}/revenue",
    response_model=ClubResponse,
    summary="Set revenue for FFP calculations",
    description="""
Sets revenue for this club used in your FFP calculations.

| Role | Effect |
|------|--------|
| **Admin / Sport Director** | Sets **official** revenue — visible to everyone |
| **Authenticated User** | Saves a **personal** estimate — only visible to you. If official revenue exists, FFP uses official instead. |

Guests cannot set revenue.
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