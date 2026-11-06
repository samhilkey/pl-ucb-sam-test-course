// Final acceptance: real mouse/keyboard actions; frozen assisted implementation.
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
async function acceptance (page, options) {
  const checks = []; const errors = []; const external = []; const posts = []; const outcomes = []
  const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label) }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  page.on('pageerror', e => errors.push(String(e)))
  page.on('request', r => { if (r.method() === 'POST') { const value = new URLSearchParams(r.postData() || '').get('paper-lines-sketchresponse-submission'); if (value) posts.push(JSON.parse(Buffer.from(value, 'base64').toString('utf8'))) } })
  await page.route('**/*', route => {
    const u = new URL(route.request().url())
    if (['localhost', '127.0.0.1'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol)) return route.continue()
    external.push(u.origin); return route.abort()
  })
  const ready = () => page.waitForFunction(() => window.SketchInput?.instances['paper-lines'] && document.getElementById('paper-lines-star-photo-btn'))
  const collect = () => page.evaluate(() => {
    const si = window.SketchInput.instances['paper-lines']
    return { state: JSON.parse(si.getState()), gradeable: JSON.parse(si.getGradeable()), paths: [...document.querySelectorAll('#paper-lines-si-canvas path.plugin-id-paper-ink')].map(p => {
      const length = p.getTotalLength(); const n = Math.max(1, Math.ceil(length / 0.5))
      return { d: p.getAttribute('d'), samples: Array.from({ length: n + 1 }, (_, i) => { const q = p.getPointAtLength(length * i / n); return [q.x, q.y] }) }
    }) }
  })
  const draw = async (canvas, size, points) => {
    await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox()
    const scale = Math.min(1, 900 / Math.max(...size)); const processing = size.map(v => Math.round(v * scale))
    // Match the frozen pixel-center transform even for the new >900px photo.
    const screen = p => p.map((v, i) => (v + 0.5 - size[i] / processing[i] / 2) / size[i] * (i ? box.height : box.width) + (i ? box.y : box.x))
    await page.mouse.move(...screen(points[0])); await page.mouse.down()
    for (let i = 1; i < points.length; i++) {
      const len = Math.hypot(...points[i].map((v, k) => v - points[i - 1][k]))
      const p = i === points.length - 1 && len > 1 ? points[i].map((v, k) => v - 0.25 * (v - points[i - 1][k]) / len) : points[i]
      await page.mouse.move(...screen(p), { steps: Math.max(2, Math.ceil(len / 4)) })
    }
    await page.mouse.move(...screen(points.at(-1))); await page.mouse.up()
  }
  for (const trial of options.trials) {
    const c = trial.input; const prefix = c.id + '--' + trial.label
    await page.setViewportSize({ width: trial.viewport[0], height: trial.viewport[1] })
    await page.goto(options.url + '/', { waitUntil: 'networkidle' }); await ready()
    check((await page.title()).includes('star-assisted-photo-demo'), prefix + ': correct local question, meaningful native canvas')
    await page.evaluate(() => {
      window.__geometry = null; window.__forbidden = 0
      const fromTrace = window.StarAssisted.fromTrace
      window.StarAssisted.fromTrace = args => { const result = fromTrace(args); window.__geometry = JSON.parse(JSON.stringify(result)); return result }
      const forbidden = () => { window.__forbidden++; throw new Error('Automatic recognition/fitting forbidden in Step4F') }
      window.StarFit.fit = window.StarFit.sampleCurve = forbidden; window.StarRecognition.recognize = forbidden
    })
    const container = page.locator('#paper-lines-si-container'); const svg = page.locator('#paper-lines-si-canvas')
    const nativePoint = async p => {
      await container.getByText('Other marks', { exact: true }).click(); await svg.scrollIntoViewIfNeeded(); const box = await svg.boundingBox()
      const state = (await collect()).state; const cfg = state.meta.config
      await page.mouse.click(box.x + p[0] * box.width / cfg.width, box.y + p[1] * box.height / cfg.height)
    }
    await nativePoint([640, 90]); const existing = (await collect()).state.data['paper-notes']
    check(existing.length === 1, prefix + ': real unrelated native point exists before photo import')
    await page.locator('#paper-lines-star-photo-btn').click()
    const panel = page.locator('#paper-lines-star-panel'); const canvas = panel.locator('.star-canvas')
    await panel.locator('input[type=file]').setInputFiles(c.file)
    await panel.locator('.star-status').filter({ hasText: 'Place the axes, then trace your curve.' }).waitFor()
    const [w, h] = c.image_size
    for (const [name, start] of [['x_marker', [w * 0.75, h * 0.55]], ['y_marker', [w * 0.5, h * 0.3]], ['origin', [w * 0.5, h * 0.55]]]) await draw(canvas, c.image_size, [start, c.calibration[name]])
    await panel.locator('.star-xval').fill(String(c.calibration.x_value)); await panel.locator('.star-yval').fill(String(c.calibration.y_value))
    await panel.locator('.star-next').click()
    for (const stroke of c.pointer_strokes) await draw(canvas, c.image_size, stroke)
    await panel.screenshot({ path: options.output + '/' + prefix + '--trace.png' })
    await panel.locator('.star-use').click()
    const geometry = await page.evaluate(() => window.__geometry)
    check(geometry && geometry.strokes.length === c.pointer_strokes.length && !geometry.provenance.automatically_recognized, prefix + ': all curve branches explicitly remain manually traced')
    check(await panel.locator('.star-confirm').isDisabled(), prefix + ': acknowledgment required before importing')
    check((await collect()).state.data['paper-ink'].length === 0, prefix + ': review cannot mutate native curve')
    if (c.id === 'new-paper-01') {
      check(geometry.strokes[0].vertices.filter(v => v.corner).length >= 2, prefix + ': both sharp peaks remain corners')
      check(geometry.strokes[0].vertices.some(v => v.graph[0] < -0.4 && v.graph[0] > -1.3 && v.graph[1] > 0.4 && v.graph[1] < 1), prefix + ': the off-origin central minimum is retained instead of idealized')
    }
    await panel.locator('.star-manual-ack').check(); await panel.screenshot({ path: options.output + '/' + prefix + '--review.png' })
    await panel.locator('.star-confirm').click()
    await page.waitForFunction(n => document.querySelectorAll('#paper-lines-si-canvas path.plugin-id-paper-ink').length === n, c.pointer_strokes.length)
    let imported = await collect()
    check(same(imported.state.data['paper-notes'], existing), prefix + ': imported geometry preserves existing objects')
    const sourcePointPlacements = []
    for (const point of c.source_points || []) {
      const target = await page.evaluate(({ point, geometry }) => {
        const cfg = JSON.parse(window.SketchInput.instances['paper-lines'].getState()).meta.config
        const graph = window.StarGeometry.pixelToGraph(point, geometry.coordinate_frame, geometry.calibration)
        const p = window.StarNative.graphToNative(cfg, graph); return [p.x, p.y]
      }, { point: point.pixel, geometry })
      await nativePoint(target)
      sourcePointPlacements.push({ original_pixel: point.pixel, method: 'separate manual native Other marks placement; not stroke import or automatic recognition', actual: (await collect()).state.data['paper-notes'].at(-1) })
    }
    imported = await collect()
    check(await page.evaluate(() => window.__forbidden) === 0, prefix + ': no automatic recognition or fitting before submission reload clears instrumentation')
    check(imported.state.data['paper-ink'].length === c.pointer_strokes.length, prefix + ': independent native curve objects retained')
    check(same(imported.gradeable.data['paper-ink'].map(s => s.spline), imported.state.data['paper-ink'].map(s => s.map(p => [p.x, p.y]))), prefix + ': rendering and grading share exact freeform controls')
    check(same(imported.state.data['paper-notes'].slice(0, 1), existing) && imported.state.data['paper-notes'].length === 1 + (c.source_points || []).length, prefix + ': source dot and unrelated point are distinct, retained objects')
    await container.screenshot({ path: options.output + '/' + prefix + '--native.png' })
    const save = async stage => {
      const before = posts.length
      await page.getByRole('button', { name: 'Save & Grade', exact: true }).click(); await page.waitForLoadState('networkidle'); await ready()
      check(posts.length === before + 1, prefix + ': actual Save & Grade POST for ' + stage)
      check(await page.getByText('Invalid', { exact: true }).count() === 0, prefix + ': ' + stage + ' is a savable attempt')
      const score = await container.evaluate(el => el.parentElement.previousElementSibling?.textContent.trim())
      check(score === '0%', prefix + ': wrong graph correctly receives 0% without repair at ' + stage)
      const submitted = posts.at(-1)
      await page.reload({ waitUntil: 'networkidle' }); await ready()
      const restored = await collect()
      check(same(restored.state.data, submitted.data), prefix + ': exact submitted curve/points restored at ' + stage)
      return { submitted, restored, url: page.url() }
    }
    const original = await save('original')
    check(same(original.submitted.data, imported.state.data), prefix + ': original import submitted without idealization')
    await container.screenshot({ path: options.output + '/' + prefix + '--graded-restored.png' })
    const move = async (dx, dy) => {
      await container.getByText('Select', { exact: true }).click(); await svg.scrollIntoViewIfNeeded(); const box = await svg.boundingBox()
      const current = await collect(); const p = current.paths[0].samples[Math.floor(current.paths[0].samples.length / 3)]; const cfg = current.state.meta.config
      const xy = [box.x + p[0] * box.width / cfg.width, box.y + p[1] * box.height / cfg.height]
      await page.mouse.move(...xy); await page.mouse.down(); await page.mouse.move(xy[0] + dx * box.width / cfg.width, xy[1] + dy * box.height / cfg.height, { steps: 8 }); await page.mouse.up()
      return collect()
    }
    const edited = await move(24, 12)
    check(!same(edited.state.data['paper-ink'][0], imported.state.data['paper-ink'][0]), prefix + ': actual native Select edit moves the first curve')
    if (c.pointer_strokes.length > 1) check(same(edited.state.data['paper-ink'][1], imported.state.data['paper-ink'][1]), prefix + ': second disconnected branch stays unchanged')
    check(same(edited.state.data['paper-notes'], imported.state.data['paper-notes']), prefix + ': native curve edit preserves source dot and unrelated objects')
    const editedSaved = await save('edited'); await container.screenshot({ path: options.output + '/' + prefix + '--edited-restored.png' })
    const returned = await move(-24, -12)
    const originalPoints = imported.state.data['paper-ink']; const returnedPoints = returned.state.data['paper-ink']
    check(originalPoints.every((s, i) => s.every((p, j) => Math.hypot(p.x - returnedPoints[i][j].x, p.y - returnedPoints[i][j].y) < 1e-6)), prefix + ': original position recovered through native editing for the prepared live variant')
    const finalSaved = await save('returned-original'); await container.screenshot({ path: options.output + '/' + prefix + '--final-restored.png' })
    outcomes.push({ id: c.id, trial: trial.label, viewport: trial.viewport, method: 'fully manually traced; any source point separately placed manually', geometry, sourcePointPlacements, imported, original, edited, editedSaved, returned, finalSaved })
  }
  check(errors.length === 0 && external.length === 0, 'No application page exceptions or external requests during final acceptance')
  const environment = await page.evaluate(() => ({ user_agent: navigator.userAgent, device_pixel_ratio: devicePixelRatio, screen: [screen.width, screen.height] }))
  return { passed: checks.length, checks, consoleErrors: errors, external, outcomes, environment, geometry_inference: 'manual only; evaluator references and comparison image never loaded' }
}
if (require.main === module) {
  const root = __dirname; const c = JSON.parse(fs.readFileSync(path.join(root, 'operator-actions.json')))
  c.file = path.join(root, 'inputs/new-paper-01.png')
  const oldRoot = path.resolve(root, '../step-4c'); const old = JSON.parse(fs.readFileSync(path.join(oldRoot, 'operator-actions.json'))).cases.find(c => c.id.startsWith('real--01')); old.file = path.resolve(oldRoot, old.image)
  const options = { url: 'http://localhost:3000/pl/course/1/question/255/preview', output: '/private/tmp/star-step4f/acceptance', trials: [{ label: 'desktop', viewport: [1920, 1080], input: c }, { label: 'branches', viewport: [1920, 1080], input: old }, { label: 'presentation', viewport: [1280, 720], input: c }] }
  fs.mkdirSync(options.output, { recursive: true })
  const env = { ...process.env }; delete env.GEMINI_API_KEY; delete env.GOOGLE_API_KEY
  const cli = '/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh'
  const run = args => {
    const r = spawnSync(cli, ['-s=star-final-step4f', ...args], { cwd: '/private/tmp', env, encoding: 'utf8', timeout: 300000, maxBuffer: 32 * 1024 * 1024 })
    const output = (r.stdout || '') + (r.stderr || ''); fs.appendFileSync(options.output + '/browser-cli.log', '$ playwright-cli ' + args[0] + '\n' + output + '\n')
    if (r.error || r.status !== 0 || output.includes('### Error')) throw new Error(output.slice(-4000))
    if (args[0] === 'run-code') { const record = JSON.parse(output.split('### Result\n')[1].split('\n###')[0]); fs.writeFileSync(options.output + '/acceptance.json', JSON.stringify(record, null, 2) + '\n'); console.log('Final acceptance assertions passed: ' + record.passed) }
  }
  try { run(['open', options.url, '--browser', 'chrome']); run(['snapshot']); run(['run-code', 'async page => (' + acceptance.toString() + ')(page, ' + JSON.stringify(options) + ')']) } catch (e) { console.error(e.message); process.exitCode = 1 } finally { try { run(['close']) } catch (_) {} }
}
module.exports = { acceptance }
