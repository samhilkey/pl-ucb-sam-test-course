# Step 4A — Method and provider feasibility

Verified November 5, 2026, America/Los_Angeles. Demo: November 9; method decision
target: November 6. Starting commit: `1c76c1f66645d7d86c41c228bf57d1681ccd1d95`,
branch `feat/automatic-photo-recognition-cv`.

**Recommendation:** test one VLM first: `gemini-3.5-flash-lite` on the two existing
failed photo crops, after explicit Step 4B, image-release, privacy and $0-budget
approval. Keep `nvidia/nemotron-3.5-super-vl:free` through OpenRouter as an
unactivated reserve. No model inference, credentialed provider request, paid call,
or production integration occurred in Step 4A. VLM recognition fidelity remains
unknown. Public availability does not establish access for this account.

## Comparison

| Option | Verified feasibility | Limits and privacy | Decision |
| --- | --- | --- | --- |
| Existing deterministic CV | Shared geometry and native import already exist. Historical real-photo automatic result remains **0/2**. | Current scale reader is a small single-digit template reader; thin pencil and perspective remain problems. | Retain as baseline; no recognition changes here. |
| Local OCR | Apple Vision completed an on-device probe on both exact crops. Tesseract is absent. | Text boxes are not tick anchors; OCR confidence is not accuracy. No calibration improvement measured. | Small OCR-assisted arm justified for 4C, subject to approval. |
| Gemini Developer API: `gemini-3.5-flash-lite` | Stable image-to-text model; structured output advertised; standard Free input/output listed. 1,048,576 input / 65,536 output tokens. | Active project RPM/TPM/RPD unknown; active environment has no key. Unpaid content can support product improvement and human review; personal/sensitive/confidential input prohibited. | Primary conditional candidate, **not tested**. |
| OpenRouter: `nvidia/nemotron-3.5-super-vl:free` | Public catalog reports image input, zero prompt/completion price, `response_format` and `structured_outputs`; 1M context. | Documented free tier: 20 RPM, 50 RPD below 10 lifetime purchased credits; higher purchase tier 1,000 RPD. Actual remaining quota unknown. NVIDIA endpoint notice allows logging/improvement and excludes personal/confidential data. | Reserve only; no automatic switch or purchase. |
| Local open-weight VLM | ARM64 Mac14,2, 16 GiB verified. Official `Qwen/Qwen3-VL-4B-Instruct` card supports images; MLX-VLM targets Apple Silicon. | No inspected VLM runtime or weights loaded. Quantized small-model feasibility is an inference; memory headroom, latency and JSON fidelity untested. | Defer installation/downloads; outside the two-model shortlist. |

Provider facts come from official [Google pricing](https://aistudio.google.com/docs/pricing#gemini-3.5-flash-lite),
[model capabilities](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite),
[quota documentation](https://aistudio.google.com/docs/rate-limits),
[unpaid terms](https://aistudio.google.com/docs/terms),
[OpenRouter model notice](https://openrouter.ai/nvidia/nemotron-3.5-super-vl:free),
[public catalog](https://openrouter.ai/api/v1/models),
[rate limits](https://openrouter.ai/docs/api_reference/limits.md), and
[provider logging controls](https://openrouter.ai/docs/guides/privacy/provider-logging).
The selected catalog record is preserved in
[`evidence/openrouter-catalog.json`](evidence/openrouter-catalog.json).
The complete source register is [`evidence/sources.json`](evidence/sources.json).

Google's terms require an operator aged 18+ and prohibit API clients directed
toward or likely accessed by under-18s. Clients made available in the EEA,
Switzerland or UK require Paid Services. Confirm audience and region eligibility
before any student-facing integration; this feasibility review grants no release
permission or exception to those restrictions.

Gemini 3.6 Flash also has a documented free standard tier, but a second Gemini
comparison is not proposed before the demo. Do not use historical 2.5 model names
or consumer Gemini subscription access as proof of API eligibility. Advertised
schema support does not prove acceptance of our specific schema or graph fidelity.

## Local OCR probe: obtained evidence

Used [Apple Vision](https://developer.apple.com/documentation/vision/recognizing-text-in-images.md)
`VNRecognizeTextRequest`, accurate/en-US, language correction off, request revision
3. Recognition runs on-device. No reference, equation, manual tick crop, CV mask,
or VLM output was supplied. No OCR label was accepted for calibration.

| Exact existing photo | Observed result | Interpretation |
| --- | --- | --- |
| real--01, 801 × 529 | 0 text observations; 253 ms. | The photo visibly lacks numeric ticks. Absence of OCR is not a known scale. |
| real--06, 529 × 420 | 7 text observations; first successful run 46,296 ms. Includes `160`, `80`, `2 40`, and grouped `0 1 23 4 567`. | Some useful text is recoverable, but 300 is omitted, x ticks are merged, and axis words are misspelled. High-confidence wrong/grouped text must not become calibration evidence. |

The first sandboxed attempt on each crop failed with `nilError`. Both completed
outside the sandbox using the same compiled probe. The cause is not isolated;
the difference is consistent with an execution restriction. One initial and one
subsequent timing do not establish steady-state performance or explain the long
first call. This macOS probe is not a deployable Linux PrairieLearn OCR backend.

Raw [OCR summary](evidence/ocr-summary.json), [real--01 JSON](evidence/real--01.ocr.json),
[real--06 JSON](evidence/real--06.ocr.json), and
[real--06 box overlay](evidence/real--06.ocr-overlay.png) are committed. Red boxes
show raw OCR observation bounds, not accepted labels or curve predictions.
The [real--01 overlay](evidence/real--01.ocr-overlay.png) has no boxes.

[Tesseract installation](https://tesseract-ocr.github.io/tessdoc/Installation.html)
requires an engine and language traineddata. Its official
[quality guidance](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html)
supports testing deskew, segmentation and local thresholding. Tesseract itself was
not installed or run. If portability requires it, use a pinned local engine in
4C and compare OCR-only tick correctness before integrating calibration.

## Reusable components and boundaries

| Component | Reuse and remaining work |
| --- | --- |
| `elements/pl-sketch/star-geometry.js` and `docs/automatic-photo-recognition/geometry-v1.md` | Authoritative common geometry validator: original pixels, ordered separate strokes, corners/endpoints, calibration evidence and uncertainty. All methods must convert to this before comparison or import. |
| `elements/pl-sketch/star-recognition.js` | Existing pure RGBA CV baseline, debug masks and shape-preserving path extraction. Do not feed VLM guidance to the CV-only arm. |
| `automatic-cv/experiment-01/{metrics.cjs,references,results,index.html}` | Existing bidirectional distances, coverage, endpoint/corner/axis diagnostics and inspection UI. Historical files remain unchanged; read frozen references only in a separate evaluation stage. |
| `elements/pl-sketch/star-native.js`, native tests and step-3 browser evidence | Reuse exact native encoding, stale proposal checks and atomic state handling in 4E; no new importer here. Step 4A reruns pure Node regressions, not live Save & Grade. |
| Read-only `experiment/vlm-graph-recognition` at `5482e48` | Inspected image-only manifest/payload patterns, strict parsing, no retries, sidecar provenance and mock separation. Its Python runner/schema/evaluator are **not present in this checkout** and have a different contract. No merge, checkout, cherry-pick or copy was performed. Implement only a narrow provider adapter and conversion after 4B approval. |

The prior two photo references are **approximate prior visual annotations**, not
blinded independent human ground truth. Their image, reference and baseline-output
hashes are frozen in [`inputs.json`](inputs.json) and the evaluator-only
[`evaluation-policy.json`](evaluation-policy.json). Existing dataset attribution
and crop provenance remain in `automatic-cv/experiment-01/source-attribution.json`.
A public dataset license does not itself establish permission for an external
provider's data-use terms. Image release remains pending.

## Executable design and next-step boundary

[`protocol.json`](protocol.json) defines the request budget, metric policy,
failure states, deadlines and approval gates. [`preflight.cjs`](preflight.cjs)
constructs **offline** Gemini request previews using only generic
[`prompt.txt`](prompt.txt), [`observation.schema.json`](observation.schema.json),
dimensions and a metadata-free PNG. It verifies the input hashes/dimensions,
preserves decoded RGBA pixels, and records exact request hashes and byte counts.
It does not send or save request bodies, read credentials or load references.
There is no live transport or `--execute` mode.

The provider-facing schema describes observations, not native state. In 4B a
strict parser and converter must derive Photo Geometry v1 locally, including
mathematically consistent graph coordinates from supported calibration. Both
axes need at least two consistent numeric tick anchors and known intersection
values. Unknown scales keep graph coordinates null. Invalid JSON, ambiguous
topology or isolated points unsupported by the stroke-only native contract must
remain explicit; never silently drop them, guess a unit scale, or invent joins.
Provider/recognizer provenance belongs in a sidecar; retain existing calibration
source values. The converter is deliberately not implemented in 4A.

Google documents [inline PNG requests](https://aistudio.google.com/docs/image-understanding)
under a 20MB total request limit and [structured output](https://aistudio.google.com/docs/structured-output)
with a JSON Schema subset. Our previews are about 0.36MB each. The proposed
[Interactions API](https://aistudio.google.com/docs/interactions-overview) revision
is `2026-05-20`; `store=false` avoids stored interaction state but **does not opt
out of unpaid service data use**. Exact remote acceptance is untested.

After approval, 4B is limited to **two requests total**, one per existing photo,
one model, sequential, 8,192 maximum output tokens, 120-second timeout, $0
authorized spend, no tools/retries/continuations or paid fallback. Active
credentials, unbilled tier, quota, image release and terms must be confirmed
before a request. An absent or blocked prerequisite produces a blocker record,
not a model switch or paid call. New independent images require approval of the
specific image list and additional request budget.

4C and 4D must use the same source pixels and frozen evaluation references. Any
deskew/crop/resize needs an invertible recorded transform back to original pixels.
Report both distance directions, per-branch coverage, missing/invented strokes,
corners/endpoints/gaps, axes/scales, required corrections, failure/abstention,
latency, quota and actual reported cost. Unknown values remain null. Produce
original/reference/prediction triptychs only after actual predictions exist.
Native import remains untested for the new methods until 4E.

New exploratory screening thresholds are in the protocol: ≥90% coverage per
branch, ≤5px p95 in both directions and ≤5px endpoint/corner errors, with no
invented topology. Retain the existing coverage-at-3px metric. These are
engineering screens, not validated grading tolerances; approximate references
can make numeric pass/fail uncertain. Independent calibration labels are needed
before numerical scale-accuracy claims. Always inspect the overlays.

Acquire two new constrained development drawings and one held-out independent
drawing: one clear graph per photo, upright visible axes, large numeric ticks,
dark continuous ink, visible corners/endpoints, no names or answers. Have a human
annotate visible ink and ticks before viewing any method output; freeze those
annotations and retain unknowns. Do not derive references from intended equations.
These drawings **have not been acquired or scored**. The held-out example is
reserved for demo acceptance; it must not be used to tune the recognizer.

## Validation and reproduction

Run from the repository root:

```bash
node --test tests/star-method-feasibility.test.cjs tests/star-recognition.test.cjs tests/star-geometry.test.cjs tests/star-native.test.cjs tests/star-fit-branches.cjs tests/star-fit-coverage.cjs
node benchmarks/photo-graphs/multi-method/step-4a/preflight.cjs
# Optional new evidence file; existing files are protected from overwrite:
node benchmarks/photo-graphs/multi-method/step-4a/preflight.cjs --output /private/tmp/star-step4a-fresh.json
git diff --check
```

**71 tests passed, zero failed**, including 7 new feasibility checks. Tests block
network entry points and reference reads during preflight, reject reference
fields/hash/dimension changes, preserve source pixels while removing metadata,
audit payload isolation, validate frozen baseline geometry and protect evidence
from overwrite. [`evidence/node-tests.log`](evidence/node-tests.log) records the
run; [`evidence/preflight.json`](evidence/preflight.json) records zero model
requests, null prediction/usage/cost/latency and pending live gates.

Reproduce the optional local macOS probe with a new output path:

```bash
swiftc -module-cache-path /private/tmp/star-step4a-swift-cache benchmarks/photo-graphs/multi-method/step-4a/probe-ocr.swift -o /private/tmp/star-step4a-ocr
/private/tmp/star-step4a-ocr benchmarks/photo-graphs/automatic-cv/experiment-01/inputs/real--06-piecewise-graph-paper.png > /private/tmp/star-step4a-ocr-fresh.json
node benchmarks/photo-graphs/multi-method/step-4a/render-ocr.cjs benchmarks/photo-graphs/automatic-cv/experiment-01/inputs/real--06-piecewise-graph-paper.png /private/tmp/star-step4a-ocr-fresh.json /private/tmp/star-step4a-ocr-fresh.png
```

The observed host required permission to run Vision outside the sandbox. Do not
interpret sandbox failure as an OCR accuracy result. No UI changed, so new browser
screenshots and Save & Grade replay are not applicable to 4A. Existing native
browser evidence was inspected, not rerun. OCR overlays were visually reviewed.

## Assessment and deadline

Step 4B is justified as a small feasibility experiment: current CV misses both
real photos, a candidate API advertises the required capabilities, and exact
inputs/evaluation boundaries are prepared. No method has yet demonstrated a
real-photo improvement. OCR can recover some text but needs tick association,
false-label rejection and a portable runtime before it can help calibration.

Four days remain until November 9. Completing all five remaining steps with
separate review checkpoints is tight and depends on prompt approval, API access
and independent drawings. Prioritize a 4B result and method decision by November
6, integration November 7, independent end-to-end checks November 8, and a
November 9 rehearsal. These are conditional targets, not completed work.

Recommend avoiding a second-provider/local-model comparison. If VLM-only fidelity
is sufficient, request explicit permission to skip or combine unnecessary 4C/4D
experiments and preserve 4E/4F time. If geometry needs refinement, request a short
hybrid arm. **No checkpoint is skipped by this recommendation.** Network outages
need saved, verified evidence and the existing assisted/manual workflow, labeled
as fallback. Do not claim that a prerecorded or assisted import is automatic
real-photo recognition.

Step 4A ends at a local commit and clean working tree. Step 4B remains unapproved.
