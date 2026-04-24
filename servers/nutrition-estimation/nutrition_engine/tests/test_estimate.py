"""POST /estimate: request shape and response shape (with mocked pipeline)."""

import pytest


def test_estimate_returns_200_and_macros(client, mock_estimate_nutrition):
    r = client.post(
        "/estimate",
        json={
            "item_name": "Grilled Chicken",
            "description": "Chicken breast with herbs",
            "restaurant": "Cafe One",
            "price": 12.99,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert "macros" in data
    assert "confidence" in data
    assert set(data["macros"]) >= {"calories", "fat", "carbs", "protein", "sodium"}
    assert isinstance(data["confidence"], (int, float))
    assert data["macros"]["calories"] == mock_estimate_nutrition["macros"]["calories"]


def test_estimate_invalid_body_returns_422(client):
    r = client.post("/estimate", json={"item_name": "Only name, no description"})
    assert r.status_code == 422


def test_estimate_empty_body_returns_422(client):
    r = client.post("/estimate", json={})
    assert r.status_code == 422
