"""Application configuration. No per-request disk or network."""

import os
from pathlib import Path
from typing import Optional

# Load nutrition_engine/.env before any os.environ reads (uvicorn does not load .env by default).
try:
    from dotenv import load_dotenv

    _ENGINE_ROOT = Path(__file__).resolve().parent.parent
    load_dotenv(_ENGINE_ROOT / ".env")
except ImportError:
    pass

# Base path for artifacts (set at startup; no disk read after)
ARTIFACTS_ROOT = Path(os.environ.get("NUTRITION_ARTIFACTS", "artifacts")).resolve()

LAYER1_ARTIFACTS = ARTIFACTS_ROOT / "layer1"
LAYER2_ARTIFACTS = ARTIFACTS_ROOT / "layer2"
LAYER3_ARTIFACTS = ARTIFACTS_ROOT / "layer3"

CACHE_MAXSIZE = int(os.environ.get("NUTRITION_CACHE_MAXSIZE", "10000"))

# Gunicorn workers (each loads L2/L3 at startup; 2 is a good default for latency + redundancy)
WORKER_COUNT = int(os.environ.get("NUTRITION_WORKERS", "2"))

# FatSecret API (optional: only used when set; proxy routes return 503 when unset)
FATSECRET_CLIENT_ID: Optional[str] = os.environ.get("FATSECRET_CLIENT_ID")
FATSECRET_CLIENT_SECRET: Optional[str] = os.environ.get("FATSECRET_CLIENT_SECRET")
FATSECRET_API_BASE: str = os.environ.get("FATSECRET_API_BASE", "https://platform.fatsecret.com/rest/server.api")
FATSECRET_TOKEN_URL: str = os.environ.get("FATSECRET_TOKEN_URL", "https://oauth.fatsecret.com/connect/token")

# CORS: comma-separated origins (e.g. https://myapp.com) or "*" to allow all (dev only).
# In production, set CORS_ORIGINS explicitly; default "*" is only safe for local dev.
CORS_ORIGINS: str = os.environ.get("CORS_ORIGINS", "*")

# API key auth: comma-separated list of valid keys. Empty = auth disabled (dev only).
API_KEYS: frozenset[str] = frozenset(
    k.strip() for k in os.environ.get("API_KEYS", "").split(",") if k.strip()
)

# Rate limiting: max requests per key per window. 0 = disabled.
RATE_LIMIT_RPM: int = int(os.environ.get("RATE_LIMIT_RPM", "30"))  # requests per minute

# Cognito JWT auth (mobile app). Pool ID implies region and JWKS URL.
COGNITO_USER_POOL_ID: Optional[str] = os.environ.get("COGNITO_USER_POOL_ID")
COGNITO_REGION: str = os.environ.get("COGNITO_REGION", "us-east-1")

# LLM provider for Layer 0 (free-text → structured request)
LLM_PROVIDER: str = os.environ.get("LLM_PROVIDER", "gemini")
LLM_API_KEY: Optional[str] = os.environ.get("LLM_API_KEY")
LLM_MODEL: Optional[str] = os.environ.get("LLM_MODEL")  # provider-specific default when None

# Layer 0 Gemini — spikes in demand cause 429/503; allow longer waits + more retries than old 10s/1-retry defaults.
GEMINI_TIMEOUT_S: int = max(10, int(os.environ.get("GEMINI_TIMEOUT_S", "45")))
GEMINI_MAX_RETRIES: int = max(0, int(os.environ.get("GEMINI_MAX_RETRIES", "3")))

# PostgreSQL connection string for user profiles (same RDS instance as Layer 1).
DATABASE_URL: Optional[str] = os.environ.get("DATABASE_URL")


def _env_truthy(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


# When true, POST /estimate and /estimate-from-text memoize responses (same body → same answer).
# Default off so repeat logs always re-run the engine (LLM + layers can drift / improve).
# Enable in high-traffic prod if needed: NUTRITION_ESTIMATE_CACHE=1
ESTIMATE_CACHE_ENABLED: bool = _env_truthy("NUTRITION_ESTIMATE_CACHE", default=False)

# POST /estimate-from-text — one Gemini macro call (fast v1). Default off: Layer 0 + L1–L2 (USDA-backed).
ESTIMATE_SIMPLE_LLM: bool = _env_truthy("ESTIMATE_SIMPLE_LLM", default=False)

# Final Gemini pass: validate / revise macros (default: always when LLM is configured).
# Opt out entirely: NUTRITION_LLM_MACRO_POLISH=0. Only when automated checks flag issues: NUTRITION_LLM_MACRO_POLISH_ALWAYS=0
NUTRITION_LLM_MACRO_POLISH: bool = _env_truthy("NUTRITION_LLM_MACRO_POLISH", default=True)
NUTRITION_LLM_MACRO_POLISH_ALWAYS: bool = _env_truthy("NUTRITION_LLM_MACRO_POLISH_ALWAYS", default=True)


def _resolve_layer3_enabled() -> bool:
    """Layer 3 similarity refinement — dev / optional. Prefer NUTRITION_ENABLE_LAYER3; else LAYER3_ENABLED."""
    raw = os.environ.get("NUTRITION_ENABLE_LAYER3")
    if raw is not None and str(raw).strip() != "":
        return str(raw).strip().lower() in ("1", "true", "yes", "on")
    return _env_truthy("LAYER3_ENABLED", default=False)


# When false (default): engine uses L2 macros as final output; startup skips L3 embedding load.
ENABLE_LAYER3: bool = _resolve_layer3_enabled()
