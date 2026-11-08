// Local PrairieLearn acceptance. No external provider transport is used.
const { spawnSync } = require('node:child_process')
const { mkdirSync, writeFileSync, readFileSync } = require('node:fs')
const { resolve, basename } = require('node:path')
const { createHash } = require('node:crypto')
async function acceptance (page, o) {
  const checks = []; const layouts = []; const errors = []; const posts = []; const external = []
  const check = (ok, text) => { if (!ok) throw Error(text); checks.push(text) }
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('request', r => { if (r.method() === 'POST') posts.push(r.postData()); if (/generativelanguage|aiplatform|googleapis/.test(r.url())) external.push(r.url().split('?')[0]) })
  await page.route('**/*', route => { const u = new URL(route.request().url()); return ['localhost', '127.0.0.1'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol) ? route.continue() : route.abort() })
  const ready = () => page.waitForFunction(() => window.StarCVAssisted && window.SketchInput?.instances['automatic-photo'])
  const panel = () => page.locator('#automatic-photo-automatic-dialog')
  const state = () => page.evaluate(() => JSON.parse(window.SketchInput.instances['automatic-photo'].getState()))
  const fresh = async () => {
    await page.goto(o.url, { waitUntil: 'networkidle' }); await ready()
    await page.evaluate(() => {
      window.__fits = 0; window.__recognitions = 0; window.__decoded = null; window.__correction = null; window.__rawCV = null
      window.StarFit.fit = window.StarFit.sampleCurve = () => { window.__fits++; throw Error('No equation fitting allowed') }
      const recognize = window.StarProviders.recognize
      window.StarProviders.recognize = async (...args) => { window.__recognitions++; const im = args[0]; const canvas = document.createElement('canvas'); canvas.width = im.width; canvas.height = im.height; canvas.getContext('2d').putImageData(im, 0, 0); window.__decoded = canvas.toDataURL(); const result = await recognize(...args); window.__rawCV = JSON.parse(JSON.stringify(result.geometry)); return result }
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
  const centered = async label => {
    const layout = await panel().evaluate(el => { const r = el.getBoundingClientRect(); const style = getComputedStyle(el); const body = el.querySelector('.star-auto-body'); const footer = el.querySelector('footer').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, vw: innerWidth, vh: innerHeight, zoom: devicePixelRatio, position: style.position, inset: style.inset, margin: style.margin, maxHeight: style.maxHeight, bodyScrolls: body.scrollHeight > body.clientHeight, footerVisible: footer.top >= 0 && footer.bottom <= innerHeight } })
    check(Math.abs(layout.x + layout.width / 2 - layout.vw / 2) < 1 && Math.abs(layout.y + layout.height / 2 - layout.vh / 2) < 1, label + ': dialog is genuinely centered horizontally and vertically')
    check(layout.width <= 1101 && layout.height <= layout.vh * 0.9 + 1 && layout.footerVisible, label + ': 1100px/90dvh limits and visible footer hold')
    layouts.push({ label, ...layout })
  }
  const calibrate = async (capture = false) => {
    await panel().locator('.star-auto-next').click()
    check(await panel().locator('.star-auto-calibration-ack').count() === 0, 'Redundant calibration checkbox is absent')
    check(await panel().locator('.star-auto-next').isDisabled(), 'Incomplete axis references block continuation')
    await point('origin', [782, 786]); await point('xMarker', [1229, 775]); await point('yMarker', [751, 300])
    await panel().locator('.star-auto-photo').press('ArrowRight'); await panel().locator('.star-auto-photo').press('ArrowLeft')
    await panel().locator('.star-auto-x-value').fill('0'); await panel().locator('.star-auto-y-value').fill('3')
    check(await panel().locator('.star-auto-next').isDisabled(), 'Zero scale is rejected without relying on an acknowledgment')
    await panel().locator('.star-auto-x-value').fill('3')
    check(await panel().locator('.star-auto-next').isEnabled(), 'Valid placed references and independent values enable review immediately')
    if (capture) {
      await centered('Desktop calibration'); await page.screenshot({ path: o.output + '/centered-calibration.png' })
      await page.setViewportSize({ width: 1280, height: 720 }); await panel().locator('.star-auto-body').evaluate(el => { el.scrollTop = 0 }); await centered('Presentation calibration'); await screenshot('presentation-calibration')
      await page.setViewportSize({ width: 390, height: 844 }); await centered('Mobile calibration'); await screenshot('mobile-calibration'); check(await panel().evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Mobile calibration controls fit without horizontal overflow')
      await page.setViewportSize({ width: 1440, height: 1100 })
    }
    await panel().locator('.star-auto-next').click()
    check(await panel().locator('.star-auto-next').isDisabled(), 'No graph can continue before explicit line choices')
  }
  const select = async (capture = false) => {
    const candidate = id => panel().locator('.star-auto-photo-overlay [data-candidate="candidate-' + id + '"]')
    await candidate(10).focus(); await candidate(10).press('Space')
    check(await candidate(10).getAttribute('aria-pressed') === 'true', 'Keyboard Space selects the visible source-photo line')
    await panel().locator('.star-auto-undo').click()
    check(await candidate(10).getAttribute('aria-pressed') === 'false' && await panel().locator('.star-auto-next').isDisabled(), 'Undo restores an accidental line choice and its incomplete-review guard')
    await candidate(10).focus(); await candidate(10).press('Space'); await candidate(10).press('ArrowRight')
    check(await candidate(11).evaluate(el => el === document.activeElement), 'Arrow keys navigate highlighted photo lines with one keyboard tab stop')
    await candidate(11).press('Space')
    await candidate(12).scrollIntoViewIfNeeded()
    const hit = await candidate(12).evaluate(p => { const q = p.getPointAtLength(p.getTotalLength() * 0.3); const m = p.getScreenCTM(); return { x: m.a * q.x + m.c * q.y + m.e, y: m.b * q.x + m.d * q.y + m.f } })
    await page.mouse.click(hit.x, hit.y)
    check(await candidate(12).getAttribute('aria-pressed') === 'true', 'A real mouse click on the highlighted photo curve selects its actual pixels')
    check(!await panel().locator('.star-auto-technical').evaluate(el => el.open), 'The real-photo graph can be selected without opening individual fragment controls')
    check(await panel().locator('.star-auto-reviewed').count() === 0, 'Redundant whole-photo match checkbox is absent')
    if (capture) { await panel().locator('.star-auto-body').evaluate(el => { el.scrollTop = 0 }); await screenshot('visual-selection') }
    await panel().locator('.star-auto-next').click()
    check(await panel().locator('.star-auto-remaining').isVisible() && await panel().locator('.star-auto-next').isDisabled(), 'Unchosen lines remain unresolved until the explicit contextual decision')
    if (capture) await screenshot('remaining-lines-review')
    await panel().locator('.star-auto-dismiss-remaining').click()
    check(await panel().locator('.star-auto-next').isDisabled(), 'Explicit remaining-line exclusion does not silently classify possible points')
    check(await panel().locator('.star-auto-point-review').isVisible() && await panel().locator('.star-auto-photo-overlay [data-possible-point]').count() === 4, 'Every ambiguous mark is highlighted on the original photo with a contextual review')
    check(await panel().locator('.star-auto-point-question').getAttribute('aria-describedby') === 'automatic-photo-point-progress' && await panel().locator('.star-auto-point-progress').getAttribute('aria-live') === 'polite', 'Point question, progress and choices have linked screen-reader labels')
    check(await panel().locator('.star-auto-preview').isHidden(), 'Point review replaces the pixel preview instead of stacking a second panel below it')
    check(await panel().locator('.star-auto-point-context').evaluate(el => el.width === 480 && el.height === 280), 'Possible-point crop includes a large surrounding graph/axis region')
    await panel().locator('[data-possible-point="mark-1"]').focus(); await panel().locator('[data-possible-point="mark-1"]').press('ArrowRight')
    check((await panel().locator('.star-auto-point-progress').textContent()).includes('point 2 of 4') && await panel().locator('.star-auto-next').isDisabled(), 'Keyboard users can inspect another possible point without classifying or discarding it')
    await panel().locator('[data-possible-point="mark-2"]').press('ArrowLeft')
    if (capture) { await panel().locator('.star-auto-point-review').scrollIntoViewIfNeeded(); await screenshot('contextual-point-review'); await page.setViewportSize({ width: 390, height: 844 }); await centered('Mobile point review'); await panel().locator('.star-auto-point-review').scrollIntoViewIfNeeded(); await screenshot('mobile-point-review'); await page.setViewportSize({ width: 1440, height: 1100 }) }
    await panel().locator('[data-point-decision="point"]').click(); await panel().locator('.star-auto-undo').click()
    check((await panel().locator('.star-auto-point-progress').textContent()).includes('point 1 of 4') && await panel().locator('.star-auto-next').isDisabled(), 'Undo also restores an unresolved point at its original location')
    await panel().locator('[data-point-decision="point"]').click()
    for (let i = 0; i < 3; i++) await panel().locator('[data-point-decision="exclude"]').click()
    check(await panel().locator('.star-auto-next').isEnabled(), 'Complete explicit line/point decisions enable preview without another acknowledgment')
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
  await centered('Desktop detection'); await page.screenshot({ path: o.output + '/centered-desktop-detected.png' }); await screenshot('after-desktop-detected')
  await page.setViewportSize({ width: 1280, height: 720 }); await centered('Presentation detection'); await screenshot('presentation-detected')
  check(await panel().evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Presentation viewport has no horizontal dialog overflow')
  check(await panel().locator('.star-auto-next').isVisible(), 'Presentation viewport exposes one primary continuation action')
  await page.setViewportSize({ width: 390, height: 844 }); await centered('Mobile detection'); await screenshot('after-mobile-detected')
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile page has no horizontal overflow')
  check(await panel().evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Mobile dialog has no horizontal overflow')
  await page.setViewportSize({ width: 1440, height: 1100 }); await calibrate(true)
  check((await panel().locator('.star-auto-method').textContent()).startsWith('CV-assisted'), 'Human-calibrated continuation is labeled CV-assisted, never automatic')
  check(await panel().locator('.star-auto-photo-name').textContent() === o.photoName, 'Same source photograph remains available during correction')
  await select(true); await panel().locator('.star-auto-body').evaluate(el => { el.scrollTop = 0 }); await screenshot('selected-pixels')
  await panel().locator('.star-auto-next').click()
  check(await panel().locator('.star-auto-confirm').isDisabled(), 'Final native preview requires fresh explicit confirmation')
  check(await panel().locator('.star-auto-preview path').count() === 1 && await panel().locator('.star-auto-preview circle').count() === 1, 'Preview includes one exact joined curve and the explicitly kept filled dot')
  const corrected = await page.evaluate(() => window.__correction); const decodedSource = await page.evaluate(() => window.__decoded)
  check(corrected.provenance.review.reviewBasis === 'explicit_decisions' && !Object.hasOwn(corrected.provenance.review, 'reviewed') && !Object.hasOwn(corrected.provenance.review.axisValues, 'confirmed'), 'New provenance records actual choices without faking either removed acknowledgment')
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
  await calibrate();
  for (const id of [10, 11, 12]) { const p = panel().locator('.star-auto-photo-overlay [data-candidate="candidate-' + id + '"]'); await p.focus(); await p.press('Space') }
  await panel().locator('.star-auto-next').click(); await panel().locator('.star-auto-dismiss-remaining').click()
  check(await panel().locator('.star-auto-next').isDisabled(), 'Not sure remains unresolved before manual recovery')
  await panel().locator('.star-auto-point-manual').click()
  const manual = page.locator('#automatic-photo-star-panel')
  await manual.locator('.star-status').filter({ hasText: 'Place the axes, then trace your curve.' }).waitFor()
  check(await page.evaluate(() => window.__files.length === 2 && window.__files[0] === window.__files[1]), 'CV-assisted manual fallback transfers the exact same local File without another selection')
  check(await manual.locator('.star-photo-name').textContent() === o.photoName && await manual.locator('input[type=file]').evaluate(el => el.files.length === 0), 'Original photo remains loaded in manual tracing with no second file-picker action')
  check((await manual.locator('.star-assisted-method').textContent()).includes('manually assisted'), 'Fallback explicitly changes the method to manually assisted')
  check(JSON.stringify((await state()).data) === JSON.stringify(beforeRecovery.data), 'Manual fallback handoff preserves every native object')
  await manual.screenshot({ path: o.output + '/same-photo-manual-fallback.png' })
  await fresh(); await page.locator('#automatic-photo-automatic-button').click()
  await panel().locator('input[type=file]').setInputFiles(o.fixtures + '/real--01-multiple-lines-graph-paper.png'); await page.waitForFunction(() => !document.querySelector('.star-auto-retry').disabled)
  check(await page.evaluate(() => window.__rawCV.strokes.length === 0) && await panel().locator('.star-auto-next').isHidden() && await panel().locator('.star-auto-confirm').isDisabled(), 'Existing no-strokes photograph cannot enter CV-assisted import or create geometry')
  check((await panel().locator('.star-auto-correct').getAttribute('class')).includes('btn-primary') && await panel().locator('.star-auto-correct').isEnabled(), 'No-strokes failure presents manual tracing as its one primary next action')
  await screenshot('no-strokes-manual-fallback')
  await panel().locator('.star-auto-close').click(); await openUpload(); await panel().locator('.star-auto-next').click()
  for (const [name, arrow] of [['origin', null], ['xMarker', 'Shift+ArrowRight'], ['yMarker', 'Shift+ArrowUp']]) {
    await panel().locator(`[data-marker="${name}"]`).focus(); await panel().locator(`[data-marker="${name}"]`).press('Enter')
    await panel().locator('.star-auto-photo').press('Enter'); if (arrow) await panel().locator('.star-auto-photo').press(arrow)
  }
  await panel().locator('.star-auto-x-value').focus(); await page.keyboard.type('3'); await page.keyboard.press('Tab'); await page.keyboard.type('3')
  check(await panel().locator('.star-auto-next').isEnabled(), 'Keyboard users can explicitly place new references, adjust them and enter both scales')
  await page.keyboard.press('Tab'); check(await panel().evaluate(el => el.contains(document.activeElement)), 'Tab navigation stays within the native modal')
  const focus = await panel().evaluate(() => { const e = document.activeElement; const s = getComputedStyle(e); return { tag: e.tagName, outline: s.outlineStyle, width: s.outlineWidth } })
  check(focus.outline !== 'none' && parseFloat(focus.width) > 0, 'Keyboard focus has a visible indicator')
  await panel().locator('.star-auto-next').click(); await page.setViewportSize({ width: 390, height: 844 })
  const target = panel().locator('.star-auto-photo-overlay [data-candidate="candidate-12"]'); await target.scrollIntoViewIfNeeded()
  const tap = await target.evaluate(p => { const q = p.getPointAtLength(p.getTotalLength() * 0.3); const m = p.getScreenCTM(); return { x: m.a * q.x + m.c * q.y + m.e, y: m.b * q.x + m.d * q.y + m.f } })
  const touch = await page.context().newCDPSession(page); await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tap] }); await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForFunction(() => document.querySelector('.star-auto-photo-overlay [data-candidate="candidate-12"]').getAttribute('aria-pressed') === 'true')
  check(await target.getAttribute('aria-pressed') === 'true', 'Actual Chromium touch events select a highlighted curve in the narrow viewport')
  await touch.send('Emulation.setTouchEmulationEnabled', { enabled: false }); await touch.detach()
  await panel().locator('.star-auto-zoom').click(); check(await panel().locator('.star-auto-photo-stage').evaluate(el => el.style.width === '200%'), 'Photo zoom enlarges the original pixels for finer line selection')
  check(await panel().evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Zoom pans inside the photo instead of overflowing the dialog')
  await panel().locator('.star-auto-zoom').click(); await panel().locator('.star-auto-undo').click()
  check(await target.getAttribute('aria-pressed') === 'false', 'Touch selection can be undone without changing source geometry')
  await centered('Mobile visual selection'); await screenshot('mobile-visual-selection'); await page.setViewportSize({ width: 1440, height: 1100 })
  await panel().press('Escape'); check(await panel().isHidden(), 'Keyboard-only calibration probe closes safely without import')
  check(errors.length === 0, 'No application console or page errors')
  check(external.length === 0, 'No Gemini or other Google provider requests')
  return { passed: checks.length, checks, layouts, decodedSource, consoleErrors: errors, externalProviderRequests: external, raw, corrected, prior, imported, submitted, restored, edited, editedSubmission, edit_delta_native: [dx, dy], recognition_kind: 'CV-assisted: human calibration, line/mark classification and final confirmation; no retracing', viewport_checks: ['Chrome desktop 1440x1100', 'Chrome presentation viewport 1280x720', 'Chrome mobile 390x844'], physical_projector: 'NOT TESTED: requires on-device manual check' }
}
const root = resolve(__dirname, '..'); const options = { url: process.env.STAR_NATIVE_TEST_URL || 'http://localhost:3000/pl/course/1/question/254/preview/', photo: process.env.STAR_CV_REVIEW_PHOTO || '/Users/alaiasun/Library/Mobile Documents/com~apple~CloudDocs/D. UC Berkeley/Courses/CS294 STAR FA2026/Experiment/examples/IMG_1670.jpg', fixtures: root + '/benchmarks/photo-graphs/automatic-cv/experiment-01/inputs', output: resolve(process.env.PL_PHOTO_TEST_OUTPUT || '/private/tmp/star-step4g3-refinement/acceptance') }
options.hash = createHash('sha256').update(readFileSync(options.photo)).digest('hex'); options.photoName = basename(options.photo)
mkdirSync(options.output, { recursive: true }); const cli = process.env.PL_PHOTO_TEST_CLI || 'playwright-cli'
function run (args) {
  const r = spawnSync(cli, ['-s=star-cv-assisted-g3', ...args], { cwd: '/private/tmp', encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024 }); const s = (r.stdout || '') + (r.stderr || '')
  if (r.error || r.status !== 0 || s.includes('### Error')) throw r.error || Error(s.slice(-5000))
  if (args[0] === 'run-code') { const result = JSON.parse(s.split('### Result\n')[1].split('\n###')[0]); const decoded = Buffer.from(result.decodedSource.split(',')[1], 'base64'); delete result.decodedSource; writeFileSync(options.output + '/decoded-source.png', decoded); result.decoded_source_sha256 = createHash('sha256').update(decoded).digest('hex'); result.source_file = { name: options.photoName, sha256: options.hash }; writeFileSync(options.output + '/results.json', JSON.stringify(result, null, 2) + '\n'); console.log('CV-assisted browser assertions passed: ' + result.passed) }
}
try { run(['open', options.url, '--browser', 'chrome']); run(['snapshot']); run(['run-code', 'async page => (' + acceptance.toString() + ')(page, ' + JSON.stringify(options) + ')']) } catch (e) { console.error(e.message); process.exitCode = 1 } finally { run(['close']) }
