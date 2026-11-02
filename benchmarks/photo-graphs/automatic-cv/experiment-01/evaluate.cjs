const { mkdirSync, writeFileSync, readFileSync } = require('node:fs')
const { join } = require('node:path')
const { createHash } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const { read, write } = require('../../../../tests/helpers/png.cjs')
const { recognize } = require('../../../../elements/pl-sketch/star-recognition.js')
const { measure } = require('./metrics.cjs')
const root = __dirname; const results = join(root, 'results')
mkdirSync(results, { recursive: true })
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const sourceHash = file => hash(readFileSync(join(root, '../../../../elements/pl-sketch', file)))
function paint (im, x, y, color, alpha = 1) {
  x = Math.round(x); y = Math.round(y)
  if (x < 0 || y < 0 || x >= im.width || y >= im.height) return
  const k = (y * im.width + x) * 4
  for (let c = 0; c < 3; c++) im.data[k + c] = color[c] * alpha + im.data[k + c] * (1 - alpha)
}
function segment (im, a, b, color, width = 1, alpha = 1) {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2)); const radius = Math.floor(width / 2)
  for (let i = 0; i <= n; i++) {
    const x = a[0] + (b[0] - a[0]) * i / n; const y = a[1] + (b[1] - a[1]) * i / n
    for (let dx = -radius; dx <= radius; dx++) for (let dy = -radius; dy <= radius; dy++) paint(im, x + dx, y + dy, color, alpha)
  }
}
function overlay (original, result, proposalOnly) {
  const im = { ...original, data: proposalOnly ? new Uint8ClampedArray(original.data.length).fill(255) : original.data.slice() }
  const { geometry: g, debug: d } = result
  const fromProcessing = p => [(p[0] + 0.5) * original.width / d.width - 0.5, (p[1] + 0.5) * original.height / d.height - 0.5]
  for (const x of g.coordinate_frame.grid.x.lines_pixel) segment(im, [x, 0], [x, im.height - 1], [30, 170, 85], 1, 0.25)
  for (const y of g.coordinate_frame.grid.y.lines_pixel) segment(im, [0, y], [im.width - 1, y], [30, 170, 85], 1, 0.25)
  for (const axis of ['x', 'y']) for (const l of g.coordinate_frame.axes[axis].candidates) segment(im, l.start, l.end, [0, 170, 220], 3, 0.65)
  if (!proposalOnly) for (let k = 0; k < d.skeleton.length; k++) if (d.skeleton[k]) {
    const p = fromProcessing([k % d.width, Math.floor(k / d.width)])
    segment(im, p, p, [40, 50, 235], 5, 0.85)
  }
  for (const s of g.strokes) {
    s.vertices.slice(1).forEach((v, i) => segment(im, s.vertices[i].pixel, v.pixel, [240, 117, 0], 1, 1))
    for (const v of s.vertices) if (v.endpoint || v.corner) {
      const color = v.corner ? [220, 25, 60] : [0, 145, 65]
      segment(im, [v.pixel[0] - 3, v.pixel[1]], [v.pixel[0] + 3, v.pixel[1]], color, 1)
      segment(im, [v.pixel[0], v.pixel[1] - 3], [v.pixel[0], v.pixel[1] + 3], color, 1)
    }
  }
  return im
}
const cases = [...require('./controlled-cases.json'), ...require('./real-cases.json')]
const outcomes = []
for (const c of cases) {
  // Only image pixels enter inference; the reference is read AFTER recognition.
  const im = read(join(root, c.input)); const started = performance.now()
  const result = recognize(im); const duration = performance.now() - started
  const g = result.geometry; const ref = JSON.parse(readFileSync(join(root, c.reference), 'utf8'))
  const prefix = join(results, c.id)
  writeFileSync(prefix + '.geometry.json', JSON.stringify(g, null, 2) + '\n')
  writeFileSync(prefix + '.paths.json', JSON.stringify(result.debug.paths_processing) + '\n')
  write(prefix + '.overlay.png', overlay(im, result, false)); write(prefix + '.proposal.png', overlay(im, result, true))
  for (const mask of ['dark', 'ink', 'skeleton']) {
    const data = new Uint8ClampedArray(result.debug.width * result.debug.height * 4)
    result.debug[mask].forEach((v, k) => data.set([v ? 25 : 255, v ? 25 : 255, v ? 25 : 255, 255], k * 4))
    write(prefix + '.' + mask + '.png', { width: result.debug.width, height: result.debug.height, data })
  }
  const metrics = measure(g, ref)
  outcomes.push({ ...c, status: g.status, calibration: g.calibration.status, warnings: g.warnings.map(w => w.code), metrics,
    duration_ms: Math.round(duration * 10) / 10, native_import: 'untested_step_3', input_sha256: hash(readFileSync(join(root, c.input))), geometry_sha256: hash(readFileSync(prefix + '.geometry.json')) })
  console.log(c.id + ': ' + g.status + ', ' + metrics.extracted_paths + ' paths, scale ' + g.calibration.status)
}
const summary = {
  experiment: 'automatic-cv/experiment-01', step: 2, code_parent: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  code_sha256: { recognizer: sourceHash('star-recognition.js'), geometry: sourceHash('star-geometry.js') },
  protocol: 'Development diagnostics, not held-out validation. Controlled fixtures have printed bitmap labels matching the limited OCR vocabulary. Real-photo references are approximate prior visual annotations.',
  recognition_inputs: 'RGBA pixels only; no calibration options, reference geometry, IDs, expected outputs, equations, or grader input supplied.',
  counts: { supported_controlled_automatic: outcomes.slice(0, 4).filter(c => c.status === 'automatic').length, supported_controlled_cases: 4, controlled_challenge_cases: 4,
    controlled_challenge_automatic: outcomes.slice(4, 8).filter(c => c.status === 'automatic').length, real_photo_automatic: outcomes.slice(8).filter(c => c.status === 'automatic').length,
    real_photo_cases: 2, independent_real_drawings: 2, controlled_raster_recipes: new Set(cases.filter(c => c.source_kind === 'controlled_raster').map(c => c.drawing_id)).size },
  metric_policy: 'Distances use image-space centerlines sampled at <=1px intervals. Coverage uses <=3px. Missing stroke: <10% coverage; partial: 10%-90%. False connection: one output path follows >=10 samples on two reference strokes. Engineering diagnostics, not grading validity. Null distance means unavailable, never zero.',
  outcomes
}
writeFileSync(join(results, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
