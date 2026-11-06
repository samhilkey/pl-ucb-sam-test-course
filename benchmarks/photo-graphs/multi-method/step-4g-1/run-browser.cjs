// Local automatic attempts first. Evaluator references and manual actions are
// loaded only after the automatic browser run has returned its observations.
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
async function automatic (page, options) {
  const checks = []; const errors = []; const external = []; const outcomes = []
  const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label) }
  page.on('pageerror', e => errors.push(String(e)))
  await page.route('**/*', route => {
    const u = new URL(route.request().url())
    if (['localhost', '127.0.0.1'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol)) return route.continue()
    external.push(u.origin); return route.abort()
  })
  const panel = () => page.locator('#automatic-photo-automatic-dialog')
  const state = () => page.evaluate(() => JSON.parse(window.SketchInput.instances['automatic-photo'].getState()).data)
  for (const c of options.cases) {
    await page.setViewportSize({ width: c.mobile ? 390 : 1440, height: c.mobile ? 844 : 1100 })
    await page.goto(options.url + '/', { waitUntil: 'networkidle' })
    await page.waitForFunction(() => window.SketchInput?.instances['automatic-photo'] && window.StarProviders)
    check((await page.title()).includes('star-automatic-photo-test'), c.id + ': correct nonblank PrairieLearn sandbox')
    check((await page.locator('#automatic-photo-automatic-button').getAttribute('class')).includes('btn-primary'), c.id + ': automatic recognition is primary')
    check(!(await page.locator('#automatic-photo-star-photo-btn').getAttribute('class')).includes('btn-primary'), c.id + ': manual tracing is secondary')
    await page.evaluate(() => {
      window.__attempt = null; window.__manualCalls = 0; window.__fitCalls = 0; window.__files = []
      const decode = window.createImageBitmap
      window.createImageBitmap = (...args) => { window.__files.push(args[0]); return decode(...args) }
      const recognize = window.StarProviders.recognize
      window.StarProviders.recognize = (image, options) => {
        const start = performance.now(); const r = recognize(image, options)
        const masks = {}
        for (const name of ['ink', 'skeleton']) {
          const canvas = document.createElement('canvas'); canvas.width = r.debug.width; canvas.height = r.debug.height
          const ctx = canvas.getContext('2d'); const p = ctx.createImageData(canvas.width, canvas.height)
          r.debug[name].forEach((v, i) => p.data.set([v ? 0 : 255, v ? 0 : 255, v ? 0 : 255, 255], 4 * i))
          ctx.putImageData(p, 0, 0); masks[name] = canvas.toDataURL()
        }
        window.__attempt = { geometry: r.geometry, method: r.method, marks: r.marks, option_keys: Object.keys(options), latency_ms: performance.now() - start, masks }
        return r
      }
      const trace = window.StarAssisted.fromTrace
      window.StarAssisted.fromTrace = (...args) => { window.__manualCalls++; return trace(...args) }
      window.StarFit.fit = window.StarFit.sampleCurve = () => { window.__fitCalls++; throw new Error('Equation fitting forbidden') }
      window.SketchInput.instances['automatic-photo'].setState(JSON.stringify({ data: { 'auto-notes': [{ x: 40, y: 50 }] } }))
    })
    const prior = await state()
    await page.locator('#automatic-photo-automatic-button').click()
    if (c.rejectFirst) {
      await panel().locator('input[type=file]').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('invalid image') })
      await panel().locator('.star-auto-status').filter({ hasText: 'Could not recognize this photo' }).waitFor()
      check(await panel().locator('.star-auto-confirm').isDisabled() && JSON.stringify(await state()) === JSON.stringify(prior), 'Unreadable photo cannot create a proposal or change native objects')
      await page.evaluate(() => { window.__files = [] })
    }
    await panel().locator('input[type=file]').setInputFiles(c.file)
    await page.waitForFunction(() => !document.querySelector('.star-auto-retry').disabled)
    const attempt = await page.evaluate(() => window.__attempt)
    check(!!attempt, c.id + ': actual uploaded pixels reached the CV provider')
    check(attempt.option_keys.join() === 'inputRevision', c.id + ': no calibration, points, answer or reference entered recognition')
    check(await page.evaluate(() => window.__manualCalls === 0 && window.__fitCalls === 0), c.id + ': no manual tracing or equation fitting before automatic attempt')
    check(attempt.geometry.status !== 'automatic' && attempt.geometry.calibration.status === 'uncertain', c.id + ': unsupported photograph remains an honest failure')
    check(attempt.geometry.strokes.every(s => s.vertices.every(v => v.graph === null)), c.id + ': unknown photo scale never borrows question ranges')
    check(await panel().locator('.star-auto-ack').isDisabled() && await panel().locator('.star-auto-confirm').isDisabled(), c.id + ': invalid candidate cannot be acknowledged or imported')
    await panel().locator('.star-auto-confirm').dispatchEvent('click')
    check(JSON.stringify(await state()) === JSON.stringify(prior), c.id + ': blocked import preserves all existing native objects')
    check(await panel().locator('.star-auto-proposal').isVisible(), c.id + ': incomplete pixel-space result remains visible beside photo')
    check((await panel().locator('.star-auto-preview-caption').textContent()).includes('No mathematical scale'), c.id + ': pixel preview is not presented as a native calibrated graph')
    const status = await panel().locator('.star-auto-status').textContent()
    await panel().screenshot({ path: options.output + '/' + c.id + '--automatic-review.png' })
    const saveCanvas = async () => panel().locator('.star-auto-photo').evaluate(c => c.toDataURL())
    const overlay = await saveCanvas()
    await panel().locator('.star-auto-overlay').uncheck(); const source = await saveCanvas(); await panel().locator('.star-auto-overlay').check()
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), c.id + ': no horizontal page overflow')
    check(await panel().evaluate(el => el.scrollWidth <= el.clientWidth + 1), c.id + ': no horizontal dialog overflow')
    check(await panel().locator('.star-auto-confirm').evaluate(el => { const b = el.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight }), c.id + ': confirmation remains fully visible in the footer')
    if (c.mobile) {
      await panel().locator('.star-auto-body').evaluate(el => { el.scrollTop = el.scrollHeight })
      await panel().screenshot({ path: options.output + '/' + c.id + '--mobile-diagnostics.png' })
    }
    if (c.rejectFirst) {
      await panel().locator('.star-auto-reject').click()
      check(await panel().locator('.star-auto-confirm').isDisabled(), c.id + ': rejection invalidates the automatic proposal')
    }
    await panel().locator('.star-auto-correct').click()
    const assisted = page.locator('#automatic-photo-star-panel')
    await assisted.locator('.star-status').filter({ hasText: 'Place the axes, then trace your curve.' }).waitFor()
    check(await assisted.locator('.star-photo-name').textContent() === c.name, c.id + ': fallback keeps the selected filename')
    check(await page.evaluate(() => window.__files.length === 2 && window.__files[0] === window.__files[1]), c.id + ': fallback decodes the exact same local File without another upload')
    check(await assisted.locator('input[type=file]').evaluate(el => el.files.length === 0), c.id + ': no second file-picker selection was needed')
    check((await assisted.locator('.star-assisted-method').textContent()).includes('manually assisted'), c.id + ': fallback is labelled manually assisted')
    check(JSON.stringify(await state()) === JSON.stringify(prior), c.id + ': fallback handoff also preserves native objects')
    await assisted.screenshot({ path: options.output + '/' + c.id + '--manual-handoff.png' })
    outcomes.push({ id: c.id, viewport: c.mobile ? [390, 844] : [1440, 1100], ...attempt, status, native_imported: false, source, overlay })
  }
  check(errors.length === 0, 'No application page errors')
  return { passed: checks.length, checks, page_errors: errors, blocked_external_origins: [...new Set(external)], outcomes, inference_requests: 0, note: 'CV only; no manually corrected attempt counts as an automatic success.' }
}

async function recovery (page, options) {
  // Called separately, after automatic observations have been written to disk.
  const checks = []; const posts = []; const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label) }
  const panel = page.locator('#automatic-photo-star-panel'); const canvas = panel.locator('.star-canvas')
  const collect = () => page.evaluate(() => { const si = window.SketchInput.instances['automatic-photo']; return { state: JSON.parse(si.getState()), gradeable: JSON.parse(si.getGradeable()) } })
  const prior = (await collect()).state.data['auto-notes']
  const c = options.actions; const size = c.image_size
  const draw = async points => {
    await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox(); const scale = Math.min(1, 900 / Math.max(...size)); const processing = size.map(v => Math.round(v * scale))
    const screen = p => p.map((v, i) => (v + 0.5 - size[i] / processing[i] / 2) / size[i] * (i ? box.height : box.width) + (i ? box.y : box.x))
    await page.mouse.move(...screen(points[0])); await page.mouse.down()
    for (let i = 1; i < points.length; i++) await page.mouse.move(...screen(points[i]), { steps: Math.max(2, Math.ceil(Math.hypot(...points[i].map((v, k) => v - points[i - 1][k])) / 4)) })
    await page.mouse.up()
  }
  await page.evaluate(() => {
    const trace = window.StarAssisted.fromTrace
    window.StarAssisted.fromTrace = args => { const g = trace(args); window.__manualGeometry = g; return g }
    window.StarProviders.recognize = () => { throw new Error('Automatic recognition must not rerun during manual recovery') }
  })
  for (const [name, start] of [['x_marker', [size[0] * 0.75, size[1] * 0.55]], ['y_marker', [size[0] * 0.5, size[1] * 0.3]], ['origin', [size[0] * 0.5, size[1] * 0.55]]]) await draw([start, c.calibration[name]])
  await panel.locator('.star-xval').fill(String(c.calibration.x_value)); await panel.locator('.star-yval').fill(String(c.calibration.y_value)); await panel.locator('.star-next').click()
  for (const s of c.pointer_strokes) await draw(s)
  await panel.locator('.star-use').click()
  check(await panel.locator('.star-confirm').isDisabled(), 'Manual recovery still requires explicit review acknowledgment')
  const geometry = await page.evaluate(() => window.__manualGeometry)
  check(geometry.strokes.length === 1 && !geometry.provenance.automatically_recognized, 'Recovered original geometry is explicitly manually traced')
  check(geometry.strokes[0].vertices.filter(v => v.corner).length >= 2, 'Manual recovery preserves both sharp peaks')
  await panel.locator('.star-manual-ack').check(); await panel.screenshot({ path: options.output + '/IMG_1670--manual-review.png' }); await panel.locator('.star-confirm').click()
  const container = page.locator('#automatic-photo-si-container'); const svg = page.locator('#automatic-photo-si-canvas')
  await page.waitForFunction(() => document.querySelectorAll('#automatic-photo-si-canvas path.plugin-id-auto-ink').length === 1)
  const point = await page.evaluate(({ geometry, pixel }) => { const config = JSON.parse(window.SketchInput.instances['automatic-photo'].getState()).meta.config; const g = window.StarGeometry.pixelToGraph(pixel, geometry.coordinate_frame, geometry.calibration); return window.StarNative.graphToNative(config, g) }, { geometry, pixel: c.source_points[0].pixel })
  await container.getByText('Other marks', { exact: true }).click(); await svg.scrollIntoViewIfNeeded(); const box = await svg.boundingBox(); const config = (await collect()).state.meta.config
  await page.mouse.click(box.x + point.x * box.width / config.width, box.y + point.y * box.height / config.height)
  const imported = await collect()
  check(JSON.stringify(imported.state.data['auto-notes'].slice(0, 1)) === JSON.stringify(prior) && imported.state.data['auto-notes'].length === 2, 'Manual native dot and pre-existing point remain separate objects')
  check(await page.evaluate(() => window.__fitCalls === 0), 'Recovery uses zero equation fitting calls')
  await container.screenshot({ path: options.output + '/IMG_1670--manual-native.png' })
  page.on('request', r => { if (r.method() === 'POST') { const value = new URLSearchParams(r.postData() || '').get('automatic-photo-sketchresponse-submission'); if (value) posts.push(JSON.parse(Buffer.from(value, 'base64').toString())) } })
  await page.getByRole('button', { name: 'Save & Grade', exact: true }).click(); await page.waitForLoadState('networkidle')
  await page.waitForFunction(() => window.SketchInput?.instances['automatic-photo'])
  check(posts.length === 1, 'Actual native Save & Grade submitted the manually recovered attempt')
  check(await page.getByText('Invalid', { exact: true }).count() === 0 && await page.getByText('0%', { exact: true }).count() > 0, 'Existing x-squared grader accepts and marks the wrong drawn graph incorrect')
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => window.SketchInput?.instances['automatic-photo'])
  const restored = await collect()
  check(JSON.stringify(restored.state.data) === JSON.stringify(posts[0].data), 'Exact manual curve, dot and prior object survive refresh')
  await container.screenshot({ path: options.output + '/IMG_1670--manual-restored.png' })
  return { passed: checks.length, checks, classification: 'manually assisted, not automatic recognition', geometry, imported, submitted: posts[0], restored, url: page.url() }
}

const root = path.resolve(__dirname, '../../../..')
const output = path.resolve(process.env.PL_PHOTO_TEST_OUTPUT || path.join(__dirname, 'results'))
fs.mkdirSync(output, { recursive: true })
const options = { url: 'http://localhost:3000/pl/course/1/question/254/preview', output, cases: [
  { id: 'real--01', name: 'real--01-multiple-lines-graph-paper.png', file: path.join(root, 'benchmarks/photo-graphs/automatic-cv/experiment-01/inputs/real--01-multiple-lines-graph-paper.png'), rejectFirst: true },
  { id: 'real--06', name: 'real--06-piecewise-graph-paper.png', file: path.join(root, 'benchmarks/photo-graphs/automatic-cv/experiment-01/inputs/real--06-piecewise-graph-paper.png'), mobile: true },
  { id: 'IMG_1670', name: 'IMG_1670.jpg', file: '/Users/alaiasun/Library/Mobile Documents/com~apple~CloudDocs/D. UC Berkeley/Courses/CS294 STAR FA2026/Experiment/examples/IMG_1670.jpg' }
] }
function run (args) {
  const env = { ...process.env }; delete env.GEMINI_API_KEY; delete env.GOOGLE_API_KEY
  const r = spawnSync(process.env.PL_PHOTO_TEST_CLI || 'playwright-cli', ['-s=star-step4g-1', ...args], { cwd: '/private/tmp', env, encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024 })
  const text = (r.stdout || '') + (r.stderr || '')
  if (r.error || r.status !== 0 || text.includes('### Error')) throw r.error || new Error(text.slice(0, 3000))
  if (args[0] === 'run-code') return JSON.parse(text.split('### Result\n')[1]?.split('\n###')[0])
}
const save = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n')
try {
  run(['open', options.url, '--browser', 'chrome']); run(['snapshot'])
  const result = run(['run-code', 'async page => (' + automatic.toString() + ')(page,' + JSON.stringify(options) + ')'])
  for (const o of result.outcomes) {
    for (const key of ['source', 'overlay']) { fs.writeFileSync(path.join(output, o.id + '--' + key + '.png'), Buffer.from(o[key].split(',')[1], 'base64')); delete o[key] }
    for (const [key, value] of Object.entries(o.masks)) fs.writeFileSync(path.join(output, o.id + '--' + key + '.png'), Buffer.from(value.split(',')[1], 'base64'))
    delete o.masks; save(o.id + '--prediction.json', o.geometry)
  }
  save('automatic.json', result); console.log('Automatic review assertions:', result.passed)
  const manualOptions = { output, actions: require('../step-4f/operator-actions.json') }
  const manual = run(['run-code', 'async page => (' + recovery.toString() + ')(page,' + JSON.stringify(manualOptions) + ')'])
  save('recovery.json', manual); console.log('Separate manual recovery assertions:', manual.passed)
} catch (e) { console.error(e.message); process.exitCode = 1 } finally { run(['close']) }
