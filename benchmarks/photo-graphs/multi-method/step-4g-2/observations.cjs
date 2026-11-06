// Experimental observation validation/conversion only. No evaluator, question,
// image annotations, credential or network access. Returned vertices never move.
const fs = require('node:fs')
const path = require('node:path')
const Geometry = require('../../../../elements/pl-sketch/star-geometry.js')
const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../step-4a/observation.schema.json')))
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
function validateSchema (value, rule = schema, where = '$') {
  const types = Array.isArray(rule.type) ? rule.type : [rule.type]
  const matches = type => type === 'null' ? value === null : type === 'array' ? Array.isArray(value) : type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value)
    : type === 'number' ? typeof value === 'number' && Number.isFinite(value) : type === 'integer' ? Number.isInteger(value) : typeof value === type
  if (!types.some(matches)) throw new Error(where + ': wrong JSON type')
  if (rule.enum && !rule.enum.includes(value)) throw new Error(where + ': unsupported value')
  if (typeof value === 'number' && ((rule.minimum !== undefined && value < rule.minimum) || (rule.maximum !== undefined && value > rule.maximum))) throw new Error(where + ': numeric bounds')
  if (Array.isArray(value)) {
    if ((rule.minItems !== undefined && value.length < rule.minItems) || (rule.maxItems !== undefined && value.length > rule.maxItems)) throw new Error(where + ': array bounds')
    value.forEach((v, i) => validateSchema(v, rule.items, where + '[' + i + ']'))
  } else if (value !== null && typeof value === 'object') {
    for (const key of rule.required || []) if (!Object.hasOwn(value, key)) throw new Error(where + ': missing ' + key)
    for (const [key, v] of Object.entries(value)) {
      if (!Object.hasOwn(rule.properties || {}, key)) { if (rule.additionalProperties === false) throw new Error(where + ': unexpected ' + key) } else validateSchema(v, rule.properties[key], where + '.' + key)
    }
  }
  return value
}
function extract (response, width, height) {
  if (response.status !== 'completed' || response.model !== 'gemini-3.5-flash-lite' || !Array.isArray(response.steps)) throw new Error('Incomplete or mismatched provider envelope.')
  if (response.steps.some(s => !['thought', 'model_output', 'user_input'].includes(s.type))) throw new Error('Unexpected tool/action step; no continuation is allowed.')
  const output = response.steps.filter(s => s.type === 'model_output')
  if (output.length !== 1 || !Array.isArray(output[0].content) || !output[0].content.length || output[0].content.some(c => c.type !== 'text' || typeof c.text !== 'string')) throw new Error('Expected one text-only model output.')
  const text = output[0].content.map(c => c.text).join('')
  const observation = validateSchema(JSON.parse(text)) // No repairs or fence stripping.
  if (observation.image.width !== width || observation.image.height !== height) throw new Error('Response declares a different source image frame.')
  return { observation, text }
}

function convert (observation, revision = 0) {
  validateSchema(observation)
  const { width, height } = observation.image; const warnings = []; const assistance = []
  const warn = (code, message, target = 'geometry') => { warnings.push({ code, message }); assistance.push({ target, reason: code }) }
  const inside = p => p.every(Number.isFinite) && p[0] >= 0 && p[1] >= 0 && p[0] < width && p[1] < height
  const checkPoint = p => { if (!inside(p)) throw new Error('Observed pixel lies outside the declared source image.') }
  const frame = { status: 'uncertain', origin_pixel: null, axes: {}, grid: {} }
  for (const name of ['x', 'y']) {
    const axis = observation.axes[name]
    frame.grid[name] = { status: 'unknown', spacing_pixel: null, lines_pixel: [] }
    frame.axes[name] = { status: axis ? 'detected' : 'uncertain', candidates: [] }
    if (!axis) { warn('missing_axis', 'An axis is not identified.', name); continue }
    checkPoint(axis.start_pixel); checkPoint(axis.end_pixel)
    if (distance(axis.start_pixel, axis.end_pixel) < 1e-7) throw new Error('Degenerate observed axis.')
    frame.axes[name].candidates.push({ start: axis.start_pixel.slice(), end: axis.end_pixel.slice(), support: 0, width_pixel: 0 })
    for (const tick of axis.numeric_ticks) {
      checkPoint(tick.anchor_pixel); tick.bounds_pixel.forEach(checkPoint)
      if (tick.bounds_pixel[1].some((v, i) => v < tick.bounds_pixel[0][i])) throw new Error('Reversed tick text bounds.')
      if (tick.value === null) warn('unreadable_tick', 'A visible tick value is unknown.', name)
      else if (!/^[-+]?\d+(?:\.\d+)?$/.test(tick.text.replace('−', '-')) || Number(tick.text.replace('−', '-')) !== tick.value) warn('conflicting_tick_text', 'Tick text and numeric value do not agree.', name)
    }
  }
  if (observation.axes.x && observation.axes.y) {
    const x = observation.axes.x; const y = observation.axes.y
    const a = x.end_pixel.map((v, i) => v - x.start_pixel[i]); const b = y.end_pixel.map((v, i) => v - y.start_pixel[i]); const det = a[0] * b[1] - a[1] * b[0]
    if (Math.abs(det) > 1e-9) {
      const d = y.start_pixel.map((v, i) => v - x.start_pixel[i]); const t = (d[0] * b[1] - d[1] * b[0]) / det
      const origin = x.start_pixel.map((v, i) => v + t * a[i])
      if (inside(origin)) { frame.status = 'detected'; frame.origin_pixel = origin }
    }
  }
  if (!frame.origin_pixel) warn('ambiguous_origin', 'A bounded nonparallel axis intersection is not supported.', 'axes')
  const diagnostics = {}
  function scale (name) {
    const axis = observation.axes[name]; const ticks = axis?.numeric_ticks.filter(t => t.value !== null) || []
    const unknown = { status: 'unknown', source: 'unknown', labels: ticks.map(t => ({ value: t.value, anchor_pixel: t.anchor_pixel.slice(), bounds_pixel: t.bounds_pixel, match_error: 0 })) }
    if (!axis || !frame.origin_pixel || ticks.length < 2 || new Set(ticks.map(t => t.value)).size < 2) { warn('unknown_scale', 'Two distinct numeric tick anchors are required.', name); return unknown }
    const length = distance(axis.start_pixel, axis.end_pixel); const direction = axis.end_pixel.map((v, i) => (v - axis.start_pixel[i]) / length)
    const positions = ticks.map(t => t.anchor_pixel.reduce((s, v, i) => s + (v - frame.origin_pixel[i]) * direction[i], 0))
    const meanP = positions.reduce((a, b) => a + b, 0) / ticks.length; const meanV = ticks.reduce((s, t) => s + t.value, 0) / ticks.length
    const variance = positions.reduce((s, p) => s + (p - meanP) ** 2, 0)
    const slope = positions.reduce((s, p, i) => s + (p - meanP) * (ticks[i].value - meanV), 0) / variance; const intercept = meanV - slope * meanP
    if (!Number.isFinite(slope) || Math.abs(slope) < 1e-9) { warn('unknown_scale', 'Numeric ticks do not support a finite signed unit scale.', name); return unknown }
    const projected = ticks.map(t => frame.origin_pixel.map((v, i) => v + (t.value - intercept) / slope * direction[i]))
    const residuals = projected.map((p, i) => distance(p, ticks[i].anchor_pixel)); const maxResidual = Math.max(...residuals)
    const consistent = maxResidual <= 3 && maxResidual * Math.abs(slope) <= 0.05
    diagnostics[name] = { raw_anchors: ticks.map(t => t.anchor_pixel), affine_anchors: projected, residuals_pixel: residuals, maximum_residual_pixel: maxResidual,
      maximum_relative_unit_residual: maxResidual * Math.abs(slope), consistent, method: 'Numeric tick calibration only; no curve fitting, reference or configured ranges' }
    if (!consistent || projected.some(p => !inside(p))) { warn('inconsistent_tick_spacing', 'Numeric tick positions fail the frozen affine consistency screen; scale stays unknown.', name); return unknown }
    if (maxResidual > 1e-7) warn('approximate_tick_calibration', 'Affine tick anchors are approximate; raw observations are retained separately.', name)
    return { status: 'known', source: 'photo_detected', intersection_value: intercept, unit_vector: direction.map(v => v / slope), labels: ticks.map((t, i) => ({ value: t.value,
      anchor_pixel: projected[i], bounds_pixel: t.bounds_pixel, match_error: Math.min(1, residuals[i] * Math.abs(slope)) })) }
  }
  const scales = { x: scale('x'), y: scale('y') }; const calibrated = ['x', 'y'].every(a => scales[a].status === 'known') && frame.status === 'detected'
  const calibration = { status: calibrated ? 'calibrated' : 'uncertain', axes: scales, origin_graph: calibrated ? [scales.x.intersection_value, scales.y.intersection_value] : null,
    x_unit_vector_pixel: calibrated ? scales.x.unit_vector : null, y_unit_vector_pixel: calibrated ? scales.y.unit_vector : null }
  const components = new Map(); const ids = new Set()
  const strokes = observation.strokes.map(s => {
    if (!s.id || ids.has(s.id) || s.vertices.length < 2) throw new Error('Missing/duplicate stroke identity or insufficient vertices.')
    ids.add(s.id); s.vertices.forEach(v => checkPoint(v.pixel))
    const component = s.component_id === null ? 'unresolved-' + s.id : s.component_id
    if (s.component_id === null) warn('unresolved_component', 'Provider left physical component membership unknown; no join is inferred.', s.id)
    if (!components.has(component)) components.set(component, [])
    components.get(component).push(s.id)
    for (const axis of Object.values(observation.axes).filter(Boolean)) if (s.vertices.length === 2 &&
      ((distance(s.vertices[0].pixel, axis.start_pixel) < 1e-7 && distance(s.vertices[1].pixel, axis.end_pixel) < 1e-7) ||
      (distance(s.vertices[1].pixel, axis.start_pixel) < 1e-7 && distance(s.vertices[0].pixel, axis.end_pixel) < 1e-7))) warn('axis_as_answer_stroke', 'An observed axis is also returned as an answer stroke; it is retained and blocks import.', s.id)
    return { id: s.id, component_id: component, kind: 'polyline', closed: s.closed, simplification_tolerance_pixel: 0,
      vertices: s.vertices.map(v => ({ ...v, pixel: v.pixel.slice(), graph: Geometry.pixelToGraph(v.pixel, frame, calibration) })) }
  })
  observation.isolated_points.forEach(checkPoint)
  if (observation.isolated_points.length) warn('unsupported_isolated_points', 'Isolated points are retained in the observation sidecar; the stroke-only adapter cannot import them.', 'points')
  for (const reason of observation.uncertainty.reasons) warn('provider_uncertainty', reason)
  if (observation.junctions.length) warn('unresolved_junctions', 'Observed junctions require review; no branch pairing is invented.')
  for (const r of observation.uncertainty.regions) checkPoint(r.pixel)
  // Photo Geometry v1 bounds processing dimensions to 1200px. This is a
  // LOCAL adapter-preview frame only, never an inferred Gemini preprocessing
  // transform. Every returned vertex stays in the original-image pixel frame.
  const factor = Math.min(1, 900 / Math.max(width, height)); const pw = Math.round(width * factor); const ph = Math.round(height * factor)
  const sx = pw / width; const sy = ph / height
  const geometry = { schema_version: 1, input_revision: revision, image: { width, height, processing: { width: pw, height: ph, source_to_processing: [sx, 0, 0, sy, (sx - 1) / 2, (sy - 1) / 2] } },
    coordinate_frame: frame, calibration, strokes, topology: { stroke_count: strokes.length, component_count: components.size,
      components: [...components].map(([id, stroke_ids]) => ({ id, stroke_ids })), junctions: observation.junctions },
    status: !strokes.length ? 'abstained' : warnings.length || !calibrated ? 'needs_review' : 'automatic', warnings, assistance,
    uncertainty: { confidence_kind: 'heuristic_not_probability', regions: observation.uncertainty.regions,
      assumptions: ['Provider observations require pixel-level evaluation; JSON validity does not establish faithful recognition.'] },
    provenance: { method: 'gemini_vlm', automatically_recognized: true, geometry_modified: false,
      axis_support_value: 'Zero is a compatibility placeholder; local pixel support was not measured.',
      processing_frame_role: 'Local adapter preview only; not Gemini internal preprocessing. Original full-size PNG was transmitted.', component_ids_for_null_membership: 'Bookkeeping only, unresolved and import-blocking; not a physical component-count claim.' } }
  Geometry.validate(geometry)
  return { geometry, calibration_diagnostics: diagnostics, isolated_points: observation.isolated_points, raw_component_ids: observation.strokes.map(s => ({ id: s.id, component_id: s.component_id })) }
}
module.exports = { validateSchema, extract, convert }
