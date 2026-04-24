"""Tests for nutrient validator."""

import pytest

from app.services.validator import NutrientValidator
from app.schemas.recipe import NutrientTotals, ParsedIngredient


class TestNutrientValidator:
    """Test nutrient validator functionality."""
    
    def test_calorie_check_pass(self):
        """Test calorie check with valid data."""
        totals = NutrientTotals(
            calories=400,
            protein_g=50,  # 50 * 4 = 200
            carbohydrates_g=25,  # 25 * 4 = 100
            fat_g=11.1,  # 11.1 * 9 = ~100
        )
        
        result = NutrientValidator._check_calories(totals)
        
        assert result["passed"]
        assert result["macros_calories"] == pytest.approx(400, rel=0.1)
    
    def test_calorie_check_fail(self):
        """Test calorie check with invalid data."""
        totals = NutrientTotals(
            calories=1000,  # Way too high
            protein_g=50,  # 200 cal
            carbohydrates_g=25,  # 100 cal
            fat_g=11.1,  # 100 cal
            # Total from macros should be ~400
        )
        
        result = NutrientValidator._check_calories(totals)
        
        assert not result["passed"]
        assert result["delta_percent"] > NutrientValidator.CALORIE_DELTA_THRESHOLD * 100
    
    def test_mass_check_pass(self):
        """Test mass check with valid data."""
        totals = NutrientTotals(
            protein_g=50,
            carbohydrates_g=25,
            fat_g=10,
            fiber_g=5,
        )
        
        result = NutrientValidator._check_mass(totals, total_mass_g=200)
        
        # Sum is 90g, total is 200g, ratio is 0.45
        assert result["passed"]
    
    def test_mass_check_fail(self):
        """Test mass check with invalid data."""
        totals = NutrientTotals(
            protein_g=100,
            carbohydrates_g=100,
            fat_g=100,
            fiber_g=50,
        )
        
        result = NutrientValidator._check_mass(totals, total_mass_g=200)
        
        # Sum is 350g, total is 200g, ratio is 1.75
        assert not result["passed"]
    
    def test_check_missing_nutrients(self):
        """Test checking for missing nutrients."""
        totals = NutrientTotals(
            protein_g=50,
            carbohydrates_g=25,
            # Missing fat and calories
        )
        
        missing = NutrientValidator._check_missing_nutrients(totals)
        
        assert "Fat" in missing
        assert "Calories" in missing
        assert "Protein" not in missing
    
    def test_validate_complete(self):
        """Test complete validation."""
        totals = NutrientTotals(
            calories=400,
            protein_g=50,
            carbohydrates_g=25,
            fat_g=11.1,
            fiber_g=5,
        )
        
        parsed_ingredients = [
            ParsedIngredient(
                original_text="200g chicken",
                quantity=200,
                unit="g",
                ingredient_name="chicken",
                ingredient_id=1,
                mass_g=200.0,
                confidence=0.95,
                warnings=[]
            )
        ]
        
        result = NutrientValidator.validate(totals, parsed_ingredients, 200.0)
        
        assert result.calorie_check_passed
        assert result.mass_check_passed
        assert len(result.errors) == 0
    
    def test_validate_low_confidence_warning(self):
        """Test validation warns about low confidence ingredients."""
        totals = NutrientTotals(
            calories=400,
            protein_g=50,
            carbohydrates_g=25,
            fat_g=11.1,
        )
        
        parsed_ingredients = [
            ParsedIngredient(
                original_text="some weird ingredient",
                quantity=100,
                unit="g",
                ingredient_name="unknown",
                ingredient_id=None,
                mass_g=100.0,
                confidence=0.5,  # Low confidence
                warnings=["Could not find ingredient"]
            )
        ]
        
        result = NutrientValidator.validate(totals, parsed_ingredients, 100.0)
        
        assert len(result.warnings) > 0
        assert any("Low confidence" in w or "Could not find" in w for w in result.warnings)
