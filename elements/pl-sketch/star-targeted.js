/* Endpoint-guided reuse of measured CV paths. No equation, tracing or gap fill. */
;(function (root) {
  'use strict'
  const Geometry = typeof module !== 'undefined' && module.exports ? require('./star-geometry.js') : root.StarGeometry
  const Assisted = typeof module !== 'undefined' && module.exports ? require('./star-cv-assisted.js') : root.StarCVAssisted
  const clone = v => JSON.parse(JSON.stringify(v)); const key = p => p.join(',')
  function select (source, selections, pointSelections) {
    Geometry.validate(source)
    if (source.provenance || source.points?.length || !Array.isArray(selections) || !selections.length || !Array.isArray(pointSelections)) throw new Error('Select both visible endpoints of at least one curve.')
    const nodes = new Map()
    const add = (p, edge) => { const k = key(p); if (!nodes.has(k)) nodes.set(k, { pixel: p, edges: [] }); nodes.get(k).edges.push(edge) }
    for (const s of source.strokes) if (!s.closed) { add(s.vertices[0].pixel, s.id); add(s.vertices.at(-1).pixel, s.id) }
    const snapRadius = 14 * Math.max(source.image.width / source.image.processing.width, source.image.height / source.image.processing.height)
    const near = (p, list) => {
      if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite)) throw new Error('Choose a position on the photograph.')
      const sorted = list.map(v => ({ v, d: Math.hypot(...p.map((x, i) => x - v.pixel[i])) })).sort((a, b) => a.d - b.d)
      if (!sorted.length || sorted[0].d > snapRadius || sorted[1] && sorted[1].d - sorted[0].d < 2) throw new Error('No unique detected endpoint or dot near that click. Move closer, or use manual tracing.')
      return sorted[0].v
    }
    const terminals = [...nodes.values()].filter(n => n.edges.length === 1)
    const other = (id, node) => { const s = source.strokes.find(s => s.id === id); const a = key(s.vertices[0].pixel); const b = key(s.vertices.at(-1).pixel); return a === node ? b : a }
    const walk = (start, end, skip) => {
      const queue = [start]; const previous = new Map([[start, null]])
      for (let i = 0; i < queue.length; i++) {
        const node = queue[i]; if (node === end) break
        for (const edge of nodes.get(node).edges) if (edge !== skip) { const next = other(edge, node); if (!previous.has(next)) { previous.set(next, { node, edge }); queue.push(next) } }
      }
      if (!previous.has(end)) return null
      const ids = []; let node = end
      while (node !== start) { const step = previous.get(node); ids.push(step.edge); node = step.node }
      return ids.reverse()
    }
    const kept = new Set(); const routes = []
    for (const pair of selections) {
      if (!Array.isArray(pair) || pair.length !== 2) throw new Error('Finish selecting both endpoints of each curve.')
      const a = near(pair[0], terminals); const b = near(pair[1], terminals)
      if (key(a.pixel) === key(b.pixel)) throw new Error('Choose two different curve endpoints.')
      const route = walk(key(a.pixel), key(b.pixel))
      if (!route) throw new Error('Detected ink is disconnected here. No missing segment was invented; use manual tracing.')
      if (route.some(edge => walk(key(a.pixel), key(b.pixel), edge))) throw new Error('Several ink routes connect these endpoints. Use manual tracing rather than guess through a loop or crossing.')
      if (route.some(id => kept.has(id))) throw new Error('This curve overlaps another selected route. Remove the duplicate selection.')
      route.forEach(id => kept.add(id)); routes.push({ stroke_ids: route, snapped_endpoints: [a.pixel, b.pixel] })
    }
    const marks = Assisted.marks(source); const selectedPoints = new Set()
    for (const click of pointSelections) {
      const m = near(click, marks); const component = source.uncertainty.rejected_small_components[Number(m.id.slice(5)) - 1]
      const dx = (m.bounds_pixel[1][0] - m.bounds_pixel[0][0]) * source.image.processing.width / source.image.width + 1
      const dy = (m.bounds_pixel[1][1] - m.bounds_pixel[0][1]) * source.image.processing.height / source.image.height + 1
      if (selectedPoints.has(m.id)) throw new Error('This dot is already selected.')
      if (dx / dy < 0.5 || dx / dy > 2 || component.pixels_processing / (dx * dy) < 0.35) throw new Error('This component is not a compact filled dot. Add the correct mark with the native point tool.')
      selectedPoints.add(m.id)
    }
    const strokeDecisions = Object.fromEntries(source.strokes.map(s => [s.id, kept.has(s.id) ? 'keep' : 'exclude']))
    const markDecisions = Object.fromEntries(marks.map(m => [m.id, selectedPoints.has(m.id) ? 'point' : 'exclude']))
    Assisted.branches(source, strokeDecisions) // rejects loops, clipping and unresolved degree > 2
    return { strokeDecisions, markDecisions, routes }
  }
  function fromSelection ({ source, photoSha256, axisValues, selections, pointSelections, inputRevision }) {
    if (inputRevision !== source.input_revision) throw new Error('The selected pixels belong to an older photograph.')
    const chosen = select(source, selections, pointSelections)
    const g = Assisted.fromSelection({ source, photoSha256, axisValues, strokeDecisions: chosen.strokeDecisions, markDecisions: chosen.markDecisions, inputRevision, reviewBasis: 'explicit_decisions' })
    g.provenance = { method: 'targeted_cv', automatically_recognized: false, curve_source: 'unique_measured_CV_paths_selected_by_endpoints', photo_sha256: photoSha256,
      source_geometry: clone(source), review: { axisValues: clone(axisValues), selections: clone(selections), pointSelections: clone(pointSelections) } }
    g.uncertainty.assumptions = ['CV-assisted: student supplied axes/values and selected curve endpoints and filled dots.', 'Only uniquely connected measured paths are reused; all unselected ink is excluded.', 'No gap filling, equation fitting, expected geometry or Gemini output. Compare the whole candidate before accepting.']
    return Geometry.validate(g)
  }
  function validate (geometry) {
    const p = geometry.provenance
    if (p?.method !== 'targeted_cv' || p.automatically_recognized !== false) throw new Error('Reviewed endpoint-guided CV provenance is required.')
    const expected = fromSelection({ source: p.source_geometry, photoSha256: p.photo_sha256, ...p.review, inputRevision: geometry.input_revision })
    if (JSON.stringify(geometry) !== JSON.stringify(expected)) throw new Error('The endpoint-guided proposal changed after review.')
    return geometry
  }
  const api = { select, fromSelection, validate }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.StarTargeted = api
})(typeof window !== 'undefined' ? window : globalThis)
