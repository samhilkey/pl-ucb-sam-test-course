const { test } = require('node:test'); const assert = require('node:assert/strict')
const A = require('../elements/pl-sketch/star-adaptive-geometry.js'); const N = require('../elements/pl-sketch/star-adaptive-native.js')
const frozen = require('../benchmarks/photo-graphs/multi-method/step-4h-4/results/browser/results.json')
const g = frozen.real_photo.accepted.geometry
const config = { ...frozen.real_photo.imported.meta.config, adaptivePhotoSplineTool: 'auto-smooth', plugins: [...frozen.real_photo.imported.meta.config.plugins, { name: 'spline', id: 'auto-smooth' }] }
function canvas () { let data = { 'auto-ink': [], 'auto-draft': [], 'auto-smooth': [], 'auto-notes': [{ x: 735, y: 520 }] }; return { getState: () => JSON.stringify({ data }), setState: s => { data = { ...data, ...JSON.parse(s).data } } } }
test('actual measured photo chooses native smooth sections while retaining corners, hook and irregular regions', () => {
  const before = JSON.stringify(g); const plan = A.plan(g, config)
  assert.ok(plan.spline_count >= 1); assert.ok(plan.polyline_count >= 1); assert.ok(plan.handle_count < 43); assert.equal(plan.original_handle_count, 43); assert.equal(JSON.stringify(g), before)
  const parts = plan.parts; assert.deepEqual(parts[0].points[0], frozen.real_photo.imported.data['auto-draft'][0][0])
  for (let i = 1; i < parts.length; i++) assert.deepEqual(parts[i - 1].points.at(-1), parts[i].points[0])
  for (const part of parts.filter(p => p.kind === 'spline')) { assert.ok(part.metrics.p95_source_pixel <= 4); assert.ok(part.metrics.max_source_pixel <= 6); assert.equal(A.splineTurns(A.controls(part.points), 'x'), 0) }
})
test('Original trace restores all measured vertices and no spline; invalid mode and nonfinite fitting fail closed', () => {
  const p = A.plan(g, config, 'original'); assert.equal(p.handle_count, 43); assert.equal(p.spline_count, 0); assert.equal(p.parts.length, 1)
  assert.throws(() => A.plan(g, config, 'ideal-equation'), /Unknown/)
  assert.throws(() => A.controls([{ x: 0, y: 0 }, { x: NaN, y: 1 }]), /Invalid/)
  assert.throws(() => A.controls([{ x: 0, y: 0 }, { x: 0, y: 0 }]), /too close/)
})
test('representation replacement is explicit and replaces only the unchanged owned draft without duplicates', () => {
  const si = canvas(); const s = N.createSession(si, config); s.invalidate(g.input_revision); const first = s.propose(g)
  assert.equal(JSON.parse(si.getState()).data['auto-smooth'].length, 0); assert.throws(() => s.commit(first.token, false), /explicitly/); s.commit(first.token, true)
  assert.equal(JSON.parse(si.getState()).data['auto-smooth'].length, first.plan.spline_count)
  s.setMode('original'); const original = s.propose(g); assert.equal(original.replacing, true); s.commit(original.token, true)
  let state = JSON.parse(si.getState()).data; assert.equal(state['auto-draft'].length, 1); assert.equal(state['auto-smooth'].length, 0); assert.equal(state['auto-draft'][0].length, 43); assert.deepEqual(state['auto-notes'], [{ x: 735, y: 520 }])
  s.setMode('auto'); const again = s.propose(g); s.commit(again.token, true); state = JSON.parse(si.getState()).data
  assert.equal(state['auto-draft'].length, again.plan.polyline_count); assert.equal(state['auto-smooth'].length, again.plan.spline_count)
  state['auto-smooth'][0][1].y += 4; si.setState(JSON.stringify({ data: { 'auto-smooth': state['auto-smooth'] } }))
  s.setMode('original'); assert.throws(() => s.propose(g), /edited/)
})
test('stale photos, stale native proposals and corrupt tool configuration cannot import adaptive data', () => {
  const si = canvas(); const s = N.createSession(si, config); s.invalidate(g.input_revision); const p = s.propose(g)
  si.setState(JSON.stringify({ data: { 'auto-notes': [{ x: 700, y: 500 }] } })); assert.throws(() => s.commit(p.token, true), /changed after/)
  s.invalidate(g.input_revision + 1); assert.throws(() => s.propose(g), /older photo/)
  assert.throws(() => N.createSession(si, { ...config, adaptivePhotoSplineTool: 'missing' }), /opted-in/)
})
test('readonly submission/solution canvases do not install an editable grading adapter', () => {
  const getter = () => 'readonly'; const si = { getGradeable: getter }
  N.installGrading(si, { ...config, readonly: true }); assert.equal(si.getGradeable, getter)
})
test('a densely sampled measured straight stroke uses a two-endpoint polyline, not a spline', () => {
  const Assisted = require('../elements/pl-sketch/star-assisted')
  const line = Assisted.fromTrace({ width: 500, height: 400, processingWidth: 500, processingHeight: 400, origin: [50, 350], xMarker: [150, 350], yMarker: [50, 250], xValue: 1, yValue: 1, strokes: [Array.from({ length: 9 }, (_, i) => [100 + i * 30, 300 - i * 25])], inputRevision: 0 })
  const [first, last] = line.strokes[0].vertices
  line.strokes[0].vertices = Array.from({ length: 9 }, (_, i) => ({ ...first, pixel: first.pixel.map((v, k) => v + (last.pixel[k] - v) * i / 8), graph: first.graph.map((v, k) => v + (last.graph[k] - v) * i / 8), endpoint: i === 0 || i === 8 }))
  const plan = A.plan(line, config)
  assert.equal(plan.spline_count, 0); assert.equal(plan.polyline_count, 1); assert.equal(plan.handle_count, 2); assert.equal(plan.analyses[0].classification, 'measured_straight_line')
  assert.equal(A.plan(line, config, 'original').handle_count, 9)
})
test('separate branches and a reviewed independent point survive native style replacement', () => {
  const CV = require('../elements/pl-sketch/star-recognition'); const PNG = require('./helpers/png.cjs'); const H = require('../elements/pl-sketch/star-hybrid')
  const fixture = require('../benchmarks/photo-graphs/multi-method/step-4h/fixtures.cjs').prepare().find(c => c.id === 'two-branches-dot-controlled')
  const geometry = H.reviewed(CV.recognize(PNG.read(fixture.image)).geometry, fixture.envelope, { confirmed: true }); const si = canvas()
  const s = N.createSession(si, { ...config, experimentalHybridGeometry: true }); const p = s.propose(geometry); s.commit(p.token, true)
  assert.equal(JSON.parse(si.getState()).data['auto-notes'].length, 2); assert.equal(p.plan.analyses.length, 2)
  s.setMode('original'); const replacement = s.propose(geometry); s.commit(replacement.token, true)
  assert.equal(JSON.parse(si.getState()).data['auto-draft'].length, 2); assert.equal(JSON.parse(si.getState()).data['auto-notes'].length, 2)
})
