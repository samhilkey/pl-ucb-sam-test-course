# Step 4F — Final STAR demo acceptance

**Readiness: CONDITIONAL PASS for the November 9 assisted demonstration.** The
new real-paper case passed the complete local route in Chrome on the user-confirmed
presenter Mac. The recorded backup passed with PrairieLearn stopped. Physical
projector/back-row readability, human timing and Safari use still need the exact
manual checklist. There is no claim of general automatic recognition accuracy.

Date: 2026-11-06, America/Los_Angeles. Branch:
`feat/automatic-photo-recognition-cv`. Clean starting HEAD:
`c3ebb1944eca95bd1c3244d811e08109cff62eef`. Runtime implementation matches Step 4D
`1d9be84f67d1f699249cedbbbf5fcbf26fc1ad0c`. No element, question, old test,
credential file or previous benchmark changed. New code is confined to this
acceptance/presentation directory, including a helper for a demonstrated local
runtime shutdown problem. No recognition feature/refactor, VLM inference, provider
upload, push, merge or deployed-course Sync occurred.

## New input and independence

The user supplied `IMG_1670.jpg` and states they drew a graph themselves. Its
source SHA-256 is `a8f8b7e7a6275cc6742eb1814a6161b56a00cf00ecf194ee32e318efe52e1f1b`.
No prior filename/hash match was found in the recorded benchmarks/docs/tests.
This is one new independently drawn physical-paper acceptance case, not a new
tuning case. The method stayed frozen. The accompanying `ChatGPT Image ...png`
has AI-labelled provenance and was excluded from the real-photo count, tracing
and reference annotation. No expected equation from it entered the test.

The 1688×1473 JPEG contains metadata. `inputs/new-paper-01.png` is an orientation-1,
metadata-free RGB PNG with identical decoded pixels. No contrast or shape change
was applied. The original EXIF/XMP/ICC and raw JPEG were not copied into the
package. [input-manifest.json](input-manifest.json) records identity and scope.

Operator waypoints, a separate approximate evaluator centerline and an exploratory
8px photo screen were frozen **before the first browser replay**, with hashes in
[frozen-before-test.json](frozen-before-test.json). The reference is a single-agent
visual annotation with about 6px uncertainty, not independent expert/blinded ground
truth. “New independent drawing” does not mean independent annotation or a general
recognition benchmark. The first functional replay passed. A final replay moved
the no-recognition instrumentation check before submission reload; inputs and
runtime code were unchanged. No image-driven recognition tuning occurred.

## Actual route and geometry

The new photograph passed at **1920×1080 and 1280×720**. The previous real--01
two-line photo was replayed to check disconnected branches. All actions used
mouse/keyboard controls on the actual local PrairieLearn question, not injected
native geometry or a mock grader. Automatic CV and fitting entry points were
instrumented to throw and were checked before page reload; neither ran.

For each of three trials: create an unrelated native point, upload photo, manually
place O/X/Y and values, trace actual ink, review/acknowledge, import native freeform,
Save & Grade and refresh, Select/move a branch, Save & Grade and refresh, return it
to the original position through native editing, then Save & Grade and refresh.
There are **9 real Save & Grade POSTs and 9 explicit refreshes**. All save/restore
comparisons passed. The prepared variants retain the original position, ready
for a short native-edit demonstration. The x-squared sandbox correctly grades
these different graphs 0% without repairing their geometry.

The new photo has **one continuous curve and a separate dot**. The curve retains
both sharp peaks, endpoints and its off-origin central minimum. The dot's role
is uncertain; it was retained with a **separate manual native Other marks action**,
not silently dropped or described as automatically extracted. The unrelated test
point and source dot stay distinct. Native curve editing leaves both points intact.
In the older two-line case, moving one branch leaves the second unchanged.

| New photo measure | Desktop result |
| --- | --- |
| Reference→trace / trace→reference p95 | 3.495 / 3.494 source px |
| Approximate reference coverage within 3px / 5px / 8px | 91.27% / 100% / 100% |
| Two marked-peak errors | 1.00px / 2.85px |
| Maximum annotated endpoint error | 1.41px |
| Added native anchor/endpoint error | <3.3e-13 source px |
| Added sampled SVG rendering drift | <0.001 source px |
| Source dot center error after manual native placement | <0.009 source px across both viewports |

The 1280×720 trial gives essentially the same curve results. The apparent precision
of encoding/point placement measures mathematical round-trip preservation of the
entered trace, not human or automatic extraction accuracy. The trace simplifier's
tolerance is 0.75 source pixel. Numeric calibration is manual/approximate, with no
independent survey ground truth. Ink color/width, arrow decoration and endpoint
inclusion semantics are not reconstructed. The existing real--01 case keeps its
previous 11.18px reference-endpoint discrepancy and explicitly assigned units.

Fresh source-photo overlays, submitted/gradeable controls, original/edited/final
states and all checks are in [results/acceptance.json](results/acceptance.json) and
[results/evaluation.json](results/evaluation.json). Green overlays show rendered
geometry and a cross at the manually placed dot; orange overlays show the trace.

## Primary outage, recovery and backup

The first deliberate local container stop exposed a **critical runtime problem**:
PostgreSQL could not restart because its Unix socket lock referenced a dead
postmaster. The agent confirmed no PostgreSQL process/ready server, moved only
the stale socket/lock entries aside, and started the existing database. No database
file, container, volume or saved attempt was deleted. The primary became healthy.

`local-runtime.cjs` now supplies a tested **graceful PostgreSQL stop before Docker
stop** for this local image. A repeat stopped the primary, passed the independent
backup/package test, and restarted it. The immediate restart result was not
parseable in the orchestration capture; independent follow-up confirmed HTTP 200,
healthy Docker state, and **all three variants restored exactly**, including
curve controls and points. Initial failure and subsequent evidence are retained
in `results/primary-outage-test.json`, `graceful-outage-test.json`, and
[primary-restoration.json](results/primary-restoration.json). Use the graceful
helper for deliberate shutdown and the recorded backup if startup fails during
the talk; do not attempt a database reset on stage.

The standalone viewer on **localhost3020** is independent of PrairieLearn and
the database. With primary service actually stopped, it loaded all 12 embedded
original/review/native/edit/restoration images. After switching the browser
offline, navigation and both native JSON downloads passed without further HTTP
requests. It is explicitly labeled recorded evidence, not a live grader/editor.
Viewer requests for `.env.local`, `.env.example` and arbitrary repository paths
return 404. No credential or external resource is needed.

## Presentation and presenter computer

The user confirmed **this Mac** as the November 9 presenter machine. Local ARM64
Docker, the existing image/database, Node 20.19.6, the course checkout and all new
assets were verified here. The course mount is the current checkout. Chrome 156
passed. Safari 27.0.1 is installed, but its driver rejected remote automation;
that setting was left unchanged and Safari is not reported as passing.
The Browser plugin/skill was unavailable, so the repository's existing Playwright
CLI workflow was used without installing another browser dependency.

The package contains six slides with a planned 4–5-minute script. Topics cover
motivation, workflow, successful real-photo assistance, manual/automatic roles,
measured preservation, limitations and future gated VLM research. Real evidence
images remain separate from the unverified AI-labelled comparison. PowerPoint's
required authoring SDK/dependency loader was unavailable locally; no substitute
PPTX library was installed. Delivery is a self-contained browser deck plus a
six-page printable PDF, not a claim of PowerPoint QA.

The first 1920px capture exposed part of the next slide. The artifact's viewport
scaling/navigation was corrected and retested: one complete slide at 1920×1080,
arrow-key advancement, six complete 1280×720 frames, loaded images, text bounds
and a six-page PDF export all passed. These checks establish screen-layout
behavior, not actual projector readability or human timing.

Exact entry points and prepared variants are in [urls.json](urls.json):

- [Browser presentation](http://127.0.0.1:3020/presentation)
- [Six-page PDF](http://127.0.0.1:3020/presentation.pdf)
- [Independent recorded backup](http://127.0.0.1:3020/backup)
- [Fresh live lower canvas](http://localhost:3000/pl/course/1/question/255/preview/#paper-lines-si-container)
- [Presenter script](PRESENTER.md) and [pending on-device checklist](MANUAL-CHECKLIST.md)

**Local availability is verified; remote/deployed availability is not.** New
assets exist on the unpushed local feature branch, not the deployed course.
The portable zip contains the recorded presentation/backup, input and helpers,
not a full PrairieLearn installation. It excludes `.env.local` and credentials.
No source code, asset or credential was uploaded to a provider.

## Final validation and decision

- **84 offline Node tests passed**, including existing geometry/native/config
  guards; **5 Python element/server tests passed**.
- **84 actual final-route browser assertions passed**, **23 package/primary-down
  assertions passed**, and **3 post-restart exact-restoration assertions passed**.
- JSON/pinned hashes, syntax, artifact links, six PDF page dictionaries, portable
  archive contents, staged credential exclusion and frozen-core diff checked.
- No application page exceptions or external HTTP requests in the final route.
  Existing PrairieLearn font decode warnings remain. No VLM/CV experiment ran.
- Visual QA inspected new-photo review/native/overlays and all slide frames.
  Initial runtime/layout failures are disclosed above; no unresolved functional
  failure remains on the tested Mac/Chrome path.

Commands/logs are in `results/` and [verification.json](verification.json). A
file/hash inventory is in [evidence-manifest.json](evidence-manifest.json).

```bash
node --test tests/star-geometry.test.cjs tests/star-recognition.test.cjs tests/star-native.test.cjs tests/star-method-feasibility.test.cjs tests/star-assisted.test.cjs tests/star-fit-branches.cjs tests/star-fit-coverage.cjs tests/star-gemini-config.test.cjs tests/star-demo-backup.test.cjs
docker exec star-automatic-cv-baseline-arm64 sh -c 'PYTHONPATH=/PrairieLearn/apps/prairielearn/python:/course/elements/pl-sketch /PrairieLearn/.venv/bin/python -B /course/tests/star-assisted-server.py -v'
node benchmarks/photo-graphs/multi-method/step-4f/run-browser.cjs
node benchmarks/photo-graphs/multi-method/step-4f/evaluate.cjs
node benchmarks/photo-graphs/multi-method/step-4f/build-package.cjs
# The deliberate outage check restarts the service afterwards:
node benchmarks/photo-graphs/multi-method/step-4f/local-runtime.cjs stop
node benchmarks/photo-graphs/multi-method/step-4f/check-package.cjs
node benchmarks/photo-graphs/multi-method/step-4f/local-runtime.cjs start
node benchmarks/photo-graphs/multi-method/step-4f/check-package.cjs --primary-restoration
```

**PASS:** new-paper assisted route, corners/endpoints/dot retention, native edits,
grading/restoration, disconnected-branch regression, primary-independent backup,
current local assets and repaired/tested local shutdown/startup procedure.

**CONDITIONAL:** actual projector/back-row readability and human 3–5-minute timing
must pass [MANUAL-CHECKLIST.md](MANUAL-CHECKLIST.md). Safari needs manual acceptance
if chosen; use tested Chrome otherwise. New-machine/remote deployment, arbitrary
new graphs, automatic recognition, point semantics and endpoint glyphs remain
outside this acceptance.

With three days until November 9, keep the tested implementation frozen and do
the projector/presenter check. No recognition expansion or Gemini inference is
justified by this result. Commit locally, verify clean status and stop for review.
