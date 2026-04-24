#!/bin/bash
set -e

echo "Seeding Nutrition Calculator database..."

# Download and ingest USDA data
echo "Step 1: Downloading and ingesting USDA FoodData Central..."
python -m app.etl.usda_ingester --download --ingest

# Load retention factors
echo "Step 2: Loading retention factors..."
python -m app.etl.retention_loader

# Seed unit conversions
echo "Step 3: Seeding unit conversions..."
python -m app.etl.unit_converter_seeder

echo "Database seeding complete!"
echo ""
echo "Summary:"
echo "  ✓ USDA FoodData Central data ingested"
echo "  ✓ Retention factors loaded"
echo "  ✓ Unit conversions seeded"
echo ""
echo "The system is ready to use!"
