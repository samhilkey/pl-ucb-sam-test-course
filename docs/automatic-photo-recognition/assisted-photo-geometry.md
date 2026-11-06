# Opt-in manual photo geometry

`preserve-photo-geometry="true"` enables reviewed **manual tracing**, not automatic
recognition. It requires `allow-hand-drawn="true"` and an editable, non-helper
`free-draw` tool. The isolated `star-assisted-photo-demo` question uses it; no
existing question or assessment configuration is switched to this mode.

The operator places O, X and Y in the image, enters X/Y reference values, and
traces each visible branch in a separate pointer gesture. O explicitly means
graph coordinate (0,0). The affine calibration comes from these user inputs;
there is no OCR, automatic unit recovery, grid snapping or expected equation.
An unlabeled image needs a declared operator-assigned scale. The image's
actual numeric scale is unknown in that case.

`StarAssisted.fromTrace()` converts ordered processing-pixel pointer strokes to
Photo Geometry v1 in original pixel-center coordinates. It uses the shared RDP
simplifier at **0.75 original pixel** tolerance, retains endpoints, and marks
sharp corners. It does not sort by x, average independent strokes, smooth,
search neighboring ink, fit equations or access the grading answer. Its status
remains `needs_review`, with `provenance.method="manual_trace"` and
`automatically_recognized=false`. This is not an automatic geometry result.

Only the explicitly enabled assisted native session accepts that reviewed
manual provenance with operator-supplied calibration, no unresolved warnings,
junctions or uncertain regions. The UI additionally requires an acknowledgment
that axes, branches, corners and endpoints match the photo. The existing
StarNative freeform adapter encodes straight cubic controls, preserving both
rendered and gradeable vertices. Native edits after preview and changes to the
photo, axes or trace invalidate the proposal. Rejected stale previews are
cleared, and a consumed token cannot be retried without reading/reviewing again.
The automatic session continues to reject ambiguous/manual proposals.

This opted-in mode accepts **separate branches with overlapping x ranges** as
a savable mathematical attempt. For ordinary y-as-function grading, overlapping
strokes receive 0 with feedback explaining the multiple y-values; their geometry
is retained. Existing questions keep their original overlapping-input format
restriction. Other valid submissions continue through the existing grader.

Native Select moves a whole imported branch. To correct one part, delete that
branch and retrace/review it; there is no individual imported-vertex editor.
Closed loops, x-backtracking paths, isolated points, out-of-range geometry,
arrowhead decorations, and open/closed endpoint symbols remain unsupported by
this function-stroke import contract. The importer rejects unsupported path
geometry rather than fitting or clipping it. Arrow-shaft ends can be traced,
but their arrowhead decorations are not separately reconstructed.

Evidence and the two actual-paper acceptance results are in
[Step 4C REPORT](../../benchmarks/photo-graphs/multi-method/step-4c/REPORT.md).
