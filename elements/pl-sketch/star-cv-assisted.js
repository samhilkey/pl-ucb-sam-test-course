/* Reviewed CV pixels -> student-calibrated geometry. No fitting or recognition. */
;(function (root) {
  'use strict'
  const Geometry = typeof module !== 'undefined' && module.exports ? require('./star-geometry.js') : root.StarGeometry
  const clone = value => JSON.parse(JSON.stringify(value))
  const pair = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)
  const key = p => p.join(',')
  function calibration (image, values) {
    const inside = p => pair(p) && p[0] >= 0 && p[1] >= 0 && p[0] < image.width && p[1] < image.height
    const { origin, xMarker, yMarker, xValue, yValue, confirmed } = values || {}
    if (!confirmed || ![origin, xMarker, yMarker].every(inside) || !Number.isFinite(xValue) || !Number.isFinite(yValue) || !xValue || !yValue) throw new Error('Place O, X and Y on the photo, enter both nonzero axis values, and confirm the calibration.')
    const x = xMarker.map((v, i) => (v - origin[i]) / xValue); const y = yMarker.map((v, i) => (v - origin[i]) / yValue)
    const det = x[0] * y[1] - x[1] * y[0]
    if (Math.abs(det) < 1e-6 || Math.abs(det) / (Math.hypot(...x) * Math.hypot(...y)) < 0.05) throw new Error('Move the axis markers apart; they cannot lie on one straight line.')
    const frame = { status: 'detected', origin_pixel: origin.slice(), axes: {}, grid: {} }
    const scale = { status: 'calibrated', origin_graph: [0, 0], x_unit_vector_pixel: x, y_unit_vector_pixel: y, axes: {} }
    for (const [axis, marker] of [['x', xMarker], ['y', yMarker]]) {
      frame.axes[axis] = { status: 'detected', candidates: [{ start: origin.slice(), end: marker.slice(), support: 0 }] }
      frame.grid[axis] = { status: 'unknown', spacing_pixel: null, lines_pixel: [] }
      scale.axes[axis] = { status: 'known', source: 'student_corrected', intersection_value: 0, labels: [] }
    }
    return { frame, scale }
  }
  function marks (source) {
    const list = source.uncertainty.rejected_small_components || []
    if (!Array.isArray(list)) throw new Error('Small-mark observations are invalid.')
    return list.map((m, i) => {
      const bounds = m.bounds_pixel
      if (!Array.isArray(bounds) || bounds.length !== 2 || !bounds.every(pair) || bounds[0].some((v, j) => v < 0 || bounds[1][j] < v || bounds[1][j] >= [source.image.width, source.image.height][j])) throw new Error('Small-mark bounds are invalid.')
      const pixel = m.centroid_pixel || bounds[0].map((v, j) => (v + bounds[1][j]) / 2)
      if (!pair(pixel) || pixel.some((v, j) => v < bounds[0][j] || v > bounds[1][j])) throw new Error('Small-mark center is invalid.')
      return { id: 'mark-' + (i + 1), pixel: pixel.slice(), bounds_pixel: clone(bounds), position_source: m.centroid_pixel ? 'cv_component_centroid' : 'cv_component_bounds_center' }
    })
  }
  function branches (source, decisions) {
    if (!decisions || Object.keys(decisions).length !== source.strokes.length || source.strokes.some(s => !['keep', 'exclude'].includes(decisions[s.id]))) throw new Error('Review every detected line: keep it or exclude it.')
    const selected = source.strokes.filter(s => decisions[s.id] === 'keep')
    if (!selected.length) throw new Error('Keep at least one graph line, or use manual tracing.')
    const nodes = new Map(); const add = (p, i) => { const k = key(p); if (!nodes.has(k)) nodes.set(k, []); nodes.get(k).push(i) }
    for (const [i, s] of selected.entries()) {
      if (s.closed) throw new Error('A kept line forms a loop. Exclude it or use manual tracing.')
      const [sx, sy] = [source.image.processing.width / source.image.width, source.image.processing.height / source.image.height]
      if (s.vertices.some(v => v.pixel[0] < 3 / sx || v.pixel[1] < 3 / sy || v.pixel[0] > source.image.width - 1 - 3 / sx || v.pixel[1] > source.image.height - 1 - 3 / sy)) throw new Error('A kept line is clipped at the photo edge. Choose a complete photo or use manual tracing.')
      add(s.vertices[0].pixel, i); add(s.vertices.at(-1).pixel, i)
    }
    if ([...nodes.values()].some(edges => edges.length > 2)) throw new Error('More than two kept lines meet at a crossing. Exclude an axis or fragment, or trace manually.')
    const used = new Set(); const result = []
    while (used.size < selected.length) {
      const first = selected.findIndex((_, i) => !used.has(i)); const pending = [first]; const component = new Set(pending)
      for (let q = 0; q < pending.length; q++) for (const v of [selected[pending[q]].vertices[0], selected[pending[q]].vertices.at(-1)]) for (const i of nodes.get(key(v.pixel))) if (!component.has(i)) { component.add(i); pending.push(i) }
      const ends = [...component].flatMap(i => [selected[i].vertices[0].pixel, selected[i].vertices.at(-1).pixel]).filter(p => nodes.get(key(p)).length === 1)
      if (ends.length !== 2) throw new Error('The kept lines form a loop or unresolved topology. Use manual tracing.')
      let current = key(ends[0]); const vertices = []; const ids = []
      while (true) {
        const i = nodes.get(current).find(i => !used.has(i)); if (i === undefined) break
        used.add(i); const s = selected[i]; ids.push(s.id)
        const vs = key(s.vertices[0].pixel) === current ? s.vertices : s.vertices.slice().reverse()
        if (vertices.length) vertices.at(-1).corner ||= vs[0].corner
        vertices.push(...vs.slice(vertices.length ? 1 : 0).map(v => ({ pixel: v.pixel.slice(), corner: v.corner, endpoint: false })))
        current = key(vs.at(-1).pixel)
      }
      vertices[0].endpoint = vertices.at(-1).endpoint = true
      result.push({ source_stroke_ids: ids, vertices, simplification_tolerance_pixel: Math.max(...ids.map(id => source.strokes.find(s => s.id === id).simplification_tolerance_pixel)) })
    }
    return result
  }
  function fromSelection ({ source, photoSha256, axisValues, strokeDecisions, markDecisions, reviewed, inputRevision }) {
    Geometry.validate(source)
    if (source.provenance || source.points?.length || !/^[a-f0-9]{64}$/.test(photoSha256 || '')) throw new Error('Only the original CV pixel proposal and its photo identity can be continued.')
    if (!reviewed) throw new Error('Check the selected branches, gaps, endpoints and dots before previewing.')
    const known = ['ambiguous_axes', 'uncertain_grid', 'unknown_x_scale', 'unknown_y_scale', 'ink_junction', 'axis_ink_overlap', 'clipped_ink', 'no_supported_ink', 'unclassified_small_marks']
    if (source.warnings.some(w => !known.includes(w.code)) || source.uncertainty.regions.some(r => !['ink_junction', 'axis_ink_overlap'].includes(r.reason))) throw new Error('This proposal has unsupported uncertainty. Use manual tracing.')
    const { frame, scale } = calibration(source.image, axisValues); const paths = branches(source, strokeDecisions)
    const candidates = marks(source)
    if (!markDecisions || Object.keys(markDecisions).length !== candidates.length || candidates.some(m => !['point', 'exclude'].includes(markDecisions[m.id]))) throw new Error('Review every small mark: keep it as a filled dot or exclude it.')
    const strokes = paths.map((p, i) => ({ ...p, id: 'cv-assisted-' + (i + 1), component_id: 'cv-assisted-' + (i + 1), kind: 'polyline', closed: false,
      vertices: p.vertices.map(v => ({ ...v, graph: Geometry.pixelToGraph(v.pixel, frame, scale) })) }))
    const points = candidates.filter(m => markDecisions[m.id] === 'point').map(m => ({ id: m.id, kind: 'point', pixel: m.pixel, graph: Geometry.pixelToGraph(m.pixel, frame, scale) }))
    return Geometry.validate({ schema_version: 1, input_revision: inputRevision, image: clone(source.image), status: 'needs_review', coordinate_frame: frame, calibration: scale,
      strokes, points, topology: { stroke_count: strokes.length, component_count: strokes.length, components: strokes.map(s => ({ id: s.id, stroke_ids: [s.id] })), junctions: [] },
      warnings: [], assistance: [], uncertainty: { confidence_kind: 'heuristic_not_probability', regions: [], assumptions: ['CV-assisted: human calibration and explicit keep/exclude review.', 'Only exact shared endpoints are joined, with no inserted coordinates, smoothing or retracing.', 'Small-mark positions come from CV component pixels and require student review.'] },
      provenance: { method: 'cv_assisted', automatically_recognized: false, curve_source: 'cv_pixels_no_retrace', photo_sha256: photoSha256,
        source_geometry: clone(source), review: { axisValues: clone(axisValues), strokeDecisions: clone(strokeDecisions), markDecisions: clone(markDecisions), reviewed: true },
        resolved_source_warning_codes: source.warnings.map(w => w.code) } })
  }
  function validate (geometry) {
    const p = geometry.provenance
    if (p?.method !== 'cv_assisted' || p.automatically_recognized !== false || p.curve_source !== 'cv_pixels_no_retrace' || !p.review) throw new Error('A reviewed CV-assisted provenance record is required.')
    const expected = fromSelection({ source: p.source_geometry, photoSha256: p.photo_sha256, ...p.review, inputRevision: geometry.input_revision })
    if (JSON.stringify(geometry) !== JSON.stringify(expected)) throw new Error('The CV-assisted geometry changed after review. Review the original detected lines again.')
    return geometry
  }
  const api = { calibration, marks, branches, fromSelection, validate }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.StarCVAssisted = api
})(typeof window !== 'undefined' ? window : globalThis)
