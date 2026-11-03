// Archive an actual successful browser run; does not simulate recognition/import.
const fs = require('node:fs')
const { join, resolve } = require('node:path')
const { createHash } = require('node:crypto')
const { gzipSync } = require('node:zlib')
const { read, write } = require('../../../../tests/helpers/png.cjs')
const root = __dirname
const source = resolve(process.argv[2] || '/private/tmp/star-automatic-cv-step-03/star-native-browser')
const result = JSON.parse(fs.readFileSync(join(source, 'results.json'), 'utf8'))
if (result.passed !== result.checks.length || result.consoleErrors.length || result.outcomes.length !== 4 || !result.manual || !result.assisted) throw new Error('A complete successful native run is required.')
const output = join(root, 'results'); fs.mkdirSync(output, { recursive: true })
const json = (name, value) => fs.writeFileSync(join(output, name + '.json'), JSON.stringify(value, null, 2) + '\n')
const sha = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const controls = {}
for (const [kind, d] of Object.entries(result.nativeTools)) controls[kind] = {
  rendered_max_photo_pixel: d.rendered_max_photo_pixel, gradeable_max_photo_pixel: d.gradeable_max_photo_pixel,
  control_count: d.control_count, state: d.state, gradeable: d.gradeable, rendered_paths: d.paths.map(p => p.d)
}
json('native-tool-contracts', controls)
json('manual-drawing', { native_state: result.manual.manuallyDrawn.state, submitted: result.manual.manualSubmission, restored_state: result.manual.manualRestored.state,
  rendered_path_d: result.manual.manuallyDrawn.paths.map(p => p.d), restored_path_d: result.manual.manualRestored.paths.map(p => p.d) })
json('assisted-photo', { native_state: result.assisted.assistedNative.state, gradeable: result.assisted.assistedNative.gradeable, submitted: result.assisted.assistedSubmission,
  restored_state: result.assisted.assistedRestored.state, rendered_path_d: result.assisted.assistedNative.paths.map(p => p.d) })
fs.writeFileSync(join(output, 'browser-raw.json.gz'), gzipSync(Buffer.from(JSON.stringify(result))))
const legacy = []
for (const name of ['star-photo-confirmation', 'star-photo-branches', 'star-photo-workflow']) {
  const p = join(source, '..', name + '.log'); const text = fs.readFileSync(p, 'utf8')
  const r = JSON.parse(text.split('### Result\n')[1].split('\n')[0])
  if (r.consoleErrors.length || r.passed !== r.checks.length) throw new Error('Existing browser regression failed: ' + name)
  legacy.push({ name, passed: r.passed, checks: r.checks, log_sha256: sha(p) })
}
json('browser-checks', { native: { passed: result.passed, checks: result.checks, consoleErrors: result.consoleErrors }, legacy,
  legacy_assertions: legacy.reduce((n, r) => n + r.passed, 0), source_log_sha256: sha(join(source, '..', 'star-native-browser.log')) })
function dot (im, x, y, color) {
  x = Math.round(x); y = Math.round(y)
  if (x >= 0 && y >= 0 && x < im.width && y < im.height) im.data.set([...color, 255], (y * im.width + x) * 4)
}
function line (im, a, b, color, radius = 0) {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2))
  for (let i = 0; i <= n; i++) for (let dx = -radius; dx <= radius; dx++) for (let dy = -radius; dy <= radius; dy++) dot(im, a[0] + (b[0] - a[0]) * i / n + dx, a[1] + (b[1] - a[1]) * i / n + dy, color)
}
const summary = []
for (const c of result.outcomes) {
  json(c.id + '--cv', c.geometry); json(c.id + '--before', c.prior)
  for (const [field, name] of [['imported', 'native'], ['restored', 'restored'], ['edited', 'edited'], ['editedRestored', 'edited-restored']]) {
    json(c.id + '--' + name + '-state', c[field].state)
    json(c.id + '--' + name + '-gradeable', c[field].gradeable)
    const config = c[field].state.meta.config
    fs.writeFileSync(join(output, c.id + '--' + name + '.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${config.width} ${config.height}" width="${config.width}" height="${config.height}"><rect width="100%" height="100%" fill="white"/>` + c[field].paths.map(p => `<path d="${p.d}" fill="none" stroke="#252ad4" stroke-width="3"/>`).join('') + '</svg>\n')
  }
  json(c.id + '--submitted', c.submitted); json(c.id + '--edited-submitted', c.editedSubmission)
  const im = read(join(root, '../experiment-01/inputs', c.id + '.png'))
  for (const [field, name, color] of [['import_fidelity', 'native', [35, 45, 225]], ['restore_fidelity', 'restored', [0, 145, 65]]]) {
    const overlay = { ...im, data: im.data.slice() }
    for (const s of c.geometry.strokes) s.vertices.slice(1).forEach((v, i) => line(overlay, s.vertices[i].pixel, v.pixel, [244, 128, 15], 1))
    for (const s of c[field].paths_photo) s.slice(1).forEach((v, i) => line(overlay, s[i], v, color))
    write(join(output, c.id + '--' + name + '-overlay.png'), overlay)
  }
  for (const suffix of ['review', 'native', 'restored']) fs.copyFileSync(join(source, c.id + '--' + suffix + '.png'), join(output, c.id + '--' + suffix + '-screenshot.png'))
  const metric = m => Object.fromEntries(Object.entries(m).filter(([key]) => key !== 'paths_photo'))
  summary.push({ id: c.id, source_kind: 'controlled_raster', recognition_status: c.geometry.status,
    imported_branches: c.geometry.strokes.length, native_objects_total: c.imported.state.data['auto-ink'].length,
    import_fidelity: metric(c.import_fidelity), restore_fidelity: metric(c.restore_fidelity),
    edit_delta_native: c.edit_delta_native, exact_native_state_restored: JSON.stringify(c.imported.state.data['auto-ink']) === JSON.stringify(c.restored.state.data['auto-ink']),
    exact_edited_state_restored: JSON.stringify(c.editedSubmission.data['auto-ink']) === JSON.stringify(c.editedRestored.state.data['auto-ink']) })
}
for (const name of ['ambiguous--blocked', 'mobile--review', 'manual--native']) fs.copyFileSync(join(source, name + '.png'), join(output, name + '.png'))
json('summary', { step: 3, native_assertions: result.passed, legacy_assertions: legacy.reduce((n, r) => n + r.passed, 0), outcomes: summary,
  recognition: { real_photo_automatic: 0, real_photo_cases: 2, note: 'Unchanged step-2 result; native import is not recognition success.' },
  runtime: { javascript_sketchresponse: '0.2.1', python_sketchresponse: '0.1.5', question: 'star-automatic-photo-test', tested_url: 'http://localhost:3000/pl/course/1/question/254/preview' },
  source_sha256: Object.fromEntries(['star-native.js', 'star-automatic.js', 'star-fit.js', 'pl-sketch.js', 'pl-sketch.py', 'pl-sketch.mustache', 'pl-sketch.css', 'info.json'].map(p => [p, sha(join(root, '../../../../elements/pl-sketch', p))])) })
const figures = summary.map(c => `<article><h2>${c.id}</h2><p>${c.imported_branches} imported branches; exact native state and edited state restored. Grading retains the existing x² task.</p><div class="comparison">` + [
  ['inputs/' + c.id + '.png', 'Original controlled raster'], ['results/' + c.id + '--native-overlay.png', 'Orange CV geometry + blue native rendering'], ['results/' + c.id + '--restored-overlay.png', 'Orange CV geometry + green restored rendering']
].map(([src, caption]) => `<figure><img src="${src}" alt="${c.id}: ${caption}"><figcaption>${caption}</figcaption></figure>`).join('') + `</div><p><a href="results/${c.id}--cv.json">CV geometry</a> · <a href="results/${c.id}--native-state.json">Native state</a> · <a href="results/${c.id}--submitted.json">Actual submission</a> · <a href="results/${c.id}--restored-state.json">Restored state</a> · <a href="results/${c.id}--edited.svg">Edited native paths</a></p></article>`).join('')
fs.writeFileSync(join(root, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>STAR Step 3 native import evidence</title><style>body{max-width:1440px;margin:auto;padding:24px;font:16px/1.5 system-ui,sans-serif;color:#202a34}a{color:#075ca8}.comparison{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}figure{margin:0;min-width:0}img{width:100%;height:auto;border:1px solid #dce2e8}article{border-top:1px solid #ccd6df;margin-top:28px;padding-top:18px}figcaption{font-size:14px}@media(max-width:700px){body{padding:12px}.comparison{grid-template-columns:1fr}}</style></head><body><h1>Step 3: native import evidence</h1><p>Four controlled raster cases pass native rendering, branch editing, Save &amp; Grade, and refresh. <strong>Real-photo recognition remains 0/2; this is not production-ready recognition.</strong></p><p><a href="http://localhost:3000/pl/course/1/question/254/preview">Open the actual PrairieLearn demo</a> · <a href="REPORT.md">Report</a> · <a href="results/summary.json">Measured results</a> · <a href="results/native-tool-contracts.json">Native tool comparison</a></p>${figures}<article><h2>Unsafe proposal blocked</h2><p>The five-path ambiguous-axis result cannot be confirmed or imported.</p><img src="results/ambiguous--blocked.png" alt="Ambiguous-axis import blocked"></article></body></html>\n`)
console.log('Archived ' + summary.length + ' actual native demonstrations; ' + result.passed + ' native browser assertions.')
