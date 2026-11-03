const { test } = require('node:test')
const assert = require('node:assert/strict')
const Native = require('../elements/pl-sketch/star-native.js')
const geometry = require('../benchmarks/photo-graphs/automatic-cv/experiment-01/results/two-branches.geometry.json')
const uncertain = require('../benchmarks/photo-graphs/automatic-cv/experiment-01/results/ambiguous-axes.geometry.json')
const config = { width: 800, height: 600, xrange: [-5.2, 7.2], yrange: [-4.2, 6.2], xscale: 'linear', yscale: 'linear', plugins: [{ name: 'freeform', id: 'ink' }, { name: 'point', id: 'other' }] }
const initial = { apiVersion: '0.1', meta: { preserved: true }, data: { ink: [], other: [{ x: 7, y: 8 }], $__toolbar: { selected: 'other' }, $__history: { undoStack: [{ previous: 1 }], redoStack: [] } } }
function canvas (state = initial, failing = false) {
  let value = structuredClone(state); let writes = 0
  return { getState: () => JSON.stringify(value), setState: s => {
    writes++; const parsed = JSON.parse(s); Object.assign(value.data, parsed.data)
    if (failing && writes === 1) { value.data.other[0].x = 100; throw new Error('Injected native write failure') }
  }, value: () => value, writes: () => writes }
}
function reviewed (g = geometry, si = canvas(), cfg = config) {
  const session = Native.createSession(si, cfg); session.invalidate(g.input_revision)
  return { si, session, proposal: session.propose(g) }
}
test('coordinate mapping uses padded ranges once, y inversion, and unequal scales', () => {
  assert.deepEqual(Native.graphToNative({ width: 800, height: 400, xrange: [-2, 6], yrange: [-3, 7] }, [0, 0]), { x: 200, y: 280 })
  assert.throws(() => Native.graphToNative({ ...config, xscale: 'log' }, [1, 1]))
})
test('freeform uses exact straight cubic segments and retains every vertex', () => {
  const points = [{ x: 10, y: 50 }, { x: 30, y: 10 }, { x: 60, y: 60 }]
  const c = Native.encode(points, 'freeform')
  assert.equal(c.length, 7); assert.deepEqual([c[0], c[3], c[6]], points)
  for (let i = 1; i < 3; i++) assert.ok(Math.abs((c[i].x - 10) * -40 - (c[i].y - 50) * 20) < 1e-10)
  assert.equal(Native.pathData(c).split('C').length, 2)
  assert.deepEqual(Native.encode(points, 'polyline'), points); assert.deepEqual(Native.encode(points, 'spline'), points)
})
test('review is read-only and confirmation appends both branches without changing other state', () => {
  const r = reviewed(); assert.equal(r.si.writes(), 0)
  const receipt = r.session.commit(r.proposal.token, true)
  assert.equal(receipt.strokeCount, 2); assert.equal(r.si.writes(), 1)
  assert.deepEqual({ ...r.si.value(), data: { ...r.si.value().data, ink: [] } }, initial)
  assert.equal(r.si.value().data.ink.length, 2)
  assert.throws(() => r.session.commit(r.proposal.token, true), /current proposal/)
})
test('unrelated existing objects under the same receiving tool survive import', () => {
  const prior = Native.encode([{ x: 760, y: 480 }, { x: 775, y: 490 }], 'freeform')
  const si = canvas({ ...initial, data: { ...initial.data, ink: [prior] } }); const r = reviewed(geometry, si)
  r.session.commit(r.proposal.token, true)
  assert.deepEqual(si.value().data.ink[0], prior); assert.equal(si.value().data.ink.length, 3)
})
test('caller mutation cannot alter reviewed drawings before confirmation', () => {
  const r = reviewed(); const expected = structuredClone(r.proposal.drawings)
  r.proposal.drawings[0][0].x = -999
  r.session.commit(r.proposal.token, true)
  assert.deepEqual(r.si.value().data.ink, expected)
})
test('the five-path ambiguous result cannot be proposed or committed', () => {
  const si = canvas(); const session = Native.createSession(si, config)
  assert.equal(uncertain.strokes.length, 5)
  assert.throws(() => session.propose(uncertain), /needs correction/)
  assert.throws(() => session.commit(1, true)); assert.equal(si.writes(), 0); assert.deepEqual(si.value(), initial)
})
test('explicit confirmation is mandatory', () => {
  const r = reviewed(); assert.throws(() => r.session.commit(r.proposal.token), /explicitly confirmed/)
  assert.equal(r.si.writes(), 0)
})
test('new input revision, rejection, or a newer proposal invalidates the old token', () => {
  const r = reviewed(); r.session.invalidate(1)
  assert.throws(() => r.session.commit(r.proposal.token, true)); assert.throws(() => r.session.propose(geometry), /older input/)
  const g = structuredClone(geometry); g.input_revision = 1
  const a = r.session.propose(g); const b = r.session.propose(g)
  assert.throws(() => r.session.commit(a.token, true)); r.session.invalidate(2)
  assert.throws(() => r.session.commit(b.token, true)); assert.equal(r.si.writes(), 0)
})
test('native edits after review invalidate confirmation without overwriting edits', () => {
  const r = reviewed(); r.si.value().data.other.push({ x: 3, y: 4 })
  assert.throws(() => r.session.commit(r.proposal.token, true), /canvas changed/)
  assert.equal(r.si.writes(), 0); assert.equal(r.si.value().data.other.length, 2)
})
test('native setter failure rolls back all existing tool data and metadata', () => {
  const si = canvas(initial, true); const r = reviewed(geometry, si)
  assert.throws(() => r.session.commit(r.proposal.token, true), /previous drawing was restored/)
  assert.deepEqual(si.value(), initial); assert.equal(si.writes(), 2)
  assert.throws(() => r.session.commit(r.proposal.token, true))
})
test('failure to verify rollback is reported explicitly', () => {
  const si = { getState: () => JSON.stringify(initial), setState: () => { throw new Error('unavailable') } }
  const r = reviewed(geometry, si); assert.throws(() => r.session.commit(r.proposal.token, true), /rollback could not be verified/)
})
test('invalid later branch, bad calibration, and out-of-range geometry leave state untouched', () => {
  for (const mutate of [g => { g.strokes[1].vertices[0].pixel[0] = NaN }, g => { g.calibration.status = 'uncertain' }]) {
    const si = canvas(); const g = structuredClone(geometry); mutate(g)
    assert.throws(() => Native.createSession(si, config).propose(g)); assert.equal(si.writes(), 0)
  }
  assert.throws(() => reviewed(geometry, canvas(), { ...config, xrange: [-1, 1] }), /exceeds this canvas/)
})
test('overlapping native drawings, readonly/helper targets, and limits block import', () => {
  const prior = Native.encode([{ x: 20, y: 30 }, { x: 790, y: 50 }], 'freeform')
  assert.throws(() => reviewed(geometry, canvas({ ...initial, data: { ...initial.data, ink: [prior] } })), /overlap/)
  for (const flags of [{ readonly: true }, { helper: true }, { overlay: true }]) assert.throws(() => reviewed(geometry, canvas(), { ...config, plugins: [{ name: 'freeform', id: 'ink', ...flags }] }), /editable free-draw/)
  assert.throws(() => reviewed(geometry, canvas(), { ...config, plugins: [{ name: 'freeform', id: 'ink', limit: 1 }] }), /drawing limit/)
})
test('spline-only questions fail clearly and grouped freeform tools are supported', () => {
  assert.throws(() => reviewed(geometry, canvas(), { ...config, plugins: [{ name: 'spline', id: 'ink' }] }), /editable free-draw/)
  assert.equal(Native.receivingTool({ ...config, plugins: [{ name: 'group', plugins: [{ name: 'freeform', id: 'grouped' }] }] }).id, 'grouped')
})
test('the assisted fit bridge also encodes freeform controls without changing spline transfer', () => {
  const { placeCurves } = require('../elements/pl-sketch/star-fit.js')
  const si = canvas()
  placeCurves(si, config, 'ink', [[[0, 1], [1, 2], [2, 1]]])
  assert.equal(si.value().data.ink[0].length, 7)
  assert.deepEqual(si.value().data.ink[0][3], Native.graphToNative(config, [1, 2]))
  assert.deepEqual(si.value().data.other, initial.data.other)
})
