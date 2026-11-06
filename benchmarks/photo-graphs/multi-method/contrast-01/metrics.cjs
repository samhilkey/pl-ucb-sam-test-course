// Evaluator only. Never imported by preprocessing or inference.
const { measure, nearest, samples } = require('../../automatic-cv/experiment-01/metrics.cjs')
const finite = v => Number.isFinite(v) ? v : null
const fraction = values => values.length ? values.filter(Boolean).length / values.length : null
const coverage = (points, paths, tolerance) => fraction(points.map(p => nearest(p, paths) <= tolerance))
const p95 = xs => xs.length ? xs.slice().sort((a, b) => a - b)[Math.floor(0.95 * (xs.length - 1))] : null

function maskCoverage (points, mask, geometry, tolerance = 3) {
  if (!points.length) return null
  const { width, height } = mask
  const [sx, , , sy, tx, ty] = geometry.image.processing.source_to_processing
  return fraction(points.map(([x, y]) => {
    const px = sx * x + tx; const py = sy * y + ty
    const radius = Math.ceil(tolerance * Math.max(sx, sy))
    for (let yy = Math.max(0, Math.floor(py) - radius); yy <= Math.min(height - 1, Math.ceil(py) + radius); yy++) {
      for (let xx = Math.max(0, Math.floor(px) - radius); xx <= Math.min(width - 1, Math.ceil(px) + radius); xx++) {
        if (mask.data[(yy * width + xx) * 4] < 128 && Math.hypot((xx - px) / sx, (yy - py) / sy) <= tolerance) return true
      }
    }
    return false
  }))
}

function axisDiagnostics (geometry, expected, policy) {
  const result = {}
  for (const axis of ['x', 'y']) {
    const reference = expected[axis]; const [a, b] = reference
    const dx = b[0] - a[0]; const dy = b[1] - a[1]
    const candidates = geometry.coordinate_frame.axes[axis].candidates.map(c => {
      const ex = c.end[0] - c.start[0]; const ey = c.end[1] - c.start[1]
      const cosine = Math.min(1, Math.abs((dx * ex + dy * ey) / (Math.hypot(dx, dy) * Math.hypot(ex, ey))))
      const angle = Math.acos(cosine) * 180 / Math.PI
      const distance95 = p95(samples(reference).map(p => nearest(p, [[c.start, c.end]])))
      return { ...c, angle_error_degrees: angle, reference_line_p95_distance_pixel: distance95,
        matches_approximate_axis: angle <= policy.max_angle_error_degrees && distance95 <= policy.max_reference_line_p95_distance_pixel }
    })
    result[axis] = { reported_status: geometry.coordinate_frame.axes[axis].status, candidates,
      matches_visible_axis_diagnostic: candidates.some(c => c.matches_approximate_axis) }
  }
  return result
}

function extended (geometry, reference, masks, regions) {
  const actual = geometry.strokes.map(s => s.vertices.map(v => v.pixel))
  const expected = reference.centerlines_pixel
  const refSamples = expected.map(samples)
  const actualSamples = actual.map(samples)
  const distances = actualSamples.flatMap(points => points.map(p => nearest(p, expected)))
  const maskRates = {}
  for (const [name, mask] of Object.entries(masks)) maskRates[name] = refSamples.map(ps => maskCoverage(ps, mask, geometry, 3))
  return {
    inherited: measure(geometry, reference),
    reference_coverage: Object.fromEntries([3, 5, 10].map(t => ['within_' + t + 'px_per_branch', refSamples.map(ps => coverage(ps, actual, t))])),
    best_single_path_coverage_within_3px_per_branch: refSamples.map(ps => actual.length ? Math.max(...actual.map(a => coverage(ps, [a], 3))) : 0),
    matched_path_fragments_per_branch: expected.map(e => actualSamples.filter(ps => ps.filter(p => nearest(p, [e]) <= 3).length >= 10).length),
    output_length_farther_than_5px_fraction: distances.length ? fraction(distances.map(d => d > 5)) : null,
    output_arclength_samples: distances.length,
    junction_count: geometry.topology.junctions.length,
    component_count: geometry.topology.component_count,
    mask_reference_coverage_within_3px_per_branch: maskRates,
    overlap_regions: regions.map(region => {
      const points = refSamples.flat().filter(p => Math.hypot(p[0] - region.pixel[0], p[1] - region.pixel[1]) <= region.radius_pixel)
      return { ...region, reference_samples: points.length,
        geometry_coverage_within_3px: coverage(points, actual, 3),
        best_single_path_coverage_within_3px: actual.length ? Math.max(...actual.map(a => coverage(points, [a], 3))) : 0,
        mask_coverage_within_3px: Object.fromEntries(Object.entries(masks).map(([name, mask]) => [name, maskCoverage(points, mask, geometry, 3)])) }
    }),
    scale_calibration: { status: geometry.calibration.status,
      x_status: geometry.calibration.axes.x.status, y_status: geometry.calibration.axes.y.status,
      x_labels: geometry.calibration.axes.x.labels, y_labels: geometry.calibration.axes.y.labels,
      independently_measured_scale_accuracy: null,
      note: 'No independent numeric tick/scale annotation; unknown is not zero error. Raw label evidence retained for inspection.' }
  }
}
module.exports = { extended, axisDiagnostics, maskCoverage, coverage, finite }
