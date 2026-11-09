const fs = require('node:fs'); const path = require('node:path'); const { spawnSync } = require('node:child_process')
async function recovery (page, o) {
  const checks = []; const errors = []; const posts = []
  const check = (ok, message) => { if (!ok) throw Error(message); checks.push(message) }
  page.on('pageerror', e => errors.push(String(e))); page.on('request', r => { if (r.method() === 'POST') { const body = new URLSearchParams(r.postData() || '').get('automatic-photo-sketchresponse-submission'); if (body) posts.push(JSON.parse(Buffer.from(body, 'base64').toString())) } })
  await page.route('**/*', route => { const u = new URL(route.request().url()); return ['localhost', '127.0.0.1'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol) ? route.continue() : route.abort() })
  const ready = () => page.waitForFunction(() => window.StarCanvasReference?.instances['automatic-photo'])
  const state = () => page.evaluate(() => JSON.parse(window.SketchInput.instances['automatic-photo'].getState()).data)
  const ref = () => page.evaluate(() => window.StarCanvasReference.instances['automatic-photo'].status())
  const panel = () => page.locator('#automatic-photo-si-container .star-canvas-photo')
  const fresh = async () => { await page.goto(o.url, { waitUntil: 'networkidle' }); await ready() }
  const upload = async name => { await panel().locator('input[type=file]').setInputFiles(o.fixtures + '/' + name + '.png'); await page.waitForFunction(() => window.StarCanvasReference.instances['automatic-photo'].status().photoVisible) }
  const options = async () => { const d = panel().locator('.star-canvas-photo-options'); if (!await d.evaluate(e => e.open)) await d.locator('summary').click() }
  await page.setViewportSize({ width: 1440, height: 1100 }); await fresh()
  // An actual abstention with no native drawings must not earn photo credit.
  await upload('real--01-multiple-lines-graph-paper'); await page.waitForFunction(() => window.StarCanvasReference.instances['automatic-photo'].status().recognitionStatus === 'abstained')
  const empty = await state(); const scope = (await ref()).scope
  check(empty['auto-ink'].length === 0 && empty['auto-notes'].length === 0, 'Photo-only abstention has no native geometry')
  await page.waitForFunction(() => window.StarCanvasReference.instances['automatic-photo'].status().stored)
  await page.getByRole('button', { name: 'Save & Grade', exact: true }).click(); await page.waitForLoadState('networkidle'); await ready(); await page.waitForFunction(() => window.StarCanvasReference.instances['automatic-photo'].status().photoVisible)
  check(posts.at(-1).data['auto-ink'].length === 0 && posts.at(-1).data['auto-notes'].length === 0 && !JSON.stringify(posts.at(-1)).includes('data:image'), 'Saving a photo alone submits zero curves/points and no image data')
  const emptyFeedback = { invalid_labels: await page.getByText('Invalid', { exact: true }).count(), not_gradable: (await page.locator('body').innerText()).includes('invalid, not gradable') }; await page.screenshot({ path: o.output + '/image-only-submission.png', fullPage: true });
  check(emptyFeedback.invalid_labels > 0 && emptyFeedback.not_gradable, 'Photo alone is rejected as invalid, not gradable (empty native answer)')
  check((await ref()).scope === scope, 'Browser-only photo restoration stays in the same submitted attempt')
  await fresh(); check(!(await ref()).photoVisible && (await ref()).scope !== scope, 'A fresh attempt cannot inherit a different attempt photo')
  // Recognition exception after a successful decode still leaves pixels usable.
  await page.evaluate(() => { window.__provider = window.StarProviders.recognize; window.StarProviders.recognize = () => { throw Error('Injected CV failure') } })
  await upload('real--06-piecewise-graph-paper'); await panel().locator('.star-canvas-photo-status').filter({ hasText: 'Recognition is unavailable' }).waitFor()
  check((await ref()).photoVisible && !(await ref()).cvOverlayVisible && (await state())['auto-ink'].length === 0, 'A CV exception leaves the decoded photo visible, editable and ungraded')
  await panel().locator('input[type=file]').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('invalid image') }); await panel().locator('.star-canvas-photo-status').filter({ hasText: 'previous photo' }).waitFor()
  check((await ref()).sourceName === 'real--06-piecewise-graph-paper.png' && (await ref()).photoVisible, 'A rejected replacement keeps the previous photograph and does not claim the broken file opened')
  // Late results, followed by removal, cannot revive an earlier source.
  await page.evaluate(() => {
    const base = window.__provider; let calls = 0
    window.StarProviders.recognize = async (...args) => { const r = base(...args); if (++calls === 1) await new Promise(resolve => setTimeout(resolve, 1200)); return r }
  })
  await upload('line'); await upload('real--01-multiple-lines-graph-paper'); await page.waitForTimeout(1500)
  check((await ref()).sourceName === 'real--01-multiple-lines-graph-paper.png' && (await ref()).recognitionStatus === 'abstained' && !(await ref()).cvOverlayVisible, 'Late older CV output cannot replace the newer photograph or add provisional ink')
  await options(); await panel().locator('.star-canvas-remove').click(); await page.waitForTimeout(200)
  check(!(await ref()).photoVisible && await page.evaluate(scope => sessionStorage.getItem(scope) === null, (await ref()).scope), 'Remove clears only this scoped reference and pending persistence')
  // Known calibrated geometry offers the existing guarded adapter, not silent import.
  await upload('sharp-v'); await page.waitForFunction(() => window.StarCanvasReference.instances['automatic-photo'].status().recognitionStatus === 'automatic')
  await options(); check(await panel().locator('.star-canvas-draft').isVisible() && (await state())['auto-ink'].length === 0, 'A calibrated CV result offers a native draft but adds nothing automatically')
  await page.locator('#automatic-photo-si-container').getByText('Other marks', { exact: true }).click(); await page.locator('#automatic-photo-si-canvas').scrollIntoViewIfNeeded()
  const b = await page.locator('#automatic-photo-si-canvas').boundingBox(); await page.mouse.click(b.x + b.width * 0.9, b.y + b.height * 0.9)
  const priorPoint = (await state())['auto-notes']; check(priorPoint.length === 1, 'Student can add an independent native point after background CV, before draft review')
  await panel().locator('.star-canvas-draft').click(); const dialog = page.locator('#automatic-photo-automatic-dialog')
  check(await dialog.locator('.star-auto-confirm').isDisabled(), 'The recognized native draft still requires final confirmation')
  await dialog.locator('.star-auto-ack').check(); await dialog.locator('.star-auto-confirm').click()
  check((await state())['auto-ink'].length === 1 && (await ref()).photoVisible && JSON.stringify((await state())['auto-notes']) === JSON.stringify(priorPoint), 'The existing adapter adds the explicitly confirmed calibrated draft while keeping its reference and the newer native point')
  await page.getByRole('button', { name: 'Save & Grade', exact: true }).click(); await page.waitForLoadState('networkidle'); await ready(); await page.waitForFunction(() => window.StarCanvasReference.instances['automatic-photo'].status().photoVisible)
  const savedNative = (await state())['auto-ink']; check(savedNative.length === 1, 'Confirmed calibrated native geometry saves independently of reference persistence')
  // A denied/quota-limited storage write must not block the new image, or restore the old one.
  await page.evaluate(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key.startsWith('star.canvas-photo.v1:')) throw new DOMException('Injected quota failure', 'QuotaExceededError'); return set.call(this, key, value) } })
  await upload('real--06-piecewise-graph-paper'); await panel().locator('.star-canvas-storage-note').filter({ hasText: 'could not be kept' }).waitFor()
  check((await ref()).photoVisible && !(await ref()).stored && JSON.stringify((await state())['auto-ink']) === JSON.stringify(savedNative), 'Storage failure leaves the new reference visible and existing native geometry untouched')
  check(await page.evaluate(scope => sessionStorage.getItem(scope) === null, (await ref()).scope), 'Failed replacement persistence removes the stale old record')
  await page.reload({ waitUntil: 'networkidle' }); await ready(); check(!(await ref()).photoVisible && JSON.stringify((await state())['auto-ink']) === JSON.stringify(savedNative), 'Native drawings restore when the unavailable photo must be reuploaded')
  // Mobile view and keyboard focus remain on the actual native canvas.
  await page.setViewportSize({ width: 390, height: 844 }); await upload('real--06-piecewise-graph-paper')
  await options()
  await panel().locator('.star-canvas-edit').click()
  check(await page.evaluate(() => document.activeElement.id === 'automatic-photo-si-canvas'), 'Edit on canvas focuses the native drawing surface, not the reference pixels')
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Narrow canvas-first view has no page horizontal overflow')
  check(await panel().evaluate(e => e.scrollWidth <= e.clientWidth + 1), 'Photo controls fit the narrow viewport')
  await page.locator('#automatic-photo-si-container').screenshot({ path: o.output + '/mobile-canvas-reference.png' })
  check(errors.length === 0, 'No page exceptions in failure/recovery flows')
  return { passed: checks.length, checks, errors, emptyFeedback, native_saved_after_storage_failure: true, image_only_graded_as_geometry: false, injected_cases: ['CV exception', 'late CV result', 'storage quota denial'], actual_abstention: true }
}
const options = { url: 'http://localhost:3000/pl/course/1/question/254/preview/', fixtures: path.resolve(__dirname, '../benchmarks/photo-graphs/automatic-cv/experiment-01/inputs'), output: '/private/tmp/star-step4g4/recovery' }; fs.mkdirSync(options.output, { recursive: true }); const cli = process.env.PL_PHOTO_TEST_CLI || 'playwright-cli'
function run (args) { const r = spawnSync(cli, ['-s=star-canvas-recovery', ...args], { cwd: '/private/tmp', encoding: 'utf8', timeout: 240000, maxBuffer: 8 * 1024 * 1024 }); const s = (r.stdout || '') + (r.stderr || ''); if (r.error || r.status !== 0 || s.includes('### Error')) throw r.error || Error(s.slice(-4500)); if (args[0] === 'run-code') { const result = JSON.parse(s.split('### Result\n')[1].split('\n###')[0]); fs.writeFileSync(options.output + '/results.json', JSON.stringify(result, null, 2) + '\n'); console.log('Canvas recovery assertions passed: ' + result.passed) } }
try { run(['open', options.url, '--browser', 'chrome']); run(['snapshot']); run(['run-code', 'async page => (' + recovery.toString() + ')(page, ' + JSON.stringify(options) + ')']) } catch (e) { console.error(e.message); process.exitCode = 1 } finally { try { run(['close']) } catch (_) {} }
