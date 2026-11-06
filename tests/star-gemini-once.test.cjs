const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const https = require('node:https')
const { EventEmitter } = require('node:events')
const { plan, runOnce, post } = require('../benchmarks/photo-graphs/multi-method/step-4g-2/run-once.cjs')
const key = 'TEST_ONLY_SECRET_NOT_A_REAL_KEY'
test('live plan preserves exact approved model/image/payload and accepts UNKNOWN quota', () => {
  const p = plan()
  assert.equal(p.audit.request_sha256, '0cd99ad83965bfb96f8b8254e25fe99ea132c5b22eb39a3f944f1a5d6b75ac2c')
  assert.equal(p.authorization.instantaneous_remaining_quota_required, false)
  for (const change of [{ model: 'another-model' }, { maximum_requests: 2 }, { paid_billing_exposure: true }, { automatic_retries: 1 }, { image_sha256: '0'.repeat(64) }, { request_sha256: '0'.repeat(64) }]) {
    assert.throws(() => plan({ ...p.authorization, ...change }))
  }
})
for (const status of [200, 403, 429, 500]) test('HTTP ' + status + ' consumes the one-use journal without retry or credential leakage (fixture only)', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'star-gemini-once-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  let calls = 0
  const transport = async (endpoint, bytes, headerKey, timeout) => {
    calls++; assert.equal(headerKey, key); assert.equal(timeout, 120000)
    assert.equal(endpoint, 'https://generativelanguage.googleapis.com/v1beta/interactions')
    assert.equal(JSON.parse(bytes).model, 'gemini-3.5-flash-lite')
    return { status, body: Buffer.from(JSON.stringify({ error: { message: 'Fixture ' + key + ' projects/123456' } })) }
  }
  const result = await runOnce({ directory, key, transport })
  assert.equal(calls, 1); assert.equal(result.source_kind, 'test_fixture')
  assert.equal(result.state, status === 200 ? 'response_saved_validate_offline' : 'http_error_stop')
  assert.equal(result.raw_response_sha256, null, 'a response containing a credential is redacted and not hashed as raw evidence')
  for (const file of fs.readdirSync(directory)) {
    const content = fs.readFileSync(path.join(directory, file), 'utf8')
    assert.equal(content.includes(key), false); assert.equal(content.includes('projects/123456'), false)
  }
  await assert.rejects(runOnce({ directory, key, transport }), /EEXIST/)
  assert.equal(calls, 1)
})
test('transport failure also consumes the attempt; interruption journal is never resumed', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'star-gemini-timeout-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  let calls = 0; const transport = async () => { calls++; throw new Error('Fixture timeout ' + key) }
  const result = await runOnce({ directory, key, transport })
  assert.equal(result.state, 'transport_failed_stop'); assert.equal(result.error.includes(key), false)
  await assert.rejects(runOnce({ directory, key, transport }), /EEXIST/); assert.equal(calls, 1)
})
test('real transport cannot bypass the consumed journal by selecting another output directory', async () => {
  await assert.rejects(runOnce({ directory: '/private/tmp/forbidden-second-real-attempt', key }), /fixed one-shot journal/)
})
test('low-level transport makes one HTTP request for errors/redirects, never following them', async () => {
  const saved = https.request; let count = 0
  https.request = (endpoint, options, callback) => {
    count++; assert.equal(options.method, 'POST'); assert.equal(options.headers['x-goog-api-key'], key)
    const req = new EventEmitter()
    req.end = () => { const res = new EventEmitter(); res.statusCode = 302; callback(res); res.emit('data', Buffer.from('fixture redirect')); res.emit('end'); req.emit('close') }
    req.destroy = error => { req.emit('error', error); req.emit('close') }
    return req
  }
  try { assert.equal((await post('https://generativelanguage.googleapis.com/v1beta/interactions', Buffer.from('{}'), key, 500)).status, 302); assert.equal(count, 1) } finally { https.request = saved }
})
