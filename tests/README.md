# Photo regression checks

Start local PrairieLearn and load this course, then run:

```bash
node tests/star-photo-confirmation.cjs
node tests/star-photo-branches.cjs
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
transfer. Display-only controls must preserve a valid proposal. The photo panel
is expanded during this state regression check so its existing scroll layout
does not conceal tracing controls.

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
Coverage tests prevent a model from winning by excluding steep sections and
verify that one continuous branch cannot contain an internal fitted pole.
