"""Standard error metrics for predicted vs reference macro series."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np


@dataclass
class MacroSeriesStats:
    n: int
    mean_reference: float
    mean_predicted: float
    bias: float
    mae: float
    rmse: float
    median_ae: float
    mape_pct: float
    smape_pct: float
    pearson_r: Optional[float]
    stdev_reference: float
    stdev_predicted: float
    stdev_error: float


def _pearson_r(a: np.ndarray, b: np.ndarray) -> Optional[float]:
    if len(a) < 2:
        return None
    if np.std(a) < 1e-12 or np.std(b) < 1e-12:
        return None
    m = np.corrcoef(a, b)
    r = float(m[0, 1])
    if np.isnan(r):
        return None
    return r


def compute_macro_stats(
    reference: np.ndarray,
    predicted: np.ndarray,
    *,
    eps: float = 1e-6,
    mape_floor: float = 1.0,
) -> MacroSeriesStats:
    """
    reference, predicted: same shape, finite values only (NaNs should be filtered by caller).

    MAPE uses denominator max(|reference|, mape_floor) to limit blow-ups near zero.
    sMAPE: 200 * |p-r| / (|p|+|r| + eps) in [0, 200].
    """
    r = np.asarray(reference, dtype=float).ravel()
    p = np.asarray(predicted, dtype=float).ravel()
    if r.shape != p.shape:
        raise ValueError("reference and predicted must have the same shape")
    n = int(r.size)
    if n == 0:
        return MacroSeriesStats(
            n=0,
            mean_reference=float("nan"),
            mean_predicted=float("nan"),
            bias=float("nan"),
            mae=float("nan"),
            rmse=float("nan"),
            median_ae=float("nan"),
            mape_pct=float("nan"),
            smape_pct=float("nan"),
            pearson_r=None,
            stdev_reference=float("nan"),
            stdev_predicted=float("nan"),
            stdev_error=float("nan"),
        )

    err = p - r
    abs_err = np.abs(err)
    denom = np.maximum(np.abs(r), mape_floor)
    mape = float(np.mean(abs_err / denom) * 100.0)
    smape = float(np.mean(200.0 * abs_err / (np.abs(p) + np.abs(r) + eps)))

    return MacroSeriesStats(
        n=n,
        mean_reference=float(np.mean(r)),
        mean_predicted=float(np.mean(p)),
        bias=float(np.mean(err)),
        mae=float(np.mean(abs_err)),
        rmse=float(np.sqrt(np.mean(err**2))),
        median_ae=float(np.median(abs_err)),
        mape_pct=mape,
        smape_pct=smape,
        pearson_r=_pearson_r(r, p),
        stdev_reference=float(np.std(r, ddof=1)) if n > 1 else 0.0,
        stdev_predicted=float(np.std(p, ddof=1)) if n > 1 else 0.0,
        stdev_error=float(np.std(err, ddof=1)) if n > 1 else 0.0,
    )
