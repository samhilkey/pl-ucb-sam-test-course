# Step 4D — Final demo preparation and secure Gemini configuration

**Rehearsal passed for the scripted local assisted demonstration on both
approved real-paper photographs.** Upload, manual calibration/tracing, faithful
review, native editing, Save & Grade and refresh/restoration passed, including
preservation of an actual pre-existing canvas point. This is a bounded manual
demonstration; it is not general automatic real-photo recognition validation.

Branch: `feat/automatic-photo-recognition-cv`. Parent:
`d9eb1abfe8ce311cd4888e3465c7418e6f7588d6`. One local Step 4D commit contains the
preparation, tests and evidence. No push, merge, VLM request, photograph upload,
billing change or next-phase work was performed. No production element/question
or recognition architecture changed.

## Rehearsal and fidelity

The intended local environment is the already running
`star-automatic-cv-baseline-arm64` container on localhost:3000, with this checkout
mounted read-only as `/course`. Local preview is question 255, course 1,
`star-assisted-photo-demo`. Runtime: Node 20.19.6, container Python 3.13.17,
Chromium through the existing Playwright CLI. Desktop 1440×1100; mobile 390×844.
The Browser plugin/skill was unavailable, so the established Playwright CLI
workflow was used. This is local PrairieLearn, not a DOM-only mock or a remote
deployment.

The full route was repeated independently in a fresh preview variant for each
photo. A real **Other marks** point was drawn before uploading, checked through
import, original save/refresh, whole-branch editing and edited save/refresh.
Independent second-branch geometry remains unchanged when the first branch is
moved. Endpoints survive the final sub-2px pointer movement; the corner is kept
without equation fitting. Both imported attempts intentionally grade 0% against
the sandbox's x-squared target; geometry is not changed to improve the grade.

| Photo | Method | Branches | p95 ref→path / path→ref | Coverage <=3px | Coverage <=5px |
| --- | --- | --- | --- | --- | --- |
| real--06 sharp peak | Fully manually traced | 1 | 4.21 / 4.20 px | 75.25% | 100% |
| real--01 separate lines | Fully manually traced | 2 independent | 1.86 / 2.06 px | 100% each | 100% each |

Both pass the unchanged Step 4C engineering screen. Fresh manually traced pixel
paths are identical to Step 4C. Native anchor/endpoint error is <1.8e-13 source
pixel; rendered drift is <0.000054px. No whole missing/spurious branch or false
connection is detected. These figures are exploratory distances to the old
approximate single-observer references, not independent ground truth.

The V's corner is 1.41px from the approximate annotation and endpoint error is
4.24px. The separate-line case retains the **11.18px annotated endpoint mismatch**
at a terminal shaft extension. Its endpoint was not shortened to fit the old
reference. The V still fails a >=90% coverage requirement at 3px. These
limitations are not hidden by the passing 5px screen. real--01's scale is
explicitly operator assigned because the source has no numeric labels; scale
accuracy and automatic axis detection are not established. Arrowhead barbs and
endpoint inclusion symbols are not encoded.

There are four real Save & Grade POSTs and four explicit refresh checks in the
two-case original/edited route. The recovery scenario adds one Save & Grade and
two more refreshes. A mobile-sized V review/import also passed without horizontal
overflow. This is scripted operator interaction, not measured human completion
time or a student usability trial. No CV or legacy-fitting comparison was rerun.

## Failure and recovery acceptance

All representative scenarios passed in actual local PrairieLearn:

| Scenario | Observed result |
| --- | --- |
| Close reviewed photo without confirming | No native mutation; local draft retained until replacement/refresh. |
| Replace acknowledged V with the approved other photo | Old branches, acknowledgment and orange proposal cleared; forced stale confirmation does nothing. |
| Upload deliberately invalid PNG bytes | Rejected; prior bitmap/proposal cannot be reused; existing point preserved. |
| Put O/X/Y on a straight line | Calibration/tracing/import blocked with visible error; native state unchanged. |
| Correct those axes and re-upload/retrace | Fresh review/import succeeds; existing point and submitted geometry preserved. |
| Change axes/native objects after preview | Earlier proposal invalidated; stale import blocked, preview cleared; new native edit preserved. |
| Refresh while a second photo proposal is unconfirmed | Last submitted native attempt restored; ephemeral photo, calibration, trace and acknowledgment cleared. |
| Save original, refresh, edit, Save & Grade, refresh | Exact original/edited native state restored for each case; other line/point retained. |

The last two cases establish different guarantees: **submitted native state
persists; unsaved photo markup does not**. The presenter script describes this
and requires re-upload/retrace after refreshing an unconfirmed proposal.

## Presenter package and offline backup

- [PRESENTER.md](PRESENTER.md): exact opening statement, local startup checks,
  two-tab sequence, source-pixel calibration/trace landmarks, grade explanation,
  failure handling, limitation wording and backup switch.
- [tested-inputs.json](tested-inputs.json): two approved original-byte inputs,
  hashes, dimensions, explicit local authorization, source/scale caveats.
- `results/*--original.png`: byte-identical copies for the presenter file picker;
  `--trace.png`, `--review.png`, `--native.png`, `--graded.png`, `--restored.png`,
  `--edited.png`, `--edited-restored.png`, and fresh orange/manual and green/native
  source-photo overlays for each case.
- [rehearsal.json](results/rehearsal.json): native/gradeable geometry, decoded
  submissions, restored original/edited states, existing objects, checks and
  local saved-variant URLs. No raw headers, CSRF values, cookies or key values.
- [evaluation.json](results/evaluation.json): pinned hashes, branch/corner/
  endpoint/coverage metrics, native drift and preservation checks.
- [offline-backup.html](offline-backup.html): a single self-contained recorded
  walkthrough with 12 embedded actual images and two native JSON downloads.
  It clearly says no live recognition/grading runs in this backup.

The included viewer serves only that one artifact at
`http://127.0.0.1:3019/offline-backup.html`. It is independent of PrairieLearn,
the database and internet. It cannot serve `.env.local` or repository paths;
focused tests verify 404s. Start it with:

```bash
node benchmarks/photo-graphs/multi-method/step-4d/serve-backup.cjs
```

The backup initially failed because automation blocks `file://` navigation.
The tested alternative uses this isolated localhost viewer. After its single
document load, the browser was switched offline: all 12 embedded images,
presenter navigation and **both actual JSON downloads** passed with no further
HTTP requests. The viewer never requests PrairieLearn. Direct file opening is
not claimed as tested. This backup is recorded evidence, not an editable live
PrairieLearn replacement or a fresh grade calculation.

## Secure Gemini configuration

The initial audit found your local `.gitignore` edits already contained the
requested `.env`, `.env.*`, `!.env.example` rules. They were retained with a final
newline. The initially untracked example was normalized to exactly
`GEMINI_API_KEY=` plus a newline. The real `.env.local` was already present,
remains ignored/untracked, and its contents were not modified or displayed.

`git check-ignore -v .env.local` reports `.gitignore:17:.env.*`. Only the blank
example is tracked. [Current configuration guide](../../../../docs/automatic-photo-recognition/gemini-configuration.md)
documents a user-created `.env.local` and Node 20.19.6's built-in
`node --env-file=.env.local <server-entry>` loading. This is tested offline and
compatible with the observed runtime; no dotenv dependency or live runner was
added. It supersedes the older Step 4C environment-only storage advice while
preserving that historical experiment package unchanged.

The actual local file loaded successfully in the presence-only checker and
reported **key configured** without its value. This does not validate the key,
model access, account/project Free-tier eligibility, quota, billing state or $0
exposure. Both Google unpaid-service image clearances remain unverified. The
demo needs no key. Browser rehearsal subprocesses strip Gemini/Google credential
variables; browser application JavaScript contains no credential reference.
No env file, key value or credential-derived hash is in the package. A final
staged-content check also checks for the locally configured key without printing
it. See [credential-status.json](results/credential-status.json).

**Zero** inference/authenticated-provider requests, photograph uploads or billing
changes occurred. The frozen two-image protocol, permission/$0 gates and a new
explicit approval remain required before any future Step 4B resumption. A key
being configured does not open those gates.

## Tests, commands and review

```bash
node --test tests/star-geometry.test.cjs tests/star-recognition.test.cjs tests/star-native.test.cjs tests/star-method-feasibility.test.cjs tests/star-assisted.test.cjs tests/star-fit-branches.cjs tests/star-fit-coverage.cjs tests/star-gemini-config.test.cjs tests/star-demo-backup.test.cjs
docker exec star-automatic-cv-baseline-arm64 sh -c 'PYTHONPATH=/PrairieLearn/apps/prairielearn/python:/course/elements/pl-sketch /PrairieLearn/.venv/bin/python -B /course/tests/star-assisted-server.py -v'
PL_PHOTO_TEST_CLI=/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh node tests/star-demo-browser.cjs
node benchmarks/photo-graphs/multi-method/step-4d/evaluate.cjs
node benchmarks/photo-graphs/multi-method/step-4d/build-backup.cjs
node benchmarks/photo-graphs/multi-method/step-4d/serve-backup.cjs
PL_PHOTO_TEST_CLI=/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh node tests/star-demo-browser.cjs --backup
node --env-file=.env.local benchmarks/photo-graphs/multi-method/step-4c/check-gemini-env.cjs
git check-ignore -v .env.local
git diff --check
```

Final results: **84 Node tests, 5 Python tests, 86 live rehearsal/recovery browser
assertions and 10 offline-backup browser assertions passed**. No final failures.
The initial file-protocol harness failure is recorded above. Application console
errors and blocked external hosts are empty during rehearsal. Existing local
PrairieLearn font decode warnings remain; they did not prevent these interactions.
The backup has no scripts or runtime errors. Relevant logs and browser-check JSON
are in `results/`; [verification.json](verification.json) and
[evidence-manifest.json](evidence-manifest.json) record checks and file hashes.

Review found no production change needed after the rehearsal. Shared test-helper
options seed a real existing object and skip the old fitting comparison; its
default behavior remains available. New tests cover ignore/template rules,
environment-file loading/precedence without value output, frontend exclusion,
viewer path isolation, actual photo recovery and recorded offline downloads.
Existing benchmarks and Step 4A/B/C results remain unchanged. All earlier commits
are retained. Full file inventory is in [file-inventory.json](file-inventory.json).

## Readiness, limits and deadline

Ready for the **rehearsed local assisted sequence on these two approved existing
photos**, with the labeled V as the preferred first case and recorded viewer as
backup. This does not establish general real-photo recognition accuracy, held-out
performance, independent numeric calibration, new-browser/new-machine operation,
uncoached student success, presenter timing or projector behavior. Node/Docker
and the local database remain prerequisites for live PrairieLearn; only Node and
the artifact are needed for the tested backup viewer. Native editing moves whole
branches; loops, isolated points, x-backtracking and endpoint glyphs remain outside
the photo-import contract.

With four days until November 9, preserve this bounded route and backup. The
remaining presenter/projector check is realistic; recognition architecture work
or Gemini inference would add unmeasured risk. **Stop after this local commit.**
No next phase, deployment, push, merge or inference is authorized by this result.
