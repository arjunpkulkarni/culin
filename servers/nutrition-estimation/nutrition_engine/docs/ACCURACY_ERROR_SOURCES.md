# Why Estimates Can Be >20% Off (and What We Fixed)

## Main error sources (in order of impact)

### 1. **Raw vs cooked nutrition (Layer 1)** — FIXED
- **Cause:** The lookup used to always prefer USDA foods with `cooking_state = raw`. Restaurant items are usually cooked (fried, grilled, baked). Raw meat has different calories/fat per 100g than cooked (water loss, fat retention).
- **Fix:** Lookup now prefers a USDA food with a cooked state (`cooked`, `fried`, `grilled`, `baked`, `roasted`, `broiled`, `sauteed`) when available, then falls back to raw, then to the first available. So we use cooked nutrition when the DB has it.

### 2. **Portion sizes (Layer 0 + Layer 1)**
- **Cause:** LLM-estimated grams or type-based defaults (e.g. 90g patty, 55g bun) can differ from real portions. Fast-food portions are often smaller (e.g. Big Mac patty ~45g each, bun ~45g).
- **What helps:** Layer 0 prompt asks for gram estimates; Layer 1 uses type-based defaults when no conversion exists. Refining portion guidance (e.g. “fast-food patty ~45g, bun ~45g”) in the prompt or in `_default_grams_for_piece` can reduce error.

### 3. **Missing or wrong ingredient match (Layer 0 + Layer 1)**
- **Cause:** If the LLM picks a name not in the DB, or Layer 1 fuzzy-matches to a different ingredient (e.g. “ground beef 80%” vs “95% lean”), we get wrong per-100g nutrition or skip the ingredient (underestimate).
- **What helps:** Layer 0 is constrained to RAG candidate names only. Ensuring RAG returns relevant candidates (and the LLM picks the best match for “a type of tomato”) keeps matches in the DB and improves consistency.

### 4. **Cooking method never passed (Layer 1)**
- **Cause:** `calculate_recipe(..., cooking_method=None)` is always called with `None`, so retention factors and cooked-food selection in the DB path are unused. The lookup path uses a single profile per ingredient (now preferring cooked when available) and a flat 0.9 retention.
- **Possible improvement:** Have Layer 0 output a cooking method (e.g. “fried”, “grilled”) and pass it into Layer 1 so we can select cooked USDA food or apply retention when the DB supports it.

### 5. **Layer 2 calibration**
- **Cause:** Default multipliers are 1.0; trained multipliers depend on the disclosure data. If the model was trained on different chains or a small set, adjustments can be off.
- **What helps:** Retrain or tune Layer 2 on the same chains you care about; or use the 35-dish test set to derive a global or per-category correction so mean error drops (e.g. aim for <20% mean absolute error).

### 6. **Layer 3 refinement**
- **Cause:** Similar-dish deltas can add noise if the “similar” dishes are not nutritionally similar.
- **What helps:** Review similarity criteria and delta application; optionally relax or disable refinement and compare metrics.

---

## Summary
- **Largest fix applied:** Prefer **cooked** USDA profiles in Layer 1 lookup when available so restaurant-style dishes use cooked nutrition instead of raw.
- To get **consistently under 20% difference**, also tighten portions (Layer 0 + Layer 1 defaults), ensure RAG + LLM only use DB names, and consider passing cooking method and tuning Layer 2/3 on your target dishes.
