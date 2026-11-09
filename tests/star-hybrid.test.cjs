const { test } = require('node:test'); const assert = require('node:assert/strict')
const H = require('../elements/pl-sketch/star-hybrid.js'); const CV = require('../elements/pl-sketch/star-recognition.js'); const Native = require('../elements/pl-sketch/star-native.js'); const PNG = require('./helpers/png.cjs')
const cases = require('../benchmarks/photo-graphs/multi-method/step-4h/fixtures.cjs').prepare()
const observe = id => { const c = cases.find(c => c.id === id); return { c, source: CV.recognize(PNG.read(c.image)).geometry } }
const config = { width: 800, height: 600, xrange: [-5, 7], yrange: [-4, 6], assistedPhotoGeometry: true, experimentalHybridGeometry: true, plugins: [{ id: 'ink', name: 'freeform' }, { id: 'dots', name: 'point' }] }
function canvas () { let state = { data: { ink: [], dots: [{ x: 750, y: 540 }] } }; return { getState: () => JSON.stringify(state), setState: s => { state = { ...state, data: { ...state.data, ...JSON.parse(s).data } } } } }
test('controlled measured centerlines become explicitly reviewed hybrid native data, never automatic', () => {
  for (const id of ['matching-answer-controlled', 'sharp-v', 'two-branches-dot-controlled']) {
    const { c, source } = observe(id); const result = H.inspect(source, c.envelope); assert.equal(result.importable_after_explicit_review, true)
    const g = H.reviewed(source, c.envelope, { confirmed: true }); assert.equal(g.status, 'needs_review'); assert.equal(g.provenance.automatically_recognized, false); H.validate(g)
    const selected = source.strokes.filter(s => result.strokeDecisions[s.id] === 'keep').flatMap(s => s.vertices.map(v => v.pixel))
    for (const s of g.strokes) for (const v of s.vertices) assert.ok(selected.some(p => JSON.stringify(p) === JSON.stringify(v.pixel)))
    const si = canvas(); const session = Native.createSession(si, config, undefined, { hybrid: true }); const p = session.propose(g); session.commit(p.token, true)
    assert.equal(JSON.parse(si.getState()).data.ink.length, c.semantics.branch_count); assert.equal(JSON.parse(si.getState()).data.dots.length, 1 + c.semantics.isolated_points.length)
  }
})
test('real photo remains blocked with coarse human semantics; measured dot does not cure missing calibration/topology', () => {
  const { c, source } = observe('IMG_1670'); const r = H.inspect(source, c.envelope)
  assert.equal(r.importable_after_explicit_review, false); assert.ok(r.blockers.some(b => b.code === 'calibration_missing')); assert.ok(r.blockers.some(b => b.code === 'ambiguous_stroke'))
  assert.equal(r.measured_points.length, 1); assert.throws(() => H.reviewed(source, c.envelope, { confirmed: true }), /blocked/)
})
test('uncertain, extra, dense-curve or out-of-bounds semantic fields fail closed', () => {
  const { c, source } = observe('sharp-v')
  for (const change of [s => { s.expected_equation = 'anything' }, s => { s.branches[0].vertices = [[1, 2]] }, s => { s.origin.region[0] = -1 }, s => { s.axes.x.ticks[0].answer = 7 }]) {
    const e = structuredClone(c.envelope); change(e.semantics); assert.throws(() => H.inspect(source, e), /Invalid coarse/)
  }
  const e = structuredClone(c.envelope); e.semantics.branch_count = null; assert.equal(H.inspect(source, e).importable_after_explicit_review, false)
})
test('semantics cannot invent a branch, filled dot, endpoint, corner, numeric scale or positive direction', () => {
  const { c, source } = observe('sharp-v')
  for (const change of [s => { s.axes.x.ticks[0].value = 9 }, s => { s.axes.y.positive_direction = 'down' }, s => { s.axes.x.region = [0, 0, 10, 10] }, s => { s.origin.region = [0, 0, 10, 10] }, s => { s.branches[0].endpoint_regions[0] = [0, 0, 10, 10] }, s => { s.branches[0].corner_regions[0] = [0, 0, 10, 10] }, s => { s.branches.push({ ...s.branches[0], id: 'invented' }); s.branch_count++ }, s => { s.isolated_points.push({ id: 'invented-dot', region: [0, 0, 20, 20], filled: true, uncertain: false }) }]) {
    const e = structuredClone(c.envelope); change(e.semantics); assert.equal(H.inspect(source, e).importable_after_explicit_review, false)
  }
})
test('overlapping point/exclusion regions and unsupported CV warnings cannot be imported', () => {
  const { c, source } = observe('two-branches-dot-controlled'); const e = structuredClone(c.envelope)
  e.semantics.non_graph_regions.push({ kind: 'noise', region: e.semantics.isolated_points[0].region })
  const r = H.inspect(source, e); assert.equal(r.measured_points.length, 1); assert.equal(r.importable_after_explicit_review, false); assert.ok(r.blockers.some(b => b.code === 'ambiguous_small_mark'))
  const raw = structuredClone(source); raw.status = 'needs_review'; raw.warnings.push({ code: 'unknown_future_warning', message: 'Do not discard this.' }); assert.equal(H.inspect(raw, c.envelope).importable_after_explicit_review, false)
})
test('no model transport, fixture substitution, revision relabeling or unconfirmed import', () => {
  const { c, source } = observe('sharp-v')
  assert.throws(() => H.inspect(source, { ...c.envelope, kind: 'gemini_response', model: 'gemini-3.5-flash-lite' }), /Only a matching/)
  assert.throws(() => H.inspect(source, { ...c.envelope, width: 10 }), /Only a matching/)
  assert.throws(() => H.reviewed(source, c.envelope, { confirmed: false }), /explicitly confirm/)
  assert.throws(() => H.reviewed(source, c.envelope, { confirmed: true }, 1), /stale/)
})
test('hybrid native import requires both opt-ins, exact reviewed provenance and the existing stale/one-use guards', () => {
  const { c, source } = observe('two-branches-dot-controlled'); const g = H.reviewed(source, c.envelope, { confirmed: true }); const si = canvas()
  for (const [cfg, opts] of [[config, {}], [{ ...config, experimentalHybridGeometry: false }, { hybrid: true }], [{ ...config, assistedPhotoGeometry: false }, { hybrid: true }]]) assert.throws(() => Native.createSession(si, cfg, undefined, opts).propose(g), /experimental gate/)
  const fake = structuredClone(g); fake.provenance.semantic_envelope.semantics.isolated_points[0].filled = false; assert.throws(() => Native.prepare(fake, config, undefined, JSON.parse(si.getState()), { hybrid: true }))
  const mislabeled = structuredClone(g); mislabeled.points = []; mislabeled.status = 'automatic'; assert.throws(() => Native.prepare(mislabeled, config, undefined, JSON.parse(si.getState()), { hybrid: true }), /not automatic/)
  const session = Native.createSession(si, config, undefined, { hybrid: true }); const p = session.propose(g); si.setState(JSON.stringify({ data: { dots: [{ x: 3, y: 4 }] } })); assert.throws(() => session.commit(p.token, true), /canvas changed/); assert.throws(() => session.commit(p.token, true), /current proposal/)
  const altered = structuredClone(g); altered.strokes[0].vertices[1].corner = !altered.strokes[0].vertices[1].corner; assert.throws(() => Native.prepare(altered, config, undefined, JSON.parse(si.getState()), { hybrid: true }), /changed after review/)
})
