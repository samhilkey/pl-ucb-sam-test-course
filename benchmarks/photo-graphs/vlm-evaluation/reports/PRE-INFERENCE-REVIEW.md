# Pre-inference review

Date: 2026-10-26. Branch: `experiment/vlm-graph-recognition`.
No live VLM API request was made during this review. Publication is authorized
only for the experiment branch; no merge into `master` is part of this work.

## Commit and artifact inspection

Reviewed original commits `f9f6eb2` (9 files) and `b03c5f6` (8 files). Every changed
path is inside `benchmarks/photo-graphs/vlm-evaluation/`. They contain contracts,
prompts, source, tests, documentation, and empty directory placeholders. They do
not contain generated prediction JSON, response records, CSV metrics, or overlay
images. `STEP-03-OFFLINE.md` is a test report, not recognition evidence.

Credential-pattern scanning of committed blobs and source review found no secrets.
The test keys/secret sentinels are explicit fake constants used for redaction
checks. No credential values were read or placed in the audit request. The only
wire-adapter exercise used a dummy header with sockets blocked.

Ignore-rule probes passed for `.env`, `.env.*`, `.venv`, Python caches, and nested
prediction/overlay/report run directories. Placeholders and verification documents
remain trackable. The working tree was clean before review; review changes are
limited to this experiment. Existing production/question/experiment-01 files are
unchanged. Remote publication should preserve both original commits and add the
review fix, rather than rewrite history or force-push.

## Issue found and corrected: mock evidence

The original evaluator labeled mock runs but still accepted them by default and
populated ordinary collection summaries. The review adds an executable boundary:

- Default evaluation rejects `source_kind=mock` before creating report outputs.
- `--allow-mock` permits offline diagnostics only. Their metrics are kept under
  `mock_groups`; real `groups` are empty and `real_recognition_cases=0`.
- Every mock CSV row has `is_real_recognition=false`. Existing source labels and
  visible mock watermarks are retained.

The runner tags injected transports as mocks; the CLI has no switch for presenting
a mock as real. This prevents accidental evidence mixing in the supported workflow.
It is not attestation against deliberate manual tampering with local metadata.

## Corner continuity

A regression test uses two corners in one stroke. The split pieces are
`[0,1]`, `[1,2,3]`, `[3,4]`: adjacent pieces share the identical original sample at
each corner. Their edge list exactly equals the original stroke's edge list.
Bidirectional geometric distance is zero within floating-point precision, with
100% coverage. The branch count remains one, and only the original stroke ends
are endpoints. The plan does not turn smoothness breaks into disconnected graph
branches. Actual native PrairieLearn conversion still requires separate integration.

## Exact single-case payload

The reviewed example selects only `controlled--02-parabola--clean` and pins
`gpt-4.1-mini-2025-04-14`, high image detail, JSON-object mode, and an 8000-token
completion limit. It has two messages:

1. System: the exact committed `transcribe-v1.1.txt` bytes followed by the generic
   output JSON Schema, identical to the blobs in `b03c5f6`.
2. User: the text `Image width=1200 height=1200 pixels.` and one metadata-free PNG
   encoded as a data URL. Decoded RGB pixels match the selected original exactly.

Model name/output settings are ordinary request parameters. The output schema and
dimensions are also sent, so describing the request as literally only image and
prompt would omit those generic fields. No case ID, filename/path, original hash,
reference geometry, ideal equation, scoring policy, expected branch count, or
annotation file is included. Photo-visible writing naturally remains in the image.

The request was passed through the real JSON serialization adapter with a mocked
HTTP opener and blocked sockets; its outgoing body matched the reviewed bytes.
The full credential-free `request.json` is retained only in the local temporary
review directory, not committed as a duplicate image artifact. Permanent hashes,
counts, model settings, and cost assumptions are in
[PRE-INFERENCE-PAYLOAD.json](PRE-INFERENCE-PAYLOAD.json).

Frozen prompt SHA-256:
`6bcec52cadd58687c4b77842ea9c950f0eada92cf7f7c79ad5c78a4f6a4321ae`.
Canonical request SHA-256:
`d3abff4cc3e50e8555c105cda1242741d6f8f1851ca4316919ac984c9c3b1246`.
The exact body is 1,110,250 bytes; the base64 image length is not its token bill.

## Offline verification

**49 tests passed in 19.249 seconds.** In addition to the Step 3 checks, regressions
cover shared corner vertices/edges/branch identity, exact one-case request contents
and file-read isolation, and mock rejection/separate counters. All model response
fixtures remain mock-labeled. This review produces no real recognition result.

## Commands for exactly one later live test

Activate the Python environment described in the README and provide `VLM_API_KEY`
through your shell/secret manager. Do not put its value into commands or files.
From the repository root, this command is safe to run now as a local preflight:

```bash
python -B benchmarks/photo-graphs/vlm-evaluation/run_vlm_eval.py \
  --dry-run \
  --case controlled--02-parabola--clean \
  --model gpt-4.1-mini-2025-04-14 \
  --base-url https://api.openai.com/v1 \
  --response-format json_object \
  --image-detail high \
  --token-limit-field max_completion_tokens \
  --max-output-tokens 8000
```

The following sends one request and must wait for approval of the first live test:

```bash
python -B benchmarks/photo-graphs/vlm-evaluation/run_vlm_eval.py \
  --execute \
  --case controlled--02-parabola--clean \
  --model gpt-4.1-mini-2025-04-14 \
  --base-url https://api.openai.com/v1 \
  --response-format json_object \
  --image-detail high \
  --token-limit-field max_completion_tokens \
  --max-output-tokens 8000 \
  --run-id parabola-real-001

python -B benchmarks/photo-graphs/vlm-evaluation/evaluate.py \
  --run-id parabola-real-001
```

There is exactly one selected case and no automatic retry. The second command is
entirely offline, even when the first response fails validation. Run IDs cannot be
reused. Changing model/settings/prompt/schema changes the frozen request hash and
requires a corresponding cost/payload review. Account/model availability has not
been probed with credentials.

Expected paths, all relative to `benchmarks/photo-graphs/vlm-evaluation/`:

```text
predictions/parabola-real-001/run.json
predictions/parabola-real-001/raw/controlled--02-parabola--clean.txt
predictions/parabola-real-001/records/controlled--02-parabola--clean.json
predictions/parabola-real-001/validated/controlled--02-parabola--clean.json
reports/parabola-real-001/results.csv
reports/parabola-real-001/summary.json
reports/parabola-real-001/REPORT.md
reports/parabola-real-001/qualitative-review.csv
reports/parabola-real-001/stroke-plans.json
overlays/parabola-real-001/controlled--02-parabola--clean.png
```

Raw text requires an actual HTTP response; a timeout can leave only its error
record. Validated JSON exists only after schema/semantic validation succeeds.
Failure reports keep unknown metrics blank and never insert a fabricated trace.

## Illustrative API cost and model caveat

The model above is an example, not an account-availability or accuracy claim. It
is marked **deprecated** in the current official documentation. Its documented
standard rates are $0.40 per million input tokens and $1.60 per million output
tokens. See the [model page](https://developers.openai.com/api/docs/models/gpt-4.1-mini).

Under the [documented image-token rules](https://developers.openai.com/api/docs/guides/images-vision),
the 1200 × 1200 image uses `38 × 38 = 1444` patches and approximately
`ceil(1444 × 1.62) = 2340` billable input tokens. The generic instructions/schema
contain 12,438 characters. A rough 3–5 characters/token estimate gives another
2487–4146 text tokens, plus small message overhead; this is not a tokenizer or
billing measurement. At the full 8000-output-token budget, the estimated total is
about **$0.015–$0.016 USD**, roughly 1.5 US cents. Shorter output costs less.
Actual usage is saved when returned by the provider. Different models, rates,
residency settings, or tokenization change this estimate. No API charges were
incurred by this review.
