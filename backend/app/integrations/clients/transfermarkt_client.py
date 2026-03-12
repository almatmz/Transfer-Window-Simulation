from __future__ import annotations

import asyncio
import logging
from datetime import date
from typing import Optional

from apify_client import ApifyClient

from app.core.config import settings
from app.integrations.cache import get_cache, set_cache

logger = logging.getLogger(__name__)

CACHE_TTL = 24 * 3600  # 24 hours



async def get_player_data(transfermarkt_url: str) -> Optional[dict]:
    """
    Fetch one player from Transfermarkt via Apify.
    Returns the raw Apify record or None on failure.
    Results are cached 24 h in Redis / in-memory fallback.
    """
    cache_key = f"tm:player:{transfermarkt_url}"
    cached = await get_cache(cache_key)
    if cached:
        return cached

    if not settings.APIFY_API_TOKEN:
        logger.warning("APIFY_API_TOKEN not set — skipping Transfermarkt")
        return None

    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, _run_apify, [transfermarkt_url])
        if result:
            await set_cache(cache_key, result, ttl_seconds=CACHE_TTL)
        return result
    except Exception as e:
        logger.error(f"Apify Transfermarkt single-player error: {e}")
        return None


async def get_players_batch(transfermarkt_urls: list[str]) -> list[dict]:
    """
    Fetch multiple players in ONE Apify run (much cheaper than individual calls).

    Strategy:
      1. Check Redis/memory cache for each URL.
      2. Call Apify only for uncached URLs (one combined run).
      3. Cache every fresh result.
      4. Return all results (cached + fresh).
    """
    if not transfermarkt_urls:
        return []
    if not settings.APIFY_API_TOKEN:
        logger.warning("APIFY_API_TOKEN not set — skipping Transfermarkt batch")
        return []

    results: list[dict] = []
    uncached_urls: list[str] = []

    for url in transfermarkt_urls:
        cache_key = f"tm:player:{url}"
        cached = await get_cache(cache_key)
        if cached:
            results.append(cached)
        else:
            uncached_urls.append(url)

    if uncached_urls:
        try:
            loop = asyncio.get_event_loop()
            fresh_items = await loop.run_in_executor(None, _run_apify, uncached_urls)
            if fresh_items:
                # _run_apify returns list[dict] when multiple URLs are passed
                items = fresh_items if isinstance(fresh_items, list) else [fresh_items]
                for item in items:
                    results.append(item)
                    profile_url = item.get("profileUrl", "")
                    if profile_url:
                        await set_cache(
                            f"tm:player:{profile_url}", item, ttl_seconds=CACHE_TTL
                        )
        except Exception as e:
            logger.error(f"Apify Transfermarkt batch error: {e}")

    return results


# ─────────────────────────── sync Apify call (threadpool) ────────────────────

def _run_apify(urls: list[str]) -> Optional[list[dict] | dict]:
    """
    Synchronous Apify call — must run inside run_in_executor.

    Returns:
      - dict  if a single URL was requested
      - list  if multiple URLs were requested
      - None  on empty result
    """
    client = ApifyClient(settings.APIFY_API_TOKEN)
    run = client.actor("webdatalabs/transfermarkt-scraper").call(
        run_input={
            "mode": "player",
            "urls": urls,
            "maxItems": len(urls),
        }
    )
    items = client.dataset(run["defaultDatasetId"]).list_items().items
    if not items:
        return None
    return items[0] if len(urls) == 1 else items


# ─────────────────────────── data extraction helper ─────────────────────────

def extract_contract_data(tm_data: dict) -> dict:
    """
    Parse a raw Apify Transfermarkt record into contract / financial fields
    that can be upserted onto a Player document.

    Returns a plain dict — keys match Player model field names.
    """
    if not tm_data:
        return {}

    result: dict = {}

    # ── contract signing date ("joinedDate" = when player joined current club)
    joined = tm_data.get("joinedDate")
    if joined:
        try:
            joined_date = date.fromisoformat(joined)
            result["contract_signing_date"] = joined_date
            result["acquisition_year"] = joined_date.year
        except Exception:
            pass

    # ── contract expiry
    expiry = tm_data.get("contractExpiry")
    if expiry:
        try:
            expiry_date = date.fromisoformat(expiry)
            result["contract_expiry_year"] = expiry_date.year
            result["contract_expiry_date"] = expiry_date
        except Exception:
            pass

    # ── contract length (derived)
    signing = result.get("contract_signing_date")
    expiry_year = result.get("contract_expiry_year")
    if signing and expiry_year and expiry_year > signing.year:
        result["contract_length_years"] = expiry_year - signing.year

    # ── market value (Transfermarkt is source of truth)
    mv = tm_data.get("marketValue")
    if mv and mv > 0:
        result["transfer_value"] = float(mv)
        result["transfer_value_currency"] = tm_data.get("marketValueCurrency", "EUR")

    # ── loan detection from transferHistory (most recent entry is index 0)
    transfer_history: list[dict] = tm_data.get("transferHistory") or []
    result["is_on_loan"] = False
    result["loan_from_club"] = None
    result["loan_from_club_id"] = None
    result["loan_start_date"] = None
    result["loan_end_date"] = None
    result["loan_fee"] = None

    if transfer_history:
        latest = transfer_history[0]
        fee_str = (latest.get("fee") or "").lower()
        if "loan" in fee_str:
            result["is_on_loan"] = True
            result["loan_from_club"] = latest.get("clubFrom")
            result["loan_from_club_id"] = latest.get("clubFromId")
            result["loan_fee"] = latest.get("feeNumeric")
            try:
                result["loan_start_date"] = date.fromisoformat(latest.get("date", ""))
            except Exception:
                pass
            # Transfermarkt convention: loan ends when contract expires
            if result.get("contract_expiry_date"):
                result["loan_end_date"] = result["contract_expiry_date"]

    # ── acquisition fee: most recent non-loan, non-free, numeric transfer
    for entry in transfer_history:
        fee_str = (entry.get("fee") or "").lower()
        fee_num = entry.get("feeNumeric")
        if fee_num and fee_num > 0 and "loan" not in fee_str and "free" not in fee_str:
            result["acquisition_fee"] = float(fee_num)
            break

    # ── bio fields
    nat = tm_data.get("nationality")
    if nat:
        result["nationality"] = nat

    second_nat = tm_data.get("secondNationality")
    if second_nat:
        result["second_nationality"] = second_nat

    full_name = tm_data.get("fullName") or tm_data.get("playerName")
    if full_name:
        result["full_name"] = full_name

    dob = tm_data.get("dateOfBirth")
    if dob:
        try:
            result["date_of_birth"] = date.fromisoformat(dob)
        except Exception:
            pass

    # ── Transfermarkt identifiers
    result["transfermarkt_url"] = tm_data.get("profileUrl")
    result["transfermarkt_id"] = tm_data.get("playerId")
    result["transfermarkt_synced_at"] = tm_data.get("scrapedAt")

    return result