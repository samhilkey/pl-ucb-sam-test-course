// Step4D rehearsal of the existing assisted route; no provider or recognition calls.
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const acceptance = require('./star-assisted-browser.cjs')
async function recovery (page, options) {
  const checks = []; const errors = []; const submissions = []
  const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label) }
  page.on('pageerror', e => errors.push(String(e)))
  page.on('request', request => {
    if (request.method() !== 'POST') return
    const field = new URLSearchParams(request.postData() || '').get('paper-v-sketchresponse-submission')
    if (field) submissions.push(JSON.parse(Buffer.from(field, 'base64').toString('utf8')))
  })
  await page.goto(options.url + '/', { waitUntil: 'networkidle' })
  const ready = () => page.waitForFunction(() => window.SketchInput?.instances['paper-v'] && document.getElementById('paper-v-star-photo-btn'))
  await ready()
  await page.evaluate(() => { window.__fitCalls = 0; window.StarFit.fit = window.StarFit.sampleCurve = () => { window.__fitCalls++; throw new Error('No equation fitting in rehearsal') } })
  const state = () => page.evaluate(() => JSON.parse(window.SketchInput.instances['paper-v'].getState()))
  const c = options.cases[0]
  const container = page.locator('#paper-v-si-container'); const svg = page.locator('#paper-v-si-canvas')
  await container.getByText('Other marks', { exact: true }).click(); await svg.scrollIntoViewIfNeeded()
  const initialBox = await svg.boundingBox(); await page.mouse.click(initialBox.x + initialBox.width * 0.8, initialBox.y + initialBox.height * 0.15)
  const initial = await state()
  check(initial.data['paper-notes'].length === 1, 'Recovery starts with a real existing native point')
  const open = () => page.locator('#paper-v-star-photo-btn').click()
  const panel = page.locator('#paper-v-star-panel'); const canvas = panel.locator('.star-canvas')
  const upload = async item => {
    await panel.locator('input[type=file]').setInputFiles(item.file)
    await panel.locator('.star-status').filter({ hasText: 'Place the axes, then trace your curve.' }).waitFor()
  }
  const draw = async (points, size = c.image_size) => {
    await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox()
    const screen = p => [box.x + p[0] * box.width / size[0], box.y + p[1] * box.height / size[1]]
    await page.mouse.move(...screen(points[0])); await page.mouse.down()
    for (let i = 1; i < points.length; i++) await page.mouse.move(...screen(points[i]), { steps: Math.max(2, Math.ceil(Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]) / 4)) })
    await page.mouse.up()
  }
  const calibrate = async () => {
    const [w, h] = c.image_size
    for (const [name, position] of [['x_marker', [w * 0.75, h * 0.55]], ['y_marker', [w * 0.5, h * 0.3]], ['origin', [w * 0.5, h * 0.55]]]) await draw([position, c.calibration[name]])
    await panel.locator('.star-xval').fill(String(c.calibration.x_value)); await panel.locator('.star-yval').fill(String(c.calibration.y_value))
  }
  const trace = async () => {
    await panel.locator('.star-next').click()
    for (const stroke of c.pointer_strokes) await draw(stroke)
    await panel.locator('.star-use').click(); await panel.locator('.star-manual-ack').check()
  }
  await open(); await upload(c); await calibrate(); await trace()
  check(await panel.locator('.star-confirm').isEnabled(), 'A reviewed photo is ready before rejection/replacement')
  await panel.locator('[id$="-star-close"]').click()
  check(JSON.stringify((await state()).data) === JSON.stringify(initial.data), 'Closing without confirmation rejects import without native mutation')
  await open(); await panel.locator('.star-mode-photo').click(); await upload(options.cases[1])
  check(await panel.locator('.star-confirm').isDisabled() && !(await panel.locator('.star-manual-ack').isChecked()), 'Replacing a reviewed photograph clears the proposal and acknowledgment')
  check((await panel.locator('.star-branch-count').textContent()).includes('No branches'), 'Replacement starts with no old traced branches')
  check(await panel.locator('.star-legend-preview').isHidden(), 'Replacement removes the old orange reconstruction')
  await panel.locator('.star-confirm').dispatchEvent('click')
  check(JSON.stringify((await state()).data) === JSON.stringify(initial.data), 'Replaced proposal cannot be forced onto the native canvas')
  await panel.screenshot({ path: options.output + '/replaced-photo--reset.png' })
  await panel.locator('input[type=file]').setInputFiles({ name: 'invalid-photo.png', mimeType: 'image/png', buffer: Buffer.from('offline deliberately invalid image bytes') })
  await panel.locator('.star-status').filter({ hasText: 'Could not read that image.' }).waitFor()
  check(await canvas.isHidden() && await panel.locator('.star-confirm').isDisabled(), 'Invalid photo is rejected and cannot retain the previous bitmap/proposal')
  await panel.locator('.star-confirm').dispatchEvent('click')
  check(JSON.stringify((await state()).data) === JSON.stringify(initial.data), 'Invalid photo rejection preserves existing native objects')
  await panel.screenshot({ path: options.output + '/invalid-photo--rejected.png' })
  await upload(c); await calibrate()
  const midpoint = c.calibration.origin.map((v, i) => (v + c.calibration.x_marker[i]) / 2)
  await draw([c.calibration.y_marker, midpoint])
  check(await panel.locator('.star-next').isDisabled() && await panel.locator('.star-axis-error').isVisible(), 'Collinear manual axis references block tracing/import')
  check(JSON.stringify((await state()).data) === JSON.stringify(initial.data), 'Ambiguous calibration preserves the existing canvas')
  await panel.screenshot({ path: options.output + '/ambiguous-calibration--blocked.png' })
  await draw([midpoint, c.calibration.y_marker]); await trace()
  check(await panel.locator('.star-confirm').isEnabled(), 'Correcting the axes recovers a fresh reviewed proposal after invalid/replaced photos')
  check(await page.evaluate(() => window.__fitCalls) === 0, 'Failure/recovery uses no equation fitting')
  await panel.locator('.star-confirm').click()
  await page.waitForFunction(() => window.SketchInput.instances['paper-v'] && JSON.parse(window.SketchInput.instances['paper-v'].getState()).data['paper-ink'].length === 1)
  const recovered = await state()
  check(JSON.stringify(recovered.data['paper-notes']) === JSON.stringify(initial.data['paper-notes']), 'Recovered import retains the original native point')
  await page.getByRole('button', { name: 'Save & Grade', exact: true }).click(); await page.waitForLoadState('networkidle'); await ready()
  check(submissions.length === 1 && JSON.stringify(submissions[0].data) === JSON.stringify(recovered.data), 'Recovered attempt is actually submitted without geometry/object changes')
  const savedUrl = page.url()
  await page.reload({ waitUntil: 'networkidle' }); await ready()
  check(JSON.stringify((await state()).data) === JSON.stringify(recovered.data), 'Recovered saved attempt restores through browser refresh')
  await open(); await upload(c); await calibrate(); await trace()
  check(await panel.locator('.star-confirm').isEnabled(), 'A second photo proposal exists but remains unsubmitted before refresh')
  await page.reload({ waitUntil: 'networkidle' }); await ready()
  const refreshed = await state()
  check(JSON.stringify(refreshed.data) === JSON.stringify(recovered.data), 'Refresh during unconfirmed review restores only the last saved native attempt')
  await open()
  check(await canvas.isHidden() && await panel.locator('.star-confirm').isDisabled() && !(await panel.locator('.star-manual-ack').isChecked()), 'Refresh clears ephemeral photo/trace/review state and prevents stale import')
  await panel.screenshot({ path: options.output + '/refresh-review--cleared.png' })
  await panel.locator('[id$="-star-close"]').click()
  await container.screenshot({ path: options.output + '/recovery-native--restored.png' })
  check(errors.length === 0, 'No application JavaScript exception in failure/recovery cases')
  return { passed: checks.length, checks, consoleErrors: errors, savedUrl, initial, recovered, submitted: submissions[0], refreshed,
    refresh_policy: 'Only submitted native geometry persists; unsaved photos, calibration and traces must be uploaded/entered again.' }
}
async function offlineBackup (page, options) {
  const checks = []; const errors = []; const network = []
  const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label) }
  page.on('pageerror', e => errors.push(String(e)))
  page.on('request', r => { if (/^https?:/.test(r.url())) network.push(r.url()) })
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    return url.origin === new URL(options.backupUrl).origin || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort()
  })
  await page.goto(options.backupUrl, { waitUntil: 'load' })
  const initialRequests = network.length
  await page.context().setOffline(true)
  check((await page.title()).includes('Recorded assisted graph demo'), 'Standalone recorded backup loads through the isolated local viewer, then browser goes offline')
  check((await page.locator('body').innerText()).includes('No live recognition or grading runs here'), 'Backup is explicitly labeled as recorded evidence')
  check(await page.locator('script').count() === 0, 'Backup contains no JavaScript or live PrairieLearn dependency')
  check(await page.locator('img').evaluateAll(images => images.length >= 10 && images.every(im => im.complete && im.naturalWidth > 0)), 'Every embedded original/review/native/graded/restored image loads offline')
  check(await page.locator('a[download$=".json"]').count() === 2, 'Both native original/edited evidence records are available offline')
  for (let i = 0; i < 2; i++) {
    const pending = page.waitForEvent('download')
    await page.locator('a[download$=".json"]').nth(i).click()
    const download = await pending; const stream = await download.createReadStream(); const chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    const record = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    check(record.method === 'fully_manually_traced' && record.image_sha256 === options.cases[i].sha256 &&
      JSON.stringify(record.original.native.data) === JSON.stringify(record.original.restored.data) &&
      JSON.stringify(record.edited.native.data) === JSON.stringify(record.edited.restored.data), 'Offline native JSON download validates for ' + options.cases[i].id)
  }
  await page.getByRole('link', { name: 'Separate branches', exact: true }).click()
  check(page.url().endsWith('#real--01'), 'Offline presenter navigation works')
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.screenshot({ path: options.output + '/offline-backup--desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Standalone backup has no mobile horizontal overflow')
  await page.screenshot({ path: options.output + '/offline-backup--mobile.png' })
  check(network.length === initialRequests && network.every(url => url === options.backupUrl) && !errors.length, 'Offline interactions make no additional HTTP requests and have no JavaScript errors')
  return { passed: checks.length, checks, consoleErrors: errors, http_requests: network, mode: 'Isolated localhost document load, then browser offline; static recorded walkthrough; no live grade', direct_file_navigation: 'blocked by automation policy; not tested' }
}
if (require.main === module) {
  const root = path.resolve(__dirname, '../benchmarks/photo-graphs/multi-method/step-4d')
  const source = path.resolve(root, '../step-4c')
  const input = JSON.parse(fs.readFileSync(path.join(source, 'operator-actions.json')))
  const options = { url: process.env.STAR_ASSISTED_TEST_URL || 'http://localhost:3000/pl/course/1/question/255/preview', output: process.env.PL_PHOTO_TEST_OUTPUT || '/private/tmp/star-step4d/rehearsal', seedExistingObjects: true, skipLegacyComparison: true,
    cases: input.cases.map(c => ({ ...c, file: path.resolve(source, c.image) })), backupUrl: 'http://127.0.0.1:3019/offline-backup.html' }
  fs.mkdirSync(options.output, { recursive: true })
  const backup = process.argv.includes('--backup')
  const cli = process.env.PL_PHOTO_TEST_CLI || '/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh'
  const env = { ...process.env }; delete env.GEMINI_API_KEY; delete env.GOOGLE_API_KEY
  function run (args) {
    const r = spawnSync(cli, ['-s=star-demo-step4d', ...args], { cwd: '/private/tmp', env, encoding: 'utf8', timeout: 300000, maxBuffer: 32 * 1024 * 1024 })
    const text = (r.stdout || '') + (r.stderr || '')
    fs.appendFileSync(path.join(options.output, 'browser-cli.log'), '$ playwright-cli ' + args[0] + '\n' + text + '\n')
    if (r.error || r.status !== 0 || text.includes('### Error')) throw new Error(text.slice(-3500))
    if (args[0] === 'run-code') {
      const raw = text.split('### Result\n')[1]?.split('\n###')[0]; if (!raw) throw new Error('Browser evidence missing')
      const record = JSON.parse(raw)
      fs.writeFileSync(path.join(options.output, backup ? 'offline-backup-check.json' : 'rehearsal.json'), JSON.stringify(record, null, 2) + '\n')
      console.log((backup ? 'Offline backup' : 'Step4D rehearsal') + ' assertions passed: ' + record.passed)
    }
  }
  try {
    run(['open', backup ? options.backupUrl : options.url, '--browser', 'chrome']); run(['snapshot'])
    const code = backup ? 'return await (' + offlineBackup.toString() + ')(page, options)' :
      '{ const rehearsal = await (' + acceptance.toString() + ')(page, options); const failures = await (' + recovery.toString() + ')(page, options); if (rehearsal.consoleErrors.length || rehearsal.blockedExternalHosts.length) throw new Error("Unexpected application/network error"); return { passed: rehearsal.passed + failures.passed, rehearsal, failures }; }'
    run(['run-code', 'async page => { const options = ' + JSON.stringify(options) + '; ' + code + ' }'])
  } catch (error) { console.error(error.message); process.exitCode = 1 } finally { try { run(['close']) } catch (_) {} }
}
module.exports = { recovery, offlineBackup }
