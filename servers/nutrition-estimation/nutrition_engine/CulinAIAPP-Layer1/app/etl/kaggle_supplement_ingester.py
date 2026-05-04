"""
Load a flat nutrition CSV (e.g. Kaggle) into PostgreSQL alongside USDA rows.

Designed for datasets such as:
  https://www.kaggle.com/datasets/trolukovich/nutritional-values-for-common-foods-and-products

Download the CSV locally, then:

  export DATABASE_URL=postgresql://...
  export KAGGLE_NUTRITION_CSV=/path/to/nutrition.csv
  cd CulinAIAPP-Layer1
  python -m app.etl.kaggle_supplement_ingester

Values are assumed per 100 g edible portion unless a column named like
serving_size_g / weight_g / portion_g is present (then macros are scaled to per 100g).

Creates synthetic ``usda_foods`` rows with ``data_type='kaggle_supplement'`` and
negative ``fdc_id`` so they never collide with real USDA FDC IDs.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import zlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

# Project root: .../CulinAIAPP-Layer1
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.core.logging import logger  # noqa: E402
from app.db.session import SessionLocal, engine, Base  # noqa: E402
from app.db.models import Ingredient, IngredientSynonym, USDAFood, FoodNutrient, Nutrient  # noqa: E402


def _stable_negative_fdc(name: str) -> int:
    """Deterministic negative fdc_id in a safe range (no clash with real USDA ids)."""
    h = zlib.crc32(name.strip().lower().encode("utf-8")) & 0xFFFFFFFF
    return -int(1_000_000_000 + (h % 999_999_999))


def _pick_column(df: pd.DataFrame, candidates: Tuple[str, ...]) -> Optional[str]:
    cols = {c.lower().strip(): c for c in df.columns}
    for want in candidates:
        w = want.lower()
        if w in cols:
            return cols[w]
    return None


def _to_float(x: Any) -> Optional[float]:
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return None
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def _normalize_food_label(raw: str) -> str:
    s = str(raw or "").strip().lower()
    s = re.sub(r"\s+", " ", s)
    return s[:240] if s else ""


def _resolve_ingredient_for_synonym(db: Session, canonical_hint: str) -> Optional[Ingredient]:
    """Find best ingredient row for a staple synonym (avoid eggplant for 'egg')."""
    hint = canonical_hint.strip().lower()
    exact = db.query(Ingredient).filter(func.lower(Ingredient.name) == hint).first()
    if exact:
        return exact
    block = ("eggplant", "egg roll", "eggnog", "egg foo", "egg tart")
    q = (
        db.query(Ingredient)
        .filter(func.lower(Ingredient.name).contains(hint))
        .order_by(func.length(Ingredient.name))
    )
    for row in q.limit(25):
        nl = row.name.lower()
        if any(b in nl for b in block):
            continue
        return row
    return None


STAPLE_SYNONYMS: Tuple[Tuple[str, str], ...] = (
    ("eggs", "egg"),
    ("hen eggs", "egg"),
    ("whole eggs", "egg"),
    ("tomatoes", "tomato"),
    ("potatoes", "potato"),
    ("onions", "onion"),
)


def seed_staple_synonyms(db: Session) -> int:
    """Insert high-value synonyms so Layer 0 / parser resolve household phrases."""
    n = 0
    for syn, hint in STAPLE_SYNONYMS:
        ing = _resolve_ingredient_for_synonym(db, hint)
        if not ing:
            logger.warning("Staple synonym skipped (no ingredient): %s -> %s", syn, hint)
            continue
        exists = (
            db.query(IngredientSynonym)
            .filter(
                IngredientSynonym.synonym == syn.lower(),
                IngredientSynonym.ingredient_id == ing.id,
            )
            .first()
        )
        if exists:
            continue
        db.add(
            IngredientSynonym(
                ingredient_id=ing.id,
                synonym=syn.lower(),
                confidence=1.0,
                created_at=datetime.now(timezone.utc),
            )
        )
        n += 1
    db.commit()
    logger.info("Staple synonyms added: %d", n)
    return n


def _nutrient_ids_by_name(db: Session) -> Dict[str, int]:
    """Map canonical nutrient name -> internal id (first match)."""
    rows = db.query(Nutrient).all()
    out: Dict[str, int] = {}
    for r in rows:
        key = (r.name or "").strip()
        if key and key not in out:
            out[key] = r.id
    return out


def upsert_from_flat_csv(
    db: Session,
    csv_path: Path,
    *,
    max_rows: Optional[int] = None,
) -> Tuple[int, int]:
    """
    Upsert ingredients + synthetic USDAFood + FoodNutrient from a wide-format CSV.
    Returns (foods_upserted, nutrient_rows_upserted).
    """
    df = pd.read_csv(csv_path)
    if df.empty:
        return 0, 0

    name_col = _pick_column(
        df,
        ("name", "food", "product", "description", "food_name", "shrt_desc"),
    )
    if not name_col:
        raise ValueError(
            "CSV must include a food name column (name, food, product, description, ...)"
        )

    cal_col = _pick_column(df, ("calories", "energy_kcal", "energy", "kcal", "calorie"))
    prot_col = _pick_column(df, ("protein", "proteins", "protein_g", "protein (g)"))
    carb_col = _pick_column(
        df,
        ("carbohydrate", "carbohydrates", "carbs", "carbohydrate_g", "carbohydrate (g)", "total_carbohydrate"),
    )
    fat_col = _pick_column(df, ("fat", "total_fat", "fat_g", "fat (g)", "total fat"))

    serving_g_col = _pick_column(
        df,
        ("serving_size_g", "weight_g", "portion_g", "serving_g", "grams", "mass_g"),
    )

    by_name = _nutrient_ids_by_name(db)
    need = ("Energy", "Protein", "Carbohydrate, by difference", "Total lipid (fat)")
    missing = [k for k in need if k not in by_name]
    if missing:
        raise RuntimeError(
            f"Nutrients {missing} missing in DB — run USDA ingester first so nutrient rows exist."
        )

    now = datetime.now(timezone.utc)
    foods_written = 0
    nutrients_written = 0

    limit = len(df) if max_rows is None else min(len(df), max_rows)
    for i in range(limit):
        row = df.iloc[i]
        label = _normalize_food_label(row.get(name_col))
        if not label or len(label) < 2:
            continue

        cal = _to_float(row.get(cal_col)) if cal_col else None
        prot = _to_float(row.get(prot_col)) if prot_col else None
        carb = _to_float(row.get(carb_col)) if carb_col else None
        fat = _to_float(row.get(fat_col)) if fat_col else None
        if all(v is None for v in (cal, prot, carb, fat)):
            continue

        scale = 1.0
        if serving_g_col:
            sg = _to_float(row.get(serving_g_col))
            if sg and sg > 0:
                scale = 100.0 / sg

        def per100(v: Optional[float]) -> Optional[float]:
            if v is None:
                return None
            return max(0.0, v * scale)

        cal100 = per100(cal)
        p100 = per100(prot)
        c100 = per100(carb)
        f100 = per100(fat)
        if all(x is None or x == 0 for x in (cal100, p100, c100, f100)):
            continue

        fdc_id = _stable_negative_fdc(label)

        ing = db.query(Ingredient).filter(func.lower(Ingredient.name) == label).first()
        if not ing:
            ing = Ingredient(
                name=label,
                category="kaggle_supplement",
                created_at=now,
                updated_at=now,
            )
            db.add(ing)
            db.flush()

        food_row = {
            "fdc_id": fdc_id,
            "description": label,
            "data_type": "kaggle_supplement",
            "cooking_state": "raw",
            "ingredient_id": ing.id,
            "publication_date": None,
            "created_at": now,
        }
        stmt = insert(USDAFood).values(food_row)
        stmt = stmt.on_conflict_do_update(
            index_elements=["fdc_id"],
            set_={
                "description": stmt.excluded.description,
                "data_type": stmt.excluded.data_type,
                "ingredient_id": stmt.excluded.ingredient_id,
                "cooking_state": stmt.excluded.cooking_state,
            },
        )
        db.execute(stmt)
        foods_written += 1

        pairs: List[Tuple[str, Optional[float]]] = [
            ("Energy", cal100),
            ("Protein", p100),
            ("Carbohydrate, by difference", c100),
            ("Total lipid (fat)", f100),
        ]
        for nutrient_name, amount in pairs:
            if amount is None:
                continue
            nid = by_name.get(nutrient_name)
            if nid is None:
                continue
            fn = {
                "fdc_id": fdc_id,
                "nutrient_id": nid,
                "amount_per_100g": float(amount),
                "data_points": None,
                "min_value": None,
                "max_value": None,
            }
            stmt_fn = insert(FoodNutrient).values(fn)
            stmt_fn = stmt_fn.on_conflict_do_update(
                index_elements=["fdc_id", "nutrient_id"],
                set_={"amount_per_100g": stmt_fn.excluded.amount_per_100g},
            )
            db.execute(stmt_fn)
            nutrients_written += 1

        if (i + 1) % 500 == 0:
            db.commit()
            logger.info("Kaggle supplement progress: %d rows", i + 1)

    db.commit()
    return foods_written, nutrients_written


def main() -> int:
    parser = argparse.ArgumentParser(description="Supplement RDS with flat Kaggle-style nutrition CSV")
    parser.add_argument(
        "--csv",
        default=os.environ.get("KAGGLE_NUTRITION_CSV"),
        help="Path to CSV (or set KAGGLE_NUTRITION_CSV)",
    )
    parser.add_argument("--max-rows", type=int, default=None)
    parser.add_argument(
        "--synonyms-only",
        action="store_true",
        help="Only seed staple synonyms (no CSV required)",
    )
    args = parser.parse_args()

    if not args.synonyms_only and not args.csv:
        parser.error("Provide --csv or set KAGGLE_NUTRITION_CSV")

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        n_syn = seed_staple_synonyms(db)
        if args.synonyms_only:
            logger.info("Done (synonyms-only). New synonyms: %d", n_syn)
            return 0
        nf, nn = upsert_from_flat_csv(db, Path(args.csv), max_rows=args.max_rows)
        logger.info("Kaggle supplement complete: foods=%d nutrient_rows=%d", nf, nn)
        seed_staple_synonyms(db)
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
