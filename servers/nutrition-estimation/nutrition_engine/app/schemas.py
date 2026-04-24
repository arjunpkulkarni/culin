"""Unified request/response schema and layer handoff contracts."""

from typing import Optional, List, Dict, Any

try:
    from typing_extensions import TypedDict
except ImportError:
    from typing import TypedDict  # Python 3.12+

from pydantic import BaseModel


class _NutritionRequestRequired(TypedDict):
    item_name: str
    description: str


class _NutritionRequestOptional(TypedDict, total=False):
    restaurant: Optional[str]
    price: Optional[float]
    modifiers: Optional[List[str]]
    cooking_method: Optional[str]


class NutritionRequest(_NutritionRequestRequired, _NutritionRequestOptional):
    """Request body for POST /estimate. item_name and description required; rest optional."""


class NutritionResponse(TypedDict):
    macros: Dict[str, float]
    confidence: float
    debug: Dict


# --- FatSecret proxy: food log request (JSON body) ---


class FoodLogRequest(BaseModel):
    food_id: str
    food_name: str
    meal_type: str = "Lunch"
    number_units: float = 1.0
    serving_id: Optional[str] = None
    date: Optional[str] = None  # YYYY-MM-DD


# --- Layer handoff contracts (L1 out = L2 in; L2 out = L3 in) ---

class Macros(TypedDict, total=False):
    """Macro keys; all floats. total=False allows subsets during pipeline."""
    calories: float
    protein: float
    carbs: float
    fat: float


class Layer1Output(TypedDict):
    """What Layer 1 returns. This is exactly what Layer 2 receives as baseline_estimate."""
    macros: Dict[str, float]
    confidence: float


# Layer 2 input = Layer1Output (baseline_estimate)


class Layer2Output(TypedDict):
    """What Layer 2 returns. This is exactly what Layer 3 receives as l2_output."""
    macros: Dict[str, float]
    layer2_confidence: float
    applied_adjustments: Dict[str, Any]


# Layer 3 input = Layer2Output (l2_output)


class Layer3Output(TypedDict):
    """What Layer 3 returns."""
    final_macros: Dict[str, float]
    layer3_confidence: float
    refinements_applied: Dict[str, Any]


# --- Layer 0: free-text input ---


class FreeTextRequest(BaseModel):
    """Request body for POST /estimate-from-text."""
    text: str
    restaurant: Optional[str] = None
    price: Optional[float] = None


class Layer0Output(TypedDict, total=False):
    """What Layer 0 returns — a NutritionRequest plus RAG metadata."""
    item_name: str
    description: str
    restaurant: Optional[str]
    price: Optional[float]
    modifiers: List[str]
    cooking_method: Optional[str]
    _layer0_meta: Dict[str, Any]
