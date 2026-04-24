"""RAG retrieval: candidate ingredients from the DB + LLM re-ranking.

Prefers Layer 1's in-memory LookupTables (zero network I/O).
Falls back to direct DB queries only when lookup tables are unavailable.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Term extraction
# ---------------------------------------------------------------------------

_SPLIT_RE = re.compile(r",|\band\b|\bwith\b|\bon\b|\bserved\b|\btopped\b", re.IGNORECASE)


def extract_search_terms(free_text: str) -> List[str]:
    """Split free-text into individual ingredient-like search terms."""
    parts = _SPLIT_RE.split(free_text)
    terms: List[str] = []
    for p in parts:
        p = p.strip().strip(".")
        p = re.sub(r"\babout\s+\$[\d.]+\b", "", p, flags=re.IGNORECASE).strip()
        p = re.sub(r"\$[\d.]+", "", p).strip()
        p = re.sub(r"\bfrom\s+\S+", "", p, flags=re.IGNORECASE).strip()
        p = re.sub(r"\bI\s+had\b", "", p, flags=re.IGNORECASE).strip()
        p = re.sub(r"\bextra\b", "", p, flags=re.IGNORECASE).strip()
        p = re.sub(r"\s+", " ", p).strip()
        if p and len(p) > 1:
            terms.append(p)
    return terms


# ---------------------------------------------------------------------------
# In-memory candidate retrieval (uses Layer 1 LookupTables — no DB round-trip)
# ---------------------------------------------------------------------------

def _search_lookup(term: str, limit: int) -> List[Dict[str, Any]]:
    """Search Layer 1's in-memory LookupTables for a term. O(n) scan but
    the tables are small (hundreds of rows) and already in memory."""
    try:
        from layer1_app.services.lookup import get_lookup_tables
    except ImportError:
        from app.services.lookup import get_lookup_tables

    tables = get_lookup_tables()
    if tables is None:
        return []

    term_lower = term.lower()
    hits: List[Dict[str, Any]] = []

    try:
        from rapidfuzz import fuzz
        _use_rapidfuzz = True
    except ImportError:
        _use_rapidfuzz = False

    # Only include ingredients that have a nutrient profile; otherwise Layer 1 will skip them.
    for name, row in tables.all_names_with_ingredients:
        if row.id not in tables.nutrient_profiles:
            continue
        if _use_rapidfuzz:
            score = fuzz.partial_ratio(term_lower, name) / 100.0
        else:
            overlap = len(set(term_lower.split()) & set(name.split()))
            score = overlap / max(len(term_lower.split()), 1)
            if term_lower in name or name in term_lower:
                score = max(score, 0.7)
        if score > 0.4:
            hits.append({"name": row.name, "category": None, "score": score, "source": "lookup"})

    hits.sort(key=lambda h: h["score"], reverse=True)
    return hits[:limit]


# ---------------------------------------------------------------------------
# DB candidate retrieval (fallback when lookup tables aren't loaded)
# ---------------------------------------------------------------------------

_trgm_available: Optional[bool] = None


def _check_trgm(db: "Session") -> bool:
    """Return True if pg_trgm extension is usable."""
    global _trgm_available
    if _trgm_available is not None:
        return _trgm_available
    from sqlalchemy import text as sa_text
    try:
        db.execute(sa_text("SELECT similarity('test', 'test')"))
        _trgm_available = True
    except Exception:
        db.rollback()
        _trgm_available = False
        logger.info("pg_trgm not available; falling back to ILIKE search")
    return _trgm_available


def _search_trgm(db: "Session", term: str, limit: int) -> List[Dict[str, Any]]:
    from sqlalchemy import text as sa_text
    sql = sa_text("""
        (
            SELECT i.name AS match_name, i.category,
                   similarity(i.name, :term) AS score, 'ingredient' AS source
            FROM ingredients i
            WHERE similarity(i.name, :term) > 0.15
              AND EXISTS (SELECT 1 FROM usda_foods uf WHERE uf.ingredient_id = i.id)
            ORDER BY score DESC LIMIT :lim
        ) UNION ALL (
            SELECT i.name AS match_name, i.category,
                   similarity(s.synonym, :term) AS score, 'synonym' AS source
            FROM ingredient_synonyms s JOIN ingredients i ON i.id = s.ingredient_id
            WHERE similarity(s.synonym, :term) > 0.15
              AND EXISTS (SELECT 1 FROM usda_foods uf WHERE uf.ingredient_id = i.id)
            ORDER BY 3 DESC LIMIT :lim
        ) UNION ALL (
            SELECT i.name AS match_name, i.category,
                   similarity(f.description, :term) AS score, 'usda_food' AS source
            FROM usda_foods f JOIN ingredients i ON i.id = f.ingredient_id
            WHERE f.ingredient_id IS NOT NULL AND similarity(f.description, :term) > 0.15
            ORDER BY 3 DESC LIMIT :lim
        ) ORDER BY score DESC LIMIT :lim
    """)
    rows = db.execute(sql, {"term": term, "lim": limit}).fetchall()
    return [{"name": r[0], "category": r[1], "score": float(r[2]), "source": r[3]} for r in rows]


def _search_ilike(db: "Session", term: str, limit: int) -> List[Dict[str, Any]]:
    from sqlalchemy import text as sa_text
    pattern = f"%{term}%"
    sql = sa_text("""
        (
            SELECT i.name, i.category, 1.0 AS score, 'ingredient' AS source
            FROM ingredients i
            WHERE i.name ILIKE :pat
              AND EXISTS (SELECT 1 FROM usda_foods uf WHERE uf.ingredient_id = i.id)
            LIMIT :lim
        ) UNION ALL (
            SELECT i.name, i.category, 0.9, 'synonym'
            FROM ingredient_synonyms s JOIN ingredients i ON i.id = s.ingredient_id
            WHERE s.synonym ILIKE :pat
              AND EXISTS (SELECT 1 FROM usda_foods uf WHERE uf.ingredient_id = i.id)
            LIMIT :lim
        ) UNION ALL (
            SELECT i.name, i.category, 0.8, 'usda_food'
            FROM usda_foods f JOIN ingredients i ON i.id = f.ingredient_id
            WHERE f.ingredient_id IS NOT NULL AND f.description ILIKE :pat
            LIMIT :lim
        ) ORDER BY score DESC LIMIT :lim
    """)
    rows = db.execute(sql, {"pat": pattern, "lim": limit}).fetchall()
    return [{"name": r[0], "category": r[1], "score": float(r[2]), "source": r[3]} for r in rows]


# ---------------------------------------------------------------------------
# Unified retrieval: in-memory first, DB fallback
# ---------------------------------------------------------------------------

def retrieve_candidates(
    search_terms: List[str],
    per_term_limit: int = 10,
    total_limit: int = 30,
    db: Optional[Any] = None,
) -> List[Dict[str, Any]]:
    """Retrieve candidate ingredients for a list of search terms.

    Strategy:
      1. Try Layer 1's in-memory LookupTables (zero I/O, sub-ms).
      2. Fall back to DB queries only when lookup tables aren't loaded.

    Returns deduplicated results sorted by relevance score.
    """
    # Decide search function
    try:
        from layer1_app.services.lookup import get_lookup_tables
    except ImportError:
        try:
            from app.services.lookup import get_lookup_tables
        except ImportError:
            get_lookup_tables = lambda: None  # noqa: E731

    use_memory = get_lookup_tables() is not None

    if use_memory:
        search_fn = lambda term, limit: _search_lookup(term, limit)
    elif db is not None:
        use_trgm = _check_trgm(db)
        search_fn = (lambda term, limit: _search_trgm(db, term, limit)) if use_trgm \
            else (lambda term, limit: _search_ilike(db, term, limit))
    else:
        logger.warning("RAG: no lookup tables and no DB session; returning empty candidates")
        return []

    seen: set[str] = set()
    candidates: List[Dict[str, Any]] = []
    for term in search_terms:
        for h in search_fn(term, per_term_limit):
            key = h["name"].lower()
            if key not in seen:
                seen.add(key)
                h["matched_term"] = term
                candidates.append(h)

    candidates.sort(key=lambda c: c["score"], reverse=True)
    return candidates[:total_limit]


# ---------------------------------------------------------------------------
# LLM re-ranking prompt
# ---------------------------------------------------------------------------

RERANK_SYSTEM_PROMPT = """\
You are a nutrition-analysis assistant. Given a user's free-text food description \
and a list of candidate ingredients from our database, produce a structured JSON \
output. The downstream system can ONLY look up nutrition for ingredients that exist \
in our database—so you MUST use only the exact ingredient names from the candidate list.

Rules:
1. CRITICAL: The "description" field may ONLY contain ingredient names that appear \
   exactly in the candidate list. Copy the name verbatim from the list. Do not invent, \
   paraphrase, or use brand names. When the user mentions a vague or generic ingredient \
   (e.g. "some tomato", "a random type of cheese", "green stuff"), choose the best \
   matching candidate from the list—the DB-existing alternative that fits (e.g. \
   "Tomato, raw", "Cheddar cheese", "Lettuce"). Use the candidate list as the only \
   source of truth so Layer 1 can resolve every ingredient to a nutrition profile.
2. Format: comma-separated "Xg ingredient name". Every ingredient must have grams \
   (e.g. "120g Beef patty, 45g Hamburger bun, 20g Mayonnaise"). For multiple units \
   (e.g. "2 patties"), either give total grams (180g Beef patty) or quantity (2 Beef patty)—both work.
3. When the user does not specify quantity, estimate realistic restaurant-like portions in grams. \
   Use the restaurant name (if present) as a strong prior for default serving sizes (chains tend to be standardized; \
   sit-down restaurants tend to be larger than home portions; fine-dining tends to be smaller/denser). \
   Use price (if present) to scale portion size: low price implies snack/single serving; higher price implies full entrée or combo. \
   Typical anchors when uncertain: sauces 15–30g, greens 10–25g, cheese 20–40g, buns 40–60g, patties 80–120g, \
   cooked rice/pasta 150–250g per serving, fries/chips 90–150g, meat/chicken 120–220g cooked, pizza slice toppings proportional.
4. If a restaurant is provided, prefer plausible *complete* portions over minimal ones (avoid systematically underestimating). \
   Include likely cooking fats/oils/butter when implied by the dish (e.g. grilled/fried/sauteed) using realistic amounts (5–20g).
5. Extract restaurant and price if mentioned; extract modifiers (extra cheese, etc.).
6. "item_name": short canonical dish name.
7. "cooking_method": Infer the primary cooking method from the dish (e.g. "fried", "grilled", "baked", "boiled", "roasted", "broiled", "steamed"). Use null if unknown or if the dish has no single dominant method (e.g. mixed or raw). This is used to apply nutrient retention factors.
"""

RERANK_USER_TEMPLATE = """\
User text: {user_text}

Allowed ingredient names (you MUST use only these exact names in "description"):
{allowed_names}

Full candidate list with scores:
{candidates_block}

Produce a JSON object with these exact keys:
- "item_name": string
- "description": string (comma-separated "Xg ingredient name"; every ingredient name must be one of the allowed names above)
- "restaurant": string or null
- "price": number or null
- "modifiers": list of strings (may be empty)
- "cooking_method": string or null (e.g. "fried", "grilled", "baked", "boiled", "roasted", "broiled", "steamed"; null if unknown)
"""


def rerank_and_structure(
    user_text: str,
    candidates: List[Dict[str, Any]],
    restaurant_hint: Optional[str] = None,
    price_hint: Optional[float] = None,
) -> Dict[str, Any]:
    """Use the LLM to pick best ingredients and build a NutritionRequest dict."""
    from layers.layer0.llm_providers import get_provider

    # Deduplicated allowlist so Layer 1 can resolve every ingredient (DB has nutrition for these)
    allowed_names = sorted(set(c["name"] for c in candidates)) if candidates else []
    allowed_names_block = ", ".join(allowed_names) if allowed_names else "(no candidates—cannot guarantee Layer 1 match)"

    cand_lines = []
    for c in candidates:
        cat = f" [{c['category']}]" if c.get("category") else ""
        cand_lines.append(f"- {c['name']}{cat} (source: {c['source']}, score: {c['score']:.2f})")
    candidates_block = "\n".join(cand_lines) if cand_lines else "(no candidates found)"

    hint_parts = []
    if restaurant_hint:
        hint_parts.append(f"\nHint — restaurant: {restaurant_hint}")
    if price_hint is not None:
        hint_parts.append(f"\nHint — price: ${price_hint:.2f}")

    user_prompt = RERANK_USER_TEMPLATE.format(
        user_text=user_text + "".join(hint_parts),
        allowed_names=allowed_names_block,
        candidates_block=candidates_block,
    )

    provider = get_provider()
    result = provider.generate_structured(
        system_prompt=RERANK_SYSTEM_PROMPT,
        user_prompt=user_prompt,
    )

    if restaurant_hint and not result.get("restaurant"):
        result["restaurant"] = restaurant_hint
    if price_hint is not None and result.get("price") is None:
        result["price"] = price_hint
    if "modifiers" not in result:
        result["modifiers"] = []
    if "cooking_method" not in result:
        result["cooking_method"] = None

    return result
