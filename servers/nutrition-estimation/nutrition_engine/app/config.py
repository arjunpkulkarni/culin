"""Application configuration. No per-request disk or network."""

import os
from pathlib import Path
from typing import Optional

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

# PostgreSQL connection string for user profiles (same RDS instance as Layer 1).
DATABASE_URL: Optional[str] = os.environ.get("DATABASE_URL")
