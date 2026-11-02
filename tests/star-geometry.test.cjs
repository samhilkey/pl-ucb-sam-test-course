const { test } = require('node:test')
const assert = require('node:assert/strict')
const { recognize } = require('../elements/pl-sketch/star-recognition.js')
const { validate, simplify, pixelToGraph } = require('../elements/pl-sketch/star-geometry.js')
const { read } = require('./helpers/png.cjs')
const { join } = require('node:path')
const baseline = recognize(read(join(__dirname, '../benchmarks/photo-graphs/automatic-cv/experiment-01/inputs/two-branches.png'))).geometry

test('simplification preserves drawing order, vertical runs, backtracking and a sharp vertex', () => {
  const ps = [[8, 9], [6, 5], [4, 1], [4, 4], [1, 5]]
  assert.deepEqual(simplify(ps, 0.1), [[8, 9], [4, 1], [4, 4], [1, 5]])
  assert.deepEqual(simplify([[0, 0], [10, 10], [20, 0]], 1.25), [[0, 0], [10, 10], [20, 0]])
  assert.throws(() => simplify([[0, NaN]], 1)); assert.throws(() => simplify(ps, -1))
})
test('affine calibration handles rotated nonorthogonal axes and nonzero intersection values', () => {
  const frame = { origin_pixel: [100, 70] }
  const c = { status: 'calibrated', origin_graph: [-2, 3], x_unit_vector_pixel: [20, 5], y_unit_vector_pixel: [4, -30] }
  assert.deepEqual(pixelToGraph([148, 20], frame, c), [0, 5])
  assert.equal(pixelToGraph([1, 2], frame, { status: 'uncertain' }), null)
})
const corruptions = {
  'nonfinite pixel': g => { g.strokes[0].vertices[0].pixel[0] = Infinity },
  'outside image': g => { g.strokes[0].vertices[0].pixel[0] = -1 },
  'inconsistent graph': g => { g.strokes[0].vertices[0].graph[0] += 1 },
  'singular calibration': g => { g.calibration.y_unit_vector_pixel = [1, 0] },
  'unknown evidence': g => { g.calibration.axes.x.source = 'unknown' },
  'missing label evidence': g => { g.calibration.axes.x.labels = [] },
  'wrong label scale': g => { g.calibration.axes.x.labels[0].value = 9 },
  'wrong unit vector': g => { g.calibration.x_unit_vector_pixel[0] *= 2 },
  'wrong axis intersection': g => { g.coordinate_frame.origin_pixel[0] += 2 },
  'nonfinite grid line': g => { g.coordinate_frame.grid.x.lines_pixel[0] = NaN },
  'duplicate ID': g => { g.strokes[1].id = g.strokes[0].id },
  'wrong component': g => { g.strokes[0].component_id = 'other' },
  'disconnected membership': g => { g.strokes[1].component_id = g.strokes[0].component_id; g.topology.components[0].stroke_ids.push(g.strokes[1].id); g.topology.components.pop(); g.topology.component_count-- },
  'wrong counts': g => { g.topology.stroke_count++ },
  'false loop': g => { g.strokes[0].closed = true },
  'false automatic confidence': g => { g.assistance.push({ target: 'axes', reason: 'unknown' }) },
  'unresolved automatic region': g => { g.uncertainty.regions.push({ pixel: [1, 1], reason: 'unresolved' }) },
  'wrong resize transform': g => { g.image.processing.source_to_processing[4] = 1 }
}
for (const [name, mutate] of Object.entries(corruptions)) test('validation rejects ' + name, () => {
  const g = structuredClone(baseline); mutate(g); assert.throws(() => validate(g), /Invalid photo geometry/)
})
