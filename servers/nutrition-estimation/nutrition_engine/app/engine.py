"""Straight-through pipeline: Layer 1 → Layer 2 → Layer 3 (optional; default off in app.config)."""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

from app.schemas import (
    NutritionRequest,
    NutritionResponse,
    Layer1Output,
    Layer2Output,
    Layer3Output,
)
from layers import layer1, layer2, layer3

# Required keys for each handoff (L1 out = L2 in; L2 out = L3 in)
_L1_KEYS = frozenset(Layer1Output.__annotations__)
_L2_KEYS = frozenset(Layer2Output.__annotations__)
_L3_KEYS = frozenset(Layer3Output.__annotations__)


def _check_layer1_output(data: dict) -> Layer1Output:
    """Ensure L1 output has exact shape expected by Layer 2 (baseline_estimate)."""
    missing = _L1_KEYS - set(data)
    if missing:
        raise ValueError(f"Layer 1 output missing keys expected by Layer 2: {missing}")
    return data  # type: ignore[return-value]


def _check_layer2_output(data: dict) -> Layer2Output:
    """Ensure L2 output has exact shape expected by Layer 3 (l2_output)."""
    missing = _L2_KEYS - set(data)
    if missing:
        raise ValueError(f"Layer 2 output missing keys expected by Layer 3: {missing}")
    return data  # type: ignore[return-value]


def _check_layer3_output(data: dict) -> Layer3Output:
    """Ensure L3 output has keys the engine consumes (final_macros, etc.)."""
    missing = _L3_KEYS - set(data)
    if missing:
        raise ValueError(f"Layer 3 output missing required keys: {missing}")
    return data  # type: ignore[return-value]


def estimate_nutrition(req: NutritionRequest) -> NutritionResponse:
    from app.config import ENABLE_LAYER3

    # Split once — reused by Layer 1 (via _build_ingredients) and Layer 3 (when enabled)
    ingredient_names = layer1._split_description(req.get("description", ""))

    # 1️⃣ Layer 1 — baseline estimate (cooking_method used for retention factors)
    l1_out = layer1.estimate(
        item_name=req["item_name"],
        description=req["description"],
        modifiers=req.get("modifiers"),
        cooking_method=req.get("cooking_method"),
    )
    l1_out = _check_layer1_output(l1_out)

    # 2️⃣ Layer 2 — restaurant calibration (input = L1 output shape)
    l2_out = layer2.calibrate(
        baseline_estimate=l1_out,
        restaurant_metadata={
            "restaurant": req.get("restaurant"),
            "price": req.get("price"),
        },
    )
    l2_out = _check_layer2_output(l2_out)

    # 3️⃣ Layer 3 — similarity refinement (optional; skipped when ENABLE_LAYER3 is false)
    l3_out = layer3.apply_layer3(l2_out, ingredients=ingredient_names)
    l3_out = _check_layer3_output(l3_out)

    l1_c = float(l1_out.get("confidence", 1.0) or 1.0)
    l2_c = float(l2_out.get("layer2_confidence", 1.0) or 1.0)
    l3_c = float(l3_out.get("layer3_confidence", 1.0) or 1.0)
    if ENABLE_LAYER3:
        confidence = 0.5 * l1_c + 0.3 * l2_c + 0.2 * l3_c
    else:
        confidence = (0.5 * l1_c + 0.3 * l2_c) / 0.8

    from app.macro_llm_polish import maybe_polish_macros_with_llm
    from app.macro_plausibility import (
        assert_plausible_macros_for_response,
        reconcile_calories_to_macros,
    )
    from app.staple_macro_sanity import correct_macros_for_staples

    raw_macros = dict(l3_out["final_macros"])
    staple_corrected = correct_macros_for_staples(
        req.get("item_name", ""),
        req.get("description", ""),
        raw_macros,
    )
    fixed_macros = reconcile_calories_to_macros(staple_corrected)
    debug_out = {
        "layer1_macros": l1_out.get("macros"),
        "layer2_macros": l2_out.get("macros"),
        "layer3_macros": l3_out.get("final_macros"),
        "layer2_adjustments": l2_out.get("applied_adjustments"),
        "layer3_refinements": l3_out.get("refinements_applied"),
    }
    if staple_corrected != raw_macros:
        debug_out["staple_macro_override"] = {"before": raw_macros, "after": staple_corrected}
    if fixed_macros != staple_corrected:
        debug_out["calorie_atwater_reconcile"] = {
            "before": staple_corrected.get("calories"),
            "after": fixed_macros.get("calories"),
        }

    blob = " ".join(x for x in (req.get("item_name", ""), req.get("description", "")) if x).strip()
    fixed_macros, polish_meta = maybe_polish_macros_with_llm(fixed_macros, blob)
    if polish_meta is not None:
        debug_out["llm_macro_polish"] = polish_meta

    assert_plausible_macros_for_response(fixed_macros, blob)

    return {
        "macros": fixed_macros,
        "confidence": confidence,
        "debug": debug_out,
    }


class EstimationError(Exception):
    """Raised when the pipeline fails in a way the frontend should handle gracefully."""

    def __init__(self, message: str, stage: str, status_code: int = 502):
        super().__init__(message)
        self.stage = stage
        self.status_code = status_code


def _estimate_from_text_layered_pipeline(
    text: str,
    restaurant: Optional[str] = None,
    price: Optional[float] = None,
) -> NutritionResponse:
    """Layer 0 (RAG + LLM) → L1 → L2 (→ L3 only if NUTRITION_ENABLE_LAYER3=1)."""

    from layers import layer0

    l0_out = None
    l0_fallback_reason: Optional[str] = None

    try:
        l0_out = layer0.parse_free_text(text, restaurant=restaurant, price=price)
    except TimeoutError as exc:
        l0_fallback_reason = f"layer0_timeout: {exc}"
        logger.warning("Layer 0 timed out for %r — falling back to raw-text pipeline", text)
    except (ValueError, RuntimeError) as exc:
        l0_fallback_reason = f"layer0_error: {exc}"
        logger.warning("Layer 0 failed for %r (%s) — falling back to raw-text pipeline", text, exc)

    if l0_out is not None:
        req: NutritionRequest = {
            "item_name": l0_out["item_name"],
            "description": l0_out["description"],
        }
        if l0_out.get("restaurant"):
            req["restaurant"] = l0_out["restaurant"]
        if l0_out.get("price") is not None:
            req["price"] = l0_out["price"]
        if l0_out.get("modifiers"):
            req["modifiers"] = l0_out["modifiers"]
        if l0_out.get("cooking_method"):
            req["cooking_method"] = l0_out["cooking_method"]

        response = estimate_nutrition(req)
        response.setdefault("debug", {})
        response["debug"]["layer0"] = l0_out.get("_layer0_meta", {})
        response["debug"]["layer0_structured"] = {
            "item_name": l0_out.get("item_name"),
            "description": l0_out.get("description"),
            "restaurant": l0_out.get("restaurant"),
            "price": l0_out.get("price"),
            "modifiers": l0_out.get("modifiers"),
            "cooking_method": l0_out.get("cooking_method"),
        }
    else:
        # Fallback: treat the raw text as a structured request so L1→L2 still runs.
        req = {"item_name": text, "description": text}
        if restaurant:
            req["restaurant"] = restaurant
        if price is not None:
            req["price"] = price

        response = estimate_nutrition(req)
        response.setdefault("debug", {})
        response["debug"]["layer0"] = {"fallback_reason": l0_fallback_reason}
        response["debug"]["layer0_structured"] = None

    return response


def estimate_from_text(
    text: str,
    restaurant: Optional[str] = None,
    price: Optional[float] = None,
) -> NutritionResponse:
    """Free-text → NutritionResponse.

    When ESTIMATE_SIMPLE_LLM is true: one Gemini call for macros (fast v1).
    Default (false): Layer 0 + L1→L2 (L3 off unless NUTRITION_ENABLE_LAYER3=1). On simple-LLM failure: same.
    """
    from app.config import ESTIMATE_SIMPLE_LLM

    if ESTIMATE_SIMPLE_LLM:
        try:
            from app.macro_llm_polish import maybe_polish_macros_with_llm
            from app.macro_plausibility import (
                assert_plausible_macros_for_response,
                reconcile_calories_to_macros,
            )
            from app.simple_llm_macros import estimate_free_text_via_simple_llm
            from app.staple_macro_sanity import correct_macros_for_staples

            r = estimate_free_text_via_simple_llm(text, restaurant=restaurant, price=price)
            hint = str((r.get("debug") or {}).get("item_name_hint") or "")
            r["macros"] = reconcile_calories_to_macros(
                correct_macros_for_staples(hint, text, r["macros"])
            )
            r["macros"], polish_meta = maybe_polish_macros_with_llm(r["macros"], text)
            if polish_meta is not None:
                r.setdefault("debug", {})["llm_macro_polish"] = polish_meta
            assert_plausible_macros_for_response(r["macros"], text)
            return r
        except Exception as exc:
            logger.warning(
                "v1 simple LLM estimate failed for %r (%s); using layered pipeline",
                text,
                exc,
            )

    return _estimate_from_text_layered_pipeline(
        text, restaurant=restaurant, price=price
    )
