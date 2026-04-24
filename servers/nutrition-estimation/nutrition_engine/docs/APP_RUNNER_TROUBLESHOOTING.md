# App Runner health check troubleshooting

If a deployment fails with **"Health check failed on protocol HTTP [Path: '/health'], [Port: '8000']"**, the new image is not responding to `/health` in time or the process is exiting.

## 1. Check application logs in CloudWatch

- In AWS Console: **App Runner** → your service → **Logs** (or **Observability**).
- Open the log group for the service and look at the **application** log stream for the failed deployment (time window around the deployment ID).
- Look for: Python tracebacks, `ModuleNotFoundError`, `FileNotFoundError`, OOM, or "Address already in use". Those explain why the process never binds to port 8000 or crashes before answering.

## 2. Run the same image locally

Reproduce with the exact image that App Runner pulls:

```bash
docker run --rm -p 8000:8000 581549954508.dkr.ecr.us-east-2.amazonaws.com/nutrition-engine:latest
```

In another terminal:

```bash
curl -v http://localhost:8000/health
```

- If the container exits immediately, the logs in the first terminal will show the error (e.g. import or startup failure).
- If `curl` gets `200` and `{"status":"ok"}`, the app is fine locally; then the issue is likely environment (env vars, memory, or networking) in App Runner.

## 3. Confirm port and path

- The app binds to **0.0.0.0** and listens on **PORT** (default **8000**). App Runner’s health check must use the same port (e.g. 8000) and path `/health`.
- The Dockerfile uses `PORT` from the environment so App Runner can override it if needed; the default is 8000.

## 4. First deployment worked, second failed

If an earlier deployment (e.g. `bfef777...`) passed and a later one (e.g. `0840a9a6...`) failed after a new image push:

- The **new image** is what’s under test. Compare it to the last working image: dependency changes, missing or changed `artifacts/`, or different env in the new deployment.
- Run the **new** image locally (step 2) to see startup errors.
- Ensure the build still includes `artifacts/` (e.g. `COPY artifacts/ ./artifacts/` in the Dockerfile) and that Layer 2/Layer 3 loaders don’t raise on the current artifact format (they’re designed to warn and fall back if files are missing).

Once you see the actual error in logs or from a local run, fix that (e.g. env, artifact path, or dependency) and redeploy.
