#!/usr/bin/env python3
"""
Recreate all artifacts needed for Layer 2 and Layer 3.

- Layer 2: Trains the calibration model from layers/layer2/data/processed/,
  writes trained_model.pkl to artifacts/layer2/.
- Layer 3: Builds placeholder artifacts (embeddings, neighbor index, stats, confidence)
  into artifacts/layer3/.

Run from nutrition_engine/ (use a venv with Layer 2/3 deps):
  pip install pandas numpy   # for Layer 2 training + Layer 3 build
  python scripts/recreate_layer2_layer3.py

Or from repo root:
  python nutrition_engine/scripts/recreate_layer2_layer3.py

Options:
  --layer2-only    Only train Layer 2 and copy model to artifacts/layer2
  --layer3-only    Only build Layer 3 artifacts into artifacts/layer3
  --max-samples N  Limit Layer 2 training to N samples (default 5000; use 0 for all)
"""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


def repo_root() -> Path:
    """Nutrition engine directory (where layers/ and artifacts/ live)."""
    script = Path(__file__).resolve()
    return script.parent.parent


def run_layer2_training(engine_root: Path, max_samples: int | None) -> bool:
    """Run Layer 2 training from layers/layer2; copy model to artifacts/layer2."""
    layer2_dir = engine_root / "layers" / "layer2"
    data_path = layer2_dir / "data" / "processed" / "restaurant_nutrition_dataset.csv"
    if not data_path.exists():
        print(f"Layer 2: dataset not found: {data_path}")
        return False

    model_out = layer2_dir / "layer2" / "trained_model.pkl"
    artifacts_l2 = engine_root / "artifacts" / "layer2"
    artifacts_l2.mkdir(parents=True, exist_ok=True)

    cmd = [
        sys.executable,
        str(layer2_dir / "layer2" / "train_model.py"),
        "--data", str(data_path),
        "--output", str(model_out),
    ]
    if max_samples is not None:
        cmd.extend(["--max-samples", str(max_samples)])

    # Run from engine_root so the same interpreter and venv are used; PYTHONPATH so layer2 package is found
    env = os.environ.copy()
    venv_site = (
        Path(sys.executable).resolve().parent.parent
        / "lib"
        / f"python{sys.version_info.major}.{sys.version_info.minor}"
        / "site-packages"
    )
    path_parts = [str(venv_site), str(layer2_dir)]
    if env.get("PYTHONPATH"):
        path_parts.append(env["PYTHONPATH"])
    env["PYTHONPATH"] = os.pathsep.join(path_parts)

    print("Layer 2: training calibration model...")
    r = subprocess.run(cmd, cwd=str(engine_root), env=env)
    if r.returncode != 0:
        print("Layer 2: training failed")
        return False

    dest = artifacts_l2 / "trained_model.pkl"
    shutil.copy2(model_out, dest)
    print(f"Layer 2: copied model to {dest}")
    return True


def run_layer3_build(engine_root: Path) -> bool:
    """Run Layer 3 artifact build script -> artifacts/layer3/."""
    script = engine_root / "scripts" / "build_layer3_artifacts.py"
    if not script.exists():
        print(f"Layer 3: build script not found: {script}")
        return False

    print("Layer 3: building artifacts...")
    r = subprocess.run(
        [sys.executable, str(script), "-o", str(engine_root / "artifacts" / "layer3")],
        cwd=str(engine_root),
    )
    if r.returncode != 0:
        print("Layer 3: build failed")
        return False
    return True


def main():
    parser = argparse.ArgumentParser(description="Recreate Layer 2 and Layer 3 artifacts")
    parser.add_argument(
        "--layer2-only",
        action="store_true",
        help="Only run Layer 2 training",
    )
    parser.add_argument(
        "--layer3-only",
        action="store_true",
        help="Only run Layer 3 artifact build",
    )
    parser.add_argument(
        "--max-samples",
        type=int,
        default=5000,
        help="Max samples for Layer 2 training (default 5000, use 0 for all)",
    )
    args = parser.parse_args()
    max_samples = None if args.max_samples == 0 else args.max_samples

    engine_root = repo_root()
    os.chdir(engine_root)

    ok = True
    if not args.layer3_only:
        ok = run_layer2_training(engine_root, max_samples) and ok
    if not args.layer2_only:
        ok = run_layer3_build(engine_root) and ok

    if ok:
        print("\nDone. Restart the app (or run_local_test.py) to load the new artifacts.")
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
