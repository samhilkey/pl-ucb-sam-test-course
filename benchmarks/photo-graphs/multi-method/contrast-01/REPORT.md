# Contrast-01 — Professor's auto-contrast suggestion

Approved focused experiment between Step 4A and the Gemini pilot. Branch:
`feat/automatic-photo-recognition-cv`; starting commit:
`6f79e7e54cc4fa32853bbfb8423170f398cfa51a`. Demo deadline: November 9, 2026.

**Contrast normalization does not resolve either failed photograph with the
current downstream recognizer.** CLAHE and individual channels recover some real
stroke fragments, especially on real--06, but no condition recovers the intended
complete branch topology, a correct axis pair, or calibrated graph coordinates.
Global percentile RGB contrast also introduces substantial artifacts. The tested
local background normalization makes extraction worse.

This is a comparison of **two existing development photos under eight fixed
conditions**, not 16 independent drawings or a held-out accuracy study. All
results use the prior approximate visible-ink centerlines, with approximately
4px annotation uncertainty. These are not independent human ground truth. The
3px scores are accompanied by 5px/10px sensitivity results and image inspection.

## Method and controls

The two original failures reproduce **exact prior geometry**, not just status:

- `real--01`: 801 × 529, abstained, zero paths.
- `real--06`: 529 × 420, needs review, four paths, two components, one junction.
- Both original coordinate frames and calibrations remain uncertain.

Input SHA-256 values are frozen in [inputs.json](inputs.json); evaluator-only
reference and baseline geometry hashes are in
[evaluation-policy.json](evaluation-policy.json). Historical benchmarks and
production elements/questions were not modified. The original condition copies
the existing input PNG bytes unchanged.

Parameters were fixed before the comparison, without a reference-based search:

| Condition | Experimental transform before the unchanged recognizer |
| --- | --- |
| original | Original RGB, no added processing. |
| grayscale | Rounded 0.299R + 0.587G + 0.114B, replicated into RGB; color-removal control. |
| percentile | 1st/99th luminance percentiles; one shared linear stretch applied to RGB, clipped to 0–255. |
| background | Divide RGB by Gaussian luminance background, sigma 21px, reflected boundary; target background 235, denominator floor 16. |
| CLAHE | OpenCV CLAHE on 8-bit Lab L; clip limit 2.0, 8 × 8 tiles; retain a/b then convert to RGB. |
| red / green / blue | Separate selected RGB channel, independently stretch its 1st/99th percentiles, replicate into RGB. |

The [OpenCV CLAHE tutorial](https://docs.opencv.org/4.x/d5/daf/tutorial_py_histogram_equalization.html)
documents the chosen 2.0 / 8 × 8 configuration. CLAHE uses local histograms with
contrast limiting and tile interpolation; see its
[API](https://docs.opencv.org/4.13.0/d6/db6/classcv_1_1CLAHE.html).
The local-background condition uses the documented
[Gaussian filter](https://docs.opencv.org/4.13.0/d4/d86/group__imgproc__filter.html).
Runtime packages are pinned in [requirements.txt](requirements.txt).

All transforms preserve source dimensions and pixel centers. No experimental
crop, warp, grid/axis subtraction, erosion, dilation, filling, smoothing, equation
fitting, external OCR or VLM is applied. **The existing recognizer's morphology,
thresholds, component filtering, thinning, path ordering, simplification, axis
detection and limited bitmap-label reader remain identical in every condition.**
No calibration overrides are supplied.

[preprocess.py](preprocess.py) and [infer.cjs](infer.cjs) read image-only inputs.
All 16 recognitions finish before [evaluate.cjs](evaluate.cjs) loads reference
geometry. The new axis/overlap annotations are approximate, evaluator-only visual
diagnostics; they are neither independent labels nor inference hints. No
reference-guided repair, branch completion or tuning occurred.

## Measured geometry results

Coverage is the fraction of reference centerline samples within **3 native
pixels** of any output stroke. Off-reference is the fraction of output path
samples farther than **5px** from every reference stroke, a contamination proxy.
Entirely spurious paths never approach any reference within 5px. Samples are
spaced at ≤1px along segments. Empty output has zero coverage and unavailable
distance/contamination, not zero error. Counts and proportions remain approximate
because these references are not dense human ink segmentations and omit details
such as arrowheads.

### real--01: two intended independent branches

| Condition | Coverage upper / lower | Paths / components / junctions | Entirely spurious paths | Off-reference samples |
| --- | ---: | ---: | ---: | ---: |
| Original | 0 / 0% | 0 / 0 / 0 | 0 | unavailable |
| Grayscale | 0 / 0% | 0 / 0 / 0 | 0 | unavailable |
| Percentile | 3.8 / 3.9% | 90 / 29 / 34 | 79 | 92.0% |
| Background | 0 / 0% | 0 / 0 / 0 | 0 | unavailable |
| CLAHE | 3.6 / 3.2% | 9 / 5 / 3 | 0 | 28.8% |
| Red | 3.8 / 10.5% | 13 / 8 / 3 | 1 | 27.9% |
| Green | 3.9 / 0.1% | 11 / 4 / 5 | 2 | 47.7% |
| Blue | 3.6 / 1.6% | 6 / 4 / 1 | 1 | 46.7% |

No condition recovers the two branches. Even the best lower-branch aggregate
coverage, red at 10.5%, is fragmented: its best single path covers only **3.1%**
of that branch. Percentile contrast changes an explicit abstention into many
mostly unrelated paths; this is worse than a useful reconstruction. It also
changes the unchanged saturated-color detector from zero to **5,550** accepted
color-mask pixels, consistent with amplification of paper/grid chroma.

### real--06: one intended connected piecewise branch

| Condition | Coverage | Best single path coverage | Paths / components / junctions | Entirely spurious paths | Off-reference samples |
| --- | ---: | ---: | ---: | ---: | ---: |
| Original | 2.0% | 2.0% | 4 / 2 / 1 | 3 | 75.6% |
| Grayscale | 0% | 0% | 3 / 1 / 1 | 3 | 100% |
| Percentile | 18.9% | 5.6% | 17 / 6 / 6 | 13 | 53.8% |
| Background | 0% | 0% | 3 / 1 / 1 | 3 | 100% |
| CLAHE | 24.9% | 7.1% | 8 / 6 / 1 | 3 | 25.8% |
| Red | 20.0% | 6.4% | 7 / 5 / 1 | 3 | 28.7% |
| Green | 22.2% | 5.9% | 8 / 6 / 1 | 3 | 28.2% |
| Blue | 24.9% | 7.1% | 9 / 6 / 2 | 3 | 24.9% |

CLAHE and blue provide a real but incomplete gain in visible-ink coverage. Both
still split the intended branch into multiple components/paths and retain
unrelated artifacts. CLAHE's reference→prediction p95 falls from **303.7px to
78.4px**, while prediction→reference p95 remains about **249px**. Looking at only
the first distance or coverage would hide the remaining large artifacts.
The nearest flagged corner to the reference peak remains about 253.5px away
with CLAHE; the small recovered peak fragment is not a correctly marked corner.

At a relaxed **10px** tolerance, maximum coverage is only 11.4% / 16.3% for
real--01's upper/lower branches (different conditions), and 40.1% for real--06.
The conclusion therefore does not depend on the 3px cutoff. The inherited false
connection count is zero for every condition, but missing/fragmented ink prevents
this from being evidence of correct topology. No run has the intended path count.

Raw bidirectional distances, endpoints/corners, fragmentation, 3/5/10px coverage,
mask retention, axes and calibration are in
[evaluation.json](results/evaluation.json), with a compact
[comparison.csv](results/comparison.csv). No successful native import is claimed.

## What fails after contrast improves visibility

The dark threshold already contains much of the actual photographed ink. The
existing thick-marker filtering then discards most of it:

| Case / condition | Dark-mask pixels | After opening/color union | Rejected small-component pixels | Final ink pixels |
| --- | ---: | ---: | ---: | ---: |
| real--01 original | 5,908 | 536 | 536 | 0 |
| real--01 CLAHE | 9,086 | 1,544 | 823 | 721 |
| real--06 original | 3,747 | 304 | 81 | 223 |
| real--06 CLAHE | 15,575 | 1,580 | 630 | 950 |

The post-opening/color-union counts are exactly final ink plus rejected disjoint
component pixel counts, recorded in [mask-attrition.json](results/mask-attrition.json).
The four rows above have no color-mask pixels. In other rows the color union is
not necessarily a subset of the dark mask.

On real--01, original dark-mask coverage is **87.4% / 100%** at 3px, then final
coverage is zero. CLAHE dark-mask coverage is **89.9% / 100%**, yet final geometry
covers only 3.6% / 3.2%. The evidence locates a major loss at the radius-2 opening
and component rejection designed for thick marker strokes. It does not establish
that simply removing those filters would separate pencil from grid/axes safely;
that would be a different experiment.

Background division raises the paper/ink values against unchanged absolute
cutoffs: real--01 dark-mask reference coverage falls to about **6.4% / 6.7%**;
real--06 falls from 61.6% to 30.8%, with zero final curve coverage. This particular
normalization/configuration is worse. It is not a proof that every possible
background-normalization method would fail.

## Intersections, axes and scale

Original images are preserved, and the experimental transforms do not delete
axis/grid rows or fill gaps. **The final extraction still fails the ink-
preservation requirement.** At real--01's lower curve/y-axis crossing, every
condition has zero final geometry coverage in the diagnostic region, although
the original and most contrast dark masks retain nearby ink. At the upper
crossing, CLAHE recovers only 28% local coverage, not a complete traversing stroke.

For real--06, the left axis endpoint is missing in all outputs. The right
endpoint improves from 92.3% to 100% local coverage in several contrast conditions.
CLAHE/green/blue recover only 32% of the peak/grid-overlap region and do not
preserve its complete corner. These five localized checks are not an exhaustive
annotation of every grid intersection. Their source/overlay crops are in the
[overlap sheet](results/figures/overlap-regions.png).

**No condition recovers a correct visible axis pair or either numeric scale.**
All 16 outputs retain uncertain calibration and null graph coordinates. Unique
candidate flags sometimes describe the wrong line: real--01/red reports one y
candidate near x=718, far from the photographed y-axis; real--06/CLAHE reports one
y candidate near x=374, also wrong. Raw candidates and geometric diagnostic
matches are retained, so these flags are not scored as detection successes.

The short/skewed axes do not fit the full-span upright projection assumptions.
Contrast alone does not change that geometry. real--01 has no numeric tick labels,
so this crop cannot establish mathematical scale unaided. real--06 has handwritten
multi-digit y labels outside the existing single-digit bitmap reader's supported
vocabulary. With no unique frame, the reader cannot reach its normal origin-based
scale search in this experiment; no handwriting OCR comparison was run. No
independent numerical calibration accuracy is asserted, and no
scale is inferred from grid spacing or a grading answer.

## Evidence, reproduction and validation

Inspect the full-resolution comparison sheets:

- [real--01 before/after, masks and overlays](results/figures/real--01-comparison.png)
- [real--06 before/after, masks and overlays](results/figures/real--06-comparison.png)
- [axis/grid overlap crops](results/figures/overlap-regions.png)

Each `results/<case>/<condition>/` contains `image.png` and a `recognition/`
directory with validated `geometry.json`, ordered `raw-paths.json`, six binary
masks (`neutral`, `grid`, `dark`, `color`, `ink`, `skeleton`), `calibration.json`,
stroke/proposal/axis overlays, evaluator-only reference/prediction overlay and
`metrics.json`. Each case retains `before.png`; background conditions also retain
the estimated background. Run/index files record hashes, dependency versions and
per-condition timings. Timings are single observations, not a latency benchmark.

Reproduce into a **new** directory; scripts refuse to overwrite completed stages:

```bash
python3 -m venv /private/tmp/star-contrast-01-venv
/private/tmp/star-contrast-01-venv/bin/python -m pip install -r benchmarks/photo-graphs/multi-method/contrast-01/requirements.txt
/private/tmp/star-contrast-01-venv/bin/python -B benchmarks/photo-graphs/multi-method/contrast-01/preprocess.py --output /private/tmp/star-contrast-01-rerun
node benchmarks/photo-graphs/multi-method/contrast-01/infer.cjs /private/tmp/star-contrast-01-rerun
node benchmarks/photo-graphs/multi-method/contrast-01/evaluate.cjs /private/tmp/star-contrast-01-rerun
/private/tmp/star-contrast-01-venv/bin/python -B benchmarks/photo-graphs/multi-method/contrast-01/summarize.py /private/tmp/star-contrast-01-rerun
```

Validation commands (from repository root):

```bash
node --test tests/star-contrast.test.cjs tests/star-method-feasibility.test.cjs tests/star-recognition.test.cjs tests/star-geometry.test.cjs tests/star-native.test.cjs tests/star-fit-branches.cjs tests/star-fit-coverage.cjs
/private/tmp/star-contrast-01-venv/bin/python -B -m unittest discover -s benchmarks/photo-graphs/multi-method/contrast-01 -p test_preprocess.py -v
git diff --check
```

**80 Node tests and five Python tests pass**, zero failures. Logs:
[Node](node-tests.log), [Python](python-tests.log). New checks replay all 16 actual
inputs with network/reference reads blocked, verify exact baseline reproduction,
reject input hash/dimension changes, distinguish fragments from a complete branch,
reject displaced axis candidates, preserve pixel-center mappings, and check
photometric processing at synthetic grid/axis crossings. The synthetic check is a
regression safeguard, not real-photo success evidence.

All comparison sheets were visually inspected. No production UI changed;
PrairieLearn browser Save & Grade/restoration was not rerun or newly claimed.
Existing pure native, geometry, fitting and feasibility regressions pass.
The self-review and complete file hashes are in
[verification.json](verification.json) and [evidence-manifest.json](evidence-manifest.json).
No VLM inference, paid model request, push, merge or other-branch write occurred.

## Recommendation and approval boundary

Do not integrate auto-contrast as a claimed fix. Retain the experiment tools and
evidence; keep production preprocessing unchanged. CLAHE is a plausible component
for a later thin-ink/axis-separation method, not a working recognizer on its own.
The red/blue differences justify considering color locally, but no single channel
solves either photograph. This experiment neither completes the OCR-assisted arm
nor establishes a hybrid method.

Recommend the focused two-image Gemini pilot as the next checkpoint, subject to
the existing image-release, credential, privacy and $0-cost gates. It would test
whether structural interpretation improves over the measured CV failures before
another extraction change. If external access is blocked, the evidence supports
one separately approved thin-pencil/axis-separation experiment; tuning contrast
alone or adding OCR alone cannot recover missing stroke paths.

The November 9 demo remains the priority. Remaining integration and independent
real-paper acceptance need protected time; do not prolong parameter/provider
searches. No reliable automatic real-photo demo is established yet. Stop after
the local commit and clean-tree verification; do not begin another experiment
without explicit approval.
