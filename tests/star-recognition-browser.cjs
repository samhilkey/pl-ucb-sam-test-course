// Existing Playwright CLI style; evidence viewer only, not native integration.
const { spawnSync } = require('node:child_process')
const { mkdirSync, writeFileSync } = require('node:fs')
const { resolve } = require('node:path')
async function checkRecognition (page, options) {
  const checks = []; const errors = []; const warnings = []
  const check = (condition, name) => { if (!condition) throw new Error(name); checks.push(name) }
  page.on('pageerror', error => errors.push(String(error)))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text()) })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(options.url, { waitUntil: 'networkidle' })
  check((await page.title()).includes('Step 2 evidence') && page.url().startsWith(options.url), 'Correct evidence page and title')
  await page.getByRole('heading', { name: 'Automatic extraction: pixels to geometry', exact: true }).waitFor()
  check(await page.locator('article').count() === 10, 'All ten recorded cases render')
  check((await page.locator('#summary').textContent()).includes('4/4 supported controlled'), 'Recorded successes are separated from real photos and challenges')
  await page.evaluate(async () => {
    const images = [...document.images]
    images.forEach(i => { i.loading = 'eager' })
    await Promise.all(images.map(i => i.decode()))
  })
  check(await page.locator('img').evaluateAll(imgs => imgs.length === 30 && imgs.every(i => i.naturalWidth > 0)), 'All 30 original/overlay/proposal images decode')
  await page.screenshot({ path: options.output + '/desktop-gallery.png' })
  for (const [id, status, count] of [['line', 'automatic', 1], ['sharp-v', 'automatic', 1], ['two-branches', 'automatic', 2], ['ambiguous-axes', 'needs_review', 5], ['real--01-multiple-lines-graph-paper', 'abstained', 0]]) {
    await page.getByRole('button', { name: 'Re-run ' + id, exact: true }).click()
    await page.waitForFunction(id => window.latestRecognition && document.getElementById('live-status').textContent.startsWith(id + ':'), id)
    const actual = await page.evaluate(() => window.latestRecognition)
    check(actual.status === status && actual.strokes.length === count, id + ': browser Canvas extraction matches recorded status/count')
    const recorded = await page.evaluate(async id => (await fetch('results/' + id + '.geometry.json')).json(), id)
    actual.input_revision = recorded.input_revision
    check(JSON.stringify(actual) === JSON.stringify(recorded), id + ': browser-decoded pixels yield the same structured geometry as Node')
    check(await page.locator('#download').isVisible(), id + ': validated geometry can be downloaded')
    if (id === 'sharp-v') await page.locator('#live').screenshot({ path: options.output + '/desktop-v-recognition.png' })
    if (id === 'ambiguous-axes') check(actual.strokes.every(s => s.vertices.every(v => v.graph === null)), 'Ambiguous browser result keeps graph coordinates unknown')
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Re-run two-branches', exact: true }).click()
  await page.waitForFunction(() => document.getElementById('live-status').textContent.startsWith('two-branches: automatic'))
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile has no horizontal overflow')
  await page.locator('#live').screenshot({ path: options.output + '/mobile-two-branches.png' })
  check(errors.length === 0, 'No page or application console errors')
  check(warnings.length === 0, 'No browser warnings in standalone recognizer viewer')
  return { passed: checks.length, checks, consoleErrors: errors, consoleWarnings: warnings, nativeImport: 'untested_step_3' }
}
const options = { url: process.env.STAR_RECOGNITION_URL || 'http://127.0.0.1:8765/', output: resolve(process.env.PL_PHOTO_TEST_OUTPUT || '/tmp/star-recognition-browser') }
mkdirSync(options.output, { recursive: true })
const cli = process.env.PL_PHOTO_TEST_CLI || 'playwright-cli'
function run (args) {
  const r = spawnSync(cli, ['-s=star-recognition-step2', ...args], { encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 })
  const output = (r.stdout || '') + (r.stderr || '')
  if (args[0] !== 'snapshot') process.stdout.write(output.split('### Ran Playwright code')[0])
  if (r.error || r.status !== 0 || output.includes('### Error')) throw r.error || new Error('Recognition browser check failed')
  if (args[0] === 'run-code') {
    const json = output.split('### Result\n')[1]?.split('\n###')[0]
    if (json) writeFileSync(options.output + '/results.json', JSON.stringify(JSON.parse(json), null, 2) + '\n')
  }
}
try {
  run(['open', options.url, '--browser', 'chrome']); run(['snapshot'])
  run(['run-code', 'async (page) => (' + checkRecognition.toString() + ')(page, ' + JSON.stringify(options) + ')'])
} catch (error) { console.error(error.message); process.exitCode = 1 } finally { run(['close']) }
