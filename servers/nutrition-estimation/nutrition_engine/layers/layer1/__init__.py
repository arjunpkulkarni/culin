"""Layer 1: baseline estimate. Uses real CulinAIAPP-Layer1 when DB is configured."""

import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

import logging

# Always add layers/layer1/ so "layer1_app" is importable (it lives here).
# Also add CulinAIAPP-Layer1/ if present, but its "app" package clashes with
# nutrition_engine/app already cached in sys.modules, so layer1_app is the
# reliable import path.
_layer1_root = Path(__file__).resolve().parent
if str(_layer1_root) not in sys.path:
    sys.path.insert(0, str(_layer1_root))

_layer1_pkg = Path(__file__).resolve().parent.parent.parent / "CulinAIAPP-Layer1"
if _layer1_pkg.exists() and str(_layer1_pkg) not in sys.path:
    sys.path.insert(0, str(_layer1_pkg))

logger = logging.getLogger(__name__)


def load_lookup_tables(artifacts_path: Optional[str] = None) -> None:
    """Load Layer 1 lookup tables from pickle or DB. Call once at startup."""
    from layer1_app.services.lookup import load_lookup_tables as _load
    _load(artifacts_path)


def _split_description(description: str) -> List[str]:
    """Split a comma-separated description into individual ingredient strings."""
    import re
    parts = [p.strip() for p in description.split(",")]
    cleaned = []
    for p in parts:
        p = re.sub(r"^and\s+", "", p, flags=re.IGNORECASE).strip()
        if p:
            cleaned.append(p)
    return cleaned


def _build_ingredients(item_name: str, description: str, modifiers: Optional[List[str]]) -> List[str]:
    """Build ingredient list for Layer 1 parser from item_name, description, modifiers."""
    import re
    parts = []
    if description and description.strip():
        parts.extend(_split_description(description.strip()))
    else:
        parts.append(item_name)
    # Only include modifiers if they look like ingredient additions with quantities/units.
    # Unstructured modifiers like "with whipped cream" can poison parsing and lead to zero/skip behavior.
    if modifiers:
        _looks_structured = re.compile(
            r"(^\s*\d)|(\d\s*g\b)|(\b(gram|grams|g|kg|oz|lb|ml|l|cup|cups|tbsp|tsp|slice|slices|piece|pieces)\b)",
            re.IGNORECASE,
        )
        for m in modifiers:
            ms = str(m).strip()
            if ms and _looks_structured.search(ms):
                parts.append(ms)
    # Dedupe and filter empty
    seen = set()
    out = []
    for p in parts:
        p = str(p).strip()
        if p and p.lower() not in seen:
            seen.add(p.lower())
            out.append(p)
    return out if out else [item_name or "unknown"]


def _stub_estimate(
    item_name: str,
    description: str,
    modifiers: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Fallback when real Layer 1 is unavailable."""
    return {
        "macros": {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0},
        "confidence": 1.0,
    }


def _run_layer1_real(
    item_name: str,
    description: str,
    modifiers: Optional[List[str]] = None,
    cooking_method: Optional[str] = None,
) -> Dict[str, Any]:
    """Call real Layer 1 (parser + calculator). Uses in-memory lookup when available, else DB."""
    try:
        from layer1_app.services.parser import IngredientParser
        from layer1_app.services.calculator import NutrientCalculator
        from layer1_app.services.lookup import get_lookup_tables
    except ImportError:
        from app.services.parser import IngredientParser
        from app.services.calculator import NutrientCalculator
        from app.services.lookup import get_lookup_tables

    ingredients = _build_ingredients(item_name, description, modifiers)
    tables = get_lookup_tables()

    if tables:
        parser = IngredientParser(db=None, lookup_tables=tables)
        calculator = NutrientCalculator(db=None, lookup_tables=tables)
    else:
        try:
            from layer1_app.db.session import SessionLocal
        except ImportError:
            from app.db.session import SessionLocal
        db = SessionLocal()
        try:
            parser = IngredientParser(db=db, lookup_tables=None)
            calculator = NutrientCalculator(db=db, lookup_tables=None)
            parsed = [parser.parse(ing) for ing in ingredients]
            totals, _ = calculator.calculate_recipe(parsed, cooking_method=cooking_method)
            macros = {
                "calories": float(totals.calories or 0.0),
                "protein": float(totals.protein_g or 0.0),
                "carbs": float(totals.carbohydrates_g or 0.0),
                "fat": float(totals.fat_g or 0.0),
            }
            conf = sum(p.confidence for p in parsed) / len(parsed) if parsed else 0.8
            return {"macros": macros, "confidence": min(1.0, max(0.0, conf))}
        finally:
            db.close()

    parsed = [parser.parse(ing) for ing in ingredients]
    totals, _ = calculator.calculate_recipe(parsed, cooking_method=cooking_method)
    macros = {
        "calories": float(totals.calories or 0.0),
        "protein": float(totals.protein_g or 0.0),
        "carbs": float(totals.carbohydrates_g or 0.0),
        "fat": float(totals.fat_g or 0.0),
    }
    conf = sum(p.confidence for p in parsed) / len(parsed) if parsed else 0.8
    return {"macros": macros, "confidence": min(1.0, max(0.0, conf))}


def _is_layer1_configured() -> bool:
    """True if Layer 1 DB env vars are set so we can use the real implementation."""
    import os
    return bool(os.environ.get("DATABASE_URL") and os.environ.get("SECRET_KEY"))


def _is_layer1_ready() -> bool:
    """Check if Layer 1 can run. Re-checks every call (pointer test, zero cost)."""
    try:
        from layer1_app.services.lookup import get_lookup_tables
    except ImportError:
        try:
            from app.services.lookup import get_lookup_tables
        except ImportError:
            return False
    if get_lookup_tables() is not None:
        return True
    return _is_layer1_configured()


def estimate(
    item_name: str,
    description: str,
    modifiers: Optional[List[str]] = None,
    cooking_method: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Baseline nutrition estimate. Returns dict with 'macros' and 'confidence'.
    Uses real Layer 1 (parser + calculator + lookup tables) when available;
    otherwise returns stub values. cooking_method (e.g. 'fried', 'baked') is used to apply retention factors.
    """
    if _is_layer1_ready():
        try:
            return _run_layer1_real(item_name, description, modifiers, cooking_method)
        except Exception as e:
            logger.warning("Layer 1 request failed: %s; falling back to stub", e)
    return _stub_estimate(item_name, description, modifiers)
