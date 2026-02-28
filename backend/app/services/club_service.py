"""
Club service — data comes from API-Football, cached in MongoDB.
Salary data: Capology (primary) → position-based estimate (fallback) → 0 (last resort)
"""

from datetime import datetime
from fastapi import HTTPException
from app.models.club import Club
from app.models.player import Player, Position
from app.schemas.club import ClubResponse, ClubSearchResult, ClubRevenueUpdate
from app.integrations.clients import api_football
from app.integrations.scrapers.capology import (
    get_club_salaries, estimate_salary_by_position
)


def _s(val) -> str:
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
    club = await Club.find_one(Club.api_football_id == api_football_id)
    if not club:
        raw = await api_football.get_club_by_id(api_football_id)
        if not raw:
            raise HTTPException(status_code=404, detail=f"Club {api_football_id} not found")
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
    Fetch squad from API-Football.
    Salary sources (in order):
      1. Capology scrape
      2. Position-based estimate (fallback — always provides a non-zero value)
    """
    squad_raw = await api_football.get_squad(club.api_football_id, season)
    if not squad_raw:
        return 0

    # Try Capology first
    salary_map = await get_club_salaries(club.name, club.league)
    capology_available = bool(salary_map)

    synced = 0
    for raw in squad_raw:
        api_id = raw.get("api_football_id")
        if not api_id:
            continue

        name = _s(raw.get("name"))
        position_str = _s(raw.get("position"))  # e.g. "GK", "CB", "CM"
        position = _map_position(position_str)

        # Salary resolution
        if capology_available:
            salary = salary_map.get(name.lower(), 0.0)
            salary_source = "capology_estimate"
        else:
            salary = 0.0
            salary_source = "capology_estimate"

        # Fallback: position estimate if still 0
        if salary == 0.0:
            salary = estimate_salary_by_position(position_str, club.league)
            salary_source = "position_estimate"

        existing = await Player.find_one(Player.api_football_id == api_id)
        if existing:
            await existing.set({
                "name": name,
                "age": raw.get("age") or 0,
                "photo_url": _s(raw.get("photo_url")),
                "position": position,
                "club_id": str(club.id),
                "estimated_annual_salary": salary,
                "salary_source": salary_source,
                "last_synced_at": datetime.utcnow(),
            })
        else:
            player = Player(
                api_football_id=api_id,
                club_id=str(club.id),
                api_football_club_id=club.api_football_id,
                name=name,
                age=raw.get("age") or 0,
                photo_url=_s(raw.get("photo_url")),
                position=position,
                estimated_annual_salary=salary,
                salary_source=salary_source,
            )
            await player.insert()
        synced += 1

    return synced


async def update_club_revenue(
    api_football_id: int, data: ClubRevenueUpdate, user_id: str
) -> ClubResponse:
    club = await Club.find_one(Club.api_football_id == api_football_id)
    if not club:
        raise HTTPException(
            status_code=404,
            detail="Club not loaded. Search for it first via GET /api/v1/search/clubs"
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