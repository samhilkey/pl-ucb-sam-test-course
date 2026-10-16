# Step 1: baseline experiment

This experiment measures the current STAR photo-to-canvas implementation without changing production question or element source files.

## Scope and sampling

- Run 24 controlled programmatic plot fixtures (six original drawings with four camera variants), three AI-generated paper-style images, and six real DrawEduMath student images.
- These are 33 images from 15 original drawings, not 33 independent drawings. The real samples contain only four distinct problem IDs. Exclude the user's additional cropped copy of the sixth real image.
- The initial supported scope under consideration is one continuous Cartesian function with visible axes and guided calibration/tracing. Separate branches, multiple curves, missing numerical labels, and sparse-point-only input are diagnostic challenge cases.
- No model training or parameter tuning is performed. This is a development baseline, not a held-out generalization claim or a student usability study.

## Operator and references

The operator is an automated browser replay driven by known fixture geometry or visually annotated photo traces. The rough guide is perturbed by up to a few pixels. This approximates consistent, careful assisted input and does not measure ordinary students' tracing ability or completion time.

Controlled fixtures have known stroke centerlines and projective transforms. Paper-style and real-image traces are single-agent visual annotations with approximate pixel precision; they are not independently validated expert ground truth. Intended generation equations and teacher answers are never substituted for the actual photographed ink.

Real source images combine a problem and student response. Pixel-exact crops select the student response and leave original images untouched. Crop bounds and checksums are recorded. Images with absent or incompatible numerical scales use an explicitly normalized analysis frame so they fit the existing question window. Results for those cases describe photographic shape fidelity, not numeric-label understanding.

## Execution

Flow: `star-photo-test` -> camera -> load image -> place three axis markers -> trace each guide branch -> read trace -> capture fitted model -> confirm -> capture native canvas state and SVG geometry.

Use the original functions and SketchResponse library. Capture the fit input and output by wrapping the public `StarFit.fit` call, without changing its behavior. Browser plugin is not available in this session; use the Playwright CLI skill and a named browser session.

Capture the unmodified desktop and mobile layouts separately. For the batch's geometry measurements, expand the existing photo panel's layout in the browser so the entire image can be traced. This test-only layout change affects visibility, not recognition or canvas conversion. Geometry runs therefore do not establish that the original interaction layout is usable.

## Measurements and diagnostic thresholds

- Input: load success, annotation status, provided axes, reference/guide branch counts.
- Calibration: known-fixture error of the three-marker affine frame relative to the original graph coordinates; unavailable as an independent accuracy measure for manually annotated images.
- Recognition: reported ink-hit fraction, supplied trace points, fitted family/equation, fit residual, domain coverage, reference-to-model and model-to-reference photographic distances.
- Rendering: resulting curve count, control points, rendered SVG samples, and distance from the fitted model to the rendered curve.
- Timing: browser image load, extraction and fitting compute time, and transfer compute time. Automated mouse motion and screenshot overhead are excluded from recognition timing.
- Branch/topology check: output curve count must match the expected number of curve branches. Sparse-point-only input should request more evidence or reject fitting.
- Diagnostic photo-fidelity flag: 95th-percentile bidirectional centerline distance no greater than 10 pixels after normalizing the image's longest edge to 900 pixels, with at least 90% reference coverage within that distance.
- Diagnostic rendering flag: 95th-percentile bidirectional distance to the fitted model no greater than 3 SVG canvas pixels. Endpoints and interpolated curve samples are checked separately.

The final transcription flag also applies the same photo-fidelity threshold directly to the painted native SVG curve projected back into the photo frame. This prevents a good mathematical fit from masking a poor canvas conversion. Sparse-point-only input has no continuous reference curve and is excluded from that denominator.

The first 18 cases initially captured SVG paths before the browser painted them. Their original saved canvas states were replayed through the same renderer after paint, without refitting; those raw records explicitly identify recaptured paths. Later cases wait for a nonempty path before capture. The two grading examples were rerun through the full photo flow immediately before submission; their final raw records are the last runs.

Thresholds are engineering diagnostics chosen before running the batch. They are not validated grading tolerances. Keep results by collection and report failures and uncertainty, not one undifferentiated accuracy score.

## Additional probes

Check empty-trace handling, stale fits after replacing an image or clearing a trace, confirmation/transfer, and native grading for the clean and deliberately shifted parabola. The question's second control canvas is filled independently for grading probes so its blank-answer error does not obscure the tested answer. Other graphs are not assessed with the question's fixed `x^2` grader.

## Deliverables

Source/environment provenance, input catalog, visual annotations, per-case raw results, results CSV, screenshot evidence, and a written summary with a supported-scope recommendation and ordered fix list.
