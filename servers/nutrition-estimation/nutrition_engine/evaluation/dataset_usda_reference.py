"""Load and sample `layers/layer3/usda_reference.csv` (USDA-style macros per 100 g)."""

from __future__ import annotations

import random
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd


DEFAULT_CSV_RELATIVE = Path("layers/layer3/usda_reference.csv")

REQUIRED_COLUMNS = (
    "ingredient_name",
    "fat_g",
    "carbs_g",
    "protein_g",
    "calories",
    "sodium_mg",
)


def default_csv_path(engine_root: Optional[Path] = None) -> Path:
    root = engine_root or Path(__file__).resolve().parents[1]
    return (root / DEFAULT_CSV_RELATIVE).resolve()


def load_usda_reference(csv_path: Path) -> pd.DataFrame:
    if not csv_path.is_file():
        raise FileNotFoundError(f"USDA reference CSV not found: {csv_path}")
    df = pd.read_csv(csv_path)
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"CSV missing columns {missing}; found {list(df.columns)}")
    return df


def profile_dataset(df: pd.DataFrame) -> Dict[str, Any]:
    """Summary statistics for the reference table (for the report)."""
    n = len(df)
    profile: Dict[str, Any] = {
        "row_count": n,
        "columns": list(df.columns),
        "missing_counts": {c: int(df[c].isna().sum()) for c in REQUIRED_COLUMNS},
        "duplicate_ingredient_name_rows": int(df["ingredient_name"].duplicated().sum()),
    }
    if "category" in df.columns:
        vc = df["category"].astype(str).value_counts().head(12)
        profile["category_top"] = {str(k): int(v) for k, v in vc.items()}
    numeric = ["calories", "protein_g", "carbs_g", "fat_g", "sodium_mg"]
    desc = df[numeric].describe(percentiles=[0.05, 0.5, 0.95]).to_dict()
    profile["numeric_summary"] = desc
    name_lens = df["ingredient_name"].astype(str).str.len()
    profile["ingredient_name_length"] = {
        "min": int(name_lens.min()),
        "max": int(name_lens.max()),
        "mean": float(name_lens.mean()),
    }
    return profile


def sample_rows(df: pd.DataFrame, n: int, rng: random.Random) -> pd.DataFrame:
    """Uniform random sample of n rows without replacement."""
    if n <= 0:
        raise ValueError("n must be positive")
    if len(df) <= n:
        return df.copy()
    idx = list(range(len(df)))
    chosen = rng.sample(idx, n)
    return df.iloc[sorted(chosen)].copy()


def row_to_expected_macros(row: pd.Series) -> Dict[str, float]:
    """Map CSV row to engine macro names (Layer 2 output style)."""
    return {
        "calories": float(row["calories"]),
        "protein": float(row["protein_g"]),
        "carbs": float(row["carbs_g"]),
        "fat": float(row["fat_g"]),
        "sodium": float(row["sodium_mg"]),
    }


def row_to_nutrition_request(row: pd.Series, portion_grams: float = 100.0) -> Dict[str, Any]:
    """
    Build POST /estimate-style body so Layer 1 parses a single mass-sized ingredient.

    Reference CSV is per 100 g; we encode that mass explicitly in `description`.
    """
    name = str(row["ingredient_name"]).strip()
    if not name:
        raise ValueError("empty ingredient_name")
    g = int(round(float(portion_grams)))
    desc = f"{g}g {name}"
    return {
        "item_name": name[:500],
        "description": desc[:4000],
    }
