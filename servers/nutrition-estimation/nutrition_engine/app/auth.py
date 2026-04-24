"""Authentication: Cognito JWT (mobile) + static API key (server-to-server) + rate limiting."""

import logging
import time
import threading
from collections import defaultdict
from typing import Any, Dict, Optional

import httpx
import jwt
from fastapi import HTTPException, Request, Security
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer

from app.config import API_KEYS, COGNITO_REGION, COGNITO_USER_POOL_ID, RATE_LIMIT_RPM

logger = logging.getLogger(__name__)

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
_bearer = HTTPBearer(auto_error=False)

# ---------------------------------------------------------------------------
# Cognito JWKS (cached in-memory; fetched once)
# ---------------------------------------------------------------------------
_jwks: Optional[Dict[str, Any]] = None
_jwks_lock = threading.Lock()


def _get_jwks_url() -> str:
    return f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}/.well-known/jwks.json"


def _fetch_jwks() -> Dict[str, Any]:
    """Fetch and cache Cognito JWKS. Called once per process lifetime."""
    global _jwks
    with _jwks_lock:
        if _jwks is not None:
            return _jwks
        url = _get_jwks_url()
        resp = httpx.get(url, timeout=5)
        resp.raise_for_status()
        _jwks = resp.json()
        logger.info("Cached Cognito JWKS from %s (%d keys)", url, len(_jwks.get("keys", [])))
        return _jwks


def _get_signing_key(token: str) -> jwt.algorithms.RSAAlgorithm:
    """Find the correct public key from JWKS for the given token's kid."""
    jwks = _fetch_jwks()
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    for key in jwks.get("keys", []):
        if key["kid"] == kid:
            return jwt.algorithms.RSAAlgorithm.from_jwk(key)
    raise HTTPException(status_code=401, detail="Token signing key not found in JWKS")


def _validate_cognito_token(token: str) -> Dict[str, Any]:
    """Validate a Cognito JWT and return its claims."""
    issuer = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}"
    public_key = _get_signing_key(token)
    try:
        claims = jwt.decode(
            token,
            key=public_key,
            algorithms=["RS256"],
            issuer=issuer,
            options={"verify_aud": False},  # Cognito access tokens don't have aud
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")

    token_use = claims.get("token_use")
    if token_use not in ("access", "id"):
        raise HTTPException(status_code=401, detail=f"Unexpected token_use: {token_use}")

    return claims


# ---------------------------------------------------------------------------
# Rate limiter (sliding window, per identity)
# ---------------------------------------------------------------------------
_WINDOW = 60.0
_lock = threading.Lock()
_hits: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(identity: str) -> None:
    if RATE_LIMIT_RPM <= 0:
        return
    now = time.monotonic()
    cutoff = now - _WINDOW
    with _lock:
        bucket = _hits[identity]
        _hits[identity] = bucket = [t for t in bucket if t > cutoff]
        if len(bucket) >= RATE_LIMIT_RPM:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded ({RATE_LIMIT_RPM} req/min). Try again shortly.",
            )
        bucket.append(now)


# ---------------------------------------------------------------------------
# FastAPI dependency: tries Bearer JWT first, then X-API-Key, then dev fallback
# ---------------------------------------------------------------------------
async def require_auth(
    bearer: Optional[HTTPAuthorizationCredentials] = Security(_bearer),
    api_key: Optional[str] = Security(_api_key_header),
) -> str:
    """Authenticate via Cognito JWT or static API key. Returns an identity string."""

    # 1. Cognito JWT (mobile app)
    if bearer and COGNITO_USER_POOL_ID:
        claims = _validate_cognito_token(bearer.credentials)
        identity = claims.get("sub", "cognito-user")
        _check_rate_limit(identity)
        return identity

    # 2. Static API key (server-to-server / scripts)
    if api_key and API_KEYS and api_key in API_KEYS:
        _check_rate_limit(f"apikey:{api_key[:8]}")
        return f"apikey:{api_key[:8]}"

    # 3. Dev mode: no auth configured at all
    if not API_KEYS and not COGNITO_USER_POOL_ID:
        return "dev"

    raise HTTPException(status_code=401, detail="Invalid or missing authentication")


async def get_current_user(
    bearer: Optional[HTTPAuthorizationCredentials] = Security(_bearer),
    api_key: Optional[str] = Security(_api_key_header),
) -> Dict[str, Any]:
    """Like require_auth but returns the full JWT claims dict.

    For Cognito tokens this includes at minimum: sub, email, token_use.
    For API-key or dev-mode paths, returns synthetic claims with no email.
    The ``sub`` field is always present and is the stable user identifier.
    """
    # 1. Cognito JWT → return full claims so callers can read email, etc.
    if bearer and COGNITO_USER_POOL_ID:
        claims = _validate_cognito_token(bearer.credentials)
        _check_rate_limit(claims.get("sub", "cognito-user"))
        return claims

    # 2. Static API key
    if api_key and API_KEYS and api_key in API_KEYS:
        key_id = f"apikey:{api_key[:8]}"
        _check_rate_limit(key_id)
        return {"sub": key_id}

    # 3. Dev mode
    if not API_KEYS and not COGNITO_USER_POOL_ID:
        return {"sub": "dev"}

    raise HTTPException(status_code=401, detail="Invalid or missing authentication")
