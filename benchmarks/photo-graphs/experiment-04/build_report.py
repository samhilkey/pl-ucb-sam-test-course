#!/usr/bin/env python3
"""Verify provenance and publish the paired, reference-assisted comparison."""
from datetime import datetime, timezone
from pathlib import Path
import csv
import hashlib
import html
import json
import os
import subprocess

EXP = Path(__file__).resolve().parent
ROOT = EXP.parents[2]


def load(path):
    return json.loads(path.read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rows(path):
    with path.open() as source:
        return {r["id"]: r for r in csv.DictReader(source)}


def main():
    provenance = load(EXP / "provenance.json")
    catalog = load(EXP.parent / "experiment-01/catalog.json")
    before = rows(EXP / "baseline/results/results.csv")
    after = rows(EXP / "trace/results/results.csv")
    assert set(before) == set(after) == {c["id"] for c in catalog["cases"]}
    assert len(after) == 33
    assert sha(EXP.parent / "experiment-01/catalog.json") == provenance["catalog_sha256"]
    for case in catalog["cases"]:
        assert sha(ROOT / case["image"].removeprefix("/course/")) == provenance["inputs"][case["id"]]
    for name, tree in provenance["immutable_archives"].items():
        current = subprocess.check_output(["git", "rev-parse", "HEAD:benchmarks/photo-graphs/" + name], cwd=ROOT, text=True).strip()
        assert tree == current
        subprocess.run(["git", "diff", "--exit-code", provenance["archive_base_commit"], "--", "benchmarks/photo-graphs/" + name], cwd=ROOT, check=True)
    for mode in ["baseline", "trace"]:
        for name, digest in provenance["source_files"][mode].items():
            source = EXP / ("source-" + mode) / name
            assert sha(source) == digest
            original = subprocess.check_output(["git", "show", provenance[mode + "_source_commit"] + ":elements/pl-sketch/" + name], cwd=ROOT)
            assert hashlib.sha256(original).hexdigest() == digest
    for name, digest in provenance["unchanged_production_files"].items():
        for mode in ["baseline", "trace"]:
            body = subprocess.check_output(["git", "show", provenance[mode + "_source_commit"] + ":" + name], cwd=ROOT)
            assert hashlib.sha256(body).hexdigest() == digest
    comparison = []
    sections = []
    endpoint_rounding = []
    for case in catalog["cases"]:
        id = case["id"]
        a = after[id]
        b = before[id]
        raw = {mode: load(EXP / mode / "results/raw" / (id + ".json")) for mode in ["baseline", "trace"]}
        for mode, r in raw.items():
            assert r["status"] == "completed" and r["meaningful_page"]
            assert not r["console_errors"] and r["rendering"]["panel_hidden"]
            assert all(coverage == 1 for coverage in r["trace_coverage"])
            assert len(r["models"]) == len(case["guide_branches"])
            for index, m in enumerate(r["models"]):
                assert len(m["samples"]) in [800, 801]
                if len(m["samples"]) == 800:
                    candidate = m["lo"] + (m["hi"] - m["lo"]) * 800 / 800
                    assert m["family"] == "trace" and 0 < candidate - m["hi"] < 1e-12
                    assert m["hi"] == r["fit_branches"][index][-1][0]
                    endpoint_rounding.append({"mode": mode, "id": id, "branch": index + 1, "overshoot": candidate - m["hi"]})
            for suffix in ["--photo.png", "--canvas.png"]:
                assert (EXP / mode / "results/evidence" / (id + suffix)).stat().st_size > 100
        assert all(m["family"] == "trace" for m in raw["trace"]["models"])
        result = {
            "id": id, "collection": a["collection"],
            "before_pass": b.get("full_fidelity_pass", ""), "after_pass": a.get("full_fidelity_pass", ""),
            "expected_branches": a["expected_branches"],
            "before_branches": b["output_branches"], "after_branches": a["output_branches"],
            "before_model_photo_p95_px": b.get("photo_bidirectional_p95_px", ""),
            "after_model_photo_p95_px": a.get("photo_bidirectional_p95_px", ""),
            "before_canvas_p95_px": b.get("canvas_photo_bidirectional_p95_px", ""),
            "after_canvas_p95_px": a.get("canvas_photo_bidirectional_p95_px", ""),
            "before_reference_coverage": b.get("canvas_reference_coverage_10px", ""),
            "after_reference_coverage": a.get("canvas_reference_coverage_10px", ""),
            "before_rendering_p95_svg_px": b.get("rendering_bidirectional_p95_svg_px", ""),
            "after_rendering_p95_svg_px": a.get("rendering_bidirectional_p95_svg_px", ""),
        }
        comparison.append(result)
        status = "Diagnostic only" if not result["after_pass"] else "Pass" if result["after_pass"] == "True" else "Needs work"
        cells = []
        image = Path(case["image"].removeprefix("/course/"))
        original = os.path.relpath(ROOT / image, EXP)
        origin_label = {"controlled": "Controlled synthetic input", "paper-style": "AI-generated paper-style input", "real": "Real benchmark photo"}[case["collection"]]
        cells.append(f'<figure><img loading="lazy" src="{html.escape(original)}"><figcaption>{origin_label}</figcaption></figure>')
        for mode, label in [("baseline", "Before: mathematical fit"), ("trace", "After: keep traced shape")]:
            cells.append(f'<figure><img loading="lazy" src="{mode}/results/evidence/{id}--canvas.png"><figcaption>{label}</figcaption></figure>')
        metrics = f"Canvas error p95: {float(result['before_canvas_p95_px']):.2f} → {float(result['after_canvas_p95_px']):.2f} photo px" if result["after_canvas_p95_px"] else "No continuous reference; fidelity is not scored."
        sections.append(f'<details><summary>{html.escape(status + " · " + id)}</summary><p>{html.escape(metrics)}</p><div class="images">' + "".join(cells) + '</div><div class="images">' + "".join(f'<figure><img loading="lazy" src="{mode}/results/overlays/{id}.jpg"><figcaption>{mode}: reference (pink), proposal (orange), retained points (cyan)</figcaption></figure>' for mode in ["baseline", "trace"]) + f'</div><p><a href="baseline/results/raw/{id}.json">Before raw</a> · <a href="trace/results/raw/{id}.json">After raw</a></p></details>')
    with (EXP / "comparison.csv").open("w", newline="") as target:
        writer = csv.DictWriter(target, fieldnames=list(comparison[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(comparison)
    summaries = {mode: load(EXP / mode / "results/summary.json") for mode in ["baseline", "trace"]}
    regressions = [r["id"] for r in comparison if r["before_pass"] == "True" and r["after_pass"] == "False"]
    improvements = [r["id"] for r in comparison if r["before_pass"] == "False" and r["after_pass"] == "True"]
    increased_error = [r for r in comparison if r["after_canvas_p95_px"] and float(r["after_canvas_p95_px"]) > float(r["before_canvas_p95_px"]) + 1]
    comparison_json = {"cases": 33, "groups": {mode: s["groups"] for mode, s in summaries.items()}, "regressions": regressions, "improvements": improvements, "canvas_error_increased_over_1px": increased_error, "endpoint_rounding": endpoint_rounding, "rows": comparison}
    (EXP / "comparison.json").write_text(json.dumps(comparison_json, indent=2) + "\n")
    table = []
    for collection in summaries["baseline"]["groups"]:
        b = summaries["baseline"]["groups"][collection]
        a = summaries["trace"]["groups"][collection]
        table.append(f"| {collection} | {b['fidelity_pass']}/{b['fidelity_evaluable']} | {a['fidelity_pass']}/{a['fidelity_evaluable']} |")
    notable = []
    for r in comparison:
        if r["collection"] != "controlled" and r["after_canvas_p95_px"]:
            notable.append(f"| {r['id']} | {float(r['before_canvas_p95_px']):.2f} | {float(r['after_canvas_p95_px']):.2f} | {r['after_pass']} |")
    report = f"""# Shape-preserving photo input: experiment 04

This experiment compares merged master `{provenance['baseline_source_commit'][:7]}`
with feature commit `{provenance['trace_source_commit'][:7]}` using the same 33
images, calibrated axes, operator tracing guides and thresholds. Both runs use
the merged PR3 dialog in its native layout, without CSS overrides. Source JS is
routed from archived commit snapshots; the question, backend and CSS are unchanged.
Experiments 01–03 remain byte-for-byte unchanged.

| Collection | Before: fit | After: traced shape |
| --- | --- | --- |
{chr(10).join(table)}

New passes: {', '.join(improvements) or 'none'}.
Regressions from pass to fail: {', '.join(regressions) or 'none'}. This statement
concerns threshold outcomes, not every numerical error measurement.
All 66 runs completed, retained every guided branch and covered the full input
domain, with zero application console errors. Rendering agreement and image
fidelity are separate measurements.

| Non-controlled case | Before canvas p95 (photo px) | After | After full pass |
| --- | --- | --- | --- |
{chr(10).join(notable)}

The additional pass is a generated paper-style cubic, not a real student photo.
Real-photo passes remain 2/5. The conflicting-label example worsens from 11.29
to 23.21 photo pixels p95, and the missing-origin line rises from 1.91 to 8.18
while remaining within the pass threshold. The piecewise examples improve from
43.73 to 27.56 and 21.70 to 13.87, but still fail. Shape preservation is useful
for transcription and does not solve ink selection; optional mathematical fits
can still help clean line drawings. comparison.json also lists every canvas
error increase greater than one normalized photo pixel.

## Interpretation and limits

Full fidelity requires correct branch count, reference-to-proposal and
reference-to-canvas bidirectional p95 at most 10 normalized photo pixels, and
at least 90% reference coverage within 10 pixels for both. Native rendering
p95 at most 3 SVG pixels is recorded separately. Sparse-points case real-05
has no continuous reference and is excluded from the 32-image fidelity denominator.

The new default preserves unsmoothed detected ink with 1.25-photo-pixel
simplification and corner support anchors; it does not claim perfect recognition.
Axis calibration, operator guidance, ink confusion and hand wobble remain sources
of error. Mathematical fitting remains available per branch. Zero interpolation
residual for a traced model means agreement with its retained vertices, not with
the reference image. Runtime timings exclude student labor and are descriptive,
not a controlled performance study.

The evaluator requests 801 uniformly spaced candidate x positions. In
{len(endpoint_rounding)} trace branches its final arithmetic x exceeds the exact
domain endpoint by less than 1e-12 graph units; the domain guard rejects that
candidate, leaving 800 finite samples. Raw observations and metrics are retained
unchanged. Native transfer includes both exact endpoints, and every retained
trace vertex has a finite evaluation. This sampling detail is recorded in
comparison.json and does not remove a branch from the rendered canvas.

This is a reference-assisted engineering comparison, not an LLM evaluation or
student learning/usability study. The dataset has 33 conditions of 15 drawings;
the six real photos come from four problem IDs. No private user upload is included.

The initial baseline browser launch encountered a transient PrairieLearn Python
worker timeout. Its failing launch did not produce a scored observation. The
question recovered; the resumed baseline completed all 33 cases successfully.

## Inspect and reproduce

- Open [gallery.html](gallery.html) for input, before/after native canvases,
  reference overlays and raw observations.
- [comparison.csv](comparison.csv), [comparison.json](comparison.json).
- [provenance.json](provenance.json) records source and input hashes.
- See [PROTOCOL.md](PROTOCOL.md) for exact commands and stages.
"""
    (EXP / "REPORT.md").write_text(report)
    (EXP / "gallery.html").write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Photo shapes: before and after</title><style>body{font:16px system-ui;margin:2rem;color:#202830}details{border-top:1px solid #bbc;padding:1rem 0}summary{cursor:pointer;font-weight:650}.images{display:flex;gap:1rem;flex-wrap:wrap}figure{margin:0;flex:1;min-width:260px}img{width:100%;max-height:600px;object-fit:contain}figcaption{padding:.5rem 0}p{max-width:85ch}a{color:#075ca8}</style><h1>Photo input: keep the traced shape</h1><p>Same 33 images, axis calibration and guided strokes. Before: merged master mathematical fitting. After: shape-preserving default. This is a reference-assisted test; check the report for thresholds and limitations.</p><p><a href="REPORT.md">Report</a> · <a href="comparison.csv">Comparison CSV</a> · <a href="provenance.json">Provenance</a></p>' + "\n".join(sections) + '</html>')
    provenance.update(verified_utc=datetime.now(timezone.utc).isoformat(), baselines_preserved=True, source_and_input_hashes_verified=True, case_count=33)
    (EXP / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
    manifest = {str(p.relative_to(EXP)): sha(p) for p in sorted(EXP.rglob("*")) if p.is_file() and p.name != "manifest.json" and "__pycache__" not in p.parts}
    (EXP / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"groups": comparison_json["groups"], "improvements": improvements, "regressions": regressions}))


if __name__ == "__main__":
    main()
