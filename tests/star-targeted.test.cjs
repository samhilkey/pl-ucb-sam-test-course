const { test } = require('node:test'); const assert = require('node:assert/strict')
const Targeted = require('../elements/pl-sketch/star-targeted.js'); const Native = require('../elements/pl-sketch/star-native.js'); const CV = require('../elements/pl-sketch/star-recognition.js'); const PNG = require('./helpers/png.cjs'); const Geometry = require('../elements/pl-sketch/star-geometry.js'); const Ref = require('../elements/pl-sketch/star-canvas-reference.js')
const source = CV.recognize(PNG.read(require('node:path').resolve(__dirname, '../benchmarks/photo-graphs/multi-method/step-4g-1/results/IMG_1670--source.png'))).geometry
const input = { source, photoSha256: '9c8247ec0be7d4ca68c4536eea990a0c5b0fce6250e8478a13b5aa5a0e190231', axisValues: { origin: [782, 786], xMarker: [1229, 775], yMarker: [751, 300], xValue: 3, yValue: 3 }, selections: [[[110, 714], [1469, 629]]], pointSelections: [[821, 294]], inputRevision: 0 }
const cfg = { width: 800, height: 600, xrange: [-5.2, 7.2], yrange: [-4.2, 6.2], assistedPhotoGeometry: true, plugins: [{ name: 'freeform', id: 'ink' }, { name: 'point', id: 'dots' }] }
function canvas () { let data = { ink: [], dots: [{ x: 30, y: 40 }] }; return { getState: () => JSON.stringify({ data }), setState: s => { data = { ...data, ...JSON.parse(s).data } } } }
test('real-photo endpoint choices reuse three connected CV fragments and measured dot with no trace or fixture semantics', () => {
  const chosen = Targeted.select(source, input.selections, input.pointSelections)
  assert.deepEqual(Object.keys(chosen.strokeDecisions).filter(id => chosen.strokeDecisions[id] === 'keep'), ['stroke-10', 'stroke-11', 'stroke-12'])
  const g = Targeted.fromSelection(input); Targeted.validate(g)
  assert.equal(g.strokes.length, 1); assert.equal(g.points.length, 1); assert.equal(g.status, 'needs_review'); assert.equal(g.provenance.automatically_recognized, false)
  assert.deepEqual(g.points[0].pixel, source.uncertainty.rejected_small_components[0].centroid_pixel)
  const raw = source.strokes.flatMap(s => s.vertices.map(v => JSON.stringify(v.pixel)))
  for (const v of g.strokes[0].vertices) assert.ok(raw.includes(JSON.stringify(v.pixel)))
})
test('missing/disconnected/duplicate selections and stale pixels never create geometry', () => {
  assert.throws(() => Targeted.select(source, [], [])); assert.throws(() => Targeted.select(source, [[[1, 1], [1469, 629]]], []), /No unique/)
  assert.throws(() => Targeted.select(source, [input.selections[0], input.selections[0]], []), /overlaps/)
  assert.throws(() => Targeted.select(source, input.selections, [[821, 294], [821, 294]]), /already selected/)
  assert.throws(() => Targeted.fromSelection({ ...input, inputRevision: 1 }), /older/)
  assert.throws(() => Targeted.fromSelection({ ...input, axisValues: { ...input.axisValues, xValue: NaN } }), /finite/)
})
test('alternative actual ink routes are blocked rather than paired through a cycle', () => {
  const g = structuredClone(source); const edges = [[[80, 200], [120, 200]], [[120, 200], [180, 160]], [[180, 160], [240, 200]], [[120, 200], [180, 240]], [[180, 240], [240, 200]], [[240, 200], [280, 200]]]
  g.strokes = edges.map((ps, i) => ({ id: 'e' + i, component_id: 'c', kind: 'polyline', closed: false, simplification_tolerance_pixel: 0, vertices: ps.map(pixel => ({ pixel, graph: null, corner: false, endpoint: false })) }))
  g.topology = { stroke_count: 6, component_count: 1, components: [{ id: 'c', stroke_ids: g.strokes.map(s => s.id) }], junctions: [] }
  Geometry.validate(g); assert.throws(() => Targeted.select(g, [[[80, 200], [280, 200]]], []), /Several ink routes/)
  assert.throws(() => Targeted.select(source, [[[110, 714], [667, 280]]], []), /disconnected/)
})
test('targeted native proposals need opt-in, exact provenance, final acceptance and unchanged canvas state', () => {
  const g = Targeted.fromSelection(input); const si = canvas()
  assert.throws(() => Native.createSession(si, cfg).propose(g), /current reviewed/)
  const s = Native.createSession(si, cfg, undefined, { targeted: true }); const p = s.propose(g); assert.throws(() => s.commit(p.token, false), /explicitly confirmed/)
  s.commit(p.token, true); assert.equal(JSON.parse(si.getState()).data.ink.length, 1); assert.equal(JSON.parse(si.getState()).data.dots.length, 2)
  assert.throws(() => s.commit(p.token, true), /current proposal/)
  const next = s.propose(g); si.setState(JSON.stringify({ data: { dots: [] } })); assert.throws(() => s.commit(next.token, true), /canvas changed/)
  const altered = structuredClone(g); altered.provenance.review.pointSelections = []; assert.throws(() => Targeted.validate(altered))
})
test('confirmed photo frame maps unequal/skewed axes into the native frame without visual fitting', () => {
  const g = Targeted.fromSelection(input); const f = { origin_pixel: g.coordinate_frame.origin_pixel, origin_graph: g.calibration.origin_graph, x_unit_vector_pixel: g.calibration.x_unit_vector_pixel, y_unit_vector_pixel: g.calibration.y_unit_vector_pixel }
  const m = Ref.matrix(f, cfg); const apply = p => ({ x: m[0] * p[0] + m[2] * p[1] + m[4], y: m[1] * p[0] + m[3] * p[1] + m[5] })
  for (const [p, q] of [[input.axisValues.origin, [0, 0]], [input.axisValues.xMarker, [3, 0]], [input.axisValues.yMarker, [0, 3]]]) { const actual = apply(p); const expected = Native.graphToNative(cfg, q); assert.ok(Math.hypot(actual.x - expected.x, actual.y - expected.y) < 1e-9) }
  assert.throws(() => Ref.validateFrame({ ...f, y_unit_vector_pixel: f.x_unit_vector_pixel }), /independent/)
})
