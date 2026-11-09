# Step 4G-4 reproducible checks

Run from the repository root. Browser checks use the existing Playwright CLI
and local Chrome because the Browser plugin/skill was unavailable. The local
PrairieLearn container and course database must already be present. These tests
create local preview variants; they do not touch the deployed course.

```bash
node --test tests/star-geometry.test.cjs tests/star-recognition.test.cjs tests/star-native.test.cjs tests/star-method-feasibility.test.cjs tests/star-assisted.test.cjs tests/star-fit-branches.cjs tests/star-fit-coverage.cjs tests/star-gemini-config.test.cjs tests/star-demo-backup.test.cjs tests/star-providers.test.cjs tests/star-gemini-pilot.test.cjs tests/star-gemini-once.test.cjs tests/star-gemini-observation.test.cjs tests/star-cv-assisted.test.cjs tests/star-canvas-reference.test.cjs
docker exec star-automatic-cv-baseline-arm64 sh -c 'PYTHONPATH=/PrairieLearn/apps/prairielearn/python:/course/elements/pl-sketch /PrairieLearn/.venv/bin/python -B /course/tests/star-assisted-server.py -v'
```

The Gemini-named tests above are offline fixtures/mocks/guards. They do not
authorize or execute inference. The current step used no Gemini credential for
model calls.

```bash
export PL_PHOTO_TEST_CLI=/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh
node tests/star-canvas-reference-browser.cjs
node tests/star-canvas-reference-recovery.cjs
PL_PHOTO_TEST_OUTPUT=/private/tmp/star-step4g4/native-regression node tests/star-native-browser.cjs
PL_PHOTO_TEST_OUTPUT=/private/tmp/star-step4g4/advanced-regression node tests/star-cv-assisted-browser.cjs
node benchmarks/photo-graphs/multi-method/step-4g-4/run-manual-regression.cjs
node benchmarks/photo-graphs/multi-method/step-4f/evaluate.cjs /private/tmp/star-step4g4/manual-regression
git diff --check
```

Canvas tests default to the already committed metadata-free PNG from IMG_1670.
The final recorded three-case run used the actual original JPEG via:

```bash
STAR_CANVAS_TEST_PHOTO='/Users/alaiasun/Library/Mobile Documents/com~apple~CloudDocs/D. UC Berkeley/Courses/CS294 STAR FA2026/Experiment/examples/IMG_1670.jpg' node tests/star-canvas-reference-browser.cjs
```

Both exact hashes and the original local-only path are recorded in
[input-manifest.json](input-manifest.json). The JPEG contains GPS metadata and
must not be copied into repository evidence. No photograph was uploaded to an
external provider. Browser outputs go to `/private/tmp/star-step4g4/`; selected
final outputs are copied into this step's `results/` directory. All manual/CV
references and earlier evidence are reused, never rewritten.

The recovery suite injects a CV exception, late result and browser storage quota
failure, and labels those as injected. It also executes actual abstention,
malformed replacement, confirmed calibrated native import, image-only rejection,
narrow layout and saved native restoration. The three-photo suite uses real CV
but delays its returned result briefly to verify the photo is visible first.

Implementation inventory:

- `elements/pl-sketch/star-canvas-reference.js`: isolated pixel reference,
  controls, scoped original-byte restoration and reference lifecycle.
- `elements/pl-sketch/star-automatic.js`: decoded-photo/CV lifecycle callbacks,
  stale-safe File handoff and explicit review snapshot refresh.
- `elements/pl-sketch/pl-sketch.js`, `info.json`, `pl-sketch.css`: opt-in wiring,
  script dependency and scoped accessible/responsive controls.
- `questions/star-automatic-photo-test/question.html`: correct stale sandbox
  instructions; unchanged x-squared target and native tools.
- `tests/star-canvas-reference*.cjs`: four offline tests and two actual browser
  suites; existing native/CV-assisted tests add only Photo options entry clicks.
- This step folder: reproducible frozen-manual wrapper, input manifest, report,
  presenter instructions, selected evidence, logs and file inventory.
