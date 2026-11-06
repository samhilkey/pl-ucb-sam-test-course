// Withheld-reference evaluation after the pixel-only automatic run. This file
// is never shipped as an element dependency or imported by a recognizer.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { measure, nearest, samples } = require('../../automatic-cv/experiment-01/metrics.cjs')
const { read, write } = require('../../../../tests/helpers/png.cjs')
const directory = path.resolve(process.argv[2] || path.join(__dirname, 'results'))
const load = p => JSON.parse(fs.readFileSync(p))
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const automatic = load(path.join(directory, 'automatic.json')); const recovery = load(path.join(directory, 'recovery.json'))
const old = path.resolve(__dirname, '../../automatic-cv/experiment-01')
const refs = { 'real--01': path.join(old, 'references/real--01-multiple-lines-graph-paper.json'), 'real--06': path.join(old, 'references/real--06-piecewise-graph-paper.json'), IMG_1670: path.resolve(__dirname, '../step-4f/reference.json') }
const baseline = load(path.join(old, 'results/summary.json'))
const manual = load(path.resolve(__dirname, '../step-4c/results/evaluation.json'))
const finalManual = load(path.resolve(__dirname, '../step-4f/results/evaluation.json'))
function distances (geometry, reference) {
  const paths = geometry.strokes.map(s => s.vertices.map(v => v.pixel))
  const ds = paths.flatMap(s => samples(s).map(p => nearest(p, reference.centerlines_pixel)))
  const coverage = n => reference.centerlines_pixel.map(s => { const ps = samples(s); return ps.filter(p => nearest(p, paths) <= n).length / ps.length })
  return { ...measure(geometry, reference), coverage_5px_per_branch: coverage(5), coverage_8px_per_branch: coverage(8),
    predicted_length_farther_than_5px_fraction: ds.length ? ds.filter(d => d > 5).length / ds.length : null,
    marked_corner_errors_pixel: (reference.corners_pixel || (reference.corner_pixel ? [reference.corner_pixel] : [])).map(p => {
      const vertices = geometry.strokes.flatMap(s => s.vertices.filter(v => v.corner))
      return vertices.length ? Math.min(...vertices.map(v => Math.hypot(...v.pixel.map((x, i) => x - p[i])))) : null
    }) }
}
function overlay (source, paths) {
  const im = { ...source, data: source.data.slice() }
  for (const s of paths) for (const p of samples(s)) {
    const x = Math.round(p[0]); const y = Math.round(p[1]); if (x >= 0 && y >= 0 && x < im.width && y < im.height) im.data.set([0, 110, 230, 255], (y * im.width + x) * 4)
  }
  return im
}
const outcomes = automatic.outcomes.map(o => {
  const reference = load(refs[o.id]); const geometry = o.geometry
  const prior = baseline.outcomes.find(b => b.id.startsWith(o.id))
  const assisted = o.id === 'IMG_1670' ? finalManual.outcomes.find(b => b.id === 'new-paper-01' && b.trial === 'desktop') : manual.outcomes.find(b => b.id.startsWith(o.id))
  const dot = reference.isolated_point_pixel
  const image = read(path.join(directory, o.id + '--source.png'))
  write(path.join(directory, o.id + '--reference-overlay.png'), overlay(image, reference.centerlines_pixel))
  return { id: o.id, method: o.method, status: geometry.status, native_imported: o.native_imported, latency_ms: o.latency_ms,
    source_decoded_png_sha256: hash(path.join(directory, o.id + '--source.png')), reference_sha256: hash(refs[o.id]),
    metrics: distances(geometry, reference), detected_endpoint_count: geometry.strokes.flatMap(s => s.vertices.filter(v => v.endpoint)).length,
    detected_corner_count: geometry.strokes.flatMap(s => s.vertices.filter(v => v.corner)).length,
    axes: geometry.coordinate_frame, calibration: geometry.calibration,
    small_components: o.marks.length, unclassified_small_components: o.marks.filter(m => !m.at_axis_intersection).length,
    separate_dot: dot ? { reference_pixel: dot, lies_in_unclassified_component_box: o.marks.some(m => dot.every((v, i) => v >= m.bounds_pixel[0][i] && v <= m.bounds_pixel[1][i])), recognized_as_point: false, native_imported: false } : { reference_annotation_available: false, detection_accuracy: null },
    old_cv_baseline: prior ? { status: prior.status, metrics: prior.metrics, note: 'Prior run, unchanged inputs and recognizer; not rerun inference results.' } : null,
    prior_assisted: { evidence: o.id === 'IMG_1670' ? '../step-4f/results/evaluation.json' : '../step-4c/results/evaluation.json', method: 'manually assisted', metrics: assisted.metrics || assisted.manually_traced.inherited_3px_metrics,
      calibration: 'student-corrected; not an automatic calibration success', dot: o.id === 'IMG_1670' ? 'manually placed with native point tool' : 'not independently annotated' },
    interpretation: o.id === 'real--01' ? 'Abstention: both drawn branches are missing.' : o.id === 'real--06' ? 'Four short/spurious paths do not recover the single sharp peak; scale and axes are unresolved.' : 'Some curve geometry is recovered, but axes, ticks and labels become spurious geometry, the axis crossing fragments connectivity, and the separate dot is only an unclassified component. Not a faithful automatic graph.' }
})
const reference = load(refs.IMG_1670)
const config = recovery.imported.state.meta.config; const geometry = recovery.geometry
const nativeToPixel = p => {
  const q = [config.xrange[0] + p.x / config.width * (config.xrange[1] - config.xrange[0]), config.yrange[1] - p.y / config.height * (config.yrange[1] - config.yrange[0])]
  return geometry.coordinate_frame.origin_pixel.map((v, i) => v + q[0] * geometry.calibration.x_unit_vector_pixel[i] + q[1] * geometry.calibration.y_unit_vector_pixel[i])
}
const actual = recovery.imported.state.data['auto-ink'].map(s => s.filter((_, i) => i % 3 === 0).map(nativeToPixel))
const manualVertexError = Math.max(...geometry.strokes.flatMap((s, i) => s.vertices.map((v, j) => Math.hypot(...v.pixel.map((x, k) => x - actual[i][j][k])))))
const dot = nativeToPixel(recovery.imported.state.data['auto-notes'][1])
const result = { step: '4G-1', automatic_successes: outcomes.filter(o => o.native_imported).length, real_photo_cases: outcomes.length,
  photo_geometry_reference_quality: 'Existing approximate single-agent visual annotations, not independent blinded human ground truth. No reference/calibration/trace was passed to the automatic UI/provider.',
  pixel_distances_are_not_mathematical_calibration_accuracy: true, null_distance_means_no_output_not_zero_error: true, outcomes,
  current_manual_recovery: { id: 'IMG_1670', classification: recovery.classification, metrics: distances(geometry, reference), native_anchor_max_error_source_pixel: manualVertexError,
    manually_placed_dot_error_source_pixel: Math.hypot(...dot.map((x, i) => x - reference.isolated_point_pixel[i])), save_grade_refresh: 'passed exact native state equality, existing incorrect graph still grades 0%', url: recovery.url },
  inference_requests: 0, recommendation: 'Separately approved, bounded Gemini experiment on individually cleared photos; evaluate precise geometry and topology through the same interface. Keep manual assistance as the dependable demo path.' }
fs.writeFileSync(path.join(directory, 'evaluation.json'), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({ automatic_successes: result.automatic_successes, outcomes: outcomes.map(o => ({ id: o.id, paths: o.metrics.extracted_paths, metrics: o.metrics })), manual: result.current_manual_recovery }, null, 2))
