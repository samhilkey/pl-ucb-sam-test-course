// Server-only, approval-bound semantic provider. No listener, browser bundle,
// automatic invocation, retry, redirect, paid fallback or continuation.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const https = require('node:https')
const { prepareImage, buildPreview } = require('../benchmarks/photo-graphs/multi-method/step-4a/preflight.cjs')
const { read } = require('../tests/helpers/png.cjs')
const CV = require('../elements/pl-sketch/star-recognition.js')
const Hybrid = require('../elements/pl-sketch/star-hybrid.js')
const root = path.resolve(__dirname, '..')
const protocol = path.join(root, 'benchmarks/photo-graphs/multi-method/step-4h')
const model = 'gemini-3.5-flash-lite'
const endpoint = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const sha = x => crypto.createHash('sha256').update(x).digest('hex')
const digest = x => /^[a-f0-9]{64}$/.test(x || '')
const save = (dir, name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + '\n', { mode: 0o600 })

function prepare (manifest) {
  if (!manifest || Object.keys(manifest).sort().join('|') !== ['image', 'imageSha256', 'size', 'inputRevision'].sort().join('|')) throw Error('Only exact image identity, dimensions and revision may enter the semantic provider.')
  const { image, imageSha256, size, inputRevision } = manifest
  if (!digest(imageSha256) || !Number.isSafeInteger(inputRevision) || inputRevision < 0 || !Array.isArray(size) || size.length !== 2 || size.some(v => !Number.isInteger(v) || v < 16 || v > 20000) || size[0] * size[1] > 40000000) throw Error('Invalid bounded photo manifest.')
  if (fs.statSync(image).size > 14000000) throw Error('Image exceeds the inline payload budget.')
  const im = prepareImage({ image, sha256: imageSha256, image_size: size }, root)
  if (sha(im.png) !== imageSha256) throw Error('Only exact metadata-free PNG bytes can be authorized; do not substitute a converted image.')
  const prompt = fs.readFileSync(path.join(protocol, 'semantic-prompt.txt'))
  const schema = fs.readFileSync(path.join(protocol, 'semantic.schema.json'))
  const body = buildPreview(im, prompt.toString(), JSON.parse(schema)); const bytes = Buffer.from(JSON.stringify(body))
  if (bytes.length >= 20000000) throw Error('Inline request exceeds the payload budget.')
  return { bytes, audit: { model, endpoint, photo_sha256: imageSha256, width: im.width, height: im.height, input_revision: inputRevision,
    prompt_sha256: sha(prompt), schema_sha256: sha(schema), request_sha256: sha(bytes), request_bytes: bytes.length,
    maximum_requests: 1, retries: 0, store: false, payload_contains_reference_or_question_data: false } }
}

function authorize (audit, grant, now) {
  if (!grant || !['4H-3-semantic', '4H-4-semantic'].includes(grant.phase) || grant.explicit_inference_approval !== true || grant.exact_image_external_permission !== true ||
    grant.owner_or_authorized !== true || grant.no_identifying_confidential_or_uncleared_material !== true || grant.unpaid_data_terms_accepted !== true ||
    grant.operator_eligibility_confirmed !== true || grant.project_alias !== 'STAR Sketch2Graph' || grant.billing_tier !== 'Free' || grant.paid_billing_exposure !== false ||
    grant.model_access_confirmed !== true || grant.quota_unknown_accepted !== true || grant.maximum_requests !== 1 || grant.retries !== 0 ||
    grant.model !== model || grant.image_sha256 !== audit.photo_sha256 || grant.request_sha256 !== audit.request_sha256 ||
    !Number.isFinite(Date.parse(grant.checked_at)) || !Number.isFinite(Date.parse(grant.expires_at)) || Date.parse(grant.checked_at) > now ||
    Date.parse(grant.expires_at) <= now || Date.parse(grant.expires_at) - Date.parse(grant.checked_at) > 86400000) throw Error('BLOCKED: fresh exact-image inference approval and current unbilled Free-project gates are required.')
}

function post (bytes, key) {
  return new Promise((resolve, reject) => {
    const req = https.request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': bytes.length, 'x-goog-api-key': key } }, res => {
      const chunks = []; let length = 0
      res.on('data', b => { length += b.length; if (length > 4000000) req.destroy(Error('Response too large; stop.')); else chunks.push(b) })
      res.on('error', reject); res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }))
    })
    req.on('error', reject)
    const timer = setTimeout(() => req.destroy(Error('Timed out; delivery unknown; stop.')), 120000)
    req.on('close', () => clearTimeout(timer)); req.end(bytes)
  })
}
const redact = (value, key) => value.split(key).join('[REDACTED]').replace(/\bAIza[0-9A-Za-z_-]{15,}\b/g, '[REDACTED]').replace(/projects\/[0-9]+/g, 'projects/[REDACTED]')

function decode (response) {
  if (response.status !== 'completed' || response.model !== model || !Array.isArray(response.steps) || response.steps.some(s => !['thought', 'model_output', 'user_input'].includes(s.type))) throw Error('Incomplete, wrong-model or unsupported provider response; stop.')
  const outputs = response.steps.filter(s => s.type === 'model_output')
  if (outputs.length !== 1 || !outputs[0].content?.length || outputs[0].content.some(c => c.type !== 'text' || typeof c.text !== 'string')) throw Error('Expected exactly one text-only semantic observation; stop.')
  return Hybrid.validateSemantics(JSON.parse(outputs[0].content.map(c => c.text).join('')))
}

async function recognizeOnce ({ manifest, grant, directory, transport = post, key = process.env.GEMINI_API_KEY, now = Date.now() }) {
  const step = grant?.phase === '4H-4-semantic' ? 'step-4h-4' : 'step-4h-3'
  if (transport === post && directory !== path.join(root, 'benchmarks/photo-graphs/multi-method', step, 'results/provider')) throw Error('Live transport requires its fixed one-shot journal directory.')
  const prepared = prepare(manifest); authorize(prepared.audit, grant, now)
  if (typeof key !== 'string' || !key.trim() || /[\r\n]/.test(key)) throw Error('Server credential missing or malformed.')
  key = key.trim()
  // A trusted server operator owns directory/grant; neither is browser input.
  // One fixed, durable directory per approved run. Never delete to retry.
  if (!path.isAbsolute(directory || '')) throw Error('An absolute private run directory is required.')
  const { spawnSync } = require('node:child_process'); const env = { ...process.env }; delete env.GEMINI_API_KEY; delete env.GOOGLE_API_KEY
  if (spawnSync('git', ['check-ignore', '--quiet', '.env.local'], { cwd: root, env }).status !== 0 || spawnSync('git', ['ls-files', '--error-unmatch', '.env.local'], { cwd: root, env, stdio: 'ignore' }).status === 0) throw Error('The local key file must remain ignored and untracked.')
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
  const record = { ...prepared.audit, source_kind: transport === post ? 'real_provider_request' : 'test_fixture', request_count: 1,
    state: 'reserved_no_resume', started_at: new Date(now).toISOString(), provider_usage: null, provider_reported_cost_usd: null }
  const fd = fs.openSync(path.join(directory, 'attempt.json'), 'wx', 0o600)
  try { fs.writeFileSync(fd, JSON.stringify(record)); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  const started = performance.now()
  try {
    const response = await transport(prepared.bytes, key)
    record.latency_ms = performance.now() - started; record.http_status = response.status
    const raw = redact(response.body.toString('utf8'), key)
    fs.writeFileSync(path.join(directory, 'response.raw.txt'), raw, { mode: 0o600 }); record.response_sha256 = sha(raw)
    if (response.status < 200 || response.status >= 300) throw Error('HTTP access/quota/provider error; stop without retry. See redacted response.')
    const payload = JSON.parse(raw); record.provider_usage = payload.usage || null
    const semantics = decode(payload)
    const envelope = { kind: 'gemini_semantic_response', model, source_kind: record.source_kind, photo_sha256: prepared.audit.photo_sha256,
      width: prepared.audit.width, height: prepared.audit.height, input_revision: manifest.inputRevision,
      request_sha256: prepared.audit.request_sha256, response_sha256: record.response_sha256, semantics }
    record.state = 'validated_semantics_not_native_geometry'; save(directory, 'semantic-envelope.json', envelope)
    save(directory, 'attempt.json', record)
    return { record, envelope }
  } catch (error) {
    record.latency_ms = performance.now() - started; record.state = 'failed_stop'; record.error = redact(String(error.message || error), key)
    save(directory, 'attempt.json', record); return { record, envelope: null }
  }
}

function ground (manifest, envelope) {
  const prepared = prepare(manifest)
  if (envelope.photo_sha256 !== prepared.audit.photo_sha256 || envelope.request_sha256 !== prepared.audit.request_sha256 || envelope.input_revision !== manifest.inputRevision) throw Error('Stale or different photo/payload evidence.')
  // Dense coordinates come only from the exact local raster. Semantic boxes
  // cannot supply coordinates, repair gaps or overwrite calibration evidence.
  const source = CV.recognize(read(manifest.image), { inputRevision: manifest.inputRevision }).geometry
  return { source, inspection: Hybrid.inspect(source, envelope) }
}
module.exports = { prepare, recognizeOnce, ground, decode }
