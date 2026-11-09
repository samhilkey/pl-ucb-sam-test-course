const { test } = require('node:test'); const assert = require('node:assert/strict'); const path = require('node:path')
const Draft = require('../elements/pl-sketch/star-editable-draft.js'); const Native = require('../elements/pl-sketch/star-native.js'); const CV = require('../elements/pl-sketch/star-recognition.js'); const PNG = require('./helpers/png.cjs')
const source = CV.recognize(PNG.read(path.resolve(__dirname, '../benchmarks/photo-graphs/multi-method/step-4h-2/inputs/IMG_1678--source.png'))).geometry
const input = { source, photoSha256: 'bc1a75a4f46e0ebc43d43cfb26942d15306a69cc25530ae57309bd3f1a8dd9d9', inputRevision: 0, axisValues: { origin: [842, 1147], xMarker: [1490, 1130], yMarker: [826, 517], xValue: 4, yValue: 4 } }
const config = { width: 800, height: 600, xrange: [-5.2, 7.2], yrange: [-4.2, 6.2], assistedPhotoGeometry: true, editablePhotoDraftTool: 'draft', plugins: [{ name: 'freeform', id: 'ink' }, { name: 'polyline', id: 'draft' }, { name: 'point', id: 'dots' }] }
function canvas () { let data = { ink: [Native.encode([{ x: 740, y: 550 }, { x: 780, y: 555 }], 'freeform')], draft: [], dots: [{ x: 750, y: 540 }] }; return { getState: () => JSON.stringify({ data }), setState: x => { data = { ...data, ...JSON.parse(x).data } } } }
test('actual IMG_1678 measured curve is suggested without endpoint clicks, tracing, target or semantic fixture', () => {
  const g = Draft.build(input); Draft.validate(g); assert.equal(g.strokes.length, 1); assert.equal(g.provenance.automatically_recognized, false); assert.equal(g.strokes[0].vertices.length, 43)
  assert.ok(g.strokes[0].vertices.some(v => v.corner)); assert.equal(Native.functionViolations(g.strokes[0], config).length, 1)
  const raw = source.strokes.flatMap(s => s.vertices.map(v => JSON.stringify(v.pixel)))
  for (const v of g.strokes[0].vertices) assert.ok(raw.includes(JSON.stringify(v.pixel)))
  assert.deepEqual(g.strokes[0].vertices[0].pixel, source.strokes.find(s => s.id === 'stroke-16').vertices.at(-1).pixel)
})
test('explicit draft acceptance retains the hook as native polyline vertices and preserves prior curve/point', () => {
  const si = canvas(); const before = JSON.parse(si.getState()).data; const g = Draft.build(input)
  assert.throws(() => Native.prepare(g, { ...config, editablePhotoDraftTool: undefined }, undefined, { data: before }, { editableDraft: true }), /configured/)
  assert.throws(() => Native.prepare(g, config, undefined, { data: before }), /draft requires/)
  const session = Native.createSession(si, config, undefined, { editableDraft: true }); const p = session.propose(g)
  assert.equal(p.kind, 'polyline'); assert.equal(p.reviewIssues.length, 1); assert.deepEqual(JSON.parse(si.getState()).data, before)
  assert.throws(() => session.commit(p.token, false), /explicitly confirmed/); session.commit(p.token, true)
  const after = JSON.parse(si.getState()).data; assert.deepEqual(after.ink, before.ink); assert.deepEqual(after.dots, before.dots); assert.equal(after.draft.length, 1)
  assert.deepEqual(after.draft[0], g.strokes[0].vertices.map(v => Native.graphToNative(config, v.graph)))
  assert.throws(() => session.commit(p.token, true), /current proposal/)
})
test('bad calibration, corrupt coordinates, unsupported tools and stale/altered drafts remain blocked', () => {
  assert.throws(() => Draft.build({ ...input, inputRevision: 1 }), /stale/)
  assert.throws(() => Draft.build({ ...input, axisValues: { ...input.axisValues, yValue: 0 } }), /nonzero/)
  const si = canvas(); const g = Draft.build(input); const s = Native.createSession(si, config, undefined, { editableDraft: true }); const p = s.propose(g)
  si.setState(JSON.stringify({ data: { dots: [{ x: 10, y: 20 }] } })); assert.throws(() => s.commit(p.token, true), /canvas changed/)
  const changed = structuredClone(g); changed.strokes[0].vertices.sort((a, b) => a.graph[0] - b.graph[0]); assert.throws(() => Draft.validate(changed), /changed/)
  for (const tool of [{ name: 'spline', id: 'draft' }, { name: 'polyline', id: 'draft', closed: true }, { name: 'polyline', id: 'draft', readonly: true }]) assert.throws(() => Native.receivingDraftTool({ ...config, plugins: [tool] }), /configured/)
})
test('polyline rendered segments and gradeable cubics have identical anchors, corners, endpoints and traversal', () => {
  const ps = [{ x: 10, y: 20 }, { x: 11, y: 19 }, { x: 9, y: 18 }, { x: 50, y: 80 }]
  const g = Draft.gradeable([ps, []]); assert.equal(g.length, 1); assert.deepEqual(g[0].spline.filter((_, i) => i % 3 === 0), ps.map(p => [p.x, p.y]))
  assert.equal(g[0].spline.length, 10)
  for (const bad of [[null], [[{ x: NaN, y: 2 }, { x: 2, y: 3 }]], [[{ x: 1, y: 1 }]]]) assert.throws(() => Draft.gradeable(bad), /Invalid/)
})
test('Save & Grade cannot round stored draft vertices; native finalize placeholders and unrelated state are retained', () => {
  let data = { draft: [[{ x: 12.34567, y: 23.45678 }, { x: 67.89123, y: 78.91234 }]], dots: [{ x: 10, y: 20 }] }
  const before = structuredClone(data)
  const si = { getState: () => JSON.stringify({ data }), setState: s => { data = { ...data, ...JSON.parse(s).data } },
    getGradeable: () => { data.draft[0].forEach(p => { p.x = Math.round(p.x * 100) / 100; p.y = Math.round(p.y * 100) / 100 }); data.draft.push([]); return JSON.stringify({ data: { draft: [], dots: [{ point: [10, 20] }] }, meta: { retained: true } }) } }
  Draft.installGrading(si, { editablePhotoDraftTool: 'draft' }); const answer = JSON.parse(si.getGradeable())
  assert.deepEqual(data.draft, [before.draft[0], []]); assert.deepEqual(data.dots, before.dots)
  assert.deepEqual(answer.data.draft[0].spline.filter((_, i) => i % 3 === 0), before.draft[0].map(p => [p.x, p.y])); assert.deepEqual(answer.meta, { retained: true })
})
test('native editable polyline adapter preserves separate branches, sharp vertices and an isolated measured point', () => {
  const H = require('../elements/pl-sketch/star-hybrid.js')
  const f = require('../benchmarks/photo-graphs/multi-method/step-4h/fixtures.cjs').prepare().find(c => c.id === 'two-branches-dot-controlled')
  const raw = CV.recognize(PNG.read(f.image)).geometry; const g = H.reviewed(raw, f.envelope, { confirmed: true })
  const si = canvas(); const previous = JSON.parse(si.getState()).data
  const session = Native.createSession(si, { ...config, experimentalHybridGeometry: true }, undefined, { editableDraft: true, hybrid: true }); const p = session.propose(g)
  session.commit(p.token, true); const data = JSON.parse(si.getState()).data
  assert.equal(data.draft.length, 2); assert.equal(data.dots.length, 2); assert.deepEqual(data.ink, previous.ink); assert.deepEqual(data.dots[0], previous.dots[0])
  for (let k = 0; k < 2; k++) assert.deepEqual(data.draft[k], g.strokes[k].vertices.map(v => Native.graphToNative(config, v.graph)))
})
