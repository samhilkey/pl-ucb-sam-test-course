// Real photographed ink -> accepted native polyline -> vertex edit -> grading.
const fs = require('node:fs'); const path = require('node:path'); const crypto = require('node:crypto'); const { spawnSync } = require('node:child_process')
async function acceptance (page, o) {
  const checks = []; const errors = []; const external = []; const posts = []; const check = (ok, text) => { if (!ok) throw Error(text); checks.push(text) }
  page.on('pageerror', e => errors.push(String(e))); page.on('request', r => { if (r.method() === 'POST') { const p = new URLSearchParams(r.postData() || '').get('automatic-photo-sketchresponse-submission'); if (p) posts.push(JSON.parse(Buffer.from(p, 'base64').toString())) } })
  await page.route('**/*', r => { const u = new URL(r.request().url()); if (['localhost', '127.0.0.1'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol)) return r.continue(); external.push(u.origin); return r.abort() })
  const ready = () => page.waitForFunction(() => window.StarEditableDraftUI?.instances['automatic-photo'])
  const container = () => page.locator('#automatic-photo-si-container'); const panel = () => container().locator('.star-editable-draft-panel'); const svg = () => page.locator('#automatic-photo-si-canvas')
  const state = () => page.evaluate(() => JSON.parse(window.SketchInput.instances['automatic-photo'].getState()))
  const shapes = s => ({ curves: s.data['auto-draft'].filter(ps => ps.length >= 2), ink: s.data['auto-ink'], points: s.data['auto-notes'] })
  const ref = () => page.evaluate(() => window.StarCanvasReference.instances['automatic-photo'].status())
  const snap = n => container().screenshot({ path: o.output + '/' + n + '.png' })
  const fresh = async () => { await page.goto(o.url, { waitUntil: 'networkidle' }); await ready(); await page.evaluate(() => {
    const original = window.StarProviders.recognize
    window.StarProviders.recognize = (image, options) => { window.__inputKeys = Object.keys(options); const r = original(image, options); window.__cv = { geometry: r.geometry, method: r.method }; return r }
    document.getElementById('automatic-photo-si-container').addEventListener('star-draft-imported', e => { window.__draftAccepted = JSON.parse(JSON.stringify(e.detail)) })
    document.getElementById('automatic-photo-si-container').closest('form').addEventListener('submit', () => { window.__submissionPhase = window.StarEditableDraftUI.instances['automatic-photo'].status().phase })
    window.StarFit.fit = window.StarFit.sampleCurve = () => { throw Error('No equation fitting') }
  }) }
  const upload = async filename => { await container().locator('.star-canvas-photo input[type=file]').setInputFiles(filename); await page.waitForFunction(() => window.__cv && window.StarCanvasReference.instances['automatic-photo'].status().recognitionStatus) }
  const clickPhoto = async p => { await svg().scrollIntoViewIfNeeded(); const q = await page.evaluate(p => { const a = window.StarCanvasReference.instances['automatic-photo'].toCanvas(p); const v = new DOMPoint(...a).matrixTransform(document.getElementById('automatic-photo-si-canvas').getScreenCTM()); return [v.x, v.y] }, p); await page.mouse.click(...q) }
  const save = async () => {
    const before = shapes(await state()); await page.getByRole('button', { name: 'Save & Grade', exact: true }).click(); await page.waitForLoadState('networkidle'); await ready()
    check(await page.getByText('Invalid', { exact: true }).count() === 0, 'Actual accepted native draft has a valid Save & Grade submission')
    check(JSON.stringify(shapes(await state())) === JSON.stringify(before), 'Save & Grade retains the actual accepted/edited vertices and prior objects')
    const scores = (await page.locator('.badge').filter({ visible: true }).allTextContents()).map(v => v.trim()).filter(v => /^\d+(\.\d+)?%$/.test(v))
    check(scores.length > 0, 'Server returned a visible mathematical grade')
    await page.reload({ waitUntil: 'networkidle' }); await ready(); await page.waitForFunction(() => window.StarCanvasReference.instances['automatic-photo'].status().photoVisible)
    check(JSON.stringify(shapes(await state())) === JSON.stringify(before), 'Refresh restores exact native vertices and existing objects')
    return { url: page.url(), state: await state(), submission: posts.at(-1), scores, feedback: await container().locator('..').innerText() }
  }
  const dragVertex = async (index, dx, dy) => {
    await container().getByRole('button', { name: /^Select/ }).click(); await svg().scrollIntoViewIfNeeded()
    const q = await page.evaluate(index => { const s = JSON.parse(window.SketchInput.instances['automatic-photo'].getState()); const ps = s.data['auto-draft'].find(ps => ps.length >= 2); const p = ps[index]; const m = document.getElementById('automatic-photo-si-canvas').getScreenCTM(); const candidates = [[0, 0], ...Array.from({ length: 32 }, (_, k) => [4.5 * Math.cos(k * Math.PI / 16), 4.5 * Math.sin(k * Math.PI / 16)])]; const offset = candidates.find(a => ps.every((v, i) => i === index || Math.hypot(v.x - p.x - a[0], v.y - p.y - a[1]) > 5.2)); if (!offset) throw Error('Native vertex hit areas overlap completely; choose an exposed vertex.'); return { start: [m.a * (p.x + offset[0]) + m.c * (p.y + offset[1]) + m.e, m.b * (p.x + offset[0]) + m.d * (p.y + offset[1]) + m.f], dx: m.a, dy: m.d } }, index)
    await page.mouse.move(...q.start); await page.mouse.down(); await page.mouse.move(q.start[0] + dx * q.dx, q.start[1] + dy * q.dy, { steps: 10 }); await page.mouse.up()
  }
  await page.setViewportSize({ width: 1440, height: 1100 }); await fresh()
  check((await page.title()).includes('star-automatic-photo-test'), 'Actual intended local PrairieLearn sandbox loaded')
  const cfg = (await state()).meta.config
  check(cfg.editablePhotoDraftTool === 'auto-draft' && cfg.plugins.some(p => p.id === 'auto-draft' && p.name === 'polyline'), 'Local sandbox exposes the real configured native polyline tool')
  await page.evaluate(() => window.SketchInput.instances['automatic-photo'].setState(JSON.stringify({ data: { 'auto-notes': [{ x: 735, y: 520 }] } })))
  const prior = shapes(await state()); await upload(o.photo)
  check((await ref()).sourceSha256 === o.hash && (await ref()).photoVisible, 'Exact original IMG_1678.jpg is visible and retained throughout correction')
  const initial = await page.evaluate(() => ({ result: window.__cv, inputKeys: window.__inputKeys }))
  check(JSON.stringify(initial.inputKeys) === JSON.stringify(['inputRevision']), 'CV receives only actual image pixels and revision, no answer/reference/calibration')
  check(initial.result.geometry.calibration.status === 'uncertain' && shapes(await state()).curves.length === 0, 'Automatic calibration remains honestly uncertain; upload alone creates no graded native draft')
  await snap('01-uploaded-real-photo'); await container().locator('.star-draft-start').click()
  for (const p of [[842, 1147], [1490, 1130], [826, 517]]) await clickPhoto(p)
  await panel().locator('.star-draft-x').fill('4'); await panel().locator('.star-draft-y').fill('4'); await panel().locator('.star-draft-accept').waitFor({ state: 'visible' })
  const provisional = await page.evaluate(() => window.StarEditableDraftUI.instances['automatic-photo'].status())
  check(provisional.phase === 'provisional_prediction' && JSON.stringify(shapes(await state())) === JSON.stringify(prior), 'Provisional prediction remains outside native state until explicit Edit detected graph acceptance')
  check(await container().getByRole('button', { name: 'Edit detected graph', exact: true }).filter({ visible: true }).count() === 1, 'Provisional review exposes one clear Edit detected graph acceptance action')
  check(await page.evaluate(() => { const s = window.StarCanvasReview.instances['automatic-photo'].status(); return s.selections.length === 0 && s.traceCount === 0 }), 'No curve endpoints, fragments, manual traces or marked coordinates were supplied to recognition/reuse')
  await snap('02-provisional-hook-disclosed'); await panel().locator('.star-draft-accept').click()
  const accepted = await page.evaluate(() => window.__draftAccepted); const imported = await state(); const paths = shapes(imported).curves
  check(paths.length === 1 && paths[0].length >= 20, 'Actual measured photograph becomes a nonempty editable native vertex array')
  check(accepted.geometry.provenance.method === 'cv_editable_draft' && accepted.geometry.provenance.automatically_recognized === false, 'Real result is explicitly CV-assisted with student-confirmed axes, not Gemini or manual reconstruction')
  check(JSON.stringify(shapes(imported).points) === JSON.stringify(prior.points), 'Import preserves the unrelated existing native point')
  const preservation = await page.evaluate(() => { const g = window.__draftAccepted.geometry; const s = JSON.parse(window.SketchInput.instances['automatic-photo'].getState()); const points = s.data['auto-draft'].find(ps => ps.length >= 2); const error = Math.max(...g.strokes[0].vertices.map((v, i) => { const p = window.StarNative.graphToNative(s.meta.config, v.graph); return Math.hypot(p.x - points[i].x, p.y - points[i].y) })); const node = document.querySelector('#automatic-photo-si-canvas path.plugin-id-auto-draft'); return { maximum_native_anchor_error_pixel: error, violations: window.StarNative.functionViolations(g.strokes[0], s.meta.config), native_path_d: node.getAttribute('d'), parent_tag: node.parentElement.tagName, parent_class: node.parentElement.getAttribute('class'), graded: JSON.parse(window.SketchInput.instances['automatic-photo'].getGradeable()) } })
  check(preservation.maximum_native_anchor_error_pixel < 1e-7 && preservation.violations.length === 1, 'Original measured hook, corner vertices and endpoints are retained exactly in native state')
  check(preservation.native_path_d.includes('L') && preservation.graded.data['auto-draft'][0].spline.length === 1 + 3 * (paths[0].length - 1), 'Rendered native polyline and graded cubics represent the same straight segments')
  await snap('03-real-native-vertices-hook')
  await page.setViewportSize({ width: 1280, height: 720 }); await svg().scrollIntoViewIfNeeded()
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Actual native draft fits the 1280x720 presentation viewport without horizontal page overflow')
  await page.screenshot({ path: o.output + '/03-presentation-viewport.png' }); await page.setViewportSize({ width: 1440, height: 1100 })
  const uncorrected = await save()
  check(uncorrected.scores[0] === '0%', 'Uncorrected hook is saved and mathematically graded 0%, rather than Invalid or erased')
  await page.screenshot({ path: o.output + '/04-real-hook-saved-grade.png', fullPage: true })
  const beforeEdit = shapes(await state()); await dragVertex(0, 12, 0); const afterEdit = shapes(await state())
  check(JSON.stringify(afterEdit.curves[0][0]) !== JSON.stringify(beforeEdit.curves[0][0]) && JSON.stringify(afterEdit.curves[0].slice(1)) === JSON.stringify(beforeEdit.curves[0].slice(1)), 'Student drags one actual native endpoint vertex; the rest of the curve does not move')
  check(JSON.stringify(afterEdit.points) === JSON.stringify(prior.points) && (await ref()).sourceSha256 === o.hash, 'Vertex editing preserves the original photo and unrelated native point')
  await container().getByRole('button', { name: /^Undo/ }).click(); check(JSON.stringify(shapes(await state())) === JSON.stringify(beforeEdit), 'Native Undo restores the original measured hook and every prior object')
  await container().getByRole('button', { name: /^Redo/ }).click(); check(JSON.stringify(shapes(await state())) === JSON.stringify(afterEdit), 'Native Redo restores the student vertex correction without moving the photo')
  await snap('05-real-vertex-edited'); const corrected = await save(); await page.screenshot({ path: o.output + '/06-real-edited-saved.png', fullPage: true })
  check(posts.every(p => !JSON.stringify(p).includes('data:image') && !JSON.stringify(p).includes('source_geometry')), 'Native submissions contain neither provisional image layers nor recognition provenance')
  const real = { initial, provisional, accepted, imported, preservation, uncorrected, vertex_edit_before: beforeEdit, vertex_edit_after: afterEdit, corrected,
    automatic_success: false, method: 'CV-assisted: three axis clicks and written tick values, then automatic reuse of measured paths; no tracing or endpoint selection', photo_sha256: o.hash, gemini_used_for_this_candidate: false }
  // Negative and positive grading checks are separate CONTROLLED-raster trials.
  await fresh(); await upload(o.control); await container().locator('.star-draft-start').click(); await panel().locator('.star-draft-accept').waitFor({ state: 'visible' })
  await page.evaluate(() => window.SketchInput.instances['automatic-photo'].setState(JSON.stringify({ data: { 'auto-notes': [{ x: 710, y: 510 }] } })))
  const changed = shapes(await state()); await panel().locator('.star-draft-accept').click()
  check(shapes(await state()).curves.length === 0 && JSON.stringify(shapes(await state())) === JSON.stringify(changed) && (await panel().locator('.star-draft-help').innerText()).includes('changed after review'), 'Stale native state blocks acceptance without overwriting current work')
  await panel().locator('.star-draft-cancel').click(); await container().locator('.star-draft-start').click(); await panel().locator('.star-draft-accept').click()
  const controlNative = await state(); const controlGood = await save()
  check(controlGood.scores[0] === '100%', 'Unedited controlled raster is actually graded 100% through the new polyline tool')
  const middle = Math.floor(shapes(await state()).curves[0].length / 2); await dragVertex(middle, 0, 160); const controlBad = await save()
  check(controlBad.scores[0] === '0%', 'Changing a native control vertex changes grading to 0%; the new tool is genuinely graded')
  await snap('07-controlled-edited-graded')
  await fresh(); await upload(o.photo); await container().locator('.star-draft-start').click()
  for (const p of [[842, 1147], [1490, 1130], [1490, 1130]]) await clickPhoto(p)
  await panel().locator('.star-draft-x').fill('4'); await panel().locator('.star-draft-y').fill('4')
  check(await panel().locator('.star-draft-accept').isHidden() && shapes(await state()).curves.length === 0, 'Singular/incorrect axis calibration cannot create or accept native draft geometry')
  await page.setViewportSize({ width: 390, height: 844 }); await snap('08-mobile-calibration-blocked')
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Short calibration controls fit the actual 390px viewport')
  await svg().focus(); await svg().press('Escape'); check(await panel().isHidden() && shapes(await state()).curves.length === 0, 'Keyboard Escape cancels the provisional workflow without creating native ink')
  check(errors.length === 0 && external.length === 0, 'No page exceptions or additional external provider requests from the UI')
  return { passed: checks.length, checks, real_photo: real, controlled_raster: { input_kind: 'controlled_raster_not_real_photo', native: controlNative, good: controlGood, edited: controlBad }, errors, external }
}
const options = { url: 'http://localhost:3000/pl/course/1/question/254/preview/', photo: '/Users/alaiasun/Library/Mobile Documents/com~apple~CloudDocs/D. UC Berkeley/Courses/CS294 STAR FA2026/Experiment/examples/IMG_1678.jpg', hash: 'f86a0acd1dc1fcad32884c202e4fffe44adc5d88c1062a0f8a2cbd60dbc74d49', control: path.resolve(__dirname, '../benchmarks/photo-graphs/multi-method/step-4h/inputs/matching-answer-controlled.png'), output: '/private/tmp/star-h4/browser' }
if (crypto.createHash('sha256').update(fs.readFileSync(options.photo)).digest('hex') !== options.hash) throw Error('Original real photograph hash changed.')
fs.mkdirSync(options.output, { recursive: true }); const cli = process.env.PL_PHOTO_TEST_CLI || '/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh'
function run (args) { const r = spawnSync(cli, ['-s=star-h4-editable', ...args], { cwd: '/private/tmp', encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024 }); const text = (r.stdout || '') + (r.stderr || ''); if (r.error || r.status !== 0 || text.includes('### Error')) throw r.error || Error(text.slice(-5000)); if (args[0] === 'run-code') { const result = JSON.parse(text.split('### Result\n')[1].split('\n###')[0]); fs.writeFileSync(options.output + '/results.json', JSON.stringify(result, null, 2) + '\n'); console.log('Editable real-photo assertions passed: ' + result.passed) } }
try { run(['open', options.url, '--browser', 'chrome']); run(['snapshot']); run(['run-code', 'async page => (' + acceptance.toString() + ')(page,' + JSON.stringify(options) + ')']) } catch (error) { console.error(error.message); process.exitCode = 1 } finally { try { run(['close']) } catch (_) {} }
