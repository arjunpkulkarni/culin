"""Shared database access for user profiles.

Uses the same DATABASE_URL as Layer 1 (the AWS RDS PostgreSQL instance).
The engine is created lazily on first use so that missing config doesn't crash
workers that never touch the user-profile routes.
"""

import json
import logging
from contextlib import contextmanager
from typing import Generator, Optional

logger = logging.getLogger(__name__)

_engine = None
_conn_factory = None  # raw psycopg2 connection via engine.raw_connection()


def _get_engine():
    global _engine
    if _engine is not None:
        return _engine

    from app.config import DATABASE_URL  # imported here to keep module-level imports clean

    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured — cannot open user-profile DB.")

    try:
        from sqlalchemy import create_engine

        connect_args: dict = {}
        if "sslmode" not in DATABASE_URL and "postgresql" in DATABASE_URL:
            connect_args["sslmode"] = "require"

        _engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            connect_args=connect_args,
        )
        logger.info("User-profile DB engine initialised.")
    except Exception as exc:
        logger.error("Failed to initialise user-profile DB engine: %s", exc)
        raise

    return _engine


@contextmanager
def _get_cursor() -> Generator:
    """Yield a psycopg2 cursor via the SQLAlchemy connection pool.

    Uses raw_connection() so we can use psycopg2's native ``%s`` / ``%(key)s``
    parameter style without wrapping every query in ``sqlalchemy.text()``.
    Commits on success, rolls back on error, always closes.
    """
    engine = _get_engine()
    conn = engine.raw_connection()
    try:
        cur = conn.cursor()
        yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# DDL — create the user_profiles table if it doesn't exist
# ---------------------------------------------------------------------------

_CREATE_PROFILES_SQL = """
CREATE TABLE IF NOT EXISTS user_profiles (
    cognito_sub          TEXT        PRIMARY KEY,
    email                TEXT,
    display_name         TEXT,
    onboarding_completed BOOLEAN     NOT NULL DEFAULT FALSE,
    date_of_birth        DATE,
    height               FLOAT,
    weight               FLOAT,
    sex                  TEXT,
    goals                JSONB,
    health_conditions    JSONB,
    photo_url            TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""

_CREATE_UPDATED_AT_TRIGGER_SQL = """
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_profiles_updated_at'
    ) THEN
        CREATE TRIGGER trg_user_profiles_updated_at
        BEFORE UPDATE ON user_profiles
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END;
$$;
"""


def create_tables() -> None:
    """Create user_profiles table (idempotent). Called once at startup."""
    try:
        with _get_cursor() as cur:
            cur.execute(_CREATE_PROFILES_SQL)
            cur.execute(_CREATE_UPDATED_AT_TRIGGER_SQL)
        logger.info("user_profiles table ready.")
    except Exception as exc:
        # Non-fatal: routes will 500 if the table is missing, but we
        # don't want to block the nutrition endpoints from starting.
        logger.error("Could not create user_profiles table: %s", exc)


# ---------------------------------------------------------------------------
# Query helpers
# ---------------------------------------------------------------------------

_SELECT_PROFILE = """
SELECT cognito_sub, email, display_name, onboarding_completed,
       date_of_birth, height, weight, sex, goals, health_conditions,
       photo_url, created_at
FROM   user_profiles
WHERE  cognito_sub = %s
"""

_UPSERT_PROFILE = """
INSERT INTO user_profiles
    (cognito_sub, email, display_name, onboarding_completed,
     date_of_birth, height, weight, sex, goals, health_conditions, photo_url)
VALUES
    (%(cognito_sub)s, %(email)s, %(display_name)s, %(onboarding_completed)s,
     %(date_of_birth)s, %(height)s, %(weight)s, %(sex)s,
     %(goals)s::jsonb, %(health_conditions)s::jsonb, %(photo_url)s)
ON CONFLICT (cognito_sub) DO UPDATE SET
    email                = EXCLUDED.email,
    display_name         = EXCLUDED.display_name,
    onboarding_completed = EXCLUDED.onboarding_completed,
    date_of_birth        = EXCLUDED.date_of_birth,
    height               = EXCLUDED.height,
    weight               = EXCLUDED.weight,
    sex                  = EXCLUDED.sex,
    goals                = EXCLUDED.goals,
    health_conditions    = EXCLUDED.health_conditions,
    photo_url            = EXCLUDED.photo_url
RETURNING cognito_sub, email, display_name, onboarding_completed,
          date_of_birth, height, weight, sex, goals, health_conditions,
          photo_url, created_at
"""


def get_profile(cognito_sub: str) -> Optional[dict]:
    """Return the profile row as a dict, or None if not found."""
    with _get_cursor() as cur:
        cur.execute(_SELECT_PROFILE, (cognito_sub,))
        row = cur.fetchone()
    if row is None:
        return None
    return _row_to_dict(row)


def upsert_profile(data: dict) -> dict:
    """Insert or update a profile row. Returns the saved row as a dict."""
    params = {
        "cognito_sub":          data["cognito_sub"],
        "email":                data.get("email"),
        "display_name":         data.get("display_name"),
        "onboarding_completed": bool(data.get("onboarding_completed", False)),
        "date_of_birth":        data.get("date_of_birth"),
        "height":               data.get("height"),
        "weight":               data.get("weight"),
        "sex":                  data.get("sex"),
        "goals":                json.dumps(data.get("goals") or []),
        "health_conditions":    json.dumps(data.get("health_conditions") or []),
        "photo_url":            data.get("photo_url"),
    }
    with _get_cursor() as cur:
        cur.execute(_UPSERT_PROFILE, params)
        row = cur.fetchone()
    return _row_to_dict(row)


def _row_to_dict(row) -> dict:
    keys = [
        "cognito_sub", "email", "display_name", "onboarding_completed",
        "date_of_birth", "height", "weight", "sex",
        "goals", "health_conditions", "photo_url", "created_at",
    ]
    d = dict(zip(keys, row))
    if d.get("date_of_birth") is not None:
        d["date_of_birth"] = str(d["date_of_birth"])
    if d.get("created_at") is not None:
        d["created_at"] = d["created_at"].isoformat()
    for col in ("goals", "health_conditions"):
        if isinstance(d[col], str):
            d[col] = json.loads(d[col]) if d[col] else []
        elif d[col] is None:
            d[col] = []
    return d
