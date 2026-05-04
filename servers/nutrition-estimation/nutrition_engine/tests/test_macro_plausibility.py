from app.macro_plausibility import macro_plausibility_issues


def test_high_carb_zero_protein_eggs_flagged():
    issues = macro_plausibility_issues(
        {"calories": 165, "protein": 0, "carbs": 41, "fat": 0},
        "egg",
    )
    assert "egg_like_high_carb_low_protein" in issues


def test_plausible_eggs_clean():
    assert not macro_plausibility_issues(
        {"calories": 156, "protein": 12, "carbs": 2, "fat": 10},
        "two eggs",
    )


def test_stated_calories_not_explained_by_macros():
    issues = macro_plausibility_issues(
        {"calories": 400, "protein": 0, "carbs": 2, "fat": 1},
        "pasta dinner",
    )
    assert any("calories" in i or "macro_energy" in i for i in issues)


def test_protein_keyword_low_protein():
    issues = macro_plausibility_issues(
        {"calories": 300, "protein": 1, "carbs": 40, "fat": 10},
        "grilled chicken breast",
    )
    assert "protein_staple_text_but_almost_no_protein" in issues


def test_carb_kcal_dominated_minimal_protein_fat_flagged():
    """Atwater-consistent starch/sugar wall (e.g. bad parse) must not ship as a meal."""
    issues = macro_plausibility_issues(
        {"calories": 330, "protein": 0, "carbs": 81, "fat": 0},
        "two eggs",
    )
    assert "carb_kcal_dominated_minimal_protein_fat" in issues


def test_soda_shape_exempt_when_user_says_cola():
    assert not macro_plausibility_issues(
        {"calories": 140, "protein": 0, "carbs": 35, "fat": 0},
        "can of cola",
    )
