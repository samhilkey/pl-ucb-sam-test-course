/* Recognizer-independent photo geometry. No native canvas or grading access. */
;(function (root) {
  'use strict'

  const pair = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)
  const sources = ['photo_detected', 'question_configuration', 'student_corrected', 'unknown']
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

  // Adapted from simplifyTrace on feat/photo-trace-shapes (ccada8f).
  // Preserve input order, both endpoints, and a maximum point-to-segment error.
  // No sorting by x, averaging, curve family, or extrapolation.
  function simplify (points, tolerance = 1.25) {
    if (!Array.isArray(points) || points.some(p => !pair(p)) || !Number.isFinite(tolerance) || tolerance < 0) {
      throw new Error('Simplification needs finite points and a nonnegative tolerance.')
    }
    if (points.length < 3) return points.map(p => p.slice())
    const keep = new Set([0, points.length - 1])
    const pending = [[0, points.length - 1]]
    while (pending.length) {
      const [first, last] = pending.pop()
      const a = points[first]; const b = points[last]
      const dx = b[0] - a[0]; const dy = b[1] - a[1]
      const length2 = dx * dx + dy * dy
      let maximum = tolerance * tolerance; let index = -1
      for (let i = first + 1; i < last; i++) {
        const p = points[i]
        const t = length2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2)) : 0
        const d2 = (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2
        if (d2 > maximum) { maximum = d2; index = i }
      }
      if (index !== -1) { keep.add(index); pending.push([first, index], [index, last]) }
    }
    return [...keep].sort((a, b) => a - b).map(i => points[i].slice())
  }

  function pixelToGraph (pixel, frame, calibration) {
    if (calibration.status !== 'calibrated') return null
    const o = frame.origin_pixel; const a = calibration.x_unit_vector_pixel; const b = calibration.y_unit_vector_pixel
    const det = a[0] * b[1] - a[1] * b[0]
    if (!Number.isFinite(det) || Math.abs(det) < 1e-9) throw new Error('Singular calibration.')
    const dx = pixel[0] - o[0]; const dy = pixel[1] - o[1]
    return [calibration.origin_graph[0] + (dx * b[1] - dy * b[0]) / det,
      calibration.origin_graph[1] + (a[0] * dy - a[1] * dx) / det]
  }

  function validate (g) {
    const fail = message => { throw new Error('Invalid photo geometry: ' + message) }
    if (!g || g.schema_version !== 1) fail('schema version')
    const im = g.image
    if (!im || ![im.width, im.height].every(n => Number.isInteger(n) && n > 0 && n <= 20000)) fail('image dimensions')
    const inside = p => pair(p) && p[0] >= 0 && p[1] >= 0 && p[0] < im.width && p[1] < im.height
    const proc = im.processing
    if (!proc || ![proc.width, proc.height].every(n => Number.isInteger(n) && n > 0 && n <= 1200)) fail('processing dimensions')
    const m = proc.source_to_processing
    if (!Array.isArray(m) || m.length !== 6 || !m.every(Number.isFinite) ||
        Math.abs(m[0] - proc.width / im.width) > 1e-10 || Math.abs(m[3] - proc.height / im.height) > 1e-10 ||
        m[1] !== 0 || m[2] !== 0 || Math.abs(m[4] - (m[0] - 1) / 2) > 1e-10 || Math.abs(m[5] - (m[3] - 1) / 2) > 1e-10) fail('resize transform')
    if (!Number.isSafeInteger(g.input_revision) || g.input_revision < 0) fail('input revision')
    if (!['automatic', 'needs_review', 'abstained'].includes(g.status)) fail('status')
    if (!Array.isArray(g.warnings) || !Array.isArray(g.assistance) || !g.uncertainty ||
        !Array.isArray(g.uncertainty.regions) || g.uncertainty.confidence_kind !== 'heuristic_not_probability') fail('uncertainty')
    for (const w of g.warnings) if (!w || typeof w.code !== 'string' || typeof w.message !== 'string') fail('warning')
    for (const a of g.assistance) if (!a || typeof a.target !== 'string' || typeof a.reason !== 'string') fail('assistance')
    for (const r of g.uncertainty.regions) {
      if (!r || typeof r.reason !== 'string' || !inside(r.pixel)) fail('uncertain region')
    }
    const f = g.coordinate_frame; const c = g.calibration
    if (!f || !['detected', 'uncertain'].includes(f.status) || !f.axes || !f.grid || !c || !c.axes || !['calibrated', 'uncertain'].includes(c.status)) fail('coordinate frame')
    if (f.origin_pixel !== null && !inside(f.origin_pixel)) fail('origin bounds')
    if (f.status === 'detected' && !inside(f.origin_pixel)) fail('missing detected origin')
    for (const axis of ['x', 'y']) {
      const a = f.axes[axis]; const scale = c.axes[axis]; const grid = f.grid[axis]
      if (!a || !['detected', 'uncertain'].includes(a.status) || !Array.isArray(a.candidates)) fail('axis evidence')
      if (a.status === 'detected' && a.candidates.length !== 1) fail('axis uniqueness')
      for (const line of a.candidates) {
        if (!inside(line.start) || !inside(line.end) || !Number.isFinite(line.support) || line.support < 0 || line.support > 1) fail('axis candidate')
      }
      if (!grid || !['detected', 'unknown'].includes(grid.status) || !Array.isArray(grid.lines_pixel) ||
          grid.lines_pixel.some((v, i) => !Number.isFinite(v) || v < 0 || v >= (axis === 'x' ? im.width : im.height) || (i && v <= grid.lines_pixel[i - 1]))) fail('grid evidence')
      if (grid.status === 'detected' && (!Number.isFinite(grid.spacing_pixel) || grid.spacing_pixel <= 0 || grid.lines_pixel.length < 5)) fail('grid spacing')
      if (grid.status === 'unknown' && grid.spacing_pixel !== null) fail('unknown grid spacing')
      if (!scale || !sources.includes(scale.source) || !['known', 'unknown'].includes(scale.status) || !Array.isArray(scale.labels)) fail('scale provenance')
      if (scale.status === 'unknown' && scale.source !== 'unknown') fail('unknown scale provenance')
      if (scale.status === 'known' && ((scale.units_per_grid !== undefined && (!Number.isFinite(scale.units_per_grid) || scale.units_per_grid <= 0)) || !Number.isFinite(scale.intersection_value) ||
          (scale.source === 'photo_detected' && scale.labels.length < 2))) fail('known scale evidence')
      for (const label of scale.labels) {
        if (!Number.isFinite(label.value) || !inside(label.anchor_pixel) || !Array.isArray(label.bounds_pixel) || label.bounds_pixel.length !== 2 ||
            !label.bounds_pixel.every(inside) || !Number.isFinite(label.match_error) || label.match_error < 0 || label.match_error > 1) fail('label evidence')
      }
    }
    if (f.status === 'detected') {
      if (['x', 'y'].some(a => f.axes[a].status !== 'detected')) fail('frame axis status')
      const [x, y] = [f.axes.x.candidates[0], f.axes.y.candidates[0]]
      const a = [x.end[0] - x.start[0], x.end[1] - x.start[1]]; const b = [y.end[0] - y.start[0], y.end[1] - y.start[1]]
      const det = a[0] * b[1] - a[1] * b[0]
      if (Math.abs(det) < 1e-9) fail('parallel axes')
      const d = [y.start[0] - x.start[0], y.start[1] - x.start[1]]; const t = (d[0] * b[1] - d[1] * b[0]) / det
      if (distance(f.origin_pixel, [x.start[0] + t * a[0], x.start[1] + t * a[1]]) > 1e-7) fail('axis intersection consistency')
    }
    if (c.status === 'calibrated') {
      if (f.status !== 'detected' || !pair(c.origin_graph) || !pair(c.x_unit_vector_pixel) || !pair(c.y_unit_vector_pixel) ||
          ['x', 'y'].some(a => c.axes[a].status !== 'known' || c.axes[a].source === 'unknown')) fail('calibration evidence')
      const [a, b] = [c.x_unit_vector_pixel, c.y_unit_vector_pixel]
      if (Math.abs(a[0] * b[1] - a[1] * b[0]) < 1e-9) fail('singular calibration')
      for (const [i, axis] of ['x', 'y'].entries()) {
        if (Math.abs(c.origin_graph[i] - c.axes[axis].intersection_value) > 1e-7) fail('intersection value consistency')
        const vector = i === 0 ? a : b
        if (f.grid[axis].status === 'detected' && c.axes[axis].units_per_grid !== undefined && Math.abs(Math.hypot(...vector) * c.axes[axis].units_per_grid - f.grid[axis].spacing_pixel) > 1e-7) fail('scale consistency')
        for (const l of c.axes[axis].labels) if (c.axes[axis].source === 'photo_detected') {
          const value = pixelToGraph(l.anchor_pixel, f, c)
          if (Math.abs(value[i] - l.value) > 1e-7 || Math.abs(value[1 - i] - c.origin_graph[1 - i]) > 1e-7) fail('label calibration consistency')
        }
      }
    } else if (c.origin_graph !== null || c.x_unit_vector_pixel !== null || c.y_unit_vector_pixel !== null) fail('uncertain mathematical transform')
    if (!Array.isArray(g.strokes) || g.strokes.length > 1000 || !g.topology || !Array.isArray(g.topology.components) || !Array.isArray(g.topology.junctions)) fail('topology')
    const ids = new Set(); const componentIds = new Set(); const membership = new Map()
    for (const comp of g.topology.components) {
      if (!comp || typeof comp.id !== 'string' || componentIds.has(comp.id) || !Array.isArray(comp.stroke_ids) || !comp.stroke_ids.length) fail('component identity')
      componentIds.add(comp.id)
      for (const id of comp.stroke_ids) { if (membership.has(id)) fail('duplicate stroke membership'); membership.set(id, comp.id) }
    }
    for (const s of g.strokes) {
      if (typeof s.id !== 'string' || ids.has(s.id) || membership.get(s.id) !== s.component_id || s.kind !== 'polyline' || typeof s.closed !== 'boolean' ||
          !Array.isArray(s.vertices) || s.vertices.length < 2 || s.vertices.length > 100000 || !Number.isFinite(s.simplification_tolerance_pixel) || s.simplification_tolerance_pixel < 0) fail('stroke structure')
      ids.add(s.id)
      for (let i = 0; i < s.vertices.length; i++) {
        const v = s.vertices[i]
        if (!inside(v.pixel) || typeof v.corner !== 'boolean' || typeof v.endpoint !== 'boolean' || (i && distance(v.pixel, s.vertices[i - 1].pixel) < 1e-10)) fail('vertex')
        if (v.endpoint && (s.closed || (i !== 0 && i !== s.vertices.length - 1))) fail('endpoint annotation')
        const expected = pixelToGraph(v.pixel, f, c)
        if (expected ? (!pair(v.graph) || distance(v.graph, expected) > 1e-7) : v.graph !== null) fail('derived graph coordinate')
      }
      if (s.closed && distance(s.vertices[0].pixel, s.vertices.at(-1).pixel) > 1e-8) fail('loop closure')
    }
    if (membership.size !== ids.size || [...membership.keys()].some(id => !ids.has(id)) || g.topology.stroke_count !== ids.size || g.topology.component_count !== componentIds.size) fail('topology counts')
    if (g.points !== undefined) {
      if (!Array.isArray(g.points) || g.points.length > 1000) fail('isolated points')
      const pointIds = new Set()
      for (const p of g.points) {
        if (!p || typeof p.id !== 'string' || !p.id || ids.has(p.id) || pointIds.has(p.id) || p.kind !== 'point' || !inside(p.pixel)) fail('isolated point structure')
        pointIds.add(p.id)
        const expected = pixelToGraph(p.pixel, f, c)
        if (expected ? (!pair(p.graph) || distance(p.graph, expected) > 1e-7) : p.graph !== null) fail('isolated point coordinate')
      }
      if (g.points.length && g.status === 'automatic') fail('unreviewed automatic points')
    }
    for (const comp of g.topology.components) {
      const connected = new Set([comp.stroke_ids[0]])
      let changed = true
      while (changed) {
        changed = false
        for (const id of comp.stroke_ids) if (!connected.has(id)) {
          const s = g.strokes.find(s => s.id === id)
          if ([...connected].some(other => {
            const t = g.strokes.find(s => s.id === other)
            return [s.vertices[0], s.vertices.at(-1)].some(a => [t.vertices[0], t.vertices.at(-1)].some(b => distance(a.pixel, b.pixel) < 1e-7))
          })) { connected.add(id); changed = true }
        }
      }
      if (connected.size !== comp.stroke_ids.length) fail('disconnected component membership')
    }
    for (const j of g.topology.junctions) {
      if (!inside(j.pixel) || !Array.isArray(j.stroke_ids) || j.stroke_ids.length < 2 || new Set(j.stroke_ids).size !== j.stroke_ids.length) fail('junction')
      for (const id of j.stroke_ids) {
        const s = g.strokes.find(s => s.id === id)
        if (!s || Math.min(distance(s.vertices[0].pixel, j.pixel), distance(s.vertices.at(-1).pixel, j.pixel)) > 1e-7) fail('junction membership')
      }
    }
    if (g.status === 'automatic' && (c.status !== 'calibrated' || !ids.size || g.assistance.length || g.warnings.length || g.uncertainty.regions.length || g.topology.junctions.length)) fail('unsupported automatic success')
    if (g.status === 'abstained' && ids.size) fail('abstention with proposed strokes')
    if (g.status !== 'abstained' && !ids.size) fail('missing strokes')
    return g
  }

  const api = { simplify, pixelToGraph, validate }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.StarGeometry = api
})(typeof window !== 'undefined' ? window : globalThis)
