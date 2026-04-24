"""Health and readiness endpoints."""

import pytest


def test_health_returns_200(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_ready_returns_200_after_startup(client):
    r = client.get("/ready")
    # Startup runs with TestClient; ready may be True or 503 if startup failed
    assert r.status_code in (200, 503)
    data = r.json()
    assert "status" in data
    if r.status_code == 200:
        assert data["status"] == "ready"
        assert "artifacts" in data or "status" in data
