// Post-inference/UI evaluation only. Never imported by recognition or transport.
const fs = require('node:fs'); const path = require('node:path')
const PNG = require('../../../../tests/helpers/png.cjs')
const root = __dirname; const out = path.join(root, 'results')
const run = JSON.parse(fs.readFileSync(path.join(out, 'browser/results.json')))
const real = run.real_photo; const g = real.accepted.geometry; const config = real.imported.meta.config
const im = PNG.read(path.join(root, '../step-4h-2/inputs/IMG_1678--source.png'))
const source = p => {
  const x = config.xrange[0] + p.x * (config.xrange[1] - config.xrange[0]) / config.width - g.calibration.origin_graph[0]
  const y = config.yrange[1] - p.y * (config.yrange[1] - config.yrange[0]) / config.height - g.calibration.origin_graph[1]
  return g.coordinate_frame.origin_pixel.map((v, i) => v + x * g.calibration.x_unit_vector_pixel[i] + y * g.calibration.y_unit_vector_pixel[i])
}
const original = real.imported.data['auto-draft'].filter(ps => ps.length >= 2).map(ps => ps.map(source))
const edited = real.vertex_edit_after.curves.map(ps => ps.map(source))
function sample (paths) {
  return paths.flatMap(ps => ps.slice(1).flatMap((b, i) => { const a = ps[i]; const n = Math.max(1, Math.ceil(Math.hypot(...b.map((v, j) => v - a[j])))); return Array.from({ length: n + 1 }, (_, k) => a.map((v, j) => v + (b[j] - v) * k / n)) }))
}
function inkSupport (paths) {
  const points = sample(paths); let hits = 0
  for (const p of points) {
    let hit = false
    for (let y = -3; y <= 3 && !hit; y++) for (let x = -3; x <= 3; x++) {
      if (x * x + y * y > 9) continue
      const px = Math.round(p[0]) + x; const py = Math.round(p[1]) + y
      if (px < 0 || py < 0 || px >= im.width || py >= im.height) continue
      const k = (py * im.width + px) * 4
      if (0.299 * im.data[k] + 0.587 * im.data[k + 1] + 0.114 * im.data[k + 2] < 125) { hit = true; break }
    }
    if (hit) hits++
  }
  return { dark_ink_support_fraction: hits / points.length, samples: points.length, threshold_gray: 125, radius_source_pixel: 3,
    interpretation: 'Ink-support diagnostic only. Axes and labels also count as dark ink; this is not reference coverage, graph accuracy or a topology score. Canonical metadata-free PNG is the evaluator raster; browser recognition used the original JPEG.' }
}
function overlay (paths, rgb, name) {
  const rendered = { ...im, data: new Uint8ClampedArray(im.data) }
  for (const p of sample(paths)) { const x = Math.round(p[0]); const y = Math.round(p[1]); for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (xx >= 0 && yy >= 0 && xx < im.width && yy < im.height) rendered.data.set([...rgb, 255], (yy * im.width + xx) * 4) }
  PNG.write(path.join(out, name), rendered)
}
const anchorErrors = original.flatMap((ps, i) => ps.map((p, j) => Math.hypot(...p.map((v, k) => v - g.strokes[i].vertices[j].pixel[k]))))
const changed = real.vertex_edit_before.curves.flatMap((ps, k) => ps.flatMap((p, i) => { const q = real.vertex_edit_after.curves[k][i]; return p.x !== q.x || p.y !== q.y ? [{ curve: k, vertex: i, native_delta: [q.x - p.x, q.y - p.y], source_pixel_delta: edited[k][i].map((v, j) => v - original[k][i][j]) }] : [] }))
const report = { method: 'CV-assisted editable draft; manual axes, algorithmic reuse of measured CV paths, explicit acceptance, native vertex correction',
  automatic_calibration_success: false, gemini_semantics_used: false, manual_tracing_used: false, manual_curve_endpoint_selection_used: false,
  native_branches: original.length, native_vertices: original.map(ps => ps.length), maximum_native_anchor_error_pixel: real.preservation.maximum_native_anchor_error_pixel,
  maximum_source_anchor_round_trip_error_pixel: Math.max(...anchorErrors), measured_hook_retained_before_student_edit: true,
  measured_hook_reverse_graph_x_units: Math.abs(real.preservation.violations[0].graph[1][0] - real.preservation.violations[0].graph[0][0]),
  simplification_tolerance_source_pixel: g.strokes.map(s => s.simplification_tolerance_pixel), before_edit: inkSupport(original), after_student_edit: inkSupport(edited), changed_vertices: changed,
  original_native_grade: real.uncorrected.scores[0], student_corrected_native_grade: real.corrected.scores[0],
  geometry_accuracy_against_independent_reference: null, reason: 'No independent blinded real-photo centerline/topology annotation. Native preservation and dark-ink support do not establish recognition accuracy.',
  isolated_dot_recognition: 'Not resolved by this draft suggestion. Embedded dark marks stay in measured path geometry and the original photo; no spurious isolated point objects are created.',
  controlled_raster_grades_not_real_photo_metrics: { original: run.controlled_raster.good.scores[0], deliberately_changed_vertex: run.controlled_raster.edited.scores[0] } }
overlay(original, [0, 165, 65], 'IMG_1678--accepted-native-overlay.png'); overlay(edited, [225, 90, 20], 'IMG_1678--student-edited-overlay.png')
fs.writeFileSync(path.join(out, 'fidelity.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ original_grade: report.original_native_grade, corrected_grade: report.student_corrected_native_grade, anchor_error: report.maximum_native_anchor_error_pixel, ink_support: report.before_edit.dark_ink_support_fraction, changed_vertices: changed.length }))
