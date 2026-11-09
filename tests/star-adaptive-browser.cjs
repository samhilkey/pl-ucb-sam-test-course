// Actual local experimental question, real JPEG, no supplied curve or equation.
const fs = require('node:fs'); const path = require('node:path'); const crypto = require('node:crypto'); const { spawnSync } = require('node:child_process')
async function acceptance (page, o) {
  const checks = []; const errors = []; const external = []; const posts = []; const check = (ok, text) => { if (!ok) throw Error(text); checks.push(text) }
  page.on('pageerror', e => errors.push(String(e))); page.on('request', r => { if (r.method() === 'POST') { const encoded = new URLSearchParams(r.postData() || '').get('adaptive-photo-sketchresponse-submission'); if (encoded) posts.push(JSON.parse(Buffer.from(encoded, 'base64').toString())) } })
  await page.route('**/*', r => { const u = new URL(r.request().url()); if (['localhost', '127.0.0.1'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol)) return r.continue(); external.push(u.origin); return r.abort() })
  const ready = () => page.waitForFunction(() => window.StarEditableDraftUI?.instances['adaptive-photo'])
  const container = () => page.locator('#adaptive-photo-si-container'); const panel = () => container().locator('.star-editable-draft-panel'); const svg = () => page.locator('#adaptive-photo-si-canvas')
  const state = () => page.evaluate(() => JSON.parse(window.SketchInput.instances['adaptive-photo'].getState()))
  const shapes = s => Object.fromEntries(['auto-ink', 'auto-draft', 'auto-smooth', 'auto-notes'].map(id => [id, s.data[id].filter(p => !Array.isArray(p) || p.length >= 2)]))
  const snapshot = name => container().screenshot({ path: o.output + '/' + name + '.png' })
  await page.setViewportSize({ width: 1440, height: 1100 }); await page.goto(o.url, { waitUntil: 'networkidle' }); await ready()
  check((await page.title()).includes('star-adaptive-photo-test'), 'Separate experimental question is loaded; H4 demo URL remains separate')
  check((await state()).meta.config.adaptivePhotoSplineTool === 'auto-smooth', 'Native spline and polyline tools are explicitly opted into this question')
  await page.evaluate(() => {
    const original = window.StarProviders.recognize
    window.StarProviders.recognize = (image, options) => { const result = original(image, options); window.__measured = { geometry: result.geometry, inputKeys: Object.keys(options) }; return result }
    document.getElementById('adaptive-photo-si-container').addEventListener('star-draft-imported', e => { window.__adaptiveAccepted = JSON.parse(JSON.stringify(e.detail)) })
    window.StarFit.fit = window.StarFit.sampleCurve = () => { throw Error('No equation fitting') }
    window.SketchInput.instances['adaptive-photo'].setState(JSON.stringify({ data: { 'auto-notes': [{ x: 735, y: 520 }] } }))
  })
  const prior = shapes(await state()); await container().locator('.star-canvas-photo input[type=file]').setInputFiles(o.photo); await page.waitForFunction(() => window.__measured)
  const initial = await page.evaluate(() => ({ ...window.__measured, ref: window.StarCanvasReference.instances['adaptive-photo'].status() }))
  check(initial.ref.sourceSha256 === o.hash && initial.ref.photoVisible, 'Exact original IMG_1678 photograph is visible')
  check(JSON.stringify(initial.inputKeys) === JSON.stringify(['inputRevision']), 'Recognition receives only pixels and revision, never a grader or expected curve')
  await container().locator('.star-draft-start').click()
  for (const p of [[842, 1147], [1490, 1130], [826, 517]]) {
    await svg().scrollIntoViewIfNeeded(); const q = await page.evaluate(p => { const a = window.StarCanvasReference.instances['adaptive-photo'].toCanvas(p); const m = document.getElementById('adaptive-photo-si-canvas').getScreenCTM(); return [m.a * a[0] + m.c * a[1] + m.e, m.b * a[0] + m.d * a[1] + m.f] }, p); await page.mouse.click(...q)
  }
  await panel().locator('.star-draft-x').fill('4'); await panel().locator('.star-draft-y').fill('4'); await panel().locator('.star-draft-accept').waitFor({ state: 'visible' })
  check(JSON.stringify(shapes(await state())) === JSON.stringify(prior), 'Adaptive preview is ungraded and does not mutate native geometry')
  await snapshot('01-adaptive-preview'); await panel().locator('.star-draft-accept').click()
  const accepted = await page.evaluate(() => window.__adaptiveAccepted); const imported = await state()
  check(accepted.representation.spline_count >= 1 && accepted.representation.handle_count < 43, 'Measured photo chooses fewer handles and actual native spline sections')
  check(shapes(imported)['auto-smooth'].length === accepted.representation.spline_count && shapes(imported)['auto-draft'].length === accepted.representation.polyline_count, 'Native state contains the actual planned spline and protected original-trace objects')
  const rendered = await page.evaluate(() => {
    const s = JSON.parse(window.SketchInput.instances['adaptive-photo'].getState()); const collected = {}
    for (const id of ['auto-smooth', 'auto-draft']) collected[id] = [...document.querySelectorAll('#adaptive-photo-si-canvas path.plugin-id-' + id)].filter(p => p.getTotalLength() > 0).map(p => { const count = Math.ceil(p.getTotalLength() * 2) + 1; return { d: p.getAttribute('d'), samples: Array.from({ length: count }, (_, i) => { const q = p.getPointAtLength(i * p.getTotalLength() / (count - 1)); return { x: q.x, y: q.y } }) } })
    const expected = s.data['auto-smooth'].filter(ps => ps.length >= 2).map(ps => window.StarNative.pathData(window.StarAdaptiveGeometry.controls(ps)))
    return { paths: collected, expected, gradeable: JSON.parse(window.SketchInput.instances['adaptive-photo'].getGradeable()) }
  })
  check(rendered.paths['auto-smooth'].every((p, i) => p.d === rendered.expected[i]), 'Actual native SVG spline is identical to the audited local renderer kernel')
  check(rendered.paths['auto-smooth'].every(p => p.d.includes('C')), 'Visible smooth curves are native cubic paths, not the photo or a provisional overlay')
  check(rendered.gradeable.data['auto-smooth'].length > 0, 'The native spline has real gradeable data')
  check(JSON.stringify(shapes(await state())['auto-notes']) === JSON.stringify(prior['auto-notes']), 'Existing unrelated point is preserved')
  await snapshot('02-native-smooth-and-protected-trace')
  // Changing representation replaces only an unchanged owned draft.
  const changeStyle = async value => { const details = container().locator('.star-canvas-photo-options'); if (!await details.evaluate(e => e.open)) await details.locator('summary').click(); await container().locator('.star-adaptive-style').click(); await panel().getByLabel('Curve style').selectOption(value); await panel().locator('.star-draft-accept').click() }
  await changeStyle('original'); const original = await state()
  check(shapes(original)['auto-smooth'].length === 0 && shapes(original)['auto-draft'].length === 1 && shapes(original)['auto-draft'][0].length === 43, 'Original trace replaces smooth parts with exactly the measured 43-vertex fallback; no duplicates')
  await snapshot('03-original-trace-fallback'); await changeStyle('auto'); const restoredAuto = await state()
  check(JSON.stringify(shapes(restoredAuto)) === JSON.stringify(shapes(imported)), 'Auto can be restored without duplicating graded objects or changing existing points')
  const save = async () => { const before = shapes(await state()); await page.getByRole('button', { name: 'Save & Grade', exact: true }).click(); await page.waitForLoadState('networkidle'); await ready(); check(await page.getByText('Invalid', { exact: true }).count() === 0, 'Native smooth/polyline mixture has a valid Save & Grade submission'); check(JSON.stringify(shapes(await state())) === JSON.stringify(before), 'Save & Grade preserves the actual native state'); const scores = (await page.locator('.badge').filter({ visible: true }).allTextContents()).map(s => s.trim()).filter(s => /^\d+(\.\d+)?%$/.test(s)); await page.reload({ waitUntil: 'networkidle' }); await ready(); check(JSON.stringify(shapes(await state())) === JSON.stringify(before), 'Refresh restores the smooth native objects, polyline details and prior point'); return { state: await state(), scores, submission: posts.at(-1), url: page.url() } }
  const uncorrected = await save(); check(uncorrected.scores[0] === '0%', 'Original non-function hook is preserved and graded as an incorrect answer, not silently erased')
  // A real native spline anchor, away from shared joins, is individually draggable.
  const beforeEdit = shapes(await state()); await container().getByRole('button', { name: /^Select/ }).click(); await svg().scrollIntoViewIfNeeded()
  const pos = await page.evaluate(() => { const ps = JSON.parse(window.SketchInput.instances['adaptive-photo'].getState()).data['auto-smooth'].find(ps => ps.length >= 2); const p = ps[3]; const m = document.getElementById('adaptive-photo-si-canvas').getScreenCTM(); return [m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f, m.d] })
  await page.mouse.move(pos[0], pos[1]); await page.mouse.down(); await page.mouse.move(pos[0], pos[1] + 8 * pos[2], { steps: 10 }); await page.mouse.up(); const edited = shapes(await state())
  check(edited['auto-smooth'][0][3].y !== beforeEdit['auto-smooth'][0][3].y && edited['auto-smooth'][0].every((p, i) => i === 3 || JSON.stringify(p) === JSON.stringify(beforeEdit['auto-smooth'][0][i])), 'Select drags an individual real spline control point without moving the other anchors')
  check(JSON.stringify(edited['auto-draft']) === JSON.stringify(beforeEdit['auto-draft']) && JSON.stringify(edited['auto-notes']) === JSON.stringify(prior['auto-notes']), 'Spline editing preserves protected hook/corners and unrelated point')
  await container().getByRole('button', { name: /^Undo/ }).click(); check(JSON.stringify(shapes(await state())) === JSON.stringify(beforeEdit), 'Native Undo restores the spline anchors')
  await container().getByRole('button', { name: /^Redo/ }).click(); check(JSON.stringify(shapes(await state())) === JSON.stringify(edited), 'Native Redo restores the spline edit')
  await snapshot('04-native-spline-control-edited'); const editedSaved = await save(); await page.screenshot({ path: o.output + '/05-edited-saved-restored.png', fullPage: true })
  // An explicit student endpoint correction must still reach the real grader.
  await container().getByRole('button', { name: /^Select/ }).click(); await svg().scrollIntoViewIfNeeded()
  const hookBefore = shapes(await state())
  const hook = await page.evaluate(() => {
    const data = JSON.parse(window.SketchInput.instances['adaptive-photo'].getState()).data
    const ps = data['auto-draft'].find(ps => ps.length >= 2); const p = ps[0]; const m = document.getElementById('adaptive-photo-si-canvas').getScreenCTM()
    // Use the actual rendered hit target, including native CSS and z-order.
    // This still performs an ordinary pointer drag; no native-state injection.
    const offsets = [0, 1, 2, 3, 4, 5, 6, 7, 7.5].flatMap(r => Array.from({ length: 64 }, (_, k) => [r * Math.cos(k * Math.PI / 32), r * Math.sin(k * Math.PI / 32)]))
    const offset = offsets.find(a => { const el = document.elementFromPoint(m.a * (p.x + a[0]) + m.c * (p.y + a[1]) + m.e, m.b * (p.x + a[0]) + m.d * (p.y + a[1]) + m.f); return el?.tagName.toLowerCase() === 'circle' && Number(el.getAttribute('cx')) === p.x && Number(el.getAttribute('cy')) === p.y }); if (!offset) throw Error('Endpoint handle is fully occluded.')
    return [m.a * (p.x + offset[0]) + m.c * (p.y + offset[1]) + m.e, m.b * (p.x + offset[0]) + m.d * (p.y + offset[1]) + m.f, m.a]
  })
  await page.mouse.move(hook[0], hook[1]); await page.mouse.down(); await page.mouse.move(hook[0] + 12 * hook[2], hook[1], { steps: 10 }); await page.mouse.up()
  const hookAfter = shapes(await state())
  check(hookAfter['auto-draft'][0][0].x !== hookBefore['auto-draft'][0][0].x && JSON.stringify(hookAfter['auto-draft'][0].slice(1)) === JSON.stringify(hookBefore['auto-draft'][0].slice(1)) && JSON.stringify(hookAfter['auto-draft'].slice(1)) === JSON.stringify(hookBefore['auto-draft'].slice(1)) && JSON.stringify(hookAfter['auto-smooth']) === JSON.stringify(hookBefore['auto-smooth']), 'Student corrects only the native hook endpoint; smooth sections and other protected vertices stay intact: ' + JSON.stringify({ hook, before: hookBefore['auto-draft'][0], after: hookAfter['auto-draft'][0], smoothChanged: JSON.stringify(hookAfter['auto-smooth']) !== JSON.stringify(hookBefore['auto-smooth']) }))
  const corrected = await save(); await page.screenshot({ path: o.output + '/08-student-correction-graded.png', fullPage: true })
  check(corrected.scores[0] === '100%', 'Explicit student correction reaches 100% through the actual combined native spline/polyline grader')
  check(posts.every(p => !JSON.stringify(p).includes('data:image') && !JSON.stringify(p).includes('source_geometry')), 'Native submissions contain neither photograph nor proposal provenance')
  await page.setViewportSize({ width: 1280, height: 720 }); await svg().scrollIntoViewIfNeeded(); await page.screenshot({ path: o.output + '/06-presentation-viewport.png' }); check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Experimental native curve fits the presentation viewport without horizontal overflow')
  await page.setViewportSize({ width: 390, height: 844 }); await snapshot('07-mobile-native'); check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Experimental controls and native canvas fit a mobile viewport')
  check(errors.length === 0 && external.length === 0, 'No page exceptions, external requests or Gemini calls: ' + JSON.stringify({ errors, external }))
  return { passed: checks.length, checks, initial, accepted, imported, rendered, original_fallback: original, restored_auto: restoredAuto, uncorrected, spline_edit_before: beforeEdit, spline_edit_after: edited, edited_saved: editedSaved, hook_edit_before: hookBefore, hook_edit_after: hookAfter, student_corrected: corrected, errors, external, classification: 'CV-assisted axes; adaptive native representation. No manual curve trace or Gemini output. Final corrected grade follows explicit student edits.' }
}
const options = { url: 'http://localhost:3000/pl/course/1/question/256/preview/', photo: '/Users/alaiasun/Library/Mobile Documents/com~apple~CloudDocs/D. UC Berkeley/Courses/CS294 STAR FA2026/Experiment/examples/IMG_1678.jpg', hash: 'f86a0acd1dc1fcad32884c202e4fffe44adc5d88c1062a0f8a2cbd60dbc74d49', output: '/private/tmp/star-h5/browser' }
if (crypto.createHash('sha256').update(fs.readFileSync(options.photo)).digest('hex') !== options.hash) throw Error('Frozen original photograph changed.')
fs.mkdirSync(options.output, { recursive: true }); const cli = process.env.PL_PHOTO_TEST_CLI || '/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh'
function run (args) { const r = spawnSync(cli, ['-s=star-h5-adaptive', ...args], { cwd: '/private/tmp', encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024 }); const s = (r.stdout || '') + (r.stderr || ''); if (r.error || r.status !== 0 || s.includes('### Error')) throw r.error || Error(s.slice(-5000)); if (args[0] === 'run-code') { const record = JSON.parse(s.split('### Result\n')[1].split('\n###')[0]); fs.writeFileSync(options.output + '/results.json', JSON.stringify(record, null, 2) + '\n'); console.log('Adaptive native assertions passed: ' + record.passed) } }
try { run(['open', options.url, '--browser', 'chrome']); run(['snapshot']); run(['run-code', 'async page => (' + acceptance.toString() + ')(page,' + JSON.stringify(options) + ')']) } catch (error) { console.error(error.message); process.exitCode = 1 } finally { try { run(['close']) } catch (_) {} }
