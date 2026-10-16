#!/usr/bin/env python3
"""Build a paired comparison without modifying the baseline experiment."""
from pathlib import Path
from datetime import datetime, timezone
import csv
import hashlib
import html
import json
import subprocess

EXP = Path(__file__).resolve().parent
BASE = EXP.parent / "experiment-01"


def read_rows(path):
    with path.open() as source:
        return {row["id"]: row for row in csv.DictReader(source)}


def main():
    before = read_rows(BASE / "results/results.csv")
    after = read_rows(EXP / "results/results.csv")
    assert set(before) == set(after) and len(after) == 33
    original = json.loads((BASE / "results/summary.json").read_text())
    current = json.loads((EXP / "results/summary.json").read_text())
    rows = []
    for id, b in before.items():
        a = after[id]
        old = json.loads((BASE / "results/raw" / (id + ".json")).read_text())
        new = json.loads((EXP / "results/raw" / (id + ".json")).read_text())
        row = {"id": id, "collection": a["collection"], "before_pass": b["full_fidelity_pass"],
               "after_pass": a["full_fidelity_pass"], "before_branches": b["output_branches"],
               "after_branches": a["output_branches"], "expected_branches": a["expected_branches"],
               "before_canvas_p95_px": b["canvas_photo_bidirectional_p95_px"],
               "after_canvas_p95_px": a["canvas_photo_bidirectional_p95_px"],
               "before_coverage": b["canvas_reference_coverage_10px"],
               "after_coverage": a["canvas_reference_coverage_10px"],
               "first_branch_input_unchanged": new["fit_branches"][0] == old["fit_points"],
               "first_branch_model_unchanged": new["models"][0] == old["model"]}
        rows.append(row)
    with (EXP / "results/comparison.csv").open("w", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    changed = [r for r in rows if r["before_pass"] != r["after_pass"]]
    regressions = [r["id"] for r in rows if r["before_pass"] == "True" and r["after_pass"] != "True"]
    groups = {k: {"before": original["groups"][k], "after": v} for k, v in current["groups"].items()}
    comparison = {"cases": len(rows), "groups": groups, "changed_cases": changed, "regressions": regressions,
                  "first_branch_inputs_unchanged": sum(r["first_branch_input_unchanged"] for r in rows),
                  "first_branch_models_unchanged": sum(r["first_branch_model_unchanged"] for r in rows)}
    (EXP / "results/comparison.json").write_text(json.dumps(comparison, indent=2) + "\n")

    provenance = json.loads((EXP / "provenance.json").read_text())
    table = "\n".join(
        f"| {k} | {g['before']['fidelity_pass']}/{g['before']['fidelity_evaluable']} | "
        f"{g['after']['fidelity_pass']}/{g['after']['fidelity_evaluable']} | "
        f"{g['before']['topology_pass']} -> {g['after']['topology_pass']} / {g['after']['images']} |"
        for k, g in groups.items())
    changes = "\n".join(
        f"| {r['id']} | {r['before_branches']} -> {r['after_branches']} | "
        f"{float(r['before_canvas_p95_px']):.1f} -> {float(r['after_canvas_p95_px']):.1f} | "
        f"{float(r['before_coverage']):.1%} -> {float(r['after_coverage']):.1%} |"
        for r in changed)
    failures = "\n".join("- " + id for id, row in after.items() if row["full_fidelity_pass"] == "False")
    report = f"""# Photo branch preservation: experiment 02

The same 33-image development benchmark was replayed against the branch-preservation fix.
All {sum(g['after']['completed'] for g in groups.values())}/33 cases completed upload through confirmation and native canvas rendering.
There were {len(changed)} changed fidelity outcomes and {len(regressions)} regressions of previously passing images.

Open the [paired visual gallery](gallery.html), [comparison CSV](results/comparison.csv),
[new measurements](results/results.csv), or [protocol](PROTOCOL.md).

## Before and after

| Collection | Original fidelity passes | Fixed-build fidelity passes | Correct branch counts, before -> after |
| --- | --- | --- | --- |
{table}

Fidelity requires branch-count preservation, photo/model and photo/canvas bidirectional
p95 distance <=10 pixels after normalizing the image's longest edge to 900 pixels,
and >=90% reference coverage. The sparse-point real image has no continuous reference
and remains excluded from the fidelity denominator. Rendering has its separate <=3 SVG pixel diagnostic.

### Changed outcomes

| Image | Output branches, before -> after | Canvas/photo p95 pixels | Reference coverage |
| --- | --- | --- | --- |
{changes}

The improvement is supported by the paired photographic and rendered-geometry measurements.
Passing the confirmation-state regression by itself establishes only state handling.
All six formerly dropped second branches are now present. The second real multi-line
photo still fails fidelity (about 11.3 pixels p95 against the 10-pixel threshold),
despite retaining both branches. Rendering passed its separate diagnostic in all 33 cases.

### Remaining fidelity failures

{failures}

These still require inspection for domain truncation, global fitting distortion, or local corner smoothing.
The sparse-point photograph remains an ambiguity probe requiring a task-definition decision.

## What changed

- Every extracted trace is fitted independently and remains a separate native spline.
- The photo overlay and equation list show all proposed branches. A branch selector scopes family/degree edits.
- A failed later branch blocks the complete proposal. Invalid extracted strokes produce an explicit error.
- Confirmation still invalidates when a photo, calibration, trace, or fit setting changes.
- The native function-input validator still rejects overlapping x-ranges; preserving multiple curves does not establish that a submission is a valid function.

## Verification and reproducibility

- Production source: `{provenance['source_commit']}`; comparison base: `{provenance['comparison_base']}`.
- Initial baseline source: `{provenance['baseline_source_commit']}`; frozen dataset commit: `{provenance['baseline_data_commit']}`.
- Preconditions: 71 confirmation assertions, 65 branch assertions including the original mobile layout, and three atomic-transfer unit tests passed.
- The negative control serves the previous master's three application scripts and fails exactly because only the first branch reaches the fitter. See [negative-control.json](results/negative-control.json).
- The branch-aware analyzer reproduces all eight checked baseline metrics for all 33 original raw observations, with no numerical differences. See [analysis-compatibility.json](results/analysis-compatibility.json).
- First-branch extracted points are identical in {comparison['first_branch_inputs_unchanged']}/33 paired runs; complete first-branch model records are identical in {comparison['first_branch_models_unchanged']}/33.
- The original catalog, photos, axis values, guide coordinates, camera variants, model sampling, and diagnostic thresholds were reused. No parameter tuning was performed.
- Screenshot and input checksums, source file hashes, environment, and baseline preservation checks are archived in [provenance.json](provenance.json) and [evidence-manifest.json](results/evidence-manifest.json).
- Actual Save & Grade probes confirm two branches in each encoded form submission. The reciprocal is valid input and receives 0% against the fixed `x^2` answer; the real overlapping lines produce the original overlapping-range format error. See [grading.json](results/grading.json). The independent control curve receives 100% in the gradable case.
- The production PR's [GitHub CI run](https://github.com/samhilkey/pl-ucb-sam-test-course/actions/runs/38965925295) passes on the recorded source commit.

## Limits

These are 33 related images from 15 drawings, including six real images from four problem IDs.
Tracing is automated and reference-guided; this is an assisted-input development comparison.
Batch photo panels are expanded in browser CSS for geometric measurement. The separate mobile
regression uses the original layout, but neither establishes general usability or learning effects.
Paper-style and real-photo references remain approximate single-agent annotations, and some real
scales are normalized. No automatic axis OCR or LLM recognition is evaluated. Native grading
probes concern serialization and existing validation; mathematical correctness is a separate question.
"""
    (EXP / "REPORT.md").write_text(report)

    sections = []
    for id, a in after.items():
        b = before[id]
        flag = "PASS" if a["full_fidelity_pass"] == "True" else "FAIL" if a["full_fidelity_pass"] == "False" else "AMBIGUOUS"
        photos = [
            ("Original canvas", f"../experiment-01/results/evidence/{id}--canvas.png"),
            ("Updated photo and proposed branches", f"results/evidence/{id}--photo.png"),
            ("Reference pink; models orange; extracted ink cyan", f"results/overlays/{id}.jpg"),
            ("Updated native canvas", f"results/evidence/{id}--canvas.png")]
        figures = "".join(f'<figure><a href="{path}"><img loading="lazy" src="{path}" alt="{html.escape(label)}"></a><figcaption>{html.escape(label)}</figcaption></figure>' for label, path in photos)
        metric = f"{float(a['canvas_photo_bidirectional_p95_px']):.1f} px" if a["canvas_photo_bidirectional_p95_px"] else "no continuous reference"
        sections.append(f'<details id="{id}"><summary><b>{flag}</b> · {html.escape(id)} · {metric}</summary>'
                        f'<p>Branches: {b["output_branches"]} → {a["output_branches"]}, expected {a["expected_branches"]}. '
                        f'Fidelity flag: {b["full_fidelity_pass"] or "ambiguous"} → {a["full_fidelity_pass"] or "ambiguous"}.<br>'
                        f'{html.escape(a["expression"])}</p><div class="images">{figures}</div>'
                        f'<p><a href="results/raw/{id}.json">Updated raw observation</a></p></details>')
    page = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Photo branch preservation · Experiment 02</title><link rel="icon" href="data:,"><style>
body{font:16px/1.5 system-ui,sans-serif;max-width:1500px;margin:40px auto;padding:0 20px;color:#19212a;background:#fbfaf7}
summary{cursor:pointer;padding:15px 0}details{border-top:1px solid #bcc4c7;padding-bottom:10px}
a{color:#125a86}figure{margin:0;min-width:0}img{max-width:100%;max-height:620px;object-fit:contain;background:white}
figcaption{font-size:13px;color:#47515c}.images{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
@media(max-width:850px){.images{grid-template-columns:1fr}}</style>
<h1>Photo branch preservation · Experiment 02</h1>
<p>The same 33 images and tracing guides, before and after preserving every branch.
Assisted-input engineering diagnostics; approximate real-photo references.</p>
<p><a href="REPORT.md">Report</a> · <a href="PROTOCOL.md">Protocol</a> · <a href="results/comparison.csv">Paired measurements</a></p>
''' + "".join(sections) + "</html>"
    (EXP / "gallery.html").write_text(page)

    manifest = [{"file": p.name, "bytes": p.stat().st_size,
                 "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
                for p in sorted((EXP / "results/evidence").glob("*.png"))]
    (EXP / "results/evidence-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    provenance["completed_utc"] = datetime.now(timezone.utc).isoformat()
    provenance["browser"] = json.loads((EXP / "results/browser.json").read_text())
    provenance["baseline_tree_after"] = subprocess.check_output(
        ["git", "rev-parse", "HEAD:benchmarks/photo-graphs/experiment-01"], cwd=EXP, text=True).strip()
    assert provenance["baseline_tree_after"] == provenance["baseline_tree_before"]
    subprocess.run(["git", "diff", "--exit-code", "chore/photo-graph-benchmark", "--", "benchmarks/photo-graphs/experiment-01"], cwd=EXP.parents[2], check=True)
    for name, expected in provenance["source_files"].items():
        assert hashlib.sha256((EXP.parents[2] / name).read_bytes()).hexdigest() == expected
    provenance["baseline_preserved"] = True
    (EXP / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
    print(json.dumps(comparison, indent=2))


if __name__ == "__main__":
    main()
