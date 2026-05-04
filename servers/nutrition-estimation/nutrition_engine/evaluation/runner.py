"""Run N random USDA-reference rows through ``estimate_nutrition`` and aggregate metrics."""

from __future__ import annotations

import json
import os
import random
import sys
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from .dataset_usda_reference import (
    DEFAULT_CSV_RELATIVE,
    default_csv_path,
    load_usda_reference,
    profile_dataset,
    row_to_expected_macros,
    row_to_nutrition_request,
    sample_rows,
)
from .metrics import MacroSeriesStats, compute_macro_stats
from .report_md import render_report, write_report


def _engine_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _ensure_engine_path() -> Path:
    root = _engine_root()
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    return root


def layer1_ready_flag() -> bool:
    _ensure_engine_path()
    from layers import layer1

    return layer1._is_layer1_ready()


def run_accuracy_evaluation(
    *,
    csv_path: Optional[Path] = None,
    sample_size: int = 50,
    seed: Optional[int] = None,
    portion_grams: float = 100.0,
    output_dir: Optional[Path] = None,
) -> Tuple[Path, Dict[str, Any]]:
    """
    Load startup artifacts, sample ``sample_size`` random ingredients, call the engine.

    Returns (markdown_report_path, summary_dict).
    """
    root = _ensure_engine_path()
    os.chdir(root)

    try:
        from dotenv import load_dotenv

        load_dotenv(root / ".env")
    except ImportError:
        pass

    csv = csv_path or default_csv_path(root)
    df = load_usda_reference(csv)
    full_profile = profile_dataset(df)

    rng_seed = seed if seed is not None else random.randint(0, 2**31 - 1)
    rng = random.Random(rng_seed)
    sample_df = sample_rows(df, sample_size, rng)

    from app.startup import startup
    from app.engine import estimate_nutrition

    startup()

    per_row: List[Dict[str, Any]] = []
    for _, row in sample_df.iterrows():
        name = str(row["ingredient_name"])
        expected = row_to_expected_macros(row)
        rec: Dict[str, Any] = {"ingredient_name": name, "status": "ok"}
        for k, v in expected.items():
            rec[f"ref_{k}"] = v

        try:
            req = row_to_nutrition_request(row, portion_grams=portion_grams)
            resp = estimate_nutrition(req)
            macros = resp.get("macros") or {}
            rec["pred_calories"] = float(macros.get("calories", 0) or 0)
            rec["pred_protein"] = float(macros.get("protein", 0) or 0)
            rec["pred_carbs"] = float(macros.get("carbs", 0) or 0)
            rec["pred_fat"] = float(macros.get("fat", 0) or 0)
            rec["pred_sodium"] = float(macros.get("sodium", 0) or 0)
            rec["confidence"] = float(resp.get("confidence", 0) or 0)
        except Exception as exc:  # noqa: BLE001 — record and continue
            rec["status"] = "error"
            rec["error"] = str(exc)
            for k in ("calories", "protein", "carbs", "fat", "sodium"):
                rec[f"pred_{k}"] = float("nan")

        per_row.append(rec)

    ok_rows = [r for r in per_row if r["status"] == "ok"]
    keys = ("calories", "protein", "carbs", "fat", "sodium")
    stats_by_macro: Dict[str, MacroSeriesStats] = {}
    for k in keys:
        ref_key = f"ref_{k}"
        pred_key = f"pred_{k}"
        ref_list: List[float] = []
        pred_list: List[float] = []
        for r in ok_rows:
            ref_list.append(float(r[ref_key]))
            pred_list.append(float(r[pred_key]))
        stats_by_macro[k] = compute_macro_stats(np.array(ref_list), np.array(pred_list))

    environment = {
        "sample_count": len(per_row),
        "ok_count": len(ok_rows),
        "seed": rng_seed,
        "csv_path": str(csv),
        "portion_grams": portion_grams,
        "layer1_ready": layer1_ready_flag(),
        "python": sys.version.split()[0],
        "cwd": str(root),
    }

    methodology = f"""
Each trial uses the **USDA reference row** as ground truth (macros **per 100 g** edible portion from
`{DEFAULT_CSV_RELATIVE}` bundled with Layer 3).

The engine receives a structured request equivalent to **{int(round(portion_grams))} g** of that
ingredient name so Layer 1 mass scaling aligns with the reference.

**Macros compared:** calories, protein, carbs, fat, sodium (when returned).

**Note:** If Layer 1 is not ready (no lookup pickle and no `DATABASE_URL` + `SECRET_KEY`), estimates
are often **stub zeros** — the report still runs so you can see infrastructure health.

**Reference quality:** Rows use long USDA-style descriptions (often 50–120 characters). The Layer 1
lexicon matches **short pantry names** better than full FDC strings, so errors can be large on
random rare rows even when the pipeline is healthy. Prefer **stratified sampling** (by category
or name length) for tighter benchmarks — future work.

**Other repo CSV:** `layers/layer2/data/processed/restaurant_nutrition_dataset.csv` is **not** used
here; the on-disk copy appears **malformed / PDF-extraction garbage** at the header and is unsuitable
as a numeric ground-truth set without re-building from source.
""".strip()

    out_dir = output_dir or (root / "reports")
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    md_path = out_dir / f"engine_accuracy_{stamp}.md"
    json_path = out_dir / f"engine_accuracy_{stamp}.json"

    md_body = render_report(
        title="Nutrition engine accuracy (USDA reference)",
        methodology=methodology,
        environment=environment,
        dataset_profile=full_profile,
        stats_by_macro=stats_by_macro,
        per_row=per_row,
        sample_detail_rows=15,
    )
    write_report(md_body, md_path)

    summary: Dict[str, Any] = {
        "report_markdown": str(md_path),
        "report_json": str(json_path),
        "environment": environment,
        "stats_by_macro": {k: asdict(v) for k, v in stats_by_macro.items()},
        "dataset_profile_row_count": full_profile.get("row_count"),
    }
    json_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    return md_path, summary
