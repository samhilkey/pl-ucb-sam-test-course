// Actual native-tool rendering of prior manually traced real photographs.
const fs = require('node:fs'); const path = require('node:path'); const { spawnSync } = require('node:child_process')
async function replay (page, options) {
  const checks = []; const errors = []; const results = []; const check = (ok, label) => { if (!ok) throw Error(label); checks.push(label) }
  page.on('pageerror', e => errors.push(String(e)))
  await page.route('**/*', r => { const u = new URL(r.request().url()); return ['localhost', '127.0.0.1'].includes(u.hostname) || ['blob:', 'data:'].includes(u.protocol) ? r.continue() : r.abort() })
  await page.setViewportSize({ width: 1440, height: 1100 }); await page.goto(options.url, { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.StarAdaptiveNative)
  for (const item of options.cases) {
    const result = await page.evaluate(async item => {
      const wrap = document.createElement('section'); wrap.id = 'representation-replay'; wrap.style.cssText = 'background:white;padding:16px;margin:20px;border:2px solid #475569;position:relative'
      const h = document.createElement('h4'); h.textContent = item.id + ' — manually traced real-paper representation replay; not automatic recognition'; wrap.append(h)
      const photo = document.createElement('img'); photo.src = item.photo; photo.style.width = '400px'; photo.alt = item.id; wrap.append(photo)
      const host = document.createElement('div'); host.id = 'replay-si-container'; wrap.append(host); document.body.append(wrap)
      const config = { ...item.config, xscale: 'linear', yscale: 'linear', enforceBounds: false, initialstate: { ink: [], poly: [], smooth: [], dots: [] } }
      const si = new window.sketchresponse.default(host, 'replay', config); await new Promise(resolve => si.messageBus.on('ready', resolve))
      window.StarEditableDraft.installGrading(si, config); window.StarAdaptiveNative.installGrading(si, config)
      const session = window.StarAdaptiveNative.createSession(si, config); const proposal = session.propose(item.geometry); const receipt = session.commit(proposal.token, true)
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const paths = {}
      for (const id of ['poly', 'smooth']) paths[id] = [...host.querySelectorAll('path.plugin-id-' + id)].filter(p => p.getTotalLength() > 0).map(p => { const n = Math.ceil(p.getTotalLength() * 2) + 1; return { d: p.getAttribute('d'), samples: Array.from({ length: n }, (_, i) => { const q = p.getPointAtLength(i * p.getTotalLength() / (n - 1)); return { x: q.x, y: q.y } }) } })
      return { state: JSON.parse(si.getState()), gradeable: JSON.parse(si.getGradeable()), paths, receipt, plan: proposal.plan }
    }, item)
    check(result.plan.analyses.length === item.geometry.strokes.length, item.id + ': source branch count retained')
    check(result.paths.poly.length + result.paths.smooth.length === result.plan.parts.length, item.id + ': native paths match the representation parts')
    for (const landmark of result.plan.analyses.flatMap(a => a.landmarks || []).filter(l => l.kind === 'corner_or_irregular_turn')) check(result.plan.parts.some(p => p.kind === 'polyline' && p.source_range[0] <= landmark.index && p.source_range[1] >= landmark.index), item.id + ': sharp landmark remains a polyline corner')
    await page.locator('#representation-replay').screenshot({ path: options.output + '/' + item.id + '--native-replay.png' })
    results.push({ id: item.id, source_kind: item.source_kind, automatic_recognition: false, original_sha256: item.sha256, calibration_evidence: item.calibration_evidence, geometry: item.geometry, ...result })
    await page.evaluate(() => document.getElementById('representation-replay').remove())
  }
  check(errors.length === 0, 'No native rendering exceptions in real-paper representation replays')
  return { passed: checks.length, checks, cases: results, errors, scope: 'Native representation diagnostics from previously manually traced real photos; not automatic recognition, not a new student study, no Save & Grade claim for these question-incompatible photos.' }
}
const cases = require('../benchmarks/photo-graphs/multi-method/step-4h-5/real-replays.cjs').cases().map(c => ({ ...c, photo: 'data:image/png;base64,' + fs.readFileSync(c.image).toString('base64') }))
const options = { url: 'http://localhost:3000/pl/course/1/question/256/preview/', output: '/private/tmp/star-h5/replays', cases }; fs.mkdirSync(options.output, { recursive: true })
const cli = process.env.PL_PHOTO_TEST_CLI || '/Users/alaiasun/.codex/skills/playwright/scripts/playwright_cli.sh'
function run (args) { const r = spawnSync(cli, ['-s=star-h5-replays', ...args], { cwd: '/private/tmp', encoding: 'utf8', timeout: 240000, maxBuffer: 16 * 1024 * 1024 }); const s = (r.stdout || '') + (r.stderr || ''); if (r.error || r.status !== 0 || s.includes('### Error')) throw r.error || Error(s.slice(-4000)); if (args[0] === 'run-code') { const value = JSON.parse(s.split('### Result\n')[1].split('\n###')[0]); fs.writeFileSync(options.output + '/results.json', JSON.stringify(value, null, 2) + '\n'); console.log('Real-paper manual-replay assertions passed: ' + value.passed) } }
try { run(['open', options.url, '--browser', 'chrome']); run(['snapshot']); run(['run-code', 'async page => (' + replay.toString() + ')(page,' + JSON.stringify(options) + ')']) } catch (e) { console.error(e.message); process.exitCode = 1 } finally { try { run(['close']) } catch (_) {} }
