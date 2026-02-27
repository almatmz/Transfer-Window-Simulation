import httpx
import logging
from app.core.config import settings
from app.integrations.cache import get_cache, set_cache

logger = logging.getLogger(__name__)


async def _get(endpoint: str, params: dict, cache_ttl: int = 3600 * 6) -> dict:
    """
    Cached GET. Returns {"response": []} on any failure — never raises.
    """
    if not settings.has_api_football:
        logger.warning("API_FOOTBALL_KEY not configured — returning empty")
        return {"response": []}

    cache_key = f"apifootball:{endpoint}:{sorted(params.items())}"
    cached = await get_cache(cache_key)
    if cached:
        return cached

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{settings.API_FOOTBALL_BASE_URL}/{endpoint}",
                headers=settings.api_football_headers,
                params=params,
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as e:
        logger.error(f"API-Football HTTP {e.response.status_code} on /{endpoint}: {e}")
        return {"response": []}
    except Exception as e:
        logger.error(f"API-Football request failed on /{endpoint}: {e}")
        return {"response": []}

    # Surface API-level errors without caching them
    errors = data.get("errors", {})
    has_error = (isinstance(errors, dict) and any(errors.values())) or \
                (isinstance(errors, list) and errors)
    if has_error:
        logger.error(f"API-Football error on /{endpoint}: {errors}")
        return {"response": []}

    await set_cache(cache_key, data, ttl_seconds=cache_ttl)
    return data


async def search_clubs(query: str, country: str = "") -> list[dict]:
    """Search clubs by name using /teams endpoint (free tier compatible)."""
    params = {"search": query}
    if country:
        params["country"] = country
    data = await _get("teams", params)
    return [_parse_team(r) for r in data.get("response", []) if r.get("team", {}).get("id")]


async def get_club_by_id(club_id: int) -> dict | None:
    data = await _get("teams", {"id": club_id})
    results = data.get("response", [])
    if not results:
        return None
    club = _parse_team(results[0])
    league_name, league_id = await _get_current_league(club_id)
    club["league"] = league_name
    club["league_id"] = league_id
    return club


async def _get_current_league(club_id: int) -> tuple[str, int]:
    """Get the active league for a team. Cached 24h to save quota."""
    data = await _get("leagues", {"team": club_id, "current": "true"}, cache_ttl=3600 * 24)
    for item in data.get("response", []):
        league = item.get("league", {})
        if league.get("type") == "League":
            return league.get("name", ""), league.get("id", 0)
    items = data.get("response", [])
    if items:
        league = items[0].get("league", {})
        return league.get("name", ""), league.get("id", 0)
    return "", 0



async def get_squad(club_id: int, season: int = 2024) -> list[dict]:
    """Get current squad via /players/squads (free tier)."""
    data = await _get("players/squads", {"team": club_id})
    squads = data.get("response", [])
    if not squads:
        return []
    return [_parse_squad_player(p) for p in squads[0].get("players", [])]


async def get_player_details(player_id: int, season: int = 2024) -> dict | None:
    data = await _get("players", {"id": player_id, "season": season})
    results = data.get("response", [])
    return _parse_player_detail(results[0]) if results else None


async def search_players(name: str, club_id: int | None = None) -> list[dict]:
    params = {"search": name}
    if club_id:
        params["team"] = club_id
    data = await _get("players", params)
    return [_parse_player_detail(r) for r in data.get("response", [])]



async def get_player_transfers(player_id: int) -> list[dict]:
    data = await _get("transfers", {"player": player_id})
    results = data.get("response", [])
    if not results:
        return []
    return [
        {
            "date": t.get("date"),
            "type": t.get("type"),
            "from_club": t.get("teams", {}).get("out", {}).get("name"),
            "to_club": t.get("teams", {}).get("in", {}).get("name"),
        }
        for t in results[0].get("transfers", [])
    ]



def _parse_team(raw: dict) -> dict:
    """
    Parse one item from /teams response.
    Shape: {"team": {"id": 50, "name": "...", "code": "MCI", "country": "England", "logo": "..."}}
    """
    team = raw.get("team", {})
    venue = raw.get("venue", {})
    return {
        "api_football_id": team.get("id"),
        "name": team.get("name", ""),
        "short_name": team.get("code", ""),
        "country": team.get("country", ""),
        "logo_url": team.get("logo", ""),
        "league": "",      
        "league_id": 0,
    }


def _parse_squad_player(raw: dict) -> dict:
    return {
        "api_football_id": raw.get("id"),
        "name": raw.get("name", ""),
        "age": raw.get("age", 0),
        "photo_url": raw.get("photo", ""),
        "position": _normalise_position(raw.get("position", "")),
        "number": raw.get("number"),
    }


def _parse_player_detail(raw: dict) -> dict:
    player = raw.get("player", {})
    stats = (raw.get("statistics") or [{}])[0]
    games = stats.get("games", {})
    return {
        "api_football_id": player.get("id"),
        "name": player.get("name", ""),
        "first_name": player.get("firstname", ""),
        "last_name": player.get("lastname", ""),
        "age": player.get("age", 0),
        "nationality": player.get("nationality", ""),
        "photo_url": player.get("photo", ""),
        "position": _normalise_position(games.get("position", "")),
        "api_football_club_id": stats.get("team", {}).get("id", 0),
    }


def _normalise_position(pos: str) -> str:
    mapping = {
        "Goalkeeper": "GK",
        "Defender": "CB",
        "Midfielder": "CM",
        "Attacker": "ST",
        "Forward": "ST",
    }
    return mapping.get(pos, "UNKNOWN")