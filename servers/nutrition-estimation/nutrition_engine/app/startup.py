"""Load all artifacts at startup. Zero disk reads at request time."""

import logging
from pathlib import Path

from app.config import (
    ENABLE_LAYER3,
    LAYER1_ARTIFACTS,
    LAYER2_ARTIFACTS,
    LAYER3_ARTIFACTS,
    LLM_PROVIDER,
    LLM_API_KEY,
    LLM_MODEL,
)

logger = logging.getLogger(__name__)

# Key artifact files; if missing, the layer runs in fallback/pass-through mode
LAYER2_KEY_FILE = "trained_model.pkl"
LAYER1_LOOKUP_FILE = "lookup_tables.pkl"
LAYER3_KEY_FILES = (
    "ingredient_embeddings.pkl",
    "dish_embeddings.pkl",
    "neighbor_index.pkl",
    "macro_delta_stats.json",
    "confidence_params.json",
)


def _artifacts_readiness() -> tuple[bool, bool]:
    """Return (layer2_ok, layer3_ok) based on presence of key artifact files."""
    l2_ok = (Path(LAYER2_ARTIFACTS) / LAYER2_KEY_FILE).exists()
    l3_dir = Path(LAYER3_ARTIFACTS)
    l3_ok = all((l3_dir / f).exists() for f in LAYER3_KEY_FILES)
    return l2_ok, l3_ok


def startup(app=None):
    """Load Layer 1, Layer 2, and Layer 3 artifacts. Call once per worker at process start."""
    logger.info("Loading Layer 1 lookup tables from %s", LAYER1_ARTIFACTS)
    from layers import layer1
    layer1.load_lookup_tables(str(LAYER1_ARTIFACTS.parent))

    logger.info("Loading Layer 2 calibration tables from %s", LAYER2_ARTIFACTS)
    from layers import layer2
    layer2.load_calibration_tables(str(LAYER2_ARTIFACTS))

    l2_ok, l3_files_ok = _artifacts_readiness()
    if ENABLE_LAYER3:
        logger.info("Loading Layer 3 embeddings from %s", LAYER3_ARTIFACTS)
        from layers import layer3

        layer3.load_embeddings(str(LAYER3_ARTIFACTS))
    else:
        logger.info("Layer 3 disabled (set NUTRITION_ENABLE_LAYER3=1 to load); skipping embedding artifacts")

    # Log a single readiness line so EC2/CloudWatch show whether real data is present
    if l2_ok and (l3_files_ok if ENABLE_LAYER3 else True):
        logger.info(
            "Artifacts: Layer2 OK, Layer3 %s",
            "OK (loaded)" if ENABLE_LAYER3 and l3_files_ok else "off",
        )
    else:
        logger.warning(
            "Artifacts: Layer2 %s, Layer3 %s — see docs/EC2_REAL_DATA_AND_LEARNING.md",
            "OK" if l2_ok else "MISSING",
            "OK" if (ENABLE_LAYER3 and l3_files_ok) else ("off" if not ENABLE_LAYER3 else "MISSING"),
        )

    # Layer 0 — LLM provider (optional; /estimate-from-text won't work without it)
    l0_ok = False
    if LLM_API_KEY:
        try:
            from layers.layer0.llm_providers import init_provider

            init_provider(LLM_PROVIDER, LLM_API_KEY, LLM_MODEL)
            l0_ok = True
            logger.info("Layer 0: LLM provider '%s' initialised", LLM_PROVIDER)
        except Exception as e:
            logger.warning("Layer 0: failed to initialise LLM provider: %s", e)
    else:
        logger.info("Layer 0: LLM_API_KEY not set; /estimate-from-text will be unavailable")

    from app.cache import warmup_cache
    warmup_cache()

    if app is not None:
        app.state.ready = True
        app.state.artifacts_layer2_ok = l2_ok
        app.state.artifacts_layer3_ok = bool(ENABLE_LAYER3 and l3_files_ok)
        app.state.layer3_runtime_enabled = ENABLE_LAYER3
        app.state.layer0_available = l0_ok
    logger.info("Startup complete; ready to serve requests.")
