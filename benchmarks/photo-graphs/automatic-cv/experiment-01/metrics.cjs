// Evaluator-only image-space metrics. Never imported by the recognizer.
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
function segmentDistance (p, a, b) {
  const dx = b[0] - a[0]; const dy = b[1] - a[1]; const l2 = dx * dx + dy * dy
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0
  return distance(p, [a[0] + t * dx, a[1] + t * dy])
}
const nearest = (p, strokes) => strokes.length ? Math.min(...strokes.flatMap(s => s.slice(1).map((b, i) => segmentDistance(p, s[i], b)))) : Infinity
function samples (stroke) {
  const out = []
  stroke.slice(1).forEach((b, i) => {
    const a = stroke[i]; const n = Math.max(1, Math.ceil(distance(a, b)))
    for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n])
  })
  return out.concat([stroke.at(-1)])
}
const p95 = xs => xs.length ? xs.slice().sort((a, b) => a - b)[Math.floor(0.95 * (xs.length - 1))] : null
function measure (geometry, ref) {
  const expected = ref.centerlines_pixel; const actual = geometry.strokes.map(s => s.vertices.map(v => v.pixel))
  const referenceDistances = expected.map(s => samples(s).map(p => nearest(p, actual)))
  const actualDistances = actual.flatMap(s => samples(s).map(p => nearest(p, expected)))
  const coverage = referenceDistances.map(ds => ds.filter(d => d <= 3).length / ds.length)
  const endpoints = expected.flatMap(s => [s[0], s.at(-1)])
  const actualEnds = actual.flatMap(s => [s[0], s.at(-1)])
  const endpointErrors = endpoints.map(p => actualEnds.length ? Math.min(...actualEnds.map(q => distance(p, q))) : Infinity)
  const corner = ref.corner_pixel || (ref.drawing_id === 'controlled-v' ? ref.centerlines_pixel[0][2] : null)
  const corners = geometry.strokes.flatMap(s => s.vertices.filter(v => v.corner).map(v => v.pixel))
  const finite = n => Number.isFinite(n) ? n : null
  const falseConnections = actual.filter(s => {
    const counts = expected.map(e => samples(s).filter(p => nearest(p, [e]) <= 3).length)
    return counts.filter(n => n >= 10).length > 1
  }).length
  return {
    expected_strokes: ref.expected_strokes, extracted_paths: actual.length, extracted_components: geometry.topology.component_count,
    branch_count_correct: ref.expected_strokes === null ? null : actual.length === ref.expected_strokes,
    missing_strokes: coverage.filter(c => c < 0.1).length, partially_missing_strokes: coverage.filter(c => c >= 0.1 && c < 0.9).length,
    false_connections: falseConnections,
    spurious_paths: actual.filter(s => samples(s).every(p => nearest(p, expected) > 5)).length,
    reference_to_geometry_p95_pixel: finite(p95(referenceDistances.flat())), geometry_to_reference_p95_pixel: finite(p95(actualDistances)),
    reference_centerline_coverage_within_3px: coverage, endpoint_max_error_pixel: finite(Math.max(...endpointErrors)),
    corner_error_pixel: corner && corners.length ? Math.min(...corners.map(p => distance(p, corner))) : null,
    axis_origin_error_pixel: ref.origin_pixel && geometry.coordinate_frame.origin_pixel ? distance(ref.origin_pixel, geometry.coordinate_frame.origin_pixel) : null,
    note: ref.source_kind === 'real_photo' ? 'Approximate prior visual annotations; not independent human ground truth. Null distances mean no output, not zero error.' : 'Controlled raster centerline diagnostics; not grading validity or physical-photo accuracy.'
  }
}
module.exports = { measure, nearest, samples }
