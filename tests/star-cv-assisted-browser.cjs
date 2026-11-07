// Local PrairieLearn acceptance. No external provider transport is used.
const { spawnSync } = require('node:child_process')
const { mkdirSync, writeFileSync } = require('node:fs')
const { resolve } = require('node:path')
async function acceptance (page, o) {
  const checks = []; const errors = []; const posts = []; const external = []
  const check = (ok, text) => { if (!ok) throw Error(text); checks.push(text) }
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('request', r => { if (r.method() === 'POST') posts.push(r.postData()); if (/generativelanguage|aiplatform|googleapis/.test(r.url())) external.push(r.url().split('?')[0]) })
  const ready = () => page.waitForFunction(() => window.StarCVAssisted && window.SketchInput?.instances['automatic-photo'])
  const panel = () => page.locator('#automatic-photo-automatic-dialog')
  const state = () => page.evaluate(() => JSON.parse(window.SketchInput.instances['automatic-photo'].getState()))
  const fresh = async () => {
    await page.goto(o.url, { waitUntil: 'networkidle' }); await ready()
    await page.evaluate(() => {
      window.__fits = 0; window.__recognitions = 0; window.__correction = null; window.__rawCV = null
      window.StarFit.fit = window.StarFit.sampleCurve = () => { window.__fits++; throw Error('No equation fitting allowed') }
      const recognize = window.StarProviders.recognize
      window.StarProviders.recognize = async (...args) => { window.__recognitions++; const result = await recognize(...args); window.__rawCV = JSON.parse(JSON.stringify(result.geometry)); return result }
      const build = window.StarCVAssisted.fromSelection
      window.StarCVAssisted.fromSelection = (...args) => { const g = build(...args); window.__correction = JSON.parse(JSON.stringify(g)); return g }
    })
  }
  const openUpload = async () => {
    await page.locator('#automatic-photo-automatic-button').click()
    await panel().locator('input[type=file]').setInputFiles(o.photo)
    await page.waitForFunction(() => !document.querySelector('.star-auto-retry').disabled)
  }
  const screenshot = name => panel().screenshot({ path: o.output + '/' + name + '.png' })
  const point = async (name, p) => {
    await panel().locator(`[data-marker="${name}"]`).click()
    const c = panel().locator('.star-auto-photo'); await c.scrollIntoViewIfNeeded(); const b = await c.boundingBox()
    await page.mouse.click(b.x + p[0] * b.width / 1688, b.y + p[1] * b.height / 1473)
  }
  const calibrate = async (capture = false) => {
    await panel().locator('.star-auto-next').click()
    check(await panel().locator('.star-auto-next').isDisabled(), 'Axis calibration requires explicit markers, separate scales and acknowledgment')
    await point('origin', [782, 786]); await point('xMarker', [1229, 775]); await point('yMarker', [751, 300])
    // Exercise source-pixel keyboard adjustment and reversal.
    await panel().locator('.star-auto-photo').press('ArrowRight'); await panel().locator('.star-auto-photo').press('ArrowLeft')
    await panel().locator('.star-auto-x-value').fill('3'); await panel().locator('.star-auto-y-value').fill('3')
    check(await panel().locator('.star-auto-next').isDisabled(), 'Entering scale values alone does not confirm calibration')
    await panel().locator('.star-auto-calibration-ack').check()
    if (capture) {
      await page.setViewportSize({ width: 1280, height: 720 }); await panel().locator('.star-auto-body').evaluate(el => { el.scrollTop = 0 }); await screenshot('presentation-calibration')
      await page.setViewportSize({ width: 390, height: 844 }); await screenshot('mobile-calibration'); check(await panel().evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Mobile calibration controls fit without horizontal overflow')
      await page.setViewportSize({ width: 1440, height: 1100 })
    }
    await panel().locator('.star-auto-next').click()
    check(await panel().locator('.star-auto-next').isDisabled(), 'Unreviewed lines and small marks block preview')
  }
  const select = async () => {
    if (!await panel().locator('.star-auto-line-details').evaluate(el => el.open)) await panel().locator('.star-auto-line-details summary').click()
    for (const id of ['stroke-10', 'stroke-12']) { await panel().locator(`.star-auto-preview [data-stroke="${id}"]`).focus(); await panel().locator(`.star-auto-preview [data-stroke="${id}"]`).press('Space') }
    check(await panel().locator('select[data-stroke="stroke-10"]').inputValue() === 'keep', 'Keyboard Space selects a detected line without drawing a new stroke')
    await panel().locator('select[data-stroke="stroke-11"]').selectOption('keep')
    await panel().locator('.star-auto-exclude-rest').click()
    check(await panel().locator('.star-auto-next').isDisabled(), 'Bulk line exclusion does not silently classify small marks')
    for (let i = 1; i <= 4; i++) await panel().locator(`select[data-mark="mark-${i}"]`).selectOption(i === 1 ? 'point' : 'exclude')
    check(await panel().locator('.star-auto-next').isDisabled(), 'All selections still require whole-photo geometry review')
    await panel().locator('.star-auto-reviewed').check()
    check(await panel().locator('.star-auto-next').isEnabled(), 'Fully reviewed calibration and selections enable native preview')
  }
  const collect = () => page.evaluate(() => {
    const si = window.SketchInput.instances['automatic-photo']
    return { state: JSON.parse(si.getState()), gradeable: JSON.parse(si.getGradeable()), paths: [...document.querySelectorAll('#automatic-photo-si-canvas path.plugin-id-auto-ink')].map(p => ({ d: p.getAttribute('d'), samples: Array.from({ length: 501 }, (_, i) => { const q = p.getPointAtLength(p.getTotalLength() * i / 500); return [q.x, q.y] }) })) }
  })
  const save = async () => {
    const n = posts.length; await page.getByRole('button', { name: 'Save & Grade', exact: true }).click(); await page.waitForLoadState('networkidle'); await ready()
    const body = posts.slice(n).find(p => p && new URLSearchParams(p).has('automatic-photo-sketchresponse-submission'))
    check(!!body, 'Actual Save & Grade POST includes the native graph submission')
    check(await page.getByText('Invalid', { exact: true }).count() === 0, 'Server accepts native curve and point submission format')
    check(await page.getByText('0%', { exact: true }).count() > 0, 'Existing x-squared grader preserves and marks this non-solution incorrect')
    return JSON.parse(Buffer.from(new URLSearchParams(body).get('automatic-photo-sketchresponse-submission'), 'base64').toString())
  }
  await page.setViewportSize({ width: 1440, height: 1100 }); await fresh()
  await page.evaluate(() => {
    const si = window.SketchInput.instances['automatic-photo']; const c = JSON.parse(atob(document.getElementById('automatic-photo-sketchresponse-data').textContent))
    const prior = window.StarNative.encode([[6.85, -3.5], [7, -3.3]].map(p => window.StarNative.graphToNative(c, p)), 'freeform')
    si.setState(JSON.stringify({ data: { 'auto-ink': [prior], 'auto-notes': [{ x: 735, y: 540 }] } }))
  })
  const prior = await state(); await openUpload()
  const raw = await page.evaluate(() => window.__rawCV)
  check(raw.strokes.length === 44 && raw.status !== 'automatic', 'Real photograph reproduces incomplete 44-path CV recognition')
  check(await panel().locator('.star-auto-confirm').isDisabled(), 'Raw uncalibrated CV cannot be imported')
  check(!await panel().locator('.star-auto-technical').evaluate(el => el.open), 'Engineering diagnostics are collapsed by default')
  await screenshot('after-desktop-detected')
  await page.setViewportSize({ width: 1280, height: 720 }); await screenshot('presentation-detected')
  check(await panel().evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Presentation viewport has no horizontal dialog overflow')
  check(await panel().locator('.star-auto-next').isVisible(), 'Presentation viewport exposes one primary continuation action')
  await page.setViewportSize({ width: 390, height: 844 }); await screenshot('after-mobile-detected')
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile page has no horizontal overflow')
  check(await panel().evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Mobile dialog has no horizontal overflow')
  await page.setViewportSize({ width: 1440, height: 1100 }); await calibrate(true)
  check((await panel().locator('.star-auto-method').textContent()).startsWith('CV-assisted'), 'Human-calibrated continuation is labeled CV-assisted, never automatic')
  check(await panel().locator('.star-auto-photo-name').textContent() === 'IMG_1670--source.png', 'Same source photograph remains available during correction')
  await select(); await panel().locator('.star-auto-body').evaluate(el => { el.scrollTop = 0 }); await screenshot('selected-pixels')
  await panel().locator('.star-auto-next').click()
  check(await panel().locator('.star-auto-confirm').isDisabled(), 'Final native preview requires fresh explicit confirmation')
  check(await panel().locator('.star-auto-preview path').count() === 1 && await panel().locator('.star-auto-preview circle').count() === 1, 'Preview includes one exact joined curve and the explicitly kept filled dot')
  const corrected = await page.evaluate(() => window.__correction)
  check(corrected.provenance.photo_sha256 === o.hash, 'Correction provenance matches the exact original photo hash')
  check(corrected.provenance.automatically_recognized === false, 'Intermediate geometry preserves assisted provenance')
  const source = raw.strokes.filter(s => ['stroke-10', 'stroke-11', 'stroke-12'].includes(s.id)).flatMap(s => s.vertices.map(v => v.pixel))
  const output = corrected.strokes.flatMap(s => s.vertices.map(v => v.pixel))
  check(source.every(p => output.some(q => JSON.stringify(p) === JSON.stringify(q))) && output.every(p => source.some(q => JSON.stringify(p) === JSON.stringify(q))), 'Every reused vertex is an actual selected CV pixel; none is invented or retraced')
  check(corrected.strokes[0].vertices.filter(v => v.endpoint).length === 2 && corrected.strokes[0].vertices.filter(v => v.corner).length >= 2, 'Both branch endpoints and original sharp-corner flags survive')
  check(await page.evaluate(() => window.__fits === 0 && window.__recognitions === 1), 'Continuation uses one CV extraction, zero equation fitting and no retracing')
  check(JSON.stringify((await state()).data) === JSON.stringify(prior.data), 'Review does not alter any existing native object')
  await screenshot('native-preview'); await panel().locator('.star-auto-ack').check(); await panel().locator('.star-auto-confirm').click()
  await page.waitForFunction(() => document.querySelectorAll('#automatic-photo-si-canvas path.plugin-id-auto-ink').length === 2)
  const imported = await collect()
  check(imported.state.data['auto-ink'].length === 2 && imported.state.data['auto-notes'].length === 2, 'Native import appends a curve and a dot without dropping prior objects')
  check(JSON.stringify(imported.state.data['auto-ink'][0]) === JSON.stringify(prior.data['auto-ink'][0]) && JSON.stringify(imported.state.data['auto-notes'][0]) === JSON.stringify(prior.data['auto-notes'][0]), 'Prior curve and unrelated point retain exact coordinates')
  check(JSON.stringify(imported.gradeable.data['auto-ink'][1].spline) === JSON.stringify(imported.state.data['auto-ink'][1].map(p => [p.x, p.y])), 'Gradeable freeform controls exactly match the rendering state')
  await page.locator('#automatic-photo-si-container').screenshot({ path: o.output + '/native-import.png' })
  const submitted = await save(); await page.reload({ waitUntil: 'networkidle' }); await ready(); const restored = await collect()
  check(JSON.stringify(restored.state.data) === JSON.stringify(imported.state.data), 'Save & Grade and refresh restore the curve, dot and all prior objects exactly')
  await page.locator('#automatic-photo-si-container').screenshot({ path: o.output + '/native-restored.png' })
  await page.locator('#automatic-photo-si-container').getByRole('button', { name: 'Select Select', exact: true }).click()
  await page.locator('#automatic-photo-si-canvas').scrollIntoViewIfNeeded()
  const grab = await page.evaluate(() => {
    const svg = document.getElementById('automatic-photo-si-canvas'); const b = svg.getBoundingClientRect(); const path = svg.querySelectorAll('path.plugin-id-auto-ink')[1]; const p = path.getPointAtLength(path.getTotalLength() * 0.25)
    return { x: b.x + p.x * b.width / 800, y: b.y + p.y * b.height / 600 }
  })
  await page.mouse.move(grab.x, grab.y); await page.mouse.down(); await page.mouse.move(grab.x + 20, grab.y + 12, { steps: 8 }); await page.mouse.up()
  const edited = await collect(); const dx = edited.state.data['auto-ink'][1][0].x - restored.state.data['auto-ink'][1][0].x; const dy = edited.state.data['auto-ink'][1][0].y - restored.state.data['auto-ink'][1][0].y
  check(Math.hypot(dx, dy) > 5, 'Native Select drag edits the imported curve')
  check(edited.state.data['auto-ink'][1].every((p, i) => Math.abs(p.x - restored.state.data['auto-ink'][1][i].x - dx) < 1e-6 && Math.abs(p.y - restored.state.data['auto-ink'][1][i].y - dy) < 1e-6), 'Native editing translates all controls without deforming corners')
  check(JSON.stringify(edited.state.data['auto-notes']) === JSON.stringify(restored.state.data['auto-notes']), 'Curve editing preserves both independent dots')
  const editedSubmission = await save(); await page.reload({ waitUntil: 'networkidle' }); await ready()
  check(JSON.stringify((await state()).data) === JSON.stringify(edited.state.data), 'Edited CV-assisted geometry survives another Save & Grade and refresh')
  // Negative/recovery cases use a new local variant and the same photo.
  await fresh(); await openUpload(); await calibrate(); await select(); await panel().locator('.star-auto-next').click(); await panel().locator('.star-auto-ack').check()
  await panel().locator('.star-auto-back').click()
  check(await panel().locator('.star-auto-confirm').isDisabled(), 'Editing a review invalidates its previous confirmation token')
  await panel().locator('.star-auto-next').click(); await panel().locator('.star-auto-ack').check()
  await page.evaluate(() => window.SketchInput.instances['automatic-photo'].setState(JSON.stringify({ data: { 'auto-notes': [{ x: 30, y: 40 }] } })))
  await panel().locator('.star-auto-confirm').click()
  check((await panel().locator('.star-auto-disabled-help').textContent()).includes('canvas changed'), 'A native edit after preview blocks stale CV-assisted import')
  check((await state()).data['auto-ink'].length === 0 && (await state()).data['auto-notes'].length === 1, 'Blocked stale proposal preserves the newer native edit')
  await panel().locator('.star-auto-reject').click(); await panel().locator('.star-auto-confirm').dispatchEvent('click')
  check((await state()).data['auto-ink'].length === 0, 'Rejected CV-assisted proposal cannot be committed')
  await panel().locator('.star-auto-retry').click(); await page.waitForFunction(() => !document.querySelector('.star-auto-retry').disabled); await calibrate(); await select(); await panel().locator('.star-auto-next').click(); await panel().locator('.star-auto-ack').check()
  await panel().locator('input[type=file]').setInputFiles(o.fixtures + '/ambiguous-axes.png'); await page.waitForFunction(() => !document.querySelector('.star-auto-retry').disabled)
  check(await panel().locator('.star-auto-confirm').isDisabled() && !await panel().locator('.star-auto-ack').isChecked(), 'Replacing the photo invalidates calibration, selection and final approval immediately')
  await page.reload({ waitUntil: 'networkidle' }); await ready(); await page.locator('#automatic-photo-automatic-button').click()
  check(await panel().locator('.star-auto-confirm').isDisabled(), 'Browser refresh cannot restore an uncommitted review token')
  await panel().press('Escape'); check(await panel().isHidden() && await page.locator('#automatic-photo-automatic-button').evaluate(el => el === document.activeElement), 'Escape closes review and returns keyboard focus to its opener')
  const beforeRecovery = await state(); await page.locator('#automatic-photo-automatic-button').click()
  await panel().locator('input[type=file]').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('invalid image') })
  await panel().locator('.star-auto-status').filter({ hasText: 'Could not recognize this photo' }).waitFor()
  check(await panel().locator('.star-auto-confirm').isDisabled() && JSON.stringify((await state()).data) === JSON.stringify(beforeRecovery.data), 'Unreadable photo remains blocked and preserves native objects')
  await page.evaluate(() => { window.__files = []; const decode = window.createImageBitmap; window.createImageBitmap = (...args) => { window.__files.push(args[0]); return decode(...args) } })
  await panel().locator('input[type=file]').setInputFiles(o.photo); await page.waitForFunction(() => !document.querySelector('.star-auto-retry').disabled)
  await panel().locator('.star-auto-next').click(); await panel().locator('.star-auto-correct').click()
  const manual = page.locator('#automatic-photo-star-panel')
  await manual.locator('.star-status').filter({ hasText: 'Place the axes, then trace your curve.' }).waitFor()
  check(await page.evaluate(() => window.__files.length === 2 && window.__files[0] === window.__files[1]), 'CV-assisted manual fallback transfers the exact same local File without another selection')
  check(await manual.locator('.star-photo-name').textContent() === 'IMG_1670--source.png' && await manual.locator('input[type=file]').evaluate(el => el.files.length === 0), 'Original photo remains loaded in manual tracing with no second file-picker action')
  check((await manual.locator('.star-assisted-method').textContent()).includes('manually assisted'), 'Fallback explicitly changes the method to manually assisted')
  check(JSON.stringify((await state()).data) === JSON.stringify(beforeRecovery.data), 'Manual fallback handoff preserves every native object')
  await manual.screenshot({ path: o.output + '/same-photo-manual-fallback.png' })
  await fresh(); await page.locator('#automatic-photo-automatic-button').click()
  await panel().locator('input[type=file]').setInputFiles(o.fixtures + '/real--01-multiple-lines-graph-paper.png'); await page.waitForFunction(() => !document.querySelector('.star-auto-retry').disabled)
  check(await page.evaluate(() => window.__rawCV.strokes.length === 0) && await panel().locator('.star-auto-next').isHidden() && await panel().locator('.star-auto-confirm').isDisabled(), 'Existing no-strokes photograph cannot enter CV-assisted import or create geometry')
  check((await panel().locator('.star-auto-correct').getAttribute('class')).includes('btn-primary') && await panel().locator('.star-auto-correct').isEnabled(), 'No-strokes failure presents manual tracing as its one primary next action')
  await screenshot('no-strokes-manual-fallback')
  check(errors.length === 0, 'No application console or page errors')
  check(external.length === 0, 'No Gemini or other Google provider requests')
  return { passed: checks.length, checks, consoleErrors: errors, externalProviderRequests: external, raw, corrected, prior, imported, submitted, restored, edited, editedSubmission, edit_delta_native: [dx, dy], recognition_kind: 'CV-assisted: human calibration, line/mark classification and final confirmation; no retracing', viewport_checks: ['Chrome desktop 1440x1100', 'Chrome presentation viewport 1280x720', 'Chrome mobile 390x844'], physical_projector: 'NOT TESTED: requires on-device manual check' }
}
const root = resolve(__dirname, '..'); const options = { url: process.env.STAR_NATIVE_TEST_URL || 'http://localhost:3000/pl/course/1/question/254/preview/', photo: root + '/benchmarks/photo-graphs/multi-method/step-4g-1/results/IMG_1670--source.png', hash: '9c8247ec0be7d4ca68c4536eea990a0c5b0fce6250e8478a13b5aa5a0e190231', fixtures: root + '/benchmarks/photo-graphs/automatic-cv/experiment-01/inputs', output: resolve(process.env.PL_PHOTO_TEST_OUTPUT || '/private/tmp/star-step4g3/acceptance') }
mkdirSync(options.output, { recursive: true }); const cli = process.env.PL_PHOTO_TEST_CLI || 'playwright-cli'
function run (args) {
  const r = spawnSync(cli, ['-s=star-cv-assisted-g3', ...args], { cwd: '/private/tmp', encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024 }); const s = (r.stdout || '') + (r.stderr || '')
  if (r.error || r.status !== 0 || s.includes('### Error')) throw r.error || Error(s.slice(-5000))
  if (args[0] === 'run-code') { const result = JSON.parse(s.split('### Result\n')[1].split('\n###')[0]); writeFileSync(options.output + '/results.json', JSON.stringify(result, null, 2) + '\n'); console.log('CV-assisted browser assertions passed: ' + result.passed) }
}
try { run(['open', options.url, '--browser', 'chrome']); run(['snapshot']); run(['run-code', 'async page => (' + acceptance.toString() + ')(page, ' + JSON.stringify(options) + ')']) } catch (e) { console.error(e.message); process.exitCode = 1 } finally { run(['close']) }
