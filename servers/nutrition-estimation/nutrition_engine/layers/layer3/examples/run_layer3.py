"""
Example: run Layer 3 refinement on input from Layer 1 or Layer 2.

Input contract (from Layer 1/2):
  - ingredients: list[str] (ontology-normalized)
  - cooking_methods: list[str]
  - sauces: float 0-1
  - portion_class: "small" | "medium" | "large"
  - initial_macros: optional {calories, fat, carbs, protein, sodium}

Run from repo root with artifacts present:
  python -m examples.run_layer3
  or
  python examples/run_layer3.py
"""
from pathlib import Path

# Add repo root so "layer3" resolves
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from layer3 import refine, RefineResult

ARTIFACTS_DIR = Path(__file__).resolve().parent.parent / "artifacts"


def main() -> None:
    if not (ARTIFACTS_DIR / "ingredient_embeddings.pkl").exists():
        print("Run layer3_artifact_build.ipynb first to create artifacts/")
        return

    # Example input (as from Layer 1 or Layer 2)
    ingredients = ["chicken breast", "rice", "broccoli", "olive oil"]
    cooking_methods = ["baked", "steamed"]
    sauces = 0.2
    portion_class = "medium"
    initial_macros = {
        "calories": 420,
        "fat": 14,
        "carbs": 48,
        "protein": 38,
        "sodium": 520,
    }

    result: RefineResult = refine(
        ingredients=ingredients,
        cooking_methods=cooking_methods,
        sauces=sauces,
        portion_class=portion_class,
        initial_macros=initial_macros,
        artifacts_dir=ARTIFACTS_DIR,
        top_k=7,
    )

    print("Refined macros:", result.refined_macros)
    print("Confidence:", round(result.confidence, 3))
    print("Similar dish IDs:", result.similar_dish_ids[:5], "...")
    print("Initial (from Layer 1/2):", result.initial_macros_used)


if __name__ == "__main__":
    main()
