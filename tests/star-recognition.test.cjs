const { test } = require('node:test')
const assert = require('node:assert/strict')
const { join } = require('node:path')
const { read } = require('./helpers/png.cjs')
const { recognize } = require('../elements/pl-sketch/star-recognition.js')
const { validate } = require('../elements/pl-sketch/star-geometry.js')
const { measure, nearest } = require('../benchmarks/photo-graphs/automatic-cv/experiment-01/metrics.cjs')
const root = join(__dirname, '../benchmarks/photo-graphs/automatic-cv/experiment-01')
const image = id => read(join(root, 'inputs', id + '.png'))
const run = (id, options) => recognize(image(id), options).geometry

for (const id of ['line', 'sharp-v', 'smooth-curve', 'two-branches']) {
  test(id + ': extraction and scale come from pixels without a trace, equation, or reference', () => {
    const im = image(id); const bytes = im.data.slice()
    const g = recognize(im, { inputRevision: 7 }).geometry
    const ref = require(join(root, 'references', id + '.json'))
    const m = measure(g, ref)
    assert.equal(g.status, 'automatic'); assert.equal(g.input_revision, 7)
    assert.equal(g.calibration.axes.x.source, 'photo_detected'); assert.equal(g.calibration.axes.y.source, 'photo_detected')
    assert.ok(m.branch_count_correct); assert.equal(m.missing_strokes, 0); assert.equal(m.false_connections, 0)
    assert.ok(m.reference_to_geometry_p95_pixel < 3, JSON.stringify(m)); assert.ok(m.geometry_to_reference_p95_pixel < 3, JSON.stringify(m))
    assert.ok(m.reference_centerline_coverage_within_3px.every(v => v > 0.95)); assert.ok(m.endpoint_max_error_pixel < 5)
    assert.ok(m.axis_origin_error_pixel < 1)
    if (id === 'sharp-v') assert.ok(m.corner_error_pixel !== null && m.corner_error_pixel < 4, JSON.stringify(m))
    assert.deepEqual(im.data, bytes, 'input image is immutable')
    assert.deepEqual(JSON.parse(JSON.stringify(g)), g, 'geometry is portable JSON')
    assert.equal(validate(g), g)
  })
}
test('missing scale keeps ordered pixel paths and never assumes units from grid squares', () => {
  const g = run('unknown-scale')
  assert.equal(g.coordinate_frame.status, 'detected'); assert.equal(g.status, 'needs_review')
  assert.equal(g.calibration.status, 'uncertain'); assert.equal(g.calibration.x_unit_vector_pixel, null)
  assert.equal(g.strokes.length, 1); assert.ok(g.strokes[0].vertices.every(v => v.graph === null))
  assert.ok(g.assistance.some(a => a.target === 'x_scale'))
})
test('explicit configuration calibration has distinct provenance', () => {
  const g = run('unknown-scale', { calibration: { unitsPerGridSquare: [2, 5], axisIntersectionValue: [-3, 7] } })
  assert.equal(g.status, 'automatic'); assert.equal(g.calibration.axes.x.source, 'question_configuration')
  assert.deepEqual(g.calibration.origin_graph, [-3, 7]); assert.deepEqual(g.calibration.x_unit_vector_pixel, [20, 0]); assert.deepEqual(g.calibration.y_unit_vector_pixel, [0, -8])
  assert.deepEqual(run('line', { calibration: { unitsPerGridSquare: [9, 9], axisIntersectionValue: [9, 9] } }).calibration, run('line').calibration, 'visible evidence takes precedence over configuration fallback')
})
test('ambiguous axes cannot manufacture an origin or mathematical coordinates', () => {
  const g = run('ambiguous-axes')
  assert.equal(g.status, 'needs_review'); assert.equal(g.coordinate_frame.origin_pixel, null)
  assert.equal(g.coordinate_frame.axes.y.candidates.length, 2)
  assert.ok(g.strokes.length); assert.ok(g.strokes.every(s => s.vertices.every(v => v.graph === null)))
})
test('black ink crossing axes remains connected but ambiguous spurs require review', () => {
  const g = run('grid-axis-crossing')
  assert.equal(g.topology.component_count, 1)
  assert.equal(g.status, 'needs_review'); assert.ok(g.warnings.some(w => w.code === 'ink_junction'))
  const m = measure(g, require(join(root, 'references/grid-axis-crossing.json')))
  assert.equal(m.missing_strokes, 0); assert.ok(m.reference_centerline_coverage_within_3px[0] > 0.95)
})
test('touching ink is represented as a junction, never paired into an invented function', () => {
  const g = run('touching-junction')
  assert.equal(g.status, 'needs_review'); assert.equal(g.topology.component_count, 1)
  assert.equal(g.topology.junctions.length, 1); assert.equal(g.topology.junctions[0].stroke_ids.length, 3)
})
test('resizing exports source-image coordinates and an explicit pixel-center transform', () => {
  const original = image('sharp-v'); const w = original.width * 2; const h = original.height * 2; const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(original.data.subarray((Math.floor(y / 2) * original.width + Math.floor(x / 2)) * 4, (Math.floor(y / 2) * original.width + Math.floor(x / 2)) * 4 + 4), (y * w + x) * 4)
  const g = recognize({ width: w, height: h, data }).geometry
  assert.equal(g.image.width, 1280); assert.equal(g.image.processing.width, 900)
  assert.equal(g.image.processing.source_to_processing[0], 900 / 1280)
  assert.ok(Math.abs(g.coordinate_frame.origin_pixel[0] - 540) < 2)
  assert.ok(g.strokes.some(s => s.vertices.some(v => Math.hypot(v.pixel[0] - 556, v.pixel[1] - 500) < 5)))
})
test('blank and transparent images abstain; no centered calibration is inserted', () => {
  for (const alpha of [0, 255]) {
    const data = new Uint8ClampedArray(160 * 160 * 4).fill(255)
    for (let i = 3; i < data.length; i += 4) data[i] = alpha
    const g = recognize({ width: 160, height: 160, data }).geometry
    assert.equal(g.status, 'abstained'); assert.equal(g.coordinate_frame.origin_pixel, null); assert.equal(g.strokes.length, 0)
  }
})
test('a broad dark background cannot be reported as a detected axis pair', () => {
  const data = new Uint8ClampedArray(160 * 160 * 4).fill(100)
  for (let i = 3; i < data.length; i += 4) data[i] = 255
  const g = recognize({ width: 160, height: 160, data }).geometry
  assert.equal(g.status, 'abstained'); assert.equal(g.coordinate_frame.origin_pixel, null)
  assert.equal(g.coordinate_frame.axes.x.candidates.length, 0); assert.equal(g.coordinate_frame.axes.y.candidates.length, 0)
})
test('real-photo challenge failures are explicit and are not counted as automatic successes', () => {
  const a = run('real--01-multiple-lines-graph-paper'); const b = run('real--06-piecewise-graph-paper')
  assert.equal(a.status, 'abstained'); assert.equal(a.strokes.length, 0)
  assert.equal(b.status, 'needs_review'); assert.equal(b.calibration.status, 'uncertain')
  assert.ok(b.warnings.length); assert.ok(b.strokes.every(s => s.vertices.every(v => v.graph === null)))
})
test('input contract rejects invalid image storage, limits, and solution-like options', () => {
  const im = image('line')
  for (const options of [{ solution: 'x*x' }, { maxDimension: 99999 }, { simplificationTolerance: NaN }, { inputRevision: -1 }, { calibration: { unitsPerGridSquare: [1, 1] } }]) assert.throws(() => recognize(im, options))
  assert.throws(() => recognize({ ...im, data: im.data.slice(4) }))
  assert.throws(() => recognize({ ...im, data: Array.from(im.data) }))
})
test('simplification stays within its declared tolerance of every extracted skeleton sample', () => {
  for (const id of ['line', 'sharp-v', 'smooth-curve', 'two-branches']) {
    const { geometry: g, debug } = recognize(image(id))
    for (const path of debug.paths_processing) {
      const stroke = g.strokes.find(s => s.id === path.id)
      for (const p of path.pixels) assert.ok(nearest(p, [stroke.vertices.map(v => v.pixel)]) <= 1.25 + 1e-8)
    }
  }
})
test('a closed ink loop remains a closed stroke instead of a sorted function', () => {
  const width = 256; const height = 256; const data = new Uint8ClampedArray(width * height * 4).fill(255)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (Math.abs(Math.hypot(x - 128, y - 128) - 65) <= 4) data.set([30, 40, 140, 255], (y * width + x) * 4)
  const g = recognize({ width, height, data }).geometry
  assert.equal(g.strokes.length, 1); assert.equal(g.strokes[0].closed, true)
  assert.deepEqual(g.strokes[0].vertices[0].pixel, g.strokes[0].vertices.at(-1).pixel)
  assert.ok(g.strokes[0].vertices.every(v => !v.endpoint && v.graph === null))
})
