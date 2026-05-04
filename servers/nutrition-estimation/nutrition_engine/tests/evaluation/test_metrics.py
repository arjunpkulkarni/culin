"""Unit tests for evaluation metrics (no engine / DB)."""

import math

import numpy as np
import pytest

from evaluation.metrics import compute_macro_stats


def test_compute_macro_stats_perfect():
    r = np.array([100.0, 200.0, 300.0])
    p = r.copy()
    s = compute_macro_stats(r, p)
    assert s.n == 3
    assert s.bias == pytest.approx(0.0)
    assert s.mae == pytest.approx(0.0)
    assert s.rmse == pytest.approx(0.0)
    assert s.mape_pct == pytest.approx(0.0)
    assert s.pearson_r == pytest.approx(1.0)


def test_compute_macro_stats_offset():
    r = np.array([10.0, 20.0])
    p = np.array([12.0, 18.0])
    s = compute_macro_stats(r, p)
    assert s.bias == pytest.approx(0.0)
    assert s.mae == pytest.approx(2.0)
    assert s.rmse == pytest.approx(2.0)


def test_empty_arrays():
    s = compute_macro_stats(np.array([]), np.array([]))
    assert s.n == 0
    assert math.isnan(s.mae)
