# Photo regression checks

Start local PrairieLearn and load this course, then run:

```bash
node tests/star-photo-confirmation.cjs
node tests/star-photo-branches.cjs
node tests/star-photo-workflow.cjs
node --test tests/star-fit-branches.cjs
node --test tests/star-fit-coverage.cjs
```

Requires Node.js, Playwright CLI (`playwright-cli` on PATH), and Chrome.
No benchmark datasets are needed: the check creates small line images in memory
and exercises the actual `star-photo-test` question through its upload, tracing,
fitting, and native canvas controls.

Optional environment variables:

- `PL_PHOTO_TEST_CLI`: path to the Playwright CLI executable or a wrapper.
- `PL_PHOTO_TEST_URL`: question preview URL if the local course/question IDs differ.
- `PL_PHOTO_TEST_OUTPUT`: directory for screenshots (defaults to `/tmp/pl-sketch-photo-confirmation`).

The check covers photo replacement, clearing/undoing/adding strokes, calibration
changes, search width, polynomial degree, family changes, failed reads/refits,
slow/out-of-order uploads, invalid images, recovery, and successful native canvas
transfer. Display-only controls must preserve a valid proposal. Both browser
regressions use the native photo dialog without CSS expansion or layout overrides.

The branch check covers a single line, two disjoint lines, two reciprocal
branches, a three-branch graph with steep ends, and overlapping x-ranges. It checks every branch in
the preview, native SVG, saved canvas state, and gradeable submission data.
It also exercises branch-specific refitting, a failed later branch, and undo
followed by replacing a two-branch drawing with one branch. Screenshots and raw
observations default to `/tmp/pl-sketch-photo-branches`.
The mobile case uses the original panel at 390 by 844 pixels and scrolls to the
photo and controls without changing its layout.

Overlapping x-ranges are preserved for review. The existing PrairieLearn
function-input validation may reject them on submission; this change does not
relax that validation or assess the mathematical correctness of the drawing.
The Node unit checks verify coordinate mapping and atomic transfer: a bad later
branch must leave all existing tool drawings intact.

The workflow check uses a portrait three-branch fixture at desktop 1440 by 1000
and mobile 390 by 844. It verifies that the complete photo and primary action
remain on screen, step navigation, axis-value validation, keyboard marker edits,
zoom/pan without accidental tracing or refitting, review, Escape/focus recovery,
and three-branch native state/submission data. Mobile canvas gestures use
Chromium touch events through CDP; these are browser-emulated touches, not a
physical-device camera or student usability study. Screenshots and results
default to `/tmp/pl-sketch-photo-workflow`.

Coverage tests prevent a model from winning by excluding steep sections and
verify that one continuous branch cannot contain an internal fitted pole.

## Automatic CV extraction (step 2)

```bash
node --test tests/star-recognition.test.cjs tests/star-geometry.test.cjs
node benchmarks/photo-graphs/automatic-cv/experiment-01/evaluate.cjs
python3 benchmarks/photo-graphs/automatic-cv/experiment-01/serve.py --port 8765
# In another terminal, with the same Playwright CLI configuration as above:
node tests/star-recognition-browser.cjs
```

The pure Node tests recognize actual PNG pixels without manual guides or
equations. Fixtures and evaluator-only references are under the new
`benchmarks/photo-graphs/automatic-cv/experiment-01` namespace. Four supported
controlled rasters and explicit challenge/failure cases are tested separately
from real photographs. The browser check decodes images through Canvas and
compares output to Node, at desktop and mobile sizes. This checks geometry
extraction only; native import and actual Save & Grade remain step-3 work.

## Native automatic import (step 3)

```bash
node --test tests/star-native.test.cjs
# Requires local PrairieLearn with the new question loaded:
export STAR_NATIVE_TEST_URL=http://localhost:3000/pl/course/1/question/254/preview
node tests/star-native-browser.cjs
```

The native browser script uses actual file upload and CV recognition, explicitly
confirms the proposal, exercises native Select dragging, sends real Save & Grade
requests, and refreshes/restores all four controlled cases. It verifies retained
prior objects and the existing mathematical grader's incorrect outcomes, rejects
ambiguous/stale proposals, checks stock manual drawing, and measures the actual
polyline/spline/freeform SVG and gradeable representations. It also tests the
assisted photo route's freeform encoding, submission, and restoration. Local question IDs
may differ; find `star-automatic-photo-test` under the course's Questions page.
Use `PL_PHOTO_TEST_OUTPUT` to save the raw result and screenshots. Read the
step-3 report under `benchmarks/photo-graphs/automatic-cv/experiment-02-native/`.
