# Step 4H offline reproduction

From repository root on the presenter Mac:

```bash
node benchmarks/photo-graphs/multi-method/step-4h/run-offline.cjs
node --test tests/star-geometry.test.cjs tests/star-recognition.test.cjs tests/star-native.test.cjs tests/star-method-feasibility.test.cjs tests/star-assisted.test.cjs tests/star-fit-branches.cjs tests/star-fit-coverage.cjs tests/star-gemini-config.test.cjs tests/star-demo-backup.test.cjs tests/star-providers.test.cjs tests/star-gemini-pilot.test.cjs tests/star-gemini-once.test.cjs tests/star-gemini-observation.test.cjs tests/star-cv-assisted.test.cjs tests/star-canvas-reference.test.cjs tests/star-hybrid.test.cjs
docker exec star-automatic-cv-baseline-arm64 sh -c 'PYTHONPATH=/PrairieLearn/apps/prairielearn/python:/course/elements/pl-sketch /PrairieLearn/.venv/bin/python -B /course/tests/star-assisted-server.py -v'
```

Gemini-named Node tests are offline guards/fixtures/mocks, not API calls. Neither
the new module nor either new runner loads a key, calls an external service or
uses a grading answer as inference input. No `.env.local` is needed.

`fixtures.cjs` generates two explicitly controlled PNGs and a matching-answer
evaluator reference. Existing V and metadata-free user-photo files are reused.
It authors only coarse semantic regions and values visible in the images; the
fusion module never receives the reference traces or expected function.
`run-offline.cjs` reads evaluator references **after** CV/fusion, writes labeled
semantic fixtures, raw CV observations, reviewed candidates (when safe), overlays
and metrics. Green overlays are accepted **development-assisted** candidates;
orange fragments on the real photo are blocked candidates, never an accepted
reconstruction. Magenta crosses show measured dot candidates.

The local PrairieLearn container must be running. The actual sandbox is
http://localhost:3000/pl/course/1/question/254/preview/ . Browser plugin unavailable;
the existing Playwright CLI and Chrome are used without adding dependencies:

```bash
export PL_PHOTO_TEST_CLI=/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh
node benchmarks/photo-graphs/multi-method/step-4h/run-browser.cjs
PL_PHOTO_TEST_OUTPUT=/private/tmp/star-step4h/native-regression node tests/star-native-browser.cjs
PL_PHOTO_TEST_OUTPUT=/private/tmp/star-step4h/cv-assisted-regression node tests/star-cv-assisted-browser.cjs
node benchmarks/photo-graphs/multi-method/step-4g-4/run-manual-regression.cjs
node benchmarks/photo-graphs/multi-method/step-4f/evaluate.cjs /private/tmp/star-step4g4/manual-regression
git diff --check
```

The hybrid proof injects the module and a button labeled **OFFLINE FIXTURE** into
its test page only. Its receiving configuration is a local copy with the
experimental flag. It does not change the course's configured tools, register a
provider, alter the ordinary review UI or weaken the grader. It uses actual native
objects, not a photographic overlay, for the asserted submissions. The visible
100% check filters out hidden page text. Subsequent native editing and refresh
work without injected code. The real-photo case stays blocked and exercises the
existing direct-native fallback instead. These are automated browser replays,
not observed student behavior or a timed human rehearsal.

Browser output goes to `/private/tmp/star-step4h/browser`. Manual regression uses
the existing Step 4G-4 wrapper's `/private/tmp/star-step4g4/manual-regression` output;
it reuses the exact Step 4F body with only the Photo options entry click. Previous
committed evidence is not rewritten. Selected final evidence and complete
verification checklists are copied into `results/`; duplicated legacy state
snapshots remain at the recorded local path/hash. Large raw browser JSON is
compact whitespace only; values are unchanged.

Independent schema check (installed container Ajv):

```bash
docker exec -w /PrairieLearn/apps/prairielearn star-automatic-cv-baseline-arm64 node -e 'const Ajv=require("ajv/dist/2020"); const fs=require("fs"); const p="/course/benchmarks/photo-graphs/multi-method/step-4h/"; const validate=new Ajv({strict:false}).compile(require(p+"semantic.schema.json")); let n=0; for(const f of fs.readdirSync(p+"results").filter(f=>f.endsWith(".semantic-fixture.json"))){const d=require(p+"results/"+f); if(!validate(d.semantics))throw Error(JSON.stringify(validate.errors)); n++} console.log("Independent JSON Schema validation passed: "+n+" semantic fixtures")'
```

For November 9 use the unchanged [Step 4F script](../step-4f/PRESENTER.md), with
**Photo options → Trace a paper graph (manual)** as the current entry. The live
manual canvas is http://localhost:3000/pl/course/1/question/255/preview/#paper-lines-si-container .
The frozen backup remains `../step-4f/offline-backup.html` or
http://127.0.0.1:3020/backup when its existing `serve-package.cjs` is running.
This step replays manual acceptance and verifies unchanged backup bytes; it
does not repeat the prior primary-service outage exercise.
