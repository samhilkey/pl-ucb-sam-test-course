const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')
const CV = require('../elements/pl-sketch/star-recognition.js')
const Assisted = require('../elements/pl-sketch/star-cv-assisted.js')
const Geometry = require('../elements/pl-sketch/star-geometry.js')
const Native = require('../elements/pl-sketch/star-native.js')
const { read } = require('./helpers/png.cjs')
const fixtures = path.resolve(__dirname, '../benchmarks/photo-graphs/automatic-cv/experiment-01/inputs')
const config = { assistedPhotoGeometry: true, width: 800, height: 600, xrange: [-10, 10], yrange: [-6, 6], plugins: [{ id: 'ink', name: 'freeform' }, { id: 'dots', name: 'point' }] }
function args (id = 'unknown-scale') {
  const source = CV.recognize(read(path.join(fixtures, id + '.png'))).geometry
  return { source, photoSha256: 'a'.repeat(64), axisValues: { origin: [270, 300], xMarker: [350, 300], yMarker: [270, 220], xValue: 2, yValue: 2, confirmed: true },
    strokeDecisions: Object.fromEntries(source.strokes.map(s => [s.id, 'keep'])), markDecisions: Object.fromEntries(Assisted.marks(source).map(m => [m.id, 'exclude'])), reviewed: true, inputRevision: 7 }
}
function canvas (fail = false) {
  let data = { ink: [Native.encode([{ x: 760, y: 540 }, { x: 775, y: 550 }], 'freeform')], dots: [{ x: 30, y: 40 }], unrelated: [{ value: 1 }] }; let writes = 0
  return { getState: () => JSON.stringify({ data }), setState: value => { writes++; Object.assign(data, JSON.parse(value).data); if (fail && writes === 1) { data.dots[0].x = -10; throw new Error('Injected atomic failure') } }, value: () => data, writes: () => writes }
}
test('CV-assisted calibration reuses every source vertex without tracing or automatic status', () => {
  const a = args(); const original = structuredClone(a.source); const g = Assisted.fromSelection(a)
  assert.equal(g.status, 'needs_review'); assert.equal(g.provenance.method, 'cv_assisted'); assert.equal(g.provenance.automatically_recognized, false)
  assert.deepEqual(g.strokes[0].vertices.map(v => v.pixel), a.source.strokes[0].vertices.map(v => v.pixel))
  assert.deepEqual(a.source, original); assert.equal(Assisted.validate(g), g); assert.equal(Geometry.validate(g), g)
  assert.deepEqual(g.calibration.x_unit_vector_pixel, [40, 0]); assert.deepEqual(g.calibration.y_unit_vector_pixel, [0, -40])
})
test('all calibration, line, mark and geometry review gates are required', () => {
  const a = args()
  for (const changed of [{ reviewed: false }, { axisValues: { ...a.axisValues, confirmed: false } }, { axisValues: { ...a.axisValues, xValue: 0 } },
    { axisValues: { ...a.axisValues, yMarker: [310, 300] } }, { strokeDecisions: {} }, { markDecisions: {} }]) assert.throws(() => Assisted.fromSelection({ ...a, ...changed }))
  const none = { ...a, strokeDecisions: Object.fromEntries(a.source.strokes.map(s => [s.id, 'exclude'])) }
  assert.throws(() => Assisted.fromSelection(none), /Keep at least/)
})
test('native import requires explicit CV-assisted opt-in and rejects modified pixel/provenance data', () => {
  const g = Assisted.fromSelection(args()); const si = canvas()
  assert.throws(() => Native.prepare(g, config, 'ink', { data: si.value() }), /needs correction/)
  assert.throws(() => Native.prepare(g, { ...config, assistedPhotoGeometry: false }, 'ink', { data: si.value() }, { cvAssisted: true }), /needs correction/)
  const modified = structuredClone(g); modified.strokes[0].vertices[0].pixel[0] += 1
  modified.strokes[0].vertices[0].graph = Geometry.pixelToGraph(modified.strokes[0].vertices[0].pixel, modified.coordinate_frame, modified.calibration)
  assert.throws(() => Native.prepare(modified, config, 'ink', { data: si.value() }, { cvAssisted: true }), /changed after review/)
  const pending = structuredClone(g); pending.provenance.review.reviewed = false
  assert.throws(() => Native.prepare(pending, config, 'ink', { data: si.value() }, { cvAssisted: true }))
})
test('reviewed dots and curves append atomically, preserving all existing native objects', () => {
  const a = args(); a.markDecisions['mark-1'] = 'point'; const g = Assisted.fromSelection(a)
  const si = canvas(); const before = structuredClone(si.value()); const session = Native.createSession(si, config, 'ink', { cvAssisted: true }); session.invalidate(7)
  const p = session.propose(g); assert.equal(si.writes(), 0); assert.throws(() => session.commit(p.token), /explicitly confirmed/)
  session.commit(p.token, true)
  assert.equal(si.value().ink.length, 2); assert.equal(si.value().dots.length, 2); assert.deepEqual(si.value().ink[0], before.ink[0]); assert.deepEqual(si.value().dots[0], before.dots[0]); assert.deepEqual(si.value().unrelated, before.unrelated)
  assert.deepEqual(si.value().dots[1], Native.graphToNative(config, g.points[0].graph)); assert.equal(si.writes(), 1)
  assert.throws(() => session.commit(p.token, true), /current proposal/)
})
test('missing/readonly/ambiguous/limited point tools block instead of dropping dots', () => {
  const a = args(); a.markDecisions['mark-1'] = 'point'; const g = Assisted.fromSelection(a); const state = { data: canvas().value() }
  for (const plugins of [[{ id: 'ink', name: 'freeform' }], [{ id: 'ink', name: 'freeform' }, { id: 'dots', name: 'point', readonly: true }],
    [{ id: 'ink', name: 'freeform' }, { id: 'dots', name: 'point', limit: 1 }], [{ id: 'ink', name: 'freeform' }, { id: 'dots', name: 'point' }, { id: 'dots2', name: 'point' }]]) {
    assert.throws(() => Native.prepare(g, { ...config, plugins }, 'ink', state, { cvAssisted: true }), /point tool|point tool limit/)
  }
})
test('native change/revision invalidates CV-assisted proposals; partial failure rolls both tools back', () => {
  const a = args(); a.markDecisions['mark-1'] = 'point'; const g = Assisted.fromSelection(a); const si = canvas(); const session = Native.createSession(si, config, 'ink', { cvAssisted: true }); session.invalidate(7)
  const p = session.propose(g); si.value().dots.push({ x: 1, y: 2 }); assert.throws(() => session.commit(p.token, true), /canvas changed/)
  const p2 = session.propose(g); session.invalidate(8); assert.throws(() => session.commit(p2.token, true))
  const failing = canvas(true); const before = structuredClone(failing.value()); const s = Native.createSession(failing, config, 'ink', { cvAssisted: true }); s.invalidate(7); const q = s.propose(g)
  assert.throws(() => s.commit(q.token, true), /previous drawing was restored/); assert.deepEqual(failing.value(), before)
})
test('branch junction ambiguity and unknown warning types remain blocked', () => {
  const a = args('touching-junction'); assert.throws(() => Assisted.fromSelection(a), /crossing/)
  const b = args(); b.source.warnings.push({ code: 'unhandled', message: 'Unresolved observation' }); assert.throws(() => Assisted.fromSelection(b), /unsupported uncertainty/)
})
test('disconnected detected branches stay separate and original corners/endpoints survive', () => {
  const a = args('two-branches'); const g = Assisted.fromSelection(a)
  assert.equal(g.strokes.length, 2); assert.equal(g.topology.component_count, 2)
  for (const s of g.strokes) { assert.equal(s.vertices.filter(v => v.endpoint).length, 2); assert.equal(s.source_stroke_ids.length, 1) }
  const v = Assisted.fromSelection(args('sharp-v')); assert.ok(v.strokes[0].vertices.some(p => p.corner))
})
test('real photo uses exactly selected CV segments, joins only their shared endpoints and preserves the dot', () => {
  const file = path.resolve(__dirname, '../benchmarks/photo-graphs/multi-method/step-4g-1/results/IMG_1670--source.png')
  const source = CV.recognize(read(file)).geometry
  const a = { source, photoSha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), inputRevision: 8, reviewed: true,
    axisValues: { origin: [782, 786], xMarker: [1229, 775], yMarker: [751, 300], xValue: 3, yValue: 3, confirmed: true },
    strokeDecisions: Object.fromEntries(source.strokes.map(s => [s.id, ['stroke-10', 'stroke-11', 'stroke-12'].includes(s.id) ? 'keep' : 'exclude'])),
    markDecisions: Object.fromEntries(Assisted.marks(source).map(m => [m.id, m.id === 'mark-1' ? 'point' : 'exclude'])) }
  const g = Assisted.fromSelection(a); assert.equal(g.strokes.length, 1); assert.equal(g.points.length, 1)
  const kept = source.strokes.filter(s => a.strokeDecisions[s.id] === 'keep').flatMap(s => s.vertices.map(v => JSON.stringify(v.pixel)))
  assert.ok(g.strokes[0].vertices.every(v => kept.includes(JSON.stringify(v.pixel))))
  for (const p of kept) assert.ok(g.strokes[0].vertices.some(v => JSON.stringify(v.pixel) === p))
  assert.ok(Math.hypot(g.points[0].pixel[0] - 821, g.points[0].pixel[1] - 294) < 5)
  const cfg = require('../benchmarks/photo-graphs/multi-method/step-4g-1/results/recovery.json').imported.state.meta.config
  const prepared = Native.prepare(g, cfg, 'auto-ink', { data: { 'auto-ink': [], 'auto-notes': [] } }, { cvAssisted: true })
  assert.equal(prepared.drawings.length, 1); assert.equal(prepared.points.length, 1)
})
test('x and y calibration are independent and invalid native ranges remain blocked', () => {
  const a = args(); a.axisValues.xValue = 4; const g = Assisted.fromSelection(a)
  assert.deepEqual(g.calibration.x_unit_vector_pixel, [20, 0]); assert.deepEqual(g.calibration.y_unit_vector_pixel, [0, -40])
  a.axisValues.xValue = 1000
  assert.throws(() => Native.prepare(Assisted.fromSelection(a), config, 'ink', { data: canvas().value() }, { cvAssisted: true }), /exceeds this canvas range/)
})
test('isolated-point schema rejects inconsistent coordinates, duplicate IDs and automatic claims', () => {
  const a = args(); a.markDecisions['mark-1'] = 'point'; const g = Assisted.fromSelection(a)
  const mismatch = structuredClone(g); mismatch.points[0].graph[0] += 1; assert.throws(() => Geometry.validate(mismatch), /isolated point coordinate/)
  const duplicate = structuredClone(g); duplicate.points[0].id = duplicate.strokes[0].id; assert.throws(() => Geometry.validate(duplicate), /isolated point structure/)
  const automatic = structuredClone(g); automatic.status = 'automatic'; assert.throws(() => Geometry.validate(automatic), /unreviewed automatic points/)
})
