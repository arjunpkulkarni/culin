# Engine accuracy reports

Markdown and JSON summaries are written here by:

```bash
cd nutrition_engine
python scripts/eval_engine_accuracy.py --n 50 --seed 42
```

Filenames look like `engine_accuracy_<UTC timestamp>.md` (plus a matching `.json`).

Use a fixed `--seed` when you need comparable runs across engine or data changes.
