# Photo geometry contract v1

Browser: `window.StarGeometry.validate(geometry)`. Node:
`require('./elements/pl-sketch/star-geometry.js').validate(geometry)`.
The validator returns the input when valid and throws on invalid geometry.
It has no recognizer, renderer, question, or grading dependency.

## Coordinates and evidence

- `schema_version`: `1`; `input_revision`: nonnegative safe integer supplied by
  the caller. Consumers must compare it to the current image/calibration revision.
- `image.width/height`: source-image dimensions. Every exported `pixel` and
  field ending in `_pixel` uses this source frame, with pixel centers at integer
  coordinates, x right and y down. Bounds are `[0,width) × [0,height)`.
- `image.processing`: processing dimensions and six Canvas-style affine
  coefficients `[a,b,c,d,e,f]` mapping source to processing coordinates. For
  resize: `x'=(x+0.5)*processingWidth/sourceWidth-0.5`, likewise for y.
- `coordinate_frame`: unique detected axis intersection or `null`, axis candidate
  lines and support fractions, grid candidates/spacing or `null`. Candidate
  support is a projection fraction, not a probability.
- `calibration.axes.x/y`: `status` (`known`/`unknown`), `source`
  (`photo_detected`, `question_configuration`, `student_corrected`, `unknown`),
  numeric label evidence with pixel anchors/bounds/match error, and known numeric
  intersection values. The current CV recognizer also exports `units_per_grid`.
  This is optional in the contract so other recognizers can calibrate without
  detecting graph paper.
- `calibration.status`: `calibrated` only when both axis scales and the frame
  are known. `origin_graph` is the numeric value at the photographed axes'
  intersection; it is not automatically `(0,0)`. `x_unit_vector_pixel` and
  `y_unit_vector_pixel` specify one mathematical unit each. Invert this basis to
  derive graph coordinates. An uncertain calibration has all three transform
  fields `null`; no partial coordinates are fabricated.

## Stroke structure

`strokes[]` contains unique `id`, `component_id`, `kind: "polyline"`, `closed`,
`simplification_tolerance_pixel`, and ordered `vertices`. Each vertex has:

```json
{"pixel": [112, 100], "graph": [-3.95, 5], "endpoint": true, "corner": false}
```

That vertex is an actual example from the controlled V output. These are image
geometry vertices, not native spline anchors or Bézier controls. Do not feed
them directly to an arbitrary native plugin. Preserve ordering, separate stroke
objects, visible extent, and uncertainty. Graph coordinates are derived from
the explicit calibration or are `null`.

`topology` gives component/stroke counts, components with member stroke IDs, and
junctions with shared endpoint pixels and incident stroke IDs. No synthetic
segment connects separate paths. Loops repeat their first pixel at the final
vertex and have no endpoint flags. An endpoint flag describes a terminal
skeleton node; a junction endpoint is not a terminal endpoint.

## Status and assistance

- `automatic`: at least one stroke, justified full calibration, no warnings,
  junctions, or assistance requests within the recognizer's supported assumptions.
- `needs_review`: useful pixel geometry exists, but there are explicit unresolved
  axes, scales, topology, clipping, or interpretation issues. Valid JSON with this
  status is not a successfully recognized or approved graph.
- `abstained`: no supported stroke was proposed; `strokes` and components are empty.

`warnings[]` has `code` and readable `message`; `assistance[]` has a target and
reason. `uncertainty` contains assumptions, localized regions, and explicit
`confidence_kind: "heuristic_not_probability"`. Current CV debug masks and raw
processing paths are returned separately in `recognize(...).debug`; they are
not required by this algorithm-independent geometry contract.

Validation checks internal consistency, bounds, finite coordinates, evidence,
calibration, membership/connectivity, and topology. It cannot prove the geometry
matches the photograph. That requires independent image-space evaluation and
student review. Native import, object preservation, confirmation invalidation,
and submission validation remain separate integration responsibilities.
