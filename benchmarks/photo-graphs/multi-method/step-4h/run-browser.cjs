// Isolated runtime proof; adds no persistent UI/configuration or model transport.
const fs = require('node:fs'); const path = require('node:path'); const { spawnSync } = require('node:child_process')
async function proof (page, o) {
  const checks = []; const errors = []; const external = []; const outcomes = []; const check = (ok, label) => { if (!ok) throw Error(label); checks.push(label) }
  page.on('pageerror', e => errors.push(String(e)))
  await page.route('**/*', r => { const u = new URL(r.request().url()); if (['localhost', '127.0.0.1'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol)) return r.continue(); external.push(u.origin); return r.abort() })
  const ready = () => page.waitForFunction(() => window.StarCanvasReference?.instances['automatic-photo'])
  const state = () => page.evaluate(() => JSON.parse(window.SketchInput.instances['automatic-photo'].getState()))
  const nativeData = async () => { const s = (await state()).data; return { ink: s['auto-ink'], points: s['auto-notes'] } }
  const container = () => page.locator('#automatic-photo-si-container')
  await page.setViewportSize({ width: 1440, height: 1100 })
  for (const c of o.cases) {
    await page.goto(o.url, { waitUntil: 'networkidle' }); await ready()
    check((await page.title()).includes('star-automatic-photo-test'), c.id + ': actual local PrairieLearn question')
    await page.addScriptTag({ path: o.hybrid })
    await page.evaluate(() => { window.StarFit.fit = window.StarFit.sampleCurve = () => { throw Error('No equation fitting') }; const si = window.SketchInput.instances['automatic-photo']; si.setState(JSON.stringify({ data: { 'auto-notes': [{ x: 735, y: 520 }] } })) })
    if (c.id === 'sharp-v' || c.id === 'two-branches-dot-controlled') await page.evaluate(() => window.SketchInput.instances['automatic-photo'].setState(JSON.stringify({ data: { 'auto-ink': [window.StarNative.encode([{ x: 750, y: 540 }, { x: 770, y: 550 }], 'freeform')] } })))
    await container().locator('.star-canvas-photo input[type=file]').setInputFiles(c.image)
    await page.waitForFunction(() => window.StarCanvasReference.instances['automatic-photo'].status().recognitionStatus)
    const initial = await nativeData()
    await page.evaluate(n => { window.__proofInitialCurveCount = n }, initial.ink.length)
    const result = await page.evaluate(c => window.StarHybrid.inspect(c.source, c.envelope), c)
    check(result.automatically_recognized === false, c.id + ': fixture output is never labeled Gemini or automatic')
    if (!result.importable_after_explicit_review) {
      check((await initial).ink.length === 0 && await page.evaluate(() => window.StarCanvasReference.instances['automatic-photo'].status().photoVisible), 'Real-photo hybrid stays blocked while the existing canvas reference remains usable')
      await container().locator('.star-canvas-edit').click(); await page.locator('#automatic-photo-si-canvas').scrollIntoViewIfNeeded(); const b = await page.locator('#automatic-photo-si-canvas').boundingBox()
      await page.mouse.move(b.x + b.width * 0.8, b.y + b.height * 0.8); await page.mouse.down(); await page.mouse.move(b.x + b.width * 0.9, b.y + b.height * 0.85, { steps: 20 }); await page.mouse.up()
      check((await nativeData()).ink.length === 1, 'Blocked real-photo hybrid permits independent manual native drawing without a wizard')
      await container().screenshot({ path: o.output + '/' + c.id + '--blocked-reference.png' }); outcomes.push({ id: c.id, status: 'blocked', blockers: result.blockers, manually_drawn_native_fallback: true, hybrid_native_imported: false }); continue
    }
    // A test-only single review action. It is never installed in normal UI.
    await page.evaluate(c => {
      window.__proofCase = c; const b = document.createElement('button'); b.type = 'button'; b.id = 'offline-hybrid-confirm'; b.textContent = 'OFFLINE FIXTURE: confirm measured native draft'; b.className = 'btn btn-warning'
      b.onclick = () => { const si = window.SketchInput.instances['automatic-photo']; const config = { ...JSON.parse(si.getState()).meta.config, experimentalHybridGeometry: true }; const geometry = window.StarHybrid.reviewed(c.source, c.envelope, { confirmed: true }); const session = window.StarNative.createSession(si, config, undefined, { hybrid: true }); const p = session.propose(geometry); window.__proofReceipt = session.commit(p.token, true); window.__proofGeometry = geometry }
      document.getElementById('automatic-photo-si-container').prepend(b)
    }, c)
    check(JSON.stringify(await nativeData()) === JSON.stringify(initial), c.id + ': native canvas untouched until explicit proof review')
    await page.locator('#offline-hybrid-confirm').click(); const imported = await nativeData(); const receipt = await page.evaluate(() => window.__proofReceipt)
    check(imported.ink.length === initial.ink.length + c.envelope.semantics.branch_count, c.id + ': actual native freeform objects created for each measured branch')
    check(JSON.stringify(imported.ink.slice(0, initial.ink.length)) === JSON.stringify(initial.ink), c.id + ': unrelated prior native curves preserved')
    check(JSON.stringify(imported.points[0]) === JSON.stringify(initial.points[0]), c.id + ': unrelated prior point preserved')
    check(imported.points.length === 1 + c.envelope.semantics.isolated_points.length, c.id + ': separately measured dot count preserved')
    const exact = await page.evaluate(() => {
      const si = window.SketchInput.instances['automatic-photo']; const s = JSON.parse(si.getState()); const g = window.__proofGeometry; const cfg = s.meta.config
      return g.strokes.every((stroke, i) => stroke.vertices.every((v, j) => { const p = window.StarNative.graphToNative(cfg, v.graph); const actual = s.data['auto-ink'][i + window.__proofInitialCurveCount][j * 3]; return Math.hypot(actual.x - p.x, actual.y - p.y) < 1e-7 })) && JSON.stringify(JSON.parse(si.getGradeable()).data['auto-ink'].map(p => p.spline)) === JSON.stringify(s.data['auto-ink'].map(p => p.map(v => [v.x, v.y])))
    })
    check(exact, c.id + ': every measured anchor is retained in native state and gradeable controls without native refitting')
    await container().screenshot({ path: o.output + '/' + c.id + '--native.png' })
    let submitted = null
    const capture = request => { if (request.method() !== 'POST') return; const v = new URLSearchParams(request.postData() || '').get('automatic-photo-sketchresponse-submission'); if (v) submitted = JSON.parse(Buffer.from(v, 'base64').toString()) }; page.on('request', capture)
    await page.getByRole('button', { name: 'Save & Grade', exact: true }).click(); await page.waitForLoadState('networkidle'); await ready(); page.off('request', capture)
    check(!!submitted && !JSON.stringify(submitted).includes('development_fixture') && !JSON.stringify(submitted).includes('data:image'), c.id + ': normal native submission contains no fixture metadata or photo bytes')
    check(await page.getByText('Invalid', { exact: true }).count() === 0, c.id + ': existing grader accepts native format')
    const expectedScore = c.id === 'matching-answer-controlled' ? '100%' : '0%'
    const visible = page.getByText(expectedScore, { exact: true }).filter({ visible: true })
    check(await visible.count() > 0, c.id + ': actual visible grade is ' + expectedScore)
    check(JSON.stringify(await nativeData()) === JSON.stringify(imported), c.id + ': Save & Grade retains all branches and points')
    await page.reload({ waitUntil: 'networkidle' }); await ready(); check(JSON.stringify(await nativeData()) === JSON.stringify(imported), c.id + ': native state restores independently of experimental scripts')
    await page.waitForFunction(() => window.StarCanvasReference.instances['automatic-photo'].status().photoVisible)
    await page.screenshot({ path: o.output + '/' + c.id + '--graded-restored.png', fullPage: true })
    // Move one real native curve; unrelated point and other branches remain.
    await container().getByRole('button', { name: /^Select/ }).click(); await page.locator('#automatic-photo-si-canvas').scrollIntoViewIfNeeded()
    const grab = await page.evaluate(n => { const p = document.querySelectorAll('#automatic-photo-si-canvas path.plugin-id-auto-ink')[n]; const q = p.getPointAtLength(p.getTotalLength() * 0.4); const m = p.getScreenCTM(); return [m.a * q.x + m.c * q.y + m.e, m.b * q.x + m.d * q.y + m.f] }, initial.ink.length)
    await page.mouse.move(...grab); await page.mouse.down(); await page.mouse.move(grab[0] + 10, grab[1] + 8, { steps: 8 }); await page.mouse.up(); const edited = await nativeData()
    const k = initial.ink.length
    check(JSON.stringify(edited.ink[k]) !== JSON.stringify(imported.ink[k]) && JSON.stringify(edited.points) === JSON.stringify(imported.points) && JSON.stringify(edited.ink.filter((_, i) => i !== k)) === JSON.stringify(imported.ink.filter((_, i) => i !== k)), c.id + ': native Select edits only the chosen measured branch')
    if (c.id === 'sharp-v') {
      await page.getByRole('button', { name: 'Save & Grade', exact: true }).click(); await page.waitForLoadState('networkidle'); await ready(); check(JSON.stringify(await nativeData()) === JSON.stringify(edited), 'Edited hybrid-origin native branch saves without experimental scripts or UI')
      await page.reload({ waitUntil: 'networkidle' }); await ready(); check(JSON.stringify(await nativeData()) === JSON.stringify(edited), 'Edited hybrid-origin native branch restores with unrelated objects intact')
    }
    outcomes.push({ id: c.id, classification: 'Offline human-semantic-fixture-assisted CV; not Gemini or automatic success', image_source_kind: c.source_kind, expected_visible_grade: expectedScore, actual_visible_grade_confirmed: true, receipt, exact_native_anchors_and_gradeable: exact, native_before_save: imported, native_submission: submitted, saved_variant_url: page.url(), native_edit_succeeded: true })
  }
  // Verify the installed library's other tool formats without changing question tools.
  await page.goto(o.url, { waitUntil: 'networkidle' }); await ready()
  const audit = await page.evaluate(async () => {
    const config = { ...JSON.parse(window.SketchInput.instances['automatic-photo'].getState()).meta.config, plugins: [
      { id: 'ff', name: 'freeform', label: 'Audit freeform' }, { id: 'poly', name: 'polyline', label: 'Audit polyline', closed: false }, { id: 'sp', name: 'spline', label: 'Audit spline' }, { id: 'pt', name: 'point', label: 'Audit point' }, { id: 'ln', name: 'line-segment', label: 'Audit segment' }, { id: 'hl', name: 'horizontal-line', label: 'Audit horizontal' }, { id: 'vl', name: 'vertical-line', label: 'Audit vertical' }] }
    const el = document.createElement('div'); el.id = 'native-tool-audit-si-container'; document.body.append(el)
    const si = new window.sketchresponse.default(el, 'native-tool-audit', config); window.__toolAudit = si
    await new Promise(resolve => si.messageBus.on('ready', resolve))
    const data = { ff: window.StarNative.encode([{ x: 50, y: 180 }, { x: 100, y: 80 }, { x: 150, y: 180 }], 'freeform'), poly: [[{ x: 220, y: 180 }, { x: 280, y: 80 }, { x: 340, y: 180 }]], sp: [[{ x: 410, y: 180 }, { x: 470, y: 80 }, { x: 530, y: 180 }]], pt: [{ x: 600, y: 220 }], ln: [{ x: 100, y: 350 }, { x: 230, y: 390 }], hl: [{ x: 0, y: 450 }], vl: [{ x: 700, y: 0 }] }; data.ff = [data.ff]
    si.setState(JSON.stringify({ data })); return { supplied: data, state: JSON.parse(si.getState()), gradeable: JSON.parse(si.getGradeable()) }
  })
  check(JSON.stringify(audit.state.data.poly) === JSON.stringify(audit.supplied.poly) && audit.state.data.ln.length === 2 && !Array.isArray(audit.state.data.ln[0]), 'Native tool audit verifies nested curve versus flat line/point state formats')
  check(JSON.stringify(audit.gradeable.data.ff[0].spline) === JSON.stringify(audit.supplied.ff[0].map(p => [p.x, p.y])), 'Audited freeform gradeable data preserves supplied cubic controls')
  check(JSON.stringify(audit.gradeable.data.poly[0].spline) !== JSON.stringify(audit.supplied.poly[0].map(p => [p.x, p.y])), 'Audited polyline gradeable data is fitted cubic data, not the displayed straight vertices')
  await page.locator('#native-tool-audit-si-canvas').scrollIntoViewIfNeeded(); const ab = await page.locator('#native-tool-audit-si-canvas').boundingBox()
  await page.mouse.move(ab.x + 280 * ab.width / 800, ab.y + 80 * ab.height / 600); await page.mouse.down(); await page.mouse.move(ab.x + 294 * ab.width / 800, ab.y + 90 * ab.height / 600, { steps: 8 }); await page.mouse.up()
  const moved = await page.evaluate(() => JSON.parse(window.__toolAudit.getState()).data)
  check(JSON.stringify(moved.poly[0][1]) !== JSON.stringify(audit.supplied.poly[0][1]) && JSON.stringify(moved.poly[0][0]) === JSON.stringify(audit.supplied.poly[0][0]), 'Native polyline vertex can be moved independently in the library audit')
  await page.locator('#native-tool-audit-si-container').screenshot({ path: o.output + '/native-tool-audit.png' })
  check(errors.length === 0 && external.length === 0, 'No page exceptions or external provider requests in isolated offline proof')
  return { passed: checks.length, checks, outcomes, tool_audit: { ...audit, after_vertex_drag: moved }, errors, external, inference_requests: 0, normal_UI_modified: false }
}
const options = { url: 'http://localhost:3000/pl/course/1/question/254/preview/', output: '/private/tmp/star-step4h/browser', hybrid: path.resolve(__dirname, '../../../../elements/pl-sketch/star-hybrid.js'), cases: require('./results/browser-input.json') }; fs.mkdirSync(options.output, { recursive: true })
const cli = process.env.PL_PHOTO_TEST_CLI || '/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh'
function run (args) { const r = spawnSync(cli, ['-s=star-hybrid-proof', ...args], { cwd: '/private/tmp', encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024 }); const s = (r.stdout || '') + (r.stderr || ''); if (r.error || r.status !== 0 || s.includes('### Error')) throw r.error || Error(s.slice(-5000)); if (args[0] === 'run-code') { const value = JSON.parse(s.split('### Result\n')[1].split('\n###')[0]); fs.writeFileSync(options.output + '/results.json', JSON.stringify(value) + '\n'); console.log('Offline hybrid/native browser assertions passed: ' + value.passed) } }
try { run(['open', options.url, '--browser', 'chrome']); run(['snapshot']); run(['run-code', 'async page => (' + proof.toString() + ')(page,' + JSON.stringify(options) + ')']) } catch (e) { console.error(e.message); process.exitCode = 1 } finally { try { run(['close']) } catch (_) {} }
