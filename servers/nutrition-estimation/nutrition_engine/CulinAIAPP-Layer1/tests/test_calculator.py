"""Tests for nutrient calculator."""

import pytest

from app.services.calculator import NutrientCalculator
from app.schemas.recipe import ParsedIngredient


class TestNutrientCalculator:
    """Test nutrient calculator functionality."""
    
    def test_calculate_recipe_simple(self, db, full_test_data):
        """Test calculating nutrients for a simple recipe."""
        calculator = NutrientCalculator(db)
        
        parsed_ingredients = [
            ParsedIngredient(
                original_text="200g chicken breast",
                quantity=200,
                unit="g",
                ingredient_name="chicken breast",
                ingredient_id=full_test_data["ingredient"].id,
                mass_g=200.0,
                confidence=1.0,
                warnings=[]
            )
        ]
        
        totals, audit_trail = calculator.calculate_recipe(
            parsed_ingredients,
            cooking_method="baked"
        )
        
        # Should have protein calculated
        assert totals.protein_g is not None
        assert totals.protein_g > 0
        
        # Check audit trail
        assert len(audit_trail) > 0
        assert audit_trail[0].ingredient_name == "chicken breast"
        assert audit_trail[0].mass_g == 200.0
    
    def test_get_nutrient_profile(self, db, full_test_data):
        """Test getting nutrient profile for ingredient."""
        calculator = NutrientCalculator(db)
        
        profile = calculator._get_nutrient_profile(
            full_test_data["ingredient"].id,
            full_test_data["cooking_method"]
        )
        
        # Should find the nutrient
        assert full_test_data["nutrient"].id in profile
        amount, fdc_id = profile[full_test_data["nutrient"].id]
        assert amount == 31.0  # From sample_food_nutrient
        assert fdc_id == full_test_data["usda_food"].fdc_id
    
    def test_get_retention_factor(self, db, full_test_data):
        """Test getting retention factor."""
        calculator = NutrientCalculator(db)
        
        factor = calculator._get_retention_factor(
            full_test_data["nutrient"].id,
            full_test_data["cooking_method"]
        )
        
        assert factor == 0.95  # From sample_retention_factor
    
    def test_get_retention_factor_default(self, db, sample_nutrient, sample_cooking_method):
        """Test default retention factor when specific not found."""
        calculator = NutrientCalculator(db)
        
        # Create a nutrient without retention factor
        from app.db.models import Nutrient
        nutrient = Nutrient(
            name="Test Nutrient",
            unit="mg",
            nutrient_number="9999"
        )
        db.add(nutrient)
        db.commit()
        
        factor = calculator._get_retention_factor(
            nutrient.id,
            sample_cooking_method
        )
        
        assert factor == calculator.DEFAULT_RETENTION
    
    def test_calculate_with_retention(self, db, full_test_data):
        """Test that retention factors are applied."""
        calculator = NutrientCalculator(db)
        
        parsed_ingredients = [
            ParsedIngredient(
                original_text="100g chicken breast",
                quantity=100,
                unit="g",
                ingredient_name="chicken breast",
                ingredient_id=full_test_data["ingredient"].id,
                mass_g=100.0,
                confidence=1.0,
                warnings=[]
            )
        ]
        
        totals, audit_trail = calculator.calculate_recipe(
            parsed_ingredients,
            cooking_method="baked"
        )
        
        # Find protein in audit trail
        protein_contrib = [a for a in audit_trail if a.nutrient_name == "Protein"][0]
        
        # Raw contribution should be 31g (100g * 31g/100g)
        assert protein_contrib.raw_contribution == pytest.approx(31.0, rel=0.01)
        
        # Final contribution should be reduced by retention factor (0.95)
        assert protein_contrib.final_contribution == pytest.approx(31.0 * 0.95, rel=0.01)
        assert protein_contrib.retention_factor == 0.95
