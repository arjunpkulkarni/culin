"""
v1 optional path for POST /estimate-from-text: a single Gemini call that returns macros.

Full Layer 0 + L1→L3 pipeline remains in app.engine — this module is only used when
ESTIMATE_SIMPLE_LLM is enabled (default: on). On any failure callers should fall back.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from app.schemas import NutritionResponse

logger = logging.getLogger(__name__)

_SIMPLE_SYSTEM = """You are a nutrition assistant. The user logs what they ate in natural language.

Your job:
- Infer a reasonable SINGLE portion (typical household or restaurant serving) when the amount is vague.
  Examples: "two eggs" = two large hen eggs (~12–14 g protein combined). "coffee" alone = plain black cup unless they say latte etc.
- Return total estimated calories and macros for THAT portion only.
- Use whole numbers only for all numeric fields.
- Never return all zeros unless the description is genuinely non-food."""

_SIMPLE_USER_TMPL = """Return ONLY valid JSON with these exact keys (no markdown):
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

    macros = _clamp_macros(raw)
    name = str(raw.get("item_name") or t).strip()[:200]

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
