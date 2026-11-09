// Actual normal UI, exact original JPEG. No injected predictions or tracing.
const fs = require('node:fs'); const path = require('node:path'); const crypto = require('node:crypto'); const { spawnSync } = require('node:child_process')
async function acceptance (page, o) {
  const checks = []; const errors = []; const external = []; const posts = []; const check = (ok, s) => { if (!ok) throw Error(s); checks.push(s) }
  page.on('pageerror', e => errors.push(String(e)))
  page.on('request', r => { if (r.method() === 'POST') { const encoded = new URLSearchParams(r.postData() || '').get('automatic-photo-sketchresponse-submission'); if (encoded) posts.push(JSON.parse(Buffer.from(encoded, 'base64').toString())) } })
  await page.route('**/*', r => { const u = new URL(r.request().url()); if (['localhost', '127.0.0.1'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol)) return r.continue(); external.push(u.origin); return r.abort() })
  const ready = () => page.waitForFunction(() => window.StarCanvasReview?.instances['automatic-photo'])
  const container = () => page.locator('#automatic-photo-si-container'); const panel = () => container().locator('.star-canvas-correction'); const svg = () => page.locator('#automatic-photo-si-canvas')
  const state = () => page.evaluate(() => JSON.parse(window.SketchInput.instances['automatic-photo'].getState()))
  const drawings = s => ({ curves: s.data['auto-ink'], points: s.data['auto-notes'] })
  const ref = () => page.evaluate(() => window.StarCanvasReference.instances['automatic-photo'].status())
  const snapshot = name => container().screenshot({ path: o.output + '/' + name + '.png' })
  const fresh = async () => { await page.goto(o.url, { waitUntil: 'networkidle' }); await ready(); await page.evaluate(() => {
    window.StarFit.fit = window.StarFit.sampleCurve = () => { throw Error('No equation fitting') }
    const original = window.StarProviders.recognize
    window.StarProviders.recognize = (image, options) => { const r = original(image, options); window.__observed = JSON.parse(JSON.stringify({ geometry: r.geometry, method: r.method, marks: r.marks })); return r }
    document.getElementById('automatic-photo-si-container').addEventListener('star-canvas-imported', e => { window.__accepted = JSON.parse(JSON.stringify(e.detail)) })
  }) }
  const upload = async filename => { await container().locator('.star-canvas-photo input[type=file]').setInputFiles(filename); await page.waitForFunction(() => window.__observed && window.StarCanvasReference.instances['automatic-photo'].status().recognitionStatus) }
  const clickPhoto = async p => { await svg().scrollIntoViewIfNeeded(); const q = await page.evaluate(p => { const v = window.StarCanvasReference.instances['automatic-photo'].toCanvas(p); const s = document.getElementById('automatic-photo-si-canvas'); const q = new DOMPoint(...v).matrixTransform(s.getScreenCTM()); return [q.x, q.y] }, p); await page.mouse.click(...q) }
  await page.setViewportSize({ width: 1440, height: 1100 }); await fresh()
  check((await page.title()).includes('star-automatic-photo-test'), 'Actual local PrairieLearn sandbox identity verified')
  check((await state()).data['auto-ink'].length === 0, 'New attempt starts with no native curve')
  const before = await state(); await upload(o.photo); const automatic = await page.evaluate(() => window.__observed)
  check((await ref()).photoVisible && (await ref()).sourceSha256 === o.hash, 'Exact original IMG_1678.jpg is visible on the actual canvas')
  check(automatic.method === 'CV automatic' && automatic.geometry.calibration.status === 'uncertain' && automatic.geometry.status === 'needs_review', 'Real-photo automatic recognition reports uncertain calibration, not hybrid/Gemini success')
  check(JSON.stringify((await state()).data) === JSON.stringify(before.data), 'Recognition creates no native object and preserves the initial state')
  await snapshot('01-real-photo-not-native'); await container().locator('.star-canvas-correct').click()
  for (const p of [[842, 1147], [1490, 1130], [826, 517]]) await clickPhoto(p)
  await panel().locator('.star-correction-x').fill('4'); await panel().locator('.star-correction-y').fill('4')
  for (const p of [[483, 310], [1193, 275]]) await clickPhoto(p)
  await panel().locator('.star-correction-preview').click(); const blocker = await panel().locator('.star-correction-help').innerText()
  check(blocker.includes('red segment') && blocker.includes('reference only'), 'Specific function-input blocker explains that the visible photo is not imported geometry')
  check(await panel().locator('.star-correction-accept').isHidden(), 'Faithful terminal hook cannot bypass the unchanged function guard')
  check(JSON.stringify((await state()).data) === JSON.stringify(before.data), 'Blocked CV-assisted import retains the original empty native drawing')
  await snapshot('02-terminal-hook-blocked')
  const correctedState = await state(); await panel().locator('.star-correction-align').click()
  check((await ref()).aligned, 'Explicit manual axes align only the reference photograph')
  check((await container().locator('.star-canvas-photo-status').innerText()).includes('An empty native answer is Invalid'), 'Alignment-only completion explicitly warns that no photo curve was imported')
  check(JSON.stringify(drawings(await state())) === JSON.stringify(drawings(before)), 'Alignment changes only the active tool, never the native drawing')
  await snapshot('03-aligned-reference-empty-native')
  await page.getByRole('button', { name: 'Save & Grade', exact: true }).click(); await page.waitForLoadState('networkidle'); await ready()
  check(await page.getByText('Invalid', { exact: true }).count() > 0, 'Reproduced actual empty-native Invalid submission; it is not reported as recognition success')
  const invalid = { state: await state(), submission: posts.at(-1), url: page.url() }; await snapshot('04-invalid-empty-native'); await page.screenshot({ path: o.output + '/04-invalid-full-page.png', fullPage: true })
  await page.reload({ waitUntil: 'networkidle' }); await ready(); await page.waitForFunction(() => window.StarCanvasReference.instances['automatic-photo'].status().photoVisible)
  check(JSON.stringify(drawings(await state())) === JSON.stringify(drawings(before)) && (await ref()).aligned, 'Refresh restores the reference and empty native drawing without pretending to restore a recognized curve')
  const real = { automatic, after_recognition: before.data, after_assisted_preview: correctedState.data, after_alignment: invalid.state.data, blocker, invalid, automatic_native_success: false, cv_assisted_native_success: false, manually_traced: false, gemini_requests: 0 }
  await fresh(); await page.evaluate(() => window.SketchInput.instances['automatic-photo'].setState(JSON.stringify({ data: { 'auto-notes': [{ x: 735, y: 520 }] } }))); await upload(o.control); await container().locator('.star-canvas-correct').click()
  check(await panel().locator('.star-correction-accept').isVisible(), 'Separate controlled raster automatically provides a valid calibrated native proposal')
  check((await state()).data['auto-ink'].length === 0, 'Controlled automatic preview stays outside native state until acceptance')
  await panel().locator('.star-correction-accept').click(); const imported = await state(); const accepted = await page.evaluate(() => window.__accepted)
  check(imported.data['auto-ink'].length === 1 && accepted.geometry.status === 'automatic', 'Explicit acceptance writes actual freeform controls through native si.setState')
  check(imported.data['auto-notes'].length === 1 && imported.data['auto-notes'][0].x === 735 && imported.data['auto-notes'][0].y === 520, 'Positive native import preserves the unrelated existing point')
  await snapshot('05-control-native-before-grade')
  const save = async () => { const before = drawings(await state()); await page.getByRole('button', { name: 'Save & Grade', exact: true }).click(); await page.waitForLoadState('networkidle'); await ready(); check(await page.getByText('Invalid', { exact: true }).count() === 0, 'Native geometry has a valid server submission'); check(JSON.stringify(drawings(await state())) === JSON.stringify(before), 'Save & Grade preserves the actual native drawing'); await page.reload({ waitUntil: 'networkidle' }); await ready(); check(JSON.stringify(drawings(await state())) === JSON.stringify(before), 'Refresh restores the exact native drawing'); return { scores: (await page.locator('.badge').filter({ visible: true }).allTextContents()).map(v => v.trim()).filter(v => /^\d+(?:\.\d+)?%$/.test(v)), submission: posts.at(-1), state: await state(), url: page.url() } }
  const graded = await save(); check(await page.getByText('100%', { exact: true }).filter({ visible: true }).count() > 0, 'Controlled raster earns actual 100% grade; not a real-photo recognition claim')
  await snapshot('06-control-graded-restored'); await page.screenshot({ path: o.output + '/06-control-grade-full-page.png', fullPage: true })
  await container().getByRole('button', { name: /^Select/ }).click(); await svg().scrollIntoViewIfNeeded()
  const grab = await page.evaluate(() => { const p = document.querySelector('#automatic-photo-si-canvas path.plugin-id-auto-ink'); const a = p.getPointAtLength(p.getTotalLength() * 0.25); const m = p.getScreenCTM(); return [m.a * a.x + m.c * a.y + m.e, m.b * a.x + m.d * a.y + m.f] })
  await page.mouse.move(...grab); await page.mouse.down(); await page.mouse.move(grab[0] + 10, grab[1] + 8, { steps: 8 }); await page.mouse.up()
  check(JSON.stringify((await state()).data['auto-ink']) !== JSON.stringify(imported.data['auto-ink']), 'Actual Select tool edits the imported native controls')
  const edited = await save(); await snapshot('07-control-edited-restored')
  check(posts.every(p => !JSON.stringify(p).includes('data:image') && !JSON.stringify(p).includes('source_geometry')), 'Submitted native answers contain no photo/reference/provenance')
  await page.setViewportSize({ width: 390, height: 844 }); await snapshot('08-mobile-native')
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Actual canvas interface fits 390px viewport')
  check(errors.length === 0 && external.length === 0, 'No page exceptions or external requests')
  return { passed: checks.length, checks, real_photo: real, controlled_raster: { source_kind: 'controlled_raster', accepted, before_import: [], imported, graded, edited }, errors, external,
    verdict: 'FAIL: IMG_1678 automatic and unchanged CV-assisted native import remain blocked; controlled native path passes. No manual reconstruction was performed in this test.' }
}
const options = { url: 'http://localhost:3000/pl/course/1/question/254/preview/', photo: '/Users/alaiasun/Library/Mobile Documents/com~apple~CloudDocs/D. UC Berkeley/Courses/CS294 STAR FA2026/Experiment/examples/IMG_1678.jpg', hash: 'f86a0acd1dc1fcad32884c202e4fffe44adc5d88c1062a0f8a2cbd60dbc74d49', control: path.resolve(__dirname, '../benchmarks/photo-graphs/multi-method/step-4h/inputs/matching-answer-controlled.png'), output: '/private/tmp/star-h3/browser' }
if (crypto.createHash('sha256').update(fs.readFileSync(options.photo)).digest('hex') !== options.hash) throw Error('Exact original photograph changed.')
fs.mkdirSync(options.output, { recursive: true }); const cli = process.env.PL_PHOTO_TEST_CLI || '/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh'
function run (args) { const r = spawnSync(cli, ['-s=star-h3-native', ...args], { cwd: '/private/tmp', encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024 }); const s = (r.stdout || '') + (r.stderr || ''); if (r.error || r.status !== 0 || s.includes('### Error')) throw r.error || Error(s.slice(-5000)); if (args[0] === 'run-code') { const value = JSON.parse(s.split('### Result\n')[1].split('\n###')[0]); fs.writeFileSync(options.output + '/results.json', JSON.stringify(value, null, 2) + '\n'); console.log('Native photo blocker/positive control assertions passed: ' + value.passed) } }
try { run(['open', options.url, '--browser', 'chrome']); run(['snapshot']); run(['run-code', 'async page => (' + acceptance.toString() + ')(page,' + JSON.stringify(options) + ')']) } catch (e) { console.error(e.message); process.exitCode = 1 } finally { try { run(['close']) } catch (_) {} }
