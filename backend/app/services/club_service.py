from datetime import datetime
from fastapi import HTTPException
from app.models.club import Club
from app.models.player import Player, Position
from app.schemas.club import ClubResponse, ClubSearchResult, ClubRevenueUpdate
from app.integrations.clients import api_football
from app.integrations.scrapers.capology import get_club_salaries


def _s(val) -> str:
    """Safe string — None or missing becomes empty string."""
    return str(val) if val is not None else ""


def _serialize(club: Club) -> ClubResponse:
    return ClubResponse(
        id=str(club.id),
        api_football_id=club.api_football_id,
        name=_s(club.name),
        short_name=_s(club.short_name),
        country=_s(club.country),
        league=_s(club.league),
        logo_url=_s(club.logo_url),
        season_year=club.season_year,
        last_synced_at=club.last_synced_at,
    )


async def search_clubs(query: str, country: str = "") -> list[ClubSearchResult]:
    """Search clubs via API-Football /teams endpoint (free tier)."""
    results = await api_football.search_clubs(query, country)
    clubs = []
    for r in results:
        api_id = r.get("api_football_id")
        if not api_id:
            continue
        clubs.append(ClubSearchResult(
            api_football_id=api_id,
            name=_s(r.get("name")),
            short_name=_s(r.get("short_name")),
            country=_s(r.get("country")),   
            league="",                     
            logo_url=_s(r.get("logo_url")),
        ))
    return clubs


async def get_or_sync_club(api_football_id: int, season: int = 2024) -> ClubResponse:
    """
    Get club from MongoDB cache, or fetch from API-Football and cache it.
    Also syncs the full squad on first load.
    """
    club = await Club.find_one(Club.api_football_id == api_football_id)

    if not club:
        raw = await api_football.get_club_by_id(api_football_id)
        if not raw:
            raise HTTPException(status_code=404, detail=f"Club {api_football_id} not found in API-Football")

        club = Club(
            api_football_id=api_football_id,
            name=_s(raw.get("name")),
            short_name=_s(raw.get("short_name")),
            country=_s(raw.get("country")),
            league=_s(raw.get("league")),
            league_id=raw.get("league_id") or 0,
            logo_url=_s(raw.get("logo_url")),
            season_year=season,
        )
        await club.insert()
        await sync_squad(club, season)

    return _serialize(club)


async def sync_squad(club: Club, season: int = 2024) -> int:
    """
    Fetch squad from API-Football, enrich with Capology salary estimates,
    upsert into players collection. Returns count of players synced.
    """
    squad_raw = await api_football.get_squad(club.api_football_id, season)
    if not squad_raw:
        return 0

    salary_estimates = await get_club_salaries(club.name)

    synced = 0
    for raw in squad_raw:
        api_id = raw.get("api_football_id")
        if not api_id:
            continue

        est_salary = salary_estimates.get(_s(raw.get("name")).lower(), 0.0)

        existing = await Player.find_one(Player.api_football_id == api_id)
        if existing:
            await existing.set({
                "name": _s(raw.get("name")),
                "age": raw.get("age") or 0,
                "photo_url": _s(raw.get("photo_url")),
                "position": _map_position(_s(raw.get("position"))),
                "estimated_annual_salary": est_salary or existing.estimated_annual_salary,
                "last_synced_at": datetime.utcnow(),
            })
        else:
            player = Player(
                api_football_id=api_id,
                club_id=str(club.id),
                api_football_club_id=club.api_football_id,
                name=_s(raw.get("name")),
                age=raw.get("age") or 0,
                photo_url=_s(raw.get("photo_url")),
                position=_map_position(_s(raw.get("position"))),
                estimated_annual_salary=est_salary,
                salary_source="capology_estimate",
            )
            await player.insert()
        synced += 1

    return synced


async def update_club_revenue(
    api_football_id: int, data: ClubRevenueUpdate, user_id: str
) -> ClubResponse:
    """Sport Directors / Admins only: set the club's revenue for FFP calculations."""
    club = await Club.find_one(Club.api_football_id == api_football_id)
    if not club:
        raise HTTPException(
            status_code=404,
            detail="Club not found — search for it first via GET /api/v1/search/clubs"
        )
    await club.set({
        "annual_revenue": data.annual_revenue,
        "season_year": data.season_year,
    })
    return _serialize(club)


def _map_position(pos: str) -> Position:
    return {
        "GK": Position.GK, "Goalkeeper": Position.GK,
        "CB": Position.CB, "Defender": Position.CB,
        "LB": Position.LB, "RB": Position.RB,
        "CDM": Position.CDM, "CM": Position.CM, "Midfielder": Position.CM,
        "CAM": Position.CAM,
        "LW": Position.LW, "RW": Position.RW,
        "CF": Position.CF, "ST": Position.ST,
        "Attacker": Position.ST, "Forward": Position.ST,
    }.get(pos, Position.UNKNOWN)