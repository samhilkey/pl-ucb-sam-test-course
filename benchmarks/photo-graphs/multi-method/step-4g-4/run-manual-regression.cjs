// Reuse the frozen Step4F acceptance body, adding only the new optional entry
// click (Photo options -> manual trace). No original assertion/tolerance changes.
const fs = require('node:fs'); const path = require('node:path'); const { spawnSync } = require('node:child_process')
const frozen = require('../step-4f/run-browser.cjs').acceptance
const parent = path.resolve(__dirname, '../step-4f'); const own = require('../step-4f/operator-actions.json'); own.file = path.join(parent, 'inputs/new-paper-01.png')
const older = require('../step-4c/operator-actions.json').cases.find(c => c.id.startsWith('real--01')); older.file = path.resolve(__dirname, '../step-4c', older.image)
const options = { url: 'http://localhost:3000/pl/course/1/question/255/preview', output: '/private/tmp/star-step4g4/manual-regression', trials: [{ label: 'desktop', viewport: [1920, 1080], input: own }, { label: 'branches', viewport: [1920, 1080], input: older }, { label: 'presentation', viewport: [1280, 720], input: own }] }
async function withEntry (page, options, body) {
  const proxy = new Proxy(page, { get (target, key) {
    if (key === 'goto') return async (...args) => { const result = await target.goto(...args); await target.waitForFunction(() => window.StarCanvasReference?.instances['paper-lines']); const d = target.locator('#paper-lines-si-container .star-canvas-photo-options'); if (!await d.evaluate(el => el.open)) await d.locator('summary').click(); return result }
    const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value
  } })
  const result = await body(proxy, options); return { ...result, entry_change: 'Photo options -> existing Trace a paper graph (manual); original acceptance body and tolerances unchanged' }
}
fs.mkdirSync(options.output, { recursive: true }); const cli = process.env.PL_PHOTO_TEST_CLI || '/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh'
function run (args) { const r = spawnSync(cli, ['-s=star-canvas-manual-regression', ...args], { cwd: '/private/tmp', encoding: 'utf8', timeout: 300000, maxBuffer: 32 * 1024 * 1024 }); const s = (r.stdout || '') + (r.stderr || ''); if (r.error || r.status !== 0 || s.includes('### Error')) throw r.error || Error(s.slice(-4000)); if (args[0] === 'run-code') { const record = JSON.parse(s.split('### Result\n')[1].split('\n###')[0]); fs.writeFileSync(options.output + '/acceptance.json', JSON.stringify(record, null, 2) + '\n'); console.log('Original manual acceptance assertions passed: ' + record.passed) } }
try { run(['open', options.url, '--browser', 'chrome']); run(['snapshot']); run(['run-code', 'async page => (' + withEntry.toString() + ')(page,' + JSON.stringify(options) + ',' + frozen.toString() + ')']) } catch (e) { console.error(e.message); process.exitCode = 1 } finally { try { run(['close']) } catch (_) {} }
