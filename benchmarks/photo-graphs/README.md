# STAR graph image collections

The [completed Step 1 baseline experiment](experiment-01/REPORT.md) runs all 33 images through the live photo-to-canvas flow. Open its [visual gallery](experiment-01/gallery.html) to inspect every result, or [CSV](experiment-01/results/results.csv) for the measurements. These are assisted-input development diagnostics, not general recognition accuracy.

| Collection | What it contains | Reference status |
| --- | --- | --- |
| [Paper-style synthetic photographs](paper-style/README.md) | Three AI-generated images resembling photographed pencil sketches on plain, lined, and graph paper | Approximate visual annotations in experiment 01 |
| [Real student images](real/drawedumath/README.md) | Six unmodified source examples from DrawEduMath | Response crops and approximate annotations in experiment 01; sparse-point case has no continuous reference |
| [Programmatic plot fixtures](synthetic/README.md) | Twenty-four code-drawn plots with controlled camera effects | Known centerlines, features, and projective transforms |

Use the paper-style collection for the requested appearance of paper homework. Use the programmatic plots for controlled geometry checks. Keep real student photos for evaluating whether improvements transfer to actual handwriting and camera conditions.
