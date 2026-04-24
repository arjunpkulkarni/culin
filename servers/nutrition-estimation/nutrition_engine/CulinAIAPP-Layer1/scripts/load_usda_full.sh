#!/bin/bash
# Load as much USDA FoodData Central data as possible into Layer 1 PostgreSQL.
# Requires: DATABASE_URL and SECRET_KEY in environment (or .env).
# Optional: USDA_DATA_DIR (default: ./data/usda)
# Run from project root. If you use a venv, activate it first; otherwise uses python3 or python.

set -e

# Use PYTHON env var, or python3, or python (so it works without a venv on macOS)
PYTHON="${PYTHON:-$(command -v python3 || command -v python)}"
if [ -z "$PYTHON" ]; then
  echo "Error: No python or python3 found. Create a venv: python3 -m venv .venv && source .venv/bin/activate"
  exit 1
fi

echo "USDA full load for Layer 1 (using: $PYTHON)"

# Script runs Python as a child process; vars must be exported to be visible there
if [ -z "${DATABASE_URL}" ] || [ -z "${SECRET_KEY}" ]; then
  echo "Error: DATABASE_URL and SECRET_KEY must be set and exported so Python can see them."
  echo "Run:"
  echo "  export DATABASE_URL=\"postgresql://user:password@host:5432/dbname\""
  echo "  export SECRET_KEY=\"your-secret-string\""
  echo "  ./scripts/load_usda_full.sh"
  echo "Or create a .env file in the project root with DATABASE_URL= and SECRET_KEY=, then run the script."
  exit 1
fi

# 1) Migrations (alembic has no __main__, so run its main() from code)
echo "Step 1: Running migrations..."
"$PYTHON" -c "from alembic.config import main; main(['upgrade', 'head'])"

# 2) Download full CSV bundle (~458 MB) and ingest
echo "Step 2: Downloading full USDA CSV and ingesting (foundation + SR Legacy + Survey + Branded, all nutrients)..."
"$PYTHON" -m app.etl.usda_ingester --download --full --ingest --all-nutrients \
  --datasets foundation,sr_legacy,survey,branded

# 3) Retention factors and unit conversions
echo "Step 3: Loading retention factors..."
"$PYTHON" -m app.etl.retention_loader

echo "Step 4: Seeding unit conversions..."
"$PYTHON" -m app.etl.unit_converter_seeder

echo ""
echo "Done. To load without Branded (smaller DB), run instead:"
echo "  $PYTHON -m app.etl.usda_ingester --download --full --ingest --all-nutrients --datasets foundation,sr_legacy,survey"
