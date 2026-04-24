# Standard Testing Protocol for the Nutrition Engine and App

This doc defines how testing is organized and how to run tests for the **whole app** (engine + layers). The engine repo is the main place for **API and integration** tests; individual layers can have their own unit tests.

---

## 1. Where tests live

| Scope | Location | What’s tested |
|-------|----------|----------------|
| **Engine (this repo)** | `nutrition_engine/tests/` | Health, readiness, POST /estimate (with optional mocks), FatSecret proxy routes. Run with pytest from `nutrition_engine/`. |
| **Engine scripts** | `nutrition_engine/test_data_flow.py`, `test_integration.py` | Full L1→L2→L3 data flow (run manually; may need DB and artifacts). |
| **Layer 1** | `CulinAIAPP-Layer1/tests/` (if present) | Parser, validator, calculator, API. Run with pytest from `CulinAIAPP-Layer1/`. |
| **Layer 2** | `layers/layer2/layer2/test_integration.py` | Calibration and feature extraction (script; run from `layers/layer2`). |

---

## 2. Running tests

### Engine (pytest) – standard protocol

From **nutrition_engine/** (or repo root with `cd nutrition_engine`):

```bash
# Install dev deps once
pip install -r requirements.txt -r requirements-dev.txt

# Run all engine tests (health, estimate, food routes)
pytest

# Run with coverage
pytest --cov=app --cov-report=term-missing

# Run only a file or a test
pytest tests/test_api_health.py
pytest tests/test_estimate.py -v
```

- **No .env or DB required** for the tests in `tests/`: estimate tests mock the pipeline; food tests mock the FatSecret client.
- **Startup still runs** when using `TestClient`, so L2/L3 may log warnings if artifacts are missing; tests still pass.

### Full data flow (optional integration)

If you have Layer 1 DB and artifacts and want to test the real pipeline end-to-end:

```bash
cd nutrition_engine
python test_data_flow.py
```

### Layer 1 (if you have CulinAIAPP-Layer1)

```bash
cd CulinAIAPP-Layer1
pip install -r requirements.txt   # and dev deps if needed
pytest
```

### Layer 2

```bash
cd nutrition_engine/layers/layer2
python layer2/test_integration.py
```

---

## 3. What to run before deploy / in CI

**Minimum (fast, no external deps):**

```bash
cd nutrition_engine
pip install -r requirements.txt -r requirements-dev.txt
pytest
```

**Optional (full stack):**

- Run `python test_data_flow.py` (requires DB and artifacts).
- Run Layer 1 tests from its directory if you changed Layer 1.
- Run Layer 2 integration script if you changed Layer 2.

---

## 4. Test markers (optional)

In the engine, you can tag tests and run by marker:

```bash
pytest -m unit
pytest -m "not slow"
```

Markers are defined in `pytest.ini`; add `@pytest.mark.unit` or `@pytest.mark.integration` to tests as needed.

---

## 5. CI (e.g. GitHub Actions)

Run the same commands in CI so every push/PR is checked:

- Checkout repo.
- Install dependencies: `pip install -r requirements.txt -r requirements-dev.txt`.
- Run from `nutrition_engine`: `pytest` (and optionally `pytest --cov=app`).
- Optionally run `test_data_flow.py` in a job that has DB and artifacts (e.g. a separate “integration” job).

A minimal workflow file is in `.github/workflows/tests.yml` (if added) so “standard testing protocol” is automated.

---

## 6. Summary

| Goal | Command |
|------|--------|
| **Standard engine tests** | `cd nutrition_engine && pytest` |
| **With coverage** | `cd nutrition_engine && pytest --cov=app` |
| **Full pipeline (L1→L2→L3)** | `cd nutrition_engine && python test_data_flow.py` |
| **Layer 1 tests** | `cd CulinAIAPP-Layer1 && pytest` |
| **Layer 2 integration** | `cd nutrition_engine/layers/layer2 && python layer2/test_integration.py` |

Keeping “run `pytest` from nutrition_engine” as the default ensures a single, repeatable protocol for the whole app.
