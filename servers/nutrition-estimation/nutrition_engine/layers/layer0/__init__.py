"""Layer 0: LLM-powered free-text -> structured NutritionRequest via RAG.

Uses Layer 1's in-memory LookupTables for candidate retrieval when available,
avoiding a redundant DB round-trip. Falls back to direct DB queries only when
lookup tables haven't been loaded.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def parse_free_text(
    text: str,
    restaurant: Optional[str] = None,
    price: Optional[float] = None,
) -> Dict[str, Any]:
    """Convert free-text food description into a structured NutritionRequest dict.

    Pipeline:
      1. Extract search terms from the text
      2. Retrieve candidate ingredients (in-memory lookup first, DB fallback)
      3. LLM re-ranks candidates and produces structured output
    """
    from layers.layer0.rag import extract_search_terms, retrieve_candidates, rerank_and_structure

    search_terms = extract_search_terms(text)
    # Add the full text as an additional retrieval hint (helps when the split terms miss key tokens)
    if text and text.strip():
        full = text.strip()
        if full not in search_terms:
            search_terms = [full] + search_terms
    logger.info("Layer 0: extracted %d search terms: %s", len(search_terms), search_terms)

    candidates = retrieve_candidates(search_terms)
    logger.info("Layer 0: RAG returned %d candidates", len(candidates))

    result = rerank_and_structure(
        user_text=text,
        candidates=candidates,
        restaurant_hint=restaurant,
        price_hint=price,
    )

    required = {"item_name", "description"}
    missing = required - set(result)
    if missing:
        raise ValueError(f"Layer 0 LLM output missing required keys: {missing}")

    # Repair pass: ensure every ingredient resolves to a known ingredient_id with a nutrient profile.
    # This prevents "0 macros" failures caused by LLM output that can't be matched downstream.
    repaired = False
    dropped: List[str] = []
    dropped_modifiers: List[str] = []
    try:
        from layer1_app.services.lookup import get_lookup_tables
        from layer1_app.services.parser import IngredientParser
    except ImportError:
        try:
            from app.services.lookup import get_lookup_tables
            from app.services.parser import IngredientParser
        except ImportError:
            get_lookup_tables = lambda: None  # noqa: E731
            IngredientParser = None  # type: ignore[assignment]

    tables = get_lookup_tables()
    if tables is not None and IngredientParser is not None:
        parser = IngredientParser(db=None, lookup_tables=tables)
        cm = (result.get("cooking_method") or "").strip().lower()
        text_lower = (text or "").lower()
        parts = [p.strip() for p in str(result.get("description", "")).split(",") if p.strip()]
        fixed_parts: List[str] = []
        for p in parts:
            parsed = parser.parse(p)
            if parsed.ingredient_id is None:
                dropped.append(p)
                continue
            if parsed.ingredient_id not in tables.nutrient_profiles:
                dropped.append(p)
                continue
            # Canonicalize to grams + canonical ingredient name so Layer 1 always matches.
            mass_g = float(parsed.mass_g or 0.0)
            if mass_g <= 0.0:
                dropped.append(p)
                continue

            # Heuristic decomposition: some DB "fry" ingredients are nutritionally nonsensical (e.g. 0g fat).
            # For fried breaded items, decompose into chicken breast + flour + absorbed oil when possible.
            prof = tables.nutrient_profiles.get(parsed.ingredient_id, {})
            p100 = float(prof.get("protein_g") or 0.0)
            c100 = float(prof.get("carbohydrates_g") or 0.0)
            f100 = float(prof.get("fat_g") or 0.0)
            name_l = (parsed.ingredient_name or "").lower()
            is_bad_fry = (
                cm == "fried"
                and ("fry" in name_l)
                and f100 < 5.0
                and c100 > 25.0
                and p100 < 15.0
                and ("chicken" in name_l)
            )
            if is_bad_fry:
                breast = tables.name_to_ingredient.get("chicken breast")
                flour = tables.name_to_ingredient.get("all-purpose flour")
                oil = tables.name_to_ingredient.get("canola oil")
                if (
                    breast and flour and oil
                    and breast.id in tables.nutrient_profiles
                    and flour.id in tables.nutrient_profiles
                    and oil.id in tables.nutrient_profiles
                ):
                    breast_g = int(round(mass_g * 0.70))
                    flour_g = int(round(mass_g * 0.12))
                    oil_g = int(round(mass_g * 0.18))
                    fixed_parts.append(f"{max(1, breast_g)}g {breast.name}")
                    fixed_parts.append(f"{max(1, flour_g)}g {flour.name}")
                    fixed_parts.append(f"{max(1, oil_g)}g {oil.name}")
                    repaired = True
                    continue

            g = int(round(mass_g))
            fixed_parts.append(f"{g}g {parsed.ingredient_name}")

        # Incorporate modifiers as ingredient additions only if they can be resolved.
        # Also drop unsafe/free-form modifiers so Layer 1 doesn't try to parse them as ingredients.
        safe_mods: List[str] = []
        raw_mods = result.get("modifiers") or []
        if isinstance(raw_mods, list):
            for m in raw_mods:
                ms = str(m).strip()
                if not ms:
                    continue
                parsed = parser.parse(ms)
                if parsed.ingredient_id is None or parsed.ingredient_id not in tables.nutrient_profiles:
                    dropped_modifiers.append(ms)
                    continue
                mass_g = float(parsed.mass_g or 0.0)
                if mass_g <= 0.0:
                    dropped_modifiers.append(ms)
                    continue
                g = int(round(mass_g))
                fixed_parts.append(f"{g}g {parsed.ingredient_name}")
                safe_mods.append(ms)
        result["modifiers"] = safe_mods

        # If the dish is cooked in a fat-heavy way, ensure a plausible cooking fat is present.
        if cm in {"fried", "sauteed", "grilled", "baked", "roasted", "broiled"}:
            has_fat_source = any(
                any(k in fp.lower() for k in ("oil", "butter", "margarine", "shortening"))
                for fp in fixed_parts
            )
            if not has_fat_source:
                fat_names = ["canola oil", "vegetable oil", "olive oil", "butter"]
                fried_heavy = any(k in text_lower for k in ("fries", "tater", "tots", "chips", "fingers", "nuggets"))
                grams = 30 if (cm == "fried" and fried_heavy) else 18 if cm == "fried" else 10 if cm in {"sauteed", "grilled"} else 8
                for fn in fat_names:
                    row = tables.name_to_ingredient.get(fn)
                    if row and row.id in tables.nutrient_profiles:
                        fixed_parts.append(f"{grams}g {row.name}")
                        repaired = True
                        break
        if fixed_parts:
            if ",".join(fixed_parts) != ",".join(parts):
                repaired = True
            result["description"] = ", ".join(fixed_parts)
        else:
            # Worst-case fallback: pick the top candidate (already filtered to have profiles in lookup path)
            # to avoid downstream returning all-zero macros.
            if candidates:
                top = candidates[0]["name"]
                result["description"] = f"250g {top}"
                repaired = True
            else:
                # Leave as-is; downstream may still stub/zero but we have no candidates to repair with.
                dropped = parts

    return {
        "item_name": result["item_name"],
        "description": result["description"],
        "restaurant": result.get("restaurant"),
        "price": result.get("price"),
        "modifiers": result.get("modifiers", []),
        "cooking_method": result.get("cooking_method"),
        "_layer0_meta": {
            "search_terms": search_terms,
            "candidates_count": len(candidates),
            "raw_llm_output": result,
            "description_repaired": repaired,
            "dropped_description_parts": dropped,
            "dropped_modifiers": dropped_modifiers,
        },
    }
