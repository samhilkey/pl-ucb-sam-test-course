// Evaluate recorded manual output after rehearsal; no recognition or provider calls.
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const Geometry = require('../../../../elements/pl-sketch/star-geometry.js')
const { measure, nearest, samples } = require('../../automatic-cv/experiment-01/metrics.cjs')
const { read, write } = require('../../../../tests/helpers/png.cjs')
const root = __dirname
const sha = b => createHash('sha256').update(b).digest('hex')
function graphToPhoto (p, g) {
  return g.coordinate_frame.origin_pixel.map((v, i) => v + p[0] * g.calibration.x_unit_vector_pixel[i] + p[1] * g.calibration.y_unit_vector_pixel[i])
}
function nativeToPhoto (p, g, c) {
  return graphToPhoto([c.xrange[0] + p[0] / c.width * (c.xrange[1] - c.xrange[0]), c.yrange[1] - p[1] / c.height * (c.yrange[1] - c.yrange[0])], g)
}
function overlay (im, paths, color) {
  const result = { ...im, data: im.data.slice() }
  const dot = p => {
    const x = Math.round(p[0]); const y = Math.round(p[1])
    if (x >= 0 && y >= 0 && x < im.width && y < im.height) result.data.set([...color, 255], (y * im.width + x) * 4)
  }
  for (const ps of paths) for (let i = 1; i < ps.length; i++) {
    const a = ps[i - 1]; const b = ps[i]; const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2))
    for (let k = 0; k <= n; k++) dot(a.map((v, j) => v + (b[j] - v) * k / n))
  }
  return result
}
function evaluate (directory) {
  const record = JSON.parse(fs.readFileSync(path.join(directory, 'rehearsal.json')))
  const pinned = require('../contrast-01/evaluation-policy.json').cases
  const actions = require('../step-4c/operator-actions.json').cases
  const prior = require('../step-4c/results/results.json').outcomes
  const outcomes = record.rehearsal.outcomes.map(o => {
    const c = actions.find(c => c.id === o.id); const p = pinned.find(p => p.id === o.id)
    const source = path.resolve(root, '../step-4c', c.image); const bytes = fs.readFileSync(source)
    const reference = fs.readFileSync(path.resolve(root, p.reference))
    if (sha(bytes) !== c.sha256 || sha(reference) !== p.reference_sha256) throw new Error('Pinned input/reference mismatch')
    const g = Geometry.validate(o.geometry); const ref = JSON.parse(reference); const config = o.imported.state.meta.config
    const paths = g.strokes.map(s => s.vertices.map(v => v.pixel))
    const controls = o.imported.state.data['paper-ink'].map(ps => ps.filter((_, i) => i % 3 === 0).map(p => nativeToPhoto([p.x, p.y], g, config)))
    const nativePaths = o.imported.paths.map(p => p.samples.map(v => nativeToPhoto(v, g, config)))
    const maxError = Math.max(...g.strokes.flatMap((s, i) => s.vertices.map((v, j) => Math.hypot(...v.pixel.map((x, k) => x - controls[i][j][k])))))
    const m = measure(g, ref)
    const coverage5 = ref.centerlines_pixel.map(ps => { const points = samples(ps); return points.filter(p => nearest(p, paths) <= 5).length / points.length })
    const untouched = ['imported', 'restored', 'edited', 'editedRestored'].every(stage => o[stage].state.data['paper-notes'].length === 1 && JSON.stringify(o[stage].state.data['paper-notes']) === JSON.stringify(o.imported.state.data['paper-notes']))
    const passed = m.branch_count_correct && !m.false_connections && !m.spurious_paths && m.reference_to_geometry_p95_pixel <= 5 && m.geometry_to_reference_p95_pixel <= 5 && coverage5.every(v => v >= 0.9) && maxError <= 1e-6 && untouched
    const image = read(source)
    write(path.join(directory, c.id + '--manual-overlay.png'), overlay(image, paths, [240, 117, 0]))
    write(path.join(directory, c.id + '--native-overlay.png'), overlay(image, nativePaths, [0, 155, 90]))
    return { id: o.id, method: o.classification, acceptance_passed: !!passed, input_sha256: c.sha256, reference_sha256: p.reference_sha256, metrics: m,
      reference_coverage_within_5px_per_branch: coverage5, max_native_anchor_endpoint_error_source_pixel: maxError,
      max_rendered_drift_source_pixel: Math.max(...nativePaths.flatMap((ps, i) => ps.map(p => nearest(p, [paths[i]])))),
      pre_existing_native_point_preserved: untouched, manual_pixel_paths_identical_to_step4c: JSON.stringify(paths) === JSON.stringify(prior.find(p => p.id === o.id).geometry.strokes.map(s => s.vertices.map(v => v.pixel))),
      calibration_evidence: c.calibration.evidence, scale_accuracy_independently_verified: false, originalSubmissionUrl: o.originalSubmissionUrl, editedSubmissionUrl: o.editedSubmissionUrl }
  })
  const summary = { step: '4D', all_photo_acceptance_passed: outcomes.every(o => o.acceptance_passed), browser_assertions: record.passed, mode: 'Scripted fully manual tracing of two prior development photos; not general automatic recognition validation',
    independent_ground_truth: false, reference_quality: 'Approximate prior single-observer centerlines with about4px uncertainty', legacy_fitting_or_cv_experiment_run: false,
    application_console_errors: record.rehearsal.consoleErrors, blocked_external_hosts: record.rehearsal.blockedExternalHosts, outcomes }
  fs.writeFileSync(path.join(directory, 'evaluation.json'), JSON.stringify(summary, null, 2) + '\n')
  if (!summary.all_photo_acceptance_passed) throw new Error('Rehearsal fidelity acceptance failed')
  console.log(JSON.stringify(summary, null, 2))
}
if (require.main === module) evaluate(path.resolve(process.argv[2] || path.join(root, 'results')))
module.exports = { evaluate }
