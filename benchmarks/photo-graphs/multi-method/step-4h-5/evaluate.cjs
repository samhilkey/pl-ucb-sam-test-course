// Evaluate actual native SVG samples recorded by the local Chrome acceptance run.
// References here are retained measured/traced geometry, not ideal equations or
// independent human centerline annotations. Nothing in this file runs inference.
const fs = require('node:fs'); const path = require('node:path'); const crypto = require('node:crypto')
const A = require('../../../../elements/pl-sketch/star-adaptive-geometry.js')
const Native = require('../../../../elements/pl-sketch/star-native.js')
const PNG = require('../../../../tests/helpers/png.cjs')
const out = path.join(__dirname, 'results')
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'))
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
function summary (ds) { const s = ds.slice().sort((a, b) => a - b); return { mean: s.reduce((a, b) => a + b, 0) / s.length, p95: s[Math.floor((s.length - 1) * 0.95)], max: s.at(-1) } }
function compare (id, geometry, config, plan, paths, ids, image) {
  const counters = { polyline: 0, spline: 0 }; const allActual = []; const parts = []
  for (const part of plan.parts) {
    const actual = paths[ids[part.kind]][counters[part.kind]++]
    if (!actual?.samples?.length) throw Error('Missing recorded native path: ' + id)
    const stroke = geometry.strokes.find(s => s.id === part.source_stroke_id)
    const native = stroke.vertices.slice(part.source_range[0], part.source_range[1] + 1).map(v => Native.graphToNative(config, v.graph))
    const reference = native.map(p => A.toPhoto(p, geometry, config)); const rendered = actual.samples.map(p => A.toPhoto(p, geometry, config))
    const forward = A.lines(reference, 1).map(p => A.nearest(p, rendered)); const backward = rendered.map(p => A.nearest(p, reference))
    const cs = part.kind === 'spline' ? A.controls(part.points) : null
    const extrema = Object.fromEntries(['x', 'y'].map(axis => [axis, { reference: A.turns(native, axis), rendered: cs ? A.splineTurns(cs, axis) : A.turns(part.points, axis) }]))
    if (Object.values(extrema).some(t => t.rendered > t.reference)) throw Error('New significant extremum in ' + id)
    parts.push({ kind: part.kind, source_stroke_id: part.source_stroke_id, source_range: part.source_range, handles: part.points.length, actual_svg_sample_count: rendered.length, source_to_rendered_pixel: summary(forward), rendered_to_source_pixel: summary(backward), combined_pixel: summary(forward.concat(backward)), endpoint_displacement_pixel: [distance(reference[0], rendered[0]), distance(reference.at(-1), rendered.at(-1))], axis_direction_changes: extrema })
    allActual.push({ part, native: actual.samples, photo: rendered })
  }
  const branches = geometry.strokes.map(s => {
    const reference = s.vertices.map(v => ({ x: v.pixel[0], y: v.pixel[1] })); const rendered = allActual.filter(p => p.part.source_stroke_id === s.id).flatMap(p => p.photo)
    const forward = A.lines(reference, 1).map(p => A.nearest(p, rendered)); const backward = rendered.map(p => A.nearest(p, reference))
    const connected = allActual.filter(p => p.part.source_stroke_id === s.id)
    const jointGaps = connected.slice(1).map((p, i) => distance(connected[i].native.at(-1), p.native[0]))
    const landmarks = (plan.analyses.find(a => a.stroke_id === s.id).landmarks || []).map(l => {
      const source = s.vertices[l.index].pixel; const candidates = connected.flatMap(p => p.part.points.map(v => A.toPhoto(v, geometry, config)))
      return { ...l, displacement_source_pixel: Math.min(...candidates.map(p => Math.hypot(p.x - source[0], p.y - source[1]))) }
    })
    return { stroke_id: s.id, source_to_rendered_pixel: summary(forward), rendered_to_source_pixel: summary(backward), combined_pixel: summary(forward.concat(backward)), global_endpoint_displacement_source_pixel: [distance(reference[0], rendered[0]), distance(reference.at(-1), rendered.at(-1))], maximum_native_joint_gap: Math.max(0, ...jointGaps), landmarks }
  })
  const base = PNG.read(image)
  function dot (im, p, rgb, radius) { for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) { if (dx * dx + dy * dy > radius * radius) continue; const x = Math.round(p.x + dx); const y = Math.round(p.y + dy); if (x >= 0 && y >= 0 && x < im.width && y < im.height) { const k = (y * im.width + x) * 4; for (let c = 0; c < 3; c++) im.data[k + c] = rgb[c] } } }
  const original = { ...base, data: new Uint8ClampedArray(base.data) }; const adaptive = { ...base, data: new Uint8ClampedArray(base.data) }
  for (const stroke of geometry.strokes) { const ps = stroke.vertices.map(v => ({ x: v.pixel[0], y: v.pixel[1] })); for (const p of A.lines(ps, 0.5)) dot(original, p, [113, 58, 213], 2) }
  for (const p of allActual) for (const q of A.lines(p.photo, 0.5)) dot(adaptive, q, p.part.kind === 'spline' ? [0, 142, 79] : [113, 58, 213], 2)
  const prefix = path.join(out, id); PNG.write(prefix + '--original-trace-overlay.png', original); PNG.write(prefix + '--actual-native-overlay.png', adaptive)
  return { id, image_sha256: hash(image), measured_source_branches: geometry.strokes.length, native_spline_objects: plan.spline_count, native_polyline_objects: plan.polyline_count, original_handles: plan.original_handle_count, adaptive_handles: plan.handle_count, handle_reduction_percent: 100 * (1 - plan.handle_count / plan.original_handle_count), fitting_policy: plan.fitting_policy, branches, parts, baseline_original_trace_displacement_pixel: 0, reference_scope: 'Retained CV/manual centerline, not a blinded independent photograph annotation. Measures representation drift only.' }
}
const browser = read(path.join(out, 'browser/results.json')); const replays = read(path.join(out, 'replays/results.json'))
const g = browser.accepted.geometry; const config = browser.imported.meta.config
const main = compare('IMG_1678', g, config, browser.accepted.representation, browser.rendered.paths, { polyline: 'auto-draft', spline: 'auto-smooth' }, path.join(__dirname, '../step-4h-2/inputs/IMG_1678--source.png'))
const sources = require('./real-replays.cjs').cases()
const other = replays.cases.map(r => { const source = sources.find(c => c.id === r.id); return { ...compare(r.id, r.geometry, r.state.meta.config, r.plan, r.paths, { polyline: 'poly', spline: 'smooth' }, source.image), classification: r.source_kind, automatic_recognition: false, calibration_evidence: r.calibration_evidence } })
fs.writeFileSync(path.join(out, 'fidelity.json'), JSON.stringify({ scope: 'Actual rendered native paths, sampled at <=0.5 native-pixel arc length in Chrome. No target equation in recognition or fitting. Distances in original source pixels.', main: { ...main, classification: browser.classification, fully_automatic_numeric_calibration: false, uncorrected_scores: browser.uncorrected.scores, spline_edited_scores: browser.edited_saved.scores, student_corrected_scores: browser.student_corrected.scores, endpoint_hook_preserved_before_student_edit: true, isolated_point_detection: 'Not established by the real-photo CV route; existing annotation point retained.' }, additional_manual_representation_replays: other }, null, 2) + '\n')
console.log(JSON.stringify({ main: main.branches, handles: [main.original_handles, main.adaptive_handles], additional: other.map(r => ({ id: r.id, branches: r.measured_source_branches, handles: r.adaptive_handles })) }, null, 2))
