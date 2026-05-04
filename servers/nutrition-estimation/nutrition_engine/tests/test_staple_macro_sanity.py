from app.staple_macro_sanity import correct_macros_for_staples


def test_egg_high_carb_zero_protein_overridden():
    out = correct_macros_for_staples("egg", "", {"calories": 165, "protein": 0, "carbs": 41, "fat": 0})
    assert out["protein"] > 5
    assert out["carbs"] < 5


def test_plausible_egg_macros_left_alone():
    base = {"calories": 156, "protein": 12, "carbs": 2, "fat": 10}
    out = correct_macros_for_staples("two eggs", "", base)
    assert out == base


def test_non_egg_not_touched():
    out = correct_macros_for_staples("rice bowl", "", {"calories": 400, "protein": 10, "carbs": 60, "fat": 12})
    assert out["carbs"] == 60
