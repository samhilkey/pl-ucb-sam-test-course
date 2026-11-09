/* Experimental native spline/polyline import; H4's original adapter is reused. */
;(function (root) {
  'use strict'
  const Native = typeof module !== 'undefined' && module.exports ? require('./star-native.js') : root.StarNative
  const Fit = typeof module !== 'undefined' && module.exports ? require('./star-adaptive-geometry.js') : root.StarAdaptiveGeometry
  const clone = x => JSON.parse(JSON.stringify(x)); const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  function tool (config) {
    const t = (config.plugins || []).find(t => t.id === config.adaptivePhotoSplineTool && t.name === 'spline' && !t.readonly && !t.helper && !t.overlay)
    if (!t || config.readonly) throw new Error('Adaptive fitting needs its opted-in, graded native spline tool.')
    return t
  }
  const compact = data => Object.fromEntries(Object.entries(data).filter(([k]) => !k.startsWith('$__')).map(([k, v]) => [k, Array.isArray(v) ? v.filter(x => !Array.isArray(x) || x.length) : v]))
  function createSession (si, config) {
    const splineTool = tool(config); const polyTool = Native.receivingDraftTool(config)
    let revision = 0; let serial = 0; let active = null; let owned = null; let committed = null; let mode = 'auto'
    function invalidate (next = revision) { if (!Number.isSafeInteger(next) || next < revision) throw new Error('Input revisions must be monotonic.'); revision = next; active = null }
    function setMode (value) { if (!['auto', 'smooth', 'original'].includes(value)) throw new Error('Unknown representation.'); mode = value; active = null }
    function resetOwnership () { active = owned = committed = null }
    function propose (g) {
      active = null
      if (g.input_revision !== revision) throw new Error('The adaptive geometry belongs to an older photo.')
      const provenance = g.provenance?.method
      const sourceOptions = provenance === 'manual_trace' ? { assisted: true } : provenance === 'targeted_cv' ? { targeted: true } : provenance === 'cv_assisted' ? { cvAssisted: true } : ['hybrid_development', 'hybrid_semantic'].includes(provenance) ? { hybrid: true } : {}
      const base = JSON.parse(si.getState()); const baseline = Native.prepare(g, config, undefined, base, { editableDraft: true, ...sourceOptions })
      const plan = Fit.plan(g, config, mode); const additions = { [polyTool.id]: [], [splineTool.id]: [] }
      for (const p of plan.parts) additions[p.kind === 'spline' ? splineTool.id : polyTool.id].push(clone(p.points))
      const patch = {}; const replacing = !!owned
      if (replacing && !same(compact(base.data), committed)) throw new Error('This draft or another drawing has been edited. Representation replacement is blocked; your work is retained.')
      for (const id of [polyTool.id, splineTool.id]) {
        if (!Array.isArray(base.data[id])) throw new Error('Corrupt existing native tool state.')
        const prior = replacing ? clone(owned.base[id]) : clone(base.data[id])
        patch[id] = prior.concat(additions[id])
        if (patch[id].length >= 100) throw new Error('Too many native objects for this bounded experiment.')
      }
      if (baseline.points.length) patch[baseline.pointToolId] = clone(replacing ? owned.base[baseline.pointToolId] : base.data[baseline.pointToolId]).concat(baseline.points)
      const previewPaths = plan.parts.map(p => p.kind === 'spline' ? Fit.samples(Fit.controls(p.points), 1).map(v => [v.x, v.y]) : p.points.map(v => [v.x, v.y]))
      active = { token: ++serial, base: clone(base.data), patch, revision, plan, replacing, previousBase: replacing ? clone(owned.base) : { [polyTool.id]: clone(base.data[polyTool.id]), [splineTool.id]: clone(base.data[splineTool.id]), ...(baseline.points.length ? { [baseline.pointToolId]: clone(base.data[baseline.pointToolId]) } : {}) } }
      return clone({ token: active.token, revision, plan, previewPaths, replacing, kind: 'adaptive', summary: plan.spline_count ? `${plan.handle_count} handles; smooth sections with original corners and turns` : `${plan.handle_count} handles; original trace is safer for this ink` })
    }
    function commit (token, confirmed) {
      if (!active || active.token !== token || active.revision !== revision || confirmed !== true) throw new Error('A current adaptive proposal must be explicitly accepted.')
      const p = active; active = null; const before = JSON.parse(si.getState())
      if (!same(before.data, p.base)) throw new Error('The native canvas changed after review. Prepare the representation again.')
      try {
        si.setState(JSON.stringify({ data: p.patch }))
        if (!same(JSON.parse(si.getState()).data, { ...before.data, ...p.patch })) throw new Error('Native tools did not retain the prepared representation.')
      } catch (e) { si.setState(JSON.stringify(before)); if (!same(JSON.parse(si.getState()).data, before.data)) throw new Error('Native rollback could not be verified.'); throw e }
      owned = { base: p.previousBase }; committed = compact(JSON.parse(si.getState()).data)
      return { kind: 'adaptive', inputRevision: revision, sourceBranchCount: p.plan.analyses.length, splineCount: p.plan.spline_count, polylineCount: p.plan.polyline_count, handleCount: p.plan.handle_count, mode: p.plan.mode, replacing: p.replacing }
    }
    return { invalidate, propose, commit, setMode, resetOwnership }
  }
  function installGrading (si, config) {
    if (config.readonly) return
    const id = tool(config).id; const original = si.getGradeable.bind(si)
    si.getGradeable = () => {
      const before = JSON.parse(si.getState()).data[id]; const output = JSON.parse(original()); const after = JSON.parse(si.getState()).data[id]
      const exact = after.map((ps, i) => ps.length >= 2 && before[i]?.length === ps.length ? before[i] : ps)
      if (!same(after, exact)) si.setState(JSON.stringify({ data: { [id]: exact } }))
      output.data[id] = exact.filter(ps => ps.length >= 2).map(ps => ({ spline: Fit.controls(ps).map(p => [p.x, p.y]) }))
      return JSON.stringify(output)
    }
  }
  const api = { createSession, installGrading }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.StarAdaptiveNative = api
})(typeof window !== 'undefined' ? window : globalThis)
