// Run only AFTER image-only inference has completed for all conditions.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { read, write } = require('../../../../tests/helpers/png.cjs')
const { validate } = require('../../../../elements/pl-sketch/star-geometry.js')
const { extended, axisDiagnostics } = require('./metrics.cjs')
const { hash, line } = require('./infer.cjs')

function run (root) {
  if (fs.existsSync(path.join(root, 'evaluation.json'))) throw new Error('Refusing to overwrite evaluation evidence')
  const policyBytes = fs.readFileSync(path.join(__dirname, 'evaluation-policy.json'))
  const policy = JSON.parse(policyBytes)
  const recognition = JSON.parse(fs.readFileSync(path.join(root, 'recognition.json')))
  const preparation = JSON.parse(fs.readFileSync(path.join(root, 'preprocessing.json')))
  const outcomes = []
  for (const row of recognition.outcomes) {
    const p = policy.cases.find(c => c.id === row.id)
    const loadPinned = (file, digest) => {
      const bytes = fs.readFileSync(path.resolve(__dirname, file))
      assert.equal(hash(bytes), digest, 'Evaluator input hash changed')
      return JSON.parse(bytes)
    }
    const ref = loadPinned(p.reference, p.reference_sha256)
    const baseline = loadPinned(p.baseline_geometry, p.baseline_geometry_sha256)
    const geometryBytes = fs.readFileSync(path.join(root, row.geometry))
    assert.equal(hash(geometryBytes), row.geometry_sha256)
    const g = validate(JSON.parse(geometryBytes))
    if (row.condition === 'original') assert.deepEqual(g, baseline, 'Original failure must reproduce exact prior geometry')
    const dir = path.dirname(path.join(root, row.geometry))
    const masks = Object.fromEntries(['dark', 'ink', 'skeleton'].map(name => [name, read(path.join(dir, name + '.png'))]))
    const metrics = extended(g, ref, masks, policy.overlap_regions[row.id])
    const axes = axisDiagnostics(g, policy.diagnostic_axes[row.id], policy.axis_candidate_matching)
    const prep = preparation.rows.find(r => r.id === row.id && r.condition === row.condition)
    const im = read(path.join(root, prep.original))
    // Evaluation-only overlay: blue reference, orange proposed geometry, red ROIs.
    for (const stroke of ref.centerlines_pixel) stroke.slice(1).forEach((b, i) => line(im, stroke[i], b, [0, 100, 240], 1))
    for (const stroke of g.strokes) stroke.vertices.slice(1).forEach((v, i) => line(im, stroke.vertices[i].pixel, v.pixel, [245, 100, 0]))
    for (const r of policy.overlap_regions[row.id]) {
      const [x, y] = r.pixel; const t = r.radius_pixel
      const corners = [[x - t, y - t], [x + t, y - t], [x + t, y + t], [x - t, y + t], [x - t, y - t]]
      corners.slice(1).forEach((b, i) => line(im, corners[i], b, [220, 20, 50]))
    }
    write(path.join(dir, 'reference-prediction-overlay.png'), im)
    const result = { ...row, baseline_exact_reproduction: row.condition === 'original' ? true : null,
      transform_duration_ms: prep.transform_duration_ms, metrics, axes,
      independent_accuracy_claim: false, automatic_success: g.status === 'automatic',
      warnings: g.warnings.map(w => w.code) }
    fs.writeFileSync(path.join(dir, 'metrics.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' })
    outcomes.push(result)
  }
  const summary = { experiment: 'contrast-01', policy_sha256: hash(policyBytes),
    evaluator_code_sha256: hash(fs.readFileSync(__filename)), metrics_code_sha256: hash(fs.readFileSync(path.join(__dirname, 'metrics.cjs'))),
    inherited_metrics_sha256: hash(fs.readFileSync(path.join(__dirname, '../../automatic-cv/experiment-01/metrics.cjs'))),
    original_failures_exactly_reproduced: outcomes.filter(r => r.baseline_exact_reproduction).length,
    reference_quality: policy.reference_quality, additional_axis_and_overlap_annotations: policy.additional_diagnostic_annotations_status,
    inference_unchanged: true, production_code_changed: false, vlm_requests: 0,
    outcomes }
  fs.writeFileSync(path.join(root, 'evaluation.json'), JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' })
  const columns = ['case', 'condition', 'status', 'paths', 'components', 'junctions', 'coverage3_per_branch', 'best_path_coverage3_per_branch', 'false_path_fraction5', 'spurious_paths', 'false_connections', 'ref_to_pred_p95', 'pred_to_ref_p95', 'axis_x_match', 'axis_y_match', 'calibration']
  const rows = outcomes.map(r => { const m = r.metrics; const a = m.inherited; return [r.id, r.condition, r.status, a.extracted_paths, m.component_count, m.junction_count, m.reference_coverage.within_3px_per_branch.join(';'), m.best_single_path_coverage_within_3px_per_branch.join(';'), m.output_length_farther_than_5px_fraction, a.spurious_paths, a.false_connections, a.reference_to_geometry_p95_pixel, a.geometry_to_reference_p95_pixel, r.axes.x.matches_visible_axis_diagnostic, r.axes.y.matches_visible_axis_diagnostic, m.scale_calibration.status] })
  fs.writeFileSync(path.join(root, 'comparison.csv'), [columns, ...rows].map(r => r.map(v => v === null ? '' : v).join(',')).join('\n') + '\n', { flag: 'wx' })
  console.log(JSON.stringify({ exact_baselines: summary.original_failures_exactly_reproduced, automatic: outcomes.filter(r => r.automatic_success).length, conditions: outcomes.length }))
}
if (require.main === module) {
  if (process.argv.length !== 3) throw new Error('Usage: node evaluate.cjs run-directory')
  run(path.resolve(process.argv[2]))
}
module.exports = { run }
