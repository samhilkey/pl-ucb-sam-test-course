# Experiment 04 protocol

Compare the merged PR3 UI with its mathematical-fitting default against the
shape-preserving feature. The source commits, JS snapshots, catalog and input
hashes are recorded in provenance.json. Snapshots come from the exact Git blobs
and are checked again when the report is built. No research branch is merged
into the production course.

## Fixed inputs and outcomes

- Replay experiment-01/catalog.json unchanged: 33 images, 15 drawings, the same
  axis values and marker coordinates, separate tracing guides and search width.
- 24 controlled conditions, three generated paper-style examples and six real
  examples from four problem IDs. Real-05 is diagnostic only, without a
  continuous reference; full-fidelity denominator is 32.
- Both builds use the actual PR3 dialog at 1600 by 2200, without the historical
  benchmark's CSS expansion. Screen pointer positions are calculated from the
  actual photo bounding box and native image dimensions.
- Browser routing serves the archived star-fit.js, star-photo.js and pl-sketch.js
  snapshot for each mode. The question, Python backend and CSS are identical.
- Baseline retains automatic mathematical fitting. Trace uses the new default
  on unsmoothed ink, simplification at 1.25 photo pixels, and native corner
  support anchors of at most 12 SVG pixels and one quarter of adjacent edges.
- Proposal sampling requests 801 uniformly spaced x positions per branch for both
  modes. Ten trace branches have 800 finite samples because the final arithmetic
  x exceeds the exact domain endpoint by less than 1e-12 graph units. Raw data
  remains unchanged; native transfer retains both exact endpoints. This is
  checked and recorded in comparison.json. Native paths are sampled by arc length. The frozen analyzer
  uses exact point-to-segment distances and the existing 0.8-pixel resampling.
- Full fidelity: correct branch count; both proposal/photo and canvas/photo
  bidirectional p95 <= 10 photo pixels normalized to longest image side 900;
  both reference coverages >= 90% within 10 pixels.
- Proposal/native rendering p95 <= 3 SVG pixels is a separate diagnostic.
  Retained-vertex interpolation residual is not an image-fidelity metric.
- Require completed confirmation, full trace domain coverage, expected guided
  branch count, meaningful question content and zero application console errors.
  Packaged-font decoding warnings are archived separately.

## Reproduce

Use the production course checkout with the unchanged backend/question/CSS at
the recorded commits, PrairieLearn on port 3000, course loaded from disk, and
Chrome plus the Playwright CLI. Run from the research worktree root. The helper
creates a separate browser session and closes it on completion.

In separate terminals, start the two write-once collectors:

```bash
python3 benchmarks/photo-graphs/experiment-04/serve_experiment.py --mode baseline --port 8768
python3 benchmarks/photo-graphs/experiment-04/serve_experiment.py --mode trace --port 8770
```

Then replay modes sequentially:

```bash
export PL_PHOTO_TEST_CLI=/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh
node benchmarks/photo-graphs/experiment-04/run_experiment.cjs baseline
node benchmarks/photo-graphs/experiment-04/run_experiment.cjs trace
python3 benchmarks/photo-graphs/experiment-04/run_analysis.py --container sam-test-course
python3 benchmarks/photo-graphs/experiment-04/build_report.py
```

Collectors reject overwriting a saved observation; the driver resumes missing
IDs only. Repeat experiments in a new archive directory instead of replacing
these observations. The analysis helper packages a disposable copy inside
/tmp/photo-trace-analysis in the existing container, where NumPy and Pillow are
installed. Only image filesystem prefixes in that disposable catalog copy are
translated; the archived catalog and all numbers are unchanged. It copies new
CSV, summary and reference-overlay files back, leaving raw observations intact.

The gallery uses relative URLs. Open gallery.html through a local HTTP server
whose root includes benchmarks/photo-graphs, or open it as a local file. The
report builder verifies source snapshots, canonical catalog/image hashes, and
experiments 01–03 against their original Git trees, then records an evidence
manifest. It never writes to those earlier archives.

## Limits

These reference-assisted guides isolate engineering behavior and do not measure
automatic graph recognition, unassisted student work or learning outcomes. The
controlled examples and generated paper-style examples are not real student
photos. Some real references are ambiguous, and conditions share drawings.
Do not interpret image counts as independent student samples. Processing times
exclude upload choice, axis placement, tracing and confirmation by a student.

Confirmation regression and native edit/Save & Grade checks run separately in
the production tests. Passing those state checks alone is not evidence of
improved photo fidelity. No private user upload is included in this archive.
