# Setup for layer3_artifact_build.ipynb

Homebrew Python is "externally managed" and blocks `pip install` system-wide. Use a virtual environment.

## 1. Create and activate the venv

```bash
cd /Users/sunilbuddaraju/Layer3_CulinAI
python3 -m venv .venv
source .venv/bin/activate
```

## 2. Install dependencies

```bash
pip install -r requirements-notebook.txt
```

If you see an **SSL certificate error** (e.g. `SSLCertVerificationError`):

- Try: `pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org -r requirements-notebook.txt`
- Or fix system certs: `pip install certifi` then `python -m certifi` to see the bundle path; or install certs for your OS (e.g. macOS Keychain / corporate proxy).

## 3. Run the notebook

- In Cursor/VS Code: **Cmd+Shift+P** → **Python: Select Interpreter** → choose the `.venv` (e.g. `./venv/bin/python` or `Python 3.x.x ('.venv': venv)`).
- Open `layer3_artifact_build.ipynb` and run all cells.

The `.venv` folder is in `.gitignore` and is not committed.
