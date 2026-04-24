"""Tests for API endpoints."""

import pytest


class TestHealthEndpoint:
    """Test health check endpoint."""
    
    def test_health_check(self, client):
        """Test health check returns 200."""
        response = client.get("/health")
        
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


class TestRootEndpoint:
    """Test root endpoint."""
    
    def test_root(self, client):
        """Test root endpoint returns welcome message."""
        response = client.get("/")
        
        assert response.status_code == 200
        assert "Nutrition Calculator" in response.json()["message"]


class TestRecipeEndpoint:
    """Test recipe analysis endpoint."""
    
    def test_analyze_recipe_success(self, client, full_test_data):
        """Test analyzing a recipe successfully."""
        # Override API key verification for test
        from app.core.security import verify_api_key
        
        async def mock_verify_api_key():
            return "test-key"
        
        from app.main import app
        app.dependency_overrides[verify_api_key] = mock_verify_api_key
        
        response = client.post(
            "/api/v1/recipe/analyze",
            json={
                "ingredients": ["200 grams chicken breast"],
                "cooking_method": "baked",
                "servings": 1
            },
            headers={"X-API-Key": "test-key"}
        )
        
        app.dependency_overrides.clear()
        
        assert response.status_code == 200
        data = response.json()
        
        assert "totals" in data
        assert "parsed_ingredients" in data
        assert "audit_trail" in data
        assert "validation" in data
        
        # Check parsed ingredient
        assert len(data["parsed_ingredients"]) == 1
        parsed = data["parsed_ingredients"][0]
        assert parsed["quantity"] == 200.0
        assert parsed["unit"] == "grams"
    
    def test_analyze_recipe_invalid_input(self, client):
        """Test analyzing recipe with invalid input."""
        from app.core.security import verify_api_key
        
        async def mock_verify_api_key():
            return "test-key"
        
        from app.main import app
        app.dependency_overrides[verify_api_key] = mock_verify_api_key
        
        response = client.post(
            "/api/v1/recipe/analyze",
            json={
                "ingredients": [],  # Empty ingredients
                "cooking_method": "baked"
            },
            headers={"X-API-Key": "test-key"}
        )
        
        app.dependency_overrides.clear()
        
        assert response.status_code == 422  # Validation error


class TestIngredientsEndpoint:
    """Test ingredients search endpoint."""
    
    def test_search_ingredients(self, client, sample_ingredient):
        """Test searching for ingredients."""
        from app.core.security import verify_api_key
        
        async def mock_verify_api_key():
            return "test-key"
        
        from app.main import app
        app.dependency_overrides[verify_api_key] = mock_verify_api_key
        
        response = client.get(
            "/api/v1/ingredients/search?q=chicken",
            headers={"X-API-Key": "test-key"}
        )
        
        app.dependency_overrides.clear()
        
        assert response.status_code == 200
        data = response.json()
        
        assert "results" in data
        assert "query" in data
        assert data["query"] == "chicken"
        assert data["total"] >= 0
    
    def test_get_ingredient_nutrients(self, client, full_test_data):
        """Test getting nutrient profile for ingredient."""
        from app.core.security import verify_api_key
        
        async def mock_verify_api_key():
            return "test-key"
        
        from app.main import app
        app.dependency_overrides[verify_api_key] = mock_verify_api_key
        
        ingredient_id = full_test_data["ingredient"].id
        
        response = client.get(
            f"/api/v1/ingredients/{ingredient_id}/nutrients",
            headers={"X-API-Key": "test-key"}
        )
        
        app.dependency_overrides.clear()
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return list of nutrients
        assert isinstance(data, list)
        
        if len(data) > 0:
            nutrient = data[0]
            assert "nutrient_id" in nutrient
            assert "nutrient_name" in nutrient
            assert "amount_per_100g" in nutrient
            assert "unit" in nutrient
    
    def test_get_ingredient_nutrients_not_found(self, client):
        """Test getting nutrients for non-existent ingredient."""
        from app.core.security import verify_api_key
        
        async def mock_verify_api_key():
            return "test-key"
        
        from app.main import app
        app.dependency_overrides[verify_api_key] = mock_verify_api_key
        
        response = client.get(
            "/api/v1/ingredients/99999/nutrients",
            headers={"X-API-Key": "test-key"}
        )
        
        app.dependency_overrides.clear()
        
        assert response.status_code == 404
