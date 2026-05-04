"""Render Markdown accuracy report."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional

from .metrics import MacroSeriesStats


def _fmt(x: Optional[float], digits: int = 3) -> str:
    if x is None:
        return "—"
    if isinstance(x, float) and (x != x):  # NaN
        return "—"
    return f"{x:.{digits}f}"


def render_report(
    *,
    title: str,
    methodology: str,
    environment: Dict[str, Any],
    dataset_profile: Dict[str, Any],
    stats_by_macro: Dict[str, MacroSeriesStats],
    per_row: List[Mapping[str, Any]],
    sample_detail_rows: int = 12,
) -> str:
    lines: List[str] = []
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines.append(f"# {title}")
    lines.append("")
    lines.append(f"_Generated: {ts}_")
    lines.append("")
    lines.append("## Executive summary")
    lines.append("")
    maes = [stats_by_macro[m].mae for m in stats_by_macro if stats_by_macro[m].n > 0]
    mean_mae = sum(maes) / len(maes) if maes else float("nan")
    lines.append(
        f"- **Samples evaluated:** {environment.get('sample_count', '—')}"
    )
    lines.append(f"- **Random seed:** {environment.get('seed', '—')}")
    lines.append(f"- **Mean MAE (across macros with data):** {_fmt(mean_mae)}")
    lines.append(f"- **Layer 1 ready (DB or lookup pickle):** {environment.get('layer1_ready', '—')}")
    lines.append("")
    lines.append("## Methodology")
    lines.append("")
    lines.append(methodology.strip())
    lines.append("")
    lines.append("## Environment")
    lines.append("")
    lines.append("| Key | Value |")
    lines.append("|-----|-------|")
    for k, v in environment.items():
        lines.append(f"| {k} | {v} |")
    lines.append("")
    lines.append("## Dataset profile")
    lines.append("")
    lines.append(f"- **Rows (full file):** {dataset_profile.get('row_count')}")
    dup = dataset_profile.get("duplicate_ingredient_name_rows")
    if dup is not None:
        lines.append(f"- **Duplicate `ingredient_name` rows:** {dup}")
    top = dataset_profile.get("category_top")
    if top:
        lines.append(f"- **Top categories:** `{top}`")
    lines.append(f"- **Missing values:** `{dataset_profile.get('missing_counts')}`")
    nl = dataset_profile.get("ingredient_name_length") or {}
    lines.append(
        f"- **Ingredient name length (chars):** min={nl.get('min')}, max={nl.get('max')}, mean={_fmt(nl.get('mean'), 1)}"
    )
    lines.append("")
    lines.append("## Aggregate accuracy (predicted vs reference)")
    lines.append("")
    lines.append(
        "| Macro | n | Mean ref | Mean pred | Bias | MAE | RMSE | MdAE | MAPE % | sMAPE % | r (Pearson) |"
    )
    lines.append("|-------|---|----------|-----------|------|-----|------|------|--------|---------|-------------|")
    order = ("calories", "protein", "carbs", "fat", "sodium")
    for m in order:
        s = stats_by_macro.get(m)
        if not s or s.n == 0:
            lines.append(f"| {m} | 0 | — | — | — | — | — | — | — | — | — |")
            continue
        r = _fmt(s.pearson_r, 4) if s.pearson_r is not None else "—"
        lines.append(
            f"| {m} | {s.n} | {_fmt(s.mean_reference)} | {_fmt(s.mean_predicted)} | {_fmt(s.bias)} | "
            f"{_fmt(s.mae)} | {_fmt(s.rmse)} | {_fmt(s.median_ae)} | {_fmt(s.mape_pct)} | {_fmt(s.smape_pct)} | {r} |"
        )
    lines.append("")
    lines.append("### Dispersion (reference, predicted, error)")
    lines.append("")
    lines.append("| Macro | σ(ref) | σ(pred) | σ(err) |")
    lines.append("|-------|--------|---------|----------|")
    for m in order:
        s = stats_by_macro.get(m)
        if not s or s.n == 0:
            continue
        lines.append(
            f"| {m} | {_fmt(s.stdev_reference)} | {_fmt(s.stdev_predicted)} | {_fmt(s.stdev_error)} |"
        )
    lines.append("")
    lines.append(f"## Per-item detail (first {sample_detail_rows} rows)")
    lines.append("")
    lines.append(
        "| ingredient | status | cal e | cal p | prot e | prot p | carb e | carb p | fat e | fat p | sod e | sod p |"
    )
    lines.append("|------------|--------|-------|-------|--------|--------|--------|--------|-------|-------|-------|-------|")
    for row in per_row[:sample_detail_rows]:
        lines.append(
            "| {name} | {st} | {ce} | {cp} | {pe} | {pp} | {be} | {bp} | {fe} | {fp} | {se} | {sp} |".format(
                name=str(row.get("ingredient_name", ""))[:56].replace("|", "/"),
                st=row.get("status", ""),
                ce=_fmt(row.get("ref_calories"), 1),
                cp=_fmt(row.get("pred_calories"), 1),
                pe=_fmt(row.get("ref_protein"), 2),
                pp=_fmt(row.get("pred_protein"), 2),
                be=_fmt(row.get("ref_carbs"), 2),
                bp=_fmt(row.get("pred_carbs"), 2),
                fe=_fmt(row.get("ref_fat"), 2),
                fp=_fmt(row.get("pred_fat"), 2),
                se=_fmt(row.get("ref_sodium"), 1),
                sp=_fmt(row.get("pred_sodium"), 1),
            )
        )
    lines.append("")
    fails = [r for r in per_row if r.get("status") != "ok"]
    if fails:
        lines.append("## Errors / skipped")
        lines.append("")
        for r in fails[:30]:
            lines.append(f"- `{r.get('ingredient_name')}`: {r.get('error', r.get('status'))}")
        lines.append("")
    lines.append("---")
    lines.append("")
    lines.append(
        "*MAE: mean absolute error; RMSE: root mean square error; "
        "MdAE: median absolute error; MAPE: mean absolute percent error with floor on |reference|; "
        "sMAPE: symmetric MAPE.*"
    )
    return "\n".join(lines)


def write_report(content: str, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")
