import logging
from datetime import datetime
from fastapi import HTTPException

from app.models.club import Club
from app.models.player import Player, Position
from app.models.player_contract import PlayerContract, ContractType, DataSource
from app.schemas.club import ClubResponse, ClubRevenueUpdate, ClubSearchResult
from app.integrations.clients import api_football
from app.integrations.clients.groq_client import enrich_squad, find_in_enrichment
from app.core.config import settings

logger = logging.getLogger(__name__)

# Position salary fallback (top-5 league averages, EUR/year)
POSITION_SALARY_FALLBACK = {
    "GK": 3_500_000, "CB": 4_000_000, "LB": 3_800_000, "RB": 3_800_000,
    "CDM": 4_500_000, "CM": 5_000_000, "CAM": 6_000_000,
    "LW": 7_000_000, "RW": 7_000_000, "CF": 7_500_000, "ST": 8_000_000,
}


def _position_salary(position: str) -> float:
    return POSITION_SALARY_FALLBACK.get(position.upper(), 4_000_000)


def _s(v) -> str:
    return str(v) if v is not None else ""


def _serialize(club: Club) -> ClubResponse:
    return ClubResponse(
        id=str(club.id),
        api_football_id=club.api_football_id,
        name=club.name,
        country=_s(club.country),
        league=_s(club.league),
        logo_url=_s(club.logo_url),
        annual_revenue=club.annual_revenue,
        equity_injection_limit=club.equity_injection_limit,
        season_year=club.season_year,
        revenue_configured=club.annual_revenue > 0,
        last_synced_at=club.last_synced_at,
    )


def _map_position(pos: str) -> Position:
    return {
        "GK": Position.GK, "Goalkeeper": Position.GK,
        "CB": Position.CB, "Defender": Position.CB,
        "LB": Position.LB, "RB": Position.RB,
        "CDM": Position.CDM, "CM": Position.CM, "Midfielder": Position.CM,
        "CAM": Position.CAM, "LW": Position.LW, "RW": Position.RW,
        "CF": Position.CF, "ST": Position.ST,
        "Attacker": Position.ST, "Forward": Position.ST,
    }.get(pos, Position.UNKNOWN)


# ── Search ────────────────────────────────────────────────────────────────────

async def search_clubs(query: str, country: str = "") -> list[ClubSearchResult]:
    """Search clubs via API-Football. Returns lightweight results for the search UI."""
    raw_results = await api_football.search_clubs(query, country)
    return [
        ClubSearchResult(
            api_football_id=r.get("api_football_id", 0),
            name=_s(r.get("name")),
            country=_s(r.get("country")),
            logo_url=_s(r.get("logo_url")),
        )
        for r in raw_results
        if r.get("api_football_id")
    ]


# ── Load / create club ────────────────────────────────────────────────────────

async def get_or_create_club(api_football_id: int, season: int = 2025) -> Club:
    """Load club from DB or fetch from API-Football."""
    club = await Club.find_one(Club.api_football_id == api_football_id)
    if not club:
        raw = await api_football.get_club_by_id(api_football_id)
        if not raw:
            raise HTTPException(status_code=404, detail=f"Club {api_football_id} not found in API-Football.")
        club = Club(
            api_football_id=api_football_id,
            name=_s(raw.get("name")),
            country=_s(raw.get("country")),
            league=_s(raw.get("league")),
            league_id=raw.get("league_id") or 0,
            logo_url=_s(raw.get("logo_url")),
            season_year=season,
        )
        await club.insert()
        await sync_squad(club, season)
    return club


async def get_or_sync_club(api_football_id: int, season: int = 2025) -> ClubResponse:
    """Used by search endpoint — loads full club + syncs squad on first load."""
    club = await get_or_create_club(api_football_id, season)
    return _serialize(club)


async def get_club_response(api_football_id: int, season: int = 2025) -> ClubResponse:
    club = await get_or_create_club(api_football_id, season)
    return _serialize(club)


# ── Revenue ───────────────────────────────────────────────────────────────────

async def update_revenue(api_football_id: int, data: ClubRevenueUpdate) -> ClubResponse:
    club = await Club.find_one(Club.api_football_id == api_football_id)
    if not club:
        raise HTTPException(status_code=404, detail="Club not loaded yet.")
    if data.annual_revenue <= 0:
        raise HTTPException(status_code=422, detail="annual_revenue must be > 0.")
    await club.set({
        "annual_revenue": data.annual_revenue,
        "equity_injection_limit": data.equity_injection_limit or club.equity_injection_limit,
        "season_year": data.season_year or club.season_year,
    })
    return _serialize(club)


# ── Squad sync ────────────────────────────────────────────────────────────────

async def sync_squad(club: Club, season: int = 2025) -> int:
    """
    Fetch squad from API-Football, enrich with Groq/Gemini AI,
    upsert Player records and create PlayerContracts.
    """
    squad_raw = await api_football.get_squad(club.api_football_id, season)
    if not squad_raw:
        logger.warning(f"No squad data for club {club.api_football_id}")
        return 0

    player_list = [
        {"name": _s(r.get("name")), "position": _s(r.get("position")), "age": r.get("age") or 0}
        for r in squad_raw
    ]

    ai_map: dict[str, dict] = {}
    if settings.GROQ_API_KEY or settings.GEMINI_API_KEY:
        ai_map = await enrich_squad(player_list, club.name, club.league)
    else:
        logger.warning("No AI key set — using position salary estimates only")

    synced = 0
    for raw in squad_raw:
        api_id = raw.get("api_football_id")
        if not api_id:
            continue

        name         = _s(raw.get("name"))
        position_str = _s(raw.get("position"))
        position     = _map_position(position_str)
        age          = raw.get("age") or 0

        # Upsert global Player record
        player = await Player.find_one(Player.api_football_id == api_id)
        if player:
            await player.set({"name": name, "age": age, "position": position,
                              "photo_url": _s(raw.get("photo_url")),
                              "last_synced_at": datetime.utcnow()})
        else:
            player = Player(
                api_football_id=api_id, name=name, age=age, position=position,
                photo_url=_s(raw.get("photo_url")), nationality="",
            )
            await player.insert()

        # Get AI enrichment
        ai = find_in_enrichment(name, ai_map)
        salary      = float(ai["annual_salary_eur"]) if ai and ai.get("annual_salary_eur") else 0.0
        expiry_year = int(ai["contract_expiry_year"]) if ai and ai.get("contract_expiry_year") else 0
        ai_source   = ai.get("source", "groq") if ai else None

        if salary <= 0:
            salary = _position_salary(position_str)
            data_source = DataSource.MANUAL
        else:
            data_source = DataSource.GROQ if ai_source == "groq" else DataSource.GEMINI

        if expiry_year <= 0:
            expiry_year = season + 2

        # Only create contract if none exists — don't overwrite SD overrides
        existing = await PlayerContract.find_one(
            PlayerContract.player_id == str(player.id),
            PlayerContract.club_id == str(club.id),
            PlayerContract.is_active == True,
            PlayerContract.contract_type == ContractType.PERMANENT,
        )

        if existing:
            if data_source in (DataSource.GROQ, DataSource.GEMINI):
                await existing.set({
                    "annual_salary": salary,
                    "contract_expiry_year": expiry_year,
                    "data_source": data_source,
                    "updated_at": datetime.utcnow(),
                })
        else:
            contract = PlayerContract(
                player_id=str(player.id),
                club_id=str(club.id),
                player_name=name,
                player_api_id=api_id,
                contract_type=ContractType.PERMANENT,
                contract_start_year=season - 1,
                contract_expiry_year=expiry_year,
                annual_salary=salary,
                acquisition_fee=0.0,
                acquisition_year=season - 1,
                data_source=data_source,
            )
            await contract.insert()

        logger.info(f"  {name}: €{salary/1e6:.2f}M/yr exp={expiry_year} [{data_source}]")
        synced += 1

    await club.set({"last_synced_at": datetime.utcnow()})
    logger.info(f"Synced {synced} players for {club.name}")
    return synced