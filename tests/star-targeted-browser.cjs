// Actual normal sandbox UI. No injected fixtures, provider results, or test-only controls.
const fs = require('node:fs'); const path = require('node:path'); const { spawnSync } = require('node:child_process')
async function acceptance (page, o) {
  const checks = []; const errors = []; const external = []; const imports = []; const posts = []; const check = (ok, s) => { if (!ok) throw Error(s); checks.push(s) }
  page.on('pageerror', e => errors.push(String(e))); page.on('request', r => { if (r.method() === 'POST') { const v = new URLSearchParams(r.postData() || '').get('automatic-photo-sketchresponse-submission'); if (v) posts.push(JSON.parse(Buffer.from(v, 'base64').toString())) } })
  await page.route('**/*', r => { const u = new URL(r.request().url()); if (['localhost', '127.0.0.1'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol)) return r.continue(); external.push(u.origin); return r.abort() })
  const ready = () => page.waitForFunction(() => window.StarCanvasReview?.instances['automatic-photo'])
  const container = () => page.locator('#automatic-photo-si-container'); const panel = () => container().locator('.star-canvas-correction'); const svg = () => page.locator('#automatic-photo-si-canvas')
  const state = () => page.evaluate(() => JSON.parse(window.SketchInput.instances['automatic-photo'].getState()))
  const native = async () => { const s = (await state()).data; return { curves: s['auto-ink'], points: s['auto-notes'] } }
  const ref = () => page.evaluate(() => window.StarCanvasReference.instances['automatic-photo'].status())
  const snap = name => container().screenshot({ path: o.output + '/' + name + '.png' })
  const correct = async () => { const options = container().locator('.star-canvas-photo-options'); if (!await options.evaluate(e => e.open)) await options.locator('summary').click(); await container().locator('.star-canvas-correct').click() }
  const fresh = async () => {
    await page.goto(o.url, { waitUntil: 'networkidle' }); await ready()
    check((await page.title()).includes('star-automatic-photo-test'), 'Actual local PrairieLearn sandbox loaded')
    await page.evaluate(() => { document.getElementById('automatic-photo-si-container').addEventListener('star-canvas-imported', e => { window.__accepted = JSON.parse(JSON.stringify(e.detail)) }); window.StarFit.fit = window.StarFit.sampleCurve = () => { throw Error('No equation fitting') } })
  }
  const upload = async file => { await container().locator('.star-canvas-photo input[type=file]').setInputFiles(file); await page.waitForFunction(() => !!window.StarCanvasReference.instances['automatic-photo'].status().recognitionStatus) }
  const clickPhoto = async p => {
    await svg().scrollIntoViewIfNeeded()
    const screen = await page.evaluate(p => { const s = document.getElementById('automatic-photo-si-canvas'); const q = window.StarCanvasReference.instances['automatic-photo'].toCanvas(p); const v = new DOMPoint(...q).matrixTransform(s.getScreenCTM()); return [v.x, v.y] }, p)
    await page.mouse.click(...screen)
  }
  const calibrate = async () => { await clickPhoto([782, 786]); await clickPhoto([1229, 775]); await clickPhoto([751, 300]); await panel().locator('.star-correction-x').fill('3'); await panel().locator('.star-correction-y').fill('3') }
  const selectCurve = async () => { await clickPhoto([110, 714]); await clickPhoto([1469, 629]); await panel().locator('[data-pick=point]').click(); await clickPhoto([821, 294]) }
  const save = async expected => {
    const before = await native(); const count = posts.length
    await page.getByRole('button', { name: 'Save & Grade', exact: true }).click(); await page.waitForLoadState('networkidle'); await ready()
    check(posts.length === count + 1, 'Normal Save & Grade receives the native answer')
    check(await page.getByText('Invalid', { exact: true }).count() === 0, 'Native answer format accepted by unchanged server')
    check(await page.getByText(expected, { exact: true }).filter({ visible: true }).count() > 0, 'Visible actual grade is ' + expected)
    check(!JSON.stringify(posts.at(-1)).includes('data:image') && !JSON.stringify(posts.at(-1)).includes('targeted_cv'), 'Submitted native payload contains no photograph or recognition provenance')
    check(JSON.stringify(await native()) === JSON.stringify(before), 'Save & Grade restores exact native objects')
    await page.waitForFunction(() => window.StarCanvasReference.instances['automatic-photo'].status().photoVisible)
    check((await ref()).aligned, 'Confirmed photo-to-native alignment restores in the same attempt')
    await page.reload({ waitUntil: 'networkidle' }); await ready(); await page.waitForFunction(() => window.StarCanvasReference.instances['automatic-photo'].status().photoVisible)
    check(JSON.stringify(await native()) === JSON.stringify(before) && (await ref()).aligned, 'Browser refresh restores native objects and confirmed photo alignment independently')
    return { submission: posts.at(-1), native: before, url: page.url(), reference: await ref() }
  }
  await page.setViewportSize({ width: 1440, height: 1100 }); await fresh()
  await page.evaluate(() => window.SketchInput.instances['automatic-photo'].setState(JSON.stringify({ data: { 'auto-ink': [window.StarNative.encode([{ x: 750, y: 540 }, { x: 770, y: 550 }], 'freeform')], 'auto-notes': [{ x: 735, y: 520 }] } })))
  const prior = await native(); await upload(o.photo)
  check((await ref()).photoVisible && (await ref()).recognitionStatus === 'needs_review', 'Actual original IMG_1670.jpg is visible; automatic recognition still needs review')
  check(JSON.stringify(await native()) === JSON.stringify(prior), 'Upload/recognition preserve existing curve and point')
  await snap('01-uploaded'); await correct()
  check(await page.locator('#automatic-photo-automatic-dialog').isHidden() && await page.locator('#automatic-photo-star-panel').isHidden(), 'Short correction stays directly on the real canvas; no advanced/manual wizard')
  check(await panel().locator('.star-correction-accept').isHidden(), 'Uncalibrated/unselected geometry cannot be accepted')
  await calibrate(); await selectCurve()
  check(JSON.stringify(await native()) === JSON.stringify(prior), 'Marker/endpoint/dot clicks create no unintended native ink')
  await snap('02-selected'); await panel().locator('.star-correction-preview').click()
  await panel().locator('.star-correction-accept').waitFor({ state: 'visible' })
  check(await page.evaluate(() => window.StarCanvasReview.instances['automatic-photo'].status().hasProposal), 'Student calibration and endpoint selection produce a validated native proposal')
  check(JSON.stringify(await native()) === JSON.stringify(prior), 'Aligned preview remains ungraded and outside native state until acceptance')
  const pickedAxes = await page.evaluate(() => window.StarCanvasReview.instances['automatic-photo'].status().axisValues)
  check([['origin', [782, 786]], ['xMarker', [1229, 775]], ['yMarker', [751, 300]]].every(([k, p]) => Math.hypot(...p.map((v, i) => v - pickedAxes[k][i])) < 4), 'Actual browser marker clicks stay within four source pixels of the requested visible axis anchors')
  const alignment = await page.evaluate(() => { const r = window.StarCanvasReference.instances['automatic-photo']; const cfg = JSON.parse(window.SketchInput.instances['automatic-photo'].getState()).meta.config; const v = window.StarCanvasReview.instances['automatic-photo'].status().axisValues; return [[v.origin, [0, 0]], [v.xMarker, [v.xValue, 0]], [v.yMarker, [0, v.yValue]]].map(([p, q]) => { const a = r.toCanvas(p); const b = window.StarNative.graphToNative(cfg, q); return Math.hypot(a[0] - b.x, a[1] - b.y) }) })
  check(alignment.every(d => d < 1e-6), 'Three confirmed calibration anchors align independently with native mathematical coordinates')
  await snap('03-aligned-preview'); await panel().locator('.star-correction-accept').click()
  const actual = await page.evaluate(() => window.__accepted); imports.push(actual)
  check(actual.geometry.provenance.method === 'targeted_cv' && actual.geometry.provenance.automatically_recognized === false, 'Imported result is explicitly CV-assisted, not Gemini or automatic recognition')
  check(actual.geometry.strokes.length === 1 && actual.geometry.points.length === 1, 'One selected connected branch and isolated measured dot reach the adapter')
  const imported = await native()
  check(imported.curves.length === 2 && imported.points.length === 2, 'Actual editable native curve and point objects created')
  check(JSON.stringify(imported.curves[0]) === JSON.stringify(prior.curves[0]) && JSON.stringify(imported.points[0]) === JSON.stringify(prior.points[0]), 'Existing unrelated native curve and point preserved')
  check(await panel().isHidden(), 'Acceptance returns directly to ordinary native editing')
  await snap('04-native-created')
  const paper = await save('0%'); await page.screenshot({ path: o.output + '/05-graded-restored.png', fullPage: true })
  // Native branch editing and a second ordinary save do not depend on recognition.
  await container().getByRole('button', { name: /^Select/ }).click(); await svg().scrollIntoViewIfNeeded()
  const grab = await page.evaluate(() => { const p = document.querySelectorAll('#automatic-photo-si-canvas path.plugin-id-auto-ink')[1]; const a = p.getPointAtLength(p.getTotalLength() * 0.25); const m = p.getScreenCTM(); return [m.a * a.x + m.c * a.y + m.e, m.b * a.x + m.d * a.y + m.f] })
  await page.mouse.move(...grab); await page.mouse.down(); await page.mouse.move(grab[0] + 12, grab[1] + 9, { steps: 8 }); await page.mouse.up(); const edited = await native()
  check(JSON.stringify(edited.curves[1]) !== JSON.stringify(imported.curves[1]) && JSON.stringify(edited.curves[0]) === JSON.stringify(imported.curves[0]) && JSON.stringify(edited.points) === JSON.stringify(imported.points), 'Native Select edits the imported branch while preserving prior curve and both points')
  const editedSaved = await save('0%'); await snap('06-edited-restored')
  // Stale review is rejected, cancellation and replacement leave native drawings intact.
  await correct(); await calibrate(); await selectCurve(); await panel().locator('.star-correction-preview').click()
  await page.evaluate(() => { const si = window.SketchInput.instances['automatic-photo']; const data = JSON.parse(si.getState()).data; si.setState(JSON.stringify({ data: { 'auto-notes': data['auto-notes'].concat([{ x: 650, y: 500 }]) } })) })
  const staleState = await native(); await panel().locator('.star-correction-accept').click()
  check(await panel().locator('.star-correction-accept').isDisabled() && JSON.stringify(await native()) === JSON.stringify(staleState), 'Canvas changes after preview block stale acceptance and retain the new native object')
  await panel().locator('.star-correction-cancel').click()
  await container().locator('.star-canvas-photo input[type=file]').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('invalid') }); await container().locator('.star-canvas-photo-status').filter({ hasText: 'previous photo' }).waitFor()
  check((await ref()).photoVisible && JSON.stringify(await native()) === JSON.stringify(staleState), 'Rejected photo preserves previous image and every native object')
  // Positive CONTROL uses normal automatic UI; it is never called a handwritten photo.
  await fresh(); await upload(o.control)
  await correct()
  check(await panel().locator('.star-correction-accept').isVisible(), 'Calibrated controlled candidate opens directly in on-canvas review')
  check((await native()).curves.length === 0, 'Automatic controlled preview is not gradeable until explicitly accepted')
  await panel().locator('.star-correction-accept').click(); const controlled = await page.evaluate(() => window.__accepted); imports.push(controlled)
  const positive = await save('100%'); await page.screenshot({ path: o.output + '/controlled--100-percent.png', fullPage: true })
  // No-strokes real photo supports short alignment plus ordinary native drawing.
  await fresh(); await upload(o.abstained); await correct()
  check(await panel().isVisible() && !(await native()).curves.length, 'Abstained input offers visible on-canvas alignment without fabricating a candidate')
  // Mobile controls and Escape recovery use the actual UI.
  await page.setViewportSize({ width: 390, height: 844 }); await snap('mobile-correction')
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Correction controls fit a 390px viewport without horizontal page overflow')
  await svg().focus(); await svg().press('ArrowLeft'); await svg().press('Enter'); await svg().press('Escape')
  check(await panel().isHidden() && !(await native()).curves.length, 'Keyboard pick/Escape recovery creates no unintended gradeable drawing')
  check(errors.length === 0 && external.length === 0, 'No page exceptions or external API/provider requests')
  return { passed: checks.length, checks, imports, paper, editedSaved, positive_control: positive, alignment_errors_native_pixel: alignment, errors, external, original_jpeg_used: true, real_x_squared_photo_tested: false, automatic_real_photo_success: false, real_photo_route: 'CV-assisted endpoint selection and manual calibration', overall_verdict: 'CONDITIONAL PASS for visible assisted UI; automatic fidelity and missing real x-squared acceptance remain incomplete' }
}
const options = { url: 'http://localhost:3000/pl/course/1/question/254/preview/', photo: '/Users/alaiasun/Library/Mobile Documents/com~apple~CloudDocs/D. UC Berkeley/Courses/CS294 STAR FA2026/Experiment/examples/IMG_1670.jpg', control: path.resolve(__dirname, '../benchmarks/photo-graphs/multi-method/step-4h/inputs/matching-answer-controlled.png'), abstained: path.resolve(__dirname, '../benchmarks/photo-graphs/automatic-cv/experiment-01/inputs/real--01-multiple-lines-graph-paper.png'), output: '/private/tmp/star-h2/browser' }
fs.mkdirSync(options.output, { recursive: true }); const cli = process.env.PL_PHOTO_TEST_CLI || '/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh'
function run (args) { const r = spawnSync(cli, ['-s=star-h2-visible', ...args], { cwd: '/private/tmp', encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024 }); const s = (r.stdout || '') + (r.stderr || ''); if (r.error || r.status !== 0 || s.includes('### Error')) throw r.error || Error(s.slice(-5000)); if (args[0] === 'run-code') { const value = JSON.parse(s.split('### Result\n')[1].split('\n###')[0]); fs.writeFileSync(options.output + '/results.json', JSON.stringify(value) + '\n'); console.log('Visible normal-UI assertions passed: ' + value.passed) } }
try { run(['open', options.url, '--browser', 'chrome']); run(['snapshot']); run(['run-code', 'async page => (' + acceptance.toString() + ')(page,' + JSON.stringify(options) + ')']) } catch (e) { console.error(e.message); process.exitCode = 1 } finally { try { run(['close']) } catch (_) {} }
