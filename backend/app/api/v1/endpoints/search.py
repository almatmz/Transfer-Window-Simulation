from fastapi import APIRouter, Query
from app.schemas.club import ClubSearchResult
from app.services import club_service

router = APIRouter(prefix="/search", tags=["Search"])


@router.get(
    "/clubs",
    response_model=list[ClubSearchResult],
    summary="Search clubs by name — no auth required",
    description=(
        "Searches API-Football for clubs matching the query. "
        "Results are cached for 6 hours. Use the returned api_football_id "
        "to load the full club profile and squad via GET /clubs/{id}."
    ),
)
async def search_clubs(
    q: str = Query(..., min_length=2, description="Club name, e.g. 'Manchester' or 'Barcelona'"),
    country: str = Query("", description="Optional country filter, e.g. 'England'"),
):
    return await club_service.search_clubs(q, country)