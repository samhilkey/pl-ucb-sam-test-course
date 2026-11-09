# Step 4H — Architecture and bounded offline hybrid proof

**Offline integration proof: PASS. Real-photo hybrid acceptance: BLOCKED.**
Meaningful measured native objects were created, edited, graded and restored
for controlled development rasters. On the independent handwritten photograph,
coarse human-authored semantics still do not resolve calibration/connectivity.
There is no successful real Gemini hybrid result in this step.

Starting branch `feat/automatic-photo-recognition-cv`, clean at
`80b9f54b10e4fd1e206bde7d7cc3430d8b8301be`. All work is local. No Gemini calls,
external photographs, billing changes, push, merge, deployment or course changes.
The normal student UI, current recognizer, grading engine and Step 4F fallback
and recorded backup remain unchanged.

## Architecture and native-tool decision

The [architecture assessment](ARCHITECTURE.md) documents the installed native
tool formats and limitations. Actual question 254 has free-draw and filled-point
tools only. Polyline and spline are available in the installed library but use
native curve fitting in their gradeable data. Free-draw can accept exact cubic
controls; the existing adapter uses straight cubic segments through every
measured vertex. It supports whole-curve editing, not individual control handles.

This proof keeps free-draw plus point. A small explicit experimental path in
`star-native.js` validates `hybrid_development` provenance. Both a session opt-in
and an experimental receiving-config opt-in are mandatory. Existing point-tool,
range, function-contract, stale-token, canvas-snapshot and rollback checks remain.
No production question enables that path. `star-hybrid.js` is not loaded by the
normal UI; no automatic provider or new review wizard is installed.

## Semantic responsibility and measured fusion

The proposed [semantic prompt](semantic-prompt.txt) and
[JSON schema](semantic.schema.json) describe approximate normalized image regions
for axes, tick labels/values, origins, branches, endpoints, corners, extrema,
isolated dots and graph/non-graph classifications, with explicit uncertainty.
They prohibit dense curves, expected equations, graph coordinates and answer
repair. Their API/provider compatibility is not established by this offline work.

All four semantic inputs are **human-authored development fixtures**, not model
predictions. Their source is explicit in every proposal and result. No synthetic
or manually supplied semantic fixture counts as real Gemini recognition.

Local fusion selects complete existing measured CV paths in uniquely classified
regions. It uses existing exact-endpoint connectivity and small-component
centroids. It inserts no vertices, clips no paths, snaps no endpoints, fits no
equations and guesses no branch pairings. Axis/numeric/endpoint/corner/extremum
claims must agree with measured image evidence. A coarse box center is never
substituted for a stroke or dot coordinate. Missing numeric calibration stays
blocked; question coordinates or grading answers cannot fill it in.

The proof's native geometry is `needs_review`, `automatically_recognized:false`
and `semantic_source_kind:development_fixture`. One labeled, test-only explicit
confirmation imports it through the adapter. The resulting native objects then
save and restore without the experimental scripts. That temporary button is
not a shipped student feature or a completed hybrid UI.

## Actual acceptance evidence

| Input/source | Semantic input | Measured result | Native / grading result |
|---|---|---|---|
| New x-squared **controlled raster**, with printed labels | Human coarse fixture | One branch; image-derived numeric axes | Editable native curve, visible **100%** from actual x-squared grader; Save & Grade and refresh passed |
| Existing controlled sharp V | Human coarse fixture | One branch; corner preserved within 2.24 source pixels | Native curve, visible **0%** against x-squared target; native editing and edited Save & Grade/refresh passed |
| Controlled two disconnected branches plus drawn filled dot | Human coarse fixture | Two separate branches; measured dot at (520,100) | Two native curves plus independent filled point; visible **0%** against x-squared target; saved/restored and branch editing passed |
| Real user-owned `IMG_1670--source.png` | Human coarse fixture, uncertainty retained | 44 raw CV fragments; ambiguous classification/connectivity; no valid numeric calibration; a measured dot candidate | **Hybrid native import blocked.** Photo visible and independent native freehand recovery works; no hybrid submission/grade claimed |

The positive matching test uses a raster actually depicting x-squared; the
function is used only to draw the input and build evaluator-only references.
Only decoded pixels and coarse visible-image semantic fixtures enter recognition
and fusion. The known answer is not used to reconstruct or repair the curve.
The independent real photograph is not judged by its unrelated x-squared grade.

The matching test preserves an existing native point. The V and disconnected
tests preserve an existing curve and point; moving an imported branch leaves
all other curves/points unchanged. The separate source dot is a true native point,
but `auto-notes` has **no grading criterion**: 100% certifies the targeted function
criterion, not correctness of all point marks. The real-photo recovery gesture
is a manually drawn test mark, not faithful automatic reconstruction.

### Geometry and calibration, evaluated after inference

| Controlled fixture | Reference→CV p95 | CV→reference p95 | Coverage ≤3px | Max endpoint error | Origin error |
|---|---:|---:|---:|---:|---:|
| Matching answer | 0.705 px | 0.675 px | 100% | 0.60 px | 0.0048 px |
| Sharp V | 0.416 px | 0.415 px | 100% | 0 px | 0 px |
| Two branches + dot | 0.674 px | 0.654 px | 100% on each branch | 1.414 px | 0 px |

Each controlled case has the expected branches, no spurious path and no false
connection under the existing evaluator. Native state preserves every measured
anchor within 1e-7 native pixels, and native gradeable controls equal the stored
freeform controls. These results establish adapter fidelity separately from the
source-raster errors above. The controlled dot's centroid error is 0 pixels.

On IMG_1670 the dot candidate is approximately (822.68,296.15), about 2.73 pixels
from the prior approximate reference (821,294). Its classification uses the
human region and filled-dot declaration. It has no mathematical coordinate while
calibration is unknown and does not make the overall proposal importable.
There is **no accepted real-photo fusion geometry**, so its reconstruction
metrics are null, not zero error. The raw CV baseline and its false paths are
retained in [offline evaluation](results/offline-evaluation.json).

Controlled references derive from controlled drawing inputs; real references
are the prior approximate single-observer annotations. None establishes blinded
population accuracy. Existing automatic real-photo CV remains the prior 0/3;
the prior Gemini dense-geometry pilot remains its prior failed 0/1. This step
adds **zero real Gemini observations**, and no automatic hybrid success count.

## Tests and evidence

- 134 offline Node tests passed, including seven hybrid tests covering real-photo
  rejection, semantic contradictions, invented geometry, explicit confirmation,
  revision relabeling, opt-ins, provenance tampering and existing stale guards.
- 5 existing container Python/server tests passed; grading code unchanged.
- The final isolated hybrid/native browser proof passed **53 assertions**:
  actual native import, visible correct/incorrect grades, restoration, editing,
  unrelated objects, real-photo recovery and native format audit.
- Existing native browser regressions passed **165 assertions**; the unchanged
  Step 4F manual body passed **84 assertions**, including its presentation viewport.
- Existing optional CV-assisted review regressions passed **139 assertions**;
  no production workflow or test assertion was weakened for this step.
- Independent Ajv JSON Schema validation passed all four semantic fixtures.
  Local semantic validation also checks box ordering and evidence consistency.
- Browser plugin not available; used the existing Playwright CLI with local
  Chrome. New isolated proof viewport 1440×1100; the native/manual regression
  suites also cover their existing mobile and presentation viewports. Actual
  projector/back-row readability is not established here.

See [browser checks and native state](results/browser/results.json),
[matching-answer grade/restoration](results/browser/matching-answer-controlled--graded-restored.png),
[real-photo blocked recovery](results/browser/IMG_1670--blocked-reference.png),
[native-tool audit](results/browser/native-tool-audit.png),
[native regressions](results/native-regression.json),
[manual regressions](results/manual-regression.json), [logs](results/logs),
[reproduction commands](TESTING.md), [protected files](results/protected-files.json)
and [file inventory](results/file-inventory.json).

No failed implementation tests remain in the final run. Real-photo import
rejection is an expected safety result and a **failed recognition objective**,
not a successful real-photo acceptance case.

An initial new negative test added a warning to an `automatic` source fixture,
which the existing geometry validator correctly rejected before reaching the
new warning check. The fixture was corrected to `needs_review`; validation was
not relaxed. The initial failure log is retained separately from final results.

## Is another semantic Gemini request justified now?

**Not yet for the photo-to-native objective or November 9 demo.** Even the
human-authored coarse semantics do not let the current local measurements
resolve this photograph. Another API response would not establish precise
geometry, calibration or a working native route by itself. The controlled proof
shows that transport/native conversion is feasible; the present blocker is
real-photo grounding. Keep the tested manual-assisted demo and its backup.

A later semantic-only research call could test provider region/topology quality,
but should have a separate narrow hypothesis and fresh authorization. The
previous one-request grant is consumed. The same exact metadata-free PNG is a
candidate only; prior Step 4G-2 permission is not treated as a new Step 4H call
grant. Reconfirm the exact-image transmission scope and applicable account/cost
gates before any such request. This step has **no request runner or live request**.

With the demo tomorrow, completing local crossing separation, numeric OCR,
short correction UI, a fresh provider pilot and independent real-paper acceptance
is not a dependable remaining schedule. Recommend freezing the manual demo and
reviewing one bounded offline grounding follow-up afterward. No checkpoint is
skipped and no future phase starts in this commit.
