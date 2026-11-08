// Historical UI evidence only: serve read-only parent assets in this browser.
// No checkout, branch update, filesystem asset replacement or external model.
const { execFileSync, spawnSync } = require('node:child_process')
const fs = require('node:fs'); const path = require('node:path')
const base = 'd1cb0fc4e8d3637535b2d6c3a70c6b60404f9faa'; const root = path.resolve(__dirname, '../../../..')
const assets = Object.fromEntries(['star-automatic.js', 'star-cv-assisted.js', 'pl-sketch.css'].map(name => [name, execFileSync('git', ['show', base + ':elements/pl-sketch/' + name], { cwd: root, encoding: 'utf8' })]))
const options = { output: path.resolve(process.env.PL_PHOTO_TEST_OUTPUT || '/private/tmp/star-step4g3-refinement/before'), photo: root + '/benchmarks/photo-graphs/multi-method/step-4g-1/results/IMG_1670--source.png', assets }
fs.mkdirSync(options.output, { recursive: true }); const cli = process.env.PL_PHOTO_TEST_CLI || 'playwright-cli'
async function capture (page, o) {
  const errors = []; page.on('pageerror', e => errors.push(String(e)))
  const observed = await page.evaluate(() => [...document.scripts].map(s => s.src).concat([...document.querySelectorAll('link[rel=stylesheet]')].map(s => s.href)).filter(Boolean))
  for (const [name, body] of Object.entries(o.assets)) {
    const url = observed.find(u => new URL(u).pathname.endsWith('/' + name)); if (!url) throw Error('Baseline asset route not observed: ' + name)
    await page.route(url, r => r.fulfill({ status: 200, contentType: name.endsWith('.css') ? 'text/css' : 'text/javascript', body }))
  }
  await page.reload({ waitUntil: 'networkidle' }); await page.setViewportSize({ width: 1440, height: 1100 }); await page.waitForFunction(() => window.SketchInput?.instances['automatic-photo'])
  await page.locator('#automatic-photo-automatic-button').click(); const p = page.locator('#automatic-photo-automatic-dialog')
  await p.locator('input[type=file]').setInputFiles(o.photo); await page.waitForFunction(() => !document.querySelector('.star-auto-retry').disabled)
  const centering = await p.evaluate(e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); const marginRules = []
    const scan = (rules, source) => { for (const rule of rules) { if (rule.cssRules) { if (!rule.conditionText || !rule.constructor.name.includes('Media') || matchMedia(rule.conditionText).matches) scan(rule.cssRules, source) } else if (rule.selectorText && rule.style && rule.style.getPropertyValue('margin')) { try { if (e.matches(rule.selectorText)) marginRules.push({ source, selector: rule.selectorText, margin: rule.style.getPropertyValue('margin') }) } catch (_) {} } } }
    for (const sheet of document.styleSheets) try { scan(sheet.cssRules, sheet.href ? new URL(sheet.href).pathname : 'inline') } catch (_) {}
    return { marginRules, x: r.x, y: r.y, width: r.width, height: r.height, vw: innerWidth, vh: innerHeight, position: s.position, inset: s.inset, margin: s.margin, maxHeight: s.maxHeight } })
  await page.screenshot({ path: o.output + '/before-centered-desktop.png' }); await p.locator('.star-auto-next').click()
  for (const [name, xy] of [['origin', [782, 786]], ['xMarker', [1229, 775]], ['yMarker', [751, 300]]]) {
    await p.locator(`[data-marker="${name}"]`).click(); const c = p.locator('.star-auto-photo'); await c.scrollIntoViewIfNeeded(); const b = await c.boundingBox(); await page.mouse.click(b.x + xy[0] * b.width / 1688, b.y + xy[1] * b.height / 1473)
  }
  await p.locator('.star-auto-x-value').fill('3'); await p.locator('.star-auto-y-value').fill('3'); await p.locator('.star-auto-body').evaluate(e => { e.scrollTop = 0 })
  await p.screenshot({ path: o.output + '/before-calibration-checkbox.png' }); await p.locator('.star-auto-calibration-ack').check(); await p.locator('.star-auto-next').click()
  await p.locator('.star-auto-selection').scrollIntoViewIfNeeded(); await p.screenshot({ path: o.output + '/before-fragment-point-review.png' })
  if (errors.length) throw Error(errors.join('; '))
  return { historical_assets_loaded_read_only: true, all_three_baseline_assets_observed: true, centering, errors, includes_original_redundant_checkboxes: true }
}
function run (args) {
  const r = spawnSync(cli, ['-s=star-refine-before-frozen', ...args], { cwd: '/private/tmp', encoding: 'utf8', timeout: 180000, maxBuffer: 4 * 1024 * 1024 }); const s = (r.stdout || '') + (r.stderr || '')
  if (r.error || r.status !== 0 || s.includes('### Error')) throw r.error || Error(s.slice(-3500))
  if (args[0] === 'run-code') { const result = JSON.parse(s.split('### Result\n')[1].split('\n###')[0]); fs.writeFileSync(options.output + '/before-layout.json', JSON.stringify({ parent_commit: base, ...result }, null, 2) + '\n'); console.log('Historical parent UI captured without changing branches/assets') }
}
try { run(['open', 'http://localhost:3000/pl/course/1/question/254/preview/', '--browser', 'chrome']); run(['snapshot']); run(['run-code', 'async page => (' + capture.toString() + ')(page, ' + JSON.stringify(options) + ')']) } catch (e) { console.error(e.message); process.exitCode = 1 } finally { try { run(['close']) } catch (_) {} }
