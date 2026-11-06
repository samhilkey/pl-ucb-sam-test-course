# Step 4G-2 v3 — One real Gemini request; geometry fidelity failed

**The authorized request succeeded; recognition did not.** Valid JSON and valid
Photo Geometry v1 did not produce faithful reconstruction. Paths, axes, tick
anchors and the isolated dot are substantially misplaced in the declared
source-pixel frame. The unchanged native adapter and isolated review UI blocked
import. No production recognizer or assisted-demo code changed.

**Recommendation: constrained assisted workflow for November 9.** Gemini
supplied limited semantic hints, but neither faithful geometry nor reliable
connectivity was established. Do not integrate VLM-only recognition. Any later
VLM-guided CV/coordinate-grounding research requires separate scope/approval.

## Exact authorization and execution

The user's quota-resolution instruction explicitly accepted UNKNOWN remaining
quota and authorized exactly one request. Historical peak usage was not treated
as a remaining balance or guarantee. STAR Sketch2Graph Free-tier key ownership,
no paid exposure, eligibility and the exact-image release remain user-confirmed.
No broad account review or extra authenticated metadata request occurred.

| Item | Actual evidence |
|---|---|
| Model | `gemini-3.5-flash-lite`, requested and returned |
| Endpoint | `POST https://generativelanguage.googleapis.com/v1beta/interactions` |
| Image | `../step-4g-1/results/IMG_1670--source.png`, 1688 × 1473 |
| Image SHA-256 | `9c8247ec0be7d4ca68c4536eea990a0c5b0fce6250e8478a13b5aa5a0e190231` |
| Request SHA-256 | `0cd99ad83965bfb96f8b8254e25fe99ea132c5b22eb39a3f944f1a5d6b75ac2c` |
| Size | 3,417,740 bytes, identical to the frozen construction |
| Calls / retries | **1 / 0**; one-use journal consumed |
| Time | November 6, 2026, 11:01:35–11:01:40 AM PST |
| HTTP / status | 200 / completed |
| Request latency | 5,379.66 ms |
| Usage | 1,503 input + 1,573 output = 3,076 total tokens; 0 thought/tool-use tokens |
| Other usage field | `initial_input_tokens: 3368`, retained without reinterpretation |
| Cost | $0 paid exposure under the user-confirmed unbilled Free configuration. API currency cost is unreported; no independent invoice audit. |

The user owns both drawing and photograph and cleared this exact PNG for the
unpaid service, confirming no identifying, confidential or uncleared material.
No other image, original JPEG or DrawEduMath photograph was uploaded.
[Permissions](permissions.json), [manifest](inputs.json),
[latest authorization](execution-authorization.json),
[pre-send checks](execution-preflight.json), [attempt](results/attempt.json),
and [cost/usage disclosure](results/cost-and-usage.json) preserve the basis.

The Step 4A prompt/schema and generation settings were unchanged: 8,192 maximum
output tokens, 120-second timeout, `store:false`, no tools, continuation, retry,
model switch or paid fallback. Only generic instructions/schema, dimensions
and the exact PNG entered the payload. No filename, reference, expected
equation, grader data, selected point or manual calibration was transmitted.
The later authorization superseded the former quota blocker in the historical
[protocol](protocol.json) and [offline audit](offline-preflight.json); the
payload itself stayed identical.

The server-only runner used Node 20's `--env-file` and an ignored private file.
The loaded key was checked locally against that file after execution without
displaying a value, fragment or credential hash. An exclusive, fsynced journal
is created before the sole HTTP call. Errors, redirects, timeouts and interrupted
attempts cannot retry; real calls cannot select another journal directory.
The response's `standard` service tier is not evidence of paid billing.

## Real observations and validation

[Raw response](results/response.raw.txt) and [exact output JSON](results/prediction.raw.json)
are real provider output, not fixtures. They were stored unchanged: no
credential/account identifier required redaction. JSON was not repaired or
stripped from code fences. The envelope, exact model, dimensions and original
observation schema pass validation.

Gemini returned four paths: two axes also included as answer strokes and two
separated, three-vertex curve pieces. Every `component_id` is null. It returned
two corner flags, eight terminal endpoint flags and one isolated point.
Provider uncertainty reasons/regions are empty; this does not establish accuracy.

The [Photo Geometry v1 conversion](results/geometry.json) validates as
`needs_review`. Every returned stroke vertex, endpoint and corner stays
unchanged. No curve fitting, smoothing, sorting, joining, rescaling or reference
correction occurred. Axis duplicates are flagged and retained. Null component
IDs receive explicitly unresolved bookkeeping IDs, not claims of known
physical connectivity. The isolated point stays in the
[observation sidecar](results/observation.json) with a blocking warning; the
curve-only adapter cannot import point semantics.

Numeric calibration uses only returned tick anchors. Maximum affine residuals
are 8.73px on x and 39.67px on y (8.48% and 20.88% of a unit), failing the
predeclared 3px/5% consistency screen. Calibration stays uncertain and **all
vertex graph coordinates remain null**. Question ranges never fill the gap.

The v1 contract's 900 × 785 processing frame describes a generated local
adapter preview **after** the response, not Gemini's internal preprocessing.
The full-size original PNG was transmitted. This does not rescale returned
source coordinates. Zero axis-support values are disclosed compatibility
placeholders, not measured image-support confidence. See
[validation](results/validation.json), [conversion](results/conversion.json)
and the [policy frozen before the call](conversion-policy.json).

## Matched photo fidelity

Primary Gemini metrics include **all four returned paths**, including the
mistaken axes. None was removed to improve the score.

| Method on IMG_1670 | Paths | Coverage ≤3px | Ref→output p95 | Output→ref p95 | Native result |
|---|---:|---:|---:|---:|---|
| CV automatic, existing baseline | 44 | 53.94% | 11.69px | 382.51px | Blocked |
| Gemini automatic, this request | 4 | **1.33%** | **503.35px** | **346.44px** | Blocked |
| Manually assisted, prior passing run | 1 | 91.27% | 3.50px | 3.49px | Saved/restored in Step 4F |

The manual result required human calibration/tracing and separate point
placement. It is not automatic recognition. Aggregate CV remains 0/3; Gemini
is **0/1**, with only one paired image. No population accuracy estimate follows.

Gemini coverage is 2.24% within 5px and 3.51% within 8px. About 98.55% of
returned path length is over 5px from the reference. Corner errors are 233.91
and 348.46px; maximum nearest-endpoint error is 594.20px. The dot `[544,167]`
is 304.73px from the annotated `[821,294]`. Correct dot/peak counts are only
semantic hints, not faithful recovery.

The actual curve is one continuous branch. Gemini splits its purported curve,
misses the curved trough and includes axes as answer geometry. Declared axes
intersect at `[488,558]`, visibly misplaced on the photo. Numeric values are
listed but anchors/text bounds are not faithful and scale is inconsistent.
Independent numeric frame truth is unavailable; no calibrated-axis accuracy
pass is claimed. The coordinate mismatch's cause is unestablished; no guessed
internal resizing transform was applied.

These are exploratory distances against approximate single-agent visual
annotations with about 6px uncertainty, not independent human ground truth.
Errors of hundreds of pixels clearly exceed it. The inherited false-connection
counter's zero does not establish correct connectivity when almost all ink is
missed. [Evaluation JSON](results/evaluation.json),
[comparison JSON](comparison.json), [raw overlay](results/gemini-raw-overlay.png),
[reference overlay](results/reference-overlay.png) and
[four-panel figure](results/method-comparison.png) preserve the findings.

## Native and isolated UI checks

The unchanged native session rejected the valid-but-uncertain v1 candidate:
“Recognition needs correction before native import.” No commit or native
import-related `setState` call occurred; existing objects remained unchanged.
[Native evidence](results/native-check.json).

A disposable local question-254 page replayed this saved response through the
existing candidate boundary/review dialog, explicitly labelled **VLM automatic /
saved real response / isolated test**. All bad paths and the point diagnostic
remained visible. Acknowledgment/confirmation were disabled, and a dispatched
attempted click preserved existing objects. Desktop and 390 × 844 views passed
10 assertions with no console/page errors or external requests. Reload removed
the page-only injection and restored normal CV. No production source changed;
no invalid graph was imported, submitted or graded.

This is safe-failure evidence, not deployed Gemini integration or a successful
native reconstruction. Browser plugin was unavailable; the existing Playwright
CLI drove local Chrome. Physical phones, Safari and projector were not tested.
[UI evidence](results/isolated-ui.json), [desktop](results/isolated-gemini-review.png),
[mobile](results/isolated-gemini-mobile.png).

## Regression checks and stop

105 offline tests passed: one-use request/error/redirect/timeout guards,
redaction, frozen payload, strict observations, geometry preservation and
existing CV/native/assisted/backup regressions. Fixtures are temporary and
tagged `test_fixture`; real-response validation rejects them. There was no
extra live diagnostic request. [Verification](verification.json) records exact
commands/counts; logs: [offline](results/offline-regressions.log),
[pre-send](results/pre-request-transport-tests.log), [browser](results/isolated-ui.log).

Offline reproduction only:

```sh
node benchmarks/photo-graphs/multi-method/step-4g-2/run-once.cjs
node benchmarks/photo-graphs/multi-method/step-4g-2/validate-response.cjs
node benchmarks/photo-graphs/multi-method/step-4g-2/evaluate-response.cjs
```

**Do not run `--execute` again or remove the journal.** The one authorized
request is consumed. [File inventory](file-inventory.json) and
[evidence hashes](evidence-manifest.json) cover the local commit. The earlier
[quota checkpoint](PREREQUISITES-v2.md) remains as history.

The working PrairieLearn demo and Step 4F recorded package remain unchanged.
Keep the passing assisted demonstration for November 9 and defer further
automatic-recognition experiments. No VLM/hybrid production integration is
justified by this result. Stop after the local commit for review.
