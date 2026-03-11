import httpx
import json
import logging
import re
import asyncio
from typing import Optional
from app.integrations.cache import get_cache, set_cache
from app.core.config import settings

logger = logging.getLogger(__name__)

GROQ_URL  = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"

GEMINI_URL  = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

CACHE_TTL      = 3  * 24 * 3600   
RATE_LIMIT_GAP = 2.2              
MAX_RETRIES    = 3


#  Raw API calls

async def _call_groq(prompt: str) -> Optional[str]:
    if not settings.GROQ_API_KEY:
        return None
    for attempt in range(MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    GROQ_URL,
                    headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}",
                             "Content-Type": "application/json"},
                    json={
                        "model": GROQ_MODEL,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.05,
                        "max_tokens": 200,
                    },
                )
                if resp.status_code == 429:
                    wait = 30 * (attempt + 1)
                    logger.warning(f"Groq 429 — waiting {wait}s")
                    await asyncio.sleep(wait)
                    continue
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"]
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(3)
            else:
                logger.warning(f"Groq failed after {MAX_RETRIES} attempts: {e}")
    return None


async def _call_gemini(prompt: str) -> Optional[str]:
    if not settings.GEMINI_API_KEY:
        return None
    for attempt in range(MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{GEMINI_URL}?key={settings.GEMINI_API_KEY}",
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"temperature": 0.05, "maxOutputTokens": 200},
                    },
                )
                if resp.status_code == 429:
                    wait = 60 * (attempt + 1)
                    logger.warning(f"Gemini 429 — waiting {wait}s")
                    await asyncio.sleep(wait)
                    continue
                resp.raise_for_status()
                return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(3)
            else:
                logger.warning(f"Gemini failed: {e}")
    return None


async def _call_ai(prompt: str) -> Optional[str]:
    """Try Groq first, fall back to Gemini."""
    result = await _call_groq(prompt)
    if result:
        return result
    return await _call_gemini(prompt)


def _extract_json(text: str) -> Optional[dict]:
    if not text:
        return None
    text = re.sub(r"```(?:json)?", "", text).strip()
    match = re.search(r'\{.*?\}', text, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group())
    except Exception:
        return None


# Public API 

async def enrich_player(
    player_name: str,
    position: str,
    age: int,
    club: str,
    league: str,
) -> dict:
    """
    Get salary + market value + contract expiry for one player.

    Returns:
        {
            annual_salary_eur: 11543600,
            market_value_eur: 10000000,
            contract_expiry_year: 2026,
            confidence: "high" | "medium" | "low",
            source: "groq" | "gemini"
        }
    """
    cache_key = f"ai:player:v1:{player_name.lower()}:{club.lower()}"
    cached = await get_cache(cache_key)
    if cached:
        logger.debug(f"Cache hit: {player_name}")
        return cached

    prompt = (
        f"What is the gross annual salary in EUR, current Transfermarkt market value in EUR, "
        f"and contract expiry year of {player_name} who plays for {club} ({league}) "
        f"as {position}, age {age}, as of early 2026?\n\n"
        f"Return ONLY this JSON object, nothing else:\n"
        f'{{"annual_salary_eur": <integer>, "market_value_eur": <integer>, '
        f'"contract_expiry_year": <integer>, "confidence": "high" or "medium" or "low"}}\n\n'
        f"Convert GBP to EUR at 1.17 rate. "
        f"If exact value unknown, estimate based on club wage structure."
    )

    text = await _call_ai(prompt)
    source = "groq" if settings.GROQ_API_KEY else "gemini"
    data = _extract_json(text)

    result = {
        "annual_salary_eur": 0.0,
        "market_value_eur": 0.0,
        "contract_expiry_year": 0,
        "confidence": "low",
        "source": source,
    }

    if data:
        result["annual_salary_eur"]    = float(data.get("annual_salary_eur") or 0)
        result["market_value_eur"]     = float(data.get("market_value_eur") or 0)
        result["contract_expiry_year"] = int(data.get("contract_expiry_year") or 0)
        result["confidence"]           = str(data.get("confidence") or "low")

        logger.info(
            f"AI [{result['confidence']}|{source}] {player_name}: "
            f"€{result['annual_salary_eur']/1e6:.2f}M/yr  "
            f"val=€{result['market_value_eur']/1e6:.2f}M  "
            f"exp={result['contract_expiry_year']}"
        )
        if result["annual_salary_eur"] > 0 or result["market_value_eur"] > 0:
            await set_cache(cache_key, result, ttl_seconds=CACHE_TTL)

    return result


async def enrich_squad(
    players: list[dict],    # each: {name, position, age}
    club: str,
    league: str,
) -> dict[str, dict]:
    """
    Enrich all squad players ONE AT A TIME with rate-limit gaps.
    Cached players are skipped (instant).

    Returns: {player_name_lower: enrichment_dict}
    """
    if not (settings.GROQ_API_KEY or settings.GEMINI_API_KEY) or not players:
        return {}

    out = {}
    total = len(players)

    for i, p in enumerate(players):
        name = p["name"]
        cache_key = f"ai:player:v1:{name.lower()}:{club.lower()}"
        cached = await get_cache(cache_key)

        if cached:
            out[name.lower()] = cached
            logger.debug(f"[{i+1}/{total}] Cache: {name}")
            continue

        logger.info(f"[{i+1}/{total}] Enriching: {name}")
        data = await enrich_player(
            player_name=name,
            position=p.get("position", "UNKNOWN"),
            age=p.get("age", 0),
            club=club,
            league=league,
        )
        out[name.lower()] = data

        if i < total - 1:
            await asyncio.sleep(RATE_LIMIT_GAP)

    logger.info(f"Enrichment done: {len(out)}/{total} players for {club}")
    return out


def find_in_enrichment(name: str, enrichment_map: dict) -> Optional[dict]:
    """
    Match possibly-abbreviated player name against enrichment map keys.
    Handles 'T. Fredricson' → 'tyler fredricson'.
    """
    name_lower = name.lower()

    # 1. Exact
    if name_lower in enrichment_map:
        return enrichment_map[name_lower]

    # 2. All significant parts present
    parts = [p.strip(".").lower() for p in name_lower.split() if len(p.strip(".")) > 1]
    for key, val in enrichment_map.items():
        if all(p in key for p in parts):
            return val

    # 3. Last name only
    last = parts[-1] if parts else ""
    if len(last) > 3:
        for key, val in enrichment_map.items():
            if last in key:
                return val

    return None


_PLAYER_PROMPT = """\
You are a football finance assistant. Extract financial data for this player.
Return ONLY valid JSON, no explanation:
{{
  "annual_salary_eur": <number or null>,
  "contract_expiry_year": <integer or null>,
  "contract_length_years": <integer or null>,
  "contract_signing_date": "<YYYY-MM-DD or null>",
  "transfer_fee_eur": <number or null>,
  "transfer_value_eur": <number or null>,
  "nationality": "<string or null>"
}}
Rules: annual_salary_eur is gross annual (not weekly). All amounts in EUR.
Player: {name}, Club: {club}, League: {league}, Position: {position}, Age: {age}
"""


async def extract_player_financials(
    name: str,
    club: str,
    league: str,
    position: str,
    age: int,
) -> dict | None:
    """
    Extract player salary/contract/transfer data via Groq (→ Gemini fallback).
    Returns dict or None on failure.
    """
    cache_key = f"player_financials:{name.lower()}:{club.lower()}"
    cached = await get_cache(cache_key)
    if cached:
        return cached

    prompt = _PLAYER_PROMPT.format(
        name=name, club=club, league=league, position=position, age=age
    )
    raw = await _call_ai(prompt)
    result = _extract_json(raw) if raw else None

    if result:
        await set_cache(cache_key, result, ttl_seconds=CACHE_TTL)

    return result