"""
club_service.py

Squad sync pipeline order (strict, faster sources first):
  1. API-Football  → squad list: names, positions, ages, basic contract
  2. Capology      → salary estimates  (scraped once per club)
  3. Apify TM      → enrich ALL players in ONE batch call
                     (market values, exact contract dates, loan status)
  4. Groq/Gemini   → ONLY for fields still missing after steps 1–3
                     (max 3 concurrent AI calls via semaphore)
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, date

from fastapi import HTTPException

from app.core.config import settings
from app.core.security import UserRole
from app.integrations.clients import api_football
from app.integrations.clients.groq_client import extract_player_financials
from app.integrations.clients.transfermarkt_client import (
    get_players_batch, extract_contract_data,
)
from app.integrations.scrapers.capology import (
    get_club_salaries, estimate_salary_by_position,
)
from app.models.club import Club
from app.models.player import Player, Position
from app.models.user_revenue_override import UserRevenueOverride
from app.schemas.club import ClubResponse, ClubRevenueUpdate, ClubSearchResult

logger = logging.getLogger(__name__)

_NOW_YEAR = 2026


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _s(val) -> str:
    return str(val) if val is not None else ""


def _serialize(club: Club, user_revenue: float = 0.0) -> ClubResponse:
    """
    Serialize club. Revenue priority:
      1. official_annual_revenue (SD/Admin) — always wins, visible to all
      2. user_revenue (caller's personal override)
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
    rec = await UserRevenueOverride.find_one(
        UserRevenueOverride.user_id == user_id,
        UserRevenueOverride.club_api_football_id == club_api_id,
    )
    return rec.annual_revenue if rec else 0.0


async def get_effective_revenue(club: Club, user_id: str | None) -> float:
    """
    Returns the revenue to use in FFP calculations for a specific user.
    Priority: official (SD/Admin) > personal override > 0
    """
    if club.official_annual_revenue > 0:
        return club.official_annual_revenue
    if user_id:
        return await _get_user_revenue(user_id, club.api_football_id)
    return 0.0


def _map_position(pos: str) -> Position:
    """
    Full mapping covering all Transfermarkt and API-Football position strings.
    """
    mapping: dict[str, Position] = {
        # Goalkeeper
        "GK": Position.GK,
        "Goalkeeper": Position.GK,
        # Defenders
        "CB": Position.CB,
        "Centre-Back": Position.CB,
        "Center-Back": Position.CB,
        "Defender": Position.CB,
        "Sweeper": Position.CB,
        "LB": Position.LB,
        "Left-Back": Position.LB,
        "Left Back": Position.LB,
        "Left Wing-Back": Position.LB,
        "WB": Position.LB,
        "RB": Position.RB,
        "Right-Back": Position.RB,
        "Right Back": Position.RB,
        "Right Wing-Back": Position.RB,
        # Midfielders
        "CDM": Position.CDM,
        "Defensive Midfield": Position.CDM,
        "CM": Position.CM,
        "Central Midfield": Position.CM,
        "Midfielder": Position.CM,
        "CAM": Position.CAM,
        "Attacking Midfield": Position.CAM,
        "LM": Position.LW,
        "Left Midfield": Position.LW,
        "RM": Position.RW,
        "Right Midfield": Position.RW,
        # Forwards / Wingers
        "LW": Position.LW,
        "Left Winger": Position.LW,
        "Left Wing": Position.LW,
        "RW": Position.RW,
        "Right Winger": Position.RW,
        "Right Wing": Position.RW,
        "CF": Position.CF,
        "Centre-Forward": Position.CF,
        "Center-Forward": Position.CF,
        "Second Striker": Position.CF,
        "ST": Position.ST,
        "Striker": Position.ST,
        "Forward": Position.ST,
        "Attacker": Position.ST,
    }
    return mapping.get(pos, Position.UNKNOWN)


# ──────────────────────────────────────────────────────────────────────────────
# Search / get club
# ──────────────────────────────────────────────────────────────────────────────

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
            raise HTTPException(
                status_code=404, detail=f"Club {api_football_id} not found"
            )
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

    user_rev = (
        await _get_user_revenue(viewer_id, club.api_football_id) if viewer_id else 0.0
    )
    return _serialize(club, user_rev)


# ──────────────────────────────────────────────────────────────────────────────
# Squad sync — main pipeline
# ──────────────────────────────────────────────────────────────────────────────

async def sync_squad(club: Club, season: int = 2025) -> int:
    """
    Full squad sync with 4-source pipeline:
      1. API-Football   – base squad
      2. Capology       – salary estimates  (concurrent with step 3)
      3. Apify TM       – market values, exact contract dates, loan status
      4. Groq/Gemini    – fill remaining gaps (concurrent, max 3 at a time)
    """

    # ── STEP 1: API-Football squad list ────────────────────────────────────
    squad_raw = await api_football.get_squad(club.api_football_id, season)
    if not squad_raw:
        return 0

    # ── Pre-load existing DB players so we have TM URLs for the batch call
    existing_players_map: dict[int, Player] = {}
    tm_urls: list[str] = []

    for raw in squad_raw:
        api_id = raw.get("api_football_id")
        if not api_id:
            continue
        existing = await Player.find_one(Player.api_football_id == api_id)
        if existing:
            existing_players_map[api_id] = existing
            if existing.transfermarkt_url:
                tm_urls.append(existing.transfermarkt_url)

    # ── STEP 2 + 3 run concurrently ─────────────────────────────────────────
    salary_map_task = asyncio.create_task(
        get_club_salaries(club.name, club.league)
    )
    apify_task = asyncio.create_task(
        get_players_batch(tm_urls) if tm_urls else _empty_list()
    )

    salary_map, apify_results = await asyncio.gather(salary_map_task, apify_task)
    capology_available = bool(salary_map)

    # Index Apify results for O(1) lookup
    apify_by_url: dict[str, dict] = {}
    apify_by_name: dict[str, dict] = {}
    if apify_results:
        items = apify_results if isinstance(apify_results, list) else [apify_results]
        for item in items:
            if item.get("profileUrl"):
                apify_by_url[item["profileUrl"]] = item
            if item.get("playerName"):
                apify_by_name[item["playerName"].lower()] = item

    # ── STEP 4: Process each player concurrently (AI semaphore = 3) ────────
    ai_semaphore = asyncio.Semaphore(3)

    async def _process_player(raw: dict) -> None:
        api_id = raw.get("api_football_id")
        if not api_id:
            return

        name = _s(raw.get("name"))
        position_str = _s(raw.get("position"))
        position = _map_position(position_str)
        age = raw.get("age") or 0
        nationality = _s(raw.get("nationality"))

        # ── Contract baseline from API-Football ──────────────────────────
        contract_expiry_year: int = 0
        contract_length_years: int = 0
        contract_signing_date = None
        contract_expiry_date = None

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

        # ── Salary baseline from Capology ────────────────────────────────
        salary: float = 0.0
        salary_source = "position_estimate"
        if capology_available:
            salary = salary_map.get(name.lower(), 0.0)
            if salary > 0:
                salary_source = "capology_estimate"

        transfer_value: float = raw.get("transfer_value") or 0.0
        acquisition_fee: float = 0.0
        acquisition_year: int = 0
        is_on_loan = False
        loan_from_club = None
        loan_from_club_id = None
        loan_start_date = None
        loan_end_date = None
        loan_fee = None
        transfermarkt_url = None
        transfermarkt_id = None
        transfermarkt_synced_at = None
        second_nationality = ""
        full_name = ""
        date_of_birth = None

        # ── Enrich from Apify Transfermarkt (overrides API-Football) ─────
        existing = existing_players_map.get(api_id)
        tm_record = None
        if existing and existing.transfermarkt_url:
            tm_record = apify_by_url.get(existing.transfermarkt_url)
        if not tm_record:
            tm_record = apify_by_name.get(name.lower())

        if tm_record:
            tm = extract_contract_data(tm_record)

            if tm.get("contract_signing_date"):
                contract_signing_date = tm["contract_signing_date"]
            if tm.get("contract_expiry_year"):
                contract_expiry_year = tm["contract_expiry_year"]
            if tm.get("contract_expiry_date"):
                contract_expiry_date = tm["contract_expiry_date"]
            if tm.get("contract_length_years"):
                contract_length_years = tm["contract_length_years"]
            if tm.get("transfer_value") and tm["transfer_value"] > 0:
                transfer_value = tm["transfer_value"]
            if tm.get("acquisition_fee") and tm["acquisition_fee"] > 0:
                acquisition_fee = tm["acquisition_fee"]
            if tm.get("acquisition_year"):
                acquisition_year = tm["acquisition_year"]
            if tm.get("is_on_loan"):
                is_on_loan = True
                loan_from_club = tm.get("loan_from_club")
                loan_from_club_id = tm.get("loan_from_club_id")
                loan_start_date = tm.get("loan_start_date")
                loan_end_date = tm.get("loan_end_date")
                loan_fee = tm.get("loan_fee")
            if tm.get("nationality") and not nationality:
                nationality = tm["nationality"]
            if tm.get("second_nationality"):
                second_nationality = tm["second_nationality"]
            if tm.get("full_name"):
                full_name = tm["full_name"]
            if tm.get("date_of_birth"):
                date_of_birth = tm["date_of_birth"]
            transfermarkt_url = tm.get("transfermarkt_url")
            transfermarkt_id = tm.get("transfermarkt_id")
            transfermarkt_synced_at = tm.get("transfermarkt_synced_at")

        # ── Groq/Gemini AI: only for still-missing critical fields ───────
        needs_ai = (
            salary == 0.0
            or contract_expiry_year == 0
            or not nationality
            or transfer_value == 0.0
        )
        if needs_ai:
            async with ai_semaphore:
                ai_data = await extract_player_financials(
                    name=name,
                    club=club.name,
                    league=club.league,
                    position=position_str or "UNKNOWN",
                    age=age,
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
                        contract_signing_date = date.fromisoformat(
                            ai_data["contract_signing_date"]
                        )
                    except Exception:
                        pass
                if transfer_value == 0.0 and ai_data.get("transfer_value_eur"):
                    transfer_value = float(ai_data["transfer_value_eur"])
                if not acquisition_fee and ai_data.get("transfer_fee_eur"):
                    acquisition_fee = float(ai_data["transfer_fee_eur"])
                if not nationality and ai_data.get("nationality"):
                    nationality = _s(ai_data["nationality"])

        # ── Derive acquisition_year if still 0 ──────────────────────────
        if not acquisition_year and contract_signing_date:
            acquisition_year = contract_signing_date.year
        elif not acquisition_year and contract_expiry_year and contract_length_years:
            acquisition_year = contract_expiry_year - contract_length_years

        # ── Final salary fallback ─────────────────────────────────────────
        if salary == 0.0:
            salary = estimate_salary_by_position(position_str, club.league)
            salary_source = "position_estimate"

        fields = {
            "name": name,
            "full_name": full_name,
            "date_of_birth": date_of_birth,
            "age": age,
            "nationality": nationality,
            "second_nationality": second_nationality,
            "photo_url": _s(raw.get("photo_url")),
            "position": position,
            "club_id": str(club.id),
            "estimated_annual_salary": salary,
            "salary_source": salary_source,
            "contract_expiry_year": contract_expiry_year,
            "contract_expiry_date": contract_expiry_date,
            "contract_length_years": contract_length_years,
            "contract_signing_date": contract_signing_date,
            "transfer_value": transfer_value,
            "acquisition_fee": acquisition_fee,
            "acquisition_year": acquisition_year,
            "is_on_loan": is_on_loan,
            "loan_from_club": loan_from_club,
            "loan_from_club_id": loan_from_club_id,
            "loan_start_date": loan_start_date,
            "loan_end_date": loan_end_date,
            "loan_fee": loan_fee,
            "transfermarkt_url": transfermarkt_url,
            "transfermarkt_id": transfermarkt_id,
            "transfermarkt_synced_at": transfermarkt_synced_at,
            "last_synced_at": datetime.utcnow(),
        }

        if existing:
            # Never overwrite a Sport Director's manually-set salary
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

    await asyncio.gather(*[_process_player(raw) for raw in squad_raw])
    return len(squad_raw)


async def _empty_list() -> list:
    """Placeholder coroutine that returns an empty list (used when no TM URLs exist)."""
    return []


# Revenue management

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
      → Global authoritative value, visible to all users
      → Cannot be overridden by regular users

    USER (authenticated):
      → Writes to UserRevenueOverride (personal, private)
      → Does NOT touch the Club document
      → Ignored for FFP if official revenue is set
    """
    club = await Club.find_one(Club.api_football_id == api_football_id)
    if not club:
        raise HTTPException(
            status_code=404,
            detail=(
                "Club not loaded. "
                "Search for it first via GET /api/v1/search/clubs"
            ),
        )

    is_official = user_role in (UserRole.ADMIN, UserRole.SPORT_DIRECTOR)

    if is_official:
        await club.set({
            "official_annual_revenue": data.annual_revenue,
            "official_revenue_set_by": user_id,
            "official_revenue_season_year": data.season_year,
            "season_year": data.season_year,
        })
        await club.sync()
        return _serialize(club, 0.0)

    else:
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

        return _serialize(club, data.annual_revenue)