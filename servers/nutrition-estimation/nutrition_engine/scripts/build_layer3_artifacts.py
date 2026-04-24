#!/usr/bin/env python3
"""
Build Layer 3 artifacts from repo data (layers/layer3/usda_reference.csv).

Uses USDA reference CSV for ingredients and dishes; no placeholder data.
Output format is compatible with the engine's Layer 3 loader.

Usage (from nutrition_engine/):
  python scripts/build_layer3_artifacts.py
  python scripts/build_layer3_artifacts.py -o /path/to/artifacts/layer3
  python scripts/build_layer3_artifacts.py --usda /path/to/usda_reference.csv

Output (default: nutrition_engine/artifacts/layer3/):
  - ingredient_embeddings.pkl
  - dish_embeddings.pkl
  - neighbor_index.pkl
  - macro_delta_stats.json
  - confidence_params.json
"""

import argparse
import json
import pickle
import sys
from pathlib import Path

import numpy as np
import pandas as pd

# Dish embedding = ingredient_part(13) + method_vec(9) + sauce(1) + portion(3) = 26
INGREDIENT_EMB_DIM = 13
MACRO_KEYS = ["calories", "fat", "carbs", "protein", "sodium"]
MAX_NEIGHBORS = 15


def _default_usda_path() -> Path:
    return Path(__file__).resolve().parent.parent / "layers" / "layer3" / "usda_reference.csv"


def _normalized_macro_vec(row, scale_cal=600.0, scale_fat=60.0, scale_carbs=100.0, scale_protein=50.0, scale_sodium=800.0):
    """Turn one USDA row into a 5-dim normalized vector; pad to INGREDIENT_EMB_DIM."""
    cal = float(row.get("calories", 0) or 0) / scale_cal
    fat = float(row.get("fat_g", 0) or 0) / scale_fat
    carbs = float(row.get("carbs_g", 0) or 0) / scale_carbs
    protein = float(row.get("protein_g", 0) or 0) / scale_protein
    sodium = float(row.get("sodium_mg", 0) or 0) / scale_sodium
    vec = np.array([cal, fat, carbs, protein, sodium], dtype=np.float32)
    # category as simple hash (0..1) for 6th dim, then zeros to 13
    cat = str(row.get("category", "other")) if pd.notna(row.get("category")) else "other"
    h = hash(cat) % 1000 / 1000.0
    extra = np.array([h] + [0.0] * (INGREDIENT_EMB_DIM - 6), dtype=np.float32)
    return np.concatenate([vec, extra]).astype(np.float32)[:INGREDIENT_EMB_DIM]


def main():
    parser = argparse.ArgumentParser(description="Build Layer 3 artifacts from USDA reference data")
    parser.add_argument(
        "-o", "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "artifacts" / "layer3",
        help="Output directory for artifact files",
    )
    parser.add_argument(
        "--usda",
        type=Path,
        default=None,
        help="Path to usda_reference.csv (default: layers/layer3/usda_reference.csv)",
    )
    args = parser.parse_args()
    out = args.output_dir
    out.mkdir(parents=True, exist_ok=True)

    usda_path = args.usda or _default_usda_path()
    if not usda_path.exists():
        print("Error: USDA reference not found at %s" % usda_path, file=sys.stderr)
        return 1

    df = pd.read_csv(usda_path)
    # Normalize column names (allow fat_g vs fat, etc.)
    col_map = {}
    for c in df.columns:
        c2 = c.strip().lower()
        if c2 == "fat_g" or c2 == "fat":
            col_map[c] = "fat_g"
        elif c2 == "carbs_g" or c2 == "carbs":
            col_map[c] = "carbs_g"
        elif c2 == "protein_g" or c2 == "protein":
            col_map[c] = "protein_g"
        elif c2 == "sodium_mg" or c2 == "sodium":
            col_map[c] = "sodium_mg"
        elif c2 == "calories":
            col_map[c] = "calories"
        elif c2 == "ingredient_name":
            col_map[c] = "ingredient_name"
        elif c2 == "category":
            col_map[c] = "category"
    df = df.rename(columns=col_map)
    name_col = "ingredient_name" if "ingredient_name" in df.columns else df.columns[0]
    df = df.dropna(subset=[name_col])
    df = df.drop_duplicates(subset=[name_col], keep="first")

    # --- 1. Ingredient embeddings from USDA (name -> 13-dim) ---
    ingredient_embeddings = {}
    for _, row in df.iterrows():
        name = str(row[name_col]).strip()
        if not name:
            continue
        ingredient_embeddings[name] = _normalized_macro_vec(row)
    with open(out / "ingredient_embeddings.pkl", "wb") as f:
        pickle.dump(ingredient_embeddings, f)
    print("Wrote ingredient_embeddings.pkl (%d ingredients from %s)" % (len(ingredient_embeddings), usda_path.name))

    # --- 2. Dish embeddings: each USDA row is one dish (single-ingredient); embedding = 26-dim ---
    mean_ing = np.mean(list(ingredient_embeddings.values()), axis=0) if ingredient_embeddings else np.zeros(INGREDIENT_EMB_DIM, dtype=np.float32)
    method_vec = np.zeros(9, dtype=np.float32)
    method_vec[-1] = 1.0  # other
    sauce = np.array([0.0], dtype=np.float32)
    portion = np.zeros(3, dtype=np.float32)
    portion[1] = 1.0  # medium
    suffix = np.concatenate([method_vec, sauce, portion])

    dish_embeddings = {}
    for _, row in df.iterrows():
        name = str(row[name_col]).strip()
        if not name or name not in ingredient_embeddings:
            continue
        part = ingredient_embeddings[name]
        cal = float(row.get("calories", 0) or 0)
        fat = float(row.get("fat_g", 0) or 0)
        carbs = float(row.get("carbs_g", 0) or 0)
        protein = float(row.get("protein_g", 0) or 0)
        sodium = float(row.get("sodium_mg", 0) or 0)
        dish_id = name
        emb = np.concatenate([part, suffix]).astype(np.float32)
        dish_embeddings[dish_id] = {
            "embedding": emb,
            "macros": {"calories": cal, "fat": fat, "carbs": carbs, "protein": protein, "sodium": sodium},
        }
    with open(out / "dish_embeddings.pkl", "wb") as f:
        pickle.dump(dish_embeddings, f)
    print("Wrote dish_embeddings.pkl (%d dishes)" % len(dish_embeddings))

    # --- 3. Neighbor index: cosine similarity on embeddings, then macro_deltas ---
    dish_ids = list(dish_embeddings.keys())
    embeddings_mat = np.array([dish_embeddings[did]["embedding"] for did in dish_ids], dtype=np.float32)
    norms = np.linalg.norm(embeddings_mat, axis=1, keepdims=True)
    norms[norms == 0] = 1e-9
    embeddings_mat = embeddings_mat / norms
    sim_matrix = np.dot(embeddings_mat, embeddings_mat.T)

    neighbor_index = {}
    all_deltas = {k: [] for k in MACRO_KEYS}
    for i, did in enumerate(dish_ids):
        sims = sim_matrix[i]
        order = np.argsort(-sims)
        base_macros = dish_embeddings[did]["macros"]
        neighbors = []
        for j in order:
            if j == i:
                continue
            if len(neighbors) >= MAX_NEIGHBORS:
                break
            nid = dish_ids[j]
            nm = dish_embeddings[nid]["macros"]
            deltas = {}
            for k in MACRO_KEYS:
                b = base_macros.get(k, 0) or 1e-9
                d = (nm.get(k, 0) - base_macros.get(k, 0)) / b
                deltas[k] = float(d)
                all_deltas[k].append(d)
            neighbors.append({
                "neighbor_id": nid,
                "similarity": float(sims[j]),
                "macro_deltas": deltas,
            })
        neighbor_index[did] = neighbors
    with open(out / "neighbor_index.pkl", "wb") as f:
        pickle.dump(neighbor_index, f)
    print("Wrote neighbor_index.pkl")

    # --- 4. Macro delta stats from actual deltas ---
    macro_delta_stats = {}
    for k in MACRO_KEYS:
        arr = np.array(all_deltas[k])
        if len(arr) == 0:
            macro_delta_stats[k] = {"p10": -0.3, "p90": 0.3, "median": 0.0, "iqr": 0.2}
        else:
            macro_delta_stats[k] = {
                "p10": float(np.percentile(arr, 10)),
                "p90": float(np.percentile(arr, 90)),
                "median": float(np.median(arr)),
                "iqr": float(np.percentile(arr, 75) - np.percentile(arr, 25)),
            }
    with open(out / "macro_delta_stats.json", "w") as f:
        json.dump(macro_delta_stats, f, indent=2)
    print("Wrote macro_delta_stats.json")

    # --- 5. Confidence params ---
    confidence_params = {
        "similarity_to_confidence": {
            "bin_edges": [0.0, 0.3, 0.5, 0.7, 1.0],
            "confidence_at_bin": [0.3, 0.45, 0.6, 0.8, 1.0],
        },
        "ingredient_coverage_bins": [0.0, 0.5, 0.75, 1.0],
        "ingredient_coverage_penalty": [0.5, 0.2, 0.05, 0.0],
    }
    with open(out / "confidence_params.json", "w") as f:
        json.dump(confidence_params, f, indent=2)
    print("Wrote confidence_params.json")

    print("\nLayer 3 artifacts written to: %s (from repo data: %s)" % (out, usda_path.name))
    print("Restart the app (or run_local_test.py) to load them.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
