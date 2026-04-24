"""User profile routes.

GET  /api/user/profile  — fetch profile; returns {email, onboarding_completed: false}
                          for brand-new Cognito users with no DB record yet.
POST /api/user/profile  — upsert profile keyed on cognito_sub (stable JWT claim).
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/user", tags=["user"])


def _profile_log(
    request: Request,
    sub: str,
    endpoint: str,
    result: str,
    error: Optional[str] = None,
) -> None:
    request_id = getattr(request.state, "request_id", "missing")
    if error:
        logger.error(
            "request_id=%s cognito_sub=%s endpoint=%s result=%s error=%s",
            request_id,
            sub,
            endpoint,
            result,
            error,
        )
        return
    logger.info(
        "request_id=%s cognito_sub=%s endpoint=%s result=%s",
        request_id,
        sub,
        endpoint,
        result,
    )


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ProfileResponse(BaseModel):
    profile: Dict[str, Any]


class ProfileWriteRequest(BaseModel):
    display_name:         Optional[str]       = None
    date_of_birth:        Optional[str]       = None  # YYYY-MM-DD
    height:               Optional[float]     = None  # cm
    weight:               Optional[float]     = None  # kg
    sex:                  Optional[str]       = None  # M / F / Other
    goals:                Optional[List[str]] = Field(default_factory=list)
    health_conditions:    Optional[List[str]] = Field(default_factory=list)
    photo_url:            Optional[str]       = None
    onboarding_completed: Optional[bool]      = None


# ---------------------------------------------------------------------------
# GET /api/user/profile
# ---------------------------------------------------------------------------

@router.get("/profile", response_model=ProfileResponse)
def get_profile(request: Request, claims: Dict[str, Any] = Depends(get_current_user)):
    """Return the caller's profile.

    * Existing user  → HTTP 200 with full profile row.
    * New user (no DB record yet) → HTTP 200 with ``{email, onboarding_completed: false}``.
      The email is taken directly from the JWT — no DB record required.
      This ensures the frontend can always route new users to onboarding.
    """
    sub   = claims.get("sub", "")
    email = claims.get("email") or claims.get("cognito:username") or claims.get("username")

    try:
        from app import db as _db
        row = _db.get_profile(sub)
    except Exception as exc:
        _profile_log(
            request=request,
            sub=sub,
            endpoint="GET /api/user/profile",
            result="error",
            error=str(exc),
        )
        raise HTTPException(status_code=500, detail="Failed to fetch profile.")

    if row is not None:
        _profile_log(
            request=request,
            sub=sub,
            endpoint="GET /api/user/profile",
            result="found",
        )
        return {"profile": row}

    # Brand-new user: return enough info for the frontend to route to onboarding.
    _profile_log(
        request=request,
        sub=sub,
        endpoint="GET /api/user/profile",
        result="not_found",
    )
    return {
        "profile": {
            "email":                email,
            "onboarding_completed": False,
        }
    }


# ---------------------------------------------------------------------------
# POST /api/user/profile  (upsert — safe to call multiple times)
# ---------------------------------------------------------------------------

@router.post("/profile", response_model=ProfileResponse)
def save_profile(
    request: Request,
    body: ProfileWriteRequest,
    claims: Dict[str, Any] = Depends(get_current_user),
):
    """Create or update the caller's profile (upsert on cognito_sub).

    Safe to call multiple times — re-submitting after a crash during onboarding
    will update the existing row rather than raising a duplicate-key error.
    """
    sub   = claims.get("sub", "")
    email = claims.get("email") or claims.get("cognito:username") or claims.get("username")

    if not sub:
        _profile_log(
            request=request,
            sub="missing",
            endpoint="POST /api/user/profile",
            result="auth_error",
            error="missing sub claim",
        )
        raise HTTPException(status_code=401, detail="Could not determine user identity from token.")

    data: Dict[str, Any] = {
        "cognito_sub":          sub,
        "email":                email,
        "display_name":         body.display_name,
        "date_of_birth":        body.date_of_birth,
        "height":               body.height,
        "weight":               body.weight,
        "sex":                  body.sex,
        "goals":                body.goals or [],
        "health_conditions":    body.health_conditions or [],
        "photo_url":            body.photo_url,
        "onboarding_completed": body.onboarding_completed if body.onboarding_completed is not None else False,
    }

    try:
        from app import db as _db
        existing = _db.get_profile(sub)
        saved = _db.upsert_profile(data)
    except Exception as exc:
        _profile_log(
            request=request,
            sub=sub,
            endpoint="POST /api/user/profile",
            result="error",
            error=str(exc),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save profile: {exc}",
        )

    _profile_log(
        request=request,
        sub=sub,
        endpoint="POST /api/user/profile",
        result="updated" if existing else "created",
    )
    return {"profile": saved}
