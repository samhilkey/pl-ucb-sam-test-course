# Step 4H-2 — Visible on-canvas correction and real-paper acceptance

**Overall: CONDITIONAL PASS for the assisted sandbox workflow. Automatic
real-photo/hybrid recognition remains FAIL.** The actual normal question UI now
creates meaningful editable native geometry, rather than stopping at a photo
overlay or an offline proof. Both real photographs require human assistance.
IMG_1670 still has material CV geometry error; IMG_1678's CV path remains blocked
by the existing function-input safety check. No general recognition or full
calibration-accuracy claim is made.

Branch: `feat/automatic-photo-recognition-cv`, clean starting commit
`e980d7a4c9fb959c4cadf2fd66bdd67cfde143c8`. No push, merge, deployment, Gemini call,
external photograph transmission, billing change or grader modification.

## Visible normal interface

Open **http://localhost:3000/pl/course/1/question/254/preview/** and reload.
Upload / Take photo still displays the original ungraded photograph immediately.
There is now a normal, visible **Align / select graph ink** action beside the
existing canvas controls. A calibrated automatic candidate instead offers
**Review detected graph**. These actions use the actual receiving sketch canvas,
not the advanced dialog or a test-injected button.

Before/after evidence: [previous canvas-only reference](../step-4g-4/results/acceptance/IMG_1670--photo-and-cv.png),
[new on-canvas aligned review](results/normal-ui/03-aligned-preview.png),
[actual native objects](results/normal-ui/04-native-created.png) and
[new real-paper 100% saved result](results/new-paper/06-prepared-original-restored.png).

For uncertain calibration, the student places O=(0,0), a known x tick and a known
y tick **on that photograph**, entering the two written values independently.
They click each curve's two visible endpoints and any separately measured filled
dot. The system reuses uniquely connected existing CV paths. It does not require
44 keep/exclude decisions or a second trace of successfully selected ink.
Unselected strokes/marks are explicitly excluded. The green preview is still
ungraded; **Accept as editable graph** creates real native objects only after
validation and explicit acceptance.

When CV cannot safely supply the curve, **Trace instead** captures the actual
pointer path on the same canvas and uses the existing geometry-preserving manual
adapter. Separate gestures remain separate branches. It captures pointer-up,
retaining the final endpoint. Filled marks touching a curve can be placed with
native **Other marks** after import. **Use alignment & draw** also makes an
aligned reference available for ordinary native drawing; that native freehand
tool retains its existing smoothing/trailing-end behavior.

The photograph and provisional guides remain raster-only foreignObjects, outside
native data. Alignment transforms the reference using the selected coordinate
frame, rather than fitting/rescaling a curve to a target. Accepted alignment is
scoped to the same tab/attempt/photo and restores with the photo; an unaccepted
preview has no import token after refresh. The original File/hash stays local.

## Two actual real photographs: independent outcomes

| Outcome | Original IMG_1670.jpg | New original IMG_1678.jpg |
|---|---|---|
| Photo visible inside native canvas | Yes | Yes |
| Initial automatic curve information | 44 fragments; uncertain axes/scale | 64 fragments in Chrome; uncertain axes/scale |
| Automatic calibrated native import | **Blocked** | **Blocked** |
| Short endpoint-guided CV selection | One unique route, three measured fragments; selected isolated dot | Unique route found, but x reverses locally; **native import blocked** |
| Working actual route | **CV-assisted:** three axis picks/values, two endpoints and dot selection; no retracing | **Manually traced:** same on-canvas calibration, Trace instead, then four manual native point placements |
| Native geometry created | One added freeform object + one filled point | One added freeform object + four manually placed filled points |
| Existing objects retained | Prior curve and point | Prior point |
| Original Save & Grade | **0%**, format accepted; photograph differs from target | **100%**, format accepted against the existing x-squared target |
| Native editing, resubmission, refresh | Passed; prior curve and both points retained | Passed; all five points retained; deliberately moving curve changes current grade to **0%** |
| Classification | Targeted CV assistance, **not automatic/Gemini** | Manual pointer transcription and point placement, **not CV recognition** |

The new photograph was explicitly supplied as user-owned actual paper, frozen
before its initial recognition:

`f86a0acd1dc1fcad32884c202e4fffe44adc5d88c1062a0f8a2cbd60dbc74d49`

See [freeze record](IMG_1678-frozen.json). The original JPEG has GPS metadata and
stays outside Git. Its [metadata-free decoded PNG](inputs/IMG_1678--source.png)
is a real-photo copy, not a generated fixture. The untouched first local PNG
run had 63 fragments; actual Chrome JPEG decoding had 64. Neither established
axes or numeric scale. The CV code was not tuned for this photograph. It later
served as a manual-recovery development case, so its assisted result is not
held-out or blinded automatic validation.

The matching x-squared photograph's equation was used **only by the unchanged
server grading criterion**. Recognizer instrumentation records its options as
only `inputRevision`; decoded pixels are the other input. No target, reference,
manually calibrated point or annotation entered recognition. Manual coordinate
correction and pointer tracing are explicitly downstream assistance.

The controlled raster is separate: its normal **Review detected graph** route
creates a native curve after acceptance and receives 100%. That confirms the
positive automatic UI/adapter path only on a controlled input; it contributes
no real-photo recognition success.

## Why recognition is still blocked

IMG_1670's long-axis detector assumes an upright axis has enough support along
one image row/column. The photographed axes bend/tilt. Its candidates include
background bands and the right photo edge instead of a unique actual axis pair.
Its numeric reader also requires regular grid evidence and recognizable isolated
positive bitmap-style digits; these handwritten, ungridded labels provide neither.
IMG_1678 has the same unsupported grid/label situation and no detected axis pair.
Expected x-squared values never fill those gaps.

The 44 IMG_1670 paths are not 44 answer branches. The answer is connected to axis
ink at junctions. Endpoint selection identifies the unique connecting route and
keeps only the original three measured fragments. Every edge on that route must
be indispensable: an alternative route through a loop is rejected rather than
paired by guess. Disconnected ink is never bridged; duplicates and shared-route
ambiguity remain blocked. Only exact shared endpoints are joined.

The old human coarse semantic fixtures were insufficient to uniquely classify
all these fragments and calibrate the image. They are not loaded into production.
The new route obtains branch identity from student endpoint clicks. That is human
assistance, not silently substituted Gemini output.

On IMG_1678, the actual selected CV path reverses x by about **0.0418 graph units**
in one segment after the student-supplied affine mapping. `star-native.js`
continues to reject it: **“A stroke doubles back in x. This function-input
question requires correction.”** No CV objects are added. The new manual trace
route is a genuine alternative; it does not relax that check, trim the CV path,
fit a parabola or move marks to ideal coordinates.

## Fidelity, calibration and marks

[Evaluation JSON](results/fidelity.json) distinguishes measurement/import fidelity
from photo-transcription accuracy:

- **IMG_1670 CV-assisted:** reference→curve p95 **11.69 px**, curve→reference p95
  **11.90 px**, coverage within 3 px **53.94%**. One branch, no invented connection
  or spurious selected path. This still fails the prior 8 px photo-fidelity screen.
  Its mathematical mistake—an off-origin minimum—remains. The selected dot is
  about **2.73 px** from the prior approximate visual reference.
- **Native preservation:** imported measured/trace anchors and rendered segments
  differ from their input geometry by less than **1e-6 source pixel** on both
  cases. This means the adapter preserves the supplied geometry; it does not
  erase the preceding CV/trace error.
- **IMG_1678 manual route:** 21 retained trace vertices; captured endpoint error
  versus requested pointer positions is below **0.001 source pixel**. Native mark
  centers differ from manually selected photo locations by below **0.001 source
  pixel**. Those are manual-placement/import metrics, not automatic dot accuracy.
  There is no independent blinded full-centerline reference for this new photo;
  its overlay and actual grade do not establish pixel-perfect transcription.
- **Calibration:** the three chosen anchors map to their independently entered
  native coordinates. That is not proof of globally correct numerical calibration.
  Approximate post-hoc checks of other written ticks on IMG_1678 differ by up to
  **0.27 x units**. The paper's axes/tick placement is nonuniform and a single
  affine frame does not reproduce every written tick. This uncertainty remains.

Four IMG_1678 dots touch the curve; the current detector does not recognize them
as four isolated points. They were placed manually at photo locations, never at
ideal (x,y) values. `auto-notes` has **no grading criterion** in this question:
100% establishes the function criterion, not correctness of all point marks.
Native stroke width, color, point size and arrow/cap decorations are not preserved.

The ordinary native freehand tool was observed to finish roughly 73 source
pixels short of the final pointer position in the initial recovery replay. Its
installed implementation leaves a rubber-band tail and does not append the last
pointer-up position. The on-canvas **Trace instead** path addresses that concrete
endpoint loss through the already-tested manual adapter; the upstream native
plugin and frozen fallback are unchanged.

## Verification and limits

- **139 Node tests**, including five new targeted-selection/frame tests, passed.
- **5 existing Python/server tests** passed; grading engine unchanged.
- Actual normal UI: **47 assertions** on IMG_1670, positive controlled input,
  stale acceptance, rejected image, mobile and keyboard recovery.
- New real paper: **29 assertions** covering the real automatic failure, blocked
  CV path, manual trace, point placements, actual grade, native editing and refresh.
- Existing native regressions: **165 assertions**; optional advanced CV-assisted
  route: **139 assertions**; frozen Step 4F body: **84 assertions**; reference-only
  grading/storage/replacement recovery: **21 assertions**.
- Total **485 browser assertions**, all final checks passed. These are automated
  student-action replays in the actual local interface, not a human usability
  study, timed presenter rehearsal or observed student population.

Browser plugin not available; used established Playwright CLI with Chrome on the
confirmed presenter Mac. New UI checked at 1440×1100 and 390×844; the frozen manual
body also replays its 1280×720 presentation viewport. Actual projector/phone
camera/Safari/Firefox checks remain unverified. An initial native-suite timeout
passed on rerun after other large browser suites finished; no assertion was
removed. Two test harness issues were corrected: calibration comparisons must
use actual pointer-selected anchors, and visible grade badges include whitespace.
The actual native x-backtracking block remains a failed recognition outcome.

## Implementation and review

`star-targeted.js` derives selections from graph connectivity and verifies exact
provenance on replay. `star-canvas-review.js` supplies the normal on-canvas
calibration, endpoint/dot selection, manual pointer trace, preview and acceptance.
`star-canvas-reference.js` adds reversible affine display mapping and scoped
confirmed-frame persistence. `star-native.js` adds a separately validated
`targeted_cv` path while retaining bounds, function-input, point eligibility,
object isolation, stale snapshot, one-use token and rollback checks.

`info.json`, `pl-sketch.js`, scoped CSS and sandbox instructions wire the visible
controls. Existing freeform/point formats are reused. Native polyline/spline are
not added: their fitted gradeable behavior was audited in Step 4H and is not
appropriate for silently replacing measured geometry.

The recognizer, shared geometry contract, old manual trace builder, grading Python,
provider module, earlier evidence and frozen backup remain byte-identical; see
[protected files](results/protected-files.json). No file names, case IDs, target
equations or fixture geometry are embedded in the new production selection/UI
code. The provider boundary remains CV-only; Gemini requires a future server-side
transport, exact-image clearance and **fresh inference authorization**.

Photo persistence remains browser-tab/attempt scoped, at most 24 hours and four
million data-URL characters; storage denial tells the student to reupload while
saved native objects remain intact. The photo/preview cannot enter the submitted
answer. Pending proposals never survive replacement, cancellation, edits or refresh.

## Decision and next review

The user can now exercise a real, visible photo-to-native **assisted** workflow.
It is not a completed automatic Gemini+CV recognizer. Keep the frozen manual
demo/recorded backup available for November 9 and present the assistance honestly.
There is no dependable basis to promise general automatic recognition before
the demo or to spend another model call without a separate bounded hypothesis.

Review the [exact self-test steps](DEMO.md), [test commands](TESTING.md),
[native state/submission evidence](results/normal-ui/results.json),
[new-paper evidence](results/new-paper/results.json) and
[file inventory](results/file-inventory.json). Stop after the local commit.
