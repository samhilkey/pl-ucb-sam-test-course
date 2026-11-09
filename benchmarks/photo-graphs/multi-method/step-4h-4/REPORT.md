# Step 4H-4 — accepted, vertex-editable photo drafts

**CONDITIONAL PASS for the CV-assisted editable-draft experience on IMG_1678.**
The actual photograph now produces a nonempty native polyline after explicit
acceptance. The student can drag individual vertices, submit it, and restore it.
It is no longer restricted to an ungraded background or whole-object movement.

**Gemini/hybrid recognition remains BLOCKED.** The one newly approved semantic
request returned HTTP 400 because Google rejected the frozen output schema as
having too many constraint states. No semantic prediction was returned or used.
No retry, second request, new payload, provider/model switch or paid fallback ran.

## Actual real-photo result

The UI tested the original user-owned `IMG_1678.jpg`, SHA-256
`f86a0acd1dc1fcad32884c202e4fffe44adc5d88c1062a0f8a2cbd60dbc74d49`.
It is an existing development/recovery case, not held-out validation.

| Outcome | Observation |
|---|---|
| Photo visible | Yes, the same original JPEG stays on the canvas |
| Fully automatic numeric calibration | No; still uncertain |
| Assistance required | Three on-photo axis clicks and the written x/y tick values |
| Curve retracing, endpoint clicks, fragment checklist | None in this route |
| Provisional prediction | Visible preview, no native answer mutation |
| Student acceptance | **Edit detected graph** creates actual native objects |
| Native representation | One open polyline, 43 measured vertices; native empty trailing placeholder retained |
| Original terminal hook | Retained, highlighted, and editable |
| First Save & Grade | Valid submission, **0%**, with the non-function turn preserved |
| Student correction | Drag only the hooked endpoint 12 native pixels to the right |
| Corrected Save & Grade | **100%** observed in this run |
| Undo / Redo | Restores the measured hook / student's vertex correction |
| Refresh | Restores the exact accepted/edited native vertices and existing point |

The 100% result follows **manual axis confirmation and a student vertex edit**.
It is not automatic recognition accuracy, an automatic mathematical correction,
Gemini success, or evidence that other real photographs will work.

## Geometry and grading fidelity

The suggestion reuses whole, uniquely connected CV paths with long routes and
endpoints away from the confirmed axes. It does not sort vertices by x, join gaps,
trim endpoints, fit an equation or infer a target curve. Competing routes and
overly complex fragments fall back to optional detailed selection/manual tracing.
The source image and complete CV observation remain in proposal provenance.

Native anchor preservation was **0 native pixels error** in the acceptance run;
source-coordinate round-trip error is recorded in `results/fidelity.json`.
The real measured hook remains approximately **0.0418 graph units** of reverse x
until the student changes it. Only one vertex changed in the demonstrated edit.
`IMG_1678--accepted-native-overlay.png` and
`IMG_1678--student-edited-overlay.png` show original versus reconstructed geometry.

The pre-edit polyline has 100% dark-ink support within three source pixels under
the recorded gray threshold. This is **only an ink-support diagnostic**: axes and
labels also count as dark ink. There is no independent blinded centerline/topology
reference, and reference coverage, missing/invented geometry rates and general
recognition accuracy remain unestablished. Embedded dark marks remain in measured
path geometry and the photo; their filled-dot semantics are not automatically
resolved. Isolated-point recognition is not provided by this quick suggestion.
Native preservation of separate branches, sharp vertices and measured isolated
points is covered separately by a labeled controlled adapter regression.

The sandbox's new `auto-draft` tool is an actual **open polyline** with native
vertex dragging. It preserves straight measured segments and corners. Spline
was inspected but not selected because interpolation would change geometry
between measured anchors. The existing `auto-ink` free-draw and `auto-notes` point
tools remain available.

The function grader now explicitly includes **both `auto-ink` and `auto-draft`**.
`auto-notes` remains an ungraded annotation tool. The stock polyline grader fits
a curve through the vertices and rounds shared vertex objects in place. The
opted-in adapter therefore:

1. Emits straight cubic segments matching the rendered native polyline.
2. Preserves exact user vertices while retaining native finalized-shape placeholders.
3. Independently reconstructs the same gradeable segments from submitted native
   state on the server; a client-supplied ideal answer cannot replace the drawing.
4. Saves non-function turns as incorrect mathematical answers rather than invalid
   unsavable data. This guard applies to the configured function criterion.

A separate **controlled raster** grades 100% unchanged and 0% after dragging one
vertex far from the curve, proving the new tool is graded. This controlled result
is not counted as real-photo recognition evidence.

## Safety and scope

`editable-photo-draft-tool="auto-draft"` is enabled only in the local sandbox.
The default strict adapter remains unchanged for other questions. The new gate
requires a calibrated Photo Geometry v1 proposal and a configured, editable,
graded open-polyline tool. Finite coordinates, bounds, corrupt-state checks,
explicit acceptance, one-use proposal tokens, input revisions, stale-canvas
rejection and append-only object isolation remain enforced.

The UI distinguishes provisional prediction, student-accepted native draft and
submitted native answer. Provisional raster layers do not enter native state or
submitted gradeable data. Existing drawings are preserved; stale acceptance is
blocked. Singular axis calibration is blocked. Arbitrary finite but wrong manual
tick values cannot be independently verified by this CV route; they remain the
student's explicit calibration decision and must be checked against the photo.

The normal controls are Upload / Take photo, Edit detected graph and Hide/Show
photo, followed by ordinary Save & Grade. Detailed ink selection, raw diagnostics,
free-draw editing and manual tracing remain optional in Photo options. Legacy
browser tests were adjusted only to open that optional entry; their assertions
and tolerances were retained.

The frozen Step 4F manual code and portable backup are unchanged. Its 84 browser
assertions pass. No production course, remote branch or deployed service changed.
All new implementation/assets are on this Mac's local feature branch only.

## Exact Gemini attempt

The user explicitly authorized the exact metadata-free PNG and exact frozen
semantic payload, and reconfirmed the unbilled STAR Sketch2Graph Free project.

| Item | Recorded evidence |
|---|---|
| Model | `gemini-3.5-flash-lite` |
| Transmitted file | `step-4h-2/inputs/IMG_1678--source.png` only |
| PNG SHA-256 | `bc1a75a4f46e0ebc43d43cfb26942d15306a69cc25530ae57309bd3f1a8dd9d9` |
| Request SHA-256 | `e33a94b89c0bc41217f1e26193140416884dfe68e52622e052bdfda01a6c6416` |
| Prompt/schema | Unchanged Step 4H generic semantic protocol; no target/reference/trace |
| Request count / retries | **1 / 0**; authorization consumed |
| Response | HTTP **400**, `invalid_request`: schema constraint has too many states |
| Latency | Approximately **2554 ms** |
| Prediction / token usage | None / not reported (`null`) |
| Monetary charge | Not independently reported by this error response |
| Paid exposure | User-confirmed $0 exposure on the unbilled Free project |

The cleared image bytes were transmitted even though the request failed. The
original GPS-bearing JPEG was not sent. The server reserved a durable one-shot
journal before the request; it cannot be reused. No billing change occurred.
`GEMINI_API_KEY` stayed server-side in the ignored local environment and request
header. The normal UI makes no Gemini requests and does not require a key.

See `execution-authorization.json`, `results/offline-preflight.json`,
`results/consumed-preflight.json` and `results/provider/`. Current model execution
availability is not established by a schema rejection; no authenticated model
listing or additional probe was made. Instantaneous quota remains unknown.
A smaller provider schema may be prepared in a later step, with strict local
validation retained, but its compatibility is untested and another request needs
fresh, payload-specific approval. No such retry was made here.

## Tests and known limitations

Final commands, source hashes, counts and logs are indexed in
`results/verification.json`; all files are listed in `results/FILE-INVENTORY.txt`.
Browser evidence uses the installed Playwright CLI because a Browser plugin/skill
is unavailable. The current runs pass **152 Node tests, 10 Python server tests,
and 360 browser assertions** (43 new draft, 165 native adapter, 84 frozen manual,
21 recovery, 47 optional CV-assisted).

Tests found and resolved the stock rounding mutation. Earlier browser harness
clicks hit adjacent overlapping handles; the replay uses an exposed part of the
native endpoint handle. Dense vertices can still be fiddly, especially on touch
screens. A first recovery command omitted the Playwright wrapper and was rerun
correctly. No acceptance assertion was removed or loosened to hide a failure.

Chrome desktop, the new draft at 1280×720, and a 390px mobile calibration view are
tested. The frozen manual rehearsal also covers 1280×720. A physical projector and live new-draft touch editing
are not verified. Existing SketchResponse font-decode warnings remain in the local
environment; there are no page exceptions in the passing workflow tests.

The quick draft is conservative and may omit short branches/dots, abstain near
axes or block competing paths. A valid affine frame does not prove uniformly
spaced handwritten ticks. This is a single-case CV-assisted usability result,
not general photo recognition. Gemini semantics did not resolve these limitations.

## Demo decision

The November 9 demo is **today**. Use the tested CV-assisted native draft with
its disclosed axis confirmation and student edit; retain the unchanged manual
and recorded offline backups. The presenter script and exact local paths are in
`PRESENTER.md`. General hybrid recognition before the demo is not supported by
the observed evidence. Recommend freezing this route and deferring further
Gemini requests to a separately approved schema-compatibility step.
