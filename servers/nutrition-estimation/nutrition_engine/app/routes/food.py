"""FatSecret proxy: search and log. Keys stay on server."""

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth import require_auth
from app.config import FATSECRET_CLIENT_ID, FATSECRET_CLIENT_SECRET
from app.fatsecret_client import get_food_by_id, log_food, search_foods
from app.schemas import FoodLogRequest

router = APIRouter(prefix="/food", tags=["food"], dependencies=[Depends(require_auth)])


def _fatsecret_configured() -> bool:
    return bool(FATSECRET_CLIENT_ID and FATSECRET_CLIENT_SECRET)


@router.get("/search")
def food_search(
    q: str = Query(..., min_length=1, description="Search query"),
    page: int = Query(0, ge=0),
    max_results: int = Query(20, ge=1, le=50),
) -> Dict[str, Any]:
    """
    Search foods via FatSecret. Frontend calls this instead of FatSecret directly.
    Returns FatSecret search response (foods list) or error.
    """
    if not _fatsecret_configured():
        raise HTTPException(
            status_code=503,
            detail="FatSecret proxy not configured (set FATSECRET_CLIENT_ID and FATSECRET_CLIENT_SECRET)",
        )
    result = search_foods(query=q, page=page, max_results=max_results)
    if "error" in result:
        raise HTTPException(status_code=502, detail=result["error"])
    return result


@router.get("/{food_id}")
def food_get_by_id(food_id: str) -> Dict[str, Any]:
    """
    Get a single food by FatSecret ID (REST v5). Frontend calls this for details.
    """
    if not _fatsecret_configured():
        raise HTTPException(
            status_code=503,
            detail="FatSecret proxy not configured (set FATSECRET_CLIENT_ID and FATSECRET_CLIENT_SECRET)",
        )
    result = get_food_by_id(food_id=food_id)
    if "error" in result:
        raise HTTPException(status_code=502, detail=result["error"])
    return result


@router.post("/log")
def food_log(body: FoodLogRequest) -> Dict[str, Any]:
    """
    Log a food entry via FatSecret. Frontend then stores the returned entry (or summary)
    in Firebase for day/week views. Returns FatSecret response or error.
    body.date: YYYY-MM-DD (default: today).
    """
    if not _fatsecret_configured():
        raise HTTPException(
            status_code=503,
            detail="FatSecret proxy not configured (set FATSECRET_CLIENT_ID and FATSECRET_CLIENT_SECRET)",
        )
    result = log_food(
        food_id=body.food_id,
        food_name=body.food_name,
        meal_type=body.meal_type,
        number_units=body.number_units,
        serving_id=body.serving_id,
        date=body.date,
    )
    if "error" in result:
        raise HTTPException(status_code=502, detail=result["error"])
    return result
