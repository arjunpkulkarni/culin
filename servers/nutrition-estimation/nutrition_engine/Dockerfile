# Production image: low-latency nutrition estimation engine
# Build: docker build -t nutrition-engine .
# Run:   docker run -p 8000:8000 nutrition-engine

FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install dependencies first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code and artifacts (required for Layer 1/2/3 and AWS App Runner)
# Layer 1: artifacts/layer1/lookup_tables.pkl (or Layer 1 loads from DB at startup)
# Layer 2: artifacts/layer2/trained_model.pkl
# Layer 3: artifacts/layer3/*.pkl, *.json (ingredient_embeddings, dish_embeddings, neighbor_index, etc.)
# Ensure these exist before docker build (commit them or build in CI).
COPY app/ ./app/
COPY layers/ ./layers/
COPY artifacts/ ./artifacts/

# Non-root user for security
RUN useradd --create-home --shell /bin/bash appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Gunicorn + uvicorn workers. Use PORT from env (App Runner / PaaS) or default 8000.
# Override workers with: docker run -e NUTRITION_WORKERS=4 ...
# Bind 0.0.0.0 for container networking.
# --timeout 120: worker request timeout (must exceed Gemini API timeout + DB lookup startup)
# --graceful-timeout 15: seconds to finish in-flight requests on SIGTERM
ENV PORT=8000
ENV NUTRITION_WORKERS=2
CMD ["sh", "-c", "exec gunicorn app.main:app --workers ${NUTRITION_WORKERS} --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT} --timeout 120 --graceful-timeout 15 --access-logfile - --capture-output"]
