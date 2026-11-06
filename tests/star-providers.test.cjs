const { test } = require('node:test')
const assert = require('node:assert/strict')
const { join } = require('node:path')
const { read } = require('./helpers/png.cjs')
const Providers = require('../elements/pl-sketch/star-providers.js')
const CV = require('../elements/pl-sketch/star-recognition.js')
const root = join(__dirname, '../benchmarks/photo-graphs/automatic-cv/experiment-01/inputs')
test('CV boundary uses pixels/revision only and retains supported native candidates', () => {
  for (const id of ['line', 'sharp-v', 'smooth-curve', 'two-branches']) {
    const image = read(join(root, id + '.png')); const r = Providers.recognize(image, { inputRevision: 9 })
    assert.equal(r.method, 'CV automatic'); assert.equal(r.geometry.status, 'automatic')
    assert.deepEqual(r.geometry, CV.recognize(image, { inputRevision: 9 }).geometry)
    assert.equal(r.marks.length, 1); assert.equal(r.marks[0].at_axis_intersection, true)
  }
})
test('unclassified isolated ink is shown as a candidate and blocks automatic import', () => {
  const image = read(join(root, 'line.png'))
  for (let y = 65; y <= 75; y++) for (let x = 95; x <= 105; x++) if (Math.hypot(x - 100, y - 70) <= 5) image.data.set([0, 0, 0, 255], (y * image.width + x) * 4)
  const r = Providers.recognize(image)
  assert.equal(r.geometry.status, 'needs_review')
  assert.ok(r.marks.some(m => !m.at_axis_intersection && m.bounds_pixel[0][0] <= 100 && m.bounds_pixel[1][0] >= 100))
  assert.ok(r.geometry.warnings.some(w => w.code === 'unclassified_small_marks'))
  assert.equal(r.geometry.strokes.length, 1, 'no guessed dot becomes a curve or mathematical point')
})
test('future providers stay disabled and cannot accept answer or calibration options', () => {
  const image = read(join(root, 'line.png'))
  for (const provider of ['gemini', 'hybrid', 'unknown']) assert.throws(() => Providers.recognize(image, { provider }), /not enabled/)
  for (const options of [{ calibration: {} }, { reference: {} }, { solution: 'x*x' }, { selectedPoints: [] }]) assert.throws(() => Providers.recognize(image, options), /Only a provider/)
})
test('offline future candidate validation enforces revision, image dimensions and marks', () => {
  const image = read(join(root, 'line.png')); const geometry = CV.recognize(image).geometry
  const context = { provider: 'gemini', inputRevision: 0, width: image.width, height: image.height }
  assert.equal(Providers.candidate(geometry, context).method, 'VLM automatic')
  assert.throws(() => Providers.candidate(geometry, { ...context, inputRevision: 1 }), /Stale/)
  assert.throws(() => Providers.candidate(geometry, { ...context, width: image.width + 1 }), /mismatched/)
  const bad = structuredClone(geometry); bad.uncertainty.rejected_small_components[0].bounds_pixel[1][0] = image.width + 1
  assert.throws(() => Providers.candidate(bad, context), /small-component/)
  for (const marks of [null, 0, {}, [null]]) {
    const invalid = structuredClone(geometry); invalid.uncertainty.rejected_small_components = marks
    assert.throws(() => Providers.candidate(invalid, context), /small-component/)
  }
  assert.deepEqual(geometry, CV.recognize(image).geometry, 'candidate validation does not mutate provider output')
})
