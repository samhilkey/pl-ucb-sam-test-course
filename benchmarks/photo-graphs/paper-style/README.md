# Synthetic photographs of paper graph sketches

These three images were created with the built-in image-generation tool to resemble phone photographs of pencil drawings on physical paper. They include paper grain, page edges, uneven graphite strokes, handwritten labels, wrinkles, lighting, and perspective. They are AI-generated, not actual student photographs.

| File | Intended subject |
| --- | --- |
| [01-parabola-plain-paper.png](images/01-parabola-plain-paper.png) | A pencil parabola on unruled paper |
| [02-v-shaped-notebook-paper.png](images/02-v-shaped-notebook-paper.png) | A sharp V-shaped graph on torn lined notebook paper |
| [03-cubic-graph-paper.png](images/03-cubic-graph-paper.png) | A cubic-like pencil curve with two turning points on graph paper |

Use these for visual and interaction trials of uploading, calibrating axes, tracing, reviewing, and confirming a paper graph in STAR. The main curve and labels are visible in all three images.

## Geometry and evaluation

The functions in the prompts describe intended subjects; they are **not verified geometric references**. In particular, the cubic-like drawing's zero crossings and labeled feature positions are imperfect. Its actual ink must be annotated instead of assuming that it follows the requested equation.

The coordinate JSON files in `../synthetic/references/` belong to the older programmatic plots. They do not apply to these images. [Experiment 01](../experiment-01/REPORT.md) adds approximate visual trace/axis annotations and measures all three images through the live workflow. Those single-agent annotations still require independent review for stronger accuracy claims.

The existing `star-photo-test` question grades against `x^2`. A different image can be useful for recognition testing even when it is not a correct answer to that question.

The unmodified image-tool outputs were copied into this directory. [manifest.json](manifest.json) records their intended subjects, review notes, dimensions, and checksums. [PROMPTS.md](PROMPTS.md) contains the full prompt set and generation method.
