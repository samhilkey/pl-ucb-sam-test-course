/* Bounded CV-assisted draft suggestions. No equation, reference or gap fill. */
;(function (root) {
  'use strict'
  const Geometry = typeof module !== 'undefined' && module.exports ? require('./star-geometry.js') : root.StarGeometry
  const Assisted = typeof module !== 'undefined' && module.exports ? require('./star-cv-assisted.js') : root.StarCVAssisted
  const Targeted = typeof module !== 'undefined' && module.exports ? require('./star-targeted.js') : root.StarTargeted
  const clone = x => JSON.parse(JSON.stringify(x))
  function suggest (source, axisValues) {
    Geometry.validate(source)
    const { frame, scale } = Assisted.calibration(source.image, axisValues)
    const distance = (p, v) => Math.abs((p[0] - frame.origin_pixel[0]) * v[1] - (p[1] - frame.origin_pixel[1]) * v[0]) / Math.hypot(...v)
    const band = Math.hypot(source.image.width, source.image.height) * 0.05
    const nodes = new Map()
    for (const s of source.strokes) if (!s.closed) for (const p of [s.vertices[0].pixel, s.vertices.at(-1).pixel]) { const k = p.join(','); if (!nodes.has(k)) nodes.set(k, { pixel: p, ids: [], component: s.component_id }); nodes.get(k).ids.push(s.id) }
    const terminals = [...nodes.values()].filter(n => n.ids.length === 1 && Math.min(distance(n.pixel, scale.x_unit_vector_pixel), distance(n.pixel, scale.y_unit_vector_pixel)) > band)
    if (terminals.length > 80 || source.strokes.length > 500) throw new Error('Too many competing fragments for a quick draft. Use Select ink or manual tracing in Photo options.')
    const routes = []
    for (let i = 0; i < terminals.length; i++) for (let j = i + 1; j < terminals.length; j++) {
      if (terminals[i].component !== terminals[j].component) continue
      const pair = [terminals[i].pixel, terminals[j].pixel]
      let selected
      try { selected = Targeted.select(source, [pair], []) } catch (_) { continue }
      const length = source.strokes.filter(s => selected.strokeDecisions[s.id] === 'keep').reduce((sum, s) => sum + s.vertices.slice(1).reduce((n, v, i) => n + Math.hypot(...v.pixel.map((p, k) => p - s.vertices[i].pixel[k])), 0), 0)
      if (length >= Math.max(source.image.width, source.image.height) * 0.25) routes.push(pair)
    }
    if (!routes.length) throw new Error('No clear long curve was found away from the axes. Use Select ink or manual tracing in Photo options.')
    // Overlapping alternative routes are not ranked or joined by guess.
    const selected = Targeted.select(source, routes, [])
    return { selections: routes, ...selected }
  }
  function build ({ source, photoSha256, axisValues, inputRevision }) {
    if (inputRevision !== source.input_revision || !/^[a-f0-9]{64}$/.test(photoSha256 || '')) throw new Error('The draft belongs to a different or stale photograph.')
    const selected = suggest(source, axisValues)
    const markDecisions = Object.fromEntries(Assisted.marks(source).map(m => [m.id, 'exclude']))
    const g = Assisted.fromSelection({ source, photoSha256, axisValues, strokeDecisions: selected.strokeDecisions, markDecisions, inputRevision, reviewBasis: 'explicit_decisions' })
    g.provenance = { method: 'cv_editable_draft', automatically_recognized: false, photo_sha256: photoSha256, source_geometry: clone(source),
      review: { axisValues: clone(axisValues) }, selection_policy: 'unique_long_measured_routes_with_endpoints_away_from_confirmed_axes_v1' }
    g.uncertainty.assumptions = ['CV-assisted approximate draft; student confirmed axes and scale. Not Gemini recognition.', 'Whole measured paths are reused in traversal order, including endpoint hooks and embedded marks. No sorting, trimming, ideal equation or gap filling.', 'Short strokes, isolated dots and ambiguous routes may be missing. Compare the original photo and correct with native tools before submitting.']
    return Geometry.validate(g)
  }
  function validate (g) {
    const p = g.provenance
    if (p?.method !== 'cv_editable_draft' || p.automatically_recognized !== false) throw new Error('An explicit CV-assisted draft provenance is required.')
    const expected = build({ source: p.source_geometry, photoSha256: p.photo_sha256, ...p.review, inputRevision: g.input_revision })
    if (JSON.stringify(g) !== JSON.stringify(expected)) throw new Error('The measured draft changed after preparation.')
    return g
  }
  function gradeable (paths) {
    if (!Array.isArray(paths) || paths.length > 100 || paths.some(ps => !Array.isArray(ps))) throw new Error('Invalid editable polyline state.')
    return paths.filter(ps => ps.length).map(ps => {
      if (ps.length < 2 || ps.length > 10000 || ps.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new Error('Invalid editable polyline coordinates.')
      const controls = [[ps[0].x, ps[0].y]]
      for (let i = 1; i < ps.length; i++) for (let k = 1; k <= 3; k++) controls.push(['x', 'y'].map(a => k === 3 ? ps[i][a] : ps[i - 1][a] + (ps[i][a] - ps[i - 1][a]) * k / 3))
      return { spline: controls }
    })
  }
  function installGrading (si, config) {
    const id = config.editablePhotoDraftTool
    if (!id) return
    const original = si.getGradeable.bind(si)
    si.getGradeable = () => {
      const before = JSON.parse(si.getState()).data[id]
      const output = JSON.parse(original()); const after = JSON.parse(si.getState()).data[id]
      // Upstream polyline fitting rounds shared endpoint objects in place.
      // Retain its finalized-shape placeholders, but restore exact user vertices.
      const exact = after.map((ps, i) => ps.length >= 2 && before[i]?.length === ps.length ? before[i] : ps)
      if (JSON.stringify(exact) !== JSON.stringify(after)) si.setState(JSON.stringify({ data: { [id]: exact } }))
      output.data[id] = gradeable(exact); return JSON.stringify(output)
    }
  }
  const api = { suggest, build, validate, gradeable, installGrading }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.StarEditableDraft = api
})(typeof window !== 'undefined' ? window : globalThis)
