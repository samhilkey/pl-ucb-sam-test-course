// Actual local canvas-first photo flow. References never enter native data.
const fs = require('node:fs'); const path = require('node:path'); const { spawnSync } = require('node:child_process')
async function acceptance (page, o) {
  const checks = []; const errors = []; const posts = []; const external = []; const outcomes = []
  const check = (ok, label) => { if (!ok) throw Error(label); checks.push(label) }
  page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('request', r => { if (r.method() === 'POST') { const value = new URLSearchParams(r.postData() || '').get('automatic-photo-sketchresponse-submission'); if (value) posts.push(JSON.parse(Buffer.from(value, 'base64').toString())) } })
  await page.route('**/*', route => { const u = new URL(route.request().url()); if (['localhost', '127.0.0.1'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol)) return route.continue(); external.push(u.origin); return route.abort() })
  const container = () => page.locator('#automatic-photo-si-container'); const photo = () => container().locator('.star-canvas-photo'); const svg = () => page.locator('#automatic-photo-si-canvas')
  const status = () => page.evaluate(() => window.StarCanvasReference.instances['automatic-photo'].status())
  const state = () => page.evaluate(() => JSON.parse(window.SketchInput.instances['automatic-photo'].getState()))
  const tools = async () => { const s = await state(); return { ink: s.data['auto-ink'], points: s.data['auto-notes'] } }
  const ready = () => page.waitForFunction(() => window.StarCanvasReference?.instances['automatic-photo'])
  const snap = name => container().screenshot({ path: o.output + '/' + name + '.png' })
  const upload = async file => {
    await photo().locator('input[type=file]').setInputFiles(file)
    await page.waitForFunction(() => window.StarCanvasReference.instances['automatic-photo'].status().photoVisible)
  }
  const awaitCV = () => page.waitForFunction(() => !!window.StarCanvasReference.instances['automatic-photo'].status().recognitionStatus)
  const fresh = async () => {
    await page.goto(o.url, { waitUntil: 'networkidle' }); await ready()
    check((await page.title()).includes('star-automatic-photo-test'), 'Correct local PrairieLearn sandbox loaded')
    await page.evaluate(() => {
      window.__cv = 0; window.__fit = 0; window.__geometry = null
      const recognize = window.StarProviders.recognize
      window.StarProviders.recognize = async (...args) => { window.__cv++; const result = await recognize(...args); window.__geometry = result.geometry; await new Promise(r => setTimeout(r, 350)); return result }
      window.StarFit.fit = window.StarFit.sampleCurve = () => { window.__fit++; throw Error('No equation fitting') }
    })
  }
  const screen = async p => { const b = await svg().boundingBox(); return [b.x + p[0] * b.width / 800, b.y + p[1] * b.height / 600] }
  const draw = async (ps, fit) => {
    await container().getByText('Graph strokes', { exact: true }).click(); await svg().scrollIntoViewIfNeeded()
    const pts = ps.map(p => [fit.x + p[0] * fit.scale, fit.y + p[1] * fit.scale])
    await page.mouse.move(...await screen(pts[0])); await page.mouse.down()
    for (let i = 1; i < pts.length; i++) await page.mouse.move(...await screen(pts[i]), { steps: Math.max(2, Math.ceil(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) / 4)) })
    await page.mouse.up()
  }
  const addPoint = async p => { await container().getByText('Other marks', { exact: true }).click(); await svg().scrollIntoViewIfNeeded(); await page.mouse.click(...await screen(p)) }
  const save = async () => {
    const n = posts.length; await page.getByRole('button', { name: 'Save & Grade', exact: true }).click(); await page.waitForLoadState('networkidle'); await ready()
    check(posts.length === n + 1, 'Ordinary Save & Grade sends a native submission')
    check(await page.getByText('Invalid', { exact: true }).count() === 0, 'Native server accepts the drawing format')
    check(await page.getByText('0%', { exact: true }).count() > 0, 'Existing x-squared grader retains and marks the different native drawing incorrect')
    const submitted = posts.at(-1)
    check(!JSON.stringify(submitted).includes('data:image') && !JSON.stringify(submitted).includes('photo-reference') && !JSON.stringify(submitted).includes('sourceSha256'), 'No photo, provisional layer or reference metadata enters the submitted native JSON')
    await page.waitForFunction(() => window.StarCanvasReference.instances['automatic-photo'].status().photoVisible)
    return submitted
  }
  await page.setViewportSize({ width: 1440, height: 1100 })
  for (const c of o.cases) {
    await fresh()
    await page.evaluate(() => {
      const si = window.SketchInput.instances['automatic-photo']; const config = JSON.parse(si.getState()).meta.config
      si.setState(JSON.stringify({ data: { 'auto-ink': [window.StarNative.encode([{ x: 750, y: 540 }, { x: 770, y: 550 }], 'freeform')], 'auto-notes': [{ x: 735, y: 520 }] } }))
    })
    const prior = await tools(); const originalGrade = await page.evaluate(() => JSON.parse(window.SketchInput.instances['automatic-photo'].getGradeable()).data)
    await upload(c.file)
    check(await page.locator('#automatic-photo-automatic-dialog').isHidden() && await page.locator('#automatic-photo-star-panel').isHidden(), c.id + ': no review wizard opens before drawing')
    check((await status()).recognitionStatus === null, c.id + ': photo is visible before delayed CV result completes')
    await awaitCV(); const ref = await status()
    check(ref.photoVisible && ref.recognitionStatus === c.status, c.id + ': actual failed-CV photograph is visible on the native canvas')
    check(ref.cvOverlayVisible === c.overlay, c.id + ': provisional overlay availability is reported separately')
    check(JSON.stringify(await tools()) === JSON.stringify(prior), c.id + ': recognition never overwrites existing native objects')
    check(JSON.stringify(await page.evaluate(() => JSON.parse(window.SketchInput.instances['automatic-photo'].getGradeable()).data)) === JSON.stringify(originalGrade), c.id + ': image and provisional pixels do not change gradeable geometry')
    const layer = await container().locator('.star-canvas-reference-layer').evaluate(el => ({ tag: el.tagName, index: [...el.parentElement.children].indexOf(el), pointer: getComputedStyle(el).pointerEvents, pathCount: el.querySelectorAll('path').length, hidden: el.getAttribute('aria-hidden') }))
    check(layer.index === 2 && layer.pointer === 'none' && layer.pathCount === 0 && layer.hidden === 'true', c.id + ': pixel-only layer sits beneath native grid/objects without hit targets or SVG paths')
    check(await photo().locator('input[type=file]').getAttribute('name') === null, c.id + ': photo picker has no form field name and cannot upload image bytes with Save & Grade')
    await snap(c.id + '--photo-and-cv')
    if (c.id === 'IMG_1670') {
      await photo().locator('.star-canvas-visible').click(); check(!(await status()).photoVisible && JSON.stringify(await tools()) === JSON.stringify(prior), 'Hide photo leaves native objects unchanged')
      await snap('demo-02-hidden'); await photo().locator('.star-canvas-visible').click()
    }
    const fit = ref.fit
    const options = photo().locator('.star-canvas-photo-options'); if (!await options.evaluate(e => e.open)) await options.locator('summary').click()
    await photo().locator('.star-canvas-edit').click()
    for (const stroke of c.strokes) await draw(stroke, fit)
    await page.waitForFunction(n => JSON.parse(window.SketchInput.instances['automatic-photo'].getState()).data['auto-ink'].length === n, 1 + c.strokes.length)
    check((await tools()).ink.length === 1 + c.strokes.length, c.id + ': real native free-draw gestures create editable geometry over the photo')
    if (c.dot) await addPoint([fit.x + c.dot[0] * fit.scale, fit.y + c.dot[1] * fit.scale])
    const drawn = await tools()
    check(JSON.stringify(drawn.ink[0]) === JSON.stringify(prior.ink[0]) && JSON.stringify(drawn.points[0]) === JSON.stringify(prior.points[0]), c.id + ': manual drawing preserves prior curves and points')
    check(drawn.points.length === prior.points.length + (c.dot ? 1 : 0), c.id + ': source dot is an independent manually added native object')
    await snap(c.id + '--native-drawn')
    if (c.id === 'IMG_1670') {
      await addPoint([650, 70]); await container().getByRole('button', { name: /^Select/ }).click(); await svg().scrollIntoViewIfNeeded(); await page.mouse.click(...await screen([650, 70]))
      await container().getByRole('button', { name: /Delete/ }).click()
      check((await tools()).points.length === drawn.points.length, 'Native Select/Delete removes a temporary point without erasing the reference')
      check((await status()).photoVisible, 'Native erasing leaves the photo reference available')
      await container().getByRole('button', { name: /^Select/ }).click(); await svg().scrollIntoViewIfNeeded()
      const grab = await page.evaluate(() => { const p = document.querySelectorAll('#automatic-photo-si-canvas path.plugin-id-auto-ink')[1]; const q = p.getPointAtLength(p.getTotalLength() * 0.27); const m = p.getScreenCTM(); return [m.a * q.x + m.c * q.y + m.e, m.b * q.x + m.d * q.y + m.f] })
      const beforeEdit = await tools(); await page.mouse.move(...grab); await page.mouse.down(); await page.mouse.move(grab[0] + 12, grab[1] + 9, { steps: 8 }); await page.mouse.up()
      const afterEdit = await tools(); check(JSON.stringify(afterEdit.ink[1]) !== JSON.stringify(beforeEdit.ink[1]), 'Native Select edits the traced curve while the reference is visible')
      check(JSON.stringify(afterEdit.ink[0]) === JSON.stringify(prior.ink[0]) && JSON.stringify(afterEdit.points) === JSON.stringify(beforeEdit.points), 'Editing the traced branch preserves unrelated curves and both dots')
      await snap('demo-04-native-correction')
    }
    await page.waitForFunction(() => window.StarCanvasReference.instances['automatic-photo'].status().stored)
    const beforeSave = await tools(); const submitted = await save(); const afterSave = await tools(); const restoredPhoto = await status()
    check(JSON.stringify(afterSave) === JSON.stringify(beforeSave), c.id + ': Save & Grade restores exact native curves and points')
    check(restoredPhoto.sourceSha256 === ref.sourceSha256 && restoredPhoto.scope === ref.scope && restoredPhoto.stored, c.id + ': same-attempt photo restores from exact local bytes without entering the answer')
    await page.reload({ waitUntil: 'networkidle' }); await ready(); await page.waitForFunction(() => window.StarCanvasReference.instances['automatic-photo'].status().photoVisible)
    check(JSON.stringify(await tools()) === JSON.stringify(beforeSave), c.id + ': refresh restores native drawings independently of the photo')
    await snap(c.id + '--saved-restored')
    outcomes.push({ id: c.id, photo_visible: true, cv_overlay_visible: c.overlay, cv_status: c.status, automatically_added_native_objects: 0, user_native_branches_added: c.strokes.length, manually_added_source_dots: c.dot ? 1 : 0, native_editable: true, successfully_saved_graded: true, native_state: beforeSave, submitted, reference: ref, restored_reference: await status(), classification: 'Manual native drawing over an ungraded, uncalibrated visual reference; not automatic recognition or calibrated photo transcription', url: page.url() })
    await photo().locator('.star-canvas-photo-options summary').click(); await photo().locator('.star-canvas-remove').click()
    check(!(await status()).photoVisible && JSON.stringify(await tools()) === JSON.stringify(beforeSave), c.id + ': remove reference retains every native object')
    await page.reload({ waitUntil: 'networkidle' }); await ready(); check(!(await status()).photoVisible, c.id + ': removed photo does not reappear after refresh')
  }
  check(errors.length === 0 && external.length === 0, 'No application errors or external-provider requests')
  return { passed: checks.length, checks, outcomes, errors, external, calibrated_photo_geometry_claimed: false, inference_requests: 0 }
}
const root = path.resolve(__dirname, '..'); const input = root + '/benchmarks/photo-graphs/automatic-cv/experiment-01/inputs'
const paper = require('../benchmarks/photo-graphs/multi-method/step-4f/operator-actions.json')
const lineCase = require('../benchmarks/photo-graphs/multi-method/step-4c/operator-actions.json').cases.find(c => c.id.startsWith('real--01'))
const peak = require('../benchmarks/photo-graphs/multi-method/step-4c/operator-actions.json').cases.find(c => c.id.startsWith('real--06'))
const options = { url: 'http://localhost:3000/pl/course/1/question/254/preview/', output: path.resolve(process.env.PL_PHOTO_TEST_OUTPUT || '/private/tmp/star-step4g4/acceptance'), cases: [
  { id: 'IMG_1670', file: process.env.STAR_CANVAS_TEST_PHOTO || root + '/benchmarks/photo-graphs/multi-method/step-4g-1/results/IMG_1670--source.png', status: 'needs_review', overlay: true, strokes: paper.pointer_strokes, dot: [821, 294] },
  { id: 'real--01', file: input + '/real--01-multiple-lines-graph-paper.png', status: 'abstained', overlay: false, strokes: lineCase.pointer_strokes },
  { id: 'real--06', file: input + '/real--06-piecewise-graph-paper.png', status: 'needs_review', overlay: true, strokes: peak.pointer_strokes }
] }
fs.mkdirSync(options.output, { recursive: true }); const cli = process.env.PL_PHOTO_TEST_CLI || 'playwright-cli'
function run (args) { const r = spawnSync(cli, ['-s=star-canvas-reference', ...args], { cwd: '/private/tmp', encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024 }); const s = (r.stdout || '') + (r.stderr || ''); if (r.error || r.status !== 0 || s.includes('### Error')) throw r.error || Error(s.slice(-5000)); if (args[0] === 'run-code') { const result = JSON.parse(s.split('### Result\n')[1].split('\n###')[0]); fs.writeFileSync(options.output + '/results.json', JSON.stringify(result, null, 2) + '\n'); console.log('Canvas-first assertions passed: ' + result.passed) } }
try { run(['open', options.url, '--browser', 'chrome']); run(['snapshot']); run(['run-code', 'async page => (' + acceptance.toString() + ')(page, ' + JSON.stringify(options) + ')']) } catch (e) { console.error(e.message); process.exitCode = 1 } finally { try { run(['close']) } catch (_) {} }
