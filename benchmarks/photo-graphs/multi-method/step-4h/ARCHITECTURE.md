# Step 4H architecture assessment — offline integration first

The complete real-photo hybrid is **not yet implemented or accepted**. This
step provides a measured-CV/semantic-region proof and native integration gates,
not an enabled Gemini provider. The current assisted demonstration stays available.

## What the actual question supports

Inspected the live question 254 configuration, `pl-sketch.js`, `pl-sketch.py`,
`star-native.js`, `star-geometry.js`, `star-recognition.js`, `star-automatic.js`,
the installed `@prairielearn/sketchresponse` **0.2.1** package and its shipped
source maps. The [runtime audit](results/browser/results.json) uses actual
`getState()`, `setState()`, `getGradeable()` and a native polyline-vertex drag.
Extra tools were constructed only in an isolated runtime canvas, not added to
the question. Coordinates below are native canvas pixels, not mathematical units.

| PL type → plugin | Tool available in question 254? | `data[toolId]` state | Editing | Gradeable behavior |
|---|---|---|---|---|
| free-draw → freeform | **Yes**, `auto-ink` | `[[{x,y}, ...]]`; each curve has 1+3n cubic controls | Whole-curve Select/drag/Delete; no individual cubic-control handles in this plugin | Supplied cubic controls retained as `{spline:[[x,y],...]}`. Hand drawing itself uses native fitCurve, but adapter insertion bypasses that fitting |
| polyline → polyline | No | `[[{x,y}, ...]]` straight vertices | Whole shape and individual vertex movement; vertex movement exercised | Display uses straight segments; **getGradeable runs fitCurve**, rounds controls to 0.01 pixel. Not interchangeable with freeform |
| spline → spline | No | `[[{x,y}, ...]]` anchor points | Anchor and whole-shape movement in installed source | Render and grade both use fitCurve through anchors, rounded to 0.01 pixel; do not assume preservation of sharp corners |
| point → point | **Yes**, filled `auto-notes` | `[{x,y}, ...]`, flat list | Individual point movement/Delete | `{point:[x,y]}`. This question has **no grading criterion for auto-notes** |
| line → line-segment | No | Flat endpoint pairs: `[{x,y},{x,y}, ...]` | Endpoints and segment movement | One straight cubic per pair; dangling endpoint is not graded |
| horizontal-line | No | `[{x,y}, ...]`; y is authoritative | Vertical movement | Horizontal cubic spanning plot bounds |
| vertical-line | No | `[{x,y}, ...]`; x is authoritative | Horizontal movement | Vertical cubic spanning plot bounds |

The server permits match-function grading for function curves, including
free-draw/spline/open polyline, but rejects line/axis-line types for that criterion.
Point grading uses other supported criteria such as undefined-in; adding a point
tool does not make its marks part of this question's x-squared grade.
No grading engine changes are proposed or made.

## Required native changes and current decision

Keep **freeform for measured strokes and point for measured filled dots** in
this bounded proof. The adapter encodes every CV segment as a straight cubic
with controls at one-third/two-thirds, preserving vertices, corners and gradeable
shape without fitting. A semantic description of a smooth curve is not sufficient
evidence to replace measured ink with a fitted native spline. Native polyline
would improve vertex editing, but its gradeable curve requires a separate
render/grade fidelity decision before adoption. It is not added speculatively.

`star-native.js` receives only a new opt-in, validated `hybrid_development`
provenance path. It requires **both** the session's `hybrid:true` and the receiving
config's `experimentalHybridGeometry:true`, exact recomputation of reviewed
provenance, the existing `assistedPhotoGeometry:true` preservation contract,
calibrated geometry and explicit commit. Existing coordinate bounds,
function-contract restrictions, point-tool eligibility/limits, one-use tokens,
native snapshot checks and rollback remain. Like the existing reviewed assisted
path, this explicit experimental mode retains overlapping student strokes;
the unchanged server still grades mathematical mistakes. Relabeling a hybrid
fixture as automatic is blocked.

No question tag enables this gate. The new module is **not in info.json** and no
normal student UI loads or invokes it. The browser proof adds a labeled temporary
confirmation button and injects the module only into its isolated test session.
After refresh, ordinary native objects restore without that module or button.

## Intended separation of responsibilities

1. **Image identity and permission:** keep the metadata-free original, hash,
   revision, permission scope and source dimensions together. Hash the exact
   file before recognition; bind the output to that hash/revision. Future server
   transport keeps credentials private and never receives the grading answer.
2. **Semantic observation:** Gemini, only after new authorization, would return
   [this coarse contract](semantic.schema.json) with the [new prompt](semantic-prompt.txt).
   It describes axes/tick labels, branch regions/connectivity, endpoints,
   corners/extrema, dots and exclusions with explicit uncertainty. It supplies
   no dense curve, ideal equation or mathematical-coordinate reconstruction.
   Schema/API compatibility and real model accuracy are **not yet verified**.
3. **Local pixel measurement:** retain CV centerlines and component centroids.
   This first proof selects complete existing CV paths inside semantic regions;
   it does not crop paths, erase axis rows, join gaps or invent vertices. Exact
   shared degree-two endpoints may be joined by the existing verified helper.
   Crossings, partial/overlapping region classifications and contradictory
   branches stay blocked. Small dot candidates need measured compact filled
   components, not the center of a semantic box.
4. **Coordinate evidence:** the proof requires the existing CV's photo-detected
   numeric labels on both axes and cross-checks semantic label values/regions,
   origin, directions and endpoint/corner/extremum regions. Missing or
   contradictory evidence does not become a transform. It currently supports
   only zero-valued intersections and this narrow upright OCR vocabulary.
5. **Native draft and confirmation:** after one explicit comparison, measured
   geometry enters the existing native adapter. Independent branches/dots stay
   independent. The final graph uses ordinary native state, editing, submission
   and restoration. Preview visibility does not constitute import or accuracy.

The outer provenance states `hybrid_development`, `automatically_recognized:false`
and `semantic_source_kind:development_fixture`. Calibration is measured by the
existing CV and then explicitly confirmed. The reused assisted compatibility
fields say student-confirmed; the outer record preserves the original CV
numeric labels and the exact fixture, rather than claiming new automatic OCR.

## What remains before a real-photo pipeline

On IMG_1670 the existing skeleton still contains ambiguous branch/axis fragments,
and the current OCR does not establish numeric calibration. Coarse human regions
alone do not solve either. Region-specific extraction/axis-crossing separation,
better local numeric grounding and a short on-canvas correction action remain
unimplemented. The existing safe photo reference/manual route handles recovery.

The future minimal correction should ask only for the unresolved datum—for
example one origin or one known tick/value on an unresolved axis. If both axes,
scale and topology remain ambiguous, do not disguise a long manual workflow as
a short correction. Use the tested manual fallback. This step does not introduce
a new wizard or replace that fallback.

The requested matching-answer **real photograph**, real semantic-provider
response, automatic real-photo native acceptance, hollow endpoints/arrows,
non-function loops/backtracking, perspective calibration, native vertex-level
freeform editing and normal-UI hybrid integration remain incomplete. A
controlled x-squared raster is only a positive grading/integration check.
