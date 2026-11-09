/* Direct geometry-to-SketchResponse adapter. No fitting or recognition calls. */
;(function (root) {
  'use strict'
  const Geometry = typeof module !== 'undefined' && module.exports ? require('./star-geometry.js') : root.StarGeometry
  const CVAssisted = typeof module !== 'undefined' && module.exports ? require('./star-cv-assisted.js') : root.StarCVAssisted
  const clone = value => JSON.parse(JSON.stringify(value))
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  function tools (config) {
    return (config.plugins || []).flatMap(p => p.name === 'group' ? tools({ plugins: p.plugins }).map(t => ({ ...t, readonly: t.readonly || p.readonly })) : [p])
  }
  function receivingTool (config, id) {
    if (!config || config.readonly) throw new Error('This canvas is read-only.')
    const eligible = tools(config).filter(p => p.name === 'freeform' && !p.readonly && !p.helper && !p.overlay)
    const tool = id ? eligible.find(p => p.id === id) : eligible[0]
    if (!tool) throw new Error('Automatic import needs an editable free-draw tool to preserve corners in rendering and grading.')
    return tool
  }
  function receivingDraftTool (config) {
    const id = config?.editablePhotoDraftTool
    const tool = tools(config || {}).find(p => p.id === id && p.name === 'polyline' && !p.closed && !p.readonly && !p.helper && !p.overlay)
    if (!config?.assistedPhotoGeometry || config.readonly || !id || !tool) throw new Error('Editable drafts require an explicitly configured, graded open-polyline tool.')
    return tool
  }
  function graphToNative (config, point) {
    const { width, height, xrange: x, yrange: y } = config
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0 ||
        !Array.isArray(x) || x.length !== 2 || !x.every(Number.isFinite) || x[1] <= x[0] ||
        !Array.isArray(y) || y.length !== 2 || !y.every(Number.isFinite) || y[1] <= y[0] ||
        (config.xscale && config.xscale !== 'linear') || (config.yscale && config.yscale !== 'linear') ||
        !Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) throw new Error('Invalid linear native coordinate frame.')
    return { x: (point[0] - x[0]) * width / (x[1] - x[0]), y: (y[1] - point[1]) * height / (y[1] - y[0]) }
  }
  function encode (points, kind) {
    if (!Array.isArray(points) || points.length < 2 || points.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new Error('Native path needs finite vertices.')
    if (kind === 'polyline' || kind === 'spline') return clone(points)
    if (kind !== 'freeform') throw new Error('Unsupported native curve tool.')
    const out = [clone(points[0])]
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]; const b = points[i]
      for (let k = 1; k <= 3; k++) out.push({ x: a.x + (b.x - a.x) * k / 3, y: a.y + (b.y - a.y) * k / 3 })
    }
    return out
  }
  function pathData (controls) {
    if (controls.length < 4 || (controls.length - 1) % 3) throw new Error('Invalid cubic controls.')
    return 'M' + controls[0].x + ',' + controls[0].y + 'C' + controls.slice(1).map(p => p.x + ',' + p.y).join(' ')
  }
  // Diagnose in traversal order; never sort, trim, smooth or move ink to make
  // it satisfy a function-input contract. Keep the guard's original epsilon.
  function functionViolations (stroke, config) {
    const ps = stroke.vertices.map(v => graphToNative(config, v.graph))
    const dx = ps.slice(1).map((p, i) => p.x - ps[i].x)
    if (!dx.some(v => v > 1e-7) || !dx.some(v => v < -1e-7)) return []
    const net = ps.at(-1).x - ps[0].x
    const direction = Math.sign(net) || Math.sign(dx.find(v => Math.abs(v) > 1e-7))
    return dx.flatMap((v, i) => v * direction < -1e-7 ? [{ stroke_id: stroke.id, vertex_indices: [i, i + 1],
      pixels: [stroke.vertices[i].pixel, stroke.vertices[i + 1].pixel],
      graph: [stroke.vertices[i].graph, stroke.vertices[i + 1].graph], native_dx: v }] : [])
  }
  function prepare (geometry, config, toolId, state, options = {}) {
    Geometry.validate(geometry)
    const assisted = options.assisted === true && config.assistedPhotoGeometry === true &&
      geometry.status === 'needs_review' && geometry.provenance?.method === 'manual_trace' && geometry.provenance.automatically_recognized === false &&
      ['x', 'y'].every(axis => geometry.calibration.axes[axis].source === 'student_corrected') &&
      !geometry.warnings.length && !geometry.assistance.length && !geometry.uncertainty.regions.length && !geometry.topology.junctions.length
    const cvAssisted = options.cvAssisted === true && config.assistedPhotoGeometry === true && geometry.status === 'needs_review' &&
      geometry.provenance?.method === 'cv_assisted' && ['x', 'y'].every(axis => geometry.calibration.axes[axis].source === 'student_corrected') &&
      !geometry.warnings.length && !geometry.assistance.length && !geometry.uncertainty.regions.length && !geometry.topology.junctions.length && !!CVAssisted.validate(geometry)
    const Hybrid = options.hybrid === true && (typeof module !== 'undefined' && module.exports ? require('./star-hybrid.js') : root.StarHybrid)
    const hybrid = options.hybrid === true && config.experimentalHybridGeometry === true && config.assistedPhotoGeometry === true && geometry.status === 'needs_review' &&
      ['hybrid_development', 'hybrid_semantic'].includes(geometry.provenance?.method) && !geometry.warnings.length && !geometry.assistance.length &&
      !geometry.uncertainty.regions.length && !geometry.topology.junctions.length && !!Hybrid?.validate(geometry)
    const Targeted = options.targeted === true && (typeof module !== 'undefined' && module.exports ? require('./star-targeted.js') : root.StarTargeted)
    const targeted = options.targeted === true && config.assistedPhotoGeometry === true && geometry.status === 'needs_review' &&
      geometry.provenance?.method === 'targeted_cv' && !geometry.warnings.length && !geometry.assistance.length &&
      !geometry.uncertainty.regions.length && !geometry.topology.junctions.length && !!Targeted?.validate(geometry)
    const Draft = options.editableDraft === true && (typeof module !== 'undefined' && module.exports ? require('./star-editable-draft.js') : root.StarEditableDraft)
    const cvDraft = options.editableDraft === true && config.assistedPhotoGeometry === true && geometry.status === 'needs_review' &&
      geometry.provenance?.method === 'cv_editable_draft' && !geometry.warnings.length && !geometry.assistance.length && !geometry.uncertainty.regions.length && !geometry.topology.junctions.length && !!Draft?.validate(geometry)
    if (geometry.provenance?.method === 'targeted_cv' && !targeted) throw new Error('Endpoint-guided CV requires a current reviewed proposal; it is not automatic recognition.')
    if (['hybrid_development', 'hybrid_semantic'].includes(geometry.provenance?.method) && !hybrid) throw new Error('Hybrid geometry requires its experimental gate and reviewed provenance; it is not automatic recognition.')
    if (geometry.provenance?.method === 'cv_editable_draft' && !cvDraft) throw new Error('The CV-assisted draft requires its explicit editable-draft gate and current measured provenance.')
    if ((!assisted && !cvAssisted && !hybrid && !targeted && !cvDraft && geometry.status !== 'automatic') || geometry.calibration.status !== 'calibrated') throw new Error('Recognition needs correction before native import. Pixel geometry has been retained.')
    if (geometry.points?.length && !cvAssisted && !hybrid && !targeted) throw new Error('Isolated dots require a reviewed CV-assisted proposal; they cannot be silently dropped.')
    const editableDraft = options.editableDraft === true
    const tool = editableDraft ? receivingDraftTool(config) : receivingTool(config, toolId)
    if (!state || !state.data || Array.isArray(state.data) || !Array.isArray(state.data[tool.id])) throw new Error('Invalid existing native tool state.')
    const drawings = geometry.strokes.map(s => {
      if (s.closed) throw new Error('Closed strokes require a different question input contract.')
      const points = s.vertices.map(v => graphToNative(config, v.graph))
      const violations = functionViolations(s, config)
      if (violations.length && !editableDraft) {
        const error = new Error('A stroke doubles back in x. This function-input question requires correction. No curve was imported.')
        error.code = 'function_x_backtrack'; error.segments = clone(violations); throw error
      }
      const buffer = config.enforceBounds ? (config.safetyBuffer || 0) : 0
      if (points.some(p => p.x < buffer || p.y < buffer || p.x > config.width - buffer || p.y > config.height - buffer)) throw new Error('The photographed geometry exceeds this canvas range. It was not clipped or rescaled.')
      return encode(points, tool.name)
    })
    const existing = state.data[tool.id]
    if (tool.limit > 0 && existing.length + drawings.length > tool.limit) throw new Error('Import would exceed this tool’s drawing limit.')
    // Keep the default function-input overlap restriction. The separately
    // opted-in manual question saves overlapping attempts as mathematical
    // mistakes. Never delete earlier drawings to make an import fit.
    const ranges = existing.concat(drawings).filter(p => p.length).map(ps => {
      if (!Array.isArray(ps) || ps.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new Error('Existing curve contains invalid coordinates.')
      return [Math.min(...ps.map(p => p.x)), Math.max(...ps.map(p => p.x))]
    }).sort((a, b) => a[0] - b[0])
    for (let i = 0; i < ranges.length; i++) for (let j = i + 1; j < ranges.length; j++) {
      if (!assisted && !cvAssisted && !hybrid && !targeted && !editableDraft && Math.min(ranges[i][1], ranges[j][1]) - Math.max(ranges[i][0], ranges[j][0]) > 5) throw new Error('Graphs overlap in x. Move or delete the conflicting native drawing, or correct the proposal, before importing.')
    }
    let pointToolId = null; const points = []
    if (geometry.points?.length) {
      const eligible = tools(config).filter(t => t.name === 'point' && !t.readonly && !t.helper && !t.overlay && t.hollow !== true)
      const pointTool = options.pointToolId ? eligible.find(t => t.id === options.pointToolId) : eligible.length === 1 ? eligible[0] : null
      if (!pointTool || !Array.isArray(state.data[pointTool.id])) throw new Error('This question needs one editable filled-point tool to preserve the selected dots.')
      if (pointTool.limit > 0 && state.data[pointTool.id].length + geometry.points.length > pointTool.limit) throw new Error('Import would exceed the point tool limit.')
      pointToolId = pointTool.id
      for (const point of geometry.points) {
        const p = graphToNative(config, point.graph); const buffer = config.enforceBounds ? (config.safetyBuffer || 0) : 0
        if (p.x < buffer || p.y < buffer || p.x > config.width - buffer || p.y > config.height - buffer) throw new Error('A selected dot exceeds the native canvas range. It was not clipped or moved.')
        points.push(p)
      }
    }
    return { toolId: tool.id, kind: tool.name, drawings, strokeIds: geometry.strokes.map(s => s.id), pointToolId, points,
      ...(editableDraft ? { reviewIssues: geometry.strokes.flatMap(s => functionViolations(s, config)) } : {}) }
  }
  function createSession (si, config, toolId, options = {}) {
    let revision = 0; let serial = 0; let active = null
    function invalidate (nextRevision = revision) {
      if (!Number.isSafeInteger(nextRevision) || nextRevision < revision) throw new Error('Input revisions must be monotonic.')
      revision = nextRevision; active = null
    }
    function propose (geometry) {
      active = null
      if (geometry.input_revision !== revision) throw new Error('Recognition belongs to an older input revision.')
      const base = JSON.parse(si.getState())
      const prepared = prepare(clone(geometry), config, toolId, base, options)
      active = { ...prepared, token: ++serial, revision, base: clone(base.data) }
      return clone({ ...prepared, token: active.token, revision })
    }
    function commit (token, confirmed = false) {
      if (!active || active.token !== token || active.revision !== revision || confirmed !== true) throw new Error('A current proposal must be explicitly confirmed.')
      const proposal = active; active = null // one attempt; rejected/stale tokens cannot be reused
      const before = JSON.parse(si.getState())
      if (!same(before.data, proposal.base)) throw new Error('The native canvas changed after review. Analyze and review again.')
      const prior = clone(before.data[proposal.toolId]); const next = prior.concat(clone(proposal.drawings))
      const patch = { [proposal.toolId]: next }
      if (proposal.points.length) patch[proposal.pointToolId] = clone(before.data[proposal.pointToolId]).concat(clone(proposal.points))
      try {
        // setState accepts partial data: other tools, toolbar, and history are
        // not rewritten. Existing objects under the receiving tool are appended.
        si.setState(JSON.stringify({ data: patch }))
        const after = JSON.parse(si.getState())
        if (!same(after.data, { ...before.data, ...patch })) throw new Error('Native state did not retain the proposed geometry or unrelated objects.')
      } catch (error) {
        try {
          si.setState(JSON.stringify(before))
          if (!same(JSON.parse(si.getState()).data, before.data)) throw new Error('State differs after rollback.')
        } catch (rollbackError) { throw new Error('Import failed and native rollback could not be verified: ' + rollbackError.message) }
        throw new Error('Import failed; the previous drawing was restored. ' + error.message)
      }
      return { toolId: proposal.toolId, kind: proposal.kind, inputRevision: revision, strokeCount: proposal.drawings.length,
        firstObjectIndex: prior.length, strokeIds: proposal.strokeIds, pointCount: proposal.points.length }
    }
    return { invalidate, propose, commit }
  }
  const api = { receivingTool, receivingDraftTool, graphToNative, encode, pathData, functionViolations, prepare, createSession }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.StarNative = api
})(typeof window !== 'undefined' ? window : globalThis)
