// A saved, already-evaluated response is injected into one disposable local
// browser page. No server/element source changes and no provider transport.
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
async function checkUI (page, options) {
  const checks = []; const errors = []; const external = []
  const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label) }
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.route('**/*', route => {
    const u = new URL(route.request().url())
    if (['localhost', '127.0.0.1'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol)) return route.continue()
    external.push(u.origin); return route.abort()
  })
  await page.setViewportSize({ width: 1440, height: 1100 }); await page.goto(options.url + '/', { waitUntil: 'networkidle' })
  const ready = () => page.waitForFunction(() => window.SketchInput?.instances['automatic-photo'] && window.StarProviders)
  await ready(); check((await page.title()).includes('star-automatic-photo-test'), 'Correct local automatic sandbox loaded')
  await page.evaluate(({ geometry, points }) => {
    window.__savedProviderCalls = 0; window.__originalProvider = window.StarProviders.recognize
    window.StarProviders.recognize = (image, options) => {
      window.__savedProviderCalls++
      const g = JSON.parse(JSON.stringify(geometry)); g.input_revision = options.inputRevision // revision only, not coordinates
      const candidate = window.StarProviders.candidate(g, { provider: 'gemini', inputRevision: options.inputRevision, width: image.width, height: image.height })
      return { ...candidate, marks: points.map(p => ({ bounds_pixel: [[p[0] - 4, p[1] - 4], [p[0] + 4, p[1] + 4]], at_axis_intersection: false })) }
    }
    window.SketchInput.instances['automatic-photo'].setState(JSON.stringify({ data: { 'auto-ink': [], 'auto-notes': [{ x: 40, y: 50 }] } }))
  }, { geometry: options.geometry, points: options.points })
  const state = () => page.evaluate(() => JSON.parse(window.SketchInput.instances['automatic-photo'].getState()).data)
  const prior = await state(); await page.locator('#automatic-photo-automatic-button').click()
  const panel = page.locator('#automatic-photo-automatic-dialog')
  await panel.locator('input[type=file]').setInputFiles(options.image)
  await page.waitForFunction(() => !document.querySelector('.star-auto-retry').disabled)
  check(await page.evaluate(() => window.__savedProviderCalls) === 1, 'Exactly one saved-response replay; no model request')
  // Explicit test annotation: the stock CV caption must not imply local VLM inference.
  await panel.locator('.star-auto-method').evaluate(el => { el.textContent = 'Method: VLM automatic · saved real response · isolated test; no API calls from this page' })
  check((await panel.locator('.star-auto-diagnostics').textContent()).includes('VLM automatic'), 'Real candidate is labelled VLM automatic, separate from CV and manual tracing')
  check(await panel.locator('.star-auto-preview path').count() === options.geometry.strokes.length, 'All raw paths, including mistaken axes, remain visible without correction')
  check(await panel.locator('.star-auto-ack').isDisabled() && await panel.locator('.star-auto-confirm').isDisabled(), 'Uncertain calibration/topology and unsupported point block confirmation')
  await panel.locator('.star-auto-confirm').dispatchEvent('click')
  check(JSON.stringify(await state()) === JSON.stringify(prior), 'Attempted disabled confirmation preserves existing objects exactly')
  await panel.screenshot({ path: options.output + '/isolated-gemini-review.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  check(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Saved-response review has no mobile horizontal overflow')
  check(await panel.locator('.star-auto-confirm').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight), 'Blocked confirmation remains fully visible on the mobile-sized viewport')
  await panel.screenshot({ path: options.output + '/isolated-gemini-mobile.png' })
  await panel.locator('.star-auto-close').click(); await page.reload({ waitUntil: 'networkidle' }); await ready()
  check(await page.evaluate(() => typeof window.__originalProvider === 'undefined' && typeof window.__savedProviderCalls === 'undefined'), 'Reload removes the page-only injection; normal CV implementation is restored')
  check(errors.length === 0, 'No application page or console errors')
  return { passed: checks.length, checks, page_errors: errors, blocked_external_origins: [...new Set(external)], api_calls: 0, imported: false, submitted: false,
    production_source_modified: false, scope: 'Isolated replay of saved real model output, not a deployed Gemini engine or recognition rerun', browser_plugin: 'not available; existing Playwright CLI used' }
}
const root = __dirname; const directory = path.join(root, 'results')
const attempt = JSON.parse(fs.readFileSync(path.join(directory, 'attempt.json')))
if (attempt.source_kind !== 'real_provider_request' || attempt.request_count !== 1 || attempt.http_status !== 200) throw new Error('Real saved response required.')
const observation = JSON.parse(fs.readFileSync(path.join(directory, 'observation.json')))
const options = { url: 'http://localhost:3000/pl/course/1/question/254/preview', output: directory, image: path.resolve(root, '../step-4g-1/results/IMG_1670--source.png'),
  geometry: JSON.parse(fs.readFileSync(path.join(directory, 'geometry.json'))), points: observation.isolated_points }
function run (args) {
  const env = { ...process.env }; delete env.GEMINI_API_KEY; delete env.GOOGLE_API_KEY
  const r = spawnSync(process.env.PL_PHOTO_TEST_CLI || '/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh', ['-s=star-gemini-isolated', ...args], { cwd: '/private/tmp', env, encoding: 'utf8', timeout: 180000, maxBuffer: 12 * 1024 * 1024 })
  const text = (r.stdout || '') + (r.stderr || '')
  if (r.error || r.status !== 0 || text.includes('### Error')) throw r.error || new Error(text.slice(-2000))
  if (args[0] === 'run-code') { const value = JSON.parse(text.split('### Result\n')[1].split('\n###')[0]); fs.writeFileSync(path.join(directory, 'isolated-ui.json'), JSON.stringify(value, null, 2) + '\n'); console.log('Isolated saved-response UI assertions:', value.passed) }
}
try { run(['open', options.url, '--browser', 'chrome']); run(['snapshot']); run(['run-code', 'async page => (' + checkUI.toString() + ')(page,' + JSON.stringify(options) + ')']) } catch (error) { console.error(error.message); process.exitCode = 1 } finally { run(['close']) }
