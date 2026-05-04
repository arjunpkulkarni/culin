"""
Optional final Gemini pass: validate macro totals for the food context and revise
if automated plausibility checks would flag the estimate.

Runs when ``LLM_API_KEY`` is set and ``NUTRITION_LLM_MACRO_POLISH`` is on (default).
By default ``NUTRITION_LLM_MACRO_POLISH_ALWAYS`` is true so every estimate gets a review;
set ``NUTRITION_LLM_MACRO_POLISH_ALWAYS=0`` to run only when ``macro_plausibility_issues`` is non-empty.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

_SYSTEM = """You are a clinical nutrition editor reviewing ONE automated macro estimate for a food log.

Your job:
1) Decide if protein, carbs, fat, and calories are plausible for the food description (portion implied by the pipeline).
2) If the estimate is already plausible, set looks_good to true and echo the same numbers (lightly rounded).
3) If not plausible (e.g. meaningful calories but ~0 protein and ~0 fat while carbs dominate; eggs/fish/meat modeled as starch; etc.), set looks_good to false and output corrected macros.

Hard rules for corrections:
- Keep **calories within ±18%** of TARGET_CALORIES unless the only fix is to move calories; then stay within ±25%.
- **Atwater**: calories must approximately equal 4×(protein + carbs) + 9×fat (grams), within ±15%. Adjust P/C/F so both Atwater and your stated calories align.
- Hen eggs, chicken, fish, beef, dairy, legumes must not be returned as ~0 protein with very high carbs unless the user text clearly describes soda/candy/starch-only junk.
- Use non-negative numbers only.

Return ONLY valid JSON with these keys:
- looks_good (boolean)
- calories (number, kcal)
- protein (number, g)
- carbs (number, g)
- fat (number, g)
- reason (string, one short sentence)
"""


def _coerce_nonneg(val: Any, cap: float) -> float:
    try:
        if isinstance(val, str):
            v = float(val.replace(",", "").strip())
        else:
            v = float(val)
        if v != v or v < 0:
            return 0.0
        return min(v, cap)
    except (TypeError, ValueError):
        return 0.0


def _macros_from_polish_raw(raw: Dict[str, Any]) -> Dict[str, float]:
    return {
        "calories": _coerce_nonneg(raw.get("calories"), 25_000.0),
        "protein": _coerce_nonneg(raw.get("protein"), 500.0),
        "carbs": _coerce_nonneg(raw.get("carbs"), 1_200.0),
        "fat": _coerce_nonneg(raw.get("fat"), 400.0),
    }


def _call_polish_llm(
    *,
    context: str,
    issues: List[str],
    macros: Dict[str, Any],
    target_calories: float,
) -> Dict[str, Any]:
    from layers.layer0.llm_providers import get_provider

    payload = {
        "calories": macros.get("calories"),
        "protein": macros.get("protein"),
        "carbs": macros.get("carbs"),
        "fat": macros.get("fat"),
    }
    if macros.get("sodium") is not None:
        payload["sodium"] = macros.get("sodium")

    user = f"""Food context (what the user logged / dish):
{context[:8000]}

Automated issue codes (empty list = optional quality review only):
{json.dumps(issues)}

TARGET_CALORIES (anchor from the estimation pipeline — stay close unless clearly wrong):
{target_calories:.1f}

INPUT_MACROS:
{json.dumps(payload)}
"""
    provider = get_provider()
    return provider.generate_structured(_SYSTEM, user)


def maybe_polish_macros_with_llm(
    macros: Dict[str, Any],
    context: str,
) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]]]:
    """
    Optionally ask Gemini to validate / revise macros.

    Returns ``(macros_out, debug_meta)``. ``debug_meta`` is None when polish was skipped.
    """
    from app.config import (
        LLM_API_KEY,
        NUTRITION_LLM_MACRO_POLISH,
        NUTRITION_LLM_MACRO_POLISH_ALWAYS,
    )
    from app.macro_plausibility import macro_plausibility_issues, reconcile_calories_to_macros

    if not NUTRITION_LLM_MACRO_POLISH or not (LLM_API_KEY or "").strip():
        return macros, None

    ctx = (context or "").strip()
    issues = macro_plausibility_issues(macros, ctx)
    if not issues and not NUTRITION_LLM_MACRO_POLISH_ALWAYS:
        return macros, None

    anchor = float(macros.get("calories") or 0.0)
    meta: Dict[str, Any] = {
        "attempted": True,
        "issues_before": list(issues),
        "always_mode": bool(NUTRITION_LLM_MACRO_POLISH_ALWAYS),
    }

    try:
        raw = _call_polish_llm(
            context=ctx,
            issues=issues,
            macros=macros,
            target_calories=anchor,
        )
    except Exception as exc:
        logger.warning("macro LLM polish call failed: %s", exc)
        meta["error"] = str(exc)
        return macros, meta

    meta["raw"] = raw
    looks_good = bool(raw.get("looks_good"))

    # When automated checks already failed, do not trust looks_good=true blindly.
    if issues:
        looks_good = False

    if looks_good and not issues:
        meta["applied"] = False
        meta["reason"] = str(raw.get("reason") or "model_ok")
        return macros, meta

    candidate = _macros_from_polish_raw(raw)
    if macros.get("sodium") is not None:
        candidate["sodium"] = float(macros.get("sodium") or 0.0)

    candidate = reconcile_calories_to_macros(candidate)

    if macro_plausibility_issues(candidate, ctx):
        logger.warning(
            "LLM macro polish still failed plausibility for context=%r candidate=%s",
            ctx[:120],
            candidate,
        )
        meta["applied"] = False
        meta["reason"] = "polish_did_not_clear_checks"
        return macros, meta

    meta["applied"] = True
    meta["reason"] = str(raw.get("reason") or "")
    meta["macros_after"] = dict(candidate)
    return candidate, meta
