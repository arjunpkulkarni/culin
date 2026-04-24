# Setup (Python version)

This project works best with **Python 3.11 or 3.12**. Python 3.14 is not yet supported by several dependencies (pydantic-core, spacy/blis, python-Levenshtein, etc.).

## Use Python 3.12

### Option A: Homebrew (macOS)

```bash
# Install Python 3.12
brew install python@3.12

# Create venv with that Python (from project root)
python3.12 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Option B: pyenv

```bash
# Install pyenv if needed: https://github.com/pyenv/pyenv#installation
# Install Python 3.12
pyenv install 3.12

# This repo has .python-version set to 3.12; pyenv will use it when you cd here
cd /path/to/CulinAIAPP-Layer1
pyenv version   # should show 3.12.x

# Create venv with current pyenv Python
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Recreate your venv (you were on 3.14)

```bash
cd /Users/sunilbuddaraju/CulinAIAPP-Layer1

# Remove old venv
rm -rf .venv

# Create new one with Python 3.12 (use python3.12 or pyenv as above)
python3.12 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

Then run migrations and the USDA load as in [USDA_LOAD_PLAN.md](USDA_LOAD_PLAN.md).

## Alembic reset {#alembic-reset}

If you get **"Can't locate revision identified by '...'"**, the database’s `alembic_version` table points to a revision that isn’t in this repo.

1. Clear the version (ensure `DATABASE_URL` and `SECRET_KEY` are set or in `.env`):

```bash
python -c "
from app.core.config import get_settings
from sqlalchemy import create_engine, text
s = get_settings()
url = str(s.database_url)
if url.startswith('postgresql://') and 'postgresql+' not in url.split('://')[0]:
    url = url.replace('postgresql://', 'postgresql+psycopg://', 1)
e = create_engine(url)
with e.connect() as c:
    c.execute(text('DELETE FROM alembic_version'))
    c.commit()
print('alembic_version cleared.')
"
```

2. Then either:
   - **Tables already exist** (e.g. you see "relation ... already exists"): just sync the revision without running migrations:
     ```bash
     python -c "from alembic.config import main; main(['stamp', 'head'])"
     ```
   - **Empty database**: run migrations to create tables:
     ```bash
     python -c "from alembic.config import main; main(['upgrade', 'head'])"
     ```

Then run `./scripts/load_usda_full.sh` again.
