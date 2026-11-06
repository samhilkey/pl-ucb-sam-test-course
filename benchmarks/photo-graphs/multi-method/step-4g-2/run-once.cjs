// Server-side experimental transport only. Not an element/browser dependency.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const https = require('node:https')
const { spawnSync } = require('node:child_process')
const { prepare } = require('./preflight.cjs')
const root = __dirname
const repo = path.resolve(root, '../../../..')
const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const load = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
const save = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 })

function plan (authorization = load('execution-authorization.json')) {
  const { body, audit } = prepare(); const frozen = load('offline-preflight.json'); const protocol = load('protocol.json')
  if (!authorization.explicitly_authorized || authorization.maximum_requests !== 1 || authorization.automatic_retries !== 0 ||
      authorization.instantaneous_remaining_quota_required !== false || authorization.billing_tier !== 'Free' || authorization.paid_billing_exposure !== false ||
      authorization.project_alias !== 'STAR Sketch2Graph' || authorization.paid_fallback !== false || authorization.other_images_or_models_authorized !== false) throw new Error('The one-request authorization or Free-tier gate does not match.')
  if (authorization.model !== 'gemini-3.5-flash-lite' || body.model !== authorization.model || protocol.model !== authorization.model ||
      authorization.endpoint !== 'https://generativelanguage.googleapis.com/v1beta/interactions' || protocol.endpoint !== authorization.endpoint ||
      audit.prepared_image_sha256 !== authorization.image_sha256 || audit.request_sha256 !== authorization.request_sha256 || audit.request_sha256 !== frozen.request_sha256 ||
      protocol.automatic_retries !== 0 || protocol.timeout_seconds !== 120 || protocol.store !== false || body.store !== false || protocol.tool_calls !== 0 ||
      protocol.other_models !== 0 || protocol.paid_fallbacks !== 0 || protocol.automatic_continuations !== 0) throw new Error('Frozen model, image, request payload or no-retry settings changed.')
  return { authorization, audit, bytes: Buffer.from(JSON.stringify(body)) }
}

// Exactly one https.request call. Redirects, retries, tools, polling and
// continuations are not implemented. A timeout consumes the sole attempt too.
function post (endpoint, bytes, key, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': bytes.length, 'x-goog-api-key': key } }, response => {
      const chunks = []; let size = 0
      response.on('data', chunk => { size += chunk.length; if (size > 32 * 1024 * 1024) req.destroy(new Error('Response size limit exceeded.')); else chunks.push(chunk) })
      response.on('error', reject)
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks) }))
    })
    req.on('error', reject)
    const timer = setTimeout(() => req.destroy(new Error('Request timed out; no retry is allowed.')), timeoutMs)
    req.on('close', () => clearTimeout(timer))
    req.end(bytes)
  })
}
function redact (text, key) {
  return text.split(key).join('[REDACTED]').replace(/\bAIza[0-9A-Za-z_-]{15,}\b/g, '[REDACTED]').replace(/projects\/[0-9]+/g, 'projects/[REDACTED]')
}

async function runOnce ({ directory = path.join(root, 'results'), key = process.env.GEMINI_API_KEY, transport = post, authorization } = {}) {
  if (transport === post && path.resolve(directory) !== path.join(root, 'results')) throw new Error('Real requests must use the fixed one-shot journal directory.')
  const prepared = plan(authorization)
  if (typeof key !== 'string' || !key.trim() || /[\r\n]/.test(key)) throw new Error('A server-side credential must be configured; its value will not be displayed.')
  key = key.trim()
  const env = { ...process.env }; delete env.GEMINI_API_KEY; delete env.GOOGLE_API_KEY
  if (spawnSync('git', ['check-ignore', '--quiet', '.env.local'], { cwd: repo, env }).status !== 0 ||
      spawnSync('git', ['ls-files', '--error-unmatch', '.env.local'], { cwd: repo, env, stdio: 'ignore' }).status === 0) throw new Error('The private environment file must remain ignored and untracked.')
  fs.mkdirSync(directory, { recursive: true })
  const journal = path.join(directory, 'attempt.json')
  const attempt = { version: '4g2.3', source_kind: transport === post ? 'real_provider_request' : 'test_fixture', method: 'Gemini automatic',
    model: prepared.authorization.model, endpoint: prepared.authorization.endpoint, image_sha256: prepared.audit.prepared_image_sha256,
    request_sha256: sha(prepared.bytes), request_bytes: prepared.bytes.length, request_count: 1, automatic_retries: 0,
    started_at_utc: new Date().toISOString(), state: 'attempt_reserved_no_automatic_resume', quota_balance: null,
    quota_unknown_accepted_by_user: true, project_alias: 'STAR Sketch2Graph', billing_tier: 'Free', no_paid_exposure_user_confirmed: true }
  // Reserve and fsync BEFORE the network call. Any existing journal, including
  // an interrupted attempt, prevents a second call. It is never auto-deleted.
  const fd = fs.openSync(journal, 'wx', 0o600)
  try { fs.writeFileSync(fd, JSON.stringify(attempt, null, 2) + '\n'); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  const started = performance.now()
  let response
  try { response = await transport(prepared.authorization.endpoint, prepared.bytes, key, 120000) } catch (error) {
    attempt.latency_ms = performance.now() - started; attempt.finished_at_utc = new Date().toISOString(); attempt.state = 'transport_failed_stop'
    attempt.error = redact(String(error.message || error), key); attempt.delivery_status = 'unknown; never retry'; save(journal, attempt)
    return attempt
  }
  attempt.latency_ms = performance.now() - started; attempt.finished_at_utc = new Date().toISOString(); attempt.http_status = response.status
  const original = response.body.toString('utf8'); const stored = redact(original, key)
  fs.writeFileSync(path.join(directory, 'response.raw.txt'), stored, { mode: 0o600 })
  attempt.response_redacted = stored !== original; attempt.stored_response_sha256 = sha(stored)
  attempt.raw_response_sha256 = stored === original ? sha(response.body) : null
  let envelope
  try { envelope = JSON.parse(stored) } catch (_) {}
  attempt.provider_usage = envelope?.usage || null
  attempt.provider_reported_cost_usd = null // No currency field is invented from tokens.
  attempt.no_paid_cost_basis = 'User-confirmed unbilled Free project; no billing change, provider switch or paid fallback. Monetary charge is not independently reported by this API response.'
  attempt.state = response.status >= 200 && response.status < 300 ? 'response_saved_validate_offline' : 'http_error_stop'
  if (attempt.state === 'http_error_stop') attempt.provider_error = envelope?.error || { message: 'Non-JSON error response; see redacted raw evidence.' }
  save(journal, attempt)
  return attempt
}
if (require.main === module) {
  ;(async () => {
    if (process.argv.length === 2) {
      const p = plan(); console.log(JSON.stringify({ mode: 'dry_run_no_request', model: p.authorization.model, image_sha256: p.audit.prepared_image_sha256,
        request_sha256: p.audit.request_sha256, max_requests: 1, retries: 0, instantaneous_remaining_quota: null, quota_unknown_explicitly_accepted: true,
        remaining_allowed_requests: fs.existsSync(path.join(root, 'results/attempt.json')) ? 0 : 1 })); return
    }
    if (process.argv.length !== 3 || process.argv[2] !== '--execute') throw new Error('Use no arguments for dry-run or --execute for the sole approved attempt.')
    const result = await runOnce()
    console.log(JSON.stringify({ state: result.state, http_status: result.http_status ?? null, request_count: result.request_count, automatic_retries: 0 }))
    if (result.state !== 'response_saved_validate_offline') process.exitCode = 1
  })().catch(() => { console.error('Preflight or attempt reservation failed. No retry is authorized; inspect the local evidence.'); process.exitCode = 1 })
}
module.exports = { plan, runOnce, post }
