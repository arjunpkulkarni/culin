# Deploying to AWS App Runner

This repo has **no built-in App Runner or CI/CD config**. You connect Git to App Runner in the AWS console (or via IaC), then deploy when you want the latest code live.

---

## How Git connects to App Runner

App Runner supports two ways to get your app:

### Option 1: Source and deploy (Git connection) — typical

1. In **AWS Console** → **App Runner** → your service (or create one).
2. **Source**: Connect to **GitHub** (or CodeCommit / Bitbucket).
   - Authorize AWS to access your repo.
   - Choose repo and branch (e.g. `main`).
3. **Build configuration**:
   - **Runtime**: Docker.
   - **Dockerfile path**: `nutrition_engine/Dockerfile` (relative to repo root).
   - **Build context**: repo root, or set so the Dockerfile can `COPY` from `nutrition_engine/` (the Dockerfile expects to be run with context such that `app/`, `layers/`, `artifacts/` are under the build context; the Dockerfile lives in `nutrition_engine/`, so you usually set **source directory** or **build context** to `nutrition_engine` so the Dockerfile’s `COPY app/`, `COPY layers/`, etc. work).

   If your App Runner “source” is the **whole repo**, the Dockerfile path is `nutrition_engine/Dockerfile`. Some setups expect the build context to be the folder that contains the Dockerfile; then set **build context** to `nutrition_engine` so `COPY app/` resolves to `nutrition_engine/app/`.

4. **Deploy trigger**:
   - **Manual** – deploy only when you click “Deploy” in the console (or via CLI).
   - **Automatic** – App Runner rebuilds and deploys on every push to the connected branch (if supported by your source).

With Git connected, **pushing to that branch does not deploy by itself** unless automatic deployment is on. You still need to start a deploy (see below).

---

### Option 2: Deploy from a container image (ECR)

1. Build the image (from repo root, so paths match the Dockerfile):
   ```bash
   cd nutrition_engine
   docker build -t nutrition-engine .
   ```
2. Tag and push to **Amazon ECR** (replace `ACCOUNT` and `REGION`):
   ```bash
   aws ecr get-login-password --region REGION | docker login --username AWS --password-stdin ACCOUNT.dkr.ecr.REGION.amazonaws.com
   docker tag nutrition-engine:latest ACCOUNT.dkr.ecr.REGION.amazonaws.com/nutrition-engine:latest
   docker push ACCOUNT.dkr.ecr.REGION.amazonaws.com/nutrition-engine:latest
   ```
3. In App Runner, set **Source** to **Container registry** → that ECR repo and tag.
4. To deploy a new version: rebuild, push a new image (same tag or new tag and update the service), then trigger a deploy in App Runner.

---

## How to deploy the latest version

After you **commit and push** your changes:

### If you use Git as the source (Option 1)

1. **Push** to the branch connected to App Runner (e.g. `main`):
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```
2. **Start a deploy** (one of these):
   - **Console**: App Runner → your service → **Deploy** → **Deploy new version**.
   - **CLI**:
     ```bash
     aws apprunner start-deployment --service-arn YOUR_SERVICE_ARN
     ```
3. Wait for the deployment to finish (Console: “Deployment” tab; CLI: `describe-service` until `Status` is not `OPERATION_IN_PROGRESS`).
4. Your service URL now serves the new code.

If **automatic deployment** is enabled for your source, step 2 may happen on every push; otherwise you must trigger deploy manually.

### If you use ECR (Option 2)

1. Build and push a new image (see commands above).
2. In App Runner, trigger a new deployment so it pulls the new image:
   - Console: **Deploy** → **Deploy new version**.
   - CLI: `aws apprunner start-deployment --service-arn YOUR_SERVICE_ARN`.

---

## Summary

| Step | Action |
|------|--------|
| 1 | Make changes in the repo. |
| 2 | Commit and push to the branch connected to App Runner (or push a new image to ECR). |
| 3 | Trigger a deploy (Console “Deploy” or `aws apprunner start-deployment`). |
| 4 | Wait for deployment to complete; the service URL then runs the latest version. |

**Env vars**: Set them in the App Runner service configuration (Console → your service → **Configuration** → **Environment variables**), not in the repo. Include at least:

- `DATABASE_URL`, `SECRET_KEY` (for Layer 1 / estimation)
- `FATSECRET_CLIENT_ID`, `FATSECRET_CLIENT_SECRET` (for `/food/search` and `/food/log` proxy; optional – if unset, those endpoints return 503)

See **FATSECRET_AND_FIREBASE.md** for the FatSecret + Firebase flow (frontend calls this API, stores logs in Firebase for day/week views).
