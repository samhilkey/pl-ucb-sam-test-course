const { test } = require('node:test'); const assert = require('node:assert/strict')
const Native = require('../elements/pl-sketch/star-native.js'); const T = require('../elements/pl-sketch/star-targeted.js')
const b = require('../benchmarks/photo-graphs/multi-method/step-4h-2/results/new-paper/results.json')
const source = b.initial_automatic.geometry; const h = b.assisted_accepted.geometry; const o = h.coordinate_frame.origin_pixel; const c = h.calibration
const g = T.fromSelection({ source, photoSha256: b.original_sha256, inputRevision: source.input_revision,
  axisValues: { origin: o, xMarker: o.map((v, i) => v + 4 * c.x_unit_vector_pixel[i]), yMarker: o.map((v, i) => v + 4 * c.y_unit_vector_pixel[i]), xValue: 4, yValue: 4 }, selections: [[[483, 310], [1193, 275]]], pointSelections: [] })
const config = b.original_grade.submission.meta.config
test('actual IMG_1678 terminal hook is located without moving, sorting or deleting any vertex', () => {
  const before = JSON.stringify(g); const s = g.strokes[0]; const v = Native.functionViolations(s, config)
  assert.equal(v.length, 1); assert.deepEqual(v[0].vertex_indices, [0, 1]); assert.deepEqual(v[0].pixels, s.vertices.slice(0, 2).map(v => v.pixel))
  assert.ok(v[0].pixels.every(p => p[0] > 1180 && p[1] < 275)); assert.equal(Native.functionViolations({ ...s, vertices: s.vertices.slice().reverse() }, config).length, 1)
  assert.equal(JSON.stringify(g), before)
  const data = { 'auto-ink': [], 'auto-notes': [{ x: 735, y: 520 }] }
  assert.throws(() => Native.prepare(g, config, undefined, { data }, { targeted: true }), e => e.code === 'function_x_backtrack' && e.segments.length === 1)
  assert.deepEqual(data, { 'auto-ink': [], 'auto-notes': [{ x: 735, y: 520 }] })
})
test('function check retains the original epsilon and rejects x reversals in traversal order', () => {
  const stroke = xs => ({ id: 'test', vertices: xs.map((x, i) => ({ pixel: [x + 20, i + 20], graph: [x, i] })) })
  assert.equal(Native.functionViolations(stroke([0, 1, 2]), config).length, 0)
  assert.equal(Native.functionViolations(stroke([2, 1, 0]), config).length, 0)
  assert.equal(Native.functionViolations(stroke([0, 1, 0.9, 2]), config).length, 1)
  assert.equal(Native.functionViolations(stroke([0, 1, 1 - 1e-12, 2]), config).length, 0)
})
