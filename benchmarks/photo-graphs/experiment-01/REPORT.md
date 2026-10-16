# STAR photo baseline: experiment 01

Completed October 15, 2026, Pacific time. The application was tested through the running PrairieLearn question at `localhost:3000`, including photo upload, axis calibration, mouse tracing, fitting, confirmation, native SVG rendering, and two grading submissions. Application source was left unchanged.

**The current pipeline works well on carefully guided, simple controlled drawings. It loses separate branches, can misfit real piecewise drawings, and permits confirmation of a stale fit. The native canvas generally reproduces the model it receives faithfully; several failures occur before that transfer.**

Open the [visual gallery](gallery.html), [all measurements](results/results.csv), [machine-readable summary](results/summary.json), or [protocol](PROTOCOL.md). The gallery shows the traced photo, reference/model comparison, and actual canvas for every case.

## What was run

| Collection | Images / original drawings | Completed upload-to-canvas | Passed transcription diagnostic |
| --- | --- | --- | --- |
| Controlled code-generated fixtures | 24 / 6 | 24/24 | 20/24 |
| AI-generated paper-style photographs | 3 / 3 | 3/3 | 2/3 |
| Real student photographs | 6 / 6 | 6/6 | 1/5 annotated continuous-curve cases |

The sixth real photograph contains sparse points. It is an ambiguity probe without a continuous reference curve, so it is excluded from the fidelity denominator. All 33 images completed the interaction pipeline; that does not mean 33 drawings were faithfully transcribed.

The diagnostic requires preservation of branch count, at least 90% reference coverage within 10 pixels, and bidirectional 95th-percentile distance at most 10 pixels. Distances are measured after normalizing the photo's longest edge to 900 pixels. The test applies these conditions to both the fitted model and the actual native canvas projected back into the photo frame. These are development thresholds, not established grading tolerances.

Inputs were reference-guided rough traces with a fixed, reproducible perturbation of up to three internal photo pixels. Known or visually supplied axis positions were used. The batch expanded the photo panel in browser CSS to expose the entire image; separate layout probes used the original UI. This is a careful assisted-input baseline, not a measurement of typical student recognition accuracy, completion time, or learning.

## Findings and evidence

### 1. Separate branches are silently lost

All four reciprocal variants lost one of their two branches. Only approximately 50% of the reference centerline remained covered, despite a **100% ink-hit message**. Both branches had been traced. The same issue affected the two real photographs containing multiple lines.

The immediate cause is visible in [star-photo.js](../../../elements/pl-sketch/star-photo.js): the read handler sends only `result.curves[0].points` to the fitter. [star-fit.js](../../../elements/pl-sketch/star-fit.js) also replaces the selected tool's state with a single spline. The interface explicitly permits one stroke per branch, so its promise exceeds the current data path.

Evidence: [reciprocal traced photo](results/evidence/controlled--06-reciprocal--clean--photo.png), [one-branch canvas](results/evidence/controlled--06-reciprocal--clean--canvas.png), and [raw observation](results/raw/controlled--06-reciprocal--clean.json).

### 2. Editing does not invalidate the old fit

After fitting the sixth real image, both of these actions still allowed the previous curve to be confirmed:

1. Clear the trace, then confirm without rereading.
2. Replace the photo with a line image, then confirm without tracing or fitting.

For each probe the native canvas was emptied before confirmation. Confirmation restored the same 17 control-point coordinates as the previous fit. The renderer's extra empty editing spline was excluded from that comparison.

An empty trace correctly produced “No usable trace,” but the old equation and confirmation button remained available. `currentModel` and the fit display are not reset by these editing actions.

Evidence: [replacement-photo screenshot](results/evidence/probe-replaced-photo-stale-fit.png), [empty-trace screenshot](results/evidence/probe-empty-trace-stale-fit.png), and [probe data](results/raw/probe-stale-fit.json).

### 3. A plausible equation can represent only a small part of the drawing

| Image | Canvas/photo p95 distance | Reference coverage within 10 px | Result |
| --- | ---: | ---: | --- |
| Paper parabola | 5.0 px | 100% | Pass |
| Paper V shape | 5.5 px | 100% | Pass |
| Paper cubic-like curve | 12.1 px | 88.7% | Fail; threshold-sensitive near-miss |
| Real multiple lines | 161.3 px | 53.7% | Fail; missing line |
| Real conflicting labels/two lines | 269.0 px | 44.4% | Fail; missing line |
| Real line missing origin | 1.9 px | 100% | Pass; shape only |
| Real curved piecewise graph | 297.9 px | 21.1% | Fail; much of curve omitted |
| Real sharp piecewise peak | 21.7 px | 68.5% | Fail; rounded peak and oscillation |

The curved piecewise image selected a tangent model. Only 553 of 801 uniformly sampled x positions produced finite model values; its output became an almost horizontal segment over the latter part of the graph. The reported fit residual was only 0.123 graph units. The fitter permits candidates that cover as little as 45% of supplied trace points, and computes residuals over finite predictions. Its small residual therefore conceals missing regions.

The sharp peak selected a fifth-degree polynomial, rounding the peak and adding an unwanted dip near the beginning. These examples motivate coverage checks and piecewise representations before more complicated model selection.

Evidence: [curved graph gallery entry](gallery.html#real--04-piecewise-curved-section), [peak comparison](results/overlays/real--06-piecewise-graph-paper.jpg), [paper cubic comparison](results/overlays/paper--03-cubic-graph-paper.jpg). The cubic's small threshold failure should be interpreted cautiously because its reference is approximate.

The sparse-points photograph also produced a confirmable cubic after the operator supplied a connecting guide. This demonstrates an unresolved task definition: should isolated points imply a curve, a point set, or a request for clarification? It is not evidence that the system accepted a known incorrect student curve.

### 4. Canvas transfer is mostly accurate, with local corner smoothing

All 33 rendered outputs met the separate **3 SVG pixel p95** comparison against the fitted model's finite sampled geometry. This result does not establish transcription accuracy: a missing branch or an already truncated model can still transfer accurately.

Absolute-value fixtures had local maximum rendering deviations of approximately 3.1–3.3 SVG pixels, despite passing the p95 threshold. The smooth spline rounds a sharp corner. Preserving corners requires explicit breakpoints or a piecewise/polyline representation, rather than relying exclusively on a global percentile threshold.

The first 18 cases' paths were initially sampled before paint. Their original saved states were replayed through the unchanged renderer after paint; those records identify the recapture. Later cases wait for an actual nonempty SVG path. No model was refitted for that recapture.

### 5. The original panel makes the photo hard to reach

For the portrait paper photo, the initial visible portion of the photo inside the original panel was:

- Desktop, 1440 × 1000 viewport: approximately **38.7%**.
- Mobile, 390 × 844 viewport: **0%** until the panel is scrolled.

This is an initial visibility measurement, not a claim that scrolling cannot reveal the rest. The photo canvas had no keyboard focus target for calibration. The automated geometry runs needed the documented panel expansion, so their completion is not evidence that the original layout is easy to use.

Evidence: [desktop screenshot](results/evidence/ui-desktop-photo.png), [mobile screenshot](results/evidence/ui-mobile-photo.png), [measured bounds](results/raw/probe-layout.json).

### 6. Three-marker calibration cannot fully undo perspective

With exact fixture markers, the affine calibration's p95 coordinate error on perspective variants ranged from **0.062 to 0.138 graph units**. Clean/shadow/blur fixtures have essentially zero calibration error with those ideal markers. A good visual overlay can coexist with inaccurate numerical graph coordinates because the overlay is evaluated in the same affine frame.

This experiment supplies the marker values. It does not test OCR, inference of tick labels, or students' ability to calibrate accurately. Real photos with missing or incompatible numerical scales used explicitly normalized frames; passing them does not establish correct numerical transcription.

### 7. The grader preserved the deliberate mathematical mistake

The two clean parabola examples were rerun through the full photo flow immediately before submission. The separate control canvas was filled with an independent `x^2` curve so its blank-answer check would not obscure the photo answer.

| Photo input | Photo-answer grade | Control grade | Whole-question grade |
| --- | ---: | ---: | ---: |
| Approximately `x^2` | 100% | 100% | 100% |
| Deliberately shifted `x^2 + 1` | 0% | 100% | 50% |

The shifted vertex was preserved and rejected by the grader. This is the desired separation: transcription reproduces the student's work, while grading evaluates it afterward. It is two sanity checks, not a full validation of grading tolerances or all error types.

Evidence: [clean grading](results/evidence/probe-grade-clean.png), [shifted grading](results/evidence/probe-grade-shifted.png), and [submission observations](results/raw/probe-grade-shifted.json).

### 8. Local compute latency is not the main measured bottleneck

| Operation | Median | p95 |
| --- | ---: | ---: |
| Image load wall time | 29.0 ms | 33.4 ms |
| Ink extraction | 23.9 ms | 33.7 ms |
| Curve fitting | 23.9 ms | 33.0 ms |
| Extraction + fitting | 47.8 ms | 58.0 ms |
| Transfer call | 1.2 ms | 1.3 ms |

These are local browser compute timings. They exclude drawing time, human decisions, screenshot overhead, and native rendering completion. They say nothing about a future remote LLM's latency. There were no captured application console errors in the 33 case runs; packaged font decoding warnings occurred separately.

The tested photo flow contains **no LLM request**. It uses guided dark-ink extraction and a local mathematical fitter. Improving or replacing an LLM cannot by itself fix the observed failures in this implementation.

## Ordered plan after this baseline

| Priority | Next change | Completion evidence |
| --- | --- | --- |
| P0 / first | Invalidate fit, equation, and confirmation whenever photo, axes, units, strokes, or fit inputs change. Disable confirmation until a fresh fit succeeds. | Both stale-fit probes must stop restoring the old curve; empty-trace errors leave confirmation disabled. |
| P0 / second | Preserve all traced branches through extraction, fitting, and canvas state. Until supported, reject additional branches with a clear message. | All four reciprocal variants and both real multi-line cases retain their intended branch counts, or explicitly refuse unsupported input; no silent loss. |
| P1 / third | Add coverage and uncertainty checks. Penalize excluded domains/points and unsupported gaps; show the overlay of the proposed reconstruction on the photo before confirmation. | The tangent partial-curve failure and ambiguous sparse-point case cannot be silently presented as reliable transcriptions. |
| P1 / fourth | Make the capture panel usable at desktop and mobile sizes: clear progress, photo zoom/pan, controls that remain reachable, and explicit origin/x/y value confirmation. | Repeat the original viewport probes and complete the actual calibration/tracing flow at both sizes without the test CSS expansion. |
| P1 / fifth | Preserve a traced polyline as the baseline representation; fit separate segments and retain corners. Make smooth mathematical simplification an explicit option. | Improve the real curved/peak cases while preserving their extrema, branches, and endpoints; no new failures on controlled cases. |
| P2 / sixth | Add optional student-labeled critical coordinates and perspective correction. Keep student transcription labels separate from the instructor solution. | Check coordinate errors on known transforms and deliberately wrong student labels; labels must not repair a wrong graph toward the answer. |
| P2 / seventh | Expand and independently annotate real data; keep variants of a drawing/problem together when splitting evaluation data. Then compare an automatic vision/LLM proposal against the same references. | Report results on new held-out real drawings, per family and image condition, including refusal/correction rates and latency. |
| P2 / eighth | Conduct a student pilot comparing guided tracing with automatic proposals plus confirmation. | Measure completion time, assistance needed, correction burden, and whether transcription changes the student's intended mathematics. Learning effects require a study. |

For an initial demo, restrict the supported task to one continuous Cartesian curve with legible axes and guided calibration. Keep guided tracing as a fallback. Optional critical-point labels are a reasonable interaction to prototype, but their educational benefit remains unmeasured.

## Limits and reproducibility

- There are 15 original drawings, including only six real student images from four problem IDs. This is a convenience sample, not a general accuracy estimate. The additional local cropped copy of the sixth real image was excluded and preserved.
- Programmatic fixtures have exact generated centerlines. Paper and real-photo references are single-agent visual annotations with approximately 4–8 original-image pixel uncertainty. Their generation prompts or instructor equations are not used as ground truth.
- Guides are derived from those references, so the experiment measures performance with careful assisted input. Some failures may still depend on the chosen guide and image crop.
- Real-image scaling was supplied/normalized, and the student-response portions were cropped from source composites. See [crop provenance](crop-provenance.json) and [source/license information](../real/drawedumath/README.md). There was no camera-device capture, OCR evaluation, or participant study.
- Environment: Chrome 155.0.8059.80, PrairieLearn Docker container `sam-test-course`, Python 3.13.15, NumPy 2.4.6, Pillow 12.3.0. The Docker image ID, source commit, hashes, and unchanged-source check are in [provenance.json](provenance.json).
- [prepare_cases.py](prepare_cases.py) creates the fixed guides; [run_cases.js](run_cases.js) drives the native question; [recapture_paths.js](recapture_paths.js) measures early saved states after paint; [probe_stale_fit.js](probe_stale_fit.js) and [run_grading.js](run_grading.js) document lifecycle and grading checks. The browser layout measurements and screenshots are retained in the raw results.
- Recompute the numerical report with `docker exec sam-test-course python3 /course/benchmarks/photo-graphs/experiment-01/analyze_results.py`. Rebuild the local gallery with `python3 benchmarks/photo-graphs/experiment-01/build_gallery.py`.

At experiment completion, the results were local and uncommitted. No application fixes or pushes were performed during the experiment.
