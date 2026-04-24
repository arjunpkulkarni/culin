"""FatSecret proxy routes: /food/search and /food/log (mocked)."""

import pytest


@pytest.fixture
def mock_fatsecret_configured():
    """Force routes to think FatSecret is configured so we can test with mocked client."""
    from unittest.mock import patch
    with patch("app.routes.food._fatsecret_configured", return_value=True):
        yield


@pytest.fixture
def mock_fatsecret_search(mock_fatsecret_configured):
    from unittest.mock import patch
    stub = {"foods": {"food": [{"food_id": "1", "food_name": "Chicken Breast", "food_description": "Grilled"}]}}
    with patch("app.routes.food.search_foods", return_value=stub):
        yield stub


@pytest.fixture
def mock_fatsecret_log(mock_fatsecret_configured):
    from unittest.mock import patch
    with patch("app.routes.food.log_food", return_value={"status": "ok"}):
        yield


def test_food_search_returns_200(client, mock_fatsecret_search):
    r = client.get("/food/search?q=chicken&max_results=5")
    assert r.status_code == 200
    data = r.json()
    assert "foods" in data and "food" in data["foods"]


def test_food_log_returns_200(client, mock_fatsecret_log):
    r = client.post(
        "/food/log",
        json={"food_id": "1", "food_name": "Chicken Breast", "meal_type": "Lunch", "number_units": 1},
    )
    assert r.status_code == 200


def test_food_log_missing_food_id_returns_422(client):
    r = client.post("/food/log", json={"food_name": "Chicken"})
    assert r.status_code == 422
