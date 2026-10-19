# Shape-preserving photo input: experiment 04

This experiment compares merged master `547801c`
with feature commit `ccada8f` using the same 33
images, calibrated axes, operator tracing guides and thresholds. Both runs use
the merged PR3 dialog in its native layout, without CSS overrides. Source JS is
routed from archived commit snapshots; the question, backend and CSS are unchanged.
Experiments 01–03 remain byte-for-byte unchanged.

| Collection | Before: fit | After: traced shape |
| --- | --- | --- |
| controlled | 24/24 | 24/24 |
| paper-style | 2/3 | 3/3 |
| real | 2/5 | 2/5 |

New passes: paper--03-cubic-graph-paper.
Regressions from pass to fail: none. This statement
concerns threshold outcomes, not every numerical error measurement.
All 66 runs completed, retained every guided branch and covered the full input
domain, with zero application console errors. Rendering agreement and image
fidelity are separate measurements.

| Non-controlled case | Before canvas p95 (photo px) | After | After full pass |
| --- | --- | --- | --- |
| paper--01-parabola-plain-paper | 5.04 | 5.78 | True |
| paper--02-v-shaped-notebook-paper | 5.53 | 3.59 | True |
| paper--03-cubic-graph-paper | 12.05 | 4.09 | True |
| real--01-multiple-lines-graph-paper | 4.79 | 4.78 | True |
| real--02-conflicting-equation-labels | 11.29 | 23.21 | False |
| real--03-line-missing-origin | 1.91 | 8.18 | True |
| real--04-piecewise-curved-section | 43.73 | 27.56 | False |
| real--06-piecewise-graph-paper | 21.70 | 13.87 | False |

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
10 trace branches its final arithmetic x exceeds the exact
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
