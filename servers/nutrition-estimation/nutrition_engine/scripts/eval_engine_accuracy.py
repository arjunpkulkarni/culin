#!/usr/bin/env python3
"""
Evaluate ``estimate_nutrition`` against bundled USDA reference (per 100 g).

Run from ``nutrition_engine/``:

  python scripts/eval_engine_accuracy.py
  python scripts/eval_engine_accuracy.py --n 50 --seed 42
  python scripts/eval_engine_accuracy.py --csv layers/layer3/usda_reference.csv --output-dir reports

Writes ``reports/engine_accuracy_<UTC timestamp>.md`` and a sidecar ``.json`` summary.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
_ENGINE_ROOT = _SCRIPT_DIR.parent
if str(_ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(_ENGINE_ROOT))
os.chdir(_ENGINE_ROOT)


def main() -> int:
    parser = argparse.ArgumentParser(description="Engine vs USDA reference accuracy report")
    parser.add_argument("--csv", type=Path, default=None, help="Override reference CSV path")
    parser.add_argument("--n", type=int, default=50, help="Random sample size (default 50)")
    parser.add_argument("--seed", type=int, default=None, help="RNG seed (default: random)")
    parser.add_argument(
        "--portion-g",
        type=float,
        default=100.0,
        help="Grams encoded in each request (default 100 = match reference)",
    )
    parser.add_argument("--output-dir", type=Path, default=None, help="Report directory")
    args = parser.parse_args()

    try:
        from dotenv import load_dotenv

        load_dotenv(_ENGINE_ROOT / ".env")
    except ImportError:
        pass

    from evaluation.runner import run_accuracy_evaluation

    md_path, summary = run_accuracy_evaluation(
        csv_path=args.csv,
        sample_size=args.n,
        seed=args.seed,
        portion_grams=args.portion_g,
        output_dir=args.output_dir,
    )
    print(summary["environment"])
    print("Wrote:", md_path)
    print("JSON:", summary["report_json"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
