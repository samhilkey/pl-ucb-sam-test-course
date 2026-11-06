# Automatic photo recognition: staged implementation

This work follows the supplied STAR Sketch2Graph implementation brief. Each step
is one Git commit. After each commit, stop for the user's review and explicit
approval before beginning the next step.

## Commit sequence

1. **Baseline and branch:** audit the existing workflow and installed native
   plugins, run existing regressions, and record the integration boundaries.
2. **Automatic extraction:** add a browser-compatible deterministic CV recognizer,
   validated intermediate geometry, explicit calibration evidence, debug masks
   and overlays, and tests on actual image files. Report assistance and abstention
   separately from automatic success.
3. **Native import:** add a direct geometry adapter and automatic photo review in
   the test question; verify shape, editing, submission, and restoration.
4. **Real-photo recognition reliability:** prioritize the current 0/2 real-photo
   result for the November 9 demo, per the user's step-3 instructions. Broader
   landmark correction follows this recognition work.
5. **Evidence and validation:** run regressions and the five-case evaluation,
   save original/overlay/native comparisons, and report measured limitations.

The normal successful path must require no tracing, manual calibration, or
equation fitting. Preserve the student's visible mistakes, corners, endpoints,
and disconnected branches. Preserve the assisted workflow, native grading, and
unrelated drawing objects. Recognition must never receive grader functions,
solution drawings, or expected-answer geometry.

No VLM inference, paid model requests, external AI dependencies, experiment
merges, or changes to historical evaluation reports are authorized here. A later
recognizer must be able to return the same intermediate representation without
changing the native import interface.

## Step 1: baseline audit (2026-11-02)

### Repository and branch

- Repository: `https://github.com/samhilkey/pl-ucb-sam-test-course.git`.
- Starting checkout: clean `experiment/vlm-graph-recognition` at `5482e48`.
- Ran `git fetch origin --prune`; local `master` and `origin/master` both resolve
  to `547801c5148c6289806c731a059c225474bccc1d` (zero commits of divergence).
- Switched to `master`, then created `feat/automatic-photo-recognition-cv`.
- No source changes, merges, pushes, inference, or historical report edits in
  this step. Local runtime setup and this audit are the only additions.

**Important baseline difference:** the shape-preserving trace feature remains on
`feat/photo-trace-shapes` at `29983ef`, with implementation commit `ccada8f`.
It is not on current `master`. That branch adds trace models, simplification,
corner support anchors, and freeform control encoding. It remains intact and
has not been merged or cherry-picked. The master baseline still defaults to
mathematical fitting. The historical benchmark and VLM files are also on other
branches; they were not copied into this implementation branch.

### Existing photo-to-native flow

| Concern | Verified implementation | Reuse or change boundary |
| --- | --- | --- |
| Entry and isolation | `pl-sketch.py:render` enables the photo button only for editable question panels with `allow-hand-drawn="true"`; `SketchInput.instances[id]` exposes the live instance. | Keep the opt-in and per-canvas isolation. |
| Image loading | `star-photo.js:showPhoto` uses `createImageBitmap`, tries EXIF orientation, closes superseded bitmaps, and resizes the longest side to at most 900 pixels. `photoBmp` retains the decoded image; `MW`/`MH` define the processing frame. | Retain loading/race behavior. Add explicit original-to-processing transforms to recognition output; those are not currently exported. |
| View mapping | `canvasPt` maps pointer coordinates through the canvas bounding box into `MW`/`MH`. Zoom and pan are CSS view changes. | Keep view and processing coordinates separate. |
| Calibration | `markup.O`, `X`, and `Y`, plus the marker values, define an affine basis. `markupToGraph` inverts its determinant. `calibrationError` rejects zero/nonfinite values and nearly collinear handles. | Reuse the affine mathematics and targeted handles. Initial handle placement and values are defaults, not detected evidence. |
| Ink processing | `buildMask` computes a color-adjusted luminance and integral-image local threshold (`mean - 20`). `snapStroke` searches perpendicular to a manually traced guide, excludes points within 4 pixels of axes, falls back to guide points, then applies a five-point mean. | Keep this as the assisted baseline. Automatic extraction needs independent segmentation/path ordering; this function cannot establish automatic recognition. |
| Trace conversion | `markupToGraph` averages y-values into x bins, sorts by x, rounds graph coordinates, and subsamples to roughly 60 points per branch. | Bypass for automatic ordered paths: it can erase vertical features, drawing order, corners, and irregularities. |
| Fitting and review | `runFit` fits each branch with `StarFit.fit`, checks complete domain coverage, and displays the equation and image overlay. | Preserve optional fitting; do not use equation models as the automatic geometry format. |
| Tool selection | `StarFit.curveToolId` picks the first top-level editable `spline`, `polyline`, or `freeform`; it does not inspect grouped tools or exclude helper/closed tools. | New adapter must select a compatible declared tool explicitly and validate its capabilities. |
| Native transfer | The confirm callback samples each model with `StarFit.sampleCurve(model, 16)` (17 points). `placeCurves` validates all branches, reads JSON state, replaces `state.data[toolId]`, and calls `setState`. | Reuse the state API and coordinate formula. New import must encode the actual plugin format and preserve unrelated objects, including existing objects under the receiving tool. |
| Branch storage | Each manually traced branch is a separate array in `markup.strokes`, then a separate model and nested array under one native tool ID. | Preserve independent stroke identity all the way through import. |
| Confirmation | `clearFit`/`invalidateTrace` clear derived models and disable confirmation; image uploads have a monotonic `photoRequest`. The handler also checks loading and disabled state. | Retain these guards; add a complete input revision for asynchronous recognition and corrections. |

`pl-sketch.css` supplies the existing modal dialog, four-step workflow, photo
viewport, persistent actions, focus styles, and mobile layout. No styles changed.
`info.json` currently loads `star-fit.js`, `star-photo.js`, then `pl-sketch.js`;
new modules will need explicit ordering before their consumers. Canvas APIs
already run locally; no new dependency or backend is needed for this baseline.

### Verified native contracts

Inspected the source maps shipped with the **installed** JavaScript package
`@prairielearn/sketchresponse` **0.2.1**, plus the installed Python
`sketchresponse` **0.1.5**. These findings describe this local runtime; deployment
must be checked separately. Source copies used for inspection are in the local
evidence directory, not vendored into this repository.

| Plugin | State representation | Rendered and gradeable geometry | Editing implications |
| --- | --- | --- | --- |
| `spline` | Array of branches; each branch is an array of `{x, y}` anchors in SVG pixels. | Both rendering and `getGradeable()` run `fitCurve(anchors, 0)` to produce cubic segments, rounded to 0.01 pixel. | Individual anchors can move, but interpolation can round a sharp corner. Do not claim exact polyline fidelity from raw anchors. |
| `polyline` | Same nested anchor arrays; `closed` distinguishes a polygon. | Rendering uses SVG `M`/`L` segments. **Gradeable output still uses `fitCurve(anchors, 0)`**, so its geometry can differ at corners. | Vertices are editable. Must test rendering and grading independently before selecting this as the default. |
| `freeform` | Array of branches; each branch stores cubic controls: one start point followed by groups of three control/end points. | Rendering uses the stored cubic path; gradeable output copies those controls directly. Straight cubic segments can represent a polyline exactly. | Native Select moves a whole branch; this plugin does not supply per-vertex handles. Local landmark editing must be provided by recognition review if this mode is used. |

`getState()` returns a JSON string with `apiVersion`, `meta.config`,
`meta.dataVersions`, and `data[toolId]`. `setState(jsonString)` updates registered
plugins present in `data` and emits `stateSet`; plugin setters render their state.
Validate the entire proposal before calling it, because the engine iterates
plugin setters rather than offering a transactional validation API. Preserve
metadata, unrelated tools, and unrelated objects rather than creating a minimal
replacement state.

### Coordinates, submission, and restoration

- `pl-sketch.py:_prepare_ranges` expands the requested ranges by a 10-pixel
  margin on each edge. The client config already contains the expanded ranges.
- Graph-to-native conversion is
  `px = (x - xrange[0]) * width / (xrange[1] - xrange[0])` and
  `py = (y - yrange[1]) * height / (yrange[0] - yrange[1])`.
  This matches the installed Python `graph_to_screen` contract. Do not apply
  padding or screen-y inversion a second time.
- Native SVG uses the configured width/height as its viewBox. Do not infer
  native coordinates from CSS display dimensions or assume equal x/y pixel
  scales. Affine photo calibration and native graph mapping are distinct steps.
- On form submission, `pl-sketch.js:updateState` calls `getGradeable()` (which
  finalizes drawing), merges its `data` into the saved state as `gradeable`, and
  base64-encodes that JSON in the existing hidden submission input.
- `pl-sketch.py:render` restores saved `data` through `config.initialstate`.
  Parsing and grading continue through the existing Python implementation.
- Existing parsing rejects same-tool function branches whose x-ranges overlap
  by **more than 5 SVG pixels** (despite an outdated 15-pixel comment), unless
  the applicable grader uses `xyflip`. Preserve this rule and report unsupported
  multi-valued submissions. Visual branch preservation alone is not evidence
  of full multi-curve grading compatibility.
- `questions/star-photo-test/question.html` has two spline-only canvases, with
  photo input enabled for `hand-drawn-on` and disabled for `hand-drawn-off`.
  Both retain the existing `x**2` grader. The recognizer must receive only an
  allowlist of image/calibration inputs, never the full solution configuration.

### Baseline validation

Node.js: `v20.19.6`. Playwright CLI: `0.1.23`, Chrome browser. The Browser skill
is not installed; the repository's existing Playwright CLI tests were used.

The local container is `star-automatic-cv-baseline-arm64`, using the already
installed image:

```text
prairielearn/prairielearn@sha256:be0af7a6abc47c2ce95acc6e26457fc831e3e169da8cd053bb8f7af60b83e207
```

The course is mounted read-only at `/course`; port 3000 is bound to loopback.
`Load from disk` reported **Course sync successful**. Verified preview:
`http://localhost:3000/pl/course/1/question/10/preview` (`star-photo-test`).

| Existing check | Observed result | Scope |
| --- | --- | --- |
| `node --test tests/star-fit-branches.cjs tests/star-fit-coverage.cjs` | 13/13 passed | Mapping, atomic branch validation, complete fitted domains, and pole rejection. |
| `node tests/star-photo-confirmation.cjs` | Passed; 71 assertions, no application errors | Existing proposal invalidation and upload race checks. |
| `node tests/star-photo-branches.cjs` | Passed; 80 assertions across 6 cases, no application errors | Existing branch preview, native state, SVG rendering, and gradeable data. |
| `node tests/star-photo-workflow.cjs` | Passed; 67 assertions across desktop/mobile, no application errors | Existing desktop/mobile layout, keyboard/touch interaction, and branch transfer. |

The browser regressions generate controlled line images and **manually trace**
them. They establish the assisted baseline only; they do not measure automatic
recognition, physical-photo fidelity, actual Save & Grade, or refresh restoration.
The latter two remain explicit step-3 validation requirements.

Initial browser-test attempts were blocked by sandbox access to npm's cache;
reruns use the required elevated environment access. The preview also emits
pre-existing font decoding warnings from the installed SketchResponse package.
These are distinct from application JavaScript errors and should remain visible
in subsequent QA reporting.

Local raw logs, screenshots, native-source inspection copies, and test results
are saved under `/private/tmp/star-automatic-cv-step-01/`. A committed, reduced
record with check names and raw-log hashes is in
[`automatic-photo-recognition/step-01-results.json`](automatic-photo-recognition/step-01-results.json).
Desktop and mobile review screenshots were visually inspected: the photograph,
review controls, and confirmation action are visible; the mobile options area
scrolls independently. These are existing assisted-workflow screens.

### Reproduce the baseline

With Docker Desktop running and this branch checked out, the session's container
can be reused with `docker start star-automatic-cv-baseline-arm64`. To create it
from the same image on an ARM Mac if it does not already exist:

```bash
docker run -d --pull=never --platform linux/arm64 \
  --name star-automatic-cv-baseline-arm64 \
  -p 127.0.0.1:3000:3000 \
  -v "$PWD:/course:ro" \
  prairielearn/prairielearn@sha256:be0af7a6abc47c2ce95acc6e26457fc831e3e169da8cd053bb8f7af60b83e207
```

Open `http://localhost:3000`, select **Load from disk**, wait for successful
course sync, and open the preview URL above. A new database may assign different
IDs; locate `star-photo-test` under the course's Questions page if necessary.

From the repository root (the CLI wrapper below is specific to this machine):

```bash
export PL_PHOTO_TEST_CLI=/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh
export PL_PHOTO_TEST_URL=http://localhost:3000/pl/course/1/question/10/preview
node --test tests/star-fit-branches.cjs tests/star-fit-coverage.cjs
node tests/star-photo-confirmation.cjs
node tests/star-photo-branches.cjs
node tests/star-photo-workflow.cjs
```

Set `PL_PHOTO_TEST_OUTPUT` separately for each browser script to choose its
evidence directory. This run used directories named for each script inside
`/private/tmp/star-automatic-cv-step-01`. `git diff --check` also passed.

### Minimal next integration

1. Add a pure recognizer accepting image pixels and explicitly allowed
   calibration evidence. Return ordered pixel-space strokes even when scale is
   unknown. Grid spacing alone is not evidence that one square means one unit;
   a question's coordinate range alone does not establish photo correspondence.
2. Put finite/bounds/transform/topology validation between recognition and the
   native adapter. Keep source dimensions, resize transforms, per-axis evidence,
   uncertainty, assistance requests, stroke identity, and revision explicit.
3. Add an independent geometry-to-native adapter using the verified plugin
   contract. Keep optional `StarFit` and the assisted `StarPhoto` path available.
4. Extend the existing modal with automatic overlay review and targeted
   corrections; reuse photo loading, view controls, focus behavior, and guarded
   confirmation. No native import from a rejected or stale proposal.
5. Adapt only the existing test question as needed, then verify native edits,
   real submission, gradeable fidelity, and refresh restoration independently
   from recognition quality.

**Review boundary:** step 2 must not start until the user approves step 1.

## Step 2: deterministic extraction

Step 1 was approved. Added independent `star-recognition.js` and
`star-geometry.js` modules, without changing the legacy photo UI, fitting,
grading, dependency registration, or test question. Inspected the separate
shape-preserving branch and reused only its pixel-space simplifier.

Results: four of four supported **controlled raster** cases extract and
calibrate automatically. All four controlled challenges require review. Neither
of two actual student-photo crops succeeds automatically. These are development
diagnostics, not a held-out physical-photo success rate. Native import remains
untested until step 3.

Validation: 49 Node tests passed (13 existing + 36 new); all 218 existing browser
assertions passed, plus 23 browser assertions for the recognition viewer.

Read the [step-2 report](../benchmarks/photo-graphs/automatic-cv/experiment-01/REPORT.md)
for measured geometry, failures, algorithms, commands, original/overlay/proposal
comparisons, and attribution. The [geometry contract](automatic-photo-recognition/geometry-v1.md)
describes the adapter boundary. Run the standalone evidence viewer with:

```bash
python3 benchmarks/photo-graphs/automatic-cv/experiment-01/serve.py --port 8765
```

Open `http://127.0.0.1:8765/`. This is an extraction reviewer, not native import.
**Review boundary:** stop after the step-2 commit; step 3 requires user approval.

## Step 3: native import

Step 2 was approved. Added a direct, guarded `StarNative` adapter and opt-in
`automatic-photo="true"` review UI. Four controlled cases pass exact native state
restoration, whole-branch editing, and actual native Save & Grade. The five-path
ambiguous-axis proposal is blocked. The original assisted question is unchanged;
the new `star-automatic-photo-test` sandbox uses an editable freeform tool.

Validation: 64 Node tests, 218 existing browser assertions, and 163 new native
browser assertions passed. The actual installed polyline, spline, and freeform
representations were compared; freeform preserves the extracted segments for
both rendering and grading. The assisted route also uses the correct freeform
control format. Real-photo recognition remains 0/2.

Read the [step-3 report](../benchmarks/photo-graphs/automatic-cv/experiment-02-native/REPORT.md)
for exact metrics, native state and submission evidence, editing limitations,
and reproduction steps. Local demo:
`http://localhost:3000/pl/course/1/question/254/preview/` (fresh variant).
Evidence gallery: `http://127.0.0.1:8766/`.

**Review boundary:** stop after the step-3 commit. The next approved step should
improve real-photo recognition before expanding the correction interface.

## Step 4A: multi-method feasibility

Step 4A compares public free-tier VLM capabilities, local OCR feasibility and
reusable components. It adds an executable offline design under
[`multi-method/step-4a`](../benchmarks/photo-graphs/multi-method/step-4a/REPORT.md),
with frozen image/reference hashes and a request preflight that cannot execute
live inference. Apple Vision returned raw OCR on the labeled photo; calibration
improvement was not evaluated. Tesseract is not installed. Both VLM candidates
remain untested, and real-photo automatic recognition remains 0/2.

Validation: 71 Node checks passed, including seven feasibility checks. No
production element or question changed. External image release, credentials,
actual account tier/quota and $0 request approval remain pending. The November 9
demo takes priority over unnecessary provider comparisons.

**Review boundary:** commit Step 4A locally and stop. Step 4B is a separately
approved, at-most-two-request VLM-only experiment; 4C OCR/CV, 4D hybrid, 4E
selection/integration and 4F independent demo acceptance each retain an explicit
approval checkpoint.
