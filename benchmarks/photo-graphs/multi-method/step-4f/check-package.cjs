const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
async function checkRestoration (page, options) {
  const checks = []
  for (const c of options.restoreCases) {
    await page.goto(c.url, { waitUntil: 'networkidle' })
    await page.waitForFunction(n => window.SketchInput?.instances['paper-lines'] && document.querySelectorAll('#paper-lines-si-canvas path.plugin-id-paper-ink').length === n, c.data['paper-ink'].length)
    if (!(await page.title()).includes('star-assisted-photo-demo')) throw new Error('Wrong restored question')
    const data = await page.evaluate(() => JSON.parse(window.SketchInput.instances['paper-lines'].getState()).data)
    if (JSON.stringify(data) !== JSON.stringify(c.data)) throw new Error('Saved geometry/points changed across container restart: ' + c.id)
    checks.push(c.id + ': exact submitted geometry and points survive local service/database restart')
    await page.locator('#paper-lines-si-container').screenshot({ path: options.output + '/' + c.id + '--after-service-restart.png' })
  }
  return { passed: checks.length, checks, primary_service_restored: true }
}
async function checkPackage (page, options) {
  const checks = []; const errors = []; const requests = []
  const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label) }
  page.on('pageerror', e => errors.push(String(e)))
  page.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()) })
  let primaryUnavailable = false
  try { await page.request.get('http://127.0.0.1:3000/pl/course/1/question/255/preview/', { timeout: 2500 }) } catch (_) { primaryUnavailable = true }
  check(primaryUnavailable, 'Primary PrairieLearn service is actually unavailable during backup acceptance')
  await page.route('**/*', route => {
    const u = new URL(route.request().url())
    return u.origin === 'http://127.0.0.1:3020' || ['data:', 'blob:'].includes(u.protocol) ? route.continue() : route.abort()
  })
  await page.goto('http://127.0.0.1:3020/backup', { waitUntil: 'load' })
  check((await page.title()).includes('recorded acceptance backup'), 'Independent recorded backup loads with primary service stopped')
  check((await page.locator('body').innerText()).includes('No live recognition or grading runs here'), 'Recorded backup has explicit method/grade disclosure')
  check(await page.locator('img').evaluateAll(images => images.length === 12 && images.every(p => p.complete && p.naturalWidth > 0)), 'All twelve original/review/native/edit/restoration images load without primary service')
  const requestsAtLoad = requests.length
  await page.context().setOffline(true)
  for (let i = 0; i < 2; i++) {
    const pending = page.waitForEvent('download'); await page.locator('a[download]').nth(i).click()
    const download = await pending; const stream = await download.createReadStream(); const chunks = []
    for await (const c of stream) chunks.push(c)
    const record = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    check(record.geometry.provenance.method === 'manual_trace' && JSON.stringify(record.original.submitted.data) === JSON.stringify(record.original.restored.state.data), 'Recorded native JSON download validates offline for case ' + (i + 1))
  }
  await page.getByRole('link', { name: 'Disconnected branches', exact: true }).click()
  check(page.url().endsWith('#real--01-multiple-lines-graph-paper'), 'Recorded backup navigation works with browser offline')
  check(requests.length === requestsAtLoad, 'Backup interactions and downloads require no additional HTTP request')
  await page.screenshot({ path: options.output + '/backup-primary-stopped.png', fullPage: true })
  await page.context().setOffline(false)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('http://127.0.0.1:3020/presentation', { waitUntil: 'load' })
  check(await page.locator('article').count() === 6, 'Six-slide presentation loads independently of primary service')
  const layouts = []
  for (let i = 1; i <= 6; i++) {
    const slide = page.locator('#slide-' + i); await slide.scrollIntoViewIfNeeded()
    const layout = await slide.evaluate(a => {
      const frame = a.getBoundingClientRect()
      const text = [...a.querySelectorAll('h1,p,li,td,th,figcaption')].filter(e => !e.closest('details')).map(e => {
        const r = e.getBoundingClientRect(); return { text: e.textContent, font: parseFloat(getComputedStyle(e).fontSize), fits: r.left >= frame.left && r.right <= frame.right + 1 && r.bottom <= frame.bottom - 20 }
      })
      return { width: frame.width, height: frame.height, text, imagesLoaded: [...a.querySelectorAll('img')].every(im => im.complete && im.naturalWidth > 0) }
    })
    layouts.push(layout)
    check(layout.imagesLoaded && layout.text.every(t => t.fits), 'Slide ' + i + ': images loaded and text remains within the presentation frame')
    await slide.screenshot({ path: options.output + '/slide-' + i + '.png' })
  }
  await page.pdf({ path: options.pdf, width: '1280px', height: '720px', preferCSSPageSize: true, printBackground: true })
  check(true, 'Browser exports the local presentation as a printable PDF')
  await page.setViewportSize({ width: 1920, height: 1080 }); await page.locator('#slide-1').scrollIntoViewIfNeeded()
  const fitted = await page.locator('#slide-1').boundingBox()
  check(Math.abs(fitted.width - 1920) < 1 && Math.abs(fitted.height - 1080) < 1, 'Presentation scales to one complete slide at 1920x1080')
  await page.screenshot({ path: options.output + '/presentation-1920.png' })
  await page.keyboard.press('ArrowRight')
  const next = await page.locator('#slide-2').boundingBox()
  check(Math.abs(next.y) < 1, 'Presentation keyboard advances exactly one slide at full-screen size')
  for (const route of ['/.env.local', '/.env.example', '/serve-package.cjs', '/../.env.local']) {
    const response = await page.request.get('http://127.0.0.1:3020' + route); check(response.status() === 404, 'Viewer refuses private/repository path ' + route)
  }
  check(errors.length === 0 && requests.every(u => u.startsWith('http://127.0.0.1:3020/')), 'Package uses no primary/external service and has no application exceptions')
  return { passed: checks.length, checks, primary_service_unavailable: primaryUnavailable, layouts, errors, http_requests: requests, physical_projector_readability: 'not tested; viewport/layout checks only' }
}
if (require.main === module) {
  const options = { output: '/private/tmp/star-step4f/package-check', pdf: path.join(__dirname, 'presentation.pdf') }; fs.mkdirSync(options.output, { recursive: true })
  const restoration = process.argv.includes('--primary-restoration')
  if (restoration) options.restoreCases = JSON.parse(fs.readFileSync(path.join(__dirname, 'results/acceptance.json'))).outcomes.map(o => ({ id: o.id + '--' + o.trial, url: o.finalSaved.url, data: o.finalSaved.restored.state.data }))
  const env = { ...process.env }; delete env.GEMINI_API_KEY; delete env.GOOGLE_API_KEY
  const cli = '/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh'
  const run = args => {
    const r = spawnSync(cli, ['-s=star-package-step4f', ...args], { cwd: '/private/tmp', env, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 })
    const output = (r.stdout || '') + (r.stderr || ''); fs.appendFileSync(options.output + '/browser-cli.log', '$ playwright-cli ' + args[0] + '\n' + output + '\n')
    if (r.error || r.status !== 0 || output.includes('### Error')) throw new Error(output.slice(-4500))
    if (args[0] === 'run-code') { const record = JSON.parse(output.split('### Result\n')[1].split('\n###')[0]); fs.writeFileSync(options.output + (restoration ? '/primary-restoration.json' : '/package-check.json'), JSON.stringify(record, null, 2) + '\n'); console.log((restoration ? 'Post-restart restoration' : 'Package/primary-down') + ' assertions passed: ' + record.passed) }
  }
  try { run(['open', restoration ? options.restoreCases[0].url : 'http://127.0.0.1:3020/backup', '--browser', 'chrome']); run(['snapshot']); run(['run-code', 'async page => (' + (restoration ? checkRestoration : checkPackage).toString() + ')(page, ' + JSON.stringify(options) + ')']) } catch (e) { console.error(e.message); process.exitCode = 1 } finally { try { run(['close']) } catch (_) {} }
}
module.exports = { checkPackage }
