"""Post-pipeline corrections when staple foods get Atwater-plausible but biologically wrong macros."""

from __future__ import annotations

import logging
import re
from typing import Any, Dict

from app.macro_plausibility import atwater_kcal_from_macros

logger = logging.getLogger(__name__)

# ~1 large hen egg (50 g shell-on raw), USDA-rounded per egg
_HEN_EGG = {"calories": 72.0, "protein": 6.3, "carbs": 0.6, "fat": 5.0}


def _eggish(blob: str) -> bool:
    b = (blob or "").lower()
    if any(x in b for x in ("eggplant", "egg roll", "egg foo", "egg tart", "eggnog")):
        return False
    return bool(re.search(r"\beggs?\b", b))


def _infer_hen_egg_count(blob: str) -> int:
    """How many large eggs the user likely meant; 0 if phrase is not egg-centric."""
    if not _eggish(blob):
        return 0
    t = blob.lower()
    m = re.search(r"\b(\d{1,2})\s+eggs?\b", t)
    if m:
        return min(12, max(1, int(m.group(1))))
    word_to_n = {
        "twelve": 12,
        "eleven": 11,
        "ten": 10,
        "nine": 9,
        "eight": 8,
        "seven": 7,
        "six": 6,
        "five": 5,
        "four": 4,
        "three": 3,
        "two": 2,
        "one": 1,
        "a": 1,
        "an": 1,
        "single": 1,
        "couple": 2,
        "pair": 2,
        "dozen": 12,
    }
    for w, n in word_to_n.items():
        if re.search(rf"\b{w}\s+eggs?\b", t):
            return min(12, n)
    if re.search(r"\b(half\s+a\s+dozen|half\s+dozen)\s+eggs?\b", t):
        return 6
    # Bare "egg" / "eggs" / "scrambled egg" etc.
    if re.search(r"\beggs?\b", t):
        return 1
    return 0


def correct_macros_for_staples(
    item_name: str,
    description: str,
    macros: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Hen eggs sometimes resolve to high-carb / zero-protein rows after L2.
    Replace with a simple per-egg profile when text is clearly egg-centric and macros look wrong.
    """
    out = dict(macros)
    blob = " ".join(x for x in (item_name or "", description or "") if x).strip()
    n_eggs = _infer_hen_egg_count(blob)
    if n_eggs <= 0:
        return out
    # Long multi-ingredient blurbs: do not override whole-recipe estimates.
    if len(blob) > 200 or blob.count("\n") > 6:
        return out

    p = float(out.get("protein") or 0)
    c = float(out.get("carbs") or 0)
    cal = float(out.get("calories") or 0)
    mk = atwater_kcal_from_macros(out)

    looks_wrong = p < 4.0 or (c > 18 and p < 10.0)
    plausible_atwater = cal > 40 and mk >= 0.20 * cal
    if not looks_wrong and plausible_atwater:
        return out

    logger.info(
        "staple_macro_sanity: egg-like text %r — overriding macros %s with %d× hen egg profile",
        blob[:120],
        {k: out.get(k) for k in ("calories", "protein", "carbs", "fat")},
        n_eggs,
    )
    for k, v in _HEN_EGG.items():
        out[k] = round(v * n_eggs, 1)
    if "sodium" in macros and macros["sodium"] is not None:
        try:
            out["sodium"] = float(macros["sodium"])
        except (TypeError, ValueError):
            pass
    return out
