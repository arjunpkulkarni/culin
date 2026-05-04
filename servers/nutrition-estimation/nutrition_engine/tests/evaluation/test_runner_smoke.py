"""Optional full-pipeline eval (slow). Set RUN_EVAL_SMOKE=1 to run n=3 samples."""

import os
from pathlib import Path

import pytest

pytestmark = pytest.mark.slow


@pytest.mark.skipif(
    not os.environ.get("RUN_EVAL_SMOKE"),
    reason="Set RUN_EVAL_SMOKE=1 to run 3-sample engine accuracy smoke test",
)
def test_run_accuracy_evaluation_smoke():
    from evaluation.runner import run_accuracy_evaluation

    root = Path(__file__).resolve().parents[2]
    md_path, summary = run_accuracy_evaluation(
        csv_path=root / "layers" / "layer3" / "usda_reference.csv",
        sample_size=3,
        seed=7,
        output_dir=root / "reports",
    )
    assert md_path.is_file()
    assert summary["environment"]["ok_count"] == 3
    assert "calories" in summary["stats_by_macro"]
