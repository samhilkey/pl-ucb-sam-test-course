const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const vm = require('node:vm')
const test = require('node:test')
const { fromReferences, constrainBranches } = require('../elements/pl-sketch/star-calibration.js')

test('one reference shifts a held-out point without changing stroke spacing', () => {
  const map = fromReferences([{ read: [1, -1], known: [0, 0] }])
  assert.deepEqual(map([3, 2]), [2, 3])
  assert.deepEqual(map([3.5, 2]), [2.5, 3])
})

test('two references recover independent horizontal and vertical scales', () => {
  const a = { read: [-1, 1], known: [-3, 4] }
  const b = { read: [2, 3], known: [3, 5] }
  for (const references of [[a, b], [b, a]]) {
    const map = fromReferences(references)
    assert.deepEqual(map([0, 2]), [-1, 4.5])
  }
})

test('points on the same row set horizontal spacing and center the vertical offset', () => {
  const a = { read: [1.2, 0.95], known: [1, 1] }
  const b = { read: [-1.05, 1.03], known: [-1, 1] }
  for (const refs of [[a, b], [b, a]]) {
    const map = fromReferences(refs)
    assert.ok(Math.abs(map(a.read)[0] - 1) < 1e-10)
    assert.ok(Math.abs(map(b.read)[0] + 1) < 1e-10)
    assert.ok(Math.abs(map([0, 0.99])[1] - 1) < 1e-10)
    assert.ok(Math.abs(map([0, -1.01])[1] + 1) < 1e-10)
  }
})

test('points on the same column set vertical spacing and preserve horizontal spacing', () => {
  const a = { read: [0.25, -1], known: [1, -2] }
  const b = { read: [0.25, 1], known: [1, 2] }
  const map = fromReferences([a, b])
  assert.deepEqual(map(a.read), a.known)
  assert.deepEqual(map(b.read), b.known)
  assert.deepEqual(map([1.25, 0.5]), [2, 1])
})

test('four imperfect references contribute to the fit in any order', () => {
  const refs = [
    { read: [0, 0], known: [1, 0] },
    { read: [1, 0], known: [3, 0] },
    { read: [0, 2], known: [1, 4] },
    { read: [1, 2], known: [3.4, 4.4] }
  ]
  for (const order of [refs, refs.slice().reverse()]) {
    const map = fromReferences(order)
    assert.ok(Math.abs(map([1, 0])[0] - map([0, 0])[0] - 2.2) < 1e-10)
    assert.ok(Math.abs(map([0, 1])[1] - map([0, 0])[1] - 2.1) < 1e-10)
    assert.ok(Math.abs(map([2, -1])[0] - 5.4) < 1e-10)
    assert.ok(Math.abs(map([2, -1])[1] + 2.1) < 1e-10)
  }
})

test('several points along one row keep the original vertical spacing', () => {
  const refs = [0, 1, 2, 3, 4].map(x => ({ read: [x, x / 4], known: [2 * x, 3] }))
  const map = fromReferences(refs)
  assert.deepEqual(map([3.5, 1.5]), [7, 4])
  assert.deepEqual(map([2.5, 0.5]), [5, 3])
  assert.throws(() => fromReferences([...refs, { read: [6, 1], known: [2, 3] }]), /duplicate/)
  assert.throws(() => fromReferences([...refs, { read: [0, 0], known: [12, 3] }]), /duplicate/)
  assert.throws(() => fromReferences([...refs, null]), /enter/)
})

test('incomplete, degenerate and reversed references do not produce a mapping', () => {
  const first = { read: [0, 0], known: [1, 1] }
  for (const second of [
    null,
    { read: [1, 1], known: [NaN, 2] },
    { read: [0, 1], known: [2, 3] },
    { read: [0, 0], known: [1, 3] },
    { read: [1, 1], known: [1, 1] },
    { read: [1, 2], known: [-2, 3] }
  ]) assert.throws(() => fromReferences([first, second]))
})

test('only checked points become knots, ordered along the photographed branch', () => {
  const lower = [[-3, -1], [3, -1]]
  const upper = [[-3, 1], [0, 1], [3, 1]]
  const toPhoto = ([x, y]) => [80 + 10 * x, 100 - 20 * y]
  // The upper branch is the one selected on paper, even when a later axis
  // edit moves the requested coordinates closer to the lower branch.
  const a = { photo: toPhoto([-1, 1]), known: [-1.123456, -0.7], onCurve: true }
  const b = { photo: toPhoto([2, 1]), known: [1.654321, 0.2], onCurve: true }
  const grid = { photo: toPhoto([0, 0]), known: [0, 0], onCurve: false }
  const paths = constrainBranches([lower, upper], [b, grid, a], toPhoto)
  assert.equal(paths[0], lower)
  assert.ok(paths[1].includes(a.known))
  assert.ok(paths[1].indexOf(b.known) > paths[1].indexOf(a.known))
  assert.ok(!paths[1].includes(grid.known))
  assert.deepEqual(upper, [[-3, 1], [0, 1], [3, 1]])
})

test('constraints at endpoints or at the same projected location each survive once', () => {
  const branch = [[0, 0], [1, 1], [2, 2]]
  const points = [[0, 0], [1, 1], [1.1, 0.9], [2, 2]].map((photo, i) =>
    ({ photo, known: [i / 10, i / 10], onCurve: true }))
  const [path] = constrainBranches([branch], points, p => p)
  assert.deepEqual(path[0], points[0].known)
  assert.deepEqual(path.at(-1), points.at(-1).known)
  for (const point of points) assert.equal(path.filter(p => p === point.known).length, 1)
})

test('photo confirmation transfers exact free-draw knots and separate reference markers', () => {
  const frame = { style: {} }
  const window = { StarCalibration: require('../elements/pl-sketch/star-calibration.js'), StarFit: require('../elements/pl-sketch/star-fit.js') }
  const script = require.resolve('../elements/pl-sketch/star-photo.js')
  vm.runInNewContext(readFileSync(script, 'utf8'), { window, document: { createElement: () => frame } })
  const config = {
    width: 500, height: 500, xrange: [-5, 5], yrange: [-5, 5],
    pointCalibration: true, plugins: [{ id: 'draw', name: 'freeform' }]
  }
  let imported
  window.StarPhoto.create({
    root: { style: {}, appendChild () {} }, config,
    onConfirm (models, points) { imported = { models, points }; return { ok: true } }
  })
  const pin = { photo: [1, 1], known: [1.123456, 0.987654], onCurve: true }
  const reference = { photo: [0, 0], known: [0, 0], onCurve: false }
  const data = { curves: [[[-2, -1], [2, -1]], [[-2, 1], [2, 1]]], calibrationPoints: [pin, reference] }
  assert.equal(frame.__starBridge.confirm(data, p => p).ok, true)
  assert.equal(imported.points, data.calibrationPoints)
  assert.equal(imported.models.length, 2)
  const knots = imported.models[1].points.filter((_, i) => i % 3 === 0)
  assert.ok(knots.includes(pin.known))
  assert.ok(!knots.some(([x, y]) => x === 0 && y === 0))
  assert.ok(imported.models[0].points.every(p => p[1] === -1))
})
