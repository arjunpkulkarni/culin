"""Offline evaluation: engine predictions vs USDA reference (per 100 g)."""

from .metrics import MacroSeriesStats, compute_macro_stats
from .dataset_usda_reference import (
    load_usda_reference,
    profile_dataset,
    sample_rows,
    row_to_nutrition_request,
)
from .runner import run_accuracy_evaluation, layer1_ready_flag

__all__ = [
    "MacroSeriesStats",
    "compute_macro_stats",
    "load_usda_reference",
    "profile_dataset",
    "sample_rows",
    "row_to_nutrition_request",
    "run_accuracy_evaluation",
    "layer1_ready_flag",
]
