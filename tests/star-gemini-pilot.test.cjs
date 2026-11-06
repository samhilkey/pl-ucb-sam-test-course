const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const api = require('../benchmarks/photo-graphs/multi-method/step-4g-2/preflight.cjs')
const root = path.resolve(__dirname, '../benchmarks/photo-graphs/multi-method/step-4g-2')
const load = name => JSON.parse(fs.readFileSync(path.join(root, name)))

test('exact cleared PNG prepares offline without network, credentials or evaluator reads', () => {
  const originalRead = fs.readFileSync
  const net = require('node:net'); const http = require('node:http'); const https = require('node:https')
  const saved = [net.Socket.prototype.connect, http.request, https.request, global.fetch]
  const forbidden = () => { throw new Error('Network forbidden in offline pilot freeze') }
  net.Socket.prototype.connect = http.request = https.request = global.fetch = forbidden
  fs.readFileSync = function (file, ...args) {
    assert.doesNotMatch(String(file), /\.env|reference\.json|evaluation-policy|operator-actions|prediction\.json|evaluation\.json/)
    return originalRead.call(this, file, ...args)
  }
  try {
    const { audit, body } = api.prepare()
    assert.equal(audit.model_inference_requests, 0); assert.equal(audit.ready_for_inference, false)
    assert.equal(audit.source_sha256, audit.prepared_image_sha256)
    assert.equal(audit.prediction, null); assert.equal(audit.provider_usage, null); assert.equal(audit.provider_cost_usd, null)
    assert.equal(body.model, 'gemini-3.5-flash-lite'); assert.equal(body.store, false)
    assert.equal(body.input.length, 2); assert.equal(body.generation_config.max_output_tokens, 8192)
    assert.deepEqual(audit.image_size, [1688, 1473])
    const text = JSON.stringify(body)
    for (const privateField of ['IMG_1670', audit.source_sha256, 'reference.json', 'operator-actions', 'student_corrected', 'GEMINI_API_KEY']) assert.equal(text.includes(privateField), false)
  } finally {
    fs.readFileSync = originalRead
    ;[net.Socket.prototype.connect, http.request, https.request, global.fetch] = saved
  }
})
test('uncleared, substituted or additional images cannot enter the prepared pilot', () => {
  const manifest = load('inputs.json'); const permission = load('permissions.json')
  const noPermission = structuredClone(permission); noPermission.cases[0].external_transmission_permission = 'unknown'
  assert.throws(() => api.prepare(manifest, noPermission), /permission/)
  const changed = structuredClone(manifest); changed.cases[0].sha256 = '0'.repeat(64)
  assert.throws(() => api.prepare(changed, permission), /permission/)
  const additional = structuredClone(manifest); additional.cases.push(structuredClone(additional.cases[0]))
  assert.throws(() => api.prepare(additional, permission), /sole cleared/)
})
test('CLI remains dry-run only and never displays a supplied sentinel credential', () => {
  const key = 'TEST_ONLY_SECRET_NOT_A_REAL_KEY'
  const r = spawnSync(process.execPath, [path.join(root, 'preflight.cjs')], { encoding: 'utf8', env: { ...process.env, GEMINI_API_KEY: key } })
  assert.equal(r.status, 0); assert.equal((r.stdout + r.stderr).includes(key), false)
  const live = spawnSync(process.execPath, [path.join(root, 'preflight.cjs'), '--execute'], { encoding: 'utf8' })
  assert.equal(live.status, 1); assert.match(live.stderr, /live execution is unavailable/)
})
