"""Straight-through pipeline: Layer 0 (optional) → Layer 1 → Layer 2 → Layer 3."""

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
    # Split once — reused by Layer 1 (via _build_ingredients) and Layer 3
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

    # 3️⃣ Layer 3 — similarity refinement (input = L2 output shape)
    l3_out = layer3.apply_layer3(l2_out, ingredients=ingredient_names)
    l3_out = _check_layer3_output(l3_out)

    # Confidence aggregation (fixed v1 rule)
    confidence = (
        0.5 * l1_out.get("confidence", 1.0)
        + 0.3 * l2_out.get("layer2_confidence", 1.0)
        + 0.2 * l3_out.get("layer3_confidence", 1.0)
    )

    return {
        "macros": l3_out["final_macros"],
        "confidence": confidence,
        "debug": {
            "layer1_macros": l1_out.get("macros"),
            "layer2_macros": l2_out.get("macros"),
            "layer3_macros": l3_out.get("final_macros"),
            "layer2_adjustments": l2_out.get("applied_adjustments"),
            "layer3_refinements": l3_out.get("refinements_applied"),
        },
    }


class EstimationError(Exception):
    """Raised when the pipeline fails in a way the frontend should handle gracefully."""

    def __init__(self, message: str, stage: str, status_code: int = 502):
        super().__init__(message)
        self.stage = stage
        self.status_code = status_code


def estimate_from_text(
    text: str,
    restaurant: Optional[str] = None,
    price: Optional[float] = None,
) -> NutritionResponse:
    """Layer 0 → full pipeline.  Accepts free-text, returns NutritionResponse.

    If the LLM times out or fails after all retries, falls back to running
    L1→L2→L3 with the raw text as the description so the request always
    returns an estimate instead of a 504 error.
    """
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
        # Fallback: treat the raw text as a structured request so L1→L2→L3 still runs.
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
