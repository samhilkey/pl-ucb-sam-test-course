# Synthetic graph photo fixtures

These are programmatic plot fixtures with simulated camera effects. For images that resemble actual pencil homework on paper, see the separate [paper-style synthetic photographs](../paper-style/README.md). The coordinate references here apply only to the programmatic images, not to that new collection.

This set contains **24 code-generated JPEG images**: six drawings with four camera variants each. They simulate paper, pencil strokes, handwritten-style labels, perspective, shadows, blur, and JPEG compression. They are synthetic fixtures, not photographs of human student work.

Open [the contact sheet](contact-sheet.jpg) to browse the set. Images are under `images/`; matching geometric reference JSON files are under `references/`. [manifest.json](manifest.json) lists every image and reference.

| Drawing | Ideal geometry | Main purpose |
| --- | --- | --- |
| `01-line` | `y = 0.5x + 1` | Calibration, slope, intercepts |
| `02-parabola` | `y = x^2` | Current `star-photo-test` target |
| `03-shifted-parabola` | `y = x^2 + 1` | Preserve a deliberate shifted vertex when the instructor expects `x^2` |
| `04-absolute-value` | `y = abs(x) - 1` | Preserve a sharp corner |
| `05-cubic` | `y = x^3 - 3x` | Preserve a maximum and minimum |
| `06-reciprocal` | `y = 2/x` on two intervals | Preserve separate branches and the gap at zero |

Every row has `clean`, `perspective`, `shadow`, and `blur-dim` versions. Variants of a drawing share the same pencil centerline. Keep all variants of one drawing together when dividing development and held-out examples.

## Try the first image

1. Open `star-photo-test` in local PrairieLearn.
2. Use the camera button on the photo-enabled canvas.
3. Choose `images/02-parabola--clean.jpg`.
4. Place O at `(0, 0)`, the x-dot at `(1, 0)`, and the y-dot at `(0, 1)`. Keep both dot-value fields at `1`.
5. Trace the photographed pencil curve, read the trace, and inspect the proposed curve before confirming.
6. Try the other variants of that same graph to isolate camera effects.

The question currently grades against `x^2` only. Its second control canvas is a separate graded answer. An empty control can cause a blank-answer error; recognition evaluation should not use the total question grade as its metric.

For clean and shadow images, the uploaded 1200 x 1200 image is resized by the current STAR implementation to 900 x 900. The marker positions in that internal preview are O `(450, 450)`, X `(525, 450)`, and Y `(450, 375)`. These are internal image coordinates, not browser screen coordinates. Perspective cases require the different positions recorded in their reference JSON files.

## Reference data

Each reference separates:

- The ideal mathematical function from the actual slightly wobbled stroke centerline.
- Each separate branch and its domain.
- Feature coordinates and labels, including the deliberately incorrect shifted vertex.
- Paper pixel coordinates, final image coordinates, and coordinates after STAR's current 900-pixel resize.
- The exact projective image transformation, calibration markers, and simulated camera settings.

These references describe centerlines. They are not pixel segmentation masks: pencil width, label ink, anti-aliasing, blur, and JPEG artifacts occupy pixels around those centerlines. Perspective references use a projective transformation; the current three-marker STAR calibration uses an affine transformation and cannot fully undo it. That discrepancy is intentional test coverage.

The V-shaped graph and separate reciprocal branches are challenge cases. The current fitter may smooth corners or drop the second stroke; the reference should be used to detect that behavior, not to assume it already works.

These fixtures were generated and visually inspected. All 24 were subsequently measured through the live STAR workflow in [experiment 01](../experiment-01/REPORT.md). They do not establish performance on real handwriting.

## Regenerate

From the repository root, using the running PrairieLearn container:

```bash
docker exec sam-test-course python3 /course/benchmarks/photo-graphs/generate_synthetic.py
```

Or use Python with `numpy` and `Pillow` installed:

```bash
python3 benchmarks/photo-graphs/generate_synthetic.py
```

The generator uses a fixed seed. It regenerates its named synthetic outputs and leaves the real-photo directory untouched. Dependency versions are recorded in the manifest; fonts and rendering may vary across environments.
