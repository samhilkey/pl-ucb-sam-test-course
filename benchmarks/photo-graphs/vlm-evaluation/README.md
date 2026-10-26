# VLM graph-recognition pilot

Step 3 is implemented and offline-tested, awaiting review before any VLM API
requests. **No real recognition results exist.**
This Python-only experiment changes no production element, question, original
image, or experiment-01 file.

Branch: `experiment/vlm-graph-recognition`, created from
`chore/photo-graph-benchmark` at `d600ab07391e99bb2cc5b2d60646dc4fb4870a4b` without
pulling or merging `origin/master`. The unfinished drafts were preserved during
that branch switch. Step 2 was approved before the Step 3 refinements below.

## Setup and offline execution

Python 3.12+ is required by the pinned dependencies; verification used Python
3.14.1 on macOS. From the repository root:

```bash
python3 -m venv /private/tmp/star-vlm-venv
source /private/tmp/star-vlm-venv/bin/activate
python -m pip install -r benchmarks/photo-graphs/vlm-evaluation/requirements.txt
python -B -m unittest discover -s benchmarks/photo-graphs/vlm-evaluation/tests -v
python -B benchmarks/photo-graphs/vlm-evaluation/run_vlm_eval.py --dry-run
```

The default runner mode is also dry-run: no credentials, output files, network,
retry, or inference. It validates the input identities and constructs requests
locally. The tests block sockets and HTTP transport, inject synthetic responses,
and exercise all six cases end to end. Their temporary predictions, metrics, and
overlays are labeled `mock` / `MOCK TEST ONLY`; they are not recognition evidence.
See [the offline verification report](reports/STEP-03-OFFLINE.md).
The subsequent [pre-inference review](reports/PRE-INFERENCE-REVIEW.md) audits the
published commits, the exact single-case request, and separation of mock evidence.

## Six-case image-only manifest

[`pilot.json`](pilot.json) contains exactly `id`, relative `image`, original
`image_size` (`[width,height]`), and original-byte `sha256` for each case. Paths
resolve against the manifest's directory, independent of the working directory,
checkout location, and Docker mounts. Relocation must preserve relative layout.

| Case ID | Image path relative to pilot.json | Size | Reference policy |
| --- | --- | --- | --- |
| `controlled--02-parabola--clean` | `../synthetic/images/02-parabola--clean.jpg` | 1200 × 1200 | Known generated centerline |
| `controlled--04-absolute-value--clean` | `../synthetic/images/04-absolute-value--clean.jpg` | 1200 × 1200 | Known centerline and corner |
| `controlled--06-reciprocal--clean` | `../synthetic/images/06-reciprocal--clean.jpg` | 1200 × 1200 | Known separate branches |
| `paper--03-cubic-graph-paper` | `../paper-style/images/03-cubic-graph-paper.png` | 1086 × 1448 | Approximate visual reference; 8 px estimated uncertainty |
| `real--04-piecewise-curved-section` | `../experiment-01/inputs/real--04-piecewise-curved-section.png` | 314 × 401 | Approximate visual reference; 4 px estimated uncertainty |
| `real--05-sparse-points-shadow` | `../experiment-01/inputs/real--05-sparse-points-shadow.png` | 726 × 567 | Unverified quantitative reference; required qualitative review |

[`evaluation-policy.json`](evaluation-policy.json) is evaluator-only. It pins the
existing catalog and annotation file hashes using relative paths. The evaluator
joins by case ID, checks image identity, and loads images through the manifest.
The old catalog's absolute `/course/...` image paths are ignored. Changed reference
hashes stop evaluation rather than silently accepting a new reference.

## Input isolation

Inference imports no evaluator or reference loader. Its inputs are generic
instructions, the JSON output schema, native dimensions, and a metadata-free PNG
copy of the decoded source pixels. The copy preserves RGB pixels and dimensions;
no crop, EXIF rotation, resizing, or rectification occurs. Case IDs, filenames,
hashes, collection labels, diagnostic expectations, annotations, generator prompts,
teacher answers, ideal functions, and reference overlays stay out of requests.
Writing already visible in the source raster remains visible. The model is told
to preserve ink when that writing conflicts with it.

The policy and reference files are loaded only by `evaluate.py`, after inference.
No reference guides are used to construct mock responses. Tests audit request
contents and inference reads, reject extra manifest reference fields, verify all
six image hashes, and exercise a relocated input tree.

## JSON schema 1.1 and explicit corners

[`prediction.schema.json`](prediction.schema.json) uses Draft 2020-12. Schema 1.1
supersedes the unused Step 2 draft; prompt
[`transcribe-v1.1.txt`](prompts/transcribe-v1.1.txt) is the default. The old v1 prompt
is retained as draft history and is not selected automatically.

| Field | Meaning |
| --- | --- |
| `schema_version` | Fixed `"1.1"` |
| `coordinate_frame` | Fixed `"original_image_pixels_top_left_xy"` |
| `image` | Exact native width/height |
| `axes` | Nullable origin, visible axis lines/labels, tick text/value/position/confidence |
| `calibration` | Affine status, nullable signed unit vectors, uncertainty, visible evidence |
| `branches` | Independent traversal-ordered stroke vertices, indexed endpoints, confidence |
| `isolated_points` | Standalone pixel/graph/uncertainty point objects, with no connections |
| `uncertainty` | Confidence, reasons, assistance flag, nullable clarification question |

The coordinate origin `(0,0)` is the upper-left pixel center; x increases rightward
and y downward. Subpixel positions must satisfy `0 <= x <= width-1` and
`0 <= y <= height-1`. Real-case positions refer to the exact existing response
crop, not to its uncropped source photograph. Evaluation's 900-pixel normalization
is separate from output coordinates.

A stroke vertex has `pixel`, nullable `graph`, nullable `uncertainty_px`, and an
explicit `vertex_kind` of `sample` or `corner`. A corner is a single vertex marked
`corner`; duplicate consecutive samples are invalid. Features no longer repeat
coordinates. Each endpoint has a zero-based `point_index` referencing that
branch's first or last vertex and a kind: `open`, `closed`, `arrow`, `clipped`, or
`uncertain`. Here `closed` means a filled endpoint. Closed loops have no endpoints.

Only consecutive samples within one branch are connected. Isolated points and
separate branches are never joined. `geometry.stroke_plan()` exports pieces split
at every explicit corner, plus the original corner indices and endpoint references.
Overlays draw polylines and mark corner vertices. **The plan is not native
PrairieLearn state.** A future native adapter must retain the breakpoint or use a
non-smooth native anchor; feeding every sample through one smooth spline would
violate this contract. No native import or production integration is implemented.

## Semantic validation and affine limitation

`common.validate_prediction()` rejects:

- NaN/infinity/unrepresentable numbers, duplicate JSON keys, wrong dimensions,
  and pixel locations outside the exact native bounds.
- Duplicate branch IDs, repeated consecutive samples, invalid endpoint indices,
  duplicate endpoint references, endpoints on internal samples, and endpoints on
  closed strokes. Corner intent belongs directly to its stroke vertex.
- Invisible or degenerate reported axis lines, zero unit vectors, singular bases,
  and bases with condition number greater than `1e6`.
- Reliable calibration without an origin, both visible axes, and a nonzero numeric
  tick per axis. Origin/unit-vector alignment and numeric ticks must agree with
  the reported affine frame within one native pixel.
- Reported pixel/graph coordinate pairs differing by more than one native pixel
  under that frame. This fixed consistency tolerance is not increased by a model's
  claimed uncertainty; it checks internal consistency, not recognition accuracy.
- Graph coordinates under uncertain/unavailable calibration, missing assistance
  for uncertain calibration or point-only incomplete input, missing assistance
  reasons, and clarification questions without an assistance flag.

Calibration is **affine only**:
`pixel = origin_px + graph.x*x_unit_vector_px + graph.y*y_unit_vector_px`.
It supports one global linear Cartesian frame including skew. It cannot correct
projective perspective or represent nonlinear/irregular scales. Those photographs
can remain evaluable in pixels while graph coordinates stay null. No homography
or image rectification is implemented. Missing one scale is explicitly uncertain;
no usable numeric calibration is unavailable with both unit vectors null. Schema
and semantic validity cannot establish that a transcription matches visible ink.

## Inference execution after approval

Do not execute live inference at this review checkpoint. After explicit approval,
provide the model name and an environment credential through your shell or secret
manager. Never put the credential value in CLI arguments, files, or browser code.
The default credential variable is `VLM_API_KEY`; `--api-key-env OPENAI_API_KEY`
selects an existing alternative variable by name.

```bash
export VLM_MODEL='your-vision-model'
export VLM_BASE_URL='https://api.openai.com/v1'
# VLM_API_KEY must already be present in the environment.
python -B benchmarks/photo-graphs/vlm-evaluation/run_vlm_eval.py --execute --run-id parabola-001 --case controlled--02-parabola--clean
python -B benchmarks/photo-graphs/vlm-evaluation/evaluate.py --run-id parabola-001
```

The initial transport follows the official
[Chat Completions request format](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create).
The output contract is provider-independent; native provider protocols require
adapters. Configure `--base-url`, `--model`, `--response-format` (`json_object`,
`json_schema`, or `none`), `--token-limit-field` (`max_completion_tokens` or
`max_tokens`), `--max-output-tokens`, `--temperature`, `--image-detail`, and
`--timeout`. Defaults omit temperature and use high-detail images, an 8000-token
completion limit, and a 180-second timeout. Model-specific limits remain to be
verified before a live run. Local endpoints can use `--allow-unauthenticated`.

Use repeated `--case CASE_ID` to select a subset, `--manifest` for an image-only
manifest, or `--output-root` to keep outputs elsewhere. There is one request per
case, with no automatic retry, code-fence removal, coercion, or geometry repair.
Non-stop completions, refusals, malformed JSON, HTTP errors, timeouts, and validation
errors are retained as failures. A later retry needs a new run ID.

Artifacts are saved under `predictions/<run-id>/`: raw response text, validated
prediction JSON, per-case records, and `run.json`. Records include input/transmitted
image hashes, request hash, returned model/ID, usage when supplied, request latency,
HTTP status, response/prediction hashes, and errors. Run metadata snapshots the
prompt, schema, versions, model settings, source commit, and inference code hashes.
Echoed credentials are redacted from saved response/error content and flagged.
Raw responses otherwise remain unchanged. Network failures without a response
have an error record instead of an invented response. Runs are never overwritten.
Local runtime subdirectories and `.env` files are ignored by Git.

## Offline evaluation and qualitative review

The evaluator revalidates saved predictions, image identities, and prediction
hashes, then adapts branch-aware point-to-segment utilities from
`experiment-01/analyze_results.py` and `prepare_cases.py`. It never invokes those
scripts' main functions. A unit test checks numerical equivalence on fixture
geometry. Reports record the source utility and evaluator hashes.

Mock runs are rejected by default. `--allow-mock` enables offline diagnostics only:
their summary's real `groups` remain empty, metrics appear under `mock_groups`,
`real_recognition_cases` is zero, and every results row has
`is_real_recognition=false`. Existing mock labels/watermarks remain in place. A
source label is provenance recorded by the runner, not cryptographic attestation
against deliberate edits to local artifacts.

Each run produces `reports/<report-id>/results.csv`, `summary.json`, `REPORT.md`,
`qualitative-review.csv`, and `stroke-plans.json`, plus original/reference/prediction
triptychs in `overlays/<report-id>/`. Invalid/missing output remains visible as an
error or unscored row, with no synthetic prediction added. Report directories are
not overwritten; use a new `--report-id` to preserve completed manual reviews.

Quantitative fields include branch count, reference coverage within 10 pixels at
a 900-pixel longest edge, forward/reverse p95 distance, bidirectional p95 in both
normalized/native pixels, and controlled-fixture origin/unit-vector/calibration
errors. A geometry flag requires p95 <= 10 normalized pixels and coverage >= 90%.
These are inherited engineering diagnostics, not validated grading tolerances.
Branch-count agreement alone is not proof of topology. Known controlled corner
locations also permit recall of explicitly marked corner vertices.

Controlled references use actual wobbled centerlines, never ideal equations.
Paper-style imagery is AI-generated, not a real student photograph. Paper/real
references remain approximate single-agent annotations; report their uncertainty
and exploratory metrics by collection. Numeric-axis accuracy is enabled only for
controlled cases. Tick-text and isolated-point accuracy lack independent labels.

Sparse-point real-05 is always included in **qualitative evaluation**. Its
quantitative curve, branch-count, axis, and isolated-point scores stay null and it
is excluded from accuracy denominators while reference verification is pending.
The legacy empty branch list and old joining guide are not point annotations.
Its review row records observed isolated-point count, branch count, point-only
output, connecting curves proposed, assistance, uncertainty reasons, and a concrete
clarification request when supplied. Reviewer judgments `isolated_points_preserved`
and `invented_connecting_curves` start as `unverified`; a proposed curve is flagged
for inspection, not automatically declared an invention. Fill those judgments and
notes after comparing the original image and overlay. `drawing_errors_preserved`
also requires photo review. Empty arrays and self-reported confidence do not prove
absence, correctness, or calibrated uncertainty.
