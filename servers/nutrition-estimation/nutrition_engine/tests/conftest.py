"""
Shared fixtures for engine tests.
Use TestClient so startup runs; layers may use fallback if artifacts are missing.
"""

import sys
from pathlib import Path

import pytest

# Ensure nutrition_engine is on path when running from repo root or nutrition_engine
_engine_root = Path(__file__).resolve().parent.parent
if str(_engine_root) not in sys.path:
    sys.path.insert(0, str(_engine_root))


@pytest.fixture
def client():
    """FastAPI TestClient. Startup runs (L2/L3 may be fallback if artifacts missing)."""
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture
def mock_estimate_nutrition():
    """Patch engine.estimate_nutrition so POST /estimate returns without calling real layers."""
    from unittest.mock import patch
    stub_response = {
        "macros": {"calories": 400, "fat": 15, "carbs": 35, "protein": 30, "sodium": 500},
        "confidence": 0.85,
        "debug": {},
    }
    with patch("app.cache.estimate_nutrition", return_value=stub_response):
        yield stub_response
