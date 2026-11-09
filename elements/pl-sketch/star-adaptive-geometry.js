/* Renderer-verified local curve approximation. No equation or reference input. */
;(function (root) {
  'use strict'
  const Native = typeof module !== 'undefined' && module.exports ? require('./star-native.js') : root.StarNative
  const Geometry = typeof module !== 'undefined' && module.exports ? require('./star-geometry.js') : root.StarGeometry
  const Kernel = typeof module !== 'undefined' && module.exports ? require('./star-native-spline-fit.js') : root.StarNativeSplineFit
  const clone = x => JSON.parse(JSON.stringify(x)); const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
  const quantize = ps => ps.map(p => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 }))
  function controls (anchors) {
    if (!Array.isArray(anchors) || anchors.length < 2 || anchors.length > 10000 || anchors.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new Error('Invalid native spline anchors.')
    const q = quantize(anchors)
    if (q.slice(1).some((p, i) => dist(p, q[i]) < 0.01)) throw new Error('Spline anchors are too close at native precision.')
    const cs = quantize(Kernel.fit(q, 0))
    if ((cs.length - 1) % 3 || cs.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new Error('Native spline fitting produced invalid controls.')
    return cs
  }
  function cubic (ps, t) { const u = 1 - t; return { x: u ** 3 * ps[0].x + 3 * u * u * t * ps[1].x + 3 * u * t * t * ps[2].x + t ** 3 * ps[3].x, y: u ** 3 * ps[0].y + 3 * u * u * t * ps[1].y + 3 * u * t * t * ps[2].y + t ** 3 * ps[3].y } }
  function samples (cs, step = 1) {
    const out = []
    for (let i = 0; i + 3 < cs.length; i += 3) { const ps = cs.slice(i, i + 4); const n = Math.max(8, Math.ceil((dist(ps[0], ps[1]) + dist(ps[1], ps[2]) + dist(ps[2], ps[3])) / step)); for (let k = 0; k <= n; k++) out.push(cubic(ps, k / n)) }
    return out
  }
  function lines (ps, step = 1) {
    const out = []
    for (let i = 1; i < ps.length; i++) { const n = Math.max(1, Math.ceil(dist(ps[i - 1], ps[i]) / step)); for (let k = 0; k <= n; k++) out.push({ x: ps[i - 1].x + (ps[i].x - ps[i - 1].x) * k / n, y: ps[i - 1].y + (ps[i].y - ps[i - 1].y) * k / n }) }
    return out
  }
  function nearest (p, ps) {
    let best = Infinity
    for (let i = 1; i < ps.length; i++) { const a = ps[i - 1]; const b = ps[i]; const dx = b.x - a.x; const dy = b.y - a.y; const n = dx * dx + dy * dy; const t = n ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / n)) : 0; best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)) }
    return best
  }
  function toPhoto (p, g, config) {
    const x = config.xrange[0] + p.x * (config.xrange[1] - config.xrange[0]) / config.width - g.calibration.origin_graph[0]
    const y = config.yrange[1] - p.y * (config.yrange[1] - config.yrange[0]) / config.height - g.calibration.origin_graph[1]
    return { x: g.coordinate_frame.origin_pixel[0] + x * g.calibration.x_unit_vector_pixel[0] + y * g.calibration.y_unit_vector_pixel[0], y: g.coordinate_frame.origin_pixel[1] + x * g.calibration.x_unit_vector_pixel[1] + y * g.calibration.y_unit_vector_pixel[1] }
  }
  function metrics (reference, rendered, g, config) {
    const a = reference.map(p => toPhoto(p, g, config)); const b = rendered.map(p => toPhoto(p, g, config)); const ds = lines(a, 2).map(p => nearest(p, b)).concat(b.map(p => nearest(p, a))).sort((x, y) => x - y)
    return { p95_source_pixel: ds[Math.floor((ds.length - 1) * 0.95)], max_source_pixel: ds.at(-1), endpoint_error_source_pixel: Math.max(dist(a[0], b[0]), dist(a.at(-1), b.at(-1))) }
  }
  function turns (ps, axis) { const s = ps.slice(1).map((p, i) => p[axis] - ps[i][axis]).filter(v => Math.abs(v) > 0.01).map(Math.sign); return s.slice(1).filter((v, i) => v !== s[i]).length }
  function splineTurns (cs, axis) {
    const signs = []
    for (let i = 0; i + 3 < cs.length; i += 3) {
      const p = cs.slice(i, i + 4).map(v => v[axis]); const a = -p[0] + 3 * p[1] - 3 * p[2] + p[3]; const b = 2 * (p[0] - 2 * p[1] + p[2]); const c = p[1] - p[0]; const roots = []
      if (Math.abs(a) < 1e-12) { if (Math.abs(b) > 1e-12) roots.push(-c / b) } else { const d = b * b - 4 * a * c; if (d >= 0) roots.push((-b - Math.sqrt(d)) / (2 * a), (-b + Math.sqrt(d)) / (2 * a)) }
      const ts = [0, ...roots.filter(t => t > 0 && t < 1), 1].sort((x, y) => x - y)
      for (let k = 1; k < ts.length; k++) { const change = cubic(cs.slice(i, i + 4), ts[k])[axis] - cubic(cs.slice(i, i + 4), ts[k - 1])[axis]; if (Math.abs(change) > 0.01) signs.push(Math.sign(change)) }
    }
    return signs.slice(1).filter((v, i) => v !== signs[i]).length
  }
  function protectedEdges (stroke, ps) {
    const edge = new Set(); const landmarks = []; const photo = stroke.vertices.map(v => ({ x: v.pixel[0], y: v.pixel[1] }))
    for (let i = 1; i < ps.length - 1; i++) {
      const a = photo[i - 1]; const b = photo[i]; const c = photo[i + 1]; const n = dist(a, b) * dist(b, c)
      const angle = n ? Math.acos(Math.max(-1, Math.min(1, ((b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)) / n))) * 180 / Math.PI : 180
      if (stroke.vertices[i].corner || angle >= 35) { edge.add(i - 1); edge.add(i); landmarks.push({ index: i, kind: 'corner_or_irregular_turn', turn_degrees: angle }) }
    }
    for (const axis of ['x', 'y']) for (const extreme of ['min', 'max']) {
      const target = Math[extreme](...ps.map(p => p[axis])); const indices = ps.flatMap((p, i) => Math.abs(p[axis] - target) < 0.02 ? [i] : [])
      for (const i of indices) if (i > 0 && i < ps.length - 1) { edge.add(i - 1); edge.add(i); landmarks.push({ index: i, kind: axis + '_' + extreme }) }
    }
    for (const axis of ['x', 'y']) for (let i = 1; i < ps.length - 1; i++) if ((ps[i][axis] - ps[i - 1][axis]) * (ps[i + 1][axis] - ps[i][axis]) < -0.0004) { edge.add(i - 1); edge.add(i); landmarks.push({ index: i, kind: 'local_' + axis + '_extremum' }) }
    return { edge, landmarks }
  }
  function fitSpan (ps, g, config) {
    let best = null
    const photo = ps.map(p => toPhoto(p, g, config))
    const scale = Math.max(g.image.width / g.image.processing.width, g.image.height / g.image.processing.height)
    const p95Limit = Math.min(4, 1.75 * scale); const maxLimit = Math.min(6, 2.65 * scale)
    const fixed = new Set([0, 1, ps.length - 2, ps.length - 1])
    function trial (indices) {
      const anchors = indices.map(i => ps[i])
      if (anchors.length >= ps.length && best) return null
      try {
        const cs = controls(anchors); const rendered = samples(cs, 0.6); const m = metrics(ps, rendered, g, config)
        if (m.p95_source_pixel > p95Limit || m.max_source_pixel > maxLimit || m.endpoint_error_source_pixel > 0.04 || rendered.some(p => p.x < 0 || p.y < 0 || p.x > config.width || p.y > config.height) || ['x', 'y'].some(a => splineTurns(cs, a) > turns(ps, a))) return null
        return { anchors: quantize(anchors), controls: cs, metrics: m, indices }
      } catch (_) { return null }
    }
    for (const tolerance of [0, 0.5, 1, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6]) {
      const reduced = Geometry.simplify(photo.map(p => [p.x, p.y]), tolerance)
      const indices = [...new Set([...fixed, ...reduced.map(p => photo.findIndex(v => v.x === p[0] && v.y === p[1]))])].sort((a, b) => a - b)
      const candidate = trial(indices)
      if (candidate && (!best || candidate.anchors.length < best.anchors.length)) best = candidate
    }
    // Render-aware pruning, not a curve-family fit. Preserve boundary tangents.
    while (best) {
      let next = null
      for (const index of best.indices) if (!fixed.has(index)) { const candidate = trial(best.indices.filter(i => i !== index)); if (candidate && (!next || candidate.metrics.max_source_pixel < next.metrics.max_source_pixel)) next = candidate }
      if (!next) break
      best = next
    }
    return best && best.anchors.length < ps.length ? best : null
  }
  function plan (geometry, config, mode = 'auto') {
    if (!['auto', 'smooth', 'original'].includes(mode)) throw new Error('Unknown representation choice.')
    Geometry.validate(geometry)
    const parts = []; const analyses = []
    for (const stroke of geometry.strokes) {
      const ps = stroke.vertices.map(v => Native.graphToNative(config, v.graph)); const original = { kind: 'polyline', points: clone(ps), source_stroke_id: stroke.id, source_range: [0, ps.length - 1] }
      if (mode === 'original' || ps.length < 4) { parts.push(original); analyses.push({ stroke_id: stroke.id, classification: ps.length === 2 ? 'straight_line' : stroke.vertices.some(v => v.corner) ? 'piecewise_linear_or_corner' : 'original_trace', original_handles: ps.length }); continue }
      const { edge, landmarks } = protectedEdges(stroke, ps); const spans = []
      const straight = [ps[0], ps.at(-1)]
      const lineError = !landmarks.length ? metrics(ps, lines(straight, 0.6), geometry, config) : null
      if (lineError && lineError.max_source_pixel <= 1) {
        parts.push({ ...original, points: clone(straight), metrics: lineError })
        analyses.push({ stroke_id: stroke.id, classification: 'measured_straight_line', original_handles: ps.length, landmarks })
        continue
      }
      for (let i = 0; i < ps.length - 1;) { const start = i; const protect = edge.has(i); while (i < ps.length - 1 && edge.has(i) === protect) i++; spans.push({ start, end: i, protect }) }
      let chosen = spans.flatMap(s => {
        const points = ps.slice(s.start, s.end + 1); const fit = !s.protect && points.length >= 4 ? fitSpan(points, geometry, config) : null
        if (fit) return [{ kind: 'spline', points: fit.anchors, controls: fit.controls, metrics: fit.metrics, source_stroke_id: stroke.id, source_range: [s.start, s.end] }]
        let split = null
        if (!s.protect && points.length >= 7) for (const [left, right] of [[0, 1], [1, 0], [0, 2], [2, 0], [1, 1], [2, 2]]) {
          const a = s.start + left; const b = s.end - right
          if (b - a < 3) continue
          const inner = fitSpan(ps.slice(a, b + 1), geometry, config)
          if (!inner) continue
          const candidate = []
          if (left) candidate.push({ kind: 'polyline', points: clone(ps.slice(s.start, a + 1)), source_stroke_id: stroke.id, source_range: [s.start, a] })
          candidate.push({ kind: 'spline', points: inner.anchors, controls: inner.controls, metrics: inner.metrics, source_stroke_id: stroke.id, source_range: [a, b] })
          if (right) candidate.push({ kind: 'polyline', points: clone(ps.slice(b, s.end + 1)), source_stroke_id: stroke.id, source_range: [b, s.end] })
          if (candidate.reduce((n, p) => n + p.points.length, 0) < points.length && (!split || candidate.reduce((n, p) => n + p.points.length, 0) < split.reduce((n, p) => n + p.points.length, 0))) split = candidate
        }
        return split || [{ kind: 'polyline', points: clone(points), source_stroke_id: stroke.id, source_range: [s.start, s.end] }]
      })
      // Adjacent unsmoothed spans remain one native path; no invented join.
      chosen = chosen.reduce((out, p) => { const last = out.at(-1); if (last && last.kind === 'polyline' && p.kind === 'polyline') { last.points.push(...p.points.slice(1)); last.source_range[1] = p.source_range[1] } else out.push(p); return out }, [])
      if (chosen.some(p => p.kind === 'spline')) for (const part of chosen.filter(p => p.kind === 'polyline')) {
        const [a, b] = part.source_range; const fixed = [...new Set([a, b, ...landmarks.map(l => l.index).filter(i => i > a && i < b)])].sort((x, y) => x - y); const keep = []
        for (let k = 1; k < fixed.length; k++) {
          const section = ps.slice(fixed[k - 1], fixed[k] + 1); const photo = section.map(p => toPhoto(p, geometry, config)); const tolerance = Math.min(4, 1.75 * Math.max(geometry.image.width / geometry.image.processing.width, geometry.image.height / geometry.image.processing.height)); const simple = Geometry.simplify(photo.map(p => [p.x, p.y]), tolerance)
          const points = simple.map(p => section[photo.findIndex(q => q.x === p[0] && q.y === p[1])])
          keep.push(...points.slice(keep.length ? 1 : 0))
        }
        part.points = clone(keep)
      }
      for (let i = 1; i < chosen.length; i++) if (chosen[i - 1].kind === 'spline' || chosen[i].kind === 'spline') { const q = quantize([chosen[i].points[0]])[0]; chosen[i].points[0] = clone(q); chosen[i - 1].points[chosen[i - 1].points.length - 1] = clone(q) }
      const handles = chosen.reduce((n, p) => n + p.points.length, 0)
      const smoothLength = chosen.filter(p => p.kind === 'spline').reduce((n, p) => n + p.controls.slice(1).reduce((s, v, i) => s + dist(v, p.controls[i]), 0), 0)
      const wholeLength = ps.slice(1).reduce((n, p, i) => n + dist(p, ps[i]), 0)
      if (!chosen.some(p => p.kind === 'spline') || handles >= ps.length * 0.9 || smoothLength < wholeLength * 0.4) chosen = [original]
      parts.push(...chosen); analyses.push({ stroke_id: stroke.id, classification: chosen.some(p => p.kind === 'spline') ? 'smooth_sections_with_protected_features' : landmarks.length ? 'piecewise_or_irregular_original' : 'unverified_smoothness_original', original_handles: ps.length, landmarks })
    }
    return { mode, parts, analyses, original_handle_count: geometry.strokes.reduce((n, s) => n + s.vertices.length, 0), handle_count: parts.reduce((n, p) => n + p.points.length, 0), spline_count: parts.filter(p => p.kind === 'spline').length, polyline_count: parts.filter(p => p.kind === 'polyline').length,
      fitting_policy: { p95_source_pixel: Math.min(4, 1.75 * Math.max(geometry.image.width / geometry.image.processing.width, geometry.image.height / geometry.image.processing.height)), max_source_pixel: Math.min(6, 2.65 * Math.max(geometry.image.width / geometry.image.processing.width, geometry.image.height / geometry.image.processing.height)), endpoint_source_pixel: 0.04, corner_turn_degrees: 35, native_quantization: 0.01, numerical_extremum_amplitude_native: 0.01 } }
  }
  const api = { plan, controls, samples, lines, nearest, metrics, toPhoto, turns, splineTurns }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.StarAdaptiveGeometry = api
})(typeof window !== 'undefined' ? window : globalThis)
