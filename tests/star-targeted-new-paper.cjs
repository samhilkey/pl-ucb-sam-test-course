// New, user-owned real paper. The known-answer target is used only by the server grader.
const fs = require('node:fs'); const path = require('node:path'); const crypto = require('node:crypto'); const { spawnSync } = require('node:child_process')
async function acceptance (page, o) {
  const checks = []; const errors = []; const external = []; const posts = []; const check = (ok, s) => { if (!ok) throw Error(s); checks.push(s) }
  page.on('pageerror', e => errors.push(String(e))); page.on('request', r => { if (r.method() === 'POST') { const v = new URLSearchParams(r.postData() || '').get('automatic-photo-sketchresponse-submission'); if (v) posts.push(JSON.parse(Buffer.from(v, 'base64').toString())) } })
  await page.route('**/*', r => { const u = new URL(r.request().url()); if (['localhost', '127.0.0.1'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol)) return r.continue(); external.push(u.origin); return r.abort() })
  await page.setViewportSize({ width: 1440, height: 1100 }); await page.goto(o.url, { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.StarCanvasReview?.instances['automatic-photo'])
  const container = () => page.locator('#automatic-photo-si-container'); const panel = () => container().locator('.star-canvas-correction'); const svg = () => page.locator('#automatic-photo-si-canvas')
  const state = () => page.evaluate(() => JSON.parse(window.SketchInput.instances['automatic-photo'].getState()))
  const native = async () => { const s = (await state()).data; return { curves: s['auto-ink'], points: s['auto-notes'] } }
  const snap = name => container().screenshot({ path: o.output + '/' + name + '.png' })
  const clickPhoto = async p => { await svg().scrollIntoViewIfNeeded(); const q = await page.evaluate(p => { const v = window.StarCanvasReference.instances['automatic-photo'].toCanvas(p); const s = document.getElementById('automatic-photo-si-canvas'); const q = new DOMPoint(...v).matrixTransform(s.getScreenCTM()); return [q.x, q.y] }, p); await page.mouse.click(...q) }
  await page.evaluate(() => {
    const recognize = window.StarProviders.recognize
    window.StarProviders.recognize = async (image, options) => { window.__recognizerKeys = Object.keys(options); const r = await recognize(image, options); window.__initialCV = JSON.parse(JSON.stringify(r.geometry)); return r }
    document.getElementById('automatic-photo-si-container').addEventListener('star-canvas-imported', e => { window.__accepted = JSON.parse(JSON.stringify(e.detail)) })
    window.StarFit.fit = window.StarFit.sampleCurve = () => { throw Error('No equation fitting') }
    const si = window.SketchInput.instances['automatic-photo']; si.setState(JSON.stringify({ data: { 'auto-notes': [{ x: 735, y: 520 }] } }))
  })
  await container().locator('.star-canvas-photo input[type=file]').setInputFiles(o.photo); await page.waitForFunction(() => window.__initialCV)
  const initial = await page.evaluate(() => ({ geometry: window.__initialCV, recognizer_options: window.__recognizerKeys, ref: window.StarCanvasReference.instances['automatic-photo'].status() }))
  check(initial.ref.photoVisible && initial.ref.sourceSha256 === o.hash, 'Exact frozen original IMG_1678.jpg is visible on the actual native canvas')
  check(initial.geometry.calibration.status === 'uncertain' && initial.geometry.status === 'needs_review', 'Untuned initial automatic result is explicitly blocked by missing calibration')
  check(JSON.stringify(initial.recognizer_options) === JSON.stringify(['inputRevision']), 'Recognizer receives only photo pixels and revision, no target, references or calibration')
  check(!(await native()).curves.length, 'No uncalibrated candidate becomes native geometry')
  await snap('01-automatic-blocked'); await container().locator('.star-canvas-photo-options summary').click(); await container().locator('.star-canvas-correct').click()
  for (const p of [o.actions.origin, o.actions.xMarker, o.actions.yMarker]) await clickPhoto(p)
  await panel().locator('.star-correction-x').fill(String(o.actions.xValue)); await panel().locator('.star-correction-y').fill(String(o.actions.yValue))
  for (const p of o.actions.endpoints) await clickPhoto(p)
  check((await page.evaluate(() => window.StarCanvasReview.instances['automatic-photo'].status().selections.length)) === 1, 'Two visible endpoint clicks select one existing connected CV route without tracing')
  await panel().locator('.star-correction-preview').click()
  let blocker = null; let accepted = null
  if (!await panel().locator('.star-correction-accept').isVisible()) {
    blocker = await panel().locator('.star-correction-help').innerText(); await snap('02-correction-blocked')
    check((await native()).curves.length === 0, 'Unsafe CV candidate remains outside native state when the function-input guard rejects it')
    await panel().locator('[data-pick=trace]').click(); await svg().scrollIntoViewIfNeeded()
    const screen = async p => page.evaluate(p => { const v = window.StarCanvasReference.instances['automatic-photo'].toCanvas(p); const s = document.getElementById('automatic-photo-si-canvas'); const q = new DOMPoint(...v).matrixTransform(s.getScreenCTM()); return [q.x, q.y] }, p)
    await page.mouse.move(...await screen(o.actions.manual_curve[0])); await page.mouse.down()
    for (const p of o.actions.manual_curve.slice(1)) await page.mouse.move(...await screen(p), { steps: 16 })
    await page.mouse.up()
    check((await native()).curves.length === 0, 'Direct manual photo trace remains ungraded before explicit preview and acceptance')
    await panel().locator('.star-correction-preview').click(); await panel().locator('.star-correction-accept').waitFor({ state: 'visible' }); await snap('02-manual-preview')
    await panel().locator('.star-correction-accept').click(); accepted = await page.evaluate(() => window.__accepted)
    check(accepted.geometry.provenance.method === 'manual_trace' && accepted.geometry.provenance.automatically_recognized === false, 'Genuine manual recovery uses the geometry-preserving adapter and is never labeled CV or automatic extraction')
    check((await native()).curves.length === 1 && await page.evaluate(() => window.StarCanvasReference.instances['automatic-photo'].status().aligned), 'Manual on-canvas tracing creates actual editable native geometry and aligned photo reference')
    const anchors = await page.evaluate(() => { const g = window.__accepted.geometry; const si = window.SketchInput.instances['automatic-photo']; const s = JSON.parse(si.getState()); const ps = s.data['auto-ink'][0]; return [0, g.strokes[0].vertices.length - 1].map((i, j) => { const expected = window.StarNative.graphToNative(s.meta.config, g.strokes[0].vertices[i].graph); const actual = j ? ps.at(-1) : ps[0]; return Math.hypot(expected.x - actual.x, expected.y - actual.y) }) })
    check(anchors.every(d => d < 1e-7), 'Manual adapter retains both actual pointer endpoints; no native rubber-band endpoint truncation')
  } else {
    check((await native()).curves.length === 0, 'Student-aligned preview remains outside gradeable state')
    await snap('02-aligned-preview'); await panel().locator('.star-correction-accept').click()
    accepted = await page.evaluate(() => window.__accepted)
    check(accepted.geometry.provenance.method === 'targeted_cv' && accepted.geometry.provenance.automatically_recognized === false, 'Result explicitly records manual calibration and endpoint-guided CV assistance')
  }
  check((await native()).curves.length === 1 && (await native()).points.length === 1, 'Actual native freeform curve created; unrelated prior point retained')
  // Attached filled dots are placed at their PHOTO locations with native tools,
  // never forced to ideal graph coordinates or claimed as automatic detection.
  const placements = []
  for (const p of o.actions.marked_points) { await container().getByText('Other marks', { exact: true }).click(); await clickPhoto(p); placements.push((await native()).points.at(-1)) }
  check((await native()).points.length === 1 + o.actions.marked_points.length, 'Four visible attached marks are retained as separately manually placed native points')
  const imported = await native(); await snap('03-native-and-manual-marks')
  const normalSave = async () => {
    const before = await native(); await page.getByRole('button', { name: 'Save & Grade', exact: true }).click(); await page.waitForLoadState('networkidle'); await page.waitForFunction(() => window.StarCanvasReview?.instances['automatic-photo'])
    check(await page.getByText('Invalid', { exact: true }).count() === 0, 'Unchanged server accepts actual native submission format')
    const scores = (await page.locator('.badge').filter({ visible: true }).allTextContents()).map(v => v.trim()).filter(v => /^\d+(?:\.\d+)?%$/.test(v))
    if (!scores.length) await page.screenshot({ path: o.output + '/grade-diagnostic.png', fullPage: true })
    check(scores.length > 0, 'Actual native target grade is visible, without assuming 100%: ' + (scores.length ? scores.join(',') : JSON.stringify({ badges: await page.locator('.badge').allTextContents(), feedback: (await page.locator('body').innerText()).slice(-5000) })))
    check(JSON.stringify(await native()) === JSON.stringify(before), 'Save & Grade retains actual curve and every native point')
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => window.StarCanvasReference?.instances['automatic-photo']?.status().photoVisible)
    check(JSON.stringify(await native()) === JSON.stringify(before) && await page.evaluate(() => window.StarCanvasReference.instances['automatic-photo'].status().aligned), 'Refresh restores native geometry and confirmed photo alignment')
    return { scores, submission: posts.at(-1), url: page.url(), restored: await native() }
  }
  const graded = await normalSave(); await page.screenshot({ path: o.output + '/04-actual-grade-restored.png', fullPage: true })
  check(!JSON.stringify(graded.submission).includes('data:image') && !JSON.stringify(graded.submission).includes('targeted_cv'), 'Native answer contains no photograph or correction metadata')
  await container().getByRole('button', { name: /^Select/ }).click(); await svg().scrollIntoViewIfNeeded()
  const grab = await page.evaluate(() => { const p = document.querySelector('#automatic-photo-si-canvas path.plugin-id-auto-ink'); const q = p.getPointAtLength(p.getTotalLength() * 0.2); const m = p.getScreenCTM(); return [m.a * q.x + m.c * q.y + m.e, m.b * q.x + m.d * q.y + m.f] })
  await page.mouse.move(...grab); await page.mouse.down(); await page.mouse.move(grab[0] + 10, grab[1] + 8, { steps: 8 }); await page.mouse.up(); const edited = await native()
  check(JSON.stringify(edited.curves) !== JSON.stringify(imported.curves) && JSON.stringify(edited.points) === JSON.stringify(imported.points), 'Native editing changes the selected curve without moving marked locations or prior point')
  const editedSaved = await normalSave(); await snap('05-edited-restored')
  // Leave the presenter variant in its original, actually traced state. This
  // replays a prior native snapshot, never an expected function or model output.
  await page.evaluate(data => window.SketchInput.instances['automatic-photo'].setState(JSON.stringify({ data: { 'auto-ink': data.curves, 'auto-notes': data.points } })), imported)
  check(JSON.stringify(await native()) === JSON.stringify(imported), 'Prepared demo restores the original actual native snapshot after the deliberate edit')
  const preparedOriginal = await normalSave(); check(preparedOriginal.scores[0] === graded.scores[0], 'Prepared original reproduces its actual pre-edit grade')
  await page.screenshot({ path: o.output + '/06-prepared-original-restored.png', fullPage: true })
  check(errors.length === 0 && external.length === 0, 'No runtime exceptions or external provider requests')
  return { passed: checks.length, checks, original_sha256: o.hash, initial_automatic: initial, automatic_success: false, assisted_cv_import_blocked: !!blocker, blocker, recovery_method: blocker ? 'Manual on-canvas tracing through geometry-preserving adapter' : 'Endpoint-guided CV-assisted import', assisted_accepted: accepted, imported, manual_curve_source_pixels: blocker ? o.actions.manual_curve : null, manual_mark_source_pixels: o.actions.marked_points, manual_mark_native_positions: placements, original_grade: graded, edited_grade: editedSaved, prepared_original: preparedOriginal, errors, external, source_kind: 'independent_user_owned_real_paper_photo', no_equation_provided_to_recognizer: true, points_classification: 'Four attached filled marks placed manually with native Other marks tool; not automatically extracted isolated dots' }
}
const options = { url: 'http://localhost:3000/pl/course/1/question/254/preview/', photo: '/Users/alaiasun/Library/Mobile Documents/com~apple~CloudDocs/D. UC Berkeley/Courses/CS294 STAR FA2026/Experiment/examples/IMG_1678.jpg', hash: 'f86a0acd1dc1fcad32884c202e4fffe44adc5d88c1062a0f8a2cbd60dbc74d49', actions: { origin: [842, 1147], xMarker: [1490, 1130], yMarker: [826, 517], xValue: 4, yValue: 4, endpoints: [[483, 310], [1193, 275]], marked_points: [[542, 508], [1130, 505], [700, 1006], [1012, 993]], manual_curve: [[483, 310], [510, 420], [542, 508], [560, 625], [584, 756], [614, 872], [658, 970], [704, 1033], [750, 1090], [797, 1131], [842, 1149], [887, 1135], [935, 1100], [977, 1059], [1012, 993], [1050, 916], [1087, 803], [1103, 684], [1120, 572], [1130, 505], [1148, 397], [1185, 280]] }, output: '/private/tmp/star-h2/new-paper' }
if (crypto.createHash('sha256').update(fs.readFileSync(options.photo)).digest('hex') !== options.hash) throw Error('Frozen original photo changed; do not substitute.')
fs.mkdirSync(options.output, { recursive: true }); const cli = process.env.PL_PHOTO_TEST_CLI || '/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh'
function run (args) { const r = spawnSync(cli, ['-s=star-h2-new-paper', ...args], { cwd: '/private/tmp', encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024 }); const s = (r.stdout || '') + (r.stderr || ''); if (r.error || r.status !== 0 || s.includes('### Error')) throw r.error || Error(s.slice(-5000)); if (args[0] === 'run-code') { const value = JSON.parse(s.split('### Result\n')[1].split('\n###')[0]); fs.writeFileSync(options.output + '/results.json', JSON.stringify(value) + '\n'); console.log('New real-paper assertions passed: ' + value.passed + '; actual original grade: ' + value.original_grade.scores.join(',')) } }
try { run(['open', options.url, '--browser', 'chrome']); run(['snapshot']); run(['run-code', 'async page => (' + acceptance.toString() + ')(page,' + JSON.stringify(options) + ')']) } catch (e) { console.error(e.message); process.exitCode = 1 } finally { try { run(['close']) } catch (_) {} }
