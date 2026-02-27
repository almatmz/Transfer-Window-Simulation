import json
import time
from typing import Any, Optional
from app.core.config import settings

_memory_cache: dict[str, tuple[Any, float]] = {}

_redis = None


async def _get_redis():
    global _redis
    if _redis is None and settings.has_redis:
        try:
            import redis.asyncio as aioredis
            _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        except Exception:
            _redis = None
    return _redis


async def get_cache(key: str) -> Optional[Any]:
    r = await _get_redis()
    if r:
        try:
            raw = await r.get(key)
            return json.loads(raw) if raw else None
        except Exception:
            pass

    entry = _memory_cache.get(key)
    if entry:
        value, expires_at = entry
        if time.time() < expires_at:
            return value
        del _memory_cache[key]
    return None


async def set_cache(key: str, value: Any, ttl_seconds: int = 3600) -> None:
    r = await _get_redis()
    if r:
        try:
            await r.setex(key, ttl_seconds, json.dumps(value))
            return
        except Exception:
            pass

    # In-memory fallback
    _memory_cache[key] = (value, time.time() + ttl_seconds)


async def invalidate(key: str) -> None:
    r = await _get_redis()
    if r:
        try:
            await r.delete(key)
        except Exception:
            pass
    _memory_cache.pop(key, None)


async def invalidate_prefix(prefix: str) -> None:
    """Delete all cache keys starting with prefix."""
    r = await _get_redis()
    if r:
        try:
            keys = await r.keys(f"{prefix}*")
            if keys:
                await r.delete(*keys)
        except Exception:
            pass
    for key in list(_memory_cache.keys()):
        if key.startswith(prefix):
            del _memory_cache[key]