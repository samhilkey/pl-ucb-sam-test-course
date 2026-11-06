const test = require('node:test')
const assert = require('node:assert/strict')
const { fromTrace } = require('../elements/pl-sketch/star-assisted.js')
const Native = require('../elements/pl-sketch/star-native.js')
const { spawnSync } = require('node:child_process')
const path = require('node:path')
const args = { width: 400, height: 300, processingWidth: 400, processingHeight: 300,
  origin: [100, 220], xMarker: [300, 220], yMarker: [100, 20], xValue: 5, yValue: 5, inputRevision: 3,
  strokes: [[[120, 190], [170, 70], [220, 190]]] }
const config = { width: 800, height: 600, xrange: [-5, 7], yrange: [-4, 6], xscale: 'linear', yscale: 'linear',
  assistedPhotoGeometry: true, plugins: [{ id: 'ink', name: 'freeform' }] }
function canvas () {
  let value = { data: { ink: [], other: [{ x: 10, y: 20 }] } }
  return { getState: () => JSON.stringify(value), setState: s => Object.assign(value.data, JSON.parse(s).data), value: () => value }
}
test('manual tracing keeps the original V corner and endpoints without equation fitting', () => {
  const g = fromTrace(args)
  assert.equal(g.status, 'needs_review'); assert.equal(g.provenance.automatically_recognized, false)
  assert.deepEqual(g.strokes[0].vertices.map(v => v.pixel), args.strokes[0])
  assert.equal(g.strokes[0].vertices[1].corner, true)
  assert.ok(g.strokes[0].vertices[0].endpoint && g.strokes[0].vertices.at(-1).endpoint)
  assert.equal(g.calibration.axes.x.source, 'student_corrected')
})
test('manual branches preserve ordering, vertical segments and independent gaps', () => {
  const strokes = [[[200, 150], [200, 100], [140, 70]], [[250, 200], [275, 190], [300, 195]]]
  const g = fromTrace({ ...args, strokes })
  assert.deepEqual(g.strokes.map(s => s.vertices.map(v => v.pixel)), strokes)
  assert.equal(g.topology.component_count, 2)
})
test('resized and skewed manual calibration round-trips to original pixel centers', () => {
  const g = fromTrace({ ...args, width: 800, height: 600, yMarker: [120, 20] })
  assert.deepEqual(g.strokes[0].vertices[1].pixel, [340.5, 140.5])
  for (const v of g.strokes[0].vertices) {
    const c = g.calibration; const o = g.coordinate_frame.origin_pixel
    const pixel = [0, 1].map(i => o[i] + v.graph[0] * c.x_unit_vector_pixel[i] + v.graph[1] * c.y_unit_vector_pixel[i])
    assert.ok(Math.hypot(...pixel.map((n, i) => n - v.pixel[i])) < 1e-8)
  }
})
test('invalid, nearly collinear, out-of-photo and empty traces cannot produce a proposal', () => {
  for (const change of [{ xValue: 0 }, { yMarker: [300, 220.01] }, { strokes: [] }, { strokes: [[[1, 1], [2, 2], [400, 3]]] }]) assert.throws(() => fromTrace({ ...args, ...change }))
})
test('automatic sessions still reject a manually reviewed trace and unsafe proposals', () => {
  const g = fromTrace(args); const si = canvas()
  const session = Native.createSession(si, config); session.invalidate(3)
  assert.throws(() => session.propose(g), /needs correction/)
  const disabled = Native.createSession(si, { ...config, assistedPhotoGeometry: false }, undefined, { assisted: true }); disabled.invalidate(3)
  assert.throws(() => disabled.propose(g), /needs correction/)
  const assisted = Native.createSession(si, config, undefined, { assisted: true }); assisted.invalidate(3)
  const unsafe = structuredClone(g); unsafe.warnings.push({ code: 'uncertain', message: 'Unresolved input' })
  assert.throws(() => assisted.propose(unsafe), /needs correction/)
  assert.equal(si.value().data.ink.length, 0)
})
test('opted-in assisted import preserves overlapping branches as separate editable controls', () => {
  const g = fromTrace({ ...args, strokes: [...args.strokes, args.strokes[0].map(p => [p[0], p[1] + 35])] })
  const si = canvas(); const session = Native.createSession(si, config, undefined, { assisted: true }); session.invalidate(3)
  const proposal = session.propose(g)
  assert.throws(() => session.commit(proposal.token), /explicitly confirmed/)
  session.commit(proposal.token, true)
  assert.equal(si.value().data.ink.length, 2)
  assert.deepEqual(si.value().data.other, [{ x: 10, y: 20 }])
  for (const [i, s] of g.strokes.entries()) assert.deepEqual(si.value().data.ink[i].filter((_, index) => index % 3 === 0), s.vertices.map(v => Native.graphToNative(config, v.graph)))
})
test('assisted native edits and calibration revisions invalidate old proposals', () => {
  const si = canvas(); const session = Native.createSession(si, config, undefined, { assisted: true }); session.invalidate(3)
  const p = session.propose(fromTrace(args)); si.value().data.other.push({ x: 3, y: 4 })
  assert.throws(() => session.commit(p.token, true), /canvas changed/)
  const second = session.propose(fromTrace(args)); session.invalidate(4)
  assert.throws(() => session.commit(second.token, true)); assert.equal(si.value().data.ink.length, 0)
})
test('optional Gemini environment check never logs a supplied key and does not enable inference', () => {
  const script = path.resolve(__dirname, '../benchmarks/photo-graphs/multi-method/step-4c/check-gemini-env.cjs')
  const secret = 'test-only-secret-do-not-log'
  for (const key of ['', secret]) {
    const result = spawnSync(process.execPath, [script], { env: { ...process.env, GEMINI_API_KEY: key }, encoding: 'utf8' })
    assert.equal(result.status, 0); assert.equal(result.stderr, '')
    const data = JSON.parse(result.stdout)
    assert.equal(data.gemini_api_key_configured, !!key)
    assert.equal(data.inference_enabled, false)
    assert.equal(result.stdout.includes(secret), false)
  }
})
