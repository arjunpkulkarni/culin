"""Tests for ingredient parser."""

import pytest

from app.services.parser import IngredientParser


class TestIngredientParser:
    """Test ingredient parser functionality."""
    
    def test_extract_quantity_decimal(self, db):
        """Test extracting decimal quantity."""
        parser = IngredientParser(db)
        quantity, rest = parser._extract_quantity("2.5 cups flour")
        
        assert quantity == 2.5
        assert rest == "cups flour"
    
    def test_extract_quantity_fraction(self, db):
        """Test extracting fraction quantity."""
        parser = IngredientParser(db)
        quantity, rest = parser._extract_quantity("1/2 cup flour")
        
        assert quantity == 0.5
        assert rest == "cup flour"
    
    def test_extract_quantity_mixed_number(self, db):
        """Test extracting mixed number quantity."""
        parser = IngredientParser(db)
        quantity, rest = parser._extract_quantity("1 1/2 cups flour")
        
        assert quantity == 1.5
        assert rest == "cups flour"
    
    def test_extract_quantity_word(self, db):
        """Test extracting word quantity."""
        parser = IngredientParser(db)
        quantity, rest = parser._extract_quantity("one cup flour")
        
        assert quantity == 1.0
        assert rest == "cup flour"
    
    def test_extract_unit_weight(self, db):
        """Test extracting weight unit."""
        parser = IngredientParser(db)
        unit, rest = parser._extract_unit("grams chicken")
        
        assert unit == "grams"
        assert rest == "chicken"
    
    def test_extract_unit_volume(self, db):
        """Test extracting volume unit."""
        parser = IngredientParser(db)
        unit, rest = parser._extract_unit("cups flour")
        
        assert unit == "cups"
        assert rest == "flour"
    
    def test_clean_ingredient_name(self, db):
        """Test cleaning ingredient name."""
        parser = IngredientParser(db)
        
        cleaned = parser._clean_ingredient_name("fresh chopped onion (diced)")
        assert "fresh" not in cleaned.lower()
        assert "chopped" not in cleaned.lower()
        assert "onion" in cleaned.lower()
    
    def test_parse_complete_ingredient(self, db, full_test_data):
        """Test parsing complete ingredient string."""
        parser = IngredientParser(db)
        
        result = parser.parse("1 piece chicken breast")
        
        assert result.quantity == 1.0
        assert result.unit == "piece"
        assert result.ingredient_id == full_test_data["ingredient"].id
        assert result.mass_g == 174.0  # From unit conversion
        assert result.confidence > 0.0
    
    def test_parse_with_no_quantity(self, db, full_test_data):
        """Test parsing ingredient without quantity."""
        parser = IngredientParser(db)
        
        result = parser.parse("chicken breast")
        
        assert result.quantity == 1.0  # Default
        assert "No quantity found" in result.warnings[0]
    
    def test_convert_to_grams_weight_unit(self, db):
        """Test converting weight units to grams."""
        parser = IngredientParser(db)
        
        grams = parser._convert_to_grams(100, "grams", "flour", None)
        assert grams == 100.0
        
        grams = parser._convert_to_grams(1, "kg", "flour", None)
        assert grams == 1000.0
    
    def test_convert_to_grams_volume_unit(self, db, sample_ingredient):
        """Test converting volume units to grams."""
        sample_ingredient.density_g_per_ml = 1.2
        db.commit()
        
        parser = IngredientParser(db)
        
        grams = parser._convert_to_grams(1, "cup", "test", sample_ingredient)
        # 1 cup = 237ml, density = 1.2 g/ml
        assert grams == pytest.approx(237 * 1.2, rel=0.01)
