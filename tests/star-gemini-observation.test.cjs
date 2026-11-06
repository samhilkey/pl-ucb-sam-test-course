const { test } = require('node:test')
const assert = require('node:assert/strict')
const { validateSchema, extract, convert } = require('../benchmarks/photo-graphs/multi-method/step-4g-2/observations.cjs')
function fixture () {
  const tick = (value, anchor) => ({ text: String(value), value, anchor_pixel: anchor, bounds_pixel: [[1, 1], [4, 5]] })
  return { schema_version: 'star-observation-v1', status: 'proposed', image: { width: 100, height: 100 }, axes: {
    x: { start_pixel: [0, 50], end_pixel: [99, 50], label: 'x', numeric_ticks: [tick(1, [60, 50]), tick(2, [70, 50])] },
    y: { start_pixel: [50, 99], end_pixel: [50, 0], label: 'y', numeric_ticks: [tick(1, [50, 40]), tick(2, [50, 30])] } },
  strokes: [{ id: 'a', component_id: 'component-a', closed: false, vertices: [[10, 20], [35, 45], [70, 20]].map((pixel, i) => ({ pixel, endpoint: i !== 1, corner: i === 1 })) }],
  junctions: [], isolated_points: [], uncertainty: { reasons: [], regions: [] }, notes: [] }
}
test('strict observation parser rejects extra fields, fences, mismatched frames and incomplete envelopes', () => {
  const o = fixture(); const envelope = { status: 'completed', model: 'gemini-3.5-flash-lite', steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(o) }] }] }
  assert.deepEqual(extract(envelope, 100, 100).observation, o)
  assert.throws(() => validateSchema({ ...o, expected_equation: 'test fixture only' }))
  assert.throws(() => extract(envelope, 101, 100))
  assert.throws(() => extract({ ...envelope, status: 'incomplete' }, 100, 100))
  envelope.steps[0].content[0].text = '```json\n' + JSON.stringify(o) + '\n```'
  assert.throws(() => extract(envelope, 100, 100))
})
test('conversion preserves every supplied pixel/corner/endpoint without fitting or mutation', () => {
  const o = fixture(); const before = structuredClone(o); const r = convert(o)
  assert.equal(r.geometry.status, 'automatic'); assert.equal(r.geometry.calibration.status, 'calibrated')
  assert.deepEqual(r.geometry.strokes[0].vertices.map(v => ({ pixel: v.pixel, corner: v.corner, endpoint: v.endpoint })), o.strokes[0].vertices)
  assert.deepEqual(o, before); assert.deepEqual(r.geometry.coordinate_frame.origin_pixel, [50, 50])
})
test('unknown components and isolated points stay explicit and block automatic import', () => {
  const o = fixture(); o.strokes[0].component_id = null; o.isolated_points = [[80, 10]]
  const r = convert(o)
  assert.equal(r.geometry.status, 'needs_review'); assert.deepEqual(r.isolated_points, [[80, 10]])
  assert.ok(r.geometry.warnings.some(w => w.code === 'unsupported_isolated_points'))
  assert.ok(r.geometry.warnings.some(w => w.code === 'unresolved_component'))
  assert.equal(r.raw_component_ids[0].component_id, null)
})
test('inconsistent numeric ticks retain raw evidence and leave mathematical coordinates null', () => {
  const o = fixture(); o.axes.x.numeric_ticks.push({ text: '3', value: 3, anchor_pixel: [95, 50], bounds_pixel: [[1, 1], [4, 5]] })
  const r = convert(o)
  assert.equal(r.geometry.calibration.status, 'uncertain'); assert.equal(r.geometry.strokes[0].vertices[0].graph, null)
  assert.ok(r.geometry.warnings.some(w => w.code === 'inconsistent_tick_spacing'))
})
test('axis duplicate strokes are retained with a blocking warning rather than silently removed', () => {
  const o = fixture(); o.strokes.push({ id: 'axis', component_id: 'axis-component', closed: false, vertices: [[0, 50], [99, 50]].map(pixel => ({ pixel, corner: false, endpoint: true })) })
  const r = convert(o)
  assert.equal(r.geometry.strokes.length, 2); assert.ok(r.geometry.warnings.some(w => w.code === 'axis_as_answer_stroke'))
  assert.equal(r.geometry.status, 'needs_review')
})
test('out-of-frame points and impossible endpoint annotations fail without repair', () => {
  const a = fixture(); a.isolated_points = [[101, 50]]; assert.throws(() => convert(a))
  const b = fixture(); b.strokes[0].vertices[1].endpoint = true; assert.throws(() => convert(b))
})
