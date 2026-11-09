const { test } = require('node:test'); const assert = require('node:assert/strict')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const Provider = require('../server/star-gemini-semantic.cjs'); const Hybrid = require('../elements/pl-sketch/star-hybrid.js'); const Native = require('../elements/pl-sketch/star-native.js')
const fixture = require('../benchmarks/photo-graphs/multi-method/step-4h/fixtures.cjs').prepare().find(c => c.id === 'two-branches-dot-controlled')
const manifest = { image: fixture.image, imageSha256: fixture.envelope.photo_sha256, size: [640, 480], inputRevision: 4 }
const prepared = Provider.prepare(manifest); const now = Date.parse('2026-11-08T20:00:00Z')
const grant = { phase: '4H-3-semantic', explicit_inference_approval: true, exact_image_external_permission: true, owner_or_authorized: true,
  no_identifying_confidential_or_uncleared_material: true, unpaid_data_terms_accepted: true, operator_eligibility_confirmed: true, project_alias: 'STAR Sketch2Graph', billing_tier: 'Free', paid_billing_exposure: false,
  model_access_confirmed: true, quota_unknown_accepted: true, maximum_requests: 1, retries: 0, model: 'gemini-3.5-flash-lite', image_sha256: manifest.imageSha256,
  request_sha256: prepared.audit.request_sha256, checked_at: '2026-11-08T19:59:00Z', expires_at: '2026-11-08T21:00:00Z' }
const fakeKey = 'offline-test-credential-not-real'
const directory = () => fs.mkdtempSync(path.join(os.tmpdir(), 'star-semantic-test-'))
const response = semantics => ({ status: 200, body: Buffer.from(JSON.stringify({ status: 'completed', model: grant.model, usage: { total_tokens: 123 }, steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(semantics) }] }] })) })
test('frozen payload contains only generic semantic protocol and image, never references/answer/dense geometry', () => {
  const b = JSON.parse(prepared.bytes); assert.equal(b.model, grant.model); assert.equal(b.store, false); assert.deepEqual(b.input.map(v => v.type), ['text', 'image'])
  assert.deepEqual(Object.keys(b.input[1]), ['type', 'mime_type', 'data']); assert.equal(b.input[1].data, fs.readFileSync(manifest.image).toString('base64'))
  assert.equal(b.response_format.schema.properties.branches.items.properties.vertices, undefined)
  assert.equal(b.generation_config.max_output_tokens, 8192)
  assert.throws(() => Provider.prepare({ ...manifest, imageSha256: '0'.repeat(64) }), /hash/)
  assert.throws(() => Provider.prepare({ ...manifest, inputRevision: -1 }), /manifest/)
  assert.throws(() => Provider.prepare({ ...manifest, calibration: {} }), /Only exact image/)
})
test('each absent fresh permission/billing/model/hash/payload/time gate prevents transport', async () => {
  let calls = 0; const transport = async () => { calls++; return response(fixture.semantics) }
  for (const change of [{ explicit_inference_approval: false }, { exact_image_external_permission: false }, { unpaid_data_terms_accepted: false }, { paid_billing_exposure: true }, { billing_tier: 'Paid' }, { model_access_confirmed: false }, { image_sha256: '0'.repeat(64) }, { request_sha256: '0'.repeat(64) }, { maximum_requests: 2 }, { retries: 1 }, { expires_at: '2026-11-08T19:00:00Z' }]) {
    await assert.rejects(Provider.recognizeOnce({ manifest, grant: { ...grant, ...change }, now, key: fakeKey, directory: directory(), transport }), /BLOCKED/)
  }
  assert.equal(calls, 0)
  await assert.rejects(Provider.recognizeOnce({ manifest, grant, now, key: fakeKey, directory: directory() }), /fixed one-shot/)
})
test('mock semantic response grounds in exact CV pixels, reviewed native branches and point; never automatic', async () => {
  const dir = directory(); let calls = 0
  const result = await Provider.recognizeOnce({ manifest, grant, now, key: fakeKey, directory: dir, transport: async () => { calls++; return response(fixture.semantics) } })
  assert.equal(calls, 1); assert.equal(result.record.source_kind, 'test_fixture'); assert.equal(result.record.provider_usage.total_tokens, 123); assert.equal(result.record.provider_reported_cost_usd, null)
  const grounded = Provider.ground(manifest, result.envelope); assert.equal(grounded.inspection.importable_after_explicit_review, true); assert.equal(grounded.inspection.source_kind, 'test_fixture')
  const g = Hybrid.reviewed(grounded.source, result.envelope, { confirmed: true }); assert.equal(g.provenance.method, 'hybrid_semantic'); assert.equal(g.provenance.automatically_recognized, false); Hybrid.validate(g)
  let state = { data: { ink: [], dots: [{ x: 740, y: 530 }] } }; const si = { getState: () => JSON.stringify(state), setState: x => { state.data = { ...state.data, ...JSON.parse(x).data } } }
  const config = { width: 800, height: 600, xrange: [-5, 7], yrange: [-4, 6], assistedPhotoGeometry: true, experimentalHybridGeometry: true, plugins: [{ id: 'ink', name: 'freeform' }, { id: 'dots', name: 'point' }] }
  const disabled = Native.createSession(si, config); disabled.invalidate(4)
  assert.throws(() => disabled.propose(g), /experimental gate/)
  const s = Native.createSession(si, config, undefined, { hybrid: true }); s.invalidate(4); const p = s.propose(g); s.commit(p.token, true)
  assert.equal(state.data.ink.length, 2); assert.equal(state.data.dots.length, 2); assert.deepEqual(state.data.dots[0], { x: 740, y: 530 })
  assert.ok(!fs.readFileSync(path.join(dir, 'attempt.json'), 'utf8').includes(fakeKey))
  await assert.rejects(Provider.recognizeOnce({ manifest, grant, now, key: fakeKey, directory: dir, transport: async () => { calls++; return response(fixture.semantics) } }), /EEXIST/)
  assert.equal(calls, 1)
  assert.throws(() => Provider.ground({ ...manifest, inputRevision: 5 }, result.envelope), /Stale/)
})
test('403/429/503 and transport errors consume one attempt without retries; errors are redacted', async () => {
  for (const status of [403, 429, 503, 'timeout']) {
    let calls = 0; const dir = directory()
    const result = await Provider.recognizeOnce({ manifest, grant, now, key: fakeKey, directory: dir, transport: async () => { calls++; if (status === 'timeout') throw Error(fakeKey); return { status, body: Buffer.from(JSON.stringify({ error: fakeKey })) } } })
    assert.equal(calls, 1); assert.equal(result.envelope, null); assert.equal(result.record.state, 'failed_stop')
    for (const f of fs.readdirSync(dir)) assert.ok(!fs.readFileSync(path.join(dir, f), 'utf8').includes(fakeKey))
  }
})
test('invalid, dense, incomplete, tool or wrong-model responses cannot become semantic/native geometry', async () => {
  const invalid = structuredClone(fixture.semantics); invalid.branches[0].vertices = [[3, 4]]
  for (const payload of [response(invalid), { status: 200, body: Buffer.from('{}') }, { status: 200, body: Buffer.from('{"status":"completed","model":"other","steps":[]}') }, { status: 200, body: Buffer.from('{"status":"completed","model":"gemini-3.5-flash-lite","steps":[{"type":"tool_call"}]}') }]) {
    const result = await Provider.recognizeOnce({ manifest, grant, now, key: fakeKey, directory: directory(), transport: async () => payload })
    assert.equal(result.record.state, 'failed_stop'); assert.equal(result.envelope, null)
  }
})
