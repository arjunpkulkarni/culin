"""
In-memory lookup tables for Layer 1. Bulk-loads from DB at startup; zero DB queries at request time.
Optionally loads from pickle artifact when DB is unavailable.
"""

from __future__ import annotations

import logging
import os
import pickle
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Nutrient name -> schema key (matches NutrientCalculator.NUTRIENT_MAPPINGS)
NUTRIENT_NAME_TO_KEY = {
    "Energy": "calories",
    "Protein": "protein_g",
    "Carbohydrate, by difference": "carbohydrates_g",
    "Total lipid (fat)": "fat_g",
    "Fiber, total dietary": "fiber_g",
    "Sugars, total including NLEA": "sugar_g",
    "Sodium, Na": "sodium_mg",
    "Calcium, Ca": "calcium_mg",
    "Iron, Fe": "iron_mg",
    "Vitamin A, RAE": "vitamin_a_mcg",
    "Vitamin C, total ascorbic acid": "vitamin_c_mg",
    "Vitamin D (D2 + D3)": "vitamin_d_mcg",
    "Vitamin E (alpha-tocopherol)": "vitamin_e_mg",
    "Vitamin K (phylloquinone)": "vitamin_k_mcg",
    "Thiamin": "thiamin_mg",
    "Riboflavin": "riboflavin_mg",
    "Niacin": "niacin_mg",
    "Vitamin B-6": "vitamin_b6_mg",
    "Folate, total": "folate_mcg",
    "Vitamin B-12": "vitamin_b12_mcg",
    "Magnesium, Mg": "magnesium_mg",
    "Phosphorus, P": "phosphorus_mg",
    "Potassium, K": "potassium_mg",
    "Zinc, Zn": "zinc_mg",
}


@dataclass
class IngredientRow:
    """Lightweight ingredient record for in-memory lookup."""
    id: int
    name: str
    density_g_per_ml: Optional[float] = None


@dataclass
class LookupTables:
    """All in-memory lookup data for Layer 1."""
    name_to_ingredient: Dict[str, IngredientRow] = field(default_factory=dict)
    synonym_to_ingredient: Dict[str, Tuple[IngredientRow, float]] = field(default_factory=dict)
    all_names_with_ingredients: List[Tuple[str, IngredientRow]] = field(default_factory=list)
    unit_conversions: Dict[Tuple[int, str], float] = field(default_factory=dict)
    nutrient_profiles: Dict[int, Dict[str, float]] = field(default_factory=dict)
    retention_factors: Dict[Tuple[int, int], float] = field(default_factory=dict)
    cooking_methods: Dict[str, int] = field(default_factory=dict)
    key_to_nutrient_id: Dict[str, int] = field(default_factory=dict)  # "calories" -> nutrient_id for retention lookup
    nutrients: Dict[int, Dict[str, Any]] = field(default_factory=dict)


_tables: Optional[LookupTables] = None


def load_from_db() -> LookupTables:
    """Connect to DB and bulk-load all reference data. Call once at startup."""
    try:
        from layer1_app.core.config import get_settings
    except ImportError:
        from app.core.config import get_settings
    try:
        from layer1_app.db.session import SessionLocal
        from layer1_app.db.models import (
            Ingredient, IngredientSynonym, UnitConversion,
            USDAFood, FoodNutrient, Nutrient,
            RetentionFactor, CookingMethod,
        )
    except ImportError:
        from app.db.session import SessionLocal
        from app.db.models import (
            Ingredient, IngredientSynonym, UnitConversion,
            USDAFood, FoodNutrient, Nutrient,
            RetentionFactor, CookingMethod,
        )

    settings = get_settings()
    if not str(settings.database_url):
        raise ValueError("DATABASE_URL not set")

    db = SessionLocal()
    try:
        tables = LookupTables()

        # 1. Ingredients
        ingredients = db.query(Ingredient).all()
        id_to_name_lower: Dict[int, str] = {}
        for ing in ingredients:
            row = IngredientRow(
                id=ing.id,
                name=ing.name,
                density_g_per_ml=ing.density_g_per_ml,
            )
            tables.name_to_ingredient[ing.name.lower()] = row
            tables.all_names_with_ingredients.append((ing.name.lower(), row))
            id_to_name_lower[ing.id] = ing.name.lower()

        # 2. Synonyms (bulk load ingredients by id to avoid N+1)
        synonyms = db.query(IngredientSynonym).all()
        ingredient_ids = list({s.ingredient_id for s in synonyms})
        ingredients_by_id = {
            i.id: IngredientRow(id=i.id, name=i.name, density_g_per_ml=i.density_g_per_ml)
            for i in db.query(Ingredient).filter(Ingredient.id.in_(ingredient_ids)).all()
        }
        for syn in synonyms:
            row = ingredients_by_id.get(syn.ingredient_id)
            if row:
                tables.synonym_to_ingredient[syn.synonym.lower()] = (row, syn.confidence)
                tables.all_names_with_ingredients.append((syn.synonym.lower(), row))

        # 3. Unit conversions
        conversions = db.query(UnitConversion).all()
        for c in conversions:
            if c.ingredient_id is not None:
                tables.unit_conversions[(c.ingredient_id, c.unit.lower())] = c.grams

        # 4. Nutrients (id -> name, unit) and key -> nutrient_id for retention lookup
        nutrients = db.query(Nutrient).all()
        for n in nutrients:
            tables.nutrients[n.id] = {"name": n.name, "unit": n.unit}
            key = NUTRIENT_NAME_TO_KEY.get(n.name)
            if key:
                tables.key_to_nutrient_id[key] = n.id

        # 5. Cooking methods (name -> id)
        methods = db.query(CookingMethod).all()
        for m in methods:
            tables.cooking_methods[m.name.lower()] = m.id

        # 6. Retention factors
        retentions = db.query(RetentionFactor).all()
        for r in retentions:
            tables.retention_factors[(r.nutrient_id, r.cooking_method_id)] = r.retention_factor

        # 7. USDA foods + food nutrients -> nutrient_profiles per ingredient (prefer raw)
        usda_foods = db.query(USDAFood).filter(USDAFood.ingredient_id.isnot(None)).all()
        linked_fdc_ids = [f.fdc_id for f in usda_foods]
        food_nutrients_raw = (
            db.query(FoodNutrient)
            .filter(FoodNutrient.fdc_id.in_(linked_fdc_ids))
            .all()
        ) if linked_fdc_ids else []
        fn_by_fdc: Dict[int, List[Any]] = {}
        for fn in food_nutrients_raw:
            fn_by_fdc.setdefault(fn.fdc_id, []).append(fn)

        foods_by_ingredient: Dict[int, List[Any]] = {}
        for food in usda_foods:
            if food.ingredient_id is None:
                continue
            foods_by_ingredient.setdefault(food.ingredient_id, []).append(food)

        # Prefer cooked USDA profiles when available (restaurant food is cooked/fried); else raw; else first.
        # For generic meat ingredients (e.g. "beef", "chicken") cooking_state is often NULL and the first-linked
        # USDA item can be a broth/seasoning/jerky which yields absurd macros. Add a sanity-based selection.
        COOKED_KEYWORDS = ("cooked", "fried", "grilled", "baked", "roasted", "broiled", "sauteed")
        MEAT_KEYWORDS = ("beef", "chicken", "pork", "turkey", "lamb", "fish", "shrimp", "salmon", "tuna")
        SOUPY_KEYWORDS = ("broth", "stock", "soup", "gravy", "sauce", "seasoning", "flavor", "dip", "mix")
        for ingredient_id, foods in foods_by_ingredient.items():
            state_lower = lambda f: (f.cooking_state or "").lower()
            ing_name = id_to_name_lower.get(ingredient_id, "")
            is_meat_like = bool(ing_name) and any(k in ing_name for k in MEAT_KEYWORDS)

            def _profile_for_food(food: Any) -> Dict[str, float]:
                fns = fn_by_fdc.get(food.fdc_id, [])
                prof: Dict[str, float] = {}
                for fn in fns:
                    nutrient_info = tables.nutrients.get(fn.nutrient_id)
                    if nutrient_info:
                        key = NUTRIENT_NAME_TO_KEY.get(nutrient_info["name"])
                        if key:
                            prof[key] = fn.amount_per_100g
                return prof

            selected = None
            if is_meat_like and foods:
                best_score = None
                for food in foods:
                    prof = _profile_for_food(food)
                    if not prof:
                        continue
                    p = float(prof.get("protein_g") or 0.0)
                    c = float(prof.get("carbohydrates_g") or 0.0)
                    f = float(prof.get("fat_g") or 0.0)
                    cal = float(prof.get("calories") or 0.0)
                    desc = (getattr(food, "description", "") or "").lower()
                    soup_penalty = 20.0 if any(k in desc for k in SOUPY_KEYWORDS) else 0.0
                    cooked_bonus = 2.0 if any(k in state_lower(food) for k in COOKED_KEYWORDS) else 0.0
                    # Meat sanity: prefer high protein and meaningful fat (restaurant meat isn't ultra-lean),
                    # penalize carbs (avoid broths/sauces/battered products when possible).
                    cal_penalty = 10.0 if (cal and (cal < 50.0 or cal > 500.0)) else 0.0
                    score = (p * 2.5) + (f * 1.2) - (c * 2.5) + cooked_bonus - soup_penalty - cal_penalty
                    if best_score is None or score > best_score:
                        best_score = score
                        selected = food

            if selected is None:
                cooked = next((f for f in foods if state_lower(f) and any(k in state_lower(f) for k in COOKED_KEYWORDS)), None)
                raw = next((f for f in foods if state_lower(f) and "raw" in state_lower(f)), None)
                selected = cooked or raw or foods[0]

            fns = fn_by_fdc.get(selected.fdc_id, [])
            profile: Dict[str, float] = {}
            for fn in fns:
                nutrient_info = tables.nutrients.get(fn.nutrient_id)
                if nutrient_info:
                    key = NUTRIENT_NAME_TO_KEY.get(nutrient_info["name"])
                    if key:
                        profile[key] = fn.amount_per_100g
            if profile:
                tables.nutrient_profiles[ingredient_id] = profile

        logger.info(
            "Layer 1 lookup: loaded %d ingredients, %d synonyms, %d unit conversions, %d nutrient profiles",
            len(tables.name_to_ingredient),
            len(tables.synonym_to_ingredient),
            len(tables.unit_conversions),
            len(tables.nutrient_profiles),
        )
        return tables
    finally:
        db.close()


def load_from_pickle(artifacts_path: Path) -> Optional[LookupTables]:
    """Load lookup tables from pickle artifact. Returns None if file not found."""
    pkl_path = artifacts_path / "layer1" / "lookup_tables.pkl"
    if not pkl_path.exists():
        return None
    try:
        with open(pkl_path, "rb") as f:
            tables = pickle.load(f)
        # Backfill key_to_nutrient_id if missing (older pickles) for retention-factor lookup
        if not getattr(tables, "key_to_nutrient_id", None) and getattr(tables, "nutrients", None):
            tables.key_to_nutrient_id = {}
            for nid, info in tables.nutrients.items():
                if isinstance(info, dict) and "name" in info:
                    key = NUTRIENT_NAME_TO_KEY.get(info["name"])
                    if key:
                        tables.key_to_nutrient_id[key] = nid
        logger.info("Layer 1 lookup: loaded from pickle %s", pkl_path)
        return tables
    except Exception as e:
        logger.warning("Layer 1 lookup: failed to load pickle %s: %s", pkl_path, e)
        return None


def load_lookup_tables(artifacts_path: Optional[str] = None) -> None:
    """Load lookup tables: from pickle if available, else from DB. Call once at startup."""
    global _tables
    if artifacts_path is None:
        artifacts_path = os.environ.get("NUTRITION_ARTIFACTS", "artifacts")
    path = Path(artifacts_path).resolve()

    _tables = load_from_pickle(path)
    if _tables is not None:
        return
    try:
        _tables = load_from_db()
        logger.info("Layer 1 lookup: loaded from DB")
    except Exception as e:
        logger.warning("Layer 1 lookup: DB load failed (%s); Layer 1 will use stub or require DB", e)
        _tables = None


def get_lookup_tables() -> Optional[LookupTables]:
    """Return the loaded lookup tables, or None if not loaded."""
    return _tables


def save_lookup_tables_to_pickle(
    artifacts_path: Optional[str] = None,
    tables: Optional[LookupTables] = None,
) -> None:
    """Export lookup tables to pickle for zero-DB deployment."""
    global _tables
    to_save = tables if tables is not None else _tables
    if to_save is None:
        to_save = load_from_db()
        _tables = to_save
    if artifacts_path is None:
        artifacts_path = os.environ.get("NUTRITION_ARTIFACTS", "artifacts")
    path = Path(artifacts_path).resolve()
    layer1_dir = path / "layer1"
    layer1_dir.mkdir(parents=True, exist_ok=True)
    pkl_path = layer1_dir / "lookup_tables.pkl"
    with open(pkl_path, "wb") as f:
        pickle.dump(to_save, f)
    logger.info("Layer 1 lookup: saved to %s", pkl_path)
