#!/usr/bin/env python3
"""
Export Layer 1 lookup tables from DB to pickle artifact for zero-DB deployment.

Requires DATABASE_URL and SECRET_KEY in .env. Run from a machine that can reach RDS.

Usage (from nutrition_engine/):
  python scripts/export_layer1_lookup.py
  python scripts/export_layer1_lookup.py -o /path/to/artifacts

Output (default: nutrition_engine/artifacts/layer1/lookup_tables.pkl):
  - lookup_tables.pkl (ingredients, synonyms, unit conversions, nutrient profiles)
"""

import argparse
import os
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent.parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))
os.chdir(_SCRIPT_DIR)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def main():
    parser = argparse.ArgumentParser(description="Export Layer 1 lookup tables to pickle")
    parser.add_argument(
        "-o", "--output",
        default=str(_SCRIPT_DIR / "artifacts"),
        help="Artifacts root directory (default: nutrition_engine/artifacts)",
    )
    args = parser.parse_args()

    if not os.environ.get("DATABASE_URL") or not os.environ.get("SECRET_KEY"):
        print("ERROR: DATABASE_URL and SECRET_KEY must be set in .env", file=sys.stderr)
        return 1

    from layers.layer1.layer1_app.services.lookup import load_from_db, save_lookup_tables_to_pickle

    print("Loading lookup tables from DB...")
    tables = load_from_db()
    if not tables:
        print("ERROR: Failed to load from DB", file=sys.stderr)
        return 1

    print("Saving to pickle...")
    save_lookup_tables_to_pickle(args.output, tables=tables)
    print(f"Done. Saved to {Path(args.output) / 'layer1' / 'lookup_tables.pkl'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
