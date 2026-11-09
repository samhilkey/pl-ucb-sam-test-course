# Step 4H-2 checks and reproduction

From repository root, with the existing local PrairieLearn container running:

```bash
node --test tests/star-geometry.test.cjs tests/star-recognition.test.cjs tests/star-native.test.cjs tests/star-method-feasibility.test.cjs tests/star-assisted.test.cjs tests/star-fit-branches.cjs tests/star-fit-coverage.cjs tests/star-gemini-config.test.cjs tests/star-demo-backup.test.cjs tests/star-providers.test.cjs tests/star-gemini-pilot.test.cjs tests/star-gemini-once.test.cjs tests/star-gemini-observation.test.cjs tests/star-cv-assisted.test.cjs tests/star-canvas-reference.test.cjs tests/star-hybrid.test.cjs tests/star-targeted.test.cjs
docker exec star-automatic-cv-baseline-arm64 sh -c 'PYTHONPATH=/PrairieLearn/apps/prairielearn/python:/course/elements/pl-sketch /PrairieLearn/.venv/bin/python -B /course/tests/star-assisted-server.py -v'
```

Gemini-named tests are offline mocks/guards. No model request or key is needed.
The new handwritten input is frozen before recognition in
[IMG_1678-frozen.json](IMG_1678-frozen.json). Both actual original JPEG files are
on the confirmed presenter Mac at the supplied iCloud `Experiment/examples/`
location. They contain GPS metadata and are not copied into Git. The committed
metadata-free PNGs are local reproducible source images, not synthetic fixtures.

Browser plugin was unavailable; existing Playwright CLI / Chrome was used:

```bash
export PL_PHOTO_TEST_CLI=/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh
node tests/star-targeted-browser.cjs
node tests/star-targeted-new-paper.cjs
PL_PHOTO_TEST_OUTPUT=/private/tmp/star-h2/native-regression node tests/star-native-browser.cjs
PL_PHOTO_TEST_OUTPUT=/private/tmp/star-h2/cv-assisted-regression node tests/star-cv-assisted-browser.cjs
node benchmarks/photo-graphs/multi-method/step-4g-4/run-manual-regression.cjs
node tests/star-canvas-reference-recovery.cjs
git diff --check
```

The two new suites exercise the **normal sandbox-loaded scripts**.
No test-only UI, semantic fixture or prediction is injected. Provider observation
records the real input options/result without changing them. Tests simulate
student clicks and traces, keeping those assistance actions distinct from
automatic CV. Only local browser requests are allowed by the tests. Tests create
local preview variants, not deployed assessments.

New outputs are under `/private/tmp/star-h2/browser` and `new-paper`. The old
manual wrapper and reference recovery use their established
`/private/tmp/star-step4g4/` output locations. Committed checklists retain hashes
and paths of unabridged old regression outputs; selected screenshots, current
native data/submissions and logs are in this step's `results/`.

After copying those observed outputs into `results/normal-ui/results.json` and
`results/new-paper/results.json`, run:

```bash
node benchmarks/photo-graphs/multi-method/step-4h-2/evaluate.cjs
```

The evaluator reads the prior approximate IMG_1670 reference only after UI
recognition/correction. New-paper metrics compare Native state/rendering with
captured manual geometry and point positions; they are not independent real-photo
recognition scores. Additional written tick checks are approximate post-hoc
visual references, never calibration inputs. No expected equation is passed to
recognition, selection or tracing. The existing server alone grades x-squared.

Verified functionality: 139 Node tests, five server tests, normal UI 47 browser
assertions, new real paper 29, native regressions 165, optional CV-assisted 139,
frozen manual 84 and reference recovery 21. Overall automatic recognition still
fails; successful test assertions include correct rejection and manual recovery.

Initial failures/diagnostics: a test compared nominal click coordinates rather
than actual pointer anchors; another missed whitespace in score badges; the
native suite timed out once and passed with fewer concurrent browsers. None
required weakening an assertion about safe import or grading. The real CV
x-backtrack rejection remains. The native freehand endpoint loss led to the
specific on-canvas manual pointer-capture recovery, not a grading change.

Changed implementation: `star-targeted.js`, `star-canvas-review.js`, reference
frame persistence in `star-canvas-reference.js`, targeted provenance validation
in `star-native.js`, script wiring in `pl-sketch.js`/`info.json`, scoped CSS and
the sandbox's instructions. Existing CV, provider boundary, geometry schema,
manual builder, grading Python and frozen backup remain unchanged. Full inventory
and hashes are in `results/file-inventory.json`.
