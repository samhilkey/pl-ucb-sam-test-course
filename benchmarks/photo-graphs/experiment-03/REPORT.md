# Complete-branch fitting: experiment 03

The fitter previously allowed candidates to score on only the points where they
were defined. A short flat fragment could win while omitting a traced steep end.
The correction requires every supplied trace point, rejects an interior pole,
and blocks confirmation if the native sample domain is incomplete.

All 33 original images completed the photo-to-native-canvas workflow.
Changed model records: 1; changed fidelity outcomes: 0;
regressions of previously passing cases: 0.

Open the [paired gallery](gallery.html), [CSV](results/comparison.csv),
[raw observations](results/raw/), or [protocol](PROTOCOL.md).

## Comparison with experiment 02

| Collection | Before fidelity passes | After fidelity passes |
| --- | --- | --- |
| controlled | 24/24 | 24/24 |
| paper-style | 2/3 | 2/3 |
| real | 2/5 | 2/5 |

The thresholds, reference geometry, axis calibration, guide strokes and image
files are unchanged. One sparse-point image has no continuous reference and
stays excluded from the fidelity denominator. Domain coverage is a separate
check: it does not establish shape accuracy.

| Changed image | Model families | Canvas/photo p95 pixels | Reference coverage | Fidelity flag |
| --- | --- | --- | --- | --- |
| real--04-piecewise-curved-section | tan -> polynomial | 297.9 -> 43.7 | 21.1% -> 52.0% | False -> False |

All branch inputs are identical in 33/33 paired runs.
Complete model records are identical in 32/33.
Every new model is finite at all supplied trace x-coordinates and all 801 sampled
domain positions. All 33 cases pass the separate rendering/model diagnostic.
These checks establish complete domain transfer; remaining geometric failures
are reported below rather than counted as recognition successes.

## Remaining fidelity failures

- paper--03-cubic-graph-paper
- real--02-conflicting-equation-labels
- real--04-piecewise-curved-section
- real--06-piecewise-graph-paper

## Verification and evidence

- Source: `79053b22d2b2f4c66cc8875adada7302ebe30686`; comparison source: `1e29cc188f17a7044c026d8830ba69915146b0ac`.
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
