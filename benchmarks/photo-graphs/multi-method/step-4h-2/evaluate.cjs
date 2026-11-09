// Evaluator-only. Reads actual UI outputs after recognition/correction finish.
const fs = require('node:fs'); const path = require('node:path')
const Geometry = require('../../../../elements/pl-sketch/star-geometry.js'); const Targeted = require('../../../../elements/pl-sketch/star-targeted.js'); const PNG = require('../../../../tests/helpers/png.cjs')
const { measure, nearest } = require('../../automatic-cv/experiment-01/metrics.cjs')
const root = __dirname; const out = path.join(root, 'results'); const read = p => JSON.parse(fs.readFileSync(path.join(out, p)))
const a = read('normal-ui/results.json'); const b = read('new-paper/results.json')
const sourcePoint = (p, g, c) => {
  const x = c.xrange[0] + p[0] * (c.xrange[1] - c.xrange[0]) / c.width - g.calibration.origin_graph[0]
  const y = c.yrange[1] - p[1] * (c.yrange[1] - c.yrange[0]) / c.height - g.calibration.origin_graph[1]
  return g.coordinate_frame.origin_pixel.map((v, i) => v + x * g.calibration.x_unit_vector_pixel[i] + y * g.calibration.y_unit_vector_pixel[i])
}
function preservation (g, native, config, offset) {
  const measured = g.strokes.map(s => s.vertices.map(v => v.pixel))
  const anchors = native.curves.slice(offset).map(ps => ps.filter((_, i) => i % 3 === 0).map(p => sourcePoint([p.x, p.y], g, config)))
  const rendered = native.curves.slice(offset).map(ps => {
    const points = []
    for (let i = 0; i < ps.length - 1; i += 3) for (let j = 0; j <= 20; j++) { const t = j / 20; const u = 1 - t; points.push(sourcePoint(['x', 'y'].map(k => u ** 3 * ps[i][k] + 3 * u * u * t * ps[i + 1][k] + 3 * u * t * t * ps[i + 2][k] + t ** 3 * ps[i + 3][k]), g, config)) }
    return points
  })
  return { measured_branch_count: g.topology.component_count, native_object_count_added: anchors.length,
    maximum_anchor_error_source_pixel: Math.max(...anchors.flatMap((ps, i) => ps.map((p, j) => Math.hypot(...p.map((v, k) => v - measured[i][j][k]))))),
    maximum_rendered_drift_from_input_geometry_source_pixel: Math.max(...rendered.flatMap((ps, i) => ps.map(p => nearest(p, [measured[i]])))), rendered }
}
function overlay (image, paths, dots, target) {
  const im = PNG.read(image); const pixel = (p, rgb) => { const x = Math.round(p[0]); const y = Math.round(p[1]); if (x >= 0 && y >= 0 && x < im.width && y < im.height) im.data.set([...rgb, 255], (y * im.width + x) * 4) }
  for (const ps of paths) for (let i = 1; i < ps.length; i++) { const x = ps[i - 1]; const y = ps[i]; const n = Math.max(1, Math.ceil(Math.hypot(...y.map((v, j) => v - x[j])) * 2)); for (let k = 0; k <= n; k++) pixel(x.map((v, j) => v + (y[j] - v) * k / n), [0, 180, 75]) }
  for (const p of dots) for (let k = -8; k <= 8; k++) { pixel([p[0] + k, p[1]], [190, 0, 190]); pixel([p[0], p[1] + k], [190, 0, 190]) }
  PNG.write(path.join(out, target), im)
}
const g = a.imports[0].geometry; const c = a.paper.submission.meta.config; const p = preservation(g, a.paper.native, c, a.imports[0].receipt.firstObjectIndex)
const dotA = sourcePoint([a.paper.native.points[1].x, a.paper.native.points[1].y], g, c)
const metricA = { classification: 'CV-assisted: manual axes/values, endpoint selection and isolated-dot selection', actual_photo: 'IMG_1670.jpg', automatic_success: false,
  photo_accuracy: measure(g, require('../step-4f/reference.json')), native_preservation: { ...p, rendered: undefined },
  selected_dot_native_error_source_pixel: Math.hypot(...dotA.map((v, i) => v - g.points[0].pixel[i])), selected_dot_error_vs_approximate_prior_reference_pixel: Math.hypot(dotA[0] - 821, dotA[1] - 294), grade: '0%', grade_target_matches_photo: false }
overlay(path.resolve(root, '../step-4g-1/results/IMG_1670--source.png'), p.rendered, [dotA], 'IMG_1670--native-overlay.png')
const h = b.assisted_accepted.geometry; const q = b.original_grade.submission.meta.config; const r = preservation(h, b.imported, q, 0)
const dotsB = b.imported.points.slice(1).map(p => sourcePoint([p.x, p.y], h, q))
const maxDot = Math.max(...dotsB.map((p, i) => Math.hypot(...p.map((v, j) => v - b.manual_mark_source_pixels[i][j]))))
const endpointError = [h.strokes[0].vertices[0].pixel, h.strokes[0].vertices.at(-1).pixel].map((p, i) => Math.hypot(...p.map((v, j) => v - (i ? b.manual_curve_source_pixels.at(-1) : b.manual_curve_source_pixels[0])[j])))
const x = h.coordinate_frame.origin_pixel; const v = h.calibration
const values = { origin: x, xMarker: x.map((v0, i) => v0 + 4 * v.x_unit_vector_pixel[i]), yMarker: x.map((v0, i) => v0 + 4 * v.y_unit_vector_pixel[i]), xValue: 4, yValue: 4 }
const rejected = Targeted.fromSelection({ source: b.initial_automatic.geometry, photoSha256: b.original_sha256, axisValues: values, selections: [[[483, 310], [1193, 275]]], pointSelections: [], inputRevision: b.initial_automatic.geometry.input_revision })
const backtracks = rejected.strokes.flatMap(s => { const direction = Math.sign(s.vertices.at(-1).graph[0] - s.vertices[0].graph[0]); return s.vertices.slice(1).map((p, i) => (p.graph[0] - s.vertices[i].graph[0]) * direction).filter(d => d < -1e-10) })
const tickDiagnostics = [{ axis: 'x', value: 2, pixel: [1147, 1134] }, { axis: 'x', value: -2, pixel: [557, 1160] }, { axis: 'x', value: -4, pixel: [238, 1179] }, { axis: 'y', value: 2, pixel: [831, 823] }, { axis: 'y', value: -2, pixel: [866, 1462] }].map(t => { const actual = Geometry.pixelToGraph(t.pixel, h.coordinate_frame, h.calibration); return { ...t, derived: actual, error_axis_units: actual[t.axis === 'x' ? 0 : 1] - t.value } })
const metricB = { classification: b.recovery_method, actual_photo: 'IMG_1678.jpg', automatic_success: false, cv_import_blocked: b.assisted_cv_import_blocked, blocker: b.blocker,
  rejected_candidate_x_backtrack_segments: backtracks.length, largest_backtrack_graph_x_units: backtracks.length ? Math.max(...backtracks.map(Math.abs)) : 0,
  native_preservation: { ...r, rendered: undefined }, endpoint_error_vs_captured_manual_pointer_source_pixel: endpointError, maximum_native_mark_center_error_vs_manual_photo_click_source_pixel: maxDot,
  photo_fidelity_ground_truth: 'No independent blinded centerline annotation. Preservation metrics compare with the captured manual trace/point clicks, not a recognition accuracy claim.',
  additional_written_tick_diagnostics: tickDiagnostics, tick_reference_quality: 'Approximate evaluator-only visual ticks, post hoc same observer, not used to fit the frame or sent to the recognizer.',
  calibration_scope: 'Affine alignment at three explicitly selected anchors. Hand-drawn tick spacing/axes are nonuniform; global calibration is not established by those three anchors.',
  original_visible_grade: b.original_grade.scores[0].trim(), edited_visible_grade: b.edited_grade.scores[0].trim(), grade_target_matches_user_intent: true, attached_dots_manually_placed: dotsB.length, point_tool_has_grading_criterion: false }
overlay(path.join(root, 'inputs/IMG_1678--source.png'), r.rendered, dotsB, 'IMG_1678--native-overlay.png')
fs.writeFileSync(path.join(out, 'fidelity.json'), JSON.stringify({ step: '4H-2', evaluator_only: true, recognition_calls: 0, IMG_1670: metricA, IMG_1678: metricB }, null, 2) + '\n')
console.log(JSON.stringify({ IMG_1670_source_p95: metricA.photo_accuracy.reference_to_geometry_p95_pixel, IMG_1670_native_drift: p.maximum_rendered_drift_from_input_geometry_source_pixel, IMG_1678_native_drift: r.maximum_rendered_drift_from_input_geometry_source_pixel, IMG_1678_original_grade: metricB.original_visible_grade, IMG_1678_mark_error: maxDot }))
