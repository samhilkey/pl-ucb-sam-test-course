# Step 4G-3 final UI refinement — 2026-11-08

**Functional review/import acceptance: PASS. November 9 readiness: CONDITIONAL
PASS using the unchanged manual-assisted route as the dependable fallback.**
This is a UI improvement, not a recognition-accuracy improvement. CV-assisted
geometry remains 11.69/11.90px p95 and fails the frozen photo-fidelity screen.
The manually traced route remains about 3.50/3.49px. No Gemini inference,
recognizer tuning, native-adapter redesign, deployed-course modification, push
or merge was performed.

## Changes

- Centered the existing dialog with scoped `position:fixed; inset:0; margin:auto`,
  width at most 1100px and height at most 90dvh. The body scrolls internally;
  header/footer remain visible. Desktop comparisons remain side by side and
  narrow viewports stack them.
- Removed the calibration acknowledgment entirely. Valid O/X/Y references and
  independent finite, nonzero values enable **Review detected lines** immediately.
  Photo bounds, separation, noncollinearity, determinant/finite-transform checks
  and calibration round-trip consistency remain required. A concise message
  explains the next correction. Keyboard users can explicitly place a marker
  with Enter, then adjust it with arrows/Shift; the initial center position is
  a user-controlled starting cursor, not an inferred origin.
- Replaced the default fragment list with **Review your detected graph**. Choose
  highlighted lines directly on the original photo using mouse, Chromium touch
  or keyboard. Zoom retains the original pixels; undo restores line/point
  decisions. Individual source-path controls and diagnostic counts are under
  **Advanced details → Advanced line editing**, not required in the real-photo
  acceptance flow.
- Unchosen lines remain unresolved. **Review other lines** exposes them on the
  photo; **Not part of my graph** explicitly classifies those visible remaining
  lines, while **Keep editing lines** permits correction. There is no automatic
  exclusion when requesting preview. The old prominent “Exclude remaining lines”
  action and whole-photo acknowledgment checkbox are absent.
- Separate points are reviewed at their positions on the full photograph and
  in a 480×280 contextual crop, including nearby axes/graph. The question is
  **Is this a point on your graph?** Choices are **Keep as point**, **Not part of
  graph**, and **Not sure / Correct manually**. No mark starts classified.
  Arrow keys switch points; progress and choices have linked accessible labels.
  Uncertainty blocks preview or hands the exact same File to manual tracing.
- Kept the existing final native-preview acknowledgment and explicit **Confirm
  and add graph** action. The two removed intermediate acknowledgments were
  not replaced with another checkbox or fabricated boolean.

## Centering diagnosis

The parent UI was reproduced using read-only assets from commit `d1cb0fc` in
an isolated browser route; no checkout, branch change or frozen file replacement
was made. Under the loaded PrairieLearn styles, its measured bounds were
**x=0, y=0, width=1180px**, with computed zero margins at 1440×1100. The prior
custom rule did not explicitly restore auto margins. Inspection did not isolate
a vendor-specific reset, so this report does not attribute the problem to
Bootstrap. The explicit scoped rule fixes the observed result.

The refined dialog measured **x=170px, y=75.75px, width=1100px** in the same
viewport. At 1280×720 it measured **x=90px, y=36px, height=648px**. At 390×844,
it measured **x=12px, y=42.20px, height=759.59px**. Centering, footer visibility,
height/width limits and scrolling were checked in detection, calibration,
contextual-point review and narrow-screen selection. These are normal-scale
Chrome-engine viewport tests, not a physical-projector or Safari pass.

## Safe reuse and provenance

`star-native.js`, `star-geometry.js`, `star-recognition.js`, `star-photo.js`,
`star-assisted.js`, server grading and question configurations are unchanged.
No model/provider or threshold was changed.

Presentation grouping uses exact shared endpoints only, with unique degree-two
continuation and no flagged crossing. It neither snaps endpoints nor edits
coordinates. Ambiguous crossings, cycles and disconnected paths are not silently
merged. **The real photograph still has 44 ambiguous source paths**, so the
permitted visual-selection fallback is used rather than claiming successful
branch recognition. All paths remain available; the student keeps three curve
segments and explicitly resolves the other lines in context.

New provenance records `reviewBasis: explicit_decisions` and complete line/point
decisions, without `axisValues.confirmed` or `reviewed` acknowledgment flags.
The builder validates every required decision, calibration and source-geometry
identity. The unchanged native adapter rebuilds/validates that provenance before
preparation. Previously recorded legacy proposals still validate under their
original acknowledgment contract; old evidence is not rewritten.

The intermediate result remains `needs_review`, `method: cv_assisted` and
`automatically_recognized: false`. Native bounds, point-tool support/limits,
function-input restrictions, schema consistency, one-use tokens, source replacement,
native-state snapshots and atomic rollback remain enforced. Missing/uncertain
marks cannot be silently dropped. Viewing a mark is not a classification.

## Actual photograph and fidelity

The acceptance input is the user's original **IMG_1670.jpg**, SHA-256
`a8f8b7e7a6275cc6742eb1814a6161b56a00cf00ecf194ee32e318efe52e1f1b`.
Its metadata-free browser-decoded PNG has SHA-256
`9c8247ec0be7d4ca68c4536eea990a0c5b0fce6250e8478a13b5aa5a0e190231`,
matching the prior canonical source exactly. This is an existing development
case, not new held-out accuracy evidence. No photograph leaves the local test.

The tested normal interaction keeps the left/right curve and its small connector
on the photo without opening advanced fragment controls. The other lines receive
an explicit contextual exclusion. The separate filled dot is kept; the three
other possible marks are explicitly excluded. No line is retraced or fitted.
Three source paths yield one 43-vertex branch after removing only two duplicate
shared endpoints; their source pixels, corner flags, final endpoints and dot
center are identical to the previous selection.

| Same-photo method | Reference→geometry p95 | Geometry→reference p95 | Coverage ≤3px |
|---|---:|---:|---:|
| CV-assisted before and after refinement | 11.69px | 11.90px | 53.94% |
| Frozen manual-assisted replay | 3.50px | 3.49px | 91.27% |

CV-assisted 8px coverage is 79.29%; corner errors are 5.84/10.30px, endpoint
maximum error 4.16px, and the reviewed dot error 2.73px. Thus the frozen Step4F
photo-fidelity screen still fails. Native anchor error is below 1e-9 source pixel
and sampled native rendering drift below 0.001px: import preserves the selected
pixels, including their errors. Existing approximate visual references have
about 6px uncertainty and are not independent human ground truth. Absolute
numeric calibration accuracy remains unscored; calibration is a human action.
References are read only by the separate post-run evaluator.

The actual native import preserves the prior curve and unrelated point, appends
one editable curve and the independent dot, sends Save & Grade, and restores the
exact state after refresh. Native Select translation, another real submission
and refresh also pass. The sandbox expects x-squared, so this different student
graph still receives 0%, rather than being changed to the target equation.

## Tests and evidence

Final counts/commands are in [verification.json](verification.json): 123 offline
Node tests (including 18 CV-assisted tests), five server tests, 165 existing
native-browser assertions, the refined real-photo browser acceptance, and the
unmodified Step4F rehearsal's 84 assertions. All functional/regression checks
pass. The separate photo-fidelity screen fails and is disclosed above.

The flow exercised was upload JPEG → manual axes/scale → visual line review →
explicit other-line decision → contextual point decisions → calibrated native
preview → final confirmation → editable native graph → Save & Grade → refresh.
Tests also cover incomplete/zero/unstable calibration, unsafe grouping, unreviewed
lines/points, undo, touch, zoom, keyboard focus/navigation, long scrolling,
Close/Escape, unreadable/replaced/rejected photos, stale native state and exact-File
manual recovery. A separate keyboard-placement probe uses an artificial frame
without import; it is not claimed as recognition or photo calibration accuracy.

[Before position](results/before-centered-desktop.png),
[before calibration](results/before-calibration-checkbox.png),
[before fragment/point review](results/before-fragment-point-review.png),
[centered after](results/centered-desktop-detected.png),
[calibration without checkbox](results/centered-calibration.png),
[visual selection](results/visual-selection.png),
[contextual dot review](results/contextual-point-review.png),
[mobile point review](results/mobile-point-review.png),
[native preview](results/native-preview.png),
[restoration](results/native-restored.png), and
[manual fallback](results/same-photo-manual-fallback.png) show actual browser states.

[Structured browser evidence](results/results.json),
[validated geometry](results/cv-assisted-geometry.json),
[fidelity evaluation](results/evaluation.json),
[CV/photo overlay](results/cv-assisted-photo-overlay.png),
[native/photo overlay](results/native-photo-overlay.png), and
[frozen manual evaluation](results/frozen-demo-evaluation.json) are preserved.
The prior Step4F demo package and all previous benchmark outputs remain unchanged.

QA found and fixed an SVG visibility issue during implementation: setting an
SVG's JavaScript `hidden` property did not hide its pixel preview, stacking the
point crop below it. Explicit attribute toggling and a regression now enforce
replacement. The before-capture helper initially encountered an inline-script
empty URL; filtering that value fixed the evidence script. Neither fix relaxed
validation. Details are in [initial findings](results/initial-findings.json).

## November 9 recommendation and limits

Freeze this UI after review. Use the unchanged manual-assisted route as the
most faithful tested demonstration, with its recorded backup available. The
refined CV-assisted route is an optional reviewed demonstration of stroke reuse;
it is not a fully automatic success. CV automatic remains 0/3 and the prior
Gemini pilot remains 0/1; no new inference was run.

Remaining: CV pixel errors/missing ink, tiny ambiguous connectors, open-circle
and arrow semantics, individual-vertex correction, actual VoiceOver/Safari and
physical-projector readability. Photo/review drafts do not survive refresh;
submitted native objects do. Selecting and classifying can still be wrong, so
retain final comparison and manual recovery. No human timing/usability study is
claimed. See [current walkthrough](REVIEW-WALKTHROUGH.md) for exact local steps.

A short presenter/projector rehearsal is realistic before November 9; further
recognition changes are unnecessary for that demo. This refinement stops after
one local commit. Step4G-4 requires separate approval.
