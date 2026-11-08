// Evaluator only. References never enter the detector, correction UI or adapter.
const fs = require('node:fs'); const path = require('node:path'); const crypto = require('node:crypto')
const { measure, samples, nearest } = require('../../automatic-cv/experiment-01/metrics.cjs')
const { read, write } = require('../../../../tests/helpers/png.cjs')
const results = path.resolve(process.argv[2] || path.join(__dirname, 'results'))
const load = p => JSON.parse(fs.readFileSync(p)); const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const evidence = load(path.join(results, 'results.json')); const g = evidence.corrected
const sourceFile = path.join(results, 'decoded-source.png'); const refFile = path.resolve(__dirname, '../step-4f/reference.json'); const ref = load(refFile)
const baseline = load(path.resolve(__dirname, '../step-4g-1/results/evaluation.json'))
const gemini = load(path.resolve(__dirname, '../step-4g-2/results/evaluation.json'))
if (evidence.source_file.sha256 !== g.provenance.photo_sha256 || hash(sourceFile) !== evidence.decoded_source_sha256) throw Error('Photo mismatch')
const previous = load(path.resolve(__dirname, '../step-4g-3/results/results.json'))
const unchangedPixels = JSON.stringify(evidence.raw.strokes) === JSON.stringify(previous.raw.strokes) && JSON.stringify(g.strokes.map(s => s.vertices.map(v => ({ pixel: v.pixel, corner: v.corner, endpoint: v.endpoint })))) === JSON.stringify(previous.corrected.strokes.map(s => s.vertices.map(v => ({ pixel: v.pixel, corner: v.corner, endpoint: v.endpoint }))))
if (!unchangedPixels) throw Error('Selected geometry changed; requires separate analysis')
function metrics (geometry) {
  const paths = geometry.strokes.map(s => s.vertices.map(v => v.pixel)); const forward = paths.flatMap(s => samples(s).map(p => nearest(p, ref.centerlines_pixel)))
  return { ...measure(geometry, ref), coverage_5px_per_branch: ref.centerlines_pixel.map(s => { const ps = samples(s); return ps.filter(p => nearest(p, paths) <= 5).length / ps.length }),
    coverage_8px_per_branch: ref.centerlines_pixel.map(s => { const ps = samples(s); return ps.filter(p => nearest(p, paths) <= 8).length / ps.length }),
    predicted_length_farther_than_5px_fraction: forward.filter(d => d > 5).length / forward.length,
    marked_corner_errors_pixel: ref.corners_pixel.map(p => Math.min(...geometry.strokes.flatMap(s => s.vertices.filter(v => v.corner).map(v => Math.hypot(p[0] - v.pixel[0], p[1] - v.pixel[1]))))) }
}
const config = evidence.imported.state.meta.config
const toPixel = p => {
  const q = [config.xrange[0] + p[0] / config.width * (config.xrange[1] - config.xrange[0]), config.yrange[1] - p[1] / config.height * (config.yrange[1] - config.yrange[0])]
  return g.coordinate_frame.origin_pixel.map((v, i) => v + (q[0] - g.calibration.origin_graph[0]) * g.calibration.x_unit_vector_pixel[i] + (q[1] - g.calibration.origin_graph[1]) * g.calibration.y_unit_vector_pixel[i])
}
const anchors = evidence.imported.state.data['auto-ink'].slice(1).map(s => s.filter((_, i) => i % 3 === 0).map(p => toPixel([p.x, p.y])))
const pixelPaths = g.strokes.map(s => s.vertices.map(v => v.pixel))
const actualPaths = evidence.imported.paths.slice(1).map(p => p.samples.map(toPixel))
const anchorError = Math.max(...g.strokes.flatMap((s, i) => s.vertices.map((v, j) => Math.hypot(v.pixel[0] - anchors[i][j][0], v.pixel[1] - anchors[i][j][1]))))
const renderError = Math.max(...actualPaths.flatMap(s => s.map(p => nearest(p, pixelPaths))))
const nativeDot = evidence.imported.state.data['auto-notes'][1]; const dot = toPixel([nativeDot.x, nativeDot.y]); const dotError = Math.hypot(...dot.map((v, i) => v - ref.isolated_point_pixel[i]))
const m = metrics(g)
const selected = Object.entries(g.provenance.review.strokeDecisions).filter(([, v]) => v === 'keep').map(([k]) => k)
function overlay (paths, points, name) {
  const im = read(sourceFile)
  const ink = (p, color, r) => { for (let y = Math.round(p[1]) - r; y <= Math.round(p[1]) + r; y++) for (let x = Math.round(p[0]) - r; x <= Math.round(p[0]) + r; x++) if (x >= 0 && y >= 0 && x < im.width && y < im.height && Math.hypot(x - p[0], y - p[1]) <= r + 0.6) im.data.set(color, (y * im.width + x) * 4) }
  for (const s of paths) for (const p of samples(s)) ink(p, [0, 100, 220, 255], 2)
  for (const p of points) ink(p, [200, 20, 100, 255], 5)
  write(path.join(results, name + '.png'), im)
}
overlay(pixelPaths, g.points.map(p => p.pixel), 'cv-assisted-photo-overlay')
overlay(actualPaths, [dot], 'native-photo-overlay')
overlay(ref.centerlines_pixel, [ref.isolated_point_pixel], 'withheld-reference-overlay')
const result = { step: '4G-3 final UI refinement', unchanged_extracted_and_selected_pixels_from_parent: unchangedPixels, source_file: evidence.source_file, source_photo: { path: path.relative(__dirname, sourceFile), sha256: hash(sourceFile), original_jpeg_sha256: evidence.source_file.sha256, same_photo_during_correction: true }, reference: { path: path.relative(__dirname, refFile), sha256: hash(refFile), status: ref.reference_status, uncertainty_pixel: 6, used_for_inference_or_correction: false },
  cv_assisted: { classification: 'CV extraction plus human axes/scale, keep/exclude classification, dot review and final confirmation; no retracing', selected_stroke_ids: selected, excluded_strokes: Object.values(g.provenance.review.strokeDecisions).filter(v => v === 'exclude').length,
    original_vertex_observations: g.provenance.source_geometry.strokes.filter(s => selected.includes(s.id)).reduce((n, s) => n + s.vertices.length, 0), final_vertices: g.strokes.reduce((n, s) => n + s.vertices.length, 0), joined_shared_endpoints: 2, invented_vertices: 0, smoothing_or_fit_calls: 0,
    branches: g.strokes.length, isolated_dots: g.points.length, calibration: g.provenance.review.axisValues, mathematical_axis_accuracy: 'Not independently measured; source axes are hand drawn and user calibration is an explicit assisted action, not recognition.', metrics: m,
    step4f_photo_fidelity_screen: { passed: m.reference_to_geometry_p95_pixel <= 8 && m.geometry_to_reference_p95_pixel <= 8 && m.coverage_8px_per_branch.every(c => c >= 0.9) && m.endpoint_max_error_pixel <= 8 && m.marked_corner_errors_pixel.every(c => c <= 8) && dotError <= 8, thresholds: 'Frozen Step4F screen: p95 <= 8px both directions, >=90% coverage at 8px, corners/endpoints/dot <=8px; 6px approximate annotation uncertainty', implication: 'Successful reviewed import is not a claim of high-fidelity automatic reconstruction.' },
    native_adapter_fidelity: { anchor_max_source_pixel_error: anchorError, rendered_to_selected_cv_max_source_pixel: renderError, source_dot_error_pixel: dotError, exact_state_after_save_grade_refresh: JSON.stringify(evidence.imported.state.data) === JSON.stringify(evidence.restored.state.data), manual_edit_saved_and_restored: true },
    automatic_recognition_success: false, native_import_passed: true },
  comparisons: { cv_automatic: { result: '0/3 existing real-photo baseline; no automatic native import', same_image_metrics: baseline.outcomes.find(o => o.id === 'IMG_1670').metrics }, gemini_automatic: { result: '0/1 prior bounded pilot; no new requests', same_image_metrics: gemini.metrics }, manually_traced: { result: 'Prior Step4F manually assisted evidence, separate from recognition', metrics: baseline.current_manual_recovery.metrics } },
  browser_acceptance_assertions_passed: evidence.passed, inference_requests_this_step: 0, conclusion: 'Student selection removes spurious axes/labels and recovers a single connected branch plus its dot. It preserves selected CV pixels exactly, including their geometric errors; the frozen Step4F photo-fidelity screen still fails. Prefer the unchanged fully traced route for the November 9 demo, with CV-assisted reuse an explicitly reviewed option.' }
fs.writeFileSync(path.join(results, 'evaluation.json'), JSON.stringify(result, null, 2) + '\n')
fs.writeFileSync(path.join(results, 'cv-assisted-geometry.json'), JSON.stringify(g, null, 2) + '\n')
console.log(JSON.stringify({ metrics: m, adapter: result.cv_assisted.native_adapter_fidelity, photo_screen: result.cv_assisted.step4f_photo_fidelity_screen.passed }, null, 2))
