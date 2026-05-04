"""FastAPI entry. Single public endpoint: POST /estimate. Production: health + ready."""

import logging
import threading
import time
import uuid

from fastapi import Depends, FastAPI, Request, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.auth import require_auth
from app.config import CORS_ORIGINS
from app.schemas import NutritionRequest, FreeTextRequest
from app.startup import startup
from app.routes.food import router as food_router
from app.routes.user import router as user_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S%z",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Nutrition Estimation Engine", version="1.0.0")
origins = [o.strip() for o in CORS_ORIGINS.split(",") if o.strip()] if CORS_ORIGINS != "*" else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)
app.include_router(food_router)
app.include_router(user_router)


@app.on_event("startup")
def on_startup():
    """Load artifacts in a background thread so the server can respond to /health immediately."""
    app.state.ready = False
    app.state.artifacts_layer2_ok = False
    app.state.artifacts_layer3_ok = False
    app.state.layer3_runtime_enabled = False

    def run_startup():
        try:
            # Create user_profiles table if not already present (idempotent).
            try:
                from app.db import create_tables
                create_tables()
            except Exception as db_exc:
                logger.warning("Could not create user_profiles table (DB unavailable?): %s", db_exc)

            startup(app)
        except Exception as e:
            logger.exception("Startup failed: %s", e)
            app.state.ready = False

    thread = threading.Thread(target=run_startup, daemon=False)
    thread.start()


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Return clean JSON for any unhandled error instead of a stack trace."""
    from app.engine import EstimationError

    if isinstance(exc, EstimationError):
        logger.warning("EstimationError [%s] on %s %s: %s", exc.stage, request.method, request.url.path, exc)
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": str(exc), "stage": exc.stage},
        )

    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    status = 504 if isinstance(exc, TimeoutError) else 500
    return JSONResponse(
        status_code=status,
        content={"detail": "Something went wrong. Please try again."},
    )


@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.request_id = request_id
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = (time.perf_counter() - start) * 1000
        logger.exception(
            "request_id=%s %s %s unhandled %.2fms",
            request_id,
            request.method,
            request.url.path,
            duration_ms,
        )
        raise

    duration_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "request_id=%s %s %s %s %.2fms",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


@app.get("/health")
def health():
    """Liveness: process is up. Use for load balancer pings."""
    return {"status": "ok"}


@app.get("/ready")
def ready(request: Request):
    """Readiness: startup finished and this worker can accept traffic. Includes artifact status for EC2/ops."""
    if getattr(request.app.state, "ready", False):
        out = {"status": "ready"}
        if getattr(request.app.state, "artifacts_layer2_ok", None) is not None:
            l3_on = getattr(request.app.state, "layer3_runtime_enabled", False)
            out["artifacts"] = {
                "layer2": "ok" if request.app.state.artifacts_layer2_ok else "missing",
                "layer3": (
                    "off"
                    if not l3_on
                    else ("ok" if request.app.state.artifacts_layer3_ok else "missing")
                ),
            }
        return out
    return {"status": "starting"}, 503


@app.get("/")
def root():
    """API overview. Prevents a bare 404 when opening the service URL in a browser."""
    return {
        "service": "Nutrition Estimation Engine",
        "version": "2.0.0",
        "endpoints": {
            "POST /estimate-from-text": "Primary endpoint. Default: Layer 0 + L1→L2 (L3 off). Set NUTRITION_ENABLE_LAYER3=1 for L3; ESTIMATE_SIMPLE_LLM=1 for v1 LLM macros.",
            "POST /estimate": "Structured input → Layer 0 → L1 → L2 (L3 optional).",
            "GET /health": "Liveness check.",
            "GET /ready": "Readiness check (startup complete?).",
            "GET /docs": "Interactive API docs (Swagger UI).",
        },
    }


@app.post("/estimate")
def estimate(
    req: NutritionRequest,
    request: Request,
    response: Response,
    _identity: str = Depends(require_auth),
):
    """Structured input → Layer 1 → Layer 2; Layer 3 only if NUTRITION_ENABLE_LAYER3=1."""
    if not getattr(request.app.state, "ready", False):
        return JSONResponse(
            status_code=503,
            content={"detail": "Service starting; try again in a few seconds."},
        )
    if not getattr(request.app.state, "layer0_available", False):
        return JSONResponse(
            status_code=503,
            content={"detail": "Layer 0 (LLM) not configured. Set LLM_API_KEY."},
        )
    from app.engine import estimate_nutrition

    # Always run the full pipeline (no in-process LRU); repeat logs must not reuse stale macros.
    response.headers["Cache-Control"] = "no-store"
    return estimate_nutrition(req)


@app.post("/estimate-from-text")
def estimate_from_text(
    req: FreeTextRequest,
    request: Request,
    response: Response,
    _identity: str = Depends(require_auth),
):
    """Free-text → macros (default: Layer 0 + L1→L2; L3 off unless NUTRITION_ENABLE_LAYER3=1)."""
    if not getattr(request.app.state, "ready", False):
        return JSONResponse(
            status_code=503,
            content={"detail": "Service starting; try again in a few seconds."},
        )
    if not getattr(request.app.state, "layer0_available", False):
        return JSONResponse(
            status_code=503,
            content={"detail": "Layer 0 (LLM) not configured. Set LLM_API_KEY."},
        )
    from app.engine import estimate_from_text as run_estimate_from_text

    response.headers["Cache-Control"] = "no-store"
    return run_estimate_from_text(
        text=req.text,
        restaurant=req.restaurant,
        price=req.price,
    )
