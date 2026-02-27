import httpx
import re
import asyncio
from bs4 import BeautifulSoup
from typing import Optional
from app.integrations.cache import get_cache, set_cache
from app.core.config import settings

CLUB_SLUG_MAP: dict[str, str] = {
    "Manchester City": "manchester-city",
    "Manchester United": "manchester-united",
    "Arsenal": "arsenal",
    "Chelsea": "chelsea",
    "Liverpool": "liverpool",
    "Tottenham Hotspur": "tottenham-hotspur",
    "Newcastle United": "newcastle-united",
    "Aston Villa": "aston-villa",
    "Real Madrid": "real-madrid",
    "FC Barcelona": "fc-barcelona",
    "Atletico Madrid": "atletico-de-madrid",
    "Bayern Munich": "fc-bayern-munchen",
    "Borussia Dortmund": "borussia-dortmund",
    "Paris Saint-Germain": "paris-saint-germain",
    "Juventus": "juventus",
    "AC Milan": "ac-milan",
    "Inter Milan": "inter-milan",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


async def get_club_salaries(club_name: str) -> dict[str, float]:
    """
    Scrape salary estimates for all players at a club.

    Returns:
        dict mapping player_name (lowercase) → estimated annual salary EUR
        e.g. {"erling haaland": 20800000, "kevin de bruyne": 20000000}
    """
    cache_key = f"capology:salaries:{club_name.lower()}"
    cached = await get_cache(cache_key)
    if cached:
        return cached

    slug = _get_slug(club_name)
    if not slug:
        return {}

    url = f"{settings.CAPOLOGY_BASE_URL}/club/{slug}/salaries/"

    try:
        async with httpx.AsyncClient(timeout=20.0, headers=HEADERS, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except Exception:
        return {}

    salaries = _parse_salary_table(resp.text)

    ttl = settings.SCRAPE_CACHE_TTL_HOURS * 3600
    await set_cache(cache_key, salaries, ttl_seconds=ttl)
    return salaries


async def get_player_salary_estimate(player_name: str, club_name: str) -> Optional[float]:
    """
    Get salary estimate for a specific player.
    Returns None if not found.
    """
    salaries = await get_club_salaries(club_name)
    return salaries.get(player_name.lower())


def _get_slug(club_name: str) -> Optional[str]:
    """Get Capology URL slug for a club. Returns None if not in map."""
    # Exact match
    if club_name in CLUB_SLUG_MAP:
        return CLUB_SLUG_MAP[club_name]
    # Partial match
    for name, slug in CLUB_SLUG_MAP.items():
        if name.lower() in club_name.lower() or club_name.lower() in name.lower():
            return slug
    return None


def _parse_salary_table(html: str) -> dict[str, float]:
    """
    Parse Capology salary table HTML.
    Returns {player_name_lower: annual_salary_eur}
    """
    soup = BeautifulSoup(html, "lxml")
    salaries: dict[str, float] = {}

    # Capology table has class "table" with player rows
    table = soup.find("table", {"id": "table"}) or soup.find("table", class_="table")
    if not table:
        return salaries

    for row in table.find_all("tr")[1:]:  # skip header
        cells = row.find_all("td")
        if len(cells) < 3:
            continue

        # Player name is usually in first or second cell with an <a> tag
        name_cell = cells[1] if len(cells) > 2 else cells[0]
        name_tag = name_cell.find("a")
        if not name_tag:
            continue
        player_name = name_tag.get_text(strip=True).lower()

        # Weekly wage is often in cell index 2, annual in cell 3
        # Capology shows weekly in GBP/EUR, we want annual EUR
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
    """
    Convert salary strings like '€400K p/w', '€20M p/a', '£350,000' to annual EUR float.
    """
    if not text:
        return None

    text = text.strip().replace(",", "").replace(" ", "")
    currency = "EUR"
    if "£" in text:
        currency = "GBP"

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