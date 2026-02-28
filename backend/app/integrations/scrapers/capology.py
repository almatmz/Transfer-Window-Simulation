"""
Salary data layer — tries Capology scraping, falls back to position-based estimates.

Capology frequently blocks scrapers with 403/429. When that happens we fall back
to position-based market estimates derived from Transfermarkt data (2024/25 season).
These are clearly labelled "position_estimate" vs "capology_estimate" in the response.

Salary sources (in priority order):
  1. Capology scrape (most accurate — public estimates from agent negotiations)
  2. Position-based estimate (rough — uses league tier + position averages)
  3. Zero (last resort — triggers warning in FFP dashboard)
"""

import httpx
import re
import logging
from bs4 import BeautifulSoup
from typing import Optional
from app.integrations.cache import get_cache, set_cache
from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Club slug map (Capology URL slugs) ───────────────────────────────────────
CLUB_SLUG_MAP: dict[str, str] = {
    "Manchester City": "manchester-city",
    "Manchester United": "manchester-united",
    "Arsenal": "arsenal",
    "Chelsea": "chelsea",
    "Liverpool": "liverpool",
    "Tottenham Hotspur": "tottenham-hotspur",
    "Tottenham": "tottenham-hotspur",
    "Newcastle United": "newcastle-united",
    "Aston Villa": "aston-villa",
    "West Ham United": "west-ham-united",
    "Everton": "everton",
    "Fulham": "fulham",
    "Brighton": "brighton-hove-albion",
    "Brentford": "brentford",
    "Crystal Palace": "crystal-palace",
    "Wolverhampton": "wolverhampton-wanderers",
    "Nottingham Forest": "nottingham-forest",
    "Leicester City": "leicester-city",
    "Ipswich": "ipswich-town",
    "Southampton": "southampton",
    "Real Madrid": "real-madrid",
    "FC Barcelona": "fc-barcelona",
    "Barcelona": "fc-barcelona",
    "Atletico Madrid": "atletico-de-madrid",
    "Athletic Club": "athletic-club",
    "Real Sociedad": "real-sociedad",
    "Villarreal": "villarreal",
    "Valencia": "valencia",
    "Sevilla": "sevilla",
    "Bayern Munich": "fc-bayern-munchen",
    "Borussia Dortmund": "borussia-dortmund",
    "RB Leipzig": "rb-leipzig",
    "Bayer Leverkusen": "bayer-leverkusen",
    "Eintracht Frankfurt": "eintracht-frankfurt",
    "Paris Saint-Germain": "paris-saint-germain",
    "PSG": "paris-saint-germain",
    "Olympique Lyonnais": "olympique-lyonnais",
    "Lyon": "olympique-lyonnais",
    "Olympique Marseille": "olympique-marseille",
    "Monaco": "as-monaco",
    "Juventus": "juventus",
    "AC Milan": "ac-milan",
    "Inter Milan": "inter-milan",
    "Inter": "inter-milan",
    "Napoli": "napoli",
    "AS Roma": "as-roma",
    "Lazio": "lazio",
    "Atalanta": "atalanta",
    "Fiorentina": "fiorentina",
    "Ajax": "ajax",
    "PSV Eindhoven": "psv-eindhoven",
    "Feyenoord": "feyenoord",
    "Benfica": "sl-benfica",
    "Porto": "fc-porto",
    "Sporting CP": "sporting-cp",
    "Celtic": "celtic",
    "Rangers": "rangers",
    "Galatasaray": "galatasaray",
    "Fenerbahce": "fenerbahce",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


# ── Position-based salary estimates (EUR annual, 2024/25) ────────────────────
# Based on median Transfermarkt wage data per league tier and position.
# These are conservative estimates — real salaries vary enormously.

POSITION_SALARY_ESTIMATES: dict[str, dict[str, float]] = {
    # Top 5 leagues (Premier League, La Liga, Bundesliga, Serie A, Ligue 1)
    "top5": {
        "GK":      3_500_000,
        "CB":      4_000_000,
        "LB":      3_800_000,
        "RB":      3_800_000,
        "CDM":     4_500_000,
        "CM":      5_000_000,
        "CAM":     6_000_000,
        "LW":      7_000_000,
        "RW":      7_000_000,
        "CF":      7_500_000,
        "ST":      8_000_000,
        "UNKNOWN": 4_000_000,
    },
    # Other European leagues (Eredivisie, Primeira Liga, etc.)
    "europe2": {
        "GK":        800_000,
        "CB":      1_000_000,
        "LB":        900_000,
        "RB":        900_000,
        "CDM":     1_100_000,
        "CM":      1_200_000,
        "CAM":     1_400_000,
        "LW":      1_500_000,
        "RW":      1_500_000,
        "CF":      1_700_000,
        "ST":      1_800_000,
        "UNKNOWN":   900_000,
    },
    # Default (unknown league)
    "default": {
        "GK":      1_500_000,
        "CB":      1_800_000,
        "LB":      1_600_000,
        "RB":      1_600_000,
        "CDM":     2_000_000,
        "CM":      2_200_000,
        "CAM":     2_500_000,
        "LW":      2_800_000,
        "RW":      2_800_000,
        "CF":      3_000_000,
        "ST":      3_200_000,
        "UNKNOWN": 1_800_000,
    },
}

TOP5_LEAGUES = {
    "Premier League", "La Liga", "Bundesliga", "Serie A", "Ligue 1",
    "primera division", "premier league", "bundesliga", "serie a", "ligue 1",
}

EUROPE2_LEAGUES = {
    "Eredivisie", "Primeira Liga", "Scottish Premiership",
    "Super Lig", "Belgian Pro League", "Championship",
}


def estimate_salary_by_position(position: str, league: str = "") -> float:
    """
    Return a rough salary estimate based on position and league tier.
    Used as fallback when Capology data is unavailable.
    """
    pos = position.upper().strip() if position else "UNKNOWN"
    league_lower = league.lower()

    if any(l in league_lower for l in ["premier", "la liga", "bundesliga", "serie a", "ligue 1"]):
        tier = "top5"
    elif any(l in league_lower for l in ["eredivisie", "primeira", "scottish", "super lig", "belgian"]):
        tier = "europe2"
    else:
        tier = "default"

    estimates = POSITION_SALARY_ESTIMATES[tier]
    return estimates.get(pos, estimates["UNKNOWN"])


# ── Capology scraper ──────────────────────────────────────────────────────────

async def get_club_salaries(club_name: str, league: str = "") -> dict[str, float]:
    """
    Get salary estimates for all players at a club.
    Returns: {player_name_lower: annual_salary_eur}

    First tries Capology. If blocked/failed, returns empty dict
    (caller should use estimate_salary_by_position as fallback).
    """
    cache_key = f"capology:salaries:{club_name.lower()}"
    cached = await get_cache(cache_key)
    if cached:
        return cached

    slug = _get_slug(club_name)
    if not slug:
        logger.info(f"No Capology slug for '{club_name}' — using position estimates")
        return {}

    url = f"{settings.CAPOLOGY_BASE_URL}/club/{slug}/salaries/"

    try:
        async with httpx.AsyncClient(
            timeout=15.0, headers=HEADERS, follow_redirects=True
        ) as client:
            resp = await client.get(url)

            if resp.status_code in (403, 429, 503):
                logger.warning(f"Capology blocked ({resp.status_code}) for {club_name} — using position estimates")
                return {}

            resp.raise_for_status()
            salaries = _parse_salary_table(resp.text)

            if not salaries:
                logger.warning(f"Capology returned no parseable data for {club_name}")
                return {}

            ttl = settings.SCRAPE_CACHE_TTL_HOURS * 3600
            await set_cache(cache_key, salaries, ttl_seconds=ttl)
            logger.info(f"Capology: loaded {len(salaries)} salaries for {club_name}")
            return salaries

    except Exception as e:
        logger.warning(f"Capology scrape failed for {club_name}: {e}")
        return {}


async def get_player_salary_estimate(player_name: str, club_name: str) -> Optional[float]:
    salaries = await get_club_salaries(club_name)
    return salaries.get(player_name.lower())


def _get_slug(club_name: str) -> Optional[str]:
    if club_name in CLUB_SLUG_MAP:
        return CLUB_SLUG_MAP[club_name]
    for name, slug in CLUB_SLUG_MAP.items():
        if name.lower() in club_name.lower() or club_name.lower() in name.lower():
            return slug
    return None


def _parse_salary_table(html: str) -> dict[str, float]:
    soup = BeautifulSoup(html, "lxml")
    salaries: dict[str, float] = {}

    table = soup.find("table", {"id": "table"}) or soup.find("table", class_="table")
    if not table:
        return salaries

    for row in table.find_all("tr")[1:]:
        cells = row.find_all("td")
        if len(cells) < 3:
            continue
        name_cell = cells[1] if len(cells) > 2 else cells[0]
        name_tag = name_cell.find("a")
        if not name_tag:
            continue
        player_name = name_tag.get_text(strip=True).lower()
        salary_text = ""
        for cell in cells[2:5]:
            text = cell.get_text(strip=True)
            if any(c in text for c in ["€", "£", "$"]) or re.search(r"\d{3,}", text):
                salary_text = text
                break
        annual = _parse_salary_string(salary_text)
        if annual and player_name:
            salaries[player_name] = annual

    return salaries


def _parse_salary_string(text: str) -> Optional[float]:
    if not text:
        return None
    text = text.strip().replace(",", "").replace(" ", "")
    currency = "GBP" if "£" in text else "EUR"
    text = text.replace("€", "").replace("£", "").replace("$", "")
    is_weekly = "p/w" in text.lower() or "/w" in text.lower()
    text = re.sub(r"[^0-9.KkMm]", "", text)
    multiplier = 1.0
    if "M" in text or "m" in text:
        multiplier = 1_000_000
        text = text.replace("M", "").replace("m", "")
    elif "K" in text or "k" in text:
        multiplier = 1_000
        text = text.replace("K", "").replace("k", "")
    try:
        value = float(text) * multiplier
    except (ValueError, TypeError):
        return None
    if is_weekly:
        value *= 52
    if currency == "GBP":
        value *= 1.17
    return round(value, 2)