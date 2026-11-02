# Step 2 — deterministic CV extraction

Implemented on `feat/automatic-photo-recognition-cv`, after baseline commit
`e026c4e`. This directory is a **new experiment namespace**; historical
`benchmarks/photo-graphs/experiment-01` and the VLM experiment were not modified.

The four constrained controlled examples pass automatic pixel extraction and
photo-derived scale calibration. **This is not a demonstration of reliable
physical-photo recognition:** the positive fixtures are generated rasters with
printed labels from the supported OCR vocabulary. Neither of the two actual
student-photo crops passes. Native import, editing, Save & Grade, and restoration
remain **untested in this step**.

## Implementation

`elements/pl-sketch/star-recognition.js` accepts RGBA pixels and a small allowlist
of options. It returns `{geometry, debug}`. There is no network request, model,
equation fitting, native state write, or access to a question's grading solution.

1. **Preprocessing:** composite transparency onto white; bilinearly resize to a
   maximum dimension of 900 pixels by default; preserve an explicit pixel-center
   transform. Build grayscale, color contrast, local-mean, neutral-dark, pale
   grid, and foreground masks. A radius-2 disk opening removes thin neutral
   lines by width. Dark saturated ink is retained independently, including over
   grid lines. No row/column subtraction or gap bridging is used.
2. **Axes and grid:** use horizontal/vertical projection support to find long
   neutral-dark axis candidates, requiring a unique pair. Detect regular pale
   grid spacing from projection peaks. The detected origin is the axis
   intersection, not the image center. Upright, approximately straight-on input
   is the current constraint.
3. **Scale:** a small local template reader checks isolated positive single-digit
   labels near grid-aligned axis positions. At least two consistent labels per
   axis establish units and the numeric value at the intersection; it need not
   be zero. Grid spacing alone is never a mathematical unit. Missing evidence
   leaves graph coordinates `null`. An optional, explicit question scale has
   separate `question_configuration` provenance and only supplies missing scale
   evidence; successful photo readings take precedence. This experiment passes
   **no configuration calibration** to recognition.
4. **Stroke extraction:** connected components followed by Zhang–Suen thinning,
   skeleton adjacency, and ordered edge walks. Separate components remain
   separate. Junctions become explicit shared nodes and maximal paths rather
   than guessed branch pairings. Closed loops remain closed. Only terminal
   skeleton spurs of at most 2.5 processing pixels are pruned; small components
   (<45 pixels or <18-pixel extent) are recorded as rejected.
5. **Geometry:** simplify each ordered path with Ramer–Douglas–Peucker at 1.25
   processing pixels. Preserve endpoints, drawing order, backtracking, vertical
   runs, and corners above that tolerance. No x sorting, averaging into a
   function, global smoothing, curve-family selection, or extrapolation occurs.
   Raw paths and masks remain available to inspect simplification and failures.

The thinning conditions were checked against Zhang and Suen's
[original paper](https://teaching.vda.univie.ac.at/ipa/18w/Lab3/Zhan-Suen_algorithm.pdf),
*A Fast Parallel Algorithm for Thinning Digital Patterns*, CACM 27(3), 1984,
[DOI](https://doi.org/10.1145/357994.358023). The implementation is local JavaScript;
no CV/OCR library or backend dependency was added.

## Reuse from the tracing branch

Inspected `feat/photo-trace-shapes` at `29983ef`, including the `ccada8f` geometry
changes. Adapted only its iterative pixel-space simplifier into the independent
`StarGeometry.simplify` utility. The trace model's increasing-x restriction,
photo snapping/smoothing, native corner support anchors, and state-writing
adapter were not copied. Those native encoding ideas remain useful for step 3.
The branch was not merged or cherry-picked, and existing files were preserved.

## Output and validation

[`star-geometry.js`](../../../../elements/pl-sketch/star-geometry.js) defines the
algorithm-independent geometry contract and validates it before returning output.
See the [contract](../../../../docs/automatic-photo-recognition/geometry-v1.md).
The output contains source dimensions and resize metadata; axis candidates and
support; grid positions; per-axis numeric evidence and provenance; ordered
pixel/graph vertices; endpoint/corner flags; components and junctions; warnings;
assistance targets; and uncertainty assumptions. Heuristic evidence is explicitly
**not a calibrated probability**.

Validation rejects nonfinite/out-of-bounds coordinates, singular/inconsistent
calibration, missing photo-label evidence, wrong graph transforms, duplicate
IDs, invalid membership or disconnected components, inconsistent topology
counts, false loop closure, and unjustified `automatic` status. The native
adapter in step 3 must revalidate and honor status/revision/assistance; successful
validation of an uncertain proposal does not authorize importing it.

## Observed extraction results

Every row was generated by running the recognizer on a PNG file. Reference
geometry is read **after** recognition and is used only by the evaluator.

| Case | Axis / grid | Calibration | Extracted paths / expected | p95 reference → geometry (px) | Missing / false connections | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Straight line | Detected / detected | Photo labels | 1 / 1 | 0.64 | 0 / 0 | Automatic |
| Sharp V with extra bends | Detected / detected | Photo labels | 1 / 1 | 0.42 | 0 / 0 | Automatic; vertex error 2.24 px |
| Irregular smooth curve | Detected / detected | Photo labels | 1 / 1 | 0.71 | 0 / 0 | Automatic; no quadratic reconstruction |
| Two disconnected branches | Detected / detected | Photo labels | 2 / 2 | 0.67 | 0 / 0 | Automatic; two components |
| Ambiguous axes | Two vertical candidates / uncertain | Unknown | 5 / 1 | 0.42 | 0 / 0 | Needs review; 4 spurious paths, reverse p95 169.79 px |
| Missing numeric scale | Detected / detected | Unknown | 1 / 1 | 0.59 | 0 / 0 | Needs scale evidence; pixel geometry retained |
| Black ink crossing axes/grid | Detected / detected | Photo labels | 4 / 1 | 0.80 | 0 / 0 | Needs review; connected ink has short axis-induced spurs |
| Touching ink junction | Detected / detected | Photo labels | 3 / ambiguous | 0.48 | 0 / 0 | Needs review; one component with an explicit 3-way junction |
| Real photo: multiple lines | Uncertain / uncertain | Unknown | 0 / 2 | Unavailable | 2 / 0 | Abstained; thin strokes missed |
| Real photo: piecewise peak | Uncertain / uncertain | Unknown | 4 / 1 | 303.69 | 1 / 0 | Failed extraction; mostly border/grid fragments, 3 spurious paths |

Supported controlled cases: **4/4 images from four distinct raster recipes** were
automatic. Controlled challenges: **0/4 images** were automatic. There are seven
distinct controlled drawing recipes overall: the missing-scale image reuses the
line drawing. Real photographs: **0/2 images from two independent original
student drawings** were automatic (one abstention, one failed proposal requiring
review). Do not pool these into a physical-photo success rate or count camera
variants as independent drawings. This is a development set, not held out.

For the four supported controlled cases:

- Correct branch count: 4/4 cases; missing branches: 0/5 expected branches;
  measured false connections: 0/4 cases.
- Reference centerline coverage within 3 px: 100% for every branch.
- Maximum centerline endpoint error: 2 px; V vertex error: 2.24 px.
- Axis intersection error: 0 px; detected x/y spacing: 40 px, consistent with
  the raster references. Both unit scales came from label evidence.

These distances compare sampled reference centerlines and extracted polylines.
They are engineering diagnostics, not grading validity or whole-ink coverage.
Stroke centerline endpoints differ from the outer edge of a thick marker cap.
Missing means <10% reference-centerline coverage within 3 px; partial means
10–90%. False connection means an output path follows at least 10 samples on
each of two reference strokes. The ambiguous-axis example demonstrates why a
small one-direction distance is insufficient: it recovers the intended line
**and adds wrong geometry**. `summary.json` records both distance directions.

The real-photo references are archived approximate Codex visual annotations,
**not independent expert ground truth** (estimated 4 px annotation uncertainty).
Their numerical calibration is not reused; the older normalized analysis frame
is unsuitable evidence of recognized units. DrawEduMath attribution and crop
provenance are in [`source-attribution.json`](source-attribution.json); copied
image bytes retain their original hashes. Dataset images retain CC BY-NC 4.0.

## Tests and browser verification

- **49/49 Node tests passed:** all 13 pre-existing tests plus 36 extraction,
  simplification, resize, loop, calibration, uncertainty, and validation checks.
- **218/218 existing browser assertions passed:** confirmation 71, branches 80,
  desktop/mobile workflow 67. No changes to the legacy runtime, question,
  grading implementation, or dependency registration.
- **23/23 new viewer browser assertions passed:** page identity/content, all 30
  comparison images decode, five cases rerun from browser Canvas pixels with
  exactly matching Node geometry (after revision normalization), JSON download
  visibility, mobile overflow, and zero viewer errors/warnings.
- Browser environment: Playwright CLI 0.1.23, Chrome; desktop 1440×1000 and
  mobile 390×844. Browser plugin not available, so existing CLI tooling was used.
  Existing PrairieLearn font decoding warnings remain; regression listeners
  reported no application errors. The viewer has no font warnings.
- Visually inspected original/overlay/proposal views, a V browser rerun, mobile
  two-branch review, black-axis spurs, and the failed real-photo peak extraction.
- Native import, student corrections, real Save & Grade, and restoration:
  **untested; deferred to later steps**.

The browser flow tested was evidence page → choose a fixture → decode its actual
pixels → run local CV → display overlay and expose validated JSON. It never
calls `SketchResponse` or `StarFit`.

## Reproduce and inspect

From the repository root:

```bash
# Fixtures are committed. Regenerate only the controlled fixtures if desired:
node benchmarks/photo-graphs/automatic-cv/experiment-01/generate-fixtures.cjs
node benchmarks/photo-graphs/automatic-cv/experiment-01/evaluate.cjs
node --test tests/star-fit-branches.cjs tests/star-fit-coverage.cjs tests/star-recognition.test.cjs tests/star-geometry.test.cjs
python3 benchmarks/photo-graphs/automatic-cv/experiment-01/serve.py --port 8765
```

Open **http://127.0.0.1:8765/**. Compare original, overlay, and proposed geometry;
use **Re-run** to execute recognition again from the image, or choose a local
image. The JSON and raw paths can be downloaded/inspected without native import.
The loopback server exposes the experiment and the two required modules only.

```bash
export PL_PHOTO_TEST_CLI=/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh
node tests/star-recognition-browser.cjs
# Requires local PrairieLearn, as in the step-1 audit:
node tests/star-photo-confirmation.cjs
node tests/star-photo-branches.cjs
node tests/star-photo-workflow.cjs
```

Artifacts are under [`results/`](results/): one `*.geometry.json`, raw ordered
`*.paths.json`, `*.overlay.png`, `*.proposal.png`, `*.dark.png`, `*.ink.png`, and
`*.skeleton.png` per case; `summary.json`; Node log; and regression results.
Source images are under [`inputs/`](inputs/); evaluator-only annotations are
under [`references/`](references/). The source hashes in `summary.json` identify
the exact recognizer/validator used. Browser logs and screenshots are retained
locally under `/private/tmp/star-automatic-cv-step-02/`; their hashes are recorded
in the committed regression record.

## Limits and next step

The recognizer currently requires upright axes with long visible spans, pale
regular graph paper, and marker strokes roughly 7+ processing pixels thick
(or dark saturated colored ink). Short, thin, pale, or grid-colored strokes,
dense annotations, handwriting OCR, multi-digit/signed labels, perspective,
rotation, and indistinguishable axis/answer overlap remain unsupported or
uncertain. The local glyph templates make the successful calibration test narrow;
it is not general handwriting recognition.

Landmark correction could repair small endpoint or vertex displacement. It will
not recover the missed real-photo branches by itself. Better segmentation and
axis separation are needed for those cases. A future VLM could potentially help
with labels and scene interpretation, but these results do not establish that
it would preserve geometry better, and no VLM work was performed.

Step 3 can consume the validated geometry through a native adapter. It must
check status/revision, preserve existing objects, and separately test faithful
encoding, editing, grading data, submission, and restoration. The smallest CV
reliability improvement suggested by this experiment is local width/direction
analysis at black-ink/axis intersections, with tests preventing both erased
crossings and invented connections. Review and approval are required before
starting the next step.
