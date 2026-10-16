# Photo branch preservation: experiment 02

The same 33-image development benchmark was replayed against the branch-preservation fix.
All 33/33 cases completed upload through confirmation and native canvas rendering.
There were 5 changed fidelity outcomes and 0 regressions of previously passing images.

Open the [paired visual gallery](gallery.html), [comparison CSV](results/comparison.csv),
[new measurements](results/results.csv), or [protocol](PROTOCOL.md).

## Before and after

| Collection | Original fidelity passes | Fixed-build fidelity passes | Correct branch counts, before -> after |
| --- | --- | --- | --- |
| controlled | 20/24 | 24/24 | 20 -> 24 / 24 |
| paper-style | 2/3 | 2/3 | 3 -> 3 / 3 |
| real | 1/5 | 2/5 | 3 -> 5 / 6 |

Fidelity requires branch-count preservation, photo/model and photo/canvas bidirectional
p95 distance <=10 pixels after normalizing the image's longest edge to 900 pixels,
and >=90% reference coverage. The sparse-point real image has no continuous reference
and remains excluded from the fidelity denominator. Rendering has its separate <=3 SVG pixel diagnostic.

### Changed outcomes

| Image | Output branches, before -> after | Canvas/photo p95 pixels | Reference coverage |
| --- | --- | --- | --- |
| controlled--06-reciprocal--clean | 1 -> 2 | 425.4 -> 1.6 | 50.0% -> 100.0% |
| controlled--06-reciprocal--perspective | 1 -> 2 | 384.3 -> 1.3 | 50.8% -> 100.0% |
| controlled--06-reciprocal--shadow | 1 -> 2 | 425.5 -> 1.5 | 50.0% -> 100.0% |
| controlled--06-reciprocal--blur-dim | 1 -> 2 | 382.5 -> 1.2 | 49.5% -> 100.0% |
| real--01-multiple-lines-graph-paper | 1 -> 2 | 161.3 -> 4.8 | 53.7% -> 100.0% |

The improvement is supported by the paired photographic and rendered-geometry measurements.
Passing the confirmation-state regression by itself establishes only state handling.
All six formerly dropped second branches are now present. The second real multi-line
photo still fails fidelity (about 11.3 pixels p95 against the 10-pixel threshold),
despite retaining both branches. Rendering passed its separate diagnostic in all 33 cases.

### Remaining fidelity failures

- paper--03-cubic-graph-paper
- real--02-conflicting-equation-labels
- real--04-piecewise-curved-section
- real--06-piecewise-graph-paper

These still require inspection for domain truncation, global fitting distortion, or local corner smoothing.
The sparse-point photograph remains an ambiguity probe requiring a task-definition decision.

## What changed

- Every extracted trace is fitted independently and remains a separate native spline.
- The photo overlay and equation list show all proposed branches. A branch selector scopes family/degree edits.
- A failed later branch blocks the complete proposal. Invalid extracted strokes produce an explicit error.
- Confirmation still invalidates when a photo, calibration, trace, or fit setting changes.
- The native function-input validator still rejects overlapping x-ranges; preserving multiple curves does not establish that a submission is a valid function.

## Verification and reproducibility

- Production source: `1e29cc188f17a7044c026d8830ba69915146b0ac`; comparison base: `b360313485032538a70846d3b91cbf443f8abd4b`.
- Initial baseline source: `0917ee49e37e01c65db583a7d3db0df6a3ea7a0b`; frozen dataset commit: `d600ab07391e99bb2cc5b2d60646dc4fb4870a4b`.
- Preconditions: 71 confirmation assertions, 65 branch assertions including the original mobile layout, and three atomic-transfer unit tests passed.
- The negative control serves the previous master's three application scripts and fails exactly because only the first branch reaches the fitter. See [negative-control.json](results/negative-control.json).
- The branch-aware analyzer reproduces all eight checked baseline metrics for all 33 original raw observations, with no numerical differences. See [analysis-compatibility.json](results/analysis-compatibility.json).
- First-branch extracted points are identical in 33/33 paired runs; complete first-branch model records are identical in 33/33.
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
