# Experiment 02: paired branch-preservation comparison

Purpose: determine whether the branch-preservation change retains all traced
branches while preserving previously passing transcriptions. State-regression
success and photographic fidelity are evaluated separately.

## Fixed inputs

Reuse `../experiment-01/catalog.json` byte for byte: 24 controlled images from
six drawings, three generated paper-style photos, and six real student photos.
Keep the same crops, supplied/normalized scales, three axis markers, x/y values,
perturbed tracing guides, image order, and default recognition settings.
The additional cropped local copy of the sixth real image remains excluded.
The sparse-point photograph remains excluded from continuous-curve fidelity.
Input and catalog SHA-256 values are in `provenance.json`.

The reference-guided tracing operator and approximate real/photo annotations
retain the limitations described in `../experiment-01/PROTOCOL.md`.

## Preconditions and source isolation

1. Start from the production branch based on master, without benchmark data.
2. Pass the confirmation-state regression, multi-branch browser regression,
   coordinate/atomic-transfer unit tests, syntax checks, and CI style checks.
3. Commit the production source. Record its exact commit and file hashes.
4. Create a separate worktree from `chore/photo-graph-benchmark`, then merge the
   production fix into that experiment branch. Verify application file hashes
   agree with the build served by the running `sam-test-course` container.
5. Keep experiment-01 immutable. Write every new raw observation, measurement,
   screenshot, diagnostic overlay, gallery, and report under experiment-02.

The current-master negative control uses route overrides for its three original
application scripts. The two-line browser check must fail because only the first
trace reaches the fitter. This control does not modify application files.

## Batch execution

Use Chrome through Playwright CLI. The Browser plugin is unavailable.
Replay the original upload -> three marker placement -> each guide stroke ->
Read my trace -> confirm -> native SVG path capture sequence at 1600 by 2200.
Keep the original batch-only panel expansion to expose the full photograph.
Wait for painted nonempty SVG paths before sampling them.

The recorder wraps the public `StarFit.fit` and `StarFit.placeCurves` calls
without changing their behavior. Record each branch's input points, model,
801-domain-position model samples, canvas state, gradeable data, and actual SVG
geometry. Fit time is the sum of branch-fit calls; extraction time ends at the
first fit; total processing ends after the last fit. Timings exclude operator
motion, screenshot overhead, proposal-overlay drawing, and native rendering completion.

The result collector refuses to overwrite existing case JSON. The driver can
resume by skipping completed case IDs. Unexpected image-case errors stop the
batch for diagnosis. An initial launcher placeholder error occurred before any
image case ran; the launcher now replaces all placeholder occurrences.

## Measurements and comparisons

Use the original point-to-segment distances, resampling, and thresholds:

- Photo/model and photo/canvas bidirectional p95 distance <=10 pixels after
  scaling the longest photo edge to 900 pixels.
- Reference coverage >=90% within 10 normalized photo pixels.
- Output branch count must match the annotated continuous reference.
- Native rendering/model bidirectional p95 distance <=3 SVG pixels.

Extend comparison inputs to a list of separate branches; never join endpoints
between branches. Apply the same analyzer to the original archived observations
into `results/legacy-recomputed`, and compare eight original decision/geometry
metrics for all 33 cases. Archive this compatibility check separately.

Report every case and each collection separately. Compare first-branch inputs
and complete first-branch model records against the original raw results.
Distinguish preserved branches from faithful shape, correct numerical labels,
valid function input, mathematical correctness, and learning effects.

## Native submission probes

Replay the saved full-photo-flow native states for a two-branch reciprocal and
the real overlapping-line example. Fill the independent control canvas with
`x^2`, then actually click Save & Grade. Inspect the encoded form submission to
verify both branches survive serialization. The reciprocal must avoid the
overlap-format error; the overlapping-line case must retain the existing
function-input rejection. These are serialization/validation probes, not new
claims of correctness against the question's fixed `x^2` answer.

## Reproduction

Use a fresh results directory for a new run; this archived experiment is fixed.
The running PrairieLearn course must serve the source commit in provenance.
From the experiment worktree, start the collector:

```bash
python3 benchmarks/photo-graphs/experiment-02/serve_experiment.py
```

In another terminal, with Playwright CLI on PATH (or `PL_PHOTO_TEST_CLI` set):

```bash
node benchmarks/photo-graphs/experiment-02/run_experiment.cjs
```

Run `analyze_results.py` with NumPy and Pillow from the pinned Docker image
recorded in provenance, mounting the experiment worktree as `/course`.
Then run `python3 benchmarks/photo-graphs/experiment-02/build_comparison.py`
on the host with Git available. Inspect the gallery in a real browser and verify
all relative images load before archiving and committing the results.

## Harness notes

The first grading-feedback assertion searched visible body text, while the
overlapping-range error is stored in the Invalid badge's popover attributes.
The corrected probe reads those attributes and passes both expected outcomes.
The earlier observation is retained in `results/grading-feedback-check-attempt.json`;
`results/grading.json` is the final passing check. Both attempts submitted both
branches, and the server rejected the overlapping example in both attempts.

The browser blocks direct file URLs, so gallery QA used a localhost HTTP server.
A missing favicon request was eliminated with an inline icon. The final gallery
QA records 33 entries, four loaded images for each inspected paired example,
and zero console errors. These harness corrections did not change application
source or any of the 33 archived image observations.
