.PHONY: help install setup test lint format clean run docker-up docker-down migrate

help:
	@echo "Available commands:"
	@echo "  install      - Install dependencies"
	@echo "  setup        - Initial setup (install + download models)"
	@echo "  test         - Run tests"
	@echo "  lint         - Run linting"
	@echo "  format       - Format code with black"
	@echo "  clean        - Clean up generated files"
	@echo "  run          - Run development server"
	@echo "  docker-up    - Start Docker services"
	@echo "  docker-down  - Stop Docker services"
	@echo "  migrate      - Run database migrations"
	@echo "  seed         - Seed database with USDA data"

install:
	pip install -r requirements.txt

setup: install
	python -m spacy download en_core_web_sm

test:
	pytest tests/ -v --cov=app --cov-report=html

lint:
	flake8 app tests
	mypy app

format:
	black app tests

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".mypy_cache" -exec rm -rf {} +
	find . -type d -name "htmlcov" -exec rm -rf {} +
	find . -type f -name ".coverage" -delete

run:
	uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f api

migrate:
	alembic upgrade head

seed:
	python -m app.etl.usda_ingester --download --ingest
	python -m app.etl.retention_loader
	python -m app.etl.unit_converter_seeder
