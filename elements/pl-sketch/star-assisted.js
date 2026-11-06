/* Ordered manual photo traces to the shared geometry contract. No fit or CV. */
;(function (root) {
  'use strict'
  const Geometry = typeof module !== 'undefined' && module.exports ? require('./star-geometry.js') : root.StarGeometry
  function fromTrace ({ width, height, processingWidth, processingHeight, origin, xMarker, yMarker, xValue, yValue, strokes, inputRevision }) {
    const sx = processingWidth / width; const sy = processingHeight / height
    const inside = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] >= 0 && p[1] >= 0 && p[0] < processingWidth && p[1] < processingHeight
    if (![origin, xMarker, yMarker].every(inside) || !Number.isFinite(xValue) || !Number.isFinite(yValue) || !xValue || !yValue) throw new Error('Place all three markers inside the photo and enter nonzero axis values.')
    const toSource = p => [(p[0] + 0.5) / sx - 0.5, (p[1] + 0.5) / sy - 0.5]
    const x = [(xMarker[0] - origin[0]) / sx / xValue, (xMarker[1] - origin[1]) / sy / xValue]
    const y = [(yMarker[0] - origin[0]) / sx / yValue, (yMarker[1] - origin[1]) / sy / yValue]
    const det = x[0] * y[1] - x[1] * y[0]
    if (Math.abs(det) < 1e-6 || Math.abs(det) / (Math.hypot(...x) * Math.hypot(...y)) < 0.05) throw new Error('The axis markers are too close to one straight line. Move them apart.')
    const frame = { status: 'detected', origin_pixel: toSource(origin), axes: {}, grid: {} }
    const calibration = { status: 'calibrated', origin_graph: [0, 0], x_unit_vector_pixel: x, y_unit_vector_pixel: y, axes: {} }
    for (const [axis, marker] of [['x', xMarker], ['y', yMarker]]) {
      frame.axes[axis] = { status: 'detected', candidates: [{ start: toSource(origin), end: toSource(marker), support: 0 }] }
      frame.grid[axis] = { status: 'unknown', lines_pixel: [], spacing_pixel: null }
      calibration.axes[axis] = { status: 'known', source: 'student_corrected', labels: [], intersection_value: 0 }
    }
    if (!Array.isArray(strokes) || !strokes.length) throw new Error('Trace at least one complete branch on the photograph.')
    const paths = strokes.map((raw, index) => {
      if (!Array.isArray(raw) || raw.some(p => !inside(p))) throw new Error('A trace point is outside the photo.')
      const distinct = raw.filter((p, i) => !i || Math.hypot(p[0] - raw[i - 1][0], p[1] - raw[i - 1][1]) > 1e-8).map(toSource)
      if (distinct.length < 3 || Math.hypot(...distinct[0].map((v, j) => v - distinct.at(-1)[j])) < 1) throw new Error('Trace a longer open branch; loops and isolated points need a different input contract.')
      const points = Geometry.simplify(distinct, 0.75)
      const id = 'manual-' + (index + 1)
      return { id, component_id: id, kind: 'polyline', closed: false, simplification_tolerance_pixel: 0.75,
        vertices: points.map((pixel, i) => {
          let corner = false
          if (i > 0 && i < points.length - 1) {
            const a = points[i - 1].map((v, j) => pixel[j] - v); const b = points[i + 1].map((v, j) => v - pixel[j])
            corner = (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b)) < Math.cos(Math.PI / 4)
          }
          return { pixel, graph: Geometry.pixelToGraph(pixel, frame, calibration), endpoint: i === 0 || i === points.length - 1, corner }
        }) }
    })
    return Geometry.validate({ schema_version: 1, input_revision: inputRevision,
      image: { width, height, processing: { width: processingWidth, height: processingHeight, source_to_processing: [sx, 0, 0, sy, (sx - 1) / 2, (sy - 1) / 2] } },
      status: 'needs_review', provenance: { method: 'manual_trace', automatically_recognized: false },
      coordinate_frame: frame, calibration, strokes: paths,
      topology: { stroke_count: paths.length, component_count: paths.length, components: paths.map(s => ({ id: s.id, stroke_ids: [s.id] })), junctions: [] },
      warnings: [], assistance: [], uncertainty: { confidence_kind: 'heuristic_not_probability', regions: [],
        assumptions: ['The operator supplied the numeric origin and axis references.', 'Manually traced pointer geometry; no automatic recognition, snapping, smoothing or equation fitting.', 'Separate pointer strokes remain separate; the operator must check gaps, corners and endpoint positions.'] } })
  }
  const api = { fromTrace }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.StarAssisted = api
})(typeof window !== 'undefined' ? window : globalThis)
