"""Test configuration and fixtures."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.db.session import Base, get_db
from app.main import app
from app.db.models import (
    Ingredient, IngredientSynonym, Nutrient, CookingMethod,
    RetentionFactor, UnitConversion, USDAFood, FoodNutrient
)

# Test database URL (use in-memory SQLite for tests)
TEST_DATABASE_URL = "sqlite:///:memory:"

# Create test engine
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False}
)

# Create test session factory
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def db():
    """Create a fresh database for each test."""
    # Create tables
    Base.metadata.create_all(bind=test_engine)
    
    # Create session
    session = TestSessionLocal()
    
    try:
        yield session
    finally:
        session.close()
        # Drop all tables after test
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def client(db):
    """Create a test client with database dependency override."""
    def override_get_db():
        try:
            yield db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()


@pytest.fixture
def sample_ingredient(db):
    """Create a sample ingredient."""
    ingredient = Ingredient(
        name="chicken breast",
        category="protein",
        density_g_per_ml=1.0
    )
    db.add(ingredient)
    db.commit()
    db.refresh(ingredient)
    return ingredient


@pytest.fixture
def sample_nutrient(db):
    """Create a sample nutrient."""
    nutrient = Nutrient(
        name="Protein",
        unit="g",
        nutrient_number="1003",
        rank=1
    )
    db.add(nutrient)
    db.commit()
    db.refresh(nutrient)
    return nutrient


@pytest.fixture
def sample_cooking_method(db):
    """Create a sample cooking method."""
    method = CookingMethod(
        name="baked",
        description="Baked in oven"
    )
    db.add(method)
    db.commit()
    db.refresh(method)
    return method


@pytest.fixture
def sample_usda_food(db, sample_ingredient):
    """Create a sample USDA food."""
    food = USDAFood(
        fdc_id=12345,
        description="Chicken, broilers or fryers, breast, meat only, cooked, roasted",
        data_type="foundation_food",
        cooking_state="roasted",
        ingredient_id=sample_ingredient.id
    )
    db.add(food)
    db.commit()
    db.refresh(food)
    return food


@pytest.fixture
def sample_food_nutrient(db, sample_usda_food, sample_nutrient):
    """Create a sample food-nutrient relationship."""
    food_nutrient = FoodNutrient(
        fdc_id=sample_usda_food.fdc_id,
        nutrient_id=sample_nutrient.id,
        amount_per_100g=31.0  # 31g protein per 100g
    )
    db.add(food_nutrient)
    db.commit()
    db.refresh(food_nutrient)
    return food_nutrient


@pytest.fixture
def sample_retention_factor(db, sample_nutrient, sample_cooking_method):
    """Create a sample retention factor."""
    factor = RetentionFactor(
        nutrient_id=sample_nutrient.id,
        cooking_method_id=sample_cooking_method.id,
        retention_factor=0.95,
        source="Test data"
    )
    db.add(factor)
    db.commit()
    db.refresh(factor)
    return factor


@pytest.fixture
def sample_unit_conversion(db, sample_ingredient):
    """Create a sample unit conversion."""
    conversion = UnitConversion(
        ingredient_id=sample_ingredient.id,
        unit="piece",
        grams=174.0,
        description="1 medium chicken breast"
    )
    db.add(conversion)
    db.commit()
    db.refresh(conversion)
    return conversion


@pytest.fixture
def full_test_data(
    db,
    sample_ingredient,
    sample_nutrient,
    sample_cooking_method,
    sample_usda_food,
    sample_food_nutrient,
    sample_retention_factor,
    sample_unit_conversion
):
    """Fixture that sets up complete test data."""
    # Add synonym
    synonym = IngredientSynonym(
        ingredient_id=sample_ingredient.id,
        synonym="chicken",
        confidence=0.95
    )
    db.add(synonym)
    db.commit()
    
    return {
        "ingredient": sample_ingredient,
        "nutrient": sample_nutrient,
        "cooking_method": sample_cooking_method,
        "usda_food": sample_usda_food,
        "food_nutrient": sample_food_nutrient,
        "retention_factor": sample_retention_factor,
        "unit_conversion": sample_unit_conversion,
    }
