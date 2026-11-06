// Evaluator-only. Invoked after the sole real response has been saved/validated.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const Geometry = require('../../../../elements/pl-sketch/star-geometry.js')
const Providers = require('../../../../elements/pl-sketch/star-providers.js')
const Native = require('../../../../elements/pl-sketch/star-native.js')
const { read, write } = require('../../../../tests/helpers/png.cjs')
const { measure, nearest, samples } = require('../../automatic-cv/experiment-01/metrics.cjs')
const root = __dirname; const directory = path.join(root, 'results')
const load = file => JSON.parse(fs.readFileSync(file))
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const save = (file, value) => fs.writeFileSync(path.join(directory, file), JSON.stringify(value, null, 2) + '\n')
const attempt = load(path.join(directory, 'attempt.json')); const validation = load(path.join(directory, 'validation.json'))
if (attempt.source_kind !== 'real_provider_request' || attempt.http_status !== 200 || !validation.photo_geometry_v1_valid) throw new Error('Validated real response required; no fixture fallback.')
const policy = load(path.join(root, 'evaluation-policy.json')); const c = policy.cases[0]
for (const key of ['reference', 'cv_prediction', 'cv_evaluation', 'manual_comparison']) if (hash(path.resolve(root, c[key])) !== c[key + '_sha256']) throw new Error('Withheld reference/comparison hash changed: ' + key)
const reference = load(path.resolve(root, c.reference)); const converted = load(path.join(directory, 'conversion.json'))
const g = Geometry.validate(converted.geometry); const observation = load(path.join(directory, 'observation.json'))
const source = read(path.resolve(root, '../step-4g-1/results/IMG_1670--source.png'))
if (hash(path.resolve(root, '../step-4g-1/results/IMG_1670--source.png')) !== attempt.image_sha256) throw new Error('Evaluation image mismatch.')
const paths = g.strokes.map(s => s.vertices.map(v => v.pixel))
const metrics = measure(g, reference)
metrics.adapter_bookkeeping_component_count = metrics.extracted_components
if (observation.strokes.some(s => s.component_id === null)) metrics.extracted_components = null
const coverage = n => reference.centerlines_pixel.map(s => { const ps = samples(s); return ps.filter(p => nearest(p, paths) <= n).length / ps.length })
const predictedDistances = paths.flatMap(s => samples(s).map(p => nearest(p, reference.centerlines_pixel)))
const cornerErrors = reference.corners_pixel.map(p => {
  const corners = g.strokes.flatMap(s => s.vertices.filter(v => v.corner))
  return corners.length ? Math.min(...corners.map(v => Math.hypot(...p.map((x, i) => x - v.pixel[i])))) : null
})
const pointDistances = observation.isolated_points.map(p => Math.hypot(...p.map((x, i) => x - reference.isolated_point_pixel[i])))
const screen = policy.engineering_screen
const fidelityPassed = metrics.branch_count_correct && !metrics.spurious_paths && !metrics.false_connections &&
  metrics.reference_to_geometry_p95_pixel !== null && metrics.reference_to_geometry_p95_pixel <= screen.bidirectional_p95_max_source_pixel &&
  metrics.geometry_to_reference_p95_pixel <= screen.bidirectional_p95_max_source_pixel && metrics.endpoint_max_error_pixel <= screen.endpoint_corner_max_error_source_pixel &&
  metrics.reference_centerline_coverage_within_3px.every(v => v >= screen.minimum_coverage_per_branch) && cornerErrors.every(e => e !== null && e <= screen.endpoint_corner_max_error_source_pixel) &&
  observation.isolated_points.length === 1 && pointDistances.every(d => d <= 5)
const candidate = Providers.candidate(g, { provider: 'gemini', inputRevision: g.input_revision, width: g.image.width, height: g.image.height })
// No reference/configuration entered recognition or conversion. Receiving
// config is loaded only here for an offline test of unchanged native guards.
const config = load(path.resolve(root, '../step-4g-1/results/recovery.json')).imported.state.meta.config
const nativeData = { 'auto-ink': [], 'auto-notes': [{ x: 40, y: 50 }] }; const before = JSON.stringify(nativeData); let setStateCalls = 0
const si = { getState: () => JSON.stringify({ data: nativeData }), setState: () => { setStateCalls++ } }
const session = Native.createSession(si, config); session.invalidate(g.input_revision)
const nativeCheck = { provider_method: candidate.method, geometry_valid: true, propose_succeeded: false, commit_called: false, imported: false }
try { session.propose(candidate.geometry); nativeCheck.propose_succeeded = true } catch (error) { nativeCheck.rejection = error.message }
nativeCheck.set_state_calls = setStateCalls; nativeCheck.existing_objects_unchanged = JSON.stringify(nativeData) === before
nativeCheck.import_eligible = fidelityPassed && g.status === 'automatic' && nativeCheck.propose_succeeded
save('native-check.json', nativeCheck)

function annotate (image, strokePaths, points, axes, color = [240, 115, 0]) {
  const im = { ...image, data: image.data.slice() }
  const dot = (p, color, radius = 1) => { for (let dx = -radius; dx <= radius; dx++) for (let dy = -radius; dy <= radius; dy++) {
    const x = Math.round(p[0]) + dx; const y = Math.round(p[1]) + dy
    if (x >= 0 && y >= 0 && x < im.width && y < im.height) im.data.set([...color, 255], (y * im.width + x) * 4)
  } }
  const line = (a, b, color, radius = 1) => samples([a, b]).forEach(p => dot(p, color, radius))
  for (const a of axes) line(a.start_pixel, a.end_pixel, [0, 160, 210], 2)
  for (const s of strokePaths) for (let i = 1; i < s.length; i++) line(s[i - 1], s[i], color)
  for (const p of points) { line([p[0] - 9, p[1]], [p[0] + 9, p[1]], [200, 0, 160], 2); line([p[0], p[1] - 9], [p[0], p[1] + 9], [200, 0, 160], 2) }
  return im
}
let overlay = annotate(source, paths, observation.isolated_points, Object.values(observation.axes).filter(Boolean))
// Marker annotations are drawn only at provider-returned coordinates.
overlay = annotate(overlay, g.strokes.flatMap(s => s.vertices.filter(v => v.corner).map(v => [[v.pixel[0] - 7, v.pixel[1] - 7], [v.pixel[0] + 7, v.pixel[1] + 7]])), [], [], [220, 20, 40])
overlay = annotate(overlay, g.strokes.flatMap(s => s.vertices.filter(v => v.endpoint).map(v => [[v.pixel[0] - 5, v.pixel[1] + 5], [v.pixel[0] + 5, v.pixel[1] - 5]])), [], [], [0, 160, 70])
write(path.join(directory, 'gemini-raw-overlay.png'), overlay)
write(path.join(directory, 'reference-overlay.png'), annotate(source, reference.centerlines_pixel, [reference.isolated_point_pixel], [], [0, 110, 230]))
const preview = { width: g.image.processing.width, height: g.image.processing.height, data: new Uint8ClampedArray(g.image.processing.width * g.image.processing.height * 4) }
for (let y = 0; y < preview.height; y++) for (let x = 0; x < preview.width; x++) {
  const sx = Math.min(source.width - 1, Math.floor((x + 0.5) * source.width / preview.width)); const sy = Math.min(source.height - 1, Math.floor((y + 0.5) * source.height / preview.height))
  preview.data.set(source.data.subarray((sy * source.width + sx) * 4, (sy * source.width + sx) * 4 + 4), (y * preview.width + x) * 4)
}
write(path.join(directory, 'adapter-preview-only.png'), preview)
const prior = load(path.resolve(root, c.cv_evaluation)).outcomes.find(o => o.id === 'IMG_1670')
const manual = load(path.resolve(root, c.manual_comparison)).outcomes.find(o => o.id === 'new-paper-01' && o.trial === 'desktop')
const evaluation = { version: '4g2.3', method: 'Gemini automatic', source_kind: 'real_provider_request', case_id: 'IMG_1670',
  schema_valid: true, photo_geometry_v1_valid: true, fidelity_screen_passed: !!fidelityPassed, native_imported: false,
  metrics: { ...metrics, reference_coverage_5px: coverage(5), reference_coverage_8px: coverage(8), marked_corner_errors_pixel: cornerErrors,
    predicted_length_farther_than_5px_fraction: predictedDistances.filter(d => d > 5).length / predictedDistances.length,
    isolated_point: { expected: 1, predicted: observation.isolated_points.length, errors_pixel: pointDistances, retained_in_sidecar: true, native_import_unsupported: true } },
  topology: { raw_stroke_count: observation.strokes.length, raw_component_ids: converted.raw_component_ids, physical_component_count: null,
    components_in_v1_are_unresolved_bookkeeping: true, junctions: observation.junctions, duplicate_axes_retained_as_strokes: g.warnings.filter(w => w.code === 'axis_as_answer_stroke').length },
  axes: { origin_pixel_from_provider_lines: g.coordinate_frame.origin_pixel, grid_spacing_not_assumed: true, numeric_tick_values: Object.fromEntries(['x', 'y'].map(a => [a, observation.axes[a]?.numeric_ticks.map(t => t.value)])),
    calibration_status: g.calibration.status, diagnostics: converted.calibration_diagnostics, independently_measured_axis_accuracy: null,
    note: 'Declared axes are visibly misplaced on the raw overlay. No independent numeric frame annotation; no calibration accuracy pass.' },
  uncertainty: { provider_reasons: observation.uncertainty.reasons, local_warnings: g.warnings, provider_empty_uncertainty_is_not_evidence_of_accuracy: true },
  source_vertices_preserved_exactly: g.strokes.every((s, i) => s.vertices.every((v, j) => JSON.stringify(v.pixel) === JSON.stringify(observation.strokes[i].vertices[j].pixel))),
  raw_coordinates_rescaled_or_repaired: false, native_check: nativeCheck,
  paired_comparison: { cv_automatic: { metrics: prior.metrics, status: prior.status, imported: false }, gemini_automatic: { metrics, status: g.status, imported: false },
    manually_assisted: { classification: manual.classification, metrics: manual.metrics, dot: 'Manually placed with native point tool; not recognition' } },
  aggregate_context: { cv_successes: 0, cv_cases: 3, gemini_successes: 0, gemini_cases: 1, paired_cases: 1, general_accuracy_claim: false },
  annotation_caveat: policy.reference_quality + '; source annotation uncertainty is about 6px; failures far exceed it',
  finding: 'Two peak flags and a separate-dot count are semantic clues, but coordinates, curvature, connectivity and calibration are unfaithful. JSON validity does not establish recognition success.',
  recommendation: 'Keep the constrained assisted workflow for November 9. Do not integrate VLM-only recognition. Any VLM-guided CV or coordinate-grounding research requires a separate subsequent approval.' }
save('evaluation.json', evaluation)
validation.recognition_fidelity_passed = !!fidelityPassed; save('validation.json', validation)
console.log(JSON.stringify({ fidelity_passed: !!fidelityPassed, metrics: evaluation.metrics, native_check: nativeCheck }, null, 2))
