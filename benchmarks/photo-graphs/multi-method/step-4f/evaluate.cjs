// Evaluator-only evidence. Never loaded by tracing or passed to recognition.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const Geometry = require('../../../../elements/pl-sketch/star-geometry.js')
const { read, write } = require('../../../../tests/helpers/png.cjs')
const { measure, samples, nearest } = require('../../automatic-cv/experiment-01/metrics.cjs')
const root = __dirname
function nativeToPhoto (p, g, c) {
  const graph = [c.xrange[0] + p[0] * (c.xrange[1] - c.xrange[0]) / c.width, c.yrange[1] - p[1] * (c.yrange[1] - c.yrange[0]) / c.height]
  return g.coordinate_frame.origin_pixel.map((v, i) => v + graph[0] * g.calibration.x_unit_vector_pixel[i] + graph[1] * g.calibration.y_unit_vector_pixel[i])
}
function overlay (image, paths, point, color) {
  const im = { ...image, data: image.data.slice() }
  const dot = p => { const x = Math.round(p[0]); const y = Math.round(p[1]); if (x >= 0 && y >= 0 && x < im.width && y < im.height) im.data.set([...color, 255], (y * im.width + x) * 4) }
  for (const ps of paths) for (let i = 1; i < ps.length; i++) {
    const a = ps[i - 1]; const b = ps[i]; const n = Math.max(1, Math.ceil(Math.hypot(...a.map((v, j) => v - b[j])) * 2))
    for (let k = 0; k <= n; k++) dot(a.map((v, j) => v + (b[j] - v) * k / n))
  }
  if (point) for (let d = -8; d <= 8; d++) { dot([point[0] + d, point[1]]); dot([point[0], point[1] + d]) }
  return im
}
function evaluate (directory) {
  const run = JSON.parse(fs.readFileSync(path.join(directory, 'acceptance.json')))
  const policy = require('./acceptance-policy.json'); const freeze = require('./frozen-before-test.json'); const input = require('./input-manifest.json')
  for (const [p, expected] of Object.entries(freeze.sha256)) if (crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex') !== expected) throw new Error('Frozen input changed: ' + p)
  const outcomes = run.outcomes.map(o => {
    const g = Geometry.validate(o.geometry); const config = o.imported.state.meta.config
    const reference = o.id === 'new-paper-01' ? require('./reference.json') : require('../../automatic-cv/experiment-01/references/real--01-multiple-lines-graph-paper.json')
    const paths = g.strokes.map(s => s.vertices.map(v => v.pixel))
    const m = measure(g, reference)
    const coverage = tolerance => reference.centerlines_pixel.map(s => { const p = samples(s); return p.filter(p => nearest(p, paths) <= tolerance).length / p.length })
    const anchors = o.imported.state.data['paper-ink'].map(s => s.filter((_, i) => i % 3 === 0).map(p => nativeToPhoto([p.x, p.y], g, config)))
    const native = o.imported.paths.map(p => p.samples.map(p => nativeToPhoto(p, g, config)))
    const maxAnchorError = Math.max(...g.strokes.flatMap((s, i) => s.vertices.map((v, j) => Math.hypot(...v.pixel.map((v, k) => v - anchors[i][j][k])))))
    const maxDrift = Math.max(...native.flatMap((s, i) => s.map(p => nearest(p, [paths[i]]))))
    const cornerErrors = (reference.corners_pixel || []).map(p => Math.min(...g.strokes.flatMap(s => s.vertices.filter(v => v.corner).map(v => Math.hypot(...p.map((x, i) => x - v.pixel[i]))))))
    const sourcePoints = o.sourcePointPlacements.map(p => { const actual = nativeToPhoto([p.actual.x, p.actual.y], g, config); return { source: p.original_pixel, reconstructed: actual, error_pixel: Math.hypot(...actual.map((x, i) => x - p.original_pixel[i])), method: p.method } })
    const screen = policy.source_photo_fidelity_screen
    const passed = m.branch_count_correct && !m.spurious_paths && !m.false_connections && maxAnchorError <= 1e-6 &&
      (o.id !== 'new-paper-01' || (m.reference_to_geometry_p95_pixel <= screen.bidirectional_p95_max_source_pixel && m.geometry_to_reference_p95_pixel <= screen.bidirectional_p95_max_source_pixel && coverage(8).every(v => v >= screen.coverage_within_8px_minimum) && m.endpoint_max_error_pixel <= screen.endpoint_max_error_pixel && cornerErrors.every(v => v <= screen.marked_corner_max_error_pixel) && sourcePoints.every(p => p.error_pixel <= screen.isolated_point_max_error_pixel)))
    if (o.id === 'new-paper-01') {
      const image = read(path.join(root, input.input))
      write(path.join(directory, o.id + '--' + o.trial + '--manual-overlay.png'), overlay(image, paths, null, [240, 117, 0]))
      write(path.join(directory, o.id + '--' + o.trial + '--native-overlay.png'), overlay(image, native, sourcePoints[0].reconstructed, [0, 160, 80]))
    }
    return { id: o.id, trial: o.trial, viewport: o.viewport, acceptance_passed: !!passed, classification: o.method, metrics: m,
      reference_coverage_5px: coverage(5), reference_coverage_8px: coverage(8), marked_corner_errors_pixel: cornerErrors,
      native_max_anchor_endpoint_error_source_pixel: maxAnchorError, native_max_rendered_drift_source_pixel: maxDrift, source_points: sourcePoints,
      independently_calibrated_numeric_accuracy: false, annotation_quality: reference.reference_status,
      prepared_original_variant_url: o.finalSaved.url, point_rendering_note: 'Point center preserved with manual native placement. Ink width/color/arrow decorations are not reconstructed.' }
  })
  const result = { step: '4F', local_functional_acceptance_passed: outcomes.every(o => o.acceptance_passed), browser_assertions: run.passed,
    new_independent_paper_drawings: 1, new_case_tuned_recognition_code: false, reference_quality: 'Frozen single-agent visual annotations; not independent expert ground truth',
    outcomes, source_photo_accuracy_not_general_recognition_accuracy: true }
  fs.writeFileSync(path.join(directory, 'evaluation.json'), JSON.stringify(result, null, 2) + '\n')
  if (!result.local_functional_acceptance_passed) throw new Error('Acceptance fidelity screen failed; retain evidence and review')
  console.log(JSON.stringify(result, null, 2))
}
if (require.main === module) evaluate(path.resolve(process.argv[2] || path.join(root, 'results')))
module.exports = { evaluate }
