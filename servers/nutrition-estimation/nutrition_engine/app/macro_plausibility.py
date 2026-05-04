"""
Energy-balance and sanity checks for estimated macros.

Used by the layered pipeline (after staple corrections) and by the v1 simple-LLM path
(same rules → ValueError to trigger pipeline fallback).
"""

from __future__ import annotations

import re
from typing import Any, Dict, List

# Phrases that imply a meaningful protein source in a typical meal log (not oil-only, etc.)
_PROTEIN_STAPLE_RX = re.compile(
    r"\b("
    r"eggs?|scrambled|omelet|omelette|poached|egg whites?|egg yolks?|"
    r"chicken|beef|pork|steak|salmon|tuna|turkey|cod|halibut|tilapia|"
    r"\bfish\b|shrimp|prawns?|crab|lobster|lamb|duck|"
    r"yogurt|yoghurt|greek yogurt|cottage cheese|cheese|whey|"
    r"tofu|tempeh|seitan|edamame|lentils?\b|black beans?|kidney beans?|"
    r"protein (powder|bar|shake)|"
    r"\b(whole |skim |2% |1% |low-?fat )?milk\b"
    r")\b",
    re.IGNORECASE,
)


# User explicitly logging a drink / candy / pure sugar — allow near-zero P/F.
_CARB_SNACK_OR_DRINK_EXEMPT = re.compile(
    r"\b(?:"
    r"soda|soft drink|pop|cola|pepsi|sprite|fanta|dr pepper|mountain dew|"
    r"juice|lemonade|sweet tea|iced tea|"
    r"gatorade|powerade|vitaminwater|"
    r"energy drink|red bull|monster|"
    r"candy|gumm|skittles|starburst|licorice|jelly beans|sour patch|"
    r"syrup|maple syrup|agave|honey|molasses|simple syrup|"
    r"marshmallow|frosting|icing|glucose gel|gu gel"
    r")\b",
    re.IGNORECASE,
)


def text_suggests_protein_staple(text: str) -> bool:
    """True when free text likely names an animal/legume protein or dairy (not plant-milk-only)."""
    s = (text or "").strip().lower()
    if not s:
        return False
    if any(b in s for b in ("eggplant", "egg roll", "egg foo", "egg tart", "eggnog")):
        return False
    if any(p in s for p in ("almond milk", "soy milk", "oat milk", "coconut milk", "rice milk", "hemp milk")):
        s = re.sub(
            r"\b(almond|soy|oat|coconut|rice|hemp)\s+milk\b",
            " ",
            s,
            flags=re.IGNORECASE,
        )
    return bool(_PROTEIN_STAPLE_RX.search(s))


def atwater_kcal_from_macros(macros: Dict[str, Any]) -> float:
    p = max(0.0, float(macros.get("protein") or 0))
    c = max(0.0, float(macros.get("carbs") or 0))
    f = max(0.0, float(macros.get("fat") or 0))
    return p * 4.0 + c * 4.0 + f * 9.0


def reconcile_calories_to_macros(macros: Dict[str, Any]) -> Dict[str, Any]:
    """
    If stored calories disagree wildly with the Atwater sum, trust the macros
    and recompute calories. Catches corrupted DB nutrient rows (wrong kcal but
    sane macro grams) without per-ingredient special cases.

    Returns a possibly-modified copy of ``macros``.
    """
    out = dict(macros)
    p = float(out.get("protein") or 0)
    c = float(out.get("carbs") or 0)
    f = float(out.get("fat") or 0)
    cal = float(out.get("calories") or 0)

    if p <= 0 and c <= 0 and f <= 0:
        return out

    mk = atwater_kcal_from_macros(out)
    if mk < 5.0 or cal < 5.0:
        return out

    ratio = cal / mk
    # >40% disagreement in either direction is strong evidence the stored kcal
    # is wrong. Trust the per-gram macros (which downstream code already uses).
    if ratio < 0.6 or ratio > 1.4:
        out["calories"] = mk
    return out


def macro_plausibility_issues(macros: Dict[str, Any], context: str) -> List[str]:
    """
    Return human-readable issue codes if ``macros`` should not be returned as-is.

    ``context`` is the user's phrase (item_name + description or free-text log).
    """
    issues: List[str] = []
    ctx = (context or "").strip()
    cal = float(macros.get("calories") or 0)
    p = float(macros.get("protein") or 0)
    c = float(macros.get("carbs") or 0)
    f = float(macros.get("fat") or 0)

    for name, v in (("protein", p), ("carbs", c), ("fat", f), ("calories", cal)):
        if v < -1e-6:
            issues.append(f"negative_{name}")

    if cal > 25_000:
        issues.append("calories_unrealistically_high")
    if p > 500 or c > 1_200 or f > 400:
        issues.append("macro_grams_unrealistic_for_single_log")

    mk = atwater_kcal_from_macros({"protein": p, "carbs": c, "fat": f})

    # Near-zero logging (water, spices): skip energy-balance rules
    if cal < 3.0 and mk < 5.0:
        return issues

    if cal >= 45.0 and mk < 15.0:
        issues.append("macro_energy_far_below_stated_calories")
    elif cal >= 55.0 and mk < 0.55 * cal:
        issues.append("macro_energy_explains_too_few_calories")
    if cal >= 45.0 and mk > 1.45 * cal + 50.0:
        issues.append("macro_energy_explains_too_many_calories")

    if text_suggests_protein_staple(ctx) and cal >= 95.0 and p < 3.5:
        issues.append("protein_staple_text_but_almost_no_protein")

    sl = ctx.lower()
    eggish = bool(re.search(r"\beggs?\b", sl)) and "eggplant" not in sl
    if eggish and cal >= 100.0 and f < 2.0 and c > 35.0 and p < 8.0:
        issues.append("egg_like_high_carb_low_protein")

    # Atwater-consistent but absurd as a generic meal: almost all kcal from carbs,
    # negligible protein and fat (e.g. mis-parsed starch / wrong ingredient row).
    # Skips explicit soda/juice/candy logs.
    carb_kcal = 4.0 * max(0.0, c)
    if (
        cal >= 120.0
        and p < 1.0
        and f < 1.0
        and c >= 35.0
        and carb_kcal / max(cal, 1.0) > 0.82
        and not _CARB_SNACK_OR_DRINK_EXEMPT.search(ctx)
    ):
        issues.append("carb_kcal_dominated_minimal_protein_fat")

    return issues


def assert_plausible_macros_for_response(macros: Dict[str, Any], context: str) -> None:
    """Raise ``EstimationError`` if macros fail checks (nothing nonsensical is returned)."""
    issues = macro_plausibility_issues(macros, context)
    if not issues:
        return
    from app.engine import EstimationError

    raise EstimationError(
        "Macro estimate failed plausibility checks: " + "; ".join(issues),
        "macro_plausibility",
        502,
    )
