# Experiment 03: complete-branch fitting

Purpose: check that rejecting fits with incomplete domains retains steep branch
ends without breaking the previously passing 33-image development benchmark.
This compares source `1e29cc1` (experiment 02) with source `79053b2`.

## Fixed inputs and isolation

Use the exact experiment-01 catalog, 33 image files, crops, numerical scales,
axis markers, guide strokes, order, default fitting settings, sampling counts,
and thresholds used in experiment 02. Their checksums are in provenance.
Experiments 01 and 02 are immutable. Every new result is written under
experiment-03 on the separate research branch; benchmark files stay out of the
production PR. The live course and research checkout have identical recorded
application-file hashes.

Preconditions passed on the recorded production source: 71 confirmation-state
browser assertions, 80 multi-branch browser assertions including three steep
branches and the original mobile layout, 13 fitter/atomic-transfer unit tests,
JavaScript syntax/style checks, and GitHub CI. The branch regression result is
archived in results; confirmation/unit counts are recorded in provenance.

## Negative control

`check_fit_coverage.cjs` loads both committed fitter versions in Node VM contexts.
It fits 81 uniformly spaced points on each outer branch of
`y = 0.8 / (1 - x^2)` over [-5, -1.08] and [1.08, 5]. The earlier fitter must
choose a model undefined on some supplied points. The corrected model must
be finite at every supplied point and produce all 17 native transfer samples.
This control contains no user-supplied photograph or derived coordinates.

## Browser replay

Repeat the experiment-02 upload -> axes -> each guide stroke -> Read my trace
-> confirm -> native SVG capture flow in Chrome using Playwright CLI, because
the Browser plugin is unavailable. Keep the same 1600 by 2200 batch viewport
and temporary CSS expansion of the photo panel. These adaptations are for
measurement; original-layout desktop/mobile checks are separate.

Wrap the public fit and transfer APIs without changing their behavior. Record
all extracted branches, models, 801 domain-position samples per model, actual
native SVG paths, state, gradeable data, screenshots, timing, and console errors.
Also record the fraction of supplied trace x-coordinates with a finite model
value. This domain-coverage check is distinct from geometric fidelity.
Stop on a failed image case. Existing raw results are never overwritten.

## Analysis and comparison

Reuse the unchanged experiment-02 analyzer with explicit experiment-03 input
and output directories. Thresholds remain: photo/model and photo/canvas
bidirectional p95 <=10 pixels after scaling the longest photo edge to 900,
reference coverage >=90%, correct branch count, and a separate rendering/model
p95 <=3 SVG pixels diagnostic. The sparse-point case remains excluded from
continuous fidelity. Do not infer fidelity improvement from state or domain
coverage assertions alone.

Compare every extracted branch and complete model record with experiment 02,
and report collection results, changed models, changed outcomes, regressions,
and remaining failures. Verify both previous experiment directory trees and
all input/source hashes are unchanged. Inspect the gallery through HTTP in a
real browser and verify its images load without application errors.

## Reproduction

Use a new experiment directory for another run; the archived raw results are
fixed. With the recorded source served on localhost:3000, start the collector:

```bash
python3 benchmarks/photo-graphs/experiment-03/serve_experiment.py
```

In another terminal, with Playwright CLI on PATH or PL_PHOTO_TEST_CLI set:

```bash
node benchmarks/photo-graphs/experiment-03/check_fit_coverage.cjs
node benchmarks/photo-graphs/experiment-03/run_experiment.cjs
```

Use the pinned Docker image in provenance, mounting the research worktree as
`/course`, to run the unchanged analyzer:

```bash
python3 benchmarks/photo-graphs/experiment-02/analyze_results.py \
  --raw-dir benchmarks/photo-graphs/experiment-03/results/raw \
  --output-dir benchmarks/photo-graphs/experiment-03/results
```

Then run `python3 benchmarks/photo-graphs/experiment-03/build_comparison.py`.

## Limits

These are reference-guided engineering checks, not independent recognition,
OCR, usability, learning, or mathematical-correctness evaluations. The 33 images
come from 15 drawings, with related variants and approximate annotations on
paper-style/real images. A complete model can still distort corners or fit the
wrong shape. Native function-input restrictions, including overlapping
x-ranges, are unchanged. Submission probes from experiment 02 are historical
evidence for that source; they were not rerun or attributed to experiment 03.
