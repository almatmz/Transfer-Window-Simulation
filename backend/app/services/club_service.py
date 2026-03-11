from __future__ import annotations

import logging
from datetime import datetime, date

from fastapi import HTTPException

from app.core.config import settings
from app.core.security import UserRole
from app.integrations.clients import api_football
from app.integrations.clients.groq_client import extract_player_financials
from app.integrations.scrapers.capology import (
    get_club_salaries, estimate_salary_by_position
)
from app.models.club import Club
from app.models.player import Player, Position
from app.models.user_revenue_override import UserRevenueOverride
from app.schemas.club import ClubResponse, ClubRevenueUpdate, ClubSearchResult

logger = logging.getLogger(__name__)

_NOW_YEAR = 2026


def _s(val) -> str:
    return str(val) if val is not None else ""


def _serialize(club: Club, user_revenue: float = 0.0) -> ClubResponse:
    """
    Serialize club. Revenue priority:
      1. official_annual_revenue (SD/Admin) — always wins, visible to all
      2. user_revenue (caller's personal override) — only for that user
      3. 0 — not configured
    """
    if club.official_annual_revenue > 0:
        revenue = club.official_annual_revenue
        source = "official"
    elif user_revenue > 0:
        revenue = user_revenue
        source = "user_override"
    else:
        revenue = 0.0
        source = "none"

    return ClubResponse(
        id=str(club.id),
        api_football_id=club.api_football_id,
        name=_s(club.name),
        short_name=_s(club.short_name),
        country=_s(club.country),
        league=_s(club.league),
        logo_url=_s(club.logo_url),
        season_year=club.season_year,
        annual_revenue=revenue,
        revenue_configured=club.revenue_configured or user_revenue > 0,
        revenue_source=source,
        last_synced_at=club.last_synced_at,
    )


async def _get_user_revenue(user_id: str, club_api_id: int) -> float:
    """Get this user's personal revenue override for a club. Returns 0 if none."""
    rec = await UserRevenueOverride.find_one(
        UserRevenueOverride.user_id == user_id,
        UserRevenueOverride.club_api_football_id == club_api_id,
    )
    return rec.annual_revenue if rec else 0.0


async def get_effective_revenue(
    club: Club,
    user_id: str | None,
) -> float:
    """
    Returns the revenue to use for FFP calculations for a specific user.

    Priority:
      1. Official revenue (SD/Admin) → used for everyone
      2. User's personal override    → only for that user
      3. 0                           → not configured
    """
    if club.official_annual_revenue > 0:
        return club.official_annual_revenue
    if user_id:
        return await _get_user_revenue(user_id, club.api_football_id)
    return 0.0


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


async def get_or_sync_club(
    api_football_id: int,
    season: int = 2025,
    viewer_id: str | None = None,
) -> ClubResponse:
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

    user_rev = await _get_user_revenue(viewer_id, club.api_football_id) if viewer_id else 0.0
    return _serialize(club, user_rev)


async def sync_squad(club: Club, season: int = 2025) -> int:
    squad_raw = await api_football.get_squad(club.api_football_id, season)
    if not squad_raw:
        return 0

    salary_map = await get_club_salaries(club.name, club.league)
    capology_available = bool(salary_map)

    synced = 0
    for raw in squad_raw:
        api_id = raw.get("api_football_id")
        if not api_id:
            continue

        name = _s(raw.get("name"))
        position_str = _s(raw.get("position"))
        position = _map_position(position_str)
        age = raw.get("age") or 0
        nationality = _s(raw.get("nationality"))

        contract_expiry_year: int = 0
        contract_length_years: int = 0
        contract_signing_date = None
        raw_contract = raw.get("contract") or {}
        if isinstance(raw_contract, dict):
            contract_end = raw_contract.get("end") or ""
            if contract_end and len(str(contract_end)) >= 4:
                try:
                    contract_expiry_year = int(str(contract_end)[:4])
                except (ValueError, TypeError):
                    pass
            contract_start = raw_contract.get("start") or ""
            if contract_start and len(str(contract_start)) >= 4:
                try:
                    start_year = int(str(contract_start)[:4])
                    if contract_expiry_year > start_year:
                        contract_length_years = contract_expiry_year - start_year
                    try:
                        contract_signing_date = date.fromisoformat(str(contract_start))
                    except Exception:
                        pass
                except (ValueError, TypeError):
                    pass

        salary: float = 0.0
        salary_source = "position_estimate"
        if capology_available:
            salary = salary_map.get(name.lower(), 0.0)
            if salary > 0:
                salary_source = "capology_estimate"

        transfer_value: float = raw.get("transfer_value") or 0.0
        acquisition_fee: float = 0.0
        acquisition_year: int = 0

        needs_ai = (
            salary == 0.0
            or contract_expiry_year == 0
            or not nationality
            or transfer_value == 0.0
        )
        if needs_ai:
            ai_data = await extract_player_financials(
                name=name, club=club.name, league=club.league,
                position=position_str or "UNKNOWN", age=age,
            )
            if ai_data:
                if salary == 0.0 and ai_data.get("annual_salary_eur"):
                    salary = float(ai_data["annual_salary_eur"])
                    salary_source = "groq_estimate"
                if contract_expiry_year == 0 and ai_data.get("contract_expiry_year"):
                    contract_expiry_year = int(ai_data["contract_expiry_year"])
                if contract_length_years == 0 and ai_data.get("contract_length_years"):
                    contract_length_years = int(ai_data["contract_length_years"])
                if not contract_signing_date and ai_data.get("contract_signing_date"):
                    try:
                        contract_signing_date = date.fromisoformat(ai_data["contract_signing_date"])
                    except Exception:
                        pass
                if transfer_value == 0.0 and ai_data.get("transfer_value_eur"):
                    transfer_value = float(ai_data["transfer_value_eur"])
                if ai_data.get("transfer_fee_eur"):
                    acquisition_fee = float(ai_data["transfer_fee_eur"])
                if not nationality and ai_data.get("nationality"):
                    nationality = _s(ai_data["nationality"])

        if not acquisition_year and contract_signing_date:
            acquisition_year = contract_signing_date.year
        elif not acquisition_year and contract_expiry_year and contract_length_years:
            acquisition_year = contract_expiry_year - contract_length_years

        if salary == 0.0:
            salary = estimate_salary_by_position(position_str, club.league)
            salary_source = "position_estimate"

        fields = {
            "name": name, "age": age, "nationality": nationality,
            "photo_url": _s(raw.get("photo_url")), "position": position,
            "club_id": str(club.id),
            "estimated_annual_salary": salary, "salary_source": salary_source,
            "contract_expiry_year": contract_expiry_year,
            "contract_length_years": contract_length_years,
            "contract_signing_date": contract_signing_date,
            "transfer_value": transfer_value,
            "acquisition_fee": acquisition_fee,
            "acquisition_year": acquisition_year,
            "last_synced_at": datetime.utcnow(),
        }

        existing = await Player.find_one(Player.api_football_id == api_id)
        if existing:
            if existing.salary_source == "sd_override":
                fields.pop("estimated_annual_salary", None)
                fields.pop("salary_source", None)
            await existing.set(fields)
        else:
            player = Player(
                api_football_id=api_id,
                api_football_club_id=club.api_football_id,
                **fields,
            )
            await player.insert()
        synced += 1

    return synced


async def update_club_revenue(
    api_football_id: int,
    data: ClubRevenueUpdate,
    user_id: str,
    user_role: UserRole,
) -> ClubResponse:
    """
    Revenue update with strict role separation:

    ADMIN / SPORT_DIRECTOR:
      → Writes to Club.official_annual_revenue
      → This is the GLOBAL authoritative value everyone sees
      → Cannot be overridden by any user

    USER (authenticated):
      → Writes to UserRevenueOverride (their own private record)
      → Does NOT touch the Club document at all
      → Only they see this value
      → If official revenue is set, their override is IGNORED for FFP
        but still saved (so they can revisit it later if official changes)
    """
    club = await Club.find_one(Club.api_football_id == api_football_id)
    if not club:
        raise HTTPException(
            status_code=404,
            detail="Club not loaded. Search for it first via GET /api/v1/search/clubs",
        )

    is_official = user_role in (UserRole.ADMIN, UserRole.SPORT_DIRECTOR)

    if is_official:
        # Write to the club document — affects everyone
        await club.set({
            "official_annual_revenue": data.annual_revenue,
            "official_revenue_set_by": user_id,
            "official_revenue_season_year": data.season_year,
            "season_year": data.season_year,
        })
        await club.sync()
        return _serialize(club, 0.0)

    else:
        # Write to this user's private override record — never touches Club doc
        existing = await UserRevenueOverride.find_one(
            UserRevenueOverride.user_id == user_id,
            UserRevenueOverride.club_api_football_id == api_football_id,
        )
        now = datetime.utcnow()
        if existing:
            await existing.set({
                "annual_revenue": data.annual_revenue,
                "season_year": data.season_year,
                "updated_at": now,
            })
        else:
            override = UserRevenueOverride(
                user_id=user_id,
                club_api_football_id=api_football_id,
                annual_revenue=data.annual_revenue,
                season_year=data.season_year,
            )
            await override.insert()

        # Return club with this user's override shown
        return _serialize(club, data.annual_revenue)


def _map_position(pos: str) -> Position:
    return {
        "GK": Position.GK, "Goalkeeper": Position.GK,
        "CB": Position.CB, "Defender": Position.CB,
        "LB": Position.LB, "RB": Position.RB,
        "CDM": Position.CDM, "CM": Position.CM, "Midfielder": Position.CM,
        "CAM": Position.CAM,
        "LW": Position.LW, "RW": Position.RW, "Attacker": Position.RW,
        "CF": Position.CF, "ST": Position.ST, "Forward": Position.ST,
    }.get(pos, Position.UNKNOWN)