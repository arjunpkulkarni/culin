#!/usr/bin/env python3
"""
Run the full layer flow (L1 → L2 → L3) locally with your own data.

Prerequisites (from nutrition_engine/):
  1. pip install -r requirements.txt -r requirements-layer1.txt
  2. python -m spacy download en_core_web_sm
  3. .env with DATABASE_URL and SECRET_KEY (for real Layer 1; otherwise stub is used)

Usage (run from nutrition_engine/):
  python run_local_test.py
  python run_local_test.py "Chicken burrito" "Grilled chicken, rice, beans, cheese"
  python run_local_test.py --json '{"item_name": "Big Mac", "description": "Beef patties, bun", "restaurant": "McDonald'\''s", "price": 5.99}'
"""

import json
import os
import sys

# Run from nutrition_engine so app and layers are importable
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if _SCRIPT_DIR not in sys.path:
    sys.path.insert(0, _SCRIPT_DIR)
os.chdir(_SCRIPT_DIR)

# Optional: load .env so DATABASE_URL / SECRET_KEY are set before Layer 1 loads
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def main():
    # Layer 1 (spacy) does not support Python 3.14+; you'll get "REGEX" / stub fallback
    if sys.version_info >= (3, 14):
        print(
            "WARNING: Python 3.14+ is not supported by Layer 1 (spacy). You will see stub macros.\n"
            "Use Python 3.11 or 3.12: run 'deactivate', then:\n"
            "  rm -rf .venv && python3.12 -m venv .venv && source .venv/bin/activate\n"
            "  pip install -r requirements.txt -r requirements-layer1.txt\n"
            "  python -m spacy download en_core_web_sm\n",
            file=sys.stderr,
        )
    from app.startup import startup
    from app.engine import estimate_nutrition
    from layers import layer1

    # Parse input
    if "--json" in sys.argv:
        idx = sys.argv.index("--json")
        if idx + 1 >= len(sys.argv):
            print("Usage: python run_local_test.py --json '<json>'", file=sys.stderr)
            return 1
        req = json.loads(sys.argv[idx + 1])
    elif len(sys.argv) >= 3:
        req = {
            "item_name": sys.argv[1],
            "description": sys.argv[2],
            "restaurant": sys.argv[3] if len(sys.argv) > 3 else None,
            "price": float(sys.argv[4]) if len(sys.argv) > 4 else None,
            "modifiers": None,
        }
    else:
        req = {
            "item_name": "Grilled Chicken Salad",
            "description": "Mixed greens, grilled chicken, tomatoes, cucumber",
            "restaurant": "Cafe Fresh",
            "price": 12.99,
            "modifiers": ["extra cheese"],
        }
        print("Using default request. Pass item_name and description as args, or --json '<json>'.\n")

    req.setdefault("item_name", "")
    req.setdefault("description", "")
    req.setdefault("restaurant")
    req.setdefault("price")
    req.setdefault("modifiers")

    print("=" * 60)
    print("Local layer flow test")
    print("=" * 60)
    print("Input:", json.dumps(req, indent=2))
    print()

    # Layer 1 uses DB if DATABASE_URL + SECRET_KEY are set
    using_real_l1 = bool(os.environ.get("DATABASE_URL") and os.environ.get("SECRET_KEY"))
    print("Layer 1:", "real (DB)" if using_real_l1 else "stub (no DATABASE_URL/SECRET_KEY)")
    print()

    print("Starting up (load L2/L3 artifacts)...")
    startup()
    print("Startup OK.\n")

    # Run full pipeline
    result = estimate_nutrition(req)

    print("-" * 60)
    print("Result (same as POST /estimate)")
    print("-" * 60)
    print(json.dumps({
        "macros": result["macros"],
        "confidence": result["confidence"],
        "debug": result.get("debug", {}),
    }, indent=2))
    print()
    print("Layer flow completed successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
