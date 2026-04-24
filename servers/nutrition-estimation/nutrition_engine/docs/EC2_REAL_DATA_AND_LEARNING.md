# EC2/Backend: Real Data and “Learning as Users Use”

This doc covers:

1. **Ensuring real data and artifacts are not missing** when the backend runs on EC2 (or App Runner).
2. **Does Layer 3 learn from calls?** — and a **plan to make the system improve as users use it**.

---

## 1. Ensuring real data is not missing on EC2

### What the backend needs at runtime

| What | Purpose | Where it lives |
|------|--------|-----------------|
| **Layer 2 model** | Restaurant calibration | `artifacts/layer2/trained_model.pkl` |
| **Layer 3 artifacts** | Similarity refinement | `artifacts/layer3/*.pkl`, `*.json` (ingredient/dish embeddings, neighbor index, macro_delta_stats, confidence_params; optional: refinement_model.joblib) |
| **Layer 1** | Baseline estimates | Your Layer 1 app + DB (e.g. AWS RDS PostgreSQL); env: `DATABASE_URL`, `SECRET_KEY` |
| **FatSecret** | Search/log proxy | Env: `FATSECRET_CLIENT_ID`, `FATSECRET_CLIENT_SECRET` |

At **startup**, the app loads Layer 2 and Layer 3 from `NUTRITION_ARTIFACTS` (default `artifacts/`). If files are missing, Layer 2 uses a fallback and Layer 3 runs in **pass-through** (L2 macros returned as final, no refinement). So the backend still runs, but estimates are less accurate.

### Checklist so real data is present on EC2

**Option A: Ship artifacts in the image (recommended for “real data always there”)**

1. **Before building the Docker image**, generate artifacts on a dev machine (or CI):
   ```bash
   cd nutrition_engine
   pip install pandas numpy   # and scikit-learn, joblib if using Layer 3 learned model
   python scripts/recreate_layer2_layer3.py
   ```
2. Ensure `artifacts/layer2/` and `artifacts/layer3/` contain the built files. If your `.gitignore` excludes `artifacts/layer2/*.pkl` and `artifacts/layer3/*.pkl` / `*.json`, either:
   - **CI**: Run `recreate_layer2_layer3.py` in CI before `docker build`, and **do not** gitignore those artifacts in the build context (e.g. copy them in a CI step before build), or
   - **Un-ignore for deploy**: Remove or narrow the ignore rules for the artifact paths you want in the image so `COPY artifacts/` in the Dockerfile includes real files.
3. Build the image so `COPY artifacts/` includes those directories:
   ```bash
   cd nutrition_engine
   docker build -t nutrition-engine .
   ```
4. On EC2/App Runner, the container then has real Layer 2 and Layer 3 artifacts; no extra steps at run time.

**Option B: Build artifacts at container startup**

1. In the Dockerfile, install training deps (pandas, numpy, scikit-learn if needed) and copy **source data** into the image:
   - `layers/layer2/data/processed/restaurant_nutrition_dataset.csv`
   - For Layer 3: either the notebook output or the script; if using only `scripts/build_layer3_artifacts.py`, no extra data is required (placeholder artifacts).
2. Add an **entrypoint script** that:
   - Runs `python scripts/recreate_layer2_layer3.py` (or only `--layer2-only` / `--layer3-only` if you split),
   - Then starts the app (e.g. `gunicorn ...`).
3. Pros: Always rebuilds from source data. Cons: Slower startup and larger image; need to maintain data in the image or mount it.

**Option C: Mount artifacts from external storage (S3, EFS)**

1. Store built artifacts in S3 (or a shared filesystem like EFS).
2. At container start, an entrypoint script downloads (or syncs) `artifacts/layer2/` and `artifacts/layer3/` from S3/EFS into the app’s `artifacts/` directory.
3. Set `NUTRITION_ARTIFACTS` if you write to a different path.
4. Then start the app. This keeps images small and lets you update artifacts without rebuilding the image.

**Recommended for “real data never missing”**

- Use **Option A** with artifacts built in CI and included in the image (or Option C if you prefer to update artifacts without redeploying).  
- In **startup**, the app already logs what it loads; we recommend adding an explicit **readiness check** that fails or logs a **warning** if `artifacts/layer2/trained_model.pkl` or Layer 3’s key files are missing, so you never silently run in fallback on EC2.

---

## 2. Does Layer 3 “learn from calls”?

**Short answer: No.** Layer 3 does **not** learn from individual API calls at request time. It is **read-only inference**:

- **Embeddings and neighbor index** are built **offline** (e.g. `layer3_artifact_build.ipynb` or `scripts/build_layer3_artifacts.py`).
- **Learned refinement model** (optional): trained **offline** with `scripts/train_refinement_model.py` on a CSV (e.g. dishes with ground-truth macros). If `artifacts/layer3/refinement_model.joblib` exists, Layer 3 uses it; otherwise it uses rule-based refinement.
- At runtime, Layer 3 only **loads** these artifacts and **refines** using them. It does not write new data or update the model per request.

So “learning as users use” is **not** implemented yet; it has to be added as a **feedback loop** (see below).

---

## 3. Plan: Make the system improve as users use it

To have the backend “keep training and get better as users use,” you need to:

1. **Log feedback** from usage.
2. **Periodically retrain** (or rebuild artifacts) from that feedback.
3. **Update artifacts** and **reload** (or redeploy) so the app uses the new model.

### 3.1 What to log (feedback)

- **Per estimate request (optional):**  
  `item_name`, `restaurant`, L1/L2/L3 outputs, `final_macros`, `confidence`, `request_id`, `timestamp`.  
  Use this to analyze drift and to build a dataset for retraining.

- **Explicit feedback (best for learning):**  
  When the user corrects an estimate or confirms it’s good (e.g. “Correct” / “Wrong” or editing macros). Store:
  - `request_id` (or same fields as the request),
  - `user_macros` (or “correct” / “wrong”),
  - `timestamp`.

- **Implicit signal (optional):**  
  e.g. User logs the same item to FatSecret with different macros → treat as a possible correction for that context.

Store these in a **persistent store** (e.g. Postgres table, or the same DB as Layer 1; or S3/Data Lake for large scale). Avoid only in-memory or ephemeral logs so a retrain job can use them.

### 3.2 Retrain / rebuild cadence

- **Layer 2:**  
  - Add a **batch job** (cron on EC2, or Lambda + Step Functions, or a small “training” container).  
  - Inputs: (1) `layers/layer2/data/processed/restaurant_nutrition_dataset.csv` (or an updated CSV you produce from scrapes), (2) optionally **feedback rows** (e.g. user corrections merged into a “truth” set).  
  - Job runs `scripts/recreate_layer2_layer3.py --layer2-only` (or your own `train_model.py` invocation), producing a new `trained_model.pkl`.

- **Layer 3:**  
  - **Option 1 – Placeholder only:**  
    `scripts/build_layer3_artifacts.py` does not use feedback; it just ensures the app has valid artifacts. No “learning” from usage.  
  - **Option 2 – Real artifact build from dish data:**  
    Maintain a **dish dataset** (ingredients, cooking methods, macros). Add a pipeline that:
    - Appends or merges **user corrections** (and optionally high-confidence estimates) into this dataset.
    - Runs `layer3_artifact_build.ipynb` (or an exported script) to rebuild embeddings and neighbor index, and optionally `train_refinement_model.py` to produce `refinement_model.joblib`.
  - **Option 3 – Learned refinement only:**  
    Export a CSV from your dish dataset + feedback (columns expected by `train_refinement_model.py`). Run `train_refinement_model.py` periodically; output is `artifacts/layer3/refinement_model.joblib`.

Run these jobs on a **schedule** (e.g. weekly) or when feedback volume passes a threshold.

### 3.3 Deploy updated artifacts

- **If artifacts are in the image (Option A):**  
  Retrain in CI; commit or upload new artifacts; build a new image and deploy. EC2/App Runner then runs with the new model.

- **If artifacts are on S3/EFS (Option C):**  
  Retrain job writes new `trained_model.pkl` and Layer 3 files to S3/EFS. Then either:
  - **Reload in process:** Add an endpoint or internal trigger that re-runs `layer2.load_calibration_tables(...)` and `layer3.load_embeddings(...)` (and clears any response cache), or  
  - **Restart workers** so they load the new artifacts at startup (e.g. rolling restart, or restart the container).

- **If you build at container startup (Option B):**  
  Ensure the entrypoint uses the **latest** source data (e.g. downloaded from S3 or a DB) so the next restart builds with new data.

### 3.4 Summary: “Learning as users use”

| Step | Action |
|------|--------|
| 1 | **Log** estimates and, when available, user corrections (and optionally link to request_id). |
| 2 | **Store** logs in a persistent store (DB, S3, etc.). |
| 3 | **Periodic job** (cron/Lambda/container): merge feedback into training data; run Layer 2 training and/or Layer 3 artifact build (+ optional refinement model training). |
| 4 | **Update artifacts** (in image, or on S3/EFS). |
| 5 | **Reload** (or redeploy/restart) so the backend serves the new model. |

Layer 3 itself does not “learn from each call”; improvement comes from this **offline feedback loop** plus redeploy or reload.

---

## 4. Quick reference

- **Real data on EC2:** Use Option A (artifacts in image) or C (mount from S3/EFS); optionally add a startup check that warns or fails if key artifacts are missing.  
- **Layer 3 and learning:** Layer 3 is read-only at runtime; “learning” = log feedback → periodic retrain/rebuild → update artifacts and reload or redeploy.

For deployment steps (env vars, build, deploy trigger), see **DEPLOY_APP_RUNNER.md** (same ideas apply for EC2 if you run the same container there).
