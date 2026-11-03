// Actual PrairieLearn upload/review/import/Save & Grade/reload and native edit.
const { spawnSync } = require('node:child_process')
const { mkdirSync, writeFileSync } = require('node:fs')
const { resolve } = require('node:path')
async function checkNative (page, options) {
  const checks = []; const errors = []; const posts = []; const outcomes = []
  const check = (condition, message) => { if (!condition) throw new Error(message); checks.push(message) }
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('request', r => { if (r.method() === 'POST' && r.postData()) posts.push(r.postData()) })
  const getState = () => page.evaluate(() => JSON.parse(window.SketchInput.instances['automatic-photo'].getState()))
  const ready = () => page.waitForFunction(() => window.SketchInput?.instances['automatic-photo'] && document.getElementById('automatic-photo-automatic-button'))
  const fresh = async () => {
    await page.goto(options.url + '/', { waitUntil: 'networkidle' }); await ready()
    check((await page.title()).includes('star-automatic-photo-test'), 'Correct native sandbox loaded')
    await page.evaluate(() => {
      window.__nativeCV = null; window.__fitCalls = 0
      const recognize = window.StarRecognition.recognize
      window.StarRecognition.recognize = function (image, options) {
        const result = recognize(image, options); window.__nativeCV = JSON.parse(JSON.stringify(result.geometry)); return result
      }
      window.StarFit.fit = window.StarFit.sampleCurve = function () { window.__fitCalls++; throw new Error('Equation fitting must not be used') }
    })
  }
  const panel = () => page.locator('#automatic-photo-automatic-dialog')
  const open = () => page.locator('#automatic-photo-automatic-button').click()
  const upload = async id => {
    await panel().locator('input[type=file]').setInputFiles(options.fixtures + '/' + id + '.png')
    await page.waitForFunction(() => !document.querySelector('#automatic-photo-automatic-dialog .star-auto-retry').disabled)
  }
  const acknowledge = () => panel().locator('.star-auto-ack').check()
  const confirm = () => panel().locator('.star-auto-confirm')
  const collect = () => page.evaluate(() => {
    const si = window.SketchInput.instances['automatic-photo']; const gradeable = JSON.parse(si.getGradeable()); const state = JSON.parse(si.getState())
    const paths = [...document.querySelectorAll('#automatic-photo-si-canvas path.plugin-id-auto-ink')].map(p => {
      const length = p.getTotalLength(); const n = Math.max(1, Math.ceil(length / 0.5))
      return { d: p.getAttribute('d'), samples: Array.from({ length: n + 1 }, (_, i) => { const q = p.getPointAtLength(i * length / n); return [q.x, q.y] }) }
    })
    return { state, gradeable, paths }
  })
  function pointDistance (p, strokes) {
    let best = Infinity
    for (const s of strokes) for (let i = 1; i < s.length; i++) {
      const a = s[i - 1]; const b = s[i]; const dx = b[0] - a[0]; const dy = b[1] - a[1]; const l2 = dx * dx + dy * dy
      const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0
      best = Math.min(best, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy))
    }
    return best
  }
  const toPhoto = (p, g, config) => {
    const x = config.xrange[0] + p[0] * (config.xrange[1] - config.xrange[0]) / config.width - g.calibration.origin_graph[0]
    const y = config.yrange[1] - p[1] * (config.yrange[1] - config.yrange[0]) / config.height - g.calibration.origin_graph[1]
    const o = g.coordinate_frame.origin_pixel; const a = g.calibration.x_unit_vector_pixel; const b = g.calibration.y_unit_vector_pixel
    return [o[0] + x * a[0] + y * b[0], o[1] + x * a[1] + y * b[1]]
  }
  function fidelity (g, actual, first = 1) {
    const config = actual.state.meta.config; const expected = g.strokes.map(s => s.vertices.map(v => v.pixel))
    const paths = actual.paths.slice(first).map(p => p.samples.map(q => toPhoto(q, g, config)))
    const ds = paths.flatMap(p => p.map(v => pointDistance(v, expected)))
    const reverse = expected.flatMap(s => s.map(v => pointDistance(v, paths)))
    const controls = actual.gradeable.data['auto-ink'].slice(first).map(p => p.spline)
    const vertexErrors = g.strokes.flatMap((s, i) => s.vertices.map((v, j) => {
      const p = toPhoto(controls[i][j * 3], g, config); return Math.hypot(v.pixel[0] - p[0], v.pixel[1] - p[1])
    }))
    return { rendered_to_cv_max_pixel: Math.max(...ds), cv_vertices_to_rendered_max_pixel: Math.max(...reverse), gradeable_vertex_max_pixel: Math.max(...vertexErrors), paths_photo: paths }
  }
  const save = async () => {
    const before = posts.length
    await page.getByRole('button', { name: 'Save & Grade', exact: true }).click()
    await page.waitForLoadState('networkidle'); await ready()
    check(posts.length > before, 'Actual Save & Grade POST sent')
    const body = posts.slice(before).find(p => new URLSearchParams(p).has('automatic-photo-sketchresponse-submission'))
    check(!!body, 'POST contains native base64 submission')
    const payload = JSON.parse(Buffer.from(new URLSearchParams(body).get('automatic-photo-sketchresponse-submission'), 'base64').toString('utf8'))
    check(await page.getByText('Invalid', { exact: true }).count() === 0, 'Native server accepted submission format')
    check(await page.getByText('0%', { exact: true }).count() > 0, 'Existing x-squared grader marks the preserved non-solution sample incorrect')
    return payload
  }
  let vGeometry
  await page.setViewportSize({ width: 1440, height: 1100 })
  for (const [id, count] of [['line', 1], ['sharp-v', 1], ['smooth-curve', 1], ['two-branches', 2]]) {
    await fresh()
    await page.evaluate(() => {
      const si = window.SketchInput.instances['automatic-photo']; const c = JSON.parse(atob(document.getElementById('automatic-photo-sketchresponse-data').textContent))
      const prior = window.StarNative.encode([[6.85, -3.5], [7, -3.3]].map(p => window.StarNative.graphToNative(c, p)), 'freeform')
      si.setState(JSON.stringify({ data: { 'auto-ink': [prior], 'auto-notes': [{ x: 735, y: 540 }] } }))
    })
    const prior = await getState()
    await open(); await upload(id)
    const g = await page.evaluate(() => window.__nativeCV)
    check(g.status === 'automatic' && g.strokes.length === count, id + ': actual pixel recognition provides expected controlled geometry')
    if (id === 'sharp-v') vGeometry = g
    check(JSON.stringify((await getState()).data) === JSON.stringify(prior.data), id + ': review does not mutate native state')
    check(await confirm().isDisabled(), id + ': confirmation requires acknowledgment')
    await confirm().dispatchEvent('click')
    check(JSON.stringify((await getState()).data) === JSON.stringify(prior.data), id + ': disabled confirm cannot transfer')
    check(await panel().locator('.star-auto-preview path').count() === count, id + ': proposed native-coordinate preview has every branch')
    await panel().screenshot({ path: options.output + '/' + id + '--review.png' })
    const preview = await panel().locator('.star-auto-preview path').evaluateAll(ps => ps.map(p => p.getAttribute('d')))
    await acknowledge(); await confirm().click()
    check(await panel().isHidden(), id + ': confirmation closes modal')
    await page.waitForFunction(n => document.querySelectorAll('#automatic-photo-si-canvas path.plugin-id-auto-ink').length === n, count + 1)
    const imported = await collect()
    check(imported.state.data['auto-ink'].length === count + 1, id + ': all branches appended')
    check(JSON.stringify(imported.state.data['auto-ink'][0]) === JSON.stringify(prior.data['auto-ink'][0]), id + ': prior receiving-tool drawing retained')
    check(JSON.stringify(imported.state.data['auto-notes']) === JSON.stringify(prior.data['auto-notes']), id + ': unrelated tool retained')
    check(JSON.stringify(imported.paths.slice(1).map(p => p.d)) === JSON.stringify(preview), id + ': actual native SVG exactly matches reviewed control path')
    check(await page.evaluate(() => window.__fitCalls) === 0, id + ': no StarFit or sampleCurve use')
    const importFidelity = fidelity(g, imported)
    check(importFidelity.rendered_to_cv_max_pixel < 0.02 && importFidelity.cv_vertices_to_rendered_max_pixel < 0.3, id + ': actual SVG preserves CV polyline')
    check(importFidelity.gradeable_vertex_max_pixel < 1e-8, id + ': gradeable controls preserve all vertices and corners')
    await page.locator('#automatic-photo-si-container').screenshot({ path: options.output + '/' + id + '--native.png' })
    const submitted = await save()
    check(JSON.stringify(submitted.data['auto-ink']) === JSON.stringify(imported.state.data['auto-ink']), id + ': submission stores exact native controls')
    check(submitted.gradeable['auto-ink'].length === count + 1, id + ': submission retains separate branch objects')
    await page.reload({ waitUntil: 'networkidle' }); await ready()
    await page.waitForFunction(n => document.querySelectorAll('#automatic-photo-si-canvas path.plugin-id-auto-ink').length === n, count + 1)
    const restored = await collect(); const restoreFidelity = fidelity(g, restored)
    check(JSON.stringify(restored.state.data['auto-ink']) === JSON.stringify(imported.state.data['auto-ink']), id + ': refresh restores exact native controls')
    check(JSON.stringify(restored.state.data['auto-notes']) === JSON.stringify(prior.data['auto-notes']), id + ': refresh restores unrelated objects')
    check(JSON.stringify(restored.paths.map(p => p.d)) === JSON.stringify(imported.paths.map(p => p.d)), id + ': restored rendering unchanged')
    check(restoreFidelity.gradeable_vertex_max_pixel < 1e-8, id + ': restored gradeable geometry retains every vertex')
    await page.locator('#automatic-photo-si-container').screenshot({ path: options.output + '/' + id + '--restored.png' })
    // Exercise the native Select tool, not a setState edit.
    await page.locator('#automatic-photo-si-container').getByRole('button', { name: 'Select Select', exact: true }).click()
    const svg = page.locator('#automatic-photo-si-canvas'); await svg.scrollIntoViewIfNeeded()
    const grab = await page.evaluate(() => {
      const svg = document.getElementById('automatic-photo-si-canvas'); const box = svg.getBoundingClientRect()
      const path = svg.querySelectorAll('path.plugin-id-auto-ink')[1]; const p = path.getPointAtLength(path.getTotalLength() * 0.37)
      return { x: box.x + p.x * box.width / 800, y: box.y + p.y * box.height / 600 }
    })
    await page.mouse.move(grab.x, grab.y); await page.mouse.down(); await page.mouse.move(grab.x + 26, grab.y + 18, { steps: 8 }); await page.mouse.up()
    const edited = await collect()
    const dx = edited.state.data['auto-ink'][1][0].x - restored.state.data['auto-ink'][1][0].x
    const dy = edited.state.data['auto-ink'][1][0].y - restored.state.data['auto-ink'][1][0].y
    check(Math.hypot(dx, dy) > 10, id + ': native Select drag edits imported branch')
    check(edited.state.data['auto-ink'][1].every((p, i) => Math.abs(p.x - restored.state.data['auto-ink'][1][i].x - dx) < 1e-7 && Math.abs(p.y - restored.state.data['auto-ink'][1][i].y - dy) < 1e-7), id + ': native edit translates all controls without deforming the branch')
    check(JSON.stringify(edited.state.data['auto-ink'][0]) === JSON.stringify(prior.data['auto-ink'][0]) && JSON.stringify(edited.state.data['auto-notes']) === JSON.stringify(prior.data['auto-notes']), id + ': native edit leaves unrelated objects stable')
    if (count === 2) check(JSON.stringify(edited.state.data['auto-ink'][2]) === JSON.stringify(restored.state.data['auto-ink'][2]), 'Editing branch one leaves disconnected branch two unchanged')
    const editedSubmission = await save(); await page.reload({ waitUntil: 'networkidle' }); await ready()
    const editedRestored = await collect()
    check(JSON.stringify(editedRestored.state.data['auto-ink']) === JSON.stringify(editedSubmission.data['auto-ink']), id + ': edited graph survives Save & Grade and refresh')
    outcomes.push({ id, recognition_kind: 'controlled_raster', geometry: g, prior, imported, submitted, restored, edited, editedSubmission, editedRestored,
      import_fidelity: importFidelity, restore_fidelity: restoreFidelity, edit_delta_native: [dx, dy] })
  }
  await fresh(); const empty = await getState(); await open(); await upload('ambiguous-axes')
  check(await page.evaluate(() => window.__nativeCV.strokes.length) === 5, 'Negative case really contains five candidate paths')
  check(await confirm().isDisabled() && await panel().locator('.star-auto-ack').isDisabled(), 'Ambiguous axes block acknowledgment and native import')
  await confirm().dispatchEvent('click'); check(JSON.stringify((await getState()).data) === JSON.stringify(empty.data), 'Unsafe five-path result cannot mutate native state')
  await panel().screenshot({ path: options.output + '/ambiguous--blocked.png' })
  await upload('line'); await acknowledge(); await panel().locator('.star-auto-reject').click(); await confirm().dispatchEvent('click')
  check(JSON.stringify((await getState()).data) === JSON.stringify(empty.data), 'Rejected proposal cannot be committed')
  await panel().locator('.star-auto-retry').click(); await page.waitForFunction(() => !document.querySelector('.star-auto-ack').disabled)
  await acknowledge(); await page.evaluate(() => { const si = window.SketchInput.instances['automatic-photo']; si.setState(JSON.stringify({ data: { 'auto-notes': [{ x: 30, y: 40 }] } })) })
  await confirm().click()
  check((await panel().locator('.star-auto-status').textContent()).includes('canvas changed'), 'Native canvas changes invalidate reviewed proposal')
  check((await getState()).data['auto-ink'].length === 0 && (await getState()).data['auto-notes'].length === 1, 'Stale confirmation preserves newer canvas edits')
  await panel().locator('.star-auto-retry').click(); await page.waitForFunction(() => !document.querySelector('.star-auto-ack').disabled); await acknowledge()
  await page.evaluate(() => {
    window.__bitmap = window.createImageBitmap
    window.createImageBitmap = async function (blob, ...args) {
      const b = await window.__bitmap(blob, ...args)
      if (blob.name === 'sharp-v.png') await new Promise(resolve => setTimeout(resolve, 1000))
      return b
    }
  })
  await panel().locator('input[type=file]').setInputFiles(options.fixtures + '/sharp-v.png')
  check(await confirm().isDisabled(), 'Photo replacement immediately invalidates prior approval')
  await upload('two-branches'); await page.waitForTimeout(1200)
  check(await page.evaluate(() => window.__nativeCV.strokes.length) === 2 && await panel().locator('.star-auto-preview path').count() === 2, 'Late older recognition cannot overwrite the newer two-branch proposal')
  check(!await panel().locator('.star-auto-ack').isChecked() && await confirm().isDisabled(), 'New photo requires fresh explicit confirmation')
  await panel().locator('.star-auto-close').click(); await open(); await confirm().dispatchEvent('click')
  check((await getState()).data['auto-ink'].length === 0 && await confirm().isDisabled(), 'Closing/reopening cannot commit a stale proposal')
  await panel().locator('.star-auto-close').click()
  // Runtime verification of all three native plugin representations on the V.
  const diagnostics = await page.evaluate(async g => {
    const config = JSON.parse(atob(document.getElementById('automatic-photo-sketchresponse-data').textContent)); const out = {}
    for (const kind of ['polyline', 'spline', 'freeform']) {
      const el = document.createElement('div'); document.body.append(el)
      const id = 'probe-' + kind; const tool = 'curve-' + kind
      const si = new window.sketchresponse.default(el, id, { ...config, plugins: [{ name: kind, id: tool, closed: false }], initialstate: {} })
      await new Promise(resolve => si.messageBus.on('ready', resolve))
      si.setState(JSON.stringify({ data: { [tool]: g.strokes.map(s => window.StarNative.encode(s.vertices.map(v => window.StarNative.graphToNative(config, v.graph)), kind)) } }))
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const state = JSON.parse(si.getState()); const gradeable = JSON.parse(si.getGradeable())
      const paths = [...el.querySelectorAll('path.plugin-id-' + tool)].map(p => {
        const length = p.getTotalLength(); const n = Math.max(1, Math.ceil(length / 0.5))
        return { d: p.getAttribute('d'), samples: Array.from({ length: n + 1 }, (_, i) => { const q = p.getPointAtLength(length * i / n); return [q.x, q.y] }) }
      })
      out[kind] = { state, gradeable, paths, control_count: state.data[tool][0].length }; el.remove()
    }
    return out
  }, vGeometry)
  const nativeTools = {}
  for (const kind of ['polyline', 'spline', 'freeform']) {
    const d = diagnostics[kind]; const expected = vGeometry.strokes.map(s => s.vertices.map(v => v.pixel)); const tool = 'curve-' + kind
    const drawn = d.paths.flatMap(p => p.samples.map(p => toPhoto(p, vGeometry, d.state.meta.config)))
    const grading = d.gradeable.data[tool].flatMap(s => {
      const out = []; const ps = s.spline
      for (let i = 0; i < ps.length - 3; i += 3) for (let j = 0; j <= 80; j++) {
        const t = j / 80; const u = 1 - t
        out.push(toPhoto([0, 1].map(c => u ** 3 * ps[i][c] + 3 * u * u * t * ps[i + 1][c] + 3 * u * t * t * ps[i + 2][c] + t ** 3 * ps[i + 3][c]), vGeometry, d.state.meta.config))
      }
      return out
    })
    nativeTools[kind] = { rendered_max_photo_pixel: Math.max(...drawn.map(p => pointDistance(p, expected))), gradeable_max_photo_pixel: Math.max(...grading.map(p => pointDistance(p, expected))),
      control_count: d.control_count, state: d.state, gradeable: d.gradeable, paths: d.paths }
    check(d.paths.length === 1 && (d.gradeable.data[tool][0].spline.length - 1) % 3 === 0, kind + ': actual runtime render/state/gradeable representation verified')
  }
  check(nativeTools.freeform.gradeable_max_photo_pixel < 1e-8, 'Freeform grading uses the exact geometric segments')
  await fresh()
  const container = page.locator('#automatic-photo-si-container')
  await container.getByText('Graph strokes', { exact: true }).click()
  const manualCanvas = page.locator('#automatic-photo-si-canvas'); await manualCanvas.scrollIntoViewIfNeeded()
  const box = await manualCanvas.boundingBox()
  const screen = (x, y) => [box.x + x * box.width / 800, box.y + y * box.height / 600]
  await page.mouse.move(...screen(130, 400)); await page.mouse.down(); await page.mouse.move(...screen(600, 180), { steps: 20 }); await page.mouse.up()
  await page.waitForFunction(() => document.querySelectorAll('#automatic-photo-si-canvas path.plugin-id-auto-ink').length === 1)
  const manuallyDrawn = await collect()
  check(manuallyDrawn.state.data['auto-ink'].length === 1 && manuallyDrawn.state.data['auto-ink'][0].length >= 4, 'Stock freeform drawing works without photo import')
  check(await page.evaluate(() => window.__fitCalls) === 0, 'Stock native drawing remains independent of equation fitting')
  await page.locator('#automatic-photo-si-container').screenshot({ path: options.output + '/manual--native.png' })
  const manualSubmission = await save(); await page.reload({ waitUntil: 'networkidle' }); await ready()
  const manualRestored = await collect()
  check(JSON.stringify(manualRestored.state.data['auto-ink']) === JSON.stringify(manualSubmission.data['auto-ink']), 'Manual native drawing survives Save & Grade and refresh')
  // Verify the existing guided camera route also works with this freeform tool.
  await page.goto(options.url + '/', { waitUntil: 'networkidle' }); await ready()
  await page.locator('#automatic-photo-star-photo-btn').click()
  const assistedPanel = page.locator('#automatic-photo-star-panel')
  await assistedPanel.locator('input[type=file]').setInputFiles(options.fixtures + '/line.png')
  await assistedPanel.locator('.star-status').filter({ hasText: 'Place the axes, then trace your curve.' }).waitFor()
  await assistedPanel.locator('.star-mode-curve').click()
  const traceCanvas = assistedPanel.locator('.star-canvas'); await traceCanvas.scrollIntoViewIfNeeded()
  const traceBox = await traceCanvas.boundingBox()
  for (let i = 0; i <= 35; i++) {
    await page.mouse.move(traceBox.x + (100 + 418 * i / 35) * traceBox.width / 640, traceBox.y + (238 - 132 * i / 35) * traceBox.height / 480)
    if (i === 0) await page.mouse.down()
  }
  await page.mouse.up(); await assistedPanel.locator('.star-use').click(); await assistedPanel.locator('.star-confirm').click()
  await page.waitForFunction(() => document.querySelectorAll('#automatic-photo-si-canvas path.plugin-id-auto-ink').length === 1)
  const assistedNative = await collect()
  check(assistedNative.state.data['auto-ink'][0].length === 49, 'Assisted photo fitting transfers 17 samples as 49 valid freeform controls')
  check(JSON.stringify(assistedNative.gradeable.data['auto-ink'][0].spline) === JSON.stringify(assistedNative.state.data['auto-ink'][0].map(p => [p.x, p.y])), 'Assisted freeform rendering state and gradeable controls agree')
  const assistedSubmission = await save(); await page.reload({ waitUntil: 'networkidle' }); await ready()
  const assistedRestored = await collect()
  check(JSON.stringify(assistedRestored.state.data['auto-ink']) === JSON.stringify(assistedSubmission.data['auto-ink']), 'Assisted photo freeform import survives Save & Grade and refresh')
  await page.setViewportSize({ width: 390, height: 844 }); await fresh(); await open(); await upload('two-branches')
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Automatic review has no mobile page overflow')
  check(await panel().evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Automatic dialog has no mobile horizontal overflow')
  await panel().screenshot({ path: options.output + '/mobile--review.png' })
  check(errors.length === 0, 'No application console errors')
  return { passed: checks.length, checks, consoleErrors: errors, outcomes, nativeTools, manual: { manuallyDrawn, manualSubmission, manualRestored }, assisted: { assistedNative, assistedSubmission, assistedRestored },
    recognition_claim: 'Import fidelity is measured against recognized geometry. Real-photo recognition remains 0/2 from step 2.' }
}
const options = {
  url: process.env.STAR_NATIVE_TEST_URL || 'http://localhost:3000/pl/course/1/question/254/preview',
  fixtures: resolve(__dirname, '../benchmarks/photo-graphs/automatic-cv/experiment-01/inputs'),
  output: resolve(process.env.PL_PHOTO_TEST_OUTPUT || '/tmp/star-native-browser')
}
mkdirSync(options.output, { recursive: true })
const cli = process.env.PL_PHOTO_TEST_CLI || 'playwright-cli'
function run (args) {
  const r = spawnSync(cli, ['-s=star-native-step3', ...args], { encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024 })
  const output = (r.stdout || '') + (r.stderr || '')
  if (args[0] !== 'snapshot' && args[0] !== 'run-code') process.stdout.write(output.split('### Ran Playwright code')[0])
  if (r.error || r.status !== 0 || output.includes('### Error')) { process.stdout.write(output.slice(0, 4000)); throw r.error || new Error('Native browser check failed') }
  if (args[0] === 'run-code') {
    const json = output.split('### Result\n')[1]?.split('\n###')[0]
    if (!json) throw new Error('Browser result was not returned')
    const result = JSON.parse(json); writeFileSync(options.output + '/results.json', JSON.stringify(result, null, 2) + '\n')
    process.stdout.write('Native browser assertions passed: ' + result.passed + '\n')
  }
}
try {
  run(['open', options.url, '--browser', 'chrome']); run(['snapshot'])
  run(['run-code', 'async (page) => (' + checkNative.toString() + ')(page, ' + JSON.stringify(options) + ')'])
} catch (error) { console.error(error.message); process.exitCode = 1 } finally { run(['close']) }
