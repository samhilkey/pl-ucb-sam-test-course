// Offline evaluation AFTER browser replay. References never enter photo tracing.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { read, write } = require('../../../../tests/helpers/png.cjs')
const { measure, nearest, samples } = require('../../automatic-cv/experiment-01/metrics.cjs')
const root = __dirname
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const load = p => JSON.parse(fs.readFileSync(p, 'utf8'))
function graphToPhoto (p, g) {
  const c = g.calibration; const o = g.coordinate_frame.origin_pixel
  return o.map((v, i) => v + p[0] * c.x_unit_vector_pixel[i] + p[1] * c.y_unit_vector_pixel[i])
}
function nativeToPhoto (p, g, config) {
  return graphToPhoto([config.xrange[0] + p[0] / config.width * (config.xrange[1] - config.xrange[0]),
    config.yrange[1] - p[1] / config.height * (config.yrange[1] - config.yrange[0])], g)
}
function withPaths (g, paths) {
  return { ...g, strokes: paths.map((ps, i) => ({ id: 'evaluated-' + i, vertices: ps.map((pixel, j) => ({ pixel, endpoint: j === 0 || j === ps.length - 1, corner: false })) })),
    topology: { component_count: paths.length } }
}
function fidelity (g, ref) {
  const paths = g.strokes.map(s => s.vertices.map(v => v.pixel))
  const ds = paths.flatMap(s => samples(s).map(p => nearest(p, ref.centerlines_pixel)))
  return { inherited_3px_metrics: measure(g, ref),
    reference_coverage_within_5px_per_branch: ref.centerlines_pixel.map(s => { const ps = samples(s); return ps.filter(p => nearest(p, paths) <= 5).length / ps.length }),
    output_length_farther_than_5px_fraction: ds.filter(d => d > 5).length / ds.length,
    distance_of_reference_peak_to_path_pixel: ref.corner_pixel ? nearest(ref.corner_pixel, paths) : null }
}
function line (im, a, b, color, width = 1) {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2))
  for (let k = 0; k <= n; k++) for (let dx = -Math.floor(width / 2); dx <= Math.floor(width / 2); dx++) for (let dy = -Math.floor(width / 2); dy <= Math.floor(width / 2); dy++) {
    const x = Math.round(a[0] + (b[0] - a[0]) * k / n) + dx; const y = Math.round(a[1] + (b[1] - a[1]) * k / n) + dy
    if (x >= 0 && y >= 0 && x < im.width && y < im.height) im.data.set([...color, 255], (y * im.width + x) * 4)
  }
}
function overlay (source, paths, color) {
  const im = { ...source, data: source.data.slice() }
  for (const ps of paths) { for (let i = 1; i < ps.length; i++) line(im, ps[i - 1], ps[i], color)
    for (const p of [ps[0], ps.at(-1)]) { line(im, [p[0] - 3, p[1]], [p[0] + 3, p[1]], color); line(im, [p[0], p[1] - 3], [p[0], p[1] + 3], color) }
  }
  return im
}
function evaluate (directory) {
  const replay = load(path.join(directory, 'results.json'))
  const actions = load(path.join(root, 'operator-actions.json'))
  const policy = load(path.join(root, 'acceptance-policy.json'))
  const pinned = load(path.join(root, '../contrast-01/evaluation-policy.json')).cases
  const baseline = load(path.join(root, '../../automatic-cv/experiment-01/results/summary.json'))
  const outcomes = []
  for (const c of actions.cases) {
    const image = path.resolve(root, c.image); const bytes = fs.readFileSync(image)
    if (sha(bytes) !== c.sha256) throw new Error('Source image hash changed: ' + c.id)
    const p = pinned.find(p => p.id === c.id); const reference = path.resolve(root, p.reference)
    const refBytes = fs.readFileSync(reference)
    if (sha(refBytes) !== p.reference_sha256) throw new Error('Reference changed: ' + c.id)
    const ref = JSON.parse(refBytes); const r = replay.outcomes.find(r => r.id === c.id); const g = r.geometry
    const config = r.imported.state.meta.config
    const paths = r.imported.paths.map(p => p.samples.map(v => nativeToPhoto(v, g, config)))
    const controls = r.imported.state.data['paper-ink'].map(ps => ps.filter((_, i) => i % 3 === 0).map(p => nativeToPhoto([p.x, p.y], g, config)))
    const vertexErrors = g.strokes.flatMap((s, i) => s.vertices.map((v, j) => Math.hypot(...v.pixel.map((x, k) => x - controls[i][j][k]))))
    const f = fidelity(g, ref); const native = fidelity(withPaths(g, paths), ref)
    const original = g.strokes.map(s => s.vertices.map(v => v.pixel))
    const nativeDrift = Math.max(...paths.flatMap((ps, i) => ps.map(p => nearest(p, [original[i]]))))
    const endpointErrors = original.flatMap((ps, i) => [0, ps.length - 1].map(j => Math.hypot(...ps[j].map((v, k) => v - controls[i][j][k]))))
    const m = f.inherited_3px_metrics
    const passed = m.branch_count_correct && m.reference_to_geometry_p95_pixel <= policy.spatial_fidelity.bidirectional_p95_max_source_pixel &&
      m.geometry_to_reference_p95_pixel <= policy.spatial_fidelity.bidirectional_p95_max_source_pixel &&
      f.reference_coverage_within_5px_per_branch.every(v => v >= policy.spatial_fidelity.coverage_within_5px_minimum_per_branch) &&
      Math.max(...vertexErrors) <= policy.native_fidelity.gradeable_vertex_max_source_pixel && !m.false_connections && !m.spurious_paths
    const before = baseline.outcomes.find(o => o.id === c.id)
    const result = { id: c.id, source_image_sha256: c.sha256, reference_sha256: p.reference_sha256, classification: r.classification, acceptance_passed: !!passed,
      manually_traced: f, native_rendered: native, native_encoding: { max_anchor_error_source_pixel: Math.max(...vertexErrors), max_endpoint_error_source_pixel: Math.max(...endpointErrors), max_rendered_path_drift_source_pixel: nativeDrift },
      calibration: { evidence: c.calibration.evidence, origin_pixel: g.coordinate_frame.origin_pixel, x_unit_vector_pixel: g.calibration.x_unit_vector_pixel, y_unit_vector_pixel: g.calibration.y_unit_vector_pixel,
        automatic_axis_detection: 'not attempted in assisted route', numeric_scale_accuracy_independently_verified: false },
      original_and_edited_submission_and_restoration: 'passed browser equality assertions', interaction_counts: r.interaction_counts,
      existing_cv_baseline: { status: before.status, calibration: before.calibration, metrics: before.metrics, source: '../../automatic-cv/experiment-01/results/summary.json; reused, no recognition rerun' } }
    const source = read(image)
    fs.copyFileSync(image, path.join(directory, c.id + '--original.png'))
    write(path.join(directory, c.id + '--manual-overlay.png'), overlay(source, original, [240, 117, 0]))
    write(path.join(directory, c.id + '--native-overlay.png'), overlay(source, paths, [0, 155, 90]))
    write(path.join(directory, c.id + '--reference-overlay.png'), overlay(source, ref.centerlines_pixel, [0, 100, 235]))
    if (c.id.startsWith('real--06')) {
      const legacy = replay.legacyFits[0]; const legacyPaths = [legacy.samples.map(p => graphToPhoto(p, g))]
      result.legacy_fitted_preview = { family: legacy.family, expression: legacy.expression, supplied_frame: 'same operator affine references as manual route; no reference geometry used', ...fidelity(withPaths(g, legacyPaths), ref) }
      write(path.join(directory, c.id + '--legacy-overlay.png'), overlay(source, legacyPaths, [210, 30, 165]))
    }
    outcomes.push(result)
  }
  const summary = { step: '4C', source: 'Actual local PrairieLearn browser interactions, saved native controls and sampled SVG paths',
    acceptance_policy: policy, all_photo_acceptance_passed: outcomes.every(r => r.acceptance_passed), browser_assertions_passed: replay.passed,
    blocked_external_hosts: replay.blockedExternalHosts, application_console_errors: replay.consoleErrors, outcomes }
  fs.writeFileSync(path.join(directory, 'evaluation.json'), JSON.stringify(summary, null, 2) + '\n')
  if (!summary.all_photo_acceptance_passed) throw new Error('Photo fidelity acceptance failed; inspect evaluation.json')
  console.log(JSON.stringify({ all_photo_acceptance_passed: true, outcomes: outcomes.map(o => ({ id: o.id, ...o.manually_traced, native_encoding: o.native_encoding, legacy: o.legacy_fitted_preview })) }, null, 2))
}
if (require.main === module) evaluate(path.resolve(process.argv[2] || path.join(root, 'results')))
module.exports = { evaluate }
