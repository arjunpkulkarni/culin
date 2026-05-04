"""NLP-based ingredient parser."""

import re
from fractions import Fraction
from typing import TYPE_CHECKING, Optional, Tuple, List, Dict, Any, Union

from layer1_app.core.logging import logger
from layer1_app.schemas.recipe import ParsedIngredient

if TYPE_CHECKING:
    from sqlalchemy.orm import Session
    from layer1_app.services.lookup import LookupTables, IngredientRow

try:
    import spacy
    nlp = spacy.load("en_core_web_sm")
except (ImportError, OSError):
    nlp = None

try:
    from rapidfuzz import process as rf_process
    _RAPIDFUZZ_AVAILABLE = True
except ImportError:
    from Levenshtein import distance as levenshtein_distance
    _RAPIDFUZZ_AVAILABLE = False


class IngredientParser:
    
    VOLUME_UNITS = {
        "cup": 237.0,
        "cups": 237.0,
        "c": 237.0,
        "tablespoon": 15.0,
        "tablespoons": 15.0,
        "tbsp": 15.0,
        "tbs": 15.0,
        "teaspoon": 5.0,
        "teaspoons": 5.0,
        "tsp": 5.0,
        "fluid ounce": 30.0,
        "fluid ounces": 30.0,
        "fl oz": 30.0,
        "fl. oz": 30.0,
        "pint": 473.0,
        "pints": 473.0,
        "quart": 946.0,
        "quarts": 946.0,
        "gallon": 3785.0,
        "gallons": 3785.0,
        "liter": 1000.0,
        "liters": 1000.0,
        "l": 1000.0,
        "milliliter": 1.0,
        "milliliters": 1.0,
        "ml": 1.0,
    }
    
    WEIGHT_UNITS = {
        "gram": 1.0,
        "grams": 1.0,
        "g": 1.0,
        "kilogram": 1000.0,
        "kilograms": 1000.0,
        "kg": 1000.0,
        "ounce": 28.35,
        "ounces": 28.35,
        "oz": 28.35,
        "pound": 453.59,
        "pounds": 453.59,
        "lb": 453.59,
        "lbs": 453.59,
        "milligram": 0.001,
        "milligrams": 0.001,
        "mg": 0.001,
    }
    
    # Piece/count units
    COUNT_UNITS = {
        "piece": "piece",
        "pieces": "piece",
        "whole": "piece",
        "item": "piece",
        "items": "piece",
        "clove": "clove",
        "cloves": "clove",
        "slice": "slice",
        "slices": "slice",
        "large": "large",
        "medium": "medium",
        "small": "small",
    }
    
    WORD_TO_NUMBER = {
        "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
        "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
        "a": 1, "an": 1, "half": 0.5, "quarter": 0.25, "third": 0.333,
    }
    
    def __init__(
        self,
        db: Optional["Session"] = None,
        lookup_tables: Optional["LookupTables"] = None,
    ):
        """Initialize parser. Uses lookup_tables when provided (no DB); else uses db Session."""
        self.db = db
        self._lookup = lookup_tables
        self._ingredient_cache: Optional[Dict] = None
    
    def parse(self, ingredient_text: str) -> ParsedIngredient:        
        warnings = []
        
        # Extract quantity
        quantity, text_after_quantity = self._extract_quantity(ingredient_text)
        if quantity is None:
            quantity = 1.0
            warnings.append("No quantity found, assuming 1")
            text_after_quantity = ingredient_text
        
        # Extract unit
        unit, ingredient_name = self._extract_unit(text_after_quantity)
        if not unit:
            unit = "piece"
            warnings.append("No unit found, assuming piece")
        
        # Clean ingredient name
        ingredient_name = self._clean_ingredient_name(ingredient_name)
        ingredient_name = self._normalize_plural_ingredient_name(ingredient_name)

        # Match to canonical ingredient
        matched_ingredient, confidence = self._match_ingredient(ingredient_name)
        
        if confidence < 0.7:
            warnings.append(f"Low confidence match ({confidence:.2f})")
        
        # Convert to grams
        mass_g = self._convert_to_grams(
            quantity, unit, ingredient_name, matched_ingredient
        )
        
        if mass_g == 0:
            warnings.append("Could not determine mass, using 0g")
        
        return ParsedIngredient(
            original_text=ingredient_text,
            quantity=quantity,
            unit=unit,
            ingredient_name=matched_ingredient.name if matched_ingredient else ingredient_name,
            ingredient_id=matched_ingredient.id if matched_ingredient else None,
            mass_g=mass_g,
            confidence=confidence,
            warnings=warnings
        )
    
    def _extract_quantity(self, text: str) -> Tuple[Optional[float], str]:
        """Extract quantity from ingredient text."""
        text = text.strip()
        
        
        unit_pattern = r"(?:g|kg|mg|ml|l|oz|lb|lbs|tbsp|tsp|cup|cups)\b"
        match = re.match(rf"^(\d+\.?\d*)({unit_pattern})(.*)$", text, re.IGNORECASE)
        if match:
            quantity = float(match.group(1))
            unit = match.group(2)
            remainder = match.group(3).strip()
            return quantity, f"{unit} {remainder}" if remainder else unit
        
        match = re.match(r"^(\d+\.?\d*)\s+(.+)$", text)
        if match:
            return float(match.group(1)), match.group(2)
        
        match = re.match(r"^(\d+)/(\d+)\s+(.+)$", text)
        if match:
            fraction = Fraction(int(match.group(1)), int(match.group(2)))
            return float(fraction), match.group(3)
        
        match = re.match(r"^(\d+)\s+(\d+)/(\d+)\s+(.+)$", text)
        if match:
            whole = int(match.group(1))
            fraction = Fraction(int(match.group(2)), int(match.group(3)))
            return float(whole + fraction), match.group(4)
        for word, num in self.WORD_TO_NUMBER.items():
            pattern = rf"^{word}\s+(.+)$"
            match = re.match(pattern, text, re.IGNORECASE)
            if match:
                return num, match.group(1)
        
        if text.lower().startswith(("a pinch", "pinch")):
            return 0.5, re.sub(r"^(a\s+)?pinch\s+of\s+", "", text, flags=re.IGNORECASE)
        
        return None, text
    
    def _extract_unit(self, text: str) -> Tuple[Optional[str], str]:
        """Extract unit from ingredient text."""
        text = text.strip().lower()
        
        for unit_name, factor in self.WEIGHT_UNITS.items():
            pattern = rf"^{re.escape(unit_name)}\b\s*(.+)$"
            match = re.match(pattern, text, re.IGNORECASE)
            if match:
                return unit_name, match.group(1)
        
        for unit_name, ml in self.VOLUME_UNITS.items():
            pattern = rf"^{re.escape(unit_name)}\b\s*(.+)$"
            match = re.match(pattern, text, re.IGNORECASE)
            if match:
                return unit_name, match.group(1)
        
        for unit_name, canonical in self.COUNT_UNITS.items():
            pattern = rf"^{re.escape(unit_name)}\b\s*(.+)$"
            match = re.match(pattern, text, re.IGNORECASE)
            if match:
                return canonical, match.group(1)
        
        return None, text
    
    def _normalize_plural_ingredient_name(self, name: str) -> str:
        """Map common plural surface forms to singular so lookup/synonyms hit (e.g. eggs → egg)."""
        n = (name or "").strip().lower()
        if not n:
            return name
        # (plural_or_variant, singular) — whole-word replacement, longer tokens first
        pairs = (
            ("egg whites", "egg white"),
            ("egg yolks", "egg yolk"),
            ("eggs", "egg"),
            ("tomatoes", "tomato"),
            ("potatoes", "potato"),
            ("onions", "onion"),
            ("carrots", "carrot"),
            ("apples", "apple"),
            ("bananas", "banana"),
            ("oranges", "orange"),
            ("limes", "lime"),
            ("lemons", "lemon"),
            ("cloves", "clove"),
            ("mushrooms", "mushroom"),
            ("strawberries", "strawberry"),
            ("blueberries", "blueberry"),
            ("avocados", "avocado"),
            ("yoghurts", "yogurt"),
            ("yoghurt", "yogurt"),
        )
        for plural, singular in pairs:
            n = re.sub(rf"\b{re.escape(plural)}\b", singular, n)
        return n.strip()

    def _clean_ingredient_name(self, name: str) -> str:
        """Clean and normalize ingredient name."""
        name = name.strip()
        
        # Remove common descriptors
        descriptors = [
            r"\bfresh\b", r"\bdried\b", r"\bfrozen\b", r"\bcanned\b",
            r"\braw\b", r"\bcooked\b", r"\bchopped\b", r"\bdiced\b",
            r"\bsliced\b", r"\bminced\b", r"\bground\b", r"\bshredded\b",
            r"\bpeeled\b", r"\bseeded\b", r"\bwashed\b", r"\btrimmed\b",
        ]
        
        for descriptor in descriptors:
            name = re.sub(descriptor, "", name, flags=re.IGNORECASE)
        
        # Remove parenthetical notes
        name = re.sub(r"\([^)]*\)", "", name)
        
        # Clean whitespace
        name = re.sub(r"\s+", " ", name).strip()
        
        return name
    
    def _match_ingredient(
        self, ingredient_name: str
    ) -> Tuple[Optional[Union["IngredientRow", Any]], float]:
        """Match ingredient name using lookup tables (in-memory) or DB."""
        if not ingredient_name:
            return None, 0.0

        ingredient_name_lower = ingredient_name.lower()

        # In-memory lookup path
        if self._lookup:
            return self._match_ingredient_lookup(ingredient_name_lower)

        # DB path (legacy)
        if self._ingredient_cache is None:
            self._build_ingredient_cache()
        if ingredient_name_lower in self._ingredient_cache:
            return self._ingredient_cache[ingredient_name_lower], 1.0
        from layer1_app.db.models import Ingredient, IngredientSynonym
        synonyms = self.db.query(IngredientSynonym).filter(
            IngredientSynonym.synonym == ingredient_name_lower
        ).all()
        if synonyms:
            best_synonym = max(synonyms, key=lambda s: s.confidence)
            return best_synonym.ingredient, best_synonym.confidence
        ingredients = self.db.query(Ingredient).all()
        best_match = None
        best_score = 0.0
        for ingredient in ingredients:
            dist = levenshtein_distance(ingredient_name_lower, ingredient.name.lower())
            max_len = max(len(ingredient_name_lower), len(ingredient.name))
            similarity = 1.0 - (dist / max_len) if max_len > 0 else 0.0
            if similarity > best_score:
                best_score = similarity
                best_match = ingredient
            for synonym in ingredient.synonyms:
                s_lower = synonym.synonym.lower()
                dist = levenshtein_distance(ingredient_name_lower, s_lower)
                max_len = max(len(ingredient_name_lower), len(s_lower))
                similarity = (1.0 - (dist / max_len) if max_len > 0 else 0.0) * synonym.confidence
                if similarity > best_score:
                    best_score = similarity
                    best_match = ingredient
        return best_match, best_score

    def _match_ingredient_lookup(
        self, ingredient_name_lower: str
    ) -> Tuple[Optional["IngredientRow"], float]:
        """Match using in-memory lookup tables. Uses RapidFuzz when available."""
        tbl = self._lookup
        if not tbl:
            return None, 0.0
        if ingredient_name_lower in tbl.name_to_ingredient:
            return tbl.name_to_ingredient[ingredient_name_lower], 1.0
        if ingredient_name_lower in tbl.synonym_to_ingredient:
            row, conf = tbl.synonym_to_ingredient[ingredient_name_lower]
            return row, conf
        # Plain-language staples (egg, yogurt, milk) often miss long USDA keys; bridge before fuzzy.
        bridged = self._staple_lookup_bridge(ingredient_name_lower, tbl)
        if bridged is not None:
            return bridged
        # Fuzzy over all names
        if not tbl.all_names_with_ingredients:
            return None, 0.0
        choices = [name for name, _ in tbl.all_names_with_ingredients]
        if _RAPIDFUZZ_AVAILABLE:
            result = rf_process.extractOne(ingredient_name_lower, choices)
            if result:
                name, score, _ = result
                for n, row in tbl.all_names_with_ingredients:
                    if n == name:
                        return row, score / 100.0
        else:
            best_match = None
            best_score = 0.0
            for name, row in tbl.all_names_with_ingredients:
                dist = levenshtein_distance(ingredient_name_lower, name)
                max_len = max(len(ingredient_name_lower), len(name))
                similarity = 1.0 - (dist / max_len) if max_len > 0 else 0.0
                if similarity > best_score:
                    best_score = similarity
                    best_match = row
            return best_match, best_score
        return None, 0.0

    def _staple_lookup_bridge(
        self, n: str, tbl: "LookupTables"
    ) -> Optional[Tuple["IngredientRow", float]]:
        """Map short user phrases to a profiled ingredient row when fuzzy match would miss or mispick."""
        if not getattr(tbl, "name_to_ingredient", None) or not getattr(tbl, "nutrient_profiles", None):
            return None

        def _pick(
            key_ok,
            sort_key,
        ) -> Optional[Tuple["IngredientRow", float]]:
            best: Optional[Tuple[Tuple, "IngredientRow"]] = None
            for key, row in tbl.name_to_ingredient.items():
                if not key_ok(key):
                    continue
                if row.id not in tbl.nutrient_profiles:
                    continue
                sk = sort_key(key)
                if best is None or sk < best[0]:
                    best = (sk, row)
            if best is None:
                return None
            return best[1], 0.88

        # --- egg (exclude eggplant, noodles, replacers) ---
        if "egg" in n and "eggplant" not in n and "egg roll" not in n and "egg foo" not in n:

            def egg_ok(k: str) -> bool:
                if "egg" not in k:
                    return False
                bad = (
                    "eggplant",
                    "egg roll",
                    "egg foo",
                    "noodle",
                    "substitute",
                    "replacer",
                    "white cake",
                    "yellow cake",
                )
                return not any(b in k for b in bad)

            def egg_sort(k: str) -> Tuple[int, int]:
                # Prefer FDC-style "egg, ..." / "eggs, ..." then shorter keys.
                pri = 0 if (k.startswith("egg,") or k.startswith("eggs,")) else 1
                return (pri, len(k))

            hit = _pick(egg_ok, egg_sort)
            if hit:
                return hit

        # --- yogurt ---
        if "yogurt" in n or "yoghurt" in n:
            frozen_q = "frozen" in n

            def yogurt_ok(k: str) -> bool:
                if "yogurt" not in k and "yoghurt" not in k:
                    return False
                if not frozen_q and "frozen" in k:
                    return False
                bad = ("yogurt covered", "yogurt coating", "dressing", "dip mix", "sauce")
                return not any(b in k for b in bad)

            def yogurt_sort(k: str) -> Tuple[int, int]:
                greek_q = "greek" in n
                pri = 0
                if greek_q:
                    pri = 0 if "greek" in k else 1
                else:
                    if "greek" in k:
                        pri = 1
                    elif "plain" in k or k.startswith("yogurt,") or k.startswith("yoghurt,"):
                        pri = 0
                    else:
                        pri = 2
                return (pri, len(k))

            hit = _pick(yogurt_ok, yogurt_sort)
            if hit:
                return hit

        # --- cow's milk (narrow triggers to avoid plant milks) ---
        if n in ("milk", "whole milk", "skim milk", "2% milk", "2 percent milk", "lowfat milk", "low fat milk", "fat free milk", "1% milk", "vitamin d milk"):
            plant = ("almond", "coconut", "soy", "oat", "rice", "hemp", "cashew")

            def milk_ok(k: str) -> bool:
                if "milk" not in k:
                    return False
                if any(p in k for p in plant):
                    return False
                bad = ("milkshake", "milk chocolate", "condensed", "evaporated", "dry milk", "formula", "infant")
                return not any(b in k for b in bad)

            def milk_sort(k: str) -> Tuple[int, int]:
                pri = 0 if ("fluid" in k or "vitamin" in k or k.startswith("milk,")) else 1
                return (pri, len(k))

            hit = _pick(milk_ok, milk_sort)
            if hit:
                return hit

        return None

    def _build_ingredient_cache(self) -> None:
        """Build cache of ingredients by name (DB path only)."""
        from layer1_app.db.models import Ingredient
        self._ingredient_cache = {}
        ingredients = self.db.query(Ingredient).all()
        for ingredient in ingredients:
            self._ingredient_cache[ingredient.name.lower()] = ingredient
    
    def _convert_to_grams(
        self,
        quantity: float,
        unit: str,
        ingredient_name: str,
        matched_ingredient: Optional[Any],
    ) -> float:
        """Convert quantity and unit to grams. Uses lookup tables when available.
        quantity is always multiplied (e.g. '2 beef patties' -> 2 * per_piece_g = total grams)."""
        # If already in weight units, convert directly
        if unit in self.WEIGHT_UNITS:
            return quantity * self.WEIGHT_UNITS[unit]

        # Helper to get conversion from lookup or DB
        def get_conversion(ing_id: int, u: str) -> Optional[float]:
            if self._lookup:
                return self._lookup.unit_conversions.get((ing_id, u.lower()))
            from layer1_app.db.models import UnitConversion
            c = self.db.query(UnitConversion).filter(
                UnitConversion.ingredient_id == ing_id,
                UnitConversion.unit == u
            ).first()
            return c.grams if c else None

        def get_density(ing: Any) -> Optional[float]:
            return getattr(ing, "density_g_per_ml", None)

        # If volume unit, need density
        if unit in self.VOLUME_UNITS:
            ml = quantity * self.VOLUME_UNITS[unit]
            if matched_ingredient and getattr(matched_ingredient, "id", None):
                conv = get_conversion(matched_ingredient.id, unit)
                if conv is not None:
                    return quantity * conv
            if matched_ingredient and get_density(matched_ingredient):
                return ml * get_density(matched_ingredient)
            logger.warning(f"No density for {ingredient_name}, using default 1.0 g/ml")
            return ml * 1.0

        # Count/piece units (no conversion in DB). Use type-based fallback so we still calculate something.
        if unit in ["piece", "clove", "slice", "large", "medium", "small"]:
            if matched_ingredient and getattr(matched_ingredient, "id", None):
                conv = get_conversion(matched_ingredient.id, unit)
                if conv is not None:
                    return quantity * conv
            default_g = self._default_grams_for_piece(ingredient_name, unit, matched_ingredient)
            logger.warning(
                f"No conversion for {unit} of {ingredient_name}; using type-based estimate {default_g}g per unit"
            )
            return quantity * default_g

        logger.error(f"Unknown unit: {unit}")
        return 0.0

    def _default_grams_for_piece(
        self,
        ingredient_name: str,
        unit: str,
        matched_ingredient: Optional[Any],
    ) -> float:
        """Reasonable default grams per piece/slice/clove when no DB conversion exists.
        Based on ingredient type so we still contribute to the total."""
        name = (ingredient_name or "").lower()
        category = (getattr(matched_ingredient, "category", None) or "").lower() if matched_ingredient else ""

        # Protein / main items (per piece)
        if any(t in name or t in category for t in ("patty", "burger", "breast", "fillet", "cutlet", "steak", "chicken", "beef", "pork", "fish", "wing", "tender")):
            return 90.0
        # Bread / carbs (per piece or slice)
        if unit == "slice":
            if "cheese" in name:
                return 25.0
            return 35.0  # bread slice
        if any(t in name or t in category for t in ("bun", "roll", "bagel", "muffin", "bread", "tortilla", "wrap", "pita")):
            return 55.0
        # Sauces / condiments
        if any(t in name or t in category for t in ("sauce", "dressing", "mayo", "ketchup", "mustard", "gravy", "salsa")):
            return 25.0
        # Greens / vegetables (portion)
        if any(t in name or t in category for t in ("lettuce", "greens", "spinach", "arugula", "kale", "cabbage", "salad")):
            return 20.0
        # Cheese (piece or slice)
        if "cheese" in name or "cheese" in category:
            return 28.0
        # Eggs
        if "egg" in name and "eggplant" not in name:
            return 50.0
        # Yogurt (single-serve / small tub when user says "1 yogurt" with no grams)
        if "yogurt" in name or "yoghurt" in name:
            return 170.0
        # Cow's milk as a drink (roughly one cup when counted as "piece")
        if "milk" in name and not any(p in name for p in ("almond", "coconut", "soy", "oat", "rice", "hemp")):
            return 244.0
        # Garlic/ginger
        if unit == "clove" or "garlic" in name:
            return 5.0
        if "ginger" in name:
            return 10.0
        # Pickles, onions, tomatoes (condiment amounts)
        if any(t in name for t in ("pickle", "onion", "tomato", "pepper", "relish")):
            return 15.0
        # Generic piece (e.g. "piece of fruit", unknown)
        return 50.0
