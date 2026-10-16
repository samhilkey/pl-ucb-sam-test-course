# Real graph photo candidates from DrawEduMath

Six unmodified student-work images for initial manual screening of the STAR photo workflow.

Source: [DrawEduMath dataset](https://huggingface.co/datasets/allenai/DrawEduMath), by Sami Baral, Li Lucy, Ryan Knight, Alice Ng, Luca Soldaini, Neil Heffernan, and Kyle Lo. [Paper](https://aclanthology.org/2025.naacl-long.352/).

Dataset license: [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/), as stated in the dataset card. The project's Python code license is separate from its image dataset license.

Each image includes the printed problem on the left and student work on the right. Use the student response as the input of interest. Originals have not been cropped, retouched, or relabeled.

The additional `06-piecewise-graph-paper copy.jpeg` is a local cropped version of the sixth drawing, retained separately from the six source images. Its exact crop bounds were not recorded. It is listed under `local_variants` in the manifest and was excluded from the baseline experiment; that experiment creates its own recorded response crops from the originals.

The filenames describe candidate test purposes. Review each drawing before interpreting its mathematics. There are no verified pixel traces, calibrated graph coordinates, or final expected recognition outcomes yet; these are source candidates, not a finished benchmark. Source URLs, original filenames, problem IDs, and checksums are in manifest.json.

For regression testing, keep programmatically generated cases in a separate synthetic directory and keep real source images separate. Split development and held-out cases by original drawing/problem, not by crop or simulated camera variant.

All six originals were visually screened. They include multiple lines, conflicting written labels, a line that stops short of the origin, a curved section, sparse points under shadow, and a segmented graph with a sharp peak. [Experiment 01](../../experiment-01/REPORT.md) evaluates pixel-exact student-response crops through the live STAR workflow with approximate visual annotations and supplied/normalized axes. The selection is dominated by lines and piecewise graphs; it does not provide a complete parabola/cubic/asymptote benchmark.
