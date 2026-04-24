#!/usr/bin/env python3
"""
Production flow: input the same struct as the API (item_name, description, etc.),
run L1 → L2 → L3 automatically, print final estimates only.

Usage:
  python test_fake_macros_trace.py
  python test_fake_macros_trace.py '{"item_name": "Big Mac", "description": "Beef patties, bun, cheese", "restaurant": "McDonald\'s", "price": 5.99}'
"""

import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Default request (production input shape: what you send to POST /estimate)
DEFAULT_REQUEST = {
    "item_name": "Grilled Chicken Salad",
    "description": "Mixed greens with grilled chicken, tomatoes, cucumber",
    "restaurant": "Cafe Fresh",
    "price": 12.99,
    "modifiers": ["extra cheese"],
}


def main():
    from app.startup import startup
    from app.engine import estimate_nutrition

    if len(sys.argv) > 1:
        req = json.loads(sys.argv[1])
    else:
        req = dict(DEFAULT_REQUEST)

    # Ensure required keys
    req.setdefault("item_name", "")
    req.setdefault("description", "")
    req.setdefault("restaurant")
    req.setdefault("price")
    req.setdefault("modifiers")

    startup()
    result = estimate_nutrition(req)

    # Final estimates only (as in production)
    print(json.dumps({
        "macros": result["macros"],
        "confidence": result["confidence"],
        "debug": result.get("debug", {}),
    }, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
