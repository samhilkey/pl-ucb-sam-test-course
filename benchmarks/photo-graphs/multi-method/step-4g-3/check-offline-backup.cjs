// Replay the unchanged independent package viewer, then disable browser network.
const fs = require('node:fs'); const path = require('node:path'); const { spawnSync } = require('node:child_process')
async function checkBackup (page, o) {
  const checks = []; const errors = []; const http = []
  const check = (ok, label) => { if (!ok) throw Error(label); checks.push(label) }
  page.on('pageerror', e => errors.push(String(e))); page.on('request', r => { if (/^https?:/.test(r.url())) http.push(r.url()) })
  await page.route('**/*', route => { const u = new URL(route.request().url()); return u.origin === 'http://127.0.0.1:3020' || ['data:', 'blob:'].includes(u.protocol) ? route.continue() : route.abort() })
  await page.goto(o.url, { waitUntil: 'load' }); const initialRequests = http.length; await page.context().setOffline(true)
  check((await page.title()).includes('recorded acceptance backup'), 'Unchanged recorded backup loads from the independent local viewer; browser network is then disabled')
  check((await page.locator('body').innerText()).includes('No live recognition or grading runs here'), 'Recorded/manual method disclosure is visible')
  check(await page.locator('img').evaluateAll(images => images.length === 12 && images.every(im => im.complete && im.naturalWidth > 0)), 'All twelve embedded photographs and review/native/restoration screenshots load offline')
  for (let i = 0; i < 2; i++) {
    const pending = page.waitForEvent('download'); await page.locator('a[download]').nth(i).click(); const download = await pending; const stream = await download.createReadStream(); const chunks = []
    for await (const part of stream) chunks.push(part)
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    check(value.geometry.provenance.method === 'manual_trace' && JSON.stringify(value.original.submitted.data) === JSON.stringify(value.original.restored.state.data), 'Offline native JSON download retains recorded submitted/restored data: case ' + (i + 1))
  }
  await page.getByRole('link', { name: 'Disconnected branches', exact: true }).click()
  check(page.url().endsWith('#real--01-multiple-lines-graph-paper'), 'Offline backup case navigation works')
  await page.setViewportSize({ width: 1280, height: 720 }); await page.screenshot({ path: o.output + '/offline-backup.png' })
  check(http.length === initialRequests && http.every(u => u.startsWith('http://127.0.0.1:3020/')) && errors.length === 0, 'Offline interactions need no further HTTP, primary-service or external requests; no page exceptions')
  return { passed: checks.length, checks, http, errors, browser_network: 'offline after initial independent-viewer load', initial_http_requests: initialRequests, offline_interaction_http_requests: http.length - initialRequests, primary_service: 'Not stopped or contacted; all primary-service and external routes blocked in this browser', source_package: 'Unchanged Step4F recorded manually assisted acceptance, not live recognition/grading' }
}
const options = { url: 'http://127.0.0.1:3020/backup', output: path.resolve(process.env.PL_PHOTO_TEST_OUTPUT || '/private/tmp/star-step4g3/backup') }; fs.mkdirSync(options.output, { recursive: true })
const cli = process.env.PL_PHOTO_TEST_CLI || 'playwright-cli'
function run (args) {
  const r = spawnSync(cli, ['-s=star-g3-backup', ...args], { cwd: '/private/tmp', encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024 }); const s = (r.stdout || '') + (r.stderr || '')
  if (r.error || r.status !== 0 || s.includes('### Error')) throw r.error || Error(s.slice(-3000))
  if (args[0] === 'run-code') { const result = JSON.parse(s.split('### Result\n')[1].split('\n###')[0]); fs.writeFileSync(options.output + '/results.json', JSON.stringify(result, null, 2) + '\n'); console.log('Offline backup assertions passed: ' + result.passed) }
}
try { run(['open', 'about:blank', '--browser', 'chrome']); run(['snapshot']); run(['run-code', 'async page => (' + checkBackup.toString() + ')(page, ' + JSON.stringify(options) + ')']) } catch (e) { console.error(e.message); process.exitCode = 1 } finally { try { run(['close']) } catch (_) {} }
