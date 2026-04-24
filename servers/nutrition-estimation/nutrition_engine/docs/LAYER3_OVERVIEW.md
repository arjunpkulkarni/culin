# Layer 3: What’s happening

## Role in the pipeline

**Order:** Layer 1 → Layer 2 → **Layer 3** → final response.

- **Layer 1:** Baseline macros from item name + description + modifiers (parser + DB).
- **Layer 2:** Restaurant/price calibration (multipliers, fallbacks).
- **Layer 3:** **Similarity refinement** – adjusts L2 macros using “similar dishes” from a prebuilt embedding space, then returns **final_macros** and **layer3_confidence**.

The engine combines confidence as: `0.5*L1 + 0.3*L2 + 0.2*L3` and returns L3’s **final_macros** as the response macros.

---

## Startup (what gets loaded)

In **`app/startup.py`**:

1. `layer3.load_embeddings(str(LAYER3_ARTIFACTS))` is called.
2. **LAYER3_ARTIFACTS** = `artifacts/layer3/` (or whatever `NUTRITION_ARTIFACTS` + `layer3` is).
3. Layer 3’s **loader** tries to read from that directory:
   - `ingredient_embeddings.pkl` – ingredient name → embedding vector
   - `dish_embeddings.pkl` – dish_id → `{ "embedding", "macros" }`
   - `neighbor_index.pkl` – dish_id → list of similar dishes (neighbor_id, similarity, macro_deltas)
   - `macro_delta_stats.json` – per-macro bounds (e.g. p10, p90) for clamping
   - `confidence_params.json` – how to turn similarity/coverage into confidence

If any file is missing, Layer 3 sets `_artifacts = None` and **pass-through mode** is used: L2 output is returned as-is (no refinement), with `layer3_confidence = 1.0` and empty `refinements_applied`.

---

## Per-request (what happens when you call /estimate)

In **`app/engine.py`**:

1. L1 and L2 run as usual.
2. **`layer3.apply_layer3(l2_output)`** is called with L2’s `macros` (and any other L2 keys).

In **`layers/layer3/__init__.py`** (`apply_layer3`):

1. If **artifacts were not loaded**, it returns L2 macros unchanged and exits.
2. If artifacts **were** loaded, it calls the inner **`refine()`** with:
   - **ingredients** = `[]` (empty)
   - **cooking_methods** = `["baked"]`
   - **sauces** = `0.2`
   - **portion_class** = `"medium"`
   - **initial_macros** = L2’s macros (calories, fat, carbs, protein, sodium)

So today the **dish context** (ingredients, cooking method, etc.) passed to Layer 3 is **fixed**, not derived from the request. Refinement is driven by:

- L2’s **macros** (the only request-dependent input), and  
- The **embedding** built from empty ingredients + “baked” + 0.2 + “medium”.

That embedding is used to find **top-k similar dishes** in `dish_embeddings`. Their macros and **macro_delta_stats** are then used to refine **initial_macros** (L2 output) into **refined_macros**, which become the **final_macros** in the API response.

So in short:

- **What’s happening:** Layer 3 loads artifacts at startup; on each request it takes L2 macros, builds a **generic** dish embedding (no real ingredients from the request), finds similar dishes in the artifact set, and refines L2 macros with bounded adjustments into **final_macros**.
- **Pass-through:** If artifacts are missing or refinement fails, Layer 3 just returns L2’s macros and a default confidence.

---

## Artifacts (where they come from)

- **Minimal (in-repo):**  
  `python scripts/build_layer3_artifacts.py`  
  Writes placeholder artifacts under **`artifacts/layer3/`** so Layer 3 runs without the external repo.

- **Full (production):**  
  Build with the [Layer 3 repo](https://github.com/vedaankb/CulinAIAPP-Layer3) (e.g. `layer3_artifact_build.ipynb`), then copy the generated files into **`artifacts/layer3/`**.

---

## Possible improvement: pass real dish context

The **refine()** API supports **ingredients**, **cooking_methods**, **sauces**, and **portion_class**. Right now the engine does **not** pass these from the request; it uses fixed values.

To make Layer 3 use the actual dish:

- Either **derive** ingredients (and optionally cooking method) from Layer 1’s parser output (e.g. parsed ingredient names + a default or inferred cooking method), or  
- Add a minimal **mapping** from `item_name` / `description` / `modifiers` to a list of ingredient-like tokens and a cooking method.

Then **`apply_layer3`** would pass those into **refine()** instead of `ingredients=[]` and `cooking_methods=["baked"]`, so the embedding and similar-dish lookup would be based on the real dish.
