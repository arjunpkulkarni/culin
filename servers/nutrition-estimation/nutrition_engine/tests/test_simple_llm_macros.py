"""Guards on v1 simple-LLM macro parsing (implausible calories vs macros → pipeline fallback)."""

from app.macro_plausibility import macro_plausibility_issues
from app.simple_llm_macros import _macros_from_llm_raw


def test_macros_from_llm_nested_macros_object():
    raw = {
        "item_name": "Eggs",
        "macros": {"calories": 160, "protein": 12, "carbs": 2, "fat": 11},
        "rationale_brief": "two large eggs",
    }
    m = _macros_from_llm_raw(raw)
    assert m["calories"] == 160
    assert m["protein"] == 12
    assert m["carbs"] == 2
    assert m["fat"] == 11


def test_implausible_high_cal_zero_macros():
    issues = macro_plausibility_issues({"calories": 330, "protein": 0, "carbs": 0, "fat": 0}, "snack")
    assert issues


def test_two_eggs_hallucination_high_carb_zero_protein_rejected():
    """Gemini often passes Atwater by stuffing carbs; shared rules flag it."""
    issues = macro_plausibility_issues({"calories": 330, "protein": 0, "carbs": 81, "fat": 0}, "2 eggs")
    assert issues


def test_plausible_two_eggs_order_of_magnitude():
    assert not macro_plausibility_issues({"calories": 156, "protein": 12, "carbs": 2, "fat": 11}, "two eggs")
