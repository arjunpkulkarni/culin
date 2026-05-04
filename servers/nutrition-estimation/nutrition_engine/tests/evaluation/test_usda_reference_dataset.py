"""Reference CSV structure and sampling."""

import random
from pathlib import Path

import pytest

from evaluation.dataset_usda_reference import (
    default_csv_path,
    load_usda_reference,
    profile_dataset,
    sample_rows,
    row_to_nutrition_request,
)


@pytest.fixture
def csv_path() -> Path:
    return default_csv_path()


def test_load_usda_reference(csv_path: Path):
    df = load_usda_reference(csv_path)
    assert len(df) > 1000
    assert "ingredient_name" in df.columns
    assert df["calories"].notna().all()


def test_profile_dataset(csv_path: Path):
    df = load_usda_reference(csv_path)
    p = profile_dataset(df)
    assert p["row_count"] == len(df)
    assert p["missing_counts"]["ingredient_name"] == 0


def test_sample_rows_reproducible(csv_path: Path):
    df = load_usda_reference(csv_path)
    a = sample_rows(df, 50, random.Random(123))
    b = sample_rows(df, 50, random.Random(123))
    assert list(a.index) == list(b.index)


def test_row_to_nutrition_request(csv_path: Path):
    df = load_usda_reference(csv_path)
    row = df.iloc[0]
    req = row_to_nutrition_request(row, portion_grams=100.0)
    assert "100g" in req["description"] or "100 g" in req["description"].replace(" ", "")
    assert req["item_name"] == row["ingredient_name"]
