// Reproducible manual mouse/keyboard replay on actual approved paper photographs.
// Operator actions are separate from evaluator-only references; no native import injection.
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
async function acceptance (page, options) {
  const checks = []; const errors = []; const outcomes = []; const blockedHosts = []; const posts = []
  const check = (ok, message) => { if (!ok) throw new Error(message); checks.push(message) }
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()) })
  page.on('request', request => { if (request.method() === 'POST' && request.postData()) posts.push(request.postData()) })
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (['localhost', '127.0.0.1'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol)) return route.continue()
    blockedHosts.push(url.hostname); return route.abort()
  })
  await page.setViewportSize({ width: 1440, height: 1100 })
  const ready = () => page.waitForFunction(() => window.SketchInput?.instances['paper-v'] && document.getElementById('paper-v-star-photo-btn'))
  const state = id => page.evaluate(id => JSON.parse(window.SketchInput.instances[id].getState()), id)
  const collect = id => page.evaluate(id => {
    const si = window.SketchInput.instances[id]
    return { state: JSON.parse(si.getState()), gradeable: JSON.parse(si.getGradeable()), paths: [...document.querySelectorAll('#' + id + '-si-canvas path.plugin-id-paper-ink')].map(p => {
      const n = Math.max(1, Math.ceil(p.getTotalLength() / 0.5))
      return { d: p.getAttribute('d'), samples: Array.from({ length: n + 1 }, (_, i) => { const q = p.getPointAtLength(p.getTotalLength() * i / n); return [q.x, q.y] }) }
    }) }
  }, id)
  const fresh = async (legacy = false) => {
    await page.goto(options.url + '/', { waitUntil: 'networkidle' }); await ready()
    check((await page.title()).includes('star-assisted-photo-demo'), 'Correct assisted-demo question loaded')
    await page.evaluate(({ legacy }) => {
      window.__fitCalls = 0; window.__manualGeometry = null; window.__manualArgs = null; window.__legacyFits = []
      if (!legacy) {
        const fromTrace = window.StarAssisted.fromTrace
        window.StarAssisted.fromTrace = function (args) { const g = fromTrace(args); window.__manualGeometry = JSON.parse(JSON.stringify(g)); window.__manualArgs = JSON.parse(JSON.stringify(args)); return g }
        window.StarFit.fit = window.StarFit.sampleCurve = () => { window.__fitCalls++; throw new Error('Equation fitting is forbidden in manual geometry mode') }
      }
    }, { legacy })
  }
  const draw = async (canvas, imageSize, points) => {
    await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox()
    const xy = p => [box.x + p[0] * box.width / imageSize[0], box.y + p[1] * box.height / imageSize[1]]
    await page.mouse.move(...xy(points[0])); await page.mouse.down()
    for (let i = 1; i < points.length; i++) {
      const length = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
      // End with a sub-2px move: the pointer-up position must survive the
      // movement sampler's threshold, including on the actual paper cases.
      const target = i === points.length - 1 && length > 1 ? points[i].map((v, j) => v - 0.5 * (v - points[i - 1][j]) / length) : points[i]
      await page.mouse.move(...xy(target), { steps: Math.max(2, Math.ceil(length / 4)) })
    }
    await page.mouse.move(...xy(points.at(-1)))
    await page.mouse.up()
  }
  const tracePhoto = async c => {
    const id = c.canvas
    await page.locator('#' + id + '-star-photo-btn').click()
    const panel = page.locator('#' + id + '-star-panel')
    await panel.locator('input[type=file]').setInputFiles(c.file)
    await panel.locator('.star-status').filter({ hasText: 'Place the axes, then trace your curve.' }).waitFor()
    const canvas = panel.locator('.star-canvas')
    const [w, h] = c.image_size
    const positions = { origin: [w * 0.5, h * 0.55], x_marker: [w * 0.75, h * 0.55], y_marker: [w * 0.5, h * 0.3] }
    // Move reference handles first; O is moved last so it cannot obscure X/Y.
    for (const key of ['x_marker', 'y_marker', 'origin']) await draw(canvas, c.image_size, [positions[key], c.calibration[key]])
    await panel.locator('.star-xval').fill(String(c.calibration.x_value))
    await panel.locator('.star-yval').fill(String(c.calibration.y_value))
    await panel.locator('.star-next').click()
    for (const stroke of c.pointer_strokes) await draw(canvas, c.image_size, stroke)
    await panel.screenshot({ path: options.output + '/' + c.id + '--trace.png' })
    await panel.locator('.star-use').click()
    return { panel, canvas }
  }
  const save = async id => {
    const before = posts.length
    await page.getByRole('button', { name: 'Save & Grade', exact: true }).click(); await page.waitForLoadState('networkidle'); await ready()
    const raw = posts.slice(before).find(p => new URLSearchParams(p).has(id + '-sketchresponse-submission'))
    check(!!raw, id + ': real Save & Grade POST includes native submission')
    const payload = JSON.parse(Buffer.from(new URLSearchParams(raw).get(id + '-sketchresponse-submission'), 'base64').toString('utf8'))
    check(await page.getByText('Invalid', { exact: true }).count() === 0, id + ': server accepts the preserved attempt')
    const score = await page.locator('#' + id + '-si-container').evaluate(el => el.parentElement.previousElementSibling?.textContent.trim())
    check(score === '0%', id + ': intentionally wrong paper graph is graded incorrect, not idealized')
    return payload
  }
  for (const c of options.cases) {
    await fresh()
    if (options.seedExistingObjects) {
      const container = page.locator('#' + c.canvas + '-si-container')
      await container.getByText('Other marks', { exact: true }).click()
      const svg = page.locator('#' + c.canvas + '-si-canvas'); await svg.scrollIntoViewIfNeeded(); const box = await svg.boundingBox()
      await page.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.15)
      check((await state(c.canvas)).data['paper-notes'].length === 1, c.canvas + ': actual existing native point drawn before photo upload')
    }
    const id = c.canvas; const before = await state(id)
    const { panel } = await tracePhoto(c)
    check(await panel.locator('.star-confirm').isDisabled(), id + ': import is blocked before manual review acknowledgment')
    const geometry = await page.evaluate(() => window.__manualGeometry)
    check(!!geometry && geometry.strokes.length === c.pointer_strokes.length, id + ': every manually traced branch is retained')
    check(geometry.strokes.every((s, i) => [0, s.vertices.length - 1].every(j => {
      const target = j === 0 ? c.pointer_strokes[i][0] : c.pointer_strokes[i].at(-1)
      return Math.hypot(...target.map((v, k) => v - s.vertices[j].pixel[k])) < 0.01
    })), id + ': exact visible gesture endpoints survive a final sub-2px pointer movement')
    check(geometry.status === 'needs_review' && geometry.provenance.method === 'manual_trace' && !geometry.provenance.automatically_recognized, id + ': method remains explicitly manual, not automatic')
    check(geometry.calibration.axes.x.source === 'student_corrected', id + ': calibration is explicitly operator supplied')
    check(await page.evaluate(() => window.__fitCalls) === 0, id + ': no equation fitting or model sampling')
    check(JSON.stringify((await state(id)).data) === JSON.stringify(before.data), id + ': review does not mutate native graph')
    await panel.locator('.star-manual-ack').check()
    await panel.screenshot({ path: options.output + '/' + c.id + '--review.png' })
    await panel.locator('.star-confirm').click()
    check(await panel.isHidden(), id + ': explicit confirmation closes the dialog')
    await page.waitForFunction(({ id, count }) => document.querySelectorAll('#' + id + '-si-canvas path.plugin-id-paper-ink').length === count, { id, count: c.pointer_strokes.length })
    const imported = await collect(id)
    check(imported.state.data['paper-ink'].length === c.pointer_strokes.length, id + ': native branches are separate objects')
    check(JSON.stringify(imported.state.data['paper-notes']) === JSON.stringify(before.data['paper-notes']), id + ': unrelated tools retained')
    check(JSON.stringify(imported.gradeable.data['paper-ink'].map(s => s.spline)) === JSON.stringify(imported.state.data['paper-ink'].map(s => s.map(p => [p.x, p.y]))), id + ': rendering and grading share exact freeform controls')
    await page.locator('#' + id + '-si-container').screenshot({ path: options.output + '/' + c.id + '--native.png' })
    const submitted = await save(id)
    const originalSubmissionUrl = page.url()
    check(JSON.stringify(submitted.data['paper-ink']) === JSON.stringify(imported.state.data['paper-ink']), id + ': Save & Grade retains exact original geometry')
    await page.screenshot({ path: options.output + '/' + c.id + '--graded.png', fullPage: true })
    await page.reload({ waitUntil: 'networkidle' }); await ready()
    const restored = await collect(id)
    check(JSON.stringify(restored.state.data['paper-ink']) === JSON.stringify(submitted.data['paper-ink']), id + ': refresh restores exact original branches')
    check(JSON.stringify(restored.state.data['paper-notes']) === JSON.stringify(before.data['paper-notes']), id + ': original submission and refresh preserve existing native objects')
    await page.locator('#' + id + '-si-container').screenshot({ path: options.output + '/' + c.id + '--restored.png' })
    const container = page.locator('#' + id + '-si-container')
    await container.getByText('Select', { exact: true }).click()
    const svg = page.locator('#' + id + '-si-canvas'); await svg.scrollIntoViewIfNeeded(); const box = await svg.boundingBox()
    const config = restored.state.meta.config; const middle = restored.paths[0].samples[Math.floor(restored.paths[0].samples.length / 3)]
    const screen = [box.x + middle[0] * box.width / config.width, box.y + middle[1] * box.height / config.height]
    await page.mouse.move(...screen); await page.mouse.down(); await page.mouse.move(screen[0] + 24, screen[1] + 12, { steps: 8 }); await page.mouse.up()
    const edited = await collect(id)
    check(JSON.stringify(edited.state.data['paper-ink'][0]) !== JSON.stringify(restored.state.data['paper-ink'][0]), id + ': native Select actually moves the imported branch')
    check(edited.state.data['paper-ink'].length === c.pointer_strokes.length, id + ': native edit preserves branch count')
    if (c.pointer_strokes.length > 1) check(JSON.stringify(edited.state.data['paper-ink'][1]) === JSON.stringify(restored.state.data['paper-ink'][1]), id + ': independent second branch is unchanged by first-branch edit')
    await container.screenshot({ path: options.output + '/' + c.id + '--edited.png' })
    const editedSubmission = await save(id)
    const editedSubmissionUrl = page.url()
    await page.reload({ waitUntil: 'networkidle' }); await ready()
    const editedRestored = await collect(id)
    check(JSON.stringify(editedRestored.state.data['paper-ink']) === JSON.stringify(editedSubmission.data['paper-ink']), id + ': refresh restores the actual edited submission')
    check(JSON.stringify(editedRestored.state.data['paper-notes']) === JSON.stringify(before.data['paper-notes']), id + ': native editing, second submission and refresh preserve existing native objects')
    await page.locator('#' + id + '-si-container').screenshot({ path: options.output + '/' + c.id + '--edited-restored.png' })
    outcomes.push({ id: c.id, canvas: id, classification: 'fully_manually_traced', originalSubmissionUrl, editedSubmissionUrl, geometry, imported, submitted, restored, edited, editedSubmission, editedRestored,
      interaction_counts: { upload: 1, axis_handle_drags: 3, axis_numeric_entries: 2, tracing_strokes: c.pointer_strokes.length, read_trace: 1, review_acknowledgments: 1, imports: 1, native_branch_drags: 1, save_and_grade: 2, explicit_refresh: 2 },
      calibration_evidence: c.calibration.evidence })
  }
  // Actual UI safety regressions on the same approved source image.
  await fresh()
  const safetyCase = options.cases[0]; const safetyId = safetyCase.canvas
  const safety = await tracePhoto(safetyCase)
  await safety.panel.locator('.star-manual-ack').check()
  await safety.panel.locator('.star-mode-axes').click()
  await safety.panel.locator('.star-yval').fill('0')
  check(await safety.panel.locator('.star-confirm').isDisabled() && !(await safety.panel.locator('.star-manual-ack').isChecked()), 'Axis-value edit invalidates geometry and acknowledgment')
  await safety.panel.locator('.star-confirm').dispatchEvent('click')
  check((await state(safetyId)).data['paper-ink'].length === 0, 'Invalid axis value cannot be forced into native state')
  await safety.panel.locator('.star-yval').fill(String(safetyCase.calibration.y_value))
  await safety.panel.locator('.star-next').click(); await safety.panel.locator('.star-use').click()
  await safety.panel.locator('.star-manual-ack').check()
  await safety.panel.locator('[id$="-star-close"]').click()
  const safetyContainer = page.locator('#' + safetyId + '-si-container')
  await safetyContainer.getByText('Other marks', { exact: true }).click()
  const safetyCanvas = page.locator('#' + safetyId + '-si-canvas'); await safetyCanvas.scrollIntoViewIfNeeded()
  const safetyBox = await safetyCanvas.boundingBox()
  await page.mouse.click(safetyBox.x + safetyBox.width * 0.8, safetyBox.y + safetyBox.height * 0.2)
  const changedCanvas = await state(safetyId)
  check(changedCanvas.data['paper-notes'].length === 1, 'Actual native point edit occurs while the photo proposal is closed')
  await page.locator('#' + safetyId + '-star-photo-btn').click()
  await safety.panel.locator('.star-confirm').click()
  check((await safety.panel.locator('.star-status').textContent()).includes('canvas changed'), 'Stale assisted proposal is rejected after a real native edit')
  check(JSON.stringify((await state(safetyId)).data) === JSON.stringify(changedCanvas.data), 'Stale rejection preserves the newer native edit exactly')
  check(await safety.panel.locator('.star-confirm').isDisabled(), 'Consumed stale proposal cannot be retried without re-review')
  check(await safety.panel.locator('.star-legend-preview').isHidden(), 'Rejected stale geometry is removed from the visible preview')
  await safety.panel.screenshot({ path: options.output + '/stale-assisted--blocked.png' })
  // A mobile viewport replays the real V through review and native import.
  await page.setViewportSize({ width: 390, height: 844 }); await fresh()
  const mobile = await tracePhoto(options.cases[0])
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile page has no horizontal overflow')
  check(await mobile.panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Mobile assisted dialog has no horizontal overflow')
  await mobile.panel.locator('.star-manual-ack').check()
  await mobile.panel.screenshot({ path: options.output + '/mobile-real--06--review.png' })
  await mobile.panel.locator('.star-confirm').click()
  check((await state(options.cases[0].canvas)).data['paper-ink'].length === 1, 'Mobile-sized real-paper manual import succeeds')
  await page.setViewportSize({ width: 1440, height: 1100 })
  let legacyFits = []
  if (!options.skipLegacyComparison) {
    // Same real photograph through the legacy fitted route: inspect distortion,
    // with identical visible operator actions; never import reference coordinates.
    await page.goto(options.url + '/', { waitUntil: 'networkidle' }); await ready()
    // Reopen a fresh page with a pre-load hook on the public camera factory,
    // selecting its unchanged legacy fitting mode for this comparison only.
    await page.addInitScript(() => {
      Object.defineProperty(window, 'StarPhoto', { configurable: true, set(api) {
        const create = api.create
        api.create = opts => create({ ...opts, preserveGeometry: false })
        Object.defineProperty(window, 'StarPhoto', { value: api, writable: true, configurable: true })
      } })
    })
    await page.goto(options.url + '/', { waitUntil: 'networkidle' }); await ready()
    await page.evaluate(() => {
      window.__legacyFits = []
      const fit = window.StarFit.fit
      window.StarFit.fit = function (points, spec) { const model = fit(points, spec); window.__legacyFits.push({ points, family: model.family, expression: model.expr, samples: window.StarFit.sampleCurve(model, 400) }); return model }
    })
    const legacyUI = await tracePhoto(options.cases[0])
    legacyFits = await page.evaluate(() => window.__legacyFits)
    check(legacyFits.length === 1, 'Real-photo legacy comparison runs the existing global fitting path')
    await legacyUI.panel.screenshot({ path: options.output + '/legacy-real--06--fitted-review.png' })
  }
  check(errors.length === 0, 'No application JavaScript errors during the assisted acceptance route')
  return { passed: checks.length, checks, consoleErrors: errors, blockedExternalHosts: blockedHosts, outcomes, legacyFits,
    viewport: [1440, 1100], method: 'Scripted manual photo tracing with operator-supplied calibration; no VLM or automatic recognition claim.' }
}

if (require.main === module) {
  const root = path.resolve(__dirname, '../benchmarks/photo-graphs/multi-method/step-4c')
  const input = JSON.parse(fs.readFileSync(path.join(root, 'operator-actions.json')))
  const options = { url: process.env.STAR_ASSISTED_TEST_URL || 'http://localhost:3000/pl/course/1/question/255/preview', output: process.env.PL_PHOTO_TEST_OUTPUT || '/private/tmp/star-step4c/acceptance', cases: input.cases.map(c => ({ ...c, file: path.resolve(root, c.image) })) }
  fs.mkdirSync(options.output, { recursive: true })
  const cli = process.env.PL_PHOTO_TEST_CLI || '/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh'
  function run (args) {
    const result = spawnSync(cli, ['-s=star-assisted-step4c', ...args], { cwd: '/private/tmp', encoding: 'utf8', timeout: 240000, maxBuffer: 32 * 1024 * 1024 })
    const output = (result.stdout || '') + (result.stderr || '')
    fs.appendFileSync(options.output + '/browser-cli.log', '$ playwright-cli ' + args[0] + '\n' + output + '\n')
    if (result.error || result.status !== 0 || output.includes('### Error')) throw new Error(output.slice(-7000))
    if (args[0] === 'run-code') {
      const raw = output.split('### Result\n')[1]?.split('\n###')[0]
      if (!raw) throw new Error('Browser result missing')
      const record = JSON.parse(raw); fs.writeFileSync(options.output + '/results.json', JSON.stringify(record, null, 2) + '\n')
      console.log('Assisted real-photo browser assertions passed: ' + record.passed)
    }
  }
  try {
    run(['open', options.url, '--browser', 'chrome']); run(['snapshot'])
    run(['run-code', 'async page => (' + acceptance.toString() + ')(page, ' + JSON.stringify(options) + ')'])
  } catch (error) { console.error(error.message); process.exitCode = 1 } finally { try { run(['close']) } catch (_) {} }
}
module.exports = acceptance
