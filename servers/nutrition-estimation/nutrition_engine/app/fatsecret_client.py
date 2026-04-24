"""FatSecret API client. Server-side only; keys never sent to client."""

import logging
import time
from typing import Any, Dict, List, Optional

import httpx

from app.config import (
    FATSECRET_API_BASE,
    FATSECRET_CLIENT_ID,
    FATSECRET_CLIENT_SECRET,
    FATSECRET_TOKEN_URL,
)

logger = logging.getLogger(__name__)

# In-memory token cache (per process)
_token: Optional[str] = None
_token_expires_at: float = 0.0
TOKEN_BUFFER_SECONDS = 60

# FatSecret REST v5 base (get food by ID)
FATSECRET_FOOD_V5_BASE = "https://platform.fatsecret.com/rest/food/v5"


def _is_configured() -> bool:
    return bool(FATSECRET_CLIENT_ID and FATSECRET_CLIENT_SECRET)


def _get_access_token() -> Optional[str]:
    """Get OAuth2 client_credentials token; cache until near expiry."""
    global _token, _token_expires_at
    if not _is_configured():
        return None
    now = time.time()
    if _token and now < _token_expires_at - TOKEN_BUFFER_SECONDS:
        return _token
    try:
        with httpx.Client() as client:
            r = client.post(
                FATSECRET_TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "scope": "basic",
                },
                auth=(FATSECRET_CLIENT_ID, FATSECRET_CLIENT_SECRET),
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=10.0,
            )
            r.raise_for_status()
            data = r.json()
            _token = data.get("access_token")
            expires_in = int(data.get("expires_in", 3600))
            _token_expires_at = now + expires_in
            return _token
    except Exception as e:
        logger.warning("FatSecret token request failed: %s", e)
        _token = None
        return None


def _api_request(method: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Call FatSecret REST API with given method and params."""
    token = _get_access_token()
    if not token:
        return {"error": "FatSecret not configured or token failed"}
    params = dict(params or {})
    params["method"] = method
    params["format"] = "json"
    try:
        with httpx.Client() as client:
            r = client.post(
                FATSECRET_API_BASE,
                data=params,
                headers={"Authorization": f"Bearer {token}"},
                timeout=15.0,
            )
            r.raise_for_status()
            return r.json()
    except httpx.HTTPStatusError as e:
        logger.warning("FatSecret API error %s: %s", e.response.status_code, e.response.text)
        return {"error": f"FatSecret API error: {e.response.status_code}"}
    except Exception as e:
        logger.warning("FatSecret API request failed: %s", e)
        return {"error": str(e)}


def get_food_by_id(food_id: str) -> Dict[str, Any]:
    """
    Get a single food by ID (FatSecret REST v5).
    GET .../rest/food/v5?food_id=X&format=json with Bearer token.
    """
    token = _get_access_token()
    if not token:
        return {"error": "FatSecret not configured or token failed"}
    try:
        with httpx.Client() as client:
            r = client.get(
                FATSECRET_FOOD_V5_BASE,
                params={"food_id": food_id, "format": "json"},
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                timeout=15.0,
            )
            r.raise_for_status()
            return r.json()
    except httpx.HTTPStatusError as e:
        logger.warning("FatSecret get food %s: %s %s", food_id, e.response.status_code, e.response.text)
        return {"error": f"FatSecret API error: {e.response.status_code}"}
    except Exception as e:
        logger.warning("FatSecret get_food_by_id failed: %s", e)
        return {"error": str(e)}


def search_foods(query: str, page: int = 0, max_results: int = 20) -> Dict[str, Any]:
    """Search foods. Returns raw API response or error dict."""
    return _api_request(
        "foods.search",
        {"search_expression": query, "page_number": page, "max_results": max_results},
    )


def log_food(
    food_id: str,
    food_name: str,
    meal_type: str = "Lunch",
    number_units: float = 1.0,
    serving_id: Optional[str] = None,
    date: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Log a food entry (food_entries.create). Caller can then store the result in Firebase.
    date: YYYY-MM-DD; default today.
    """
    params = {
        "food_id": food_id,
        "food_name": food_name,
        "meal": meal_type,
        "number_units": number_units,
    }
    if serving_id:
        params["serving_id"] = serving_id
    if date:
        params["date"] = date
    return _api_request("food_entries.create", params)
