"""
v1 optional path for POST /estimate-from-text: a single Gemini call that returns macros.

Used only when ``ESTIMATE_SIMPLE_LLM`` is true (see ``app.config``). Default is the full
Layer 0 + L1→L3 pipeline in ``app.engine``; on any failure here callers fall back there.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from app.macro_plausibility import macro_plausibility_issues
from app.schemas import NutritionResponse

logger = logging.getLogger(__name__)

_SIMPLE_SYSTEM = """You are a nutrition assistant. The user logs what they ate in natural language.

Your job:
- Infer a reasonable SINGLE portion (typical household or restaurant serving) when the amount is vague.
  Examples: "two eggs" = two large hen eggs (~12–14 g protein combined, ~10 g fat combined, ~140–160 kcal total). "coffee" alone = plain black cup unless they say latte etc.
- Return total estimated calories and macros for THAT portion only.
- Use whole numbers only for all numeric fields.
- Never return all zeros unless the description is genuinely non-food.
- Stated calories must be consistent with macros: approximately calories ≈ 4×(protein + carbs) + 9×fat (within ~25%). Do not output a large calorie number with protein and fat both zero unless the food is almost pure sugar/starch.
- Hen eggs always contribute meaningful protein and fat; never model plain "eggs" as mostly carbs."""

_SIMPLE_USER_TMPL = """Return ONLY valid JSON with these exact keys at the top level (no markdown, no nested "macros" object):
{{
  "item_name": "short human-readable label",
  "calories": <int kcal>,
  "protein": <int grams>,
  "carbs": <int grams>,
  "fat": <int grams>,
  "rationale_brief": "one short sentence explaining the portion assumption"
}}

User ate (free text):
{text}
{hints}"""


def _coerce_nonneg_num(val: Any) -> float:
    try:
        if isinstance(val, str):
            v = float(val.replace(",", "").strip())
        else:
            v = float(val)
        if v != v or v < 0:
            return 0.0
        return v
    except (TypeError, ValueError):
        return 0.0


def _flatten_llm_payload(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Merge nested ``macros`` / ``final_macros`` so Gemini alternate shapes still parse."""
    flat: Dict[str, Any] = dict(raw)
    nested = raw.get("macros") if isinstance(raw.get("macros"), dict) else None
    if nested is None and isinstance(raw.get("final_macros"), dict):
        nested = raw.get("final_macros")
    if isinstance(nested, dict):
        for k, v in nested.items():
            if flat.get(k) in (None, "", 0, 0.0) and v not in (None, ""):
                flat[k] = v
    return flat


def _read_macro_component(flat: Dict[str, Any], *candidates: str) -> float:
    lower_index = {str(k).lower(): v for k, v in flat.items() if isinstance(k, str)}
    for name in candidates:
        if name in flat:
            return _coerce_nonneg_num(flat.get(name))
        ln = name.lower()
        if ln in lower_index:
            return _coerce_nonneg_num(lower_index[ln])
    return 0.0


def _macros_from_llm_raw(raw: Dict[str, Any]) -> Dict[str, float]:
    flat = _flatten_llm_payload(raw)
    return {
        "calories": _read_macro_component(flat, "calories", "kcal", "energy_kcal", "energy"),
        "protein": _read_macro_component(flat, "protein", "protein_g", "proteinGrams"),
        "carbs": _read_macro_component(
            flat, "carbs", "carbohydrates", "carbohydrates_g", "carbs_g", "carbohydrate"
        ),
        "fat": _read_macro_component(flat, "fat", "fat_g", "total_fat", "lipid"),
    }


def _clamp_macros(d: Dict[str, Any]) -> Dict[str, float]:
    def f(name: str) -> float:
        v = float(d.get(name) or 0)
        return max(0.0, min(v, 20000.0 if name == "calories" else 2000.0))

    return {
        "calories": f("calories"),
        "protein": f("protein"),
        "carbs": f("carbs"),
        "fat": f("fat"),
    }


def estimate_free_text_via_simple_llm(
    text: str,
    *,
    restaurant: Optional[str] = None,
    price: Optional[float] = None,
) -> NutritionResponse:
    """Single LLM round-trip → NutritionResponse-shaped dict."""
    from layers.layer0.llm_providers import get_provider

    t = (text or "").strip()
    if not t:
        raise ValueError("Empty text")

    hints = ""
    if restaurant:
        hints += f'\nRestaurant context: "{restaurant}"\n'
    if price is not None:
        hints += f"Approx dish price hint: ${price:.2f}\n"

    user_prompt = _SIMPLE_USER_TMPL.format(text=t, hints=hints or "")
    provider = get_provider()
    raw = provider.generate_structured(_SIMPLE_SYSTEM, user_prompt)

    merged = _macros_from_llm_raw(raw)
    macros = _clamp_macros(merged)
    name = str(raw.get("item_name") or t).strip()[:200]

    # If the model returns all zeros, fall back to the Layer 0 + L1→L3 pipeline (USDA-backed).
    if sum(macros.get(k, 0.0) for k in ("calories", "protein", "carbs", "fat")) < 1e-6:
        raise ValueError("simple_llm_returned_zero_macros")

    if macro_plausibility_issues(macros, t):
        logger.warning(
            "v1 simple LLM returned implausible macros for %r: %s — using layered pipeline",
            t,
            macros,
        )
        raise ValueError("simple_llm_implausible_macros")

    rationale = raw.get("rationale_brief")
    return {
        "macros": macros,
        "confidence": 0.72,
        "debug": {
            "estimate_mode": "v1_simple_llm",
            "item_name_hint": name,
            "simple_llm_rationale": rationale,
            "simple_llm_raw": raw,
        },
    }
