# Step 4G-4 — Canvas-first photo import and failure recovery

**PASS for the tested local Chrome canvas-reference workflow. CONDITIONAL PASS
for the November 9 presentation.** Failed CV no longer blocks photo visibility
or native editing. A visible reference is not a recognized, calibrated or
gradeable graph. No general real-photo recognition improvement is claimed.

Tested November 8, 2026 on the confirmed presenter Mac, local PrairieLearn
container `star-automatic-cv-baseline-arm64`, branch
`feat/automatic-photo-recognition-cv`, starting commit
`f215d450c335f7b996caebba073e48716ff5609b`. No Gemini requests, external photo
uploads, production changes, pushes or merges. The frozen Step 4F backup and
earlier experiment evidence remain unchanged.

## Actual outcomes

| Input | Actual CV result | Photo visible inside native canvas | Provisional CV visible | Editable native geometry | Save & Grade / refresh |
|---|---|---|---|---|---|
| Original `IMG_1670.jpg` | `needs_review` | Yes, before CV completes | Yes, including erroneous axis/label fragments | One manually drawn curve and a separately placed source dot; no automatic import | Accepted native format, **0%** against the sandbox's x-squared target; exact native state and original photo restored |
| `real--01` | `abstained` | Yes, before CV completes | No strokes available | Two manually drawn disconnected branches; no automatic import | Accepted native format, **0%**; exact native state and photo restored |
| `real--06` | `needs_review` | Yes, before CV completes | Yes | One manually drawn sharp trace; no automatic import | Accepted native format, **0%**; exact native state and photo restored |

Every case began with an unrelated native curve and point. Upload, recognition,
drawing, submission, reference removal and refresh preserved those objects.
IMG_1670 also exercised actual native Select/drag and Select/Delete. The trace
and source dot were **manually added with native pointer gestures**; their
success is not automatic recognition or calibrated photo transcription.
Frozen operator waypoints simulate a human drawing for repeatability and never
enter the CV recognizer.

An image-only submission with actual CV abstention submitted **zero native
curves/points and no photo bytes**. PrairieLearn returned **Invalid — invalid,
not gradable**. It did not award recognition credit for the reference.

## Implementation and safety

The inspected native SVG starts with two background rectangles, then grid/axes,
preview and native drawing groups. The new layer is an SVG `foreignObject`
after the backgrounds and before the native grid and ink. Its only child is a
raster canvas. There are no provisional SVG paths, plugin IDs, answer fields or
native-state writes. It is hidden from accessibility traversal, has no focusable
content, and uses `pointer-events: none` on the entire subtree. Native tools
receive the pointer events. A scoped observer restores layer order if native
rendering changes the SVG's direct children.

The original decoded photo is displayed before the existing CV processing and
calibration checks. Dashed orange pixels show the recognizer's provisional
strokes, including mistakes; they are labeled ungraded. CV failure leaves one
concise explanation and permits drawing immediately. There is no modal,
fragment list or calibration wizard on this default route.

Normal controls are Upload / Take photo, Edit on canvas and Show / Hide photo.
Photo options contains removal, opacity, the provisional-line toggle and the
existing advanced/manual routes. The optional **Review recognized draft** is
offered only after the existing native adapter validates calibrated automatic
geometry. It still requires explicit review and confirmation. Opening that
preview takes a current native-state snapshot; a point added after background
recognition is preserved. No pixel-fit coordinates enter that adapter.

The existing native validation, object isolation, grading and stale-proposal
guards remain in place. `star-native.js`, `star-geometry.js`, `star-photo.js` and
`star-recognition.js` are unchanged. Replaced/removed photos invalidate pending
recognition. Malformed replacements keep the previous decoded photo and File;
late older results cannot add stale CV pixels. The upload picker has no form
field name. Save & Grade submits the existing native answer structure only.

## Persistence and limitations

- The photo is **visually fitted, not aligned to mathematical axes**. Drawing
  directly over it uses the receiving canvas's coordinates, which may differ
  greatly from the photographed axes. Students must check those axes. No
  automatic mathematical fidelity is claimed for this route. Use the existing
  optional calibrated manual route when faithful mathematical transcription is
  required. There is no new on-canvas alignment tool in this bounded change.
- Native freehand drawing retains the native tool's behavior; it may round a
  corner. This step does not improve recognition, calibrate uncertain CV, infer
  mark semantics, or establish a new geometry-accuracy score. Incorrect CV
  fragments remain visible until hidden and are never imported by default.
- Original raster bytes can persist in **this browser tab**, scoped to the
  exact question path, variant, canvas and coordinate frame, for up to 24 hours.
  Restoration validates the record, SHA-256 and raster type and reruns local CV.
  Same-attempt Save & Grade and refresh passed on all three cases. A fresh
  preview variant deliberately does not inherit another attempt's photograph.
- Persistence is limited to 4,000,000 data-URL characters (roughly 3 MB of file
  bytes) and browser storage availability. Quota/storage denial leaves the photo
  usable now, removes stale stored bytes, and tells the student to reupload
  after refresh. Saved native drawings still restore. The photo is not a server
  attachment, and does not accompany grading or appear for another device or
  instructor. Closing/clearing the tab may require reupload.
- PNG, JPEG and WebP are supported. Undecodable images are rejected honestly.
  The CV 40-megapixel guard remains; decoded reference display precedes it, but
  a very large image was not exercised in this acceptance run.
- Chrome was exercised at desktop and 390×844. The unchanged calibrated manual
  demo was replayed at 1920×1080 and 1280×720. Actual projector/back-row
  readability, phone camera capture, Safari and Firefox are **not verified in
  this step**. Follow the existing projector checklist. Page scrolling is needed
  to view a full 800×600 canvas plus controls on a 720-high display.
- Code and evidence are local on the presenter Mac on this feature branch.
  Nothing in this step makes them available on another computer or deployed
  course. The original JPEG contains GPS metadata and stays outside Git. The
  existing metadata-free PNG is the reproducible repository input.

## Verification

Browser plugin not available; used the repository's established Playwright CLI
with local Chrome. The flow under test was local question 254 → photo upload →
immediate on-canvas reference → native editing → Save & Grade → restoration.

| Checks | Result |
|---|---|
| Offline Node suite, including four reference-fit/storage tests | 127 tests passed |
| Existing Python server/grader suite in the local container | 5 tests passed |
| Three real-photo canvas cases | 69 assertions passed |
| Error/replacement/stale/storage/mobile/image-only/draft recovery | 21 assertions passed |
| Existing native-adapter browser regressions | 165 assertions passed |
| Existing optional CV-assisted review regressions | 139 assertions passed |
| Frozen Step 4F manual acceptance body, with Photo options entry click | 84 assertions passed |

The existing browser suites changed only their entry clicks to open Photo
options. The Step 4F body/tolerances were reused unchanged by a separate wrapper;
the old standalone entry script does not itself open the new disclosure.
Totals: **132 Node/server tests and 478 browser assertions**, all passing.
The final UI had no application errors in the acceptance runs. Main canvas
tests also blocked and recorded external requests: none occurred.

The frozen manual evaluator still measures about **3.50 source-pixel p95**
bidirectional error on IMG_1670 and no invented connections. Its native rendered
drift is below 0.001 source pixel. Those are **manual trace/adapter** results
against approximate single-observer references, not CV recognition accuracy or
independently validated mathematical calibration. See
[manual evaluation](results/manual-regression/evaluation.json).

One initial recovery assertion incorrectly expected the empty answer to receive
a numeric 0%, then counted an unrelated hidden 100% label. Actual evidence
showed Invalid / not gradable throughout. The test was corrected to check that
feedback and the empty native payload. No grader behavior was changed to pass
the test. All final checks above passed.

## Evidence and reproduction

- [Three-photo behavior and native submissions](results/acceptance/results.json)
- [Failure and recovery checklist](results/recovery/results.json),
  [image-only rejection](results/recovery/image-only-submission.png),
  [narrow canvas](results/recovery/mobile-canvas-reference.png)
- [Actual workflow captures](results/workflow.gif): a labeled sequence of actual
  browser screenshots, not continuous video; upload/CV, hide/show, native drawing,
  native correction, then saved/restored state
- [Native regressions](results/native-regression/results.json),
  [advanced review regressions](results/advanced-regression/results.json)
- [Protected files and backup hash](results/protected-files.json),
  [input hashes/provenance](input-manifest.json),
  [test commands](TESTING.md), [self-test/presenter route](DEMO.md)
- [Credential safety check](results/credential-check.json),
  [file inventory](results/file-inventory.json), [test logs](results/logs)

## Assessment and next decision

The architecture supports a direct, non-interfering canvas reference. This
removes the visibility/editing barrier without weakening native import or
grading. It does **not** solve automatic real-photo geometry or scale recovery.
For tomorrow's demonstration, show the new failure recovery honestly and retain
the calibrated manual route and untouched recorded backup for geometric
faithfulness. Do not spend the remaining time on another recognition experiment.

Stop after the local commit for user review. Any further implementation,
projector rehearsal, inference or deployment needs the appropriate approval.
