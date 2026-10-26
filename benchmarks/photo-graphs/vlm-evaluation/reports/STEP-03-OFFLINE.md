# Step 3 offline verification

Date: 2026-10-26. Branch: `experiment/vlm-graph-recognition`.
Base commit: `d600ab07391e99bb2cc5b2d60646dc4fb4870a4b`.
This records the offline validation checkpoint before local commits.

**46 offline tests passed in 16.386 seconds. Zero VLM API requests were sent.**
This report verifies implementation behavior using synthetic response fixtures;
it contains no model recognition results or feasibility accuracy claim.

## Reproduce

Use the setup in [README.md](../README.md), then run from the repository root:

```bash
python -B -m unittest discover -s benchmarks/photo-graphs/vlm-evaluation/tests -v
python -B benchmarks/photo-graphs/vlm-evaluation/run_vlm_eval.py --dry-run
```

Verified environment: Python 3.14.1, NumPy 2.5.4, Pillow 12.3.0,
jsonschema 4.26.0. Tests block socket connections and HTTP transport; response
fixtures enter through an injected mock. Mock runs are marked `source_kind=mock`
in metadata/CSV/JSON and `MOCK TEST ONLY` in reports/overlays.

## Verified behavior

- All six image paths, hashes, sizes, metadata-free RGB pixels, and a relocated
  input tree. A separate CLI dry-run also passed from `/private/tmp`.
- Request isolation: no reference-file reads or case identity/reference metadata
  in model requests. Extra reference fields in a manifest are rejected.
- Schema 1.1 corner markers, indexed endpoints, closed-stroke semantics, separate
  branches, isolated points, finite numbers, exact pixel bounds, and strict JSON.
- Stable calibration bases, observed tick/axis consistency, partial numeric
  scales, pixel/graph consistency, and assistance/clarification requirements.
- Corner-preserving breakpoint plans, distances that never bridge branches,
  bidirectional extra-ink detection, and numerical equivalence to the existing
  experiment-01 distance utilities on synthetic fixture geometry.
- Raw response persistence, validation failures, HTTP errors, simulated timeouts,
  refusal/truncation, available usage, latency, credential redaction, continuation
  after individual failures, and prevention of accidental artifact overwrites.
- A full six-case mocked inference/evaluation run producing six triptychs, both
  results/review CSVs, summary JSON, and a marked mock report. Failed output keeps
  metric columns with null/blank values rather than fabricated distances.
- Sparse-point qualitative observations and clarification requests remain in
  reports while unverified quantitative scores remain null and out of accuracy
  denominators. Preservation/invention judgments remain explicitly unverified.
- Reference hash changes and modified prediction artifacts are rejected/flagged.
  Existing manual review reports are preserved.
- Mock sparse-point and explicit-corner triptychs were visually inspected for
  layout, source labels, independent point rendering, corner/endpoint markers,
  and the mock watermark. These rendering fixtures are not VLM predictions.

SHA-256 comparisons confirmed all **250 existing files** under `elements/`,
`questions/`, and `benchmarks/photo-graphs/experiment-01/` remained unchanged,
with no added files in those directories. At this validation checkpoint, Git HEAD
was still at the base commit and only `benchmarks/photo-graphs/vlm-evaluation/`
contained local changes. No pull, merge, commit, or push had been performed.

## Remaining limits

Live provider/model behavior remains untested. This experiment uses affine-only
calibration and performs no projective rectification. It exports an offline
breakpoint plan, not native PrairieLearn state; native import/rendering/grading
requires future integration and separate verification. Photo fidelity and sparse
point preservation/invention require actual inference plus reference/manual review.
Paper/real references remain approximate and are not independent expert labels.

Step 3 stops here for review before any live inference.
