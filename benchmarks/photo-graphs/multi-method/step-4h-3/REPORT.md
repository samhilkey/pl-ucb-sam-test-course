# Step 4H-3 — native-import diagnosis and gated semantic provider

**Overall recognition verdict: FAIL.** The actual `IMG_1678.jpg` photograph still
does not produce a faithful, gradeable native graph without tracing/correction.
The failure is reproduced and localized. This step does not claim a completed
hybrid photo-to-PrairieLearn workflow.

No Gemini inference, photograph upload, paid service, push, merge or deployment
occurred. The normal upload remains local **CV automatic**. The frozen Step 4F
manual implementation and portable backup are unchanged.

## Exact failure

The original JPEG SHA-256 is
`f86a0acd1dc1fcad32884c202e4fffe44adc5d88c1062a0f8a2cbd60dbc74d49`.
Local Chrome tested those actual bytes, not a semantic fixture. Its metadata-free
PNG from Step 4H-2 has SHA-256
`bc1a75a4f46e0ebc43d43cfb26942d15306a69cc25530ae57309bd3f1a8dd9d9`.
The original JPEG, which contains location metadata, remains outside Git.

Automatic CV reports `needs_review`, uncertain numeric calibration and no native
curve. Selecting the existing measured route using two endpoint clicks and
manually confirming O/X/Y still fails the existing function-input guard. Under
that **manual** frame, the only reverse segment is at the top-right endpoint:

| Item | Measured result |
|---|---|
| Original source fragment | `stroke-16` |
| Ordered source pixels | (1181.515, 269.022) → (1188.341, 271.296) |
| Reverse x extent | 0.0417507 graph units; 2.71379 native pixels |
| Nearest skeleton junction | 303.04 source pixels away |
| Nearest attached marked point | 241.54 source pixels away |
| Duplicate positions | No |

The original enlarged crop visibly contains this small terminal hook. It is not
an axis/label crossing, duplicate vertex, attached-dot detour or junction pairing.
Reversing the traversal still fails, as expected. The skeleton follows visible
terminal ink. Whether this is an intentional mathematical turn or a pen-end serif
is **unknown**; this investigation does not infer the student's intent.

Neither sorting vertices by x nor deleting the hook would preserve the measured
drawing. The function guard and its `1e-7` native-pixel epsilon remain equivalent
to their previous behavior. No equation, ideal curve, gap fill, clipping,
endpoint trimming or geometry repair was introduced.

See `results/diagnosis.json`, `results/endpoint-original.png` and
`results/endpoint-backtrack.png`. Run `node
benchmarks/photo-graphs/multi-method/step-4h-3/diagnose.cjs` to reproduce the
diagnosis. Prior manual anchors are evaluator-only inputs to this diagnostic,
not automatic calibration or model input.

## Student-visible change

`star-native.js` now attaches precise offending source segments to the rejection.
`star-canvas-review.js` marks the measured turn in red and says that no curve was
imported. Alignment-only completion explicitly says the photo is a reference,
that students must draw native geometry before Save & Grade, and that an empty
native answer is Invalid. It does not disable ordinary submission or fabricate
an answer to conceal this failure.

The actual local test route is
`http://localhost:3000/pl/course/1/question/254/preview/`.

1. Upload the original `IMG_1678.jpg` from the user's examples directory.
2. Inspect native `si.getState()`: `data['auto-ink']` is empty.
3. Choose **Align / select graph ink**. Select O≈(842,1147), written x=4 at
   (1490,1130), written y=4 at (826,517), and the two curve endpoints near
   (483,310)/(1193,275). These are explicit **CV-assisted** interactions.
4. **Preview selected graph** remains blocked; the terminal hook is marked red.
   The accept button does not appear, and native curves remain empty.
5. **Use alignment & draw** aligns only the image. Without actually drawing,
   **Save & Grade** returns **Invalid** for the fully empty native answer.
   Refresh restores the reference, not an invented recognized curve.

No manual curve or point reconstruction is used as evidence of automatic
success in this test. A separate controlled raster verifies the existing
calibrated path: upload → review → explicit acceptance → actual freeform controls
in native state → native Select editing → Save & Grade → exact drawing restoration.
Its 100% grade is a **controlled-raster result**, not a real-photo result.

The existing native free-draw tool is used because its rendering and gradeable
data preserve the same straight cubic segments. Polyline/spline are not configured
in this sandbox and their fitted grading/rendering behavior was previously
audited; this step does not switch tools to evade the function constraint.

## Server semantic boundary

Implemented `server/star-gemini-semantic.cjs`, using the unchanged Step 4H coarse
semantic prompt/schema and the previous Interactions request shape. It supports
offline preparation, a locked one-attempt server transport, strict JSON/envelope
validation and binding back to CV run on the exact local PNG. Model output can
only classify coarse regions/topology/ticks/uncertainties; dense vertices come
from measured CV. Mock, human-development and real-provider provenance stay
distinct. Reviewed semantic geometry uses the existing experimental native gate,
one-use proposal token, stale-state check and ordinary function/bounds checks.

**This is a tested server module, not a connected live student-provider route.**
The production/student upload does not invoke it. Actual Gemini semantic output,
provider schema compatibility and the effect on this photograph are untested.
The existing conservative region grounding still blocks uncertain calibration,
ambiguous junctions, missing/contradictory labels and unresolved points. It cannot
claim to have solved real-photo calibration or attached-point semantics.

`results/semantic-preflight.json` freezes a 2,879,020-byte offline payload, SHA-256
`e33a94b89c0bc41217f1e26193140416884dfe68e52622e052bdfda01a6c6416`.
No payload bytes were transmitted. The new PNG has **no external-use clearance**;
the consumed Step 4G-2 permission covers another file and does not transfer.
No approved live grant or execution entrypoint is supplied. See
[`server/STAR-SEMANTIC-PROVIDER.md`](../../../../server/STAR-SEMANTIC-PROVIDER.md)
for the concrete, fresh approval and no-cost gates.

| Provider evidence this step | Result |
|---|---|
| Real API requests / tokens | 0 / 0 |
| Incurred inference cost | $0: no requests |
| Current model/account access | Not reverified; no authenticated call |
| Future reported monetary cost | Unknown until independently established |
| `.env.local` | Loads; ignored; presence-only check |
| Credential in browser or artifacts | No; staged audit recorded separately |
| UI/provider integration | Not connected; normal UI remains CV-only |

## Validation and evidence

Final commands, counts, logs, native states and screenshots are indexed in
`results/verification.json` and `results/FILE-INVENTORY.txt`. Browser testing uses
the installed Playwright CLI wrapper because a Browser plugin/skill is not
available. Chrome, 1440×1100 desktop and 390×844 mobile are exercised. The frozen
manual suite also rehearses 1280×720 presentation layout. No physical projector
test or general browser-compatibility claim is made. Local SketchResponse font
decode warnings remain an existing environment limitation.

During test development, an assertion incorrectly compared toolbar activation as
geometry; it was corrected to compare actual drawing objects. An ungraded prior
point made another trial nonempty; the empty-answer reproduction and prior-object
preservation are now separate trials. An oversized test result included raw mask
arrays and exceeded the CLI buffer; the observer now records geometry/method/marks
only. The first native regression invocation omitted the CLI wrapper; the corrected
command is recorded. These were test-harness problems, not recognition successes.
An initial credential-check command used the wrong filename; the actual
`step-4c/check-gemini-env.cjs` check succeeded without displaying a credential.

## Assessment and next decision

What worked: exact diagnosis, honest native-state feedback, rejection without
data loss, offline server gates, controlled native import/edit/submission/restore,
and the frozen manually assisted fallback.

What failed: automatic numeric calibration and faithful unchanged native import
of `IMG_1678`; there is no successful real Gemini semantic result or actual hybrid
UI flow. Four embedded filled marks remain part of the measured ink rather than
automatically resolved point semantics. No independent blinded centerline accuracy
score or automatic real-photo 100% grade is claimed.

**Recommendation:** retain the independently tested manual-assisted November 9
demo and describe recognition as research. Review how a function-input question
should handle this visible endpoint hook before spending another inference request.
A future semantic pilot needs separate exact-PNG permission and one-request
approval; it may clarify structure but cannot guarantee native compatibility or
faithful calibration. Completing broad hybrid recognition before the next-day demo
is not supported by this evidence. No approval checkpoint should be skipped.
