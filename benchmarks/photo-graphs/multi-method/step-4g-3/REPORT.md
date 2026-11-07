# Step 4G-3 — Reviewed stroke reuse and demo freeze

**CONDITIONAL PASS.** The local CV-assisted continuation imports selected original
CV pixels and a reviewed dot without retracing, preserves prior objects, and
passes native editing, Save & Grade and refresh. Its geometry remains less
faithful than the frozen manual trace. Keep the unchanged manual-assisted route
as the November 9 demonstration route. This is not general automatic recognition
readiness. No Gemini request, production deployment, push or merge occurred.

## What changed

The existing recognition dialog now has a concise status, one primary next
action, a plain original photograph beside a clearly labeled pixel preview,
separate manual/retry/reject actions and collapsed technical details. On narrow
screens the two views stack. The footer explains the unmet import conditions.
Native preview has receiving-canvas axis values, separate from photo pixels.

After an incomplete **CV automatic** result, **Continue with detected strokes**
starts **CV-assisted** correction inside the same dialog:

1. Click O=(0,0), a known X and a known Y on the same original photo; enter the
   two axis values independently and explicitly confirm them. Markers can be
   adjusted with arrow keys (Shift=10 source pixels).
2. Keep graph lines in the pixel preview using mouse or keyboard. Exclude
   axes, labels, grid and fragments. A line list offers explicit classifications
   and hover/focus highlighting; **Exclude remaining lines** is an explicit
   bulk decision. No candidate starts preapproved.
3. Review every small component using its photo crop: filled dot or exclusion.
   Confirm the selected branches, gaps, corners, endpoints and dots against
   the whole photo.
4. Preview the calibrated native geometry, compare it with the photograph,
   acknowledge that comparison and explicitly import.

The photo File stays local and identical throughout correction and manual
fallback. Its SHA-256 is retained in assisted provenance. Closing, rejection,
photo replacement, review edits and native-state changes invalidate proposals.
Nothing is committed before the existing native session's one-use confirmation.

## Geometry and safety contract

`star-cv-assisted.js` records `method: cv_assisted`,
`automatically_recognized: false`, `curve_source: cv_pixels_no_retrace`, the
original CV geometry, photo hash and all human review decisions. Its validator
rebuilds the proposal and rejects altered geometry/provenance. Status remains
`needs_review`; it is never relabeled `automatic` to enable import.

Only exactly shared endpoints with unique degree-two continuation join. No
nearby endpoints are snapped, no gaps filled, and no vertices fitted, smoothed
or traced again. Original corner flags are retained. Disconnected components
remain distinct. Unresolved crossings, loops, selected edge-clipped ink,
unsupported uncertainty, x-backtracking, out-of-canvas coordinates, tool limits
and stale native snapshots remain blocked. The existing manual fallback stays
available when the CV selection cannot pass these guards.

Photo Geometry v1 has an additive optional `points` array (unique ID, kind
`point`, source pixel and consistent calibrated coordinate). Automatic points
are blocked. The native adapter only accepts these dots through validated,
explicitly opted-in CV-assisted provenance and one eligible editable filled-point
tool. Curves and dots append in one state update with rollback verification;
missing/ambiguous/limited point tools block rather than silently discard dots.
Existing objects and the original function-input safeguards remain intact.
`assistedPhotoGeometry` remains required. The manual trace builder and photo
workspace were not changed.

The only detector change adds the actual component-pixel centroid to existing
small-component metadata. Thresholding, extraction, OCR, simplification and
model/provider selection are unchanged. The 44 extracted paths and all their
vertices match the prior baseline; no general recognition change was introduced.

## Real-photo behavior and fidelity

Input: the existing user-owned `IMG_1670--source.png`, SHA-256
`9c8247ec0be7d4ca68c4536eea990a0c5b0fce6250e8478a13b5aa5a0e190231`.
This is an existing development case, not new held-out evidence. It contains
sharp peaks, an off-origin minimum and an isolated dot. The other AI-labelled
comparison image was not used.

The real browser extraction produces 44 paths and four small components. Human
review keeps `stroke-10`, `stroke-11` and `stroke-12`, explicitly excludes 41
other paths, keeps small mark 1 as a filled dot and excludes marks 2–4. These
three source segments contain 45 vertex observations, including two repeated
shared endpoints; they form one 43-vertex branch without inserted coordinates.
The small connector at the axis crossing is actual extracted ink.

| Method, same photo | Reference→geometry p95 | Geometry→reference p95 | Coverage ≤3px | Paths / spurious |
|---|---:|---:|---:|---:|
| CV automatic, prior baseline | 11.69px | 382.51px | 53.94% | 44 / 40 |
| CV-assisted, this step | 11.69px | 11.90px | 53.94% | 1 / 0 |
| Gemini automatic, prior one-call pilot | 503.35px | 346.44px | 1.33% | 4 / 2 |
| Manually traced, frozen route replay | 3.50px | 3.49px | 91.27% | 1 / 0 |

CV-assisted selection resolves this case's branch bookkeeping and false paths;
it does **not** improve the selected curve's pixel accuracy. Coverage is 64.75%
within 5px and 79.29% within 8px. Peak errors are 5.84px/10.30px; endpoint maximum
error is 4.16px. The reviewed CV dot center is 2.73px from the approximate visual
annotation. It **fails** the frozen Step4F photo-fidelity screen (8px p95/corner
limits and ≥90% coverage within 8px). Import validity and visual plausibility
are not counted as recognition success. CV automatic remains 0/3; the prior
Gemini automatic pilot remains 0/1. No additional Gemini calls were made.

Native encoding adds effectively no distortion to the selected pixels: maximum
anchor error is below 1e-9 source pixel and sampled rendering drift below 0.001px.
The native controls, point and previous objects survive Save & Grade and refresh
exactly. A real native Select drag translates the whole branch without deforming
its corners; the edited state also survives submission and refresh. The sandbox
expects x-squared, so this faithfully retained different graph receives 0%.
That outcome preserves a mathematical mistake rather than replacing it with
the target answer.

References are approximate prior single-agent visual annotations with about
6px uncertainty, not independent blinded ground truth. They enter only the
post-run evaluator. Absolute numerical axis calibration accuracy is unscored;
O/X/Y placement and values are human actions, not automatic detections. Tests
replay those interactions; they do not establish human usability or task timing.

## Validation and evidence

- 116 offline Node tests pass, including 11 focused CV-assisted tests for exact
  reuse, independent scales, required reviews, topology, point schemas, native
  opt-in, bounds/tool limits, staleness and atomic rollback.
- Five existing Python/server tests pass.
- 165 existing native-browser assertions pass on frozen controlled fixtures,
  including separate branches, native editing, submission and refresh.
- 69 CV-assisted browser assertions pass, checking real-photo import/edit/restoration,
  keyboard selection/marker adjustment, unreadable/replaced/rejected photos,
  stale/unreviewed proposals and same-File manual fallback and the existing no-strokes real-photo failure. Exact final count
  and commands are in [verification.json](verification.json).
- The unmodified Step4F browser rehearsal passes all 84 assertions: the actual
  paper photograph at desktop/presentation sizes and the disconnected-lines
  photograph. All three trials pass its original evaluator/tolerances. Manual
  fidelity remains 3.50/3.49px on the paper photo.
- Seven backup assertions pass. The unchanged independent localhost:3020 viewer
  loads the recorded package, then browser networking is disabled; all 12 images,
  navigation and both native JSON downloads work with no further HTTP. The
  primary service was not stopped in this step. This is recorded manual evidence,
  with explicit disclosure, not new live recognition or grading.

[Raw browser evidence](results/results.json), [CV-assisted geometry](results/cv-assisted-geometry.json),
[matched evaluation](results/evaluation.json), [frozen rehearsal](results/frozen-demo-acceptance.json)
and [rehearsal fidelity](results/frozen-demo-evaluation.json) retain the detailed
checks. Screenshots include [before](results/before-desktop.png),
[after](results/after-desktop-detected.png), [selected pixels](results/selected-pixels.png),
[native preview](results/native-preview.png), [import](results/native-import.png),
[restoration](results/native-restored.png), [mobile](results/mobile-calibration.png)
and [presentation viewport](results/presentation-calibration.png).
[CV/photo](results/cv-assisted-photo-overlay.png),
[native/photo](results/native-photo-overlay.png) and
[withheld reference](results/withheld-reference-overlay.png) overlays are separate.

Chrome-engine automation uses the installed Playwright CLI because the Browser
plugin was unavailable. Desktop 1440×1100, mobile 390×844 and presentation
1280×720 layouts were exercised, with no horizontal overflow or collected
application exceptions. These are viewport tests on this presenter Mac, not a
physical projector or Safari pass. The presenter must still perform the exact
screen checklist in [PRESENTER.md](PRESENTER.md).

## Review findings and limits

An initial browser replay timed out because its helper toggled an already-open
line list closed on the second trial. The helper now opens it conditionally;
no safety check was relaxed. The initial CLI invocation lacked its installed
path and was corrected. Browser policy blocks direct `file:` navigation, so
backup replay uses the existing independent local viewer, then disables network.
Final runs pass; see [initial-findings.json](results/initial-findings.json).

Remaining: pixel-level CV errors, fully missing ink, open-circle/arrow semantics,
individual vertex correction, non-function paths, projective camera correction,
Safari and physical projector readability. Draft photos/review decisions are
not restored after refresh; only submitted native geometry is durable. Selecting
many small fragments remains more work than selecting a single curve. Do not
claim student timing, general accuracy or calibrated mathematical correctness.

All implementation, tested assets and evidence are on the confirmed presenter
Mac. This work is local on `feat/automatic-photo-recognition-cv`; it is not a
course deployment or a transferred teammate setup. Existing Step4F code/assets,
prior benchmark outputs and the consumed one-request Gemini journal are
preserved. See [file inventory](file-inventory.json) and
[evidence hashes](evidence-manifest.json).

## Deadline recommendation

Freeze here for November 9. Rehearse the unchanged manual-assisted route using
[PRESENTER.md](PRESENTER.md), with the recorded backup already open. Treat
CV-assisted reuse as an optional reviewed research demonstration, not the
high-fidelity route. The remaining useful work is a short human timing/projector
check, which is realistic before the deadline; recognition research is not
needed for this demo. Any next phase needs separate approval. Do not run more
Gemini calls or integrate a new recognizer as part of this freeze.
