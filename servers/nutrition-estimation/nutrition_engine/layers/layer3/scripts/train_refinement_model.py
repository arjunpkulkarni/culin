"""
Train the Layer 3 learned refinement model (Option A).

Builds features from (query_embedding, initial_macros, top-k neighbors) and trains
an MLP to predict ground-truth macros. Saves model + scaler to artifacts/.

Usage:
  From repo root (with venv activated):
    python scripts/train_refinement_model.py --data path/to/dishes.csv --artifacts artifacts
  Or use the training set exported from the notebook (dishes with ground-truth macros).

Training CSV columns: dish_id, ingredients, cooking_methods, sauces, portion_class,
  calories, fat, carbs, protein, sodium
  (ingredients/cooking_methods can be list repr strings, e.g. "['a','b']")
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Repo root on path so layer3 resolves
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

import numpy as np
import pandas as pd

from layer3 import embeddings as _embeddings
from layer3 import loader
from layer3.learned_refinement import (
    MACRO_KEYS,
    TOP_K_NEIGHBORS,
    build_feature_vector,
    FEATURE_DIM,
)


def parse_list_column(s):
    if isinstance(s, list):
        return s
    if isinstance(s, str) and s.strip().startswith("["):
        try:
            return eval(s)
        except Exception:
            return [s]
    return [s] if s else []


def main() -> None:
    parser = argparse.ArgumentParser(description="Train Layer 3 refinement model")
    parser.add_argument("--data", type=Path, required=True, help="CSV with dish_id, ingredients, cooking_methods, sauces, portion_class, calories, fat, carbs, protein, sodium")
    parser.add_argument("--artifacts", type=Path, default=REPO_ROOT / "artifacts", help="Artifacts dir (must contain ingredient_embeddings.pkl, dish_embeddings.pkl, neighbor_index.pkl)")
    parser.add_argument("--top-k", type=int, default=TOP_K_NEIGHBORS, help="Number of neighbors in feature vector")
    parser.add_argument("--hidden", type=str, default="128,64", help="MLP hidden layer sizes, comma-separated")
    parser.add_argument("--max-iter", type=int, default=500, help="MLP max iterations")
    parser.add_argument("--out", type=Path, default=None, help="Output path for model (default: artifacts/refinement_model.joblib)")
    args = parser.parse_args()

    artifacts_dir = Path(args.artifacts)
    if not (artifacts_dir / "ingredient_embeddings.pkl").exists():
        print("Artifacts not found. Run layer3_artifact_build.ipynb first.")
        sys.exit(1)

    print("Loading artifacts...")
    artifacts = loader.load_all(artifacts_dir)
    ing_emb = artifacts["ingredient_embeddings"]
    dish_emb = artifacts["dish_embeddings"]
    neighbor_index = artifacts["neighbor_index"]
    mean_emb = np.mean(list(ing_emb.values()), axis=0) if ing_emb else None

    print("Loading training data...")
    df = pd.read_csv(args.data)
    for col in ["ingredients", "cooking_methods"]:
        if col in df.columns:
            df[col] = df[col].apply(parse_list_column)

    X_list = []
    y_list = []
    skipped = 0
    for _, row in df.iterrows():
        dish_id = str(row.get("dish_id", ""))
        ingredients = list(row.get("ingredients", []))
        cooking_methods = list(row.get("cooking_methods", []))
        sauces = float(row.get("sauces", 0))
        portion_class = str(row.get("portion_class", "medium"))
        if not ingredients:
            skipped += 1
            continue
        query_emb = _embeddings.embed_dish(
            ingredients,
            cooking_methods,
            sauces,
            portion_class,
            ing_emb,
            mean_embedding=mean_emb,
        )
        # Similar dishes: from neighbor_index if this dish is in training set, else top-k by similarity
        if dish_id in neighbor_index:
            similar = [
                {
                    "dish_id": n["neighbor_id"],
                    "similarity": n["similarity"],
                    "macros": dish_emb.get(n["neighbor_id"], {}).get("macros", {}),
                }
                for n in neighbor_index[dish_id]
            ]
        else:
            from layer3 import similarity as _similarity
            top = _similarity.top_k_similar(query_emb, dish_emb, k=args.top_k)
            similar = [{"dish_id": t["dish_id"], "similarity": t["similarity"], "macros": t["macros"]} for t in top]
        # Initial macros = mean of similar dishes (simulates Layer 1/2 or no prior)
        initial_macros = {}
        if similar:
            for k in MACRO_KEYS:
                vals = [d["macros"].get(k, 0) for d in similar if isinstance(d.get("macros"), dict)]
                initial_macros[k] = sum(vals) / len(vals) if vals else 0.0
        else:
            initial_macros = {k: float(row.get(k, 0)) for k in MACRO_KEYS}
        X_row = build_feature_vector(query_emb, initial_macros, similar, dish_emb)
        y_row = np.array([float(row.get(k, 0)) for k in MACRO_KEYS], dtype=np.float64)
        X_list.append(X_row)
        y_list.append(y_row)

    if not X_list:
        print("No valid training rows. Check --data CSV (ingredients required).")
        sys.exit(1)

    X = np.vstack(X_list)
    y = np.vstack(y_list)
    print(f"Training set: {X.shape[0]} samples, X dim {X.shape[1]}, y dim {y.shape[1]}")
    if skipped:
        print(f"Skipped {skipped} rows (missing ingredients).")

    from sklearn.preprocessing import StandardScaler
    from sklearn.neural_network import MLPRegressor

    scaler_X = StandardScaler()
    X_scaled = scaler_X.fit_transform(X)
    hidden = [int(x) for x in args.hidden.split(",")]
    model = MLPRegressor(hidden_layer_sizes=tuple(hidden), max_iter=args.max_iter, random_state=42)
    model.fit(X_scaled, y)
    try:
        import joblib
    except ImportError:
        print("pip install joblib scikit-learn")
        sys.exit(1)
    out_path = Path(args.out) if args.out else artifacts_dir / "refinement_model.joblib"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "scaler_X": scaler_X}, out_path)
    print(f"Saved model + scaler to {out_path}")


if __name__ == "__main__":
    main()
