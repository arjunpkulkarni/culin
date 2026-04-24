"""LRU caches for both structured and free-text estimation paths."""

import json
from functools import lru_cache
from app.config import CACHE_MAXSIZE


@lru_cache(maxsize=CACHE_MAXSIZE)
def _cached_estimate_structured(cache_key: str) -> dict:
    from app.engine import estimate_nutrition
    req = json.loads(cache_key)
    return estimate_nutrition(req)


@lru_cache(maxsize=CACHE_MAXSIZE)
def _cached_estimate_text(cache_key: str) -> dict:
    from app.engine import estimate_from_text as _estimate
    args = json.loads(cache_key)
    return _estimate(**args)


def cached_estimate(req: dict) -> dict:
    key = json.dumps(
        {k: req.get(k) for k in ("item_name", "description", "modifiers", "restaurant")},
        sort_keys=True,
    )
    return _cached_estimate_structured(key)


def cached_estimate_from_text(
    text: str,
    restaurant: str | None = None,
    price: float | None = None,
) -> dict:
    key = json.dumps({"text": text, "restaurant": restaurant, "price": price}, sort_keys=True)
    return _cached_estimate_text(key)


def warmup_cache() -> None:
    pass
