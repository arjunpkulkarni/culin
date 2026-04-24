#!/usr/bin/env python3
"""Auto-link ingredients to USDA foods using fuzzy matching.

Matches unlinked ingredients to USDA foods, preferring sr_legacy_food and
foundation_food (high-quality generic entries) over branded.

Only links when the USDA food has actual nutrient data (food_nutrients rows).

Usage (from nutrition_engine/):
  python scripts/auto_link_ingredients.py              # dry-run (preview only)
  python scripts/auto_link_ingredients.py --commit     # write to DB
  python scripts/auto_link_ingredients.py --commit --export  # write + regenerate pickle
"""

import argparse
import os
import re
import sys
from pathlib import Path
from collections import defaultdict

_SCRIPT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_SCRIPT_DIR))
sys.path.insert(0, str(_SCRIPT_DIR / "layers" / "layer1"))

from dotenv import load_dotenv
load_dotenv(_SCRIPT_DIR / ".env")


STOP_WORDS = frozenset(
    "the a an and or with in of for to from by no 100".split()
)


def clean_name(name: str) -> str:
    """Simplify ingredient name for better fuzzy matching."""
    s = name.lower().strip()
    s = re.sub(r"^100%\s*", "", s)
    s = re.sub(
        r"\b(organic|natural|premium|original|classic|homestyle|traditional)\b",
        "", s, flags=re.IGNORECASE,
    )
    s = re.sub(r"\b(brand|style|recipe|flavor(?:ed)?|type)\b", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\([^)]*\)", "", s)
    s = re.sub(r"[,;:]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def combined_score(query: str, candidate: str) -> float:
    """Score that blends token_sort_ratio with a length-ratio penalty.

    token_set_ratio is too generous for short queries against long descriptions.
    We use token_sort_ratio as the base, then bonus-blend token_set_ratio only
    when the lengths are similar.
    """
    from rapidfuzz import fuzz

    sort_score = fuzz.token_sort_ratio(query, candidate)
    set_score = fuzz.token_set_ratio(query, candidate)

    q_len = max(len(query.split()), 1)
    c_len = max(len(candidate.split()), 1)
    length_ratio = min(q_len, c_len) / max(q_len, c_len)

    # Blend: when lengths similar, lean on set_score; when very different, lean on sort_score
    blended = sort_score * (1 - length_ratio * 0.5) + set_score * (length_ratio * 0.5)
    return blended


def main():
    parser = argparse.ArgumentParser(description="Auto-link ingredients to USDA foods")
    parser.add_argument("--commit", action="store_true", help="Write linkages to DB (default: dry-run)")
    parser.add_argument("--export", action="store_true", help="Regenerate lookup_tables.pkl after commit")
    parser.add_argument("--sr-threshold", type=float, default=62.0, help="Min score for SR/foundation (default 62)")
    parser.add_argument("--branded-threshold", type=float, default=80.0, help="Min score for branded (default 80)")
    args = parser.parse_args()

    from rapidfuzz import fuzz, process
    from sqlalchemy import text
    from layer1_app.db.session import SessionLocal

    db = SessionLocal()

    # 1. Snapshot existing links so we can re-run safely
    existing_links = db.execute(text(
        "SELECT fdc_id, ingredient_id FROM usda_foods WHERE ingredient_id IS NOT NULL"
    )).fetchall()
    original_link_map = {r[0]: r[1] for r in existing_links}  # fdc_id -> ingredient_id
    original_ingredients = set(original_link_map.values())

    # Clear all links, then restore originals (so auto-linker doesn't compete with them)
    db.execute(text("UPDATE usda_foods SET ingredient_id = NULL WHERE ingredient_id IS NOT NULL"))
    for fdc_id, ing_id in original_link_map.items():
        db.execute(
            text("UPDATE usda_foods SET ingredient_id = :iid WHERE fdc_id = :fdc"),
            {"iid": ing_id, "fdc": fdc_id},
        )
    db.commit()

    original_count = len(original_ingredients)
    print(f"Preserved {original_count} original links ({len(original_link_map)} USDA food rows)")

    # 2. Get unlinked ingredients
    unlinked = db.execute(text("""
        SELECT i.id, i.name, i.category
        FROM ingredients i
        WHERE NOT EXISTS (SELECT 1 FROM usda_foods uf WHERE uf.ingredient_id = i.id)
        ORDER BY i.name
    """)).fetchall()
    print(f"Unlinked ingredients: {len(unlinked)}")

    # 3. Load SR/foundation foods with nutrients — keep ALL entries (no dedup)
    print("Loading USDA foods with nutrient data...")
    sr_foods = db.execute(text("""
        SELECT uf.fdc_id, uf.description
        FROM usda_foods uf
        WHERE uf.data_type IN ('sr_legacy_food', 'foundation_food')
          AND uf.ingredient_id IS NULL
          AND EXISTS (SELECT 1 FROM food_nutrients fn WHERE fn.fdc_id = uf.fdc_id)
    """)).fetchall()
    print(f"  SR/Foundation foods available: {len(sr_foods)}")

    sr_list = [(r[0], r[1]) for r in sr_foods]  # (fdc_id, description)
    sr_clean = [clean_name(desc) for _, desc in sr_list]
    claimed_fdc: set[int] = set()

    # 4. Load branded foods indexed by keyword
    branded_foods = db.execute(text("""
        SELECT uf.fdc_id, uf.description
        FROM usda_foods uf
        WHERE uf.data_type = 'branded_food'
          AND uf.ingredient_id IS NULL
          AND EXISTS (SELECT 1 FROM food_nutrients fn WHERE fn.fdc_id = uf.fdc_id)
    """)).fetchall()
    print(f"  Branded foods available: {len(branded_foods)}")

    branded_by_keyword: dict[str, list[tuple[int, str]]] = defaultdict(list)
    for fdc_id, desc in branded_foods:
        words = desc.lower().split()
        for w in words[:4]:
            w_clean = re.sub(r"[,;:.()\[\]]", "", w)
            if w_clean and w_clean not in STOP_WORDS and len(w_clean) > 2:
                branded_by_keyword[w_clean].append((fdc_id, desc))
                break

    # 5. Match each unlinked ingredient
    linked = 0
    skipped = 0
    updates: list[tuple[int, int, str, float, str]] = []  # (ing_id, fdc_id, matched_desc, score, tier)

    print(f"\nMatching {len(unlinked)} ingredients...")
    for idx, (ing_id, ing_name, ing_cat) in enumerate(unlinked):
        if idx % 500 == 0 and idx > 0:
            print(f"  ... {idx}/{len(unlinked)} ({linked} linked so far)")

        name_clean = clean_name(ing_name)
        if len(name_clean) < 3:
            skipped += 1
            continue

        # --- Try SR/foundation foods ---
        # Get top 5 candidates from token_sort_ratio, then re-score with combined_score
        sr_candidates = process.extract(
            name_clean, sr_clean,
            scorer=fuzz.token_sort_ratio,
            limit=5,
            score_cutoff=50,
        )

        best_sr = None
        for cand_clean, raw_score, cand_idx in sr_candidates:
            fdc_id = sr_list[cand_idx][0]
            if fdc_id in claimed_fdc:
                continue
            score = combined_score(name_clean, cand_clean)
            if score >= args.sr_threshold and (best_sr is None or score > best_sr[0]):
                best_sr = (score, cand_idx, fdc_id)

        if best_sr:
            score, cand_idx, fdc_id = best_sr
            matched_desc = sr_list[cand_idx][1]
            updates.append((ing_id, fdc_id, matched_desc, score, "SR"))
            claimed_fdc.add(fdc_id)
            linked += 1
            continue

        # --- Fallback: branded foods (keyword-scoped) ---
        keywords = []
        for w in name_clean.split():
            w_clean = re.sub(r"[,;:.()\[\]]", "", w)
            if w_clean and w_clean not in STOP_WORDS and len(w_clean) > 2:
                keywords.append(w_clean)
                if len(keywords) >= 3:
                    break

        best_branded = None
        for kw in keywords:
            if kw not in branded_by_keyword:
                continue
            candidates = branded_by_keyword[kw]
            candidate_clean = [clean_name(desc) for _, desc in candidates]
            top = process.extract(
                name_clean, candidate_clean,
                scorer=fuzz.token_sort_ratio,
                limit=3,
                score_cutoff=60,
            )
            for _, raw_score, match_idx in top:
                fdc_id = candidates[match_idx][0]
                if fdc_id in claimed_fdc:
                    continue
                score = combined_score(name_clean, candidate_clean[match_idx])
                if score >= args.branded_threshold and (best_branded is None or score > best_branded[0]):
                    best_branded = (score, candidates[match_idx][0], candidates[match_idx][1])

        if best_branded:
            score, fdc_id, matched_desc = best_branded
            updates.append((ing_id, fdc_id, matched_desc, score, "branded"))
            claimed_fdc.add(fdc_id)
            linked += 1
            continue

        skipped += 1

    # 6. Report results
    print(f"\n{'='*60}")
    print(f"Results:")
    print(f"  Previously linked:  {original_count}")
    print(f"  Newly matched:      {linked}")
    print(f"    SR/Foundation:    {sum(1 for u in updates if u[4] == 'SR')}")
    print(f"    Branded:          {sum(1 for u in updates if u[4] == 'branded')}")
    print(f"  Could not match:    {skipped}")
    total = original_count + linked + skipped
    print(f"  New total coverage: {original_count + linked}/{total} ({(original_count + linked)/total*100:.1f}%)")

    if updates:
        scores = [s for _, _, _, s, _ in updates]
        print(f"\n  Score distribution:")
        for bucket_low in range(55, 101, 5):
            bucket_high = bucket_low + 5
            count = sum(1 for s in scores if bucket_low <= s < bucket_high)
            if count:
                bar = "#" * min(count // 2, 50)
                print(f"    {bucket_low:3d}-{bucket_high-1:3d}: {count:5d} {bar}")

    if updates:
        print(f"\n  Sample SR matches:")
        sr_matches = [u for u in updates if u[4] == "SR"][:25]
        for ing_id, fdc_id, matched_desc, score, tier in sr_matches:
            ing_name = next(n for iid, n, _ in unlinked if iid == ing_id)
            print(f"    [{score:5.1f}] {ing_name[:40]:40s} → {matched_desc[:55]}")

        print(f"\n  Sample branded matches:")
        br_matches = [u for u in updates if u[4] == "branded"][:15]
        for ing_id, fdc_id, matched_desc, score, tier in br_matches:
            ing_name = next(n for iid, n, _ in unlinked if iid == ing_id)
            print(f"    [{score:5.1f}] {ing_name[:40]:40s} → {matched_desc[:55]}")

    if skipped:
        failed_ids = {u[0] for u in updates}
        failed = [(ing_id, ing_name) for ing_id, ing_name, _ in unlinked
                  if ing_id not in failed_ids]
        print(f"\n  Sample unmatched (first 15):")
        for ing_id, ing_name in failed[:15]:
            print(f"    {ing_name}")

    # 7. Write to DB
    if args.commit and updates:
        print(f"\nWriting {len(updates)} new linkages to DB...")
        for ing_id, fdc_id, _, _, _ in updates:
            db.execute(
                text("UPDATE usda_foods SET ingredient_id = :iid WHERE fdc_id = :fdc"),
                {"iid": ing_id, "fdc": fdc_id},
            )
        db.commit()
        print("Done.")

        final_count = db.execute(
            text("SELECT COUNT(DISTINCT ingredient_id) FROM usda_foods WHERE ingredient_id IS NOT NULL")
        ).scalar()
        print(f"Final linked ingredients: {final_count}")

        if args.export:
            print("\nRegenerating lookup_tables.pkl...")
            from layer1_app.services.lookup import load_from_db, save_lookup_tables_to_pickle
            tables = load_from_db()
            save_lookup_tables_to_pickle(str(_SCRIPT_DIR / "artifacts"), tables=tables)
            print(f"New profile count: {len(tables.nutrient_profiles)}")
    elif not args.commit:
        print(f"\nDry run — pass --commit to write to DB")
    else:
        print("\nNo updates to write.")

    db.close()


if __name__ == "__main__":
    main()
