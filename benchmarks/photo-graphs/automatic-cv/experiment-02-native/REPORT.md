# Step 3 — native PrairieLearn import

The direct import workflow is implemented on `feat/automatic-photo-recognition-cv`,
after step-2 commit `a16fb93`. All four required controlled cases pass native
rendering, whole-branch editing, actual Save & Grade, and refresh/restoration.
The ambiguous-axis five-path proposal is blocked. **These are native integration
results, not improved recognition results. Real-photo automatic recognition
remains 0/2 from step 2.** No production-readiness claim is made.

## What changed

- `elements/pl-sketch/star-native.js`: validated geometry-to-state adapter,
  coordinate mapping, exact freeform encoding, append-only preparation, explicit
  confirmation tokens, input revision guards, canvas-change detection, and
  verified rollback on write failure. No `StarFit` calls or equation fitting.
- `elements/pl-sketch/star-automatic.js`: opt-in photo upload, original-image
  overlay, proposed graph in native coordinates, warnings, explicit acknowledgment,
  rejection/reanalysis, and guarded confirmation. Recognition receives only image
  pixels and an input revision, never the native configuration or grader.
- `pl-sketch.py`, `pl-sketch.mustache`, `pl-sketch.js`, and `info.json`: the new
  `automatic-photo="true"` instructor switch, module ordering, and thin mounting
  hook. The switch defaults off and only appears on editable question panels.
- `pl-sketch.css`: scoped desktop/mobile review dialog styling and keyboard
  focus support. The existing assisted dialog is unchanged.
- `star-fit.js`: the assisted route now uses the shared geometric encoder when
  its receiving tool is freeform. Its fitting and spline transfer are unchanged;
  writing 17 spline anchors directly into a freeform tool was the wrong format.
- `questions/star-automatic-photo-test/`: a separate sandbox using the existing
  native element and native `x**2` grader. The original `star-photo-test` question
  is unchanged, including its supplied tools, ranges, and grading configuration.
- `infoCourse.json`: one STAR project author tag for accurate sandbox provenance;
  the new question uses the declared `Test` topic and required course tag categories.
- `tests/star-native.test.cjs` and `tests/star-native-browser.cjs`: adapter and
  actual PrairieLearn integration checks.

The new question deliberately uses `free-draw` (`freeform` internally), with
x-range `-5,7`, y-range `-4,6`, width 800 and height 600 to contain the supplied
fixtures. It also has an unrelated point tool. These settings do not infer the
photograph's calibration: the recognizer still derives calibration from visible
photo evidence before native conversion.

## Native representations verified

Rechecked the installed JavaScript SketchResponse **0.2.1** source maps and its
actual runtime, with Python sketchresponse **0.1.5** in local PrairieLearn.
The runtime test creates each native tool, writes the same recognized V, samples
its actual rendered SVG, and reads its real `getGradeable()` output.

| Tool | State representation for the V | Rendered max error vs CV (photo px) | Gradeable max error vs CV (photo px) |
| --- | --- | --- | --- |
| Polyline | 6 anchor points | 0.0000184 | 2.5440 |
| Spline | 6 interpolation anchors | 2.5442 | 2.5418 |
| Freeform | 16 cubic control/end points | 0.0000184 | <0.000000000001 |

Polyline rendering uses straight SVG segments, but its gradeable path is fitted
from those anchors. Spline rendering and grading both interpolate. Freeform
renders and grades its stored cubic controls directly. The adapter therefore
accepts an editable freeform receiving tool and encodes **each extracted segment
as an exactly straight cubic**, with controls at one-third and two-thirds of the
segment. Each original vertex remains the shared end/start of adjacent segments;
corners and disconnected branches are not smoothed or joined.

The diagnostic encoder can expose polyline/spline anchor representations for
testing, but the confirmed import path refuses those tools rather than silently
distorting gradeable geometry. No native library or grader was modified.

## Coordinates, state preservation, and confirmation

`StarGeometry.validate` runs before native preparation. Import requires a fully
calibrated, `automatic` result with no unresolved assistance/warnings. Uncertain
axes or scale keep pixel geometry available for review and block native import;
the question's range is never substituted for missing photo calibration.

Graph-to-native conversion uses the **already padded** native configuration:

```text
px = (x - xrange[0]) * width / (xrange[1] - xrange[0])
py = (yrange[1] - y) * height / (yrange[1] - yrange[0])
```

The photo affine transform is inverted once by the recognizer/geometry layer;
the native adapter applies screen-y inversion once. It does not use CSS display
dimensions, assume equal x/y pixel scales, add another margin, clip, or stretch
the geometry to fit. Unit tests exercise asymmetric ranges and aspect ratios.

Preparation reads the current native state and constructs a private copy of the
proposed drawings. It does not mutate the canvas. On explicit confirmation,
`setState` receives a partial `data` dictionary containing only the receiving
tool. New objects are appended; existing receiving-tool objects, other tools,
toolbar state, and native history data are preserved. Readback verifies the
result. If writing fails, the previous complete state is restored and verified;
an unverifiable rollback is reported explicitly instead of claiming success.

Each proposal has a one-use token and input revision. Photo replacement,
rejection, closing the dialog, reanalysis, and a newer proposal invalidate older
tokens. A slower older upload cannot overwrite the latest photo. Changing the
native canvas after review also blocks confirmation rather than discarding the
newer edit. Disabled-button handler dispatch is tested as well as ordinary clicks.

The adapter also checks bounds, tool limits, and the existing same-tool function
overlap restriction (more than 5 SVG pixels). It does not remove prior curves to
make a conflicting import fit. Closed/backtracking paths are currently blocked
pending a validated native question contract; their source geometry is retained,
not converted to an ideal mathematical function.

## Required demonstrations

The original input PNGs and recognized geometry come from step 2. Each browser
case runs recognition again on the uploaded image pixels. For preservation
testing, the canvas also starts with a pre-existing freeform object and a point
under a different tool; those are not recognition inputs.

| Controlled case | Imported branches | Rendered → CV max (photo px) | CV vertex → sampled SVG max (px) | Gradeable vertex max (px) | Save & Grade / refresh / native edit |
| --- | --- | --- | --- | --- | --- |
| Straight line | 1 | 0.0000191 | 0.0408 | <0.000000000001 | Passed |
| Sharp V | 1 | 0.0000184 | 0.0203 | <0.000000000001 | Passed |
| Irregular smooth curve | 1 | 0.0000201 | 0.0227 | <0.000000000001 | Passed |
| Two disconnected branches | 2 | 0.0000180 | 0.0313 | <0.000000000001 | Passed; both branches separate |

All four native control arrays and SVG path strings are restored exactly after
submission and refresh. Every retained CV vertex, including the V vertex and
branch endpoints, appears in native gradeable controls to floating-point
precision. SVG sampling uses 0.5-native-pixel arc-length intervals; the small
reverse-direction errors reflect sampling near vertices. These measurements
compare native geometry with **CV output**, not with an ideal equation or human
ground truth. The V's original step-2 recognition error (2.24 px at its vertex)
has not been erased by this near-zero native-transfer error.

For each case, a real native Select drag moves an imported branch by approximately
`[26,18]` native pixels without deforming its control points. The other branch,
pre-existing freeform object, and unrelated point stay unchanged. The edited
graph is submitted again and restores exactly after refresh. This tests native
whole-branch editing, not landmark or per-vertex editing.

All ten actual Save & Grade requests (two per imported case, one stock
manual drawing, and one assisted photo import) are accepted by the native parser. The
unchanged `x**2` grader marks the non-solution samples **0%**, as expected. A
faithfully imported wrong answer remains wrong; import is not a grading engine.

Negative checks confirm that the five-path ambiguous-axis result cannot enable
acknowledgment or import. Rejected proposals, old photo revisions, and confirmation
after a newer canvas edit also cannot overwrite native data.

## Validation and evidence

- **64/64 Node tests:** all 49 existing step-2/baseline checks, plus 15 adapter
  checks covering coordinates, encodings, state preservation, explicit approval,
  revision/token invalidation, uncertain geometry, bounds/limits/overlaps, and
  rollback behavior.
- **218/218 existing browser assertions:** confirmation 71, branches 80, assisted
  desktop/mobile workflow 67. No application console errors.
- **163/163 new native browser assertions:** all four import/edit/submit/restore
  cases; actual polyline/spline/freeform contracts; negative/stale guards; stock
  freeform manual drawing and restoration; assisted camera import to freeform
  (17 samples encoded as 49 cubic controls); desktop/mobile review checks.
- Browser: Chrome through Playwright CLI 0.1.23. Browser plugin not available;
  the repository's existing CLI pattern was used. Desktop 1440×1100 and mobile
  390×844; no horizontal overflow. Existing native-package font warnings remain;
  no application console errors were recorded.
- JavaScript/Python syntax checks and CSS syntax/selected Stylelint rules passed.
  The course sync and new question render succeeded in actual local PrairieLearn.
- The changed-question repository validator passed after assigning the declared
  topic and required tags. Existing author tags and question metadata were kept.
- An initial test inspected SVG before the native renderer's next animation frame.
  It was fixed to wait for actual paths, then rerun. Final results use the passing
  run; no successful geometry was simulated to bypass that check.

`results/` contains each case's actual recognized geometry, before/native/restored
and edited state, gradeable data, actual submitted payloads, actual rendered path
SVGs, native/restored overlays, and browser screenshots. `browser-raw.json.gz`
retains the complete browser result including sampled SVG points. `summary.json`
contains metrics and source hashes; `native-tool-contracts.json` records the three
tool representations; `browser-checks.json` and `node-tests.log` record checks.
`evidence-manifest.json` hashes the committed artifacts. Originals are referenced
from the unchanged `../experiment-01/inputs/` archive.

## Test it now

Local PrairieLearn is running with this repository mounted at `/course`.
Open **http://localhost:3000/pl/course/1/question/254/preview/** for a fresh variant
of `star-automatic-photo-test` (database IDs can differ on another installation).

1. Click **Recognize a graph photo**.
2. Choose an input from `benchmarks/photo-graphs/automatic-cv/experiment-01/inputs/`:
   `line.png`, `sharp-v.png`, `smooth-curve.png`, or `two-branches.png`.
3. Compare the photograph overlay and proposed graph. On mobile, scroll the
   comparison region to inspect both. Nothing has reached the native canvas yet.
4. Check **This matches the marks on my paper, including any mistakes**, then
   select **Confirm and add graph**.
5. Use native **Select** to move a whole branch if desired. **Save & Grade**,
   then refresh. A 0% mathematical grade for these examples is expected.
6. Start a fresh variant before another sample so existing curves are not
   silently replaced. Try `ambiguous-axes.png` to inspect blocked import.

The separate comparison gallery is available at **http://127.0.0.1:8766/**.

Reproduce from the repository root:

```bash
# If necessary: start Docker Desktop, then the existing local container.
docker start star-automatic-cv-baseline-arm64
# Open localhost:3000 and use Load from disk after syncing question JSON.

node --test tests/star-fit-branches.cjs tests/star-fit-coverage.cjs tests/star-recognition.test.cjs tests/star-geometry.test.cjs tests/star-native.test.cjs
export PL_PHOTO_TEST_CLI=/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh
export STAR_NATIVE_TEST_URL=http://localhost:3000/pl/course/1/question/254/preview
export PL_PHOTO_TEST_OUTPUT=/private/tmp/star-automatic-cv-step-03/star-native-browser
node tests/star-native-browser.cjs

node tests/star-photo-confirmation.cjs
node tests/star-photo-branches.cjs
node tests/star-photo-workflow.cjs
python3 benchmarks/photo-graphs/automatic-cv/experiment-02-native/serve.py --port 8766
```

The raw local run is under `/private/tmp/star-automatic-cv-step-03/`. The committed
evidence is viewable without rerunning tests. `build-evidence.cjs` archives an
actual successful native run and the three adjacent legacy logs; it does not
generate substitute recognition or native outputs.

## Remaining problems and immediate next priority

Recognition on real photographs remains the largest obstacle to the November 9
demo. This step neither changes the recognizer nor reruns its benchmark with
manually supplied geometry. Both real-photo failures from step 2 remain failures.

Freeform provides exact paths and native whole-branch movement/deletion, but no
individual vertex handles. Landmark correction is still pending. Import through
the public `setState` API does not create a new native Undo action; remove an
imported branch with native Select/Delete. Existing native drawing/editing undo
behavior is not replaced. Other native package/deployment versions, physical
mobile devices, and overlapping or closed/multi-valued functions are not claimed
compatible from these four tests.

The next implementation priority is **real-photo recognition**, ahead of broader
landmark UI work: improve neutral-ink segmentation and axis separation on the
existing real graph-paper photos, preserve uncertainty and reference separation,
and add genuine photo evidence. Step 3 ends with a local commit for review. No
push or merge is authorized, and further work waits for that review approval.
