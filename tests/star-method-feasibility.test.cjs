const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const api = require('../benchmarks/photo-graphs/multi-method/step-4a/preflight.cjs')
const { read } = require('./helpers/png.cjs')
const { validate } = require('../elements/pl-sketch/star-geometry.js')
const dir = path.resolve(__dirname, '../benchmarks/photo-graphs/multi-method/step-4a')

test('preflight runs with all network entry points blocked and reference reads forbidden', () => {
  const originalRead = fs.readFileSync
  const net = require('node:net'); const http = require('node:http'); const https = require('node:https')
  const saved = [net.Socket.prototype.connect, http.request, https.request, global.fetch]
  const forbidden = () => { throw new Error('Network forbidden in Step 4A') }
  net.Socket.prototype.connect = http.request = https.request = global.fetch = forbidden
  fs.readFileSync = function (file, ...args) {
    assert.doesNotMatch(String(file), /references|evaluation-policy|results\//)
    return originalRead.call(this, file, ...args)
  }
  try {
    const result = api.audit()
    assert.equal(result.model_inference_requests, 0)
    assert.equal(result.ready_for_live_inference, false)
    assert.equal(result.cases.length, 2)
    assert.ok(result.blockers.length)
    for (const c of result.cases) {
      assert.equal(c.status, 'dry_run_no_inference')
      assert.equal(c.graph_prediction, null)
      assert.equal(c.model_cost_usd, null)
      assert.equal(c.model_latency_ms, null)
      assert.equal(c.model_usage, null)
      assert.match(c.request_sha256, /^[a-f0-9]{64}$/)
      assert.ok(c.request_bytes < 20_000_000)
    }
  } finally {
    fs.readFileSync = originalRead
    ;[net.Socket.prototype.connect, http.request, https.request, global.fetch] = saved
  }
})

test('manifest rejects extra reference fields and duplicate identities', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'star-4a-manifest-'))
  try {
    const m = api.loadInputs(); const file = path.join(tmp, 'inputs.json')
    m.cases[0].reference = 'private-secret.json'
    fs.writeFileSync(file, JSON.stringify(m))
    assert.throws(() => api.loadInputs(file), /image-only case/)
    delete m.cases[0].reference; m.cases[1].id = m.cases[0].id
    fs.writeFileSync(file, JSON.stringify(m))
    assert.throws(() => api.loadInputs(file), /image-only case/)
    m.cases[0].id = 123
    fs.writeFileSync(file, JSON.stringify(m))
    assert.throws(() => api.loadInputs(file), /image-only case/)
  } finally { fs.rmSync(tmp, { recursive: true }) }
})

test('image identity and original coordinate dimensions fail closed', () => {
  const c = api.loadInputs().cases[0]
  assert.throws(() => api.prepareImage({ ...c, sha256: '0'.repeat(64) }), /hash mismatch/)
  assert.throws(() => api.prepareImage({ ...c, image_size: [1, 1] }), /dimensions mismatch/)
})

test('metadata is excluded while source pixels and dimensions remain unchanged', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'star-4a-png-'))
  try {
    const c = api.loadInputs().cases[0]; const original = fs.readFileSync(path.resolve(dir, c.image))
    // Valid tEXt chunk carrying a private marker; not part of image pixels.
    const text = Buffer.from('Comment\0PRIVATE_EVALUATOR_MARKER')
    const type = Buffer.from('tEXt'); const chunk = Buffer.alloc(text.length + 12)
    chunk.writeUInt32BE(text.length); type.copy(chunk, 4); text.copy(chunk, 8)
    let crc = 0xffffffff
    for (const b of Buffer.concat([type, text])) {
      crc ^= b
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
    }
    chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, chunk.length - 4)
    const withMetadata = Buffer.concat([original.subarray(0, 33), chunk, original.subarray(33)])
    fs.writeFileSync(path.join(tmp, 'source.png'), withMetadata)
    const im = api.prepareImage({ ...c, image: 'source.png', sha256: api.hash(withMetadata) }, tmp)
    assert.equal(im.png.includes(Buffer.from('PRIVATE_EVALUATOR_MARKER')), false)
    fs.writeFileSync(path.join(tmp, 'clean.png'), im.png)
    assert.deepEqual(read(path.join(tmp, 'clean.png')), read(path.resolve(dir, c.image)))
  } finally { fs.rmSync(tmp, { recursive: true }) }
})

test('provider preview contains no local case identity or evaluator information', () => {
  const c = api.loadInputs().cases[0]; const image = api.prepareImage(c)
  const prompt = fs.readFileSync(path.join(dir, 'prompt.txt'), 'utf8')
  const schema = JSON.parse(fs.readFileSync(path.join(dir, 'observation.schema.json')))
  const payload = api.buildPreview(image, prompt, schema)
  const text = JSON.stringify(payload)
  for (const privateValue of [c.id, c.image, c.sha256, 'evaluation-policy.json']) assert.equal(text.includes(privateValue), false)
  assert.equal(payload.input[1].data, image.png.toString('base64'))
  assert.equal(payload.store, false)
  assert.equal(payload.generation_config.max_output_tokens, 8192)
  assert.equal(payload.model, 'gemini-3.5-flash-lite')
  assert.deepEqual(payload.response_format.schema, schema)
})

test('pinned baseline geometry remains valid; references are evaluator-only', () => {
  const policy = JSON.parse(fs.readFileSync(path.join(dir, 'evaluation-policy.json')))
  for (const c of policy.cases) {
    const geometryBytes = fs.readFileSync(path.resolve(dir, c.baseline_geometry))
    const referenceBytes = fs.readFileSync(path.resolve(dir, c.reference))
    assert.equal(api.hash(geometryBytes), c.baseline_geometry_sha256)
    assert.equal(api.hash(referenceBytes), c.reference_sha256)
    validate(JSON.parse(geometryBytes))
  }
})

test('CLI rejects --execute and protects existing evidence from overwrite', () => {
  const script = path.join(dir, 'preflight.cjs')
  const live = spawnSync(process.execPath, [script, '--execute'], { encoding: 'utf8' })
  assert.equal(live.status, 1)
  assert.match(live.stderr, /live execution is unavailable/)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'star-4a-output-'))
  try {
    const output = path.join(tmp, 'evidence.json'); fs.writeFileSync(output, 'sentinel')
    const rerun = spawnSync(process.execPath, [script, '--output', output], { encoding: 'utf8' })
    assert.equal(rerun.status, 1)
    assert.equal(fs.readFileSync(output, 'utf8'), 'sentinel')
  } finally { fs.rmSync(tmp, { recursive: true }) }
})
