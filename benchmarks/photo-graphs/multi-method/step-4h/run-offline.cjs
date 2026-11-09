// Local pixels + explicitly human-authored regions. No API, key or grader input.
const fs = require('node:fs'); const path = require('node:path')
const PNG = require('../../../../tests/helpers/png.cjs'); const CV = require('../../../../elements/pl-sketch/star-recognition.js'); const H = require('../../../../elements/pl-sketch/star-hybrid.js')
const { measure } = require('../../automatic-cv/experiment-01/metrics.cjs')
const cases = require('./fixtures.cjs').prepare(); const out = path.join(__dirname, 'results'); fs.mkdirSync(out, { recursive: true })
const write = (name, v) => fs.writeFileSync(path.join(out, name), JSON.stringify(v, null, 2) + '\n')
const outcomes = []
for (const c of cases) {
  const im = PNG.read(c.image); const started = performance.now(); const raw = CV.recognize(im); const source = raw.geometry
  const check = H.inspect(source, c.envelope); const geometry = check.importable_after_explicit_review ? H.reviewed(source, c.envelope, { confirmed: true }) : null
  write(c.id + '.semantic-fixture.json', c.envelope); write(c.id + '.cv.json', source); write(c.id + '.fusion.json', check)
  if (geometry) write(c.id + '.reviewed-geometry.json', geometry)
  // References are loaded only AFTER the recognizer/fusion finish.
  const reference = require(c.id === 'IMG_1670' ? '../step-4f/reference.json' : c.id === 'matching-answer-controlled' ? './references/matching-answer-controlled.json' : c.id === 'two-branches-dot-controlled' ? '../../automatic-cv/experiment-01/references/two-branches.json' : '../../automatic-cv/experiment-01/references/sharp-v.json')
  const original = { ...im, data: im.data.slice() }
  const pixel = (x, y, color) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < im.width && y >= 0 && y < im.height) original.data.set([...color, 255], (y * im.width + x) * 4) }
  const ps = geometry ? geometry.strokes : source.strokes.filter(s => check.strokeDecisions[s.id] === 'keep')
  for (const s of ps) for (let i = 1; i < s.vertices.length; i++) { const a = s.vertices[i - 1].pixel; const b = s.vertices[i].pixel; const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2); for (let j = 0; j <= n; j++) pixel(a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n, geometry ? [0, 170, 80] : [235, 125, 0]) }
  for (const p of check.measured_points) for (let j = -8; j <= 8; j++) { pixel(p.pixel[0] + j, p.pixel[1], [190, 0, 190]); pixel(p.pixel[0], p.pixel[1] + j, [190, 0, 190]) }
  PNG.write(path.join(out, c.id + '.overlay.png'), original)
  outcomes.push({ id: c.id, image_source_kind: c.source_kind, semantic_source_kind: 'human_authored_development_fixture', automatic_recognition_success_claimed: false,
    reviewed_native_candidate: !!geometry, source_cv_status: source.status, source_cv_branch_fragments: source.strokes.length,
    fusion: check, source_cv_metrics: measure(source, reference), reviewed_fusion_metrics: geometry ? measure(geometry, reference) : null,
    geometry_created_before_evaluator_reference_read: true, elapsed_ms: performance.now() - started, photo_sha256: c.envelope.photo_sha256 })
}
write('offline-evaluation.json', { step: '4H offline proof', inference_requests: 0, real_Gemini_semantics: 0, real_photo_hybrid_acceptance_passed: false, all_semantics_are_development_fixtures: true, outcomes })
fs.writeFileSync(path.join(out, 'browser-input.json'), JSON.stringify(cases.map(c => ({ id: c.id, image: c.image, source_kind: c.source_kind, source: require(path.join(out, c.id + '.cv.json')), envelope: c.envelope }))) + '\n')
console.log('Offline candidates: ' + outcomes.filter(o => o.reviewed_native_candidate).length + '/' + outcomes.length + '; real-photo hybrid blocked; Gemini calls: 0')
