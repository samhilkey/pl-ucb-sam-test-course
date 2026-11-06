const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { inferOne, hash } = require('../benchmarks/photo-graphs/multi-method/contrast-01/infer.cjs')
const { extended, coverage, axisDiagnostics, maskCoverage } = require('../benchmarks/photo-graphs/multi-method/contrast-01/metrics.cjs')
const root = path.resolve(__dirname, '../benchmarks/photo-graphs/multi-method/contrast-01/results')

test('all contrast inputs use identical recognition with network and reference reads blocked', () => {
  const preparation = JSON.parse(fs.readFileSync(path.join(root, 'preprocessing.json')))
  const originalRead = fs.readFileSync
  const net = require('node:net'); const http = require('node:http'); const https = require('node:https')
  const saved = [net.Socket.prototype.connect, http.request, https.request, global.fetch]
  const forbidden = () => { throw new Error('Network forbidden in contrast experiment') }
  net.Socket.prototype.connect = http.request = https.request = global.fetch = forbidden
  fs.readFileSync = function (file, ...args) {
    assert.doesNotMatch(String(file), /references|evaluation-policy|metrics\.json/)
    return originalRead.call(this, file, ...args)
  }
  try {
    for (const row of preparation.rows) {
      const actual = inferOne(row, root).geometry
      const recorded = JSON.parse(originalRead(path.join(root, row.id, row.condition, 'recognition/geometry.json')))
      assert.deepEqual(actual, recorded)
      assert.equal(actual.image.width, row.image_size[0])
      assert.equal(actual.image.height, row.image_size[1])
    }
  } finally {
    fs.readFileSync = originalRead
    ;[net.Socket.prototype.connect, http.request, https.request, global.fetch] = saved
  }
})

test('both original photo failures reproduce historical geometry exactly', () => {
  const priorRoot = path.resolve(__dirname, '../benchmarks/photo-graphs/automatic-cv/experiment-01/results')
  const evaluation = JSON.parse(fs.readFileSync(path.join(root, 'evaluation.json')))
  assert.equal(evaluation.original_failures_exactly_reproduced, 2)
  for (const row of evaluation.outcomes.filter(r => r.condition === 'original')) {
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, row.geometry))), JSON.parse(fs.readFileSync(path.join(priorRoot, row.id + '.geometry.json'))))
  }
})

test('hash and dimension changes fail before recognition', () => {
  const row = JSON.parse(fs.readFileSync(path.join(root, 'preprocessing.json'))).rows[0]
  assert.throws(() => inferOne({ ...row, image_sha256: '0'.repeat(64) }, root), /identity changed/)
  assert.throws(() => inferOne({ ...row, image_size: [1, 1] }, root), /dimensions changed/)
})

test('missing output has zero coverage and unavailable distance, never perfect fidelity', () => {
  const geometry = JSON.parse(fs.readFileSync(path.join(root, 'real--01-multiple-lines-graph-paper/original/recognition/geometry.json')))
  const ref = { source_kind: 'real_photo', centerlines_pixel: [[[20, 30], [60, 30]]], expected_strokes: 1 }
  const result = extended(geometry, ref, {}, [])
  assert.deepEqual(result.reference_coverage.within_3px_per_branch, [0])
  assert.deepEqual(result.best_single_path_coverage_within_3px_per_branch, [0])
  assert.equal(result.inherited.geometry_to_reference_p95_pixel, null)
  assert.equal(result.output_length_farther_than_5px_fraction, null)
})

test('fragmented coverage and contamination cannot masquerade as one faithful branch', () => {
  const base = JSON.parse(fs.readFileSync(path.join(root, 'real--01-multiple-lines-graph-paper/original/recognition/geometry.json')))
  const stroke = (a, b) => ({ vertices: [a, b].map(pixel => ({ pixel, endpoint: true, corner: false })) })
  const geometry = { ...base, strokes: [stroke([20, 30], [39, 30]), stroke([41, 30], [60, 30]), stroke([20, 90], [60, 90])], topology: { junctions: [], component_count: 3 } }
  const ref = { source_kind: 'real_photo', centerlines_pixel: [[[20, 30], [60, 30]]], expected_strokes: 1 }
  const result = extended(geometry, ref, {}, [])
  assert.equal(result.reference_coverage.within_3px_per_branch[0], 1)
  assert.ok(result.best_single_path_coverage_within_3px_per_branch[0] < 0.6)
  assert.equal(result.matched_path_fragments_per_branch[0], 2)
  assert.ok(result.output_length_farther_than_5px_fraction > 0.3)
  assert.equal(result.inherited.spurious_paths, 1)
})

test('separate branches are never connected while measuring coverage', () => {
  assert.equal(coverage([[50, 50]], [[[10, 10], [20, 10]], [[80, 90], [90, 90]]], 3), 0)
})

test('a unique reported axis is not a correct detected axis when it is displaced', () => {
  const expected = { x: [[10, 40], [90, 40]], y: [[20, 10], [20, 90]] }
  const geometry = { coordinate_frame: { axes: {
    x: { status: 'detected', candidates: [{ start: [0, 40], end: [100, 40] }] },
    y: { status: 'detected', candidates: [{ start: [80, 0], end: [80, 100] }] }
  } } }
  const result = axisDiagnostics(geometry, expected, { max_angle_error_degrees: 5, max_reference_line_p95_distance_pixel: 6 })
  assert.equal(result.x.matches_visible_axis_diagnostic, true)
  assert.equal(result.y.reported_status, 'detected')
  assert.equal(result.y.matches_visible_axis_diagnostic, false)
})

test('mask coverage uses the recorded pixel-center transform and native-pixel tolerance', () => {
  const mask = { width: 6, height: 6, data: new Uint8ClampedArray(6 * 6 * 4).fill(255) }
  mask.data.set([0, 0, 0, 255], (2 * 6 + 2) * 4)
  const geometry = { image: { processing: { source_to_processing: [0.5, 0, 0, 0.5, -0.25, -0.25] } } }
  assert.equal(maskCoverage([[4.5, 4.5]], mask, geometry, 0.1), 1)
  assert.equal(maskCoverage([[0, 0]], mask, geometry, 1), 0)
})

test('every recorded condition preserves uncertain scales rather than injecting calibration', () => {
  const result = JSON.parse(fs.readFileSync(path.join(root, 'evaluation.json')))
  assert.equal(result.outcomes.length, 16)
  assert.equal(result.vlm_requests, 0)
  for (const row of result.outcomes) {
    const g = JSON.parse(fs.readFileSync(path.join(root, row.geometry)))
    assert.equal(hash(fs.readFileSync(path.join(root, row.geometry))), row.geometry_sha256)
    if (g.calibration.status === 'uncertain') assert.ok(g.strokes.every(s => s.vertices.every(v => v.graph === null)))
    assert.equal(row.independent_accuracy_claim, false)
  }
})
