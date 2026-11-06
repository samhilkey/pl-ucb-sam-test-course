# Step 4G-1 — Automatic recognition as the primary photo route

The existing automatic dialog is now the primary photo action in opted-in
PrairieLearn questions, including the assisted demo. Upload immediately runs
the existing local CV without axes, tracing or selected points. Native import
still requires valid calibrated geometry, student acknowledgment and a current
one-use proposal. **CV automatic remains unsuccessful on all three real-photo
cases (0/3 valid imports).** The UI exposes these failures rather than turning
them into plausible native graphs. Manual recovery remains the dependable demo
route; this is not general real-photo recognition readiness.

## Implementation

- Reused `star-automatic.js`, its upload/review dialog, overlays and guarded
  native session. The original image appears beside extracted geometry even
  when only uncalibrated pixel paths are available. The latter is explicitly
  labelled incomplete, with no implied mathematical scale. Status, warnings,
  path/component counts, axes, scale and heuristic uncertainty are visible.
- Made automatic recognition primary and manual tracing secondary. **Correct
  recognition / Use manual tracing** invalidates the automatic proposal and
  hands the exact original local File to the existing assisted loader. No
  second file selection is necessary. This starts manual calibration/tracing;
  it is not an automatic landmark-correction feature.
- Added a small `star-providers.js` boundary using Photo Geometry v1. CV is the
  only enabled provider. Small-component boxes from existing CV diagnostics
  are shown, and unresolved components outside the axis intersection block
  automatic import. No CV thresholds, preprocessing, OCR, skeletonization or
  fitting architecture changed. See [provider design](PROVIDER-BOUNDARY.md).
- Enabled the existing geometry-preserving manual adapter in the automatic
  sandbox. Its optional fallback no longer equation-fits traces. Other legacy
  questions retain their existing opt-in behavior. Native and grader code are
  unchanged. Made the automatic modal footer stay on-screen at mobile width.
- Corrected the malformed `.DS_Store` ignore rule so Finder metadata does not
  dirty the working tree. Credential ignore rules were preserved.

Read-only inspection of `feat/photo-workflow-ui` (`6c67426`) confirmed its
guided Photo/Axes/Trace/Review, separate-branch and invalidation patterns are
already present here. No branch was switched, merged or cherry-picked.

## Actual automatic results

Source: actual uploads in Chrome on local PrairieLearn, at
`http://localhost:3000/pl/course/1/question/254/preview/`.
IMG_1670 was uploaded from the user's original JPEG, not from an AI-labelled
comparison image. real--01 and real--06 are the exact existing failed PNGs.
The image-only browser run completes and writes observations before the
separate manual recovery and withheld-reference evaluator load any points.

| Photo | Expected strokes / extracted paths | Reference→prediction p95 px | Prediction→reference p95 px | Coverage within 3px | Spurious paths |
|---|---:|---:|---:|---:|---:|
| real--01 | 2 / 0 | null | null | 0%, 0% | 0 (no output) |
| real--06 | 1 / 4 | 303.69 | 250.96 | 2.02% | 3 |
| IMG_1670 JPEG | 1 / 44 | 11.69 | 382.51 | 53.94% | 40 |

All three are blocked before native import; none was submitted as an automatic
result. All photo scales are uncertain and all candidate graph coordinates
are null. real--01/06 have uncertain axes; IMG_1670 has a vertical candidate but
no unique pair or usable calibration. No question-configured ranges filled
these gaps. Axis/calibration **accuracy is unscored**, not passed: these
references have no independently measured frame.

real--06 loses the sharp peak (nearest marked corner error 253.51px) and almost
the entire branch. Its endpoint error is 308.59px. For IMG_1670, nearby curve
pixels do not imply correct structure: axes/ticks/labels are extracted as
answer paths, connectivity breaks at the axis crossing, and 77.02% of extracted
path length lies over 5px from the reference curve. Marked-corner errors are
5.84 and 10.30px, and nearest-endpoint error 4.16px. These nearest-neighbor
diagnostics cannot establish correct endpoint/branch pairing. The separate
dot lies in an unclassified small-component box; it was **not recognized as a
mathematical point** or imported. Other photos' isolated-mark truth is unknown.

The earlier 42-path offline observation used Step 4F's prepared PNG. The actual
JPEG/browser decode here yields 44; neither is successful. Source dimensions,
decoded-image hashes, masks and exact predictions are preserved. Do not pool
the two decoded inputs as identical inference conditions.

Metrics use existing approximate single-agent visual centerlines, with about
4–6px annotation uncertainty; they are not independent human ground truth.
Null distances mean no output, not zero error. Coverage and spurious-path
statistics are image-space diagnostics, not grading correctness. The large
failures remain clear despite annotation uncertainty.

Final validation passed 88 Node tests, 5 server tests, 165 native browser
assertions, 65 assisted real-photo assertions, 67 legacy desktop/mobile/touch
assertions, 63 automatic real-photo review/handoff assertions, 8 separate manual
recovery assertions, and the original unmodified Step 4F replay's 84 assertions.
Application console checks passed where collected. Browser plugin was not
available; the existing Playwright CLI drove local Chrome.

Intermediate failures and fixes are retained in
[initial findings](results/initial-findings.json). A misplaced method label
initially disrupted the assisted grid, and the added fallback button initially
clipped the automatic mobile footer. Both layouts were corrected and their
existing/new browser checks passed. An intermediate inverse-drag residual of
0.0000153 native pixels was diagnosed with a temporary relaxed-tolerance replay.
**The final Step 4F replay passed its original 0.000001-pixel tolerance unchanged**
after the shared layout fix; no relaxed test is used for final acceptance.

## Assisted comparison and recovery

The existing Step 4C/F evidence has two branches for real--01 (bidirectional
p95 1.86/2.06px, 100% within 3px) and one sharp branch for real--06 (4.21/4.20px,
75.25% within 3px; 100% within 5px). These are **manual traces**, not automatic
successes. real--01's 11.18px endpoint mismatch against the approximate
reference remains disclosed; no endpoint was moved to improve the metric.

In this step, IMG_1670 recovered directly from its failed automatic dialog
using the same File, manual affine calibration, one ink trace and a separately
placed native point. Both sharp peaks and the off-origin minimum remained.
Bidirectional p95 is 3.50/3.49px; coverage is 91.27% within 3px and 100% within
5px. Native anchor drift from that trace is below 1e-9px. The dot position is
manually placed, not extracted. The existing unrelated native point remains.
Actual Save & Grade keeps the incorrect drawn graph at 0%, and refresh restores
the exact submitted curve and both points. See [current recovery](results/recovery.json)
and [evaluation](results/evaluation.json).

## Evidence and reproduction

- [Automatic observations](results/automatic.json), per-photo `--prediction.json`,
  full decoded `--source.png`, `--overlay.png`, `--ink.png`, `--skeleton.png`,
  evaluator-only `--reference-overlay.png`, and actual dialog screenshots.
- `real--06--mobile-diagnostics.png` shows the mobile failure/uncertainty state;
  `IMG_1670--manual-*.png` shows explicit manual review, native import and restore.
- [Verification record](verification.json) lists final test commands/counts,
  failures, viewport checks and historical backup integrity. [Inventory](file-inventory.json)
  lists changed files; [evidence hashes](evidence-manifest.json) pin artifacts.

Run from the repository (browser CLI needs its installed browser/cache):

```sh
PL_PHOTO_TEST_CLI=/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh node benchmarks/photo-graphs/multi-method/step-4g-1/run-browser.cjs
node benchmarks/photo-graphs/multi-method/step-4g-1/evaluate.cjs
node --test tests/star-providers.test.cjs
```

The JPEG original is available on this presenter Mac at the path in the
browser runner. The metadata-free browser-decoded source is also committed as
evidence. The automatic UI requires the local PrairieLearn service; the
unchanged [Step 4F recorded backup](../step-4f/offline-backup.html) works
independently. It remains a recorded assisted demonstration. No deployed course
or remote branch was modified. All new work exists only on this local branch.

## Assessment and next approval

The automatic-first review/fallback interface works; the real-photo recognizer
does not yet produce reliable calibrated native geometry. The immediate
November 9 path remains the tested manual-assisted demo and its recorded
offline backup. Chrome desktop/mobile-sized QA does not establish Safari,
physical-phone or projector compatibility. Isolated points at an axis,
arrowheads, open/closed endpoint semantics, perspective and general OCR remain
limitations. No general accuracy claim is justified by three development cases.

Recommend a **separately approved, bounded Gemini image-only experiment on
individually cleared photographs**, using this same candidate/review/native
boundary and measuring topology plus pixel fidelity. The user attests to the
Free-tier project with no paid exposure, but image-specific transmission
clearance and separate inference approval remain required. There is no
inference transport enabled here. Do not expand CV preprocessing before the
demo. No Step 4G-2 work, model request or photograph upload occurred.
