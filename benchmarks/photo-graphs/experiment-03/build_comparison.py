#!/usr/bin/env python3
"""Compare complete-branch fitting with the immutable experiment-02 archive."""
from datetime import datetime, timezone
from pathlib import Path
import csv
import hashlib
import html
import json
import subprocess

EXP = Path(__file__).resolve().parent
BASE = EXP.parent / "experiment-02"
ROOT = EXP.parents[2]


def load(path):
    return json.loads(path.read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_rows(path):
    with path.open() as source:
        return {row["id"]: row for row in csv.DictReader(source)}


def main():
    before = read_rows(BASE / "results/results.csv")
    after = read_rows(EXP / "results/results.csv")
    provenance = load(EXP / "provenance.json")
    catalog = load(EXP.parent / "experiment-01/catalog.json")
    assert set(before) == set(after) == {c["id"] for c in catalog["cases"]}
    assert len(after) == 33
    rows = []
    for id, a in after.items():
        b = before[id]
        old = load(BASE / "results/raw" / (id + ".json"))
        new = load(EXP / "results/raw" / (id + ".json"))
        assert new["status"] == "completed" and new["meaningful_page"]
        assert not new["console_errors"] and new["rendering"]["panel_hidden"]
        assert len(new["models"]) == len(new["trace_coverage"])
        assert all(c == 1 for c in new["trace_coverage"])
        assert all(len(m["samples"]) == 801 for m in new["models"])
        row = {
            "id": id, "collection": a["collection"],
            "before_pass": b["full_fidelity_pass"], "after_pass": a["full_fidelity_pass"],
            "before_families": ";".join(m["family"] for m in old["models"]),
            "after_families": ";".join(m["family"] for m in new["models"]),
            "before_branches": b["output_branches"], "after_branches": a["output_branches"],
            "expected_branches": a["expected_branches"],
            "before_canvas_p95_px": b["canvas_photo_bidirectional_p95_px"],
            "after_canvas_p95_px": a["canvas_photo_bidirectional_p95_px"],
            "before_reference_coverage": b["canvas_reference_coverage_10px"],
            "after_reference_coverage": a["canvas_reference_coverage_10px"],
            "before_model_sample_counts": ";".join(str(len(m["samples"])) for m in old["models"]),
            "after_model_sample_counts": ";".join(str(len(m["samples"])) for m in new["models"]),
            "after_trace_domain_coverage_min": min(new["trace_coverage"]),
            "all_branch_inputs_unchanged": new["fit_branches"] == old["fit_branches"],
            "all_models_unchanged": new["models"] == old["models"],
        }
        rows.append(row)
    with (EXP / "results/comparison.csv").open("w", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    original = load(BASE / "results/summary.json")
    current = load(EXP / "results/summary.json")
    groups = {k: {"before": original["groups"][k], "after": v} for k, v in current["groups"].items()}
    model_changes = [r for r in rows if not r["all_models_unchanged"]]
    outcome_changes = [r for r in rows if r["before_pass"] != r["after_pass"]]
    regressions = [r["id"] for r in rows if r["before_pass"] == "True" and r["after_pass"] != "True"]
    comparison = {
        "cases": len(rows), "groups": groups,
        "all_branch_inputs_unchanged": sum(r["all_branch_inputs_unchanged"] for r in rows),
        "all_models_unchanged": sum(r["all_models_unchanged"] for r in rows),
        "complete_trace_domain_cases": len(rows),
        "changed_models": model_changes, "changed_outcomes": outcome_changes,
        "regressions": regressions,
    }
    (EXP / "results/comparison.json").write_text(json.dumps(comparison, indent=2) + "\n")

    trees = {}
    for name, expected in provenance["baseline_trees_before"].items():
        trees[name] = subprocess.check_output(["git", "rev-parse", "HEAD:benchmarks/photo-graphs/" + name], cwd=ROOT, text=True).strip()
        assert trees[name] == expected
        subprocess.run(["git", "diff", "--exit-code", provenance["baseline_archive_commit"], "--", "benchmarks/photo-graphs/" + name], cwd=ROOT, check=True)
    assert sha(EXP.parent / "experiment-01/catalog.json") == provenance["catalog_sha256"]
    inputs = {i["id"]: i["sha256"] for i in provenance["inputs"]}
    for c in catalog["cases"]:
        assert sha(ROOT / c["image"].removeprefix("/course/")) == inputs[c["id"]]
    for name, expected in provenance["source_files"].items():
        assert sha(ROOT / name) == expected
    provenance.update(completed_utc=datetime.now(timezone.utc).isoformat(),
                      browser=load(EXP / "results/browser.json"),
                      baseline_trees_after=trees, baselines_preserved=True,
                      source_and_input_hashes_verified=True)
    (EXP / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")

    table = "\n".join(
        f"| {name} | {g['before']['fidelity_pass']}/{g['before']['fidelity_evaluable']} | "
        f"{g['after']['fidelity_pass']}/{g['after']['fidelity_evaluable']} |"
        for name, g in groups.items())
    changes = "\n".join(
        f"| {r['id']} | {r['before_families']} -> {r['after_families']} | "
        f"{float(r['before_canvas_p95_px']):.1f} -> {float(r['after_canvas_p95_px']):.1f} | "
        f"{float(r['before_reference_coverage']):.1%} -> {float(r['after_reference_coverage']):.1%} | "
        f"{r['before_pass']} -> {r['after_pass']} |" for r in model_changes)
    failures = "\n".join("- " + id for id, r in after.items() if r["full_fidelity_pass"] == "False")
    report = f"""# Complete-branch fitting: experiment 03

The fitter previously allowed candidates to score on only the points where they
were defined. A short flat fragment could win while omitting a traced steep end.
The correction requires every supplied trace point, rejects an interior pole,
and blocks confirmation if the native sample domain is incomplete.

All 33 original images completed the photo-to-native-canvas workflow.
Changed model records: {len(model_changes)}; changed fidelity outcomes: {len(outcome_changes)};
regressions of previously passing cases: {len(regressions)}.

Open the [paired gallery](gallery.html), [CSV](results/comparison.csv),
[raw observations](results/raw/), or [protocol](PROTOCOL.md).

## Comparison with experiment 02

| Collection | Before fidelity passes | After fidelity passes |
| --- | --- | --- |
{table}

The thresholds, reference geometry, axis calibration, guide strokes and image
files are unchanged. One sparse-point image has no continuous reference and
stays excluded from the fidelity denominator. Domain coverage is a separate
check: it does not establish shape accuracy.

| Changed image | Model families | Canvas/photo p95 pixels | Reference coverage | Fidelity flag |
| --- | --- | --- | --- | --- |
{changes}

All branch inputs are identical in {comparison['all_branch_inputs_unchanged']}/33 paired runs.
Complete model records are identical in {comparison['all_models_unchanged']}/33.
Every new model is finite at all supplied trace x-coordinates and all 801 sampled
domain positions. All 33 cases pass the separate rendering/model diagnostic.
These checks establish complete domain transfer; remaining geometric failures
are reported below rather than counted as recognition successes.

## Remaining fidelity failures

{failures}

## Verification and evidence

- Source: `{provenance['source_commit']}`; comparison source: `{provenance['comparison_source_commit']}`.
- Preconditions: 80 branch browser assertions, 71 confirmation-state browser assertions, and 13 unit tests passed. Desktop and original mobile layout (390 by 844) were exercised. Application console errors: zero.
- [GitHub CI](https://github.com/samhilkey/pl-ucb-sam-test-course/actions/runs/38976231829) passed on the recorded source.
- The [analytic negative control](results/fit-coverage-control.json) reproduces partial tangent fits on both outer branches of a two-pole rational curve: 61/81 finite trace points and 13/17 native samples before, 81/81 and 17/17 after.
- The source/input hashes and both previous experiment trees were checked unchanged. See [provenance](provenance.json) and [screenshot hashes](results/evidence-manifest.json).
- [Gallery browser QA](results/gallery-qa.json) verifies 33 entries, all 132 linked images loaded, no mobile horizontal overflow at 390 by 844, and zero console errors.
- The additional user-supplied three-branch photo was checked locally before and after. Its original image, trace coordinates, model data, and screenshots are excluded from the repository.
- Experiment-02 native grading probes remain historical evidence for that source; they were not rerun or presented as new experiment-03 results. This replay captures native state and gradeable serialization through confirmation.

## Limits

This is a reference-guided development benchmark: 33 related images from 15
drawings, including six real images from four problem IDs. References on real
and AI-generated paper-style photos are approximate. Batch photo panels use
temporary CSS expansion. No automatic axes, OCR, LLM recognition, student
usability, learning effects, or mathematical correctness is evaluated.
Complete models can still smooth corners or distort shapes. Native function
validation, including the overlapping-x restriction, is unchanged.
"""
    (EXP / "REPORT.md").write_text(report)

    sections = []
    for r in rows:
        id, a = r["id"], after[r["id"]]
        flag = "PASS" if r["after_pass"] == "True" else "FAIL" if r["after_pass"] == "False" else "AMBIGUOUS"
        pictures = [
            ("Experiment 02 canvas", f"../experiment-02/results/evidence/{id}--canvas.png"),
            ("New photo proposal", f"results/evidence/{id}--photo.png"),
            ("Reference pink; models orange; extracted ink cyan", f"results/overlays/{id}.jpg"),
            ("Experiment 03 native canvas", f"results/evidence/{id}--canvas.png"),
        ]
        figures = "".join(f'<figure><a href="{p}"><img loading="lazy" src="{p}" alt="{html.escape(label)}"></a><figcaption>{html.escape(label)}</figcaption></figure>' for label, p in pictures)
        metric = f"{float(r['after_canvas_p95_px']):.1f} px" if r["after_canvas_p95_px"] else "no continuous reference"
        changed = " · MODEL CHANGED" if not r["all_models_unchanged"] else ""
        sections.append(f'<details id="{id}"><summary><b>{flag}</b> · {html.escape(id)}{changed} · {metric}</summary>'
                        f'<p>Model families: {html.escape(r["before_families"])} → {html.escape(r["after_families"])}. '
                        f'Branches: {r["before_branches"]} → {r["after_branches"]}; expected {r["expected_branches"]}. '
                        f'Every supplied trace point has a finite model value.<br>{html.escape(a["expression"])}</p>'
                        f'<div class="images">{figures}</div><p><a href="results/raw/{id}.json">New raw observation</a></p></details>')
    page = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Complete-branch fitting · Experiment 03</title><link rel="icon" href="data:,"><style>
body{font:16px/1.5 system-ui,sans-serif;max-width:1500px;margin:40px auto;padding:0 20px;color:#19212a;background:#fbfaf7}
summary{cursor:pointer;padding:15px 0}details{border-top:1px solid #bcc4c7;padding-bottom:10px}
a{color:#125a86}figure{margin:0;min-width:0}img{max-width:100%;max-height:620px;object-fit:contain;background:white}
figcaption{font-size:13px;color:#47515c}.images{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
@media(max-width:850px){.images{grid-template-columns:1fr}}</style>
<h1>Complete-branch fitting · Experiment 03</h1>
<p>The same 33 photos and tracing guides, before and after requiring complete model domains.
Assisted-input diagnostics; approximate references. Finite model values alone do not establish fidelity.</p>
<p><a href="REPORT.md">Report</a> · <a href="PROTOCOL.md">Protocol</a> · <a href="results/comparison.csv">Paired measurements</a></p>
''' + "".join(sections) + "</html>\n"
    (EXP / "gallery.html").write_text(page)
    evidence = [{"file": p.name, "bytes": p.stat().st_size, "sha256": sha(p)}
                for p in sorted((EXP / "results/evidence").glob("*.png"))]
    (EXP / "results/evidence-manifest.json").write_text(json.dumps(evidence, indent=2) + "\n")
    print(json.dumps({k: v for k, v in comparison.items() if k != "groups"}, indent=2))


if __name__ == "__main__":
    main()
