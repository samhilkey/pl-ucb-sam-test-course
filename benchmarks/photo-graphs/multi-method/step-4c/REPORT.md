# Step 4C — Constrained assisted workflow stabilization

**Both approved real-photo cases passed the local assisted end-to-end acceptance
checks.** This is fully manual photo tracing with user-supplied calibration,
not automatic or targeted-assisted recognition. The opt-in route preserves the
traced corner and independent branches through native editing, submission and
refresh. The existing fitting route substantially distorts the sharp peak.

This step is restricted to the previously approved `real--06` and `real--01`
photographs. They are two separately drawn physical-paper examples from
DrawEduMath, but both are prior development cases, **not held-out validation**.
The user approved their local use explicitly. No new CV experiment, VLM request,
photograph transmission, billing change, push, merge or other-branch operation
was performed. Step 4D has not started.

Branch: `feat/automatic-photo-recognition-cv`. Parent:
`ddc897aa1299f7dcad65eccab0abdd3ba0d30bcd`. This report and all new implementation,
tests and evidence are included in the single Step 4C local commit. The commit's
SHA is reported after committing; it is not embedded into its own contents.

## Audit and smallest obstacles

The existing camera UI already supports local uploads, O/X/Y placement, numeric
references, multiple pointer strokes, zoom/pan, review and confirmation. Step 3's
native adapter already supplies exact freeform controls, atomic import, explicit
confirmation, revision guards, rollback and preservation of unrelated objects.
The default automatic path still abstains on these real photos: the historical
baseline yields zero paths on real--01 and four fragmented paths with 2.02%
reference coverage at 3px on real--06. Those artifacts were reused unchanged.

Three concrete obstacles were addressed:

1. The assisted route always searched/snapped nearby ink, collapsed samples by
   x and globally fitted equations before native import. The real peak replay
   selects a fifth-degree polynomial, rounds the apex, creates a left-end dip
   and moves endpoints. The new opt-in path sends ordered manual geometry
   directly to the existing native freeform adapter.
2. The default native/parser overlap restriction makes the two photographed
   lines an invalid, unsavable function attempt. The new question's opt-in mode
   preserves both branches, accepts the attempt, and grades this mathematical
   mistake 0 with feedback. Default questions retain the original restriction.
3. Endpoint sampling could omit a final pointer-up position; the opt-in path now
   records it. Review requires a manual acknowledgment. Stale rejection clears
   the visible preview as well as disabling confirmation.

The new manual button is explicit and primary in this question; automatic CV
remains a secondary experimental option with the manual route immediately
available. There is no broad UI redesign or change to an existing assessment.
See the [implementation contract](../../../../docs/automatic-photo-recognition/assisted-photo-geometry.md).

## Actual photo fidelity

The [acceptance policy](acceptance-policy.json) was frozen before the browser
tests. It screens <=5px p95 distances in both directions, >=90% coverage within
5px on every branch, correct branch count and exact native encoding. Existing
3px metrics remain visible and unchanged. References are the old approximate
single-observer visual annotations with roughly 4px uncertainty, not independent
expert ground truth. This is an engineering screen, not validated grading
accuracy. Endpoint disagreement with those annotations is reported rather than
trimming actual ink or modifying reference geometry.

| Case / method | Branches | p95 ref→path / path→ref (source px) | Coverage <=3px | Coverage <=5px |
| --- | --- | --- | --- | --- |
| real--06, existing fitted assisted preview | 1 | 13.13 / 10.84 | 26.94% | 49.83% |
| real--06, new manual trace | 1 | 4.21 / 4.20 | 75.25% | 100% |
| real--01, new manual trace | 2 independent | 1.86 / 2.06 | 100% / 100% | 100% / 100% |

For real--06, the legacy fitted preview misses the reference apex by 24.46px;
the new trace's marked corner is 1.41px from that annotated apex. Its endpoints
are at most 4.24px from the approximate reference endpoints. The legacy endpoint
error is 28.27px. This comparison replays identical visible calibration/tracing
actions through the unchanged fitting mode on the same photo; it does not
inject an equation or reference geometry into tracing.

For real--01, the maximum annotated endpoint disagreement is **11.18px**: the
older centerline stops before the visible right arrow-shaft tip. The replay
traces that tip and does not shorten it to improve the metric. About **0.66%** of
output centerline length lies >5px from the old reference, concentrated in these
terminal extensions. No whole spurious branch or false join is detected. Both
separate lines remain independent native objects. Arrowhead barbs and open/closed
endpoint semantics are not encoded; this is a centerline/shaft reconstruction.

The V still fails the old >=90% **3px** coverage screen. Its passing 5px screen
does not erase that stricter result. Source-photo fidelity remains approximate,
and operator tracing can introduce error. No general automatic-recognition
claim follows from either result.

Native encoding adds effectively no geometric change: maximum anchor/endpoint
round-trip error is <1.8e-13 source pixel for both cases; sampled SVG path drift
from the entered manual polyline is <0.000054px. Rendering and gradeable cubic
controls are equal. Simplification before native encoding has a 0.75 source-pixel
tolerance; this is separate from photographic annotation/tracing uncertainty.
Original versus edited submissions and each refreshed native state are equal
in the browser record. The first-branch drag leaves the second branch unchanged.

Calibration is **manual**, not detected: real--06 uses visible labeled ticks;
real--01 has no numeric labels and uses an explicitly assigned demo scale.
Neither scale has independent numeric ground truth here. Origin and unit vectors
are recorded in [evaluation.json](results/evaluation.json); automatic axis/scale
accuracy is not scored. The geometry is not changed to match the x-squared grader.

## Real-photo interaction and persistence results

The complete route ran in local PrairieLearn, not a DOM-only mock:

| Action per photo | real--06 | real--01 |
| --- | --- | --- |
| Upload actual photograph | 1 | 1 |
| Drag O/X/Y handles | 3 | 3 |
| Enter numeric X/Y reference values | 2 | 2 |
| Trace original ink in separate gestures | 1 | 2 |
| Read trace, acknowledge review, import | 1 each | 1 each |
| Original Save & Grade + explicit refresh | Passed | Passed |
| Native Select whole-branch drag | Passed | Passed, other line unchanged |
| Edited Save & Grade + explicit refresh | Passed | Passed |

There are **four actual Save & Grade POSTs and four explicit refresh checks**
across the original/edited two-case route. Each intentionally wrong paper graph
receives 0%, while its shape remains saved and editable. The separate-line case
is no longer an Invalid submission. The untouched second question canvas can
be blank by design; its score is not used as evidence for the tested canvas.

These are scripted mouse/keyboard operator replays, not an independent student
usability trial. They establish concrete interactions and persistence; human
completion time and unprompted student success were not measured. No automatic
or targeted-CV arm was run during Step 4C.

## Exact operator steps

Open the local question after **Load from disk**:
[star-assisted-photo-demo](http://localhost:3000/pl/course/1/question/255/preview).
Question IDs are local-database-specific; locate the question by name if its ID
changes. The existing container `star-automatic-cv-baseline-arm64` is running,
using the current checkout read-only as `/course`, on port 3000.

1. In the appropriate canvas, click **Trace a paper graph (manual)** and choose
   the original PNG listed below. Uploading opens the Axes step automatically.
2. Drag X, Y, then O to the indicated positions and enter the X/Y values. Positions
   are original source pixels; visual alignment is required in the displayed
   photo. The [operator-actions file](operator-actions.json) gives every pointer
   waypoint, source size/hash and calibration caveat for exact scripted replay.
3. Continue to Trace. Trace along the actual visible shaft, including the kink
   and endpoint positions. Lift the pointer between independent branches.
4. Click **Read my trace**. Inspect the orange reconstruction against the photo,
   with **Show trace** unchecked if desired. Check branches, corner, endpoints,
   scale and gaps. Use **Edit my trace** or Axes to correct it; any change clears
   the prior acknowledgment/proposal. No equation family needs choosing.
5. Check the review acknowledgment, then **This matches my sketch**. Inspect the
   imported native graph. Click **Save & Grade**, then refresh and verify it.
6. Use **Select**, drag a branch, Save & Grade again, and refresh. To change local
   geometry, delete the affected native branch and retrace/review it; do not
   append a replacement on top of the old branch.

| Case / source | O | X / value | Y / value | Trace landmarks |
| --- | --- | --- | --- | --- |
| [real--06 original](../../automatic-cv/experiment-01/inputs/real--06-piecewise-graph-paper.png) | (50,323) | (441,334) / 9 | (77,170) / 160 | (50,321) → kink (108,294) → peak (240,94) → (397,328); one gesture |
| [real--01 original](../../automatic-cv/experiment-01/inputs/real--01-multiple-lines-graph-paper.png) | (238,255) | (450,245) / 5 | (230,50) / 5 | Upper (14,321) → (236,256) → (781,74); lift; lower (57,434) → (240,385) → (722,246) |

The second row's 5/5 values are an **operator-assigned demo coordinate system**,
not a claim about student units. Both original image hashes and the earlier
reference hashes are pinned and checked by the offline evaluator. Attribution
and source license remain in the original
[source manifest](../../automatic-cv/experiment-01/source-attribution.json).

## Tests, evidence and review

The test entry points and committed logs are:

```bash
node --test tests/star-geometry.test.cjs tests/star-recognition.test.cjs tests/star-native.test.cjs tests/star-method-feasibility.test.cjs tests/star-assisted.test.cjs tests/star-fit-branches.cjs tests/star-fit-coverage.cjs
docker exec star-automatic-cv-baseline-arm64 sh -c 'PYTHONPATH=/PrairieLearn/apps/prairielearn/python:/course/elements/pl-sketch /PrairieLearn/.venv/bin/python -B /course/tests/star-assisted-server.py -v'
PL_PHOTO_TEST_CLI=/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh node tests/star-assisted-browser.cjs
PL_PHOTO_TEST_CLI=/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh node tests/star-photo-confirmation.cjs
PL_PHOTO_TEST_CLI=/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh node tests/star-photo-branches.cjs
PL_PHOTO_TEST_CLI=/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh node tests/star-photo-workflow.cjs
PL_PHOTO_TEST_CLI=/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh node tests/star-native-browser.cjs
node benchmarks/photo-graphs/multi-method/step-4c/evaluate.cjs
python3 validation_workflow/info_json_check.py --inputs questions/star-assisted-photo-demo/info.json
git diff --check
```

Results: **79 Node tests, 5 Python tests, 61 new real-photo/safety/mobile browser
assertions, 218 existing assisted browser assertions, and 163 native browser
assertions passed**. JavaScript syntax and question metadata checks passed.
No failed final checks. During development a server-test fixture initially
omitted PrairieLearn's `answers_names`, and the new grading path initially read
the wrong submitted-answer key; both were corrected before acceptance. Browser
execution needed the existing approved Playwright wrapper outside the sandbox
because its npm cache is outside writable roots. The Browser plugin/skill was
unavailable, so the repository's established CLI workflow was used.

The acceptance runner blocks non-local network requests and records no blocked
external hosts and no application JavaScript errors. Local PrairieLearn emits
existing font decode warnings; these are not counted as application errors.
The test does not upload photos or run automatic recognition. A test spy fails
the manual path if `StarFit.fit` or `StarFit.sampleCurve` is called.

Safety checks cover explicit acknowledgment, no pre-confirm mutation, invalid
scale edits, forced confirmation rejection, actual native edits making a
proposal stale, one-use tokens, cleared stale previews, unresolved automatic
proposals, source revisions, bounds/limits and preservation of unrelated data.
Desktop is 1440×1100. A 390×844 replay successfully traces/reviews/imports the V
without page/dialog horizontal overflow. Touch interaction remains covered by
the existing assisted workflow regression, not a separate new-photo touch trial.

Inspect these evidence entry points:

- [Full browser outcomes](results/results.json): manual geometry, native original/
  edited controls, gradeable data, decoded submitted geometry, refreshed states,
  check labels and local saved-variant URLs. No cookies, CSRF values or API keys.
- [Evaluation](results/evaluation.json): unchanged historical CV comparison,
  bidirectional distances, coverage, endpoints, corner, calibration and drift.
- [V photo/native overlay](results/real--06-piecewise-graph-paper--native-overlay.png)
  and [legacy overlay](results/real--06-piecewise-graph-paper--legacy-overlay.png).
- [Separate-line photo/native overlay](results/real--01-multiple-lines-graph-paper--native-overlay.png).
- For both case prefixes: `--original.png`, `--manual-overlay.png` (orange),
  `--native-overlay.png` (green), `--reference-overlay.png` (blue), `--trace.png`,
  `--review.png`, `--native.png`, `--graded.png`, `--restored.png`, `--edited.png`,
  and `--edited-restored.png`. Legacy overlay is magenta; arrow-shaft ends have
  cross marks. Photo overlays retain original pixels as the background.
- [Mobile review](results/mobile-real--06--review.png) and
  [stale rejection](results/stale-assisted--blocked.png).
- [Node log](results/node-tests.log), [server log](results/server-tests.log),
  [new browser log](results/assisted-browser.log),
  [existing browser checks/log](results/browser-regressions.json), and
  [fidelity log](results/fidelity.log).
- [File inventory](file-inventory.json), [evidence hashes](evidence-manifest.json)
  and [verification/self-review record](verification.json).

Self-review: the new feature is opt-in, existing question files and benchmarks
are unchanged, old overlap/ambiguous guards remain on the default path, and no
fitting/recognition/referee equation enters manual geometry creation. Native
accuracy is separated from photo accuracy. The endpoint disagreement and 3px
coverage limitation are retained; successful schema/state validation alone is
not described as photographic fidelity. No generated image is called real paper.

## Remaining risks, backup and deadline decision

- Manual calibration/tracing is required. Two development cases passing does
  not establish success on new drawings or with an uncoached student. Before
  November 9, an approved Step 4D can rehearse the exact route with the presenter.
- An unlabeled image has unknown actual scale; supply an explicit demonstration
  scale or use the labeled peak. Significant perspective distortion beyond an
  affine frame remains untested.
- Arrowhead decorations, endpoint inclusion symbols, loops, isolated dots and
  x-backtracking curves are outside this import contract. Unsupported geometry
  is blocked rather than replaced with an ideal equation.
- Native editing moves whole branches; local corrections require delete/retrace.
  Wrong graphs intentionally receive 0. Explain this before presenting the grade.
- The local container/database/browser must remain available. No production
  deployment, PrairieLearn Sync or remote availability is claimed.

**Dependable backup:** start from the labeled V and the primary manual button,
with both original PNGs stored locally. If automatic recognition abstains, use
the manual route directly. If a live trace needs correction, edit/retrace before
confirmation. If photo interaction fails during the presentation, use a saved
local variant from `results.json` to show the already-tested native graph,
editing, grading and refresh; label it explicitly as a previously prepared
manual reconstruction. Those URLs depend on this local database. The saved
variant's latest state includes the demonstrated branch move; the original
pre-edit geometry remains in the evidence. The native **Graph strokes** tool
also remains available for ordinary manual drawing; this is a fallback, not a
successful photo-import claim.

**Recommendation: proceed only to the approval-gated Step 4D final demo
preparation.** With four days remaining until November 9, a short presenter
rehearsal, local startup verification and backup review are realistic. Another
contrast comparison, broad CV experiment or untested VLM integration would add
deadline risk without supporting evidence. Do not reopen those experiments or
skip the next approval checkpoint automatically. This step supports a bounded
manual demonstration on these two approved photos, not general demo readiness
or automatic recognition.

## Separate Gemini setup readiness

[GEMINI-SETUP.md](GEMINI-SETUP.md) explains AI Studio key creation, project-level
tier/quota checks, hidden environment configuration, exact permission/$0 gates
and the missing live transport. [The offline presence check](check-gemini-env.cjs)
reports `GEMINI_API_KEY` **not configured** in this process, never its value;
tests also verify that a dummy secret cannot appear in output. Account/model
access, remaining quota, disabled billing and prospective $0 exposure remain
unknown; both Google image clearances remain unverified. Readiness is recorded
in [gemini-readiness.json](gemini-readiness.json). No Gemini inference was run,
and setup did not block assisted acceptance. A future pilot needs new explicit
approval plus all gates; the old two-call cap is not permission to run it now.
