// Offline freeze only. No credential lookup, HTTP transport or evaluator reads.
const fs = require('node:fs')
const path = require('node:path')
const previous = require('../step-4a/preflight.cjs')
const root = __dirname
const exactHash = '9c8247ec0be7d4ca68c4536eea990a0c5b0fce6250e8478a13b5aa5a0e190231'
const load = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))

function prepare (manifest = load('inputs.json'), permissions = load('permissions.json')) {
  const protocol = load('protocol.json')
  if (manifest.version !== '4a.1' || manifest.cases?.length !== 1 || permissions.cases?.length !== 1) throw new Error('Only the sole cleared image belongs to this pilot.')
  const c = manifest.cases[0]; const permission = permissions.cases[0]
  if (c.id !== 'IMG_1670' || c.sha256 !== exactHash || permission.id !== c.id || permission.sha256 !== exactHash ||
      permission.external_transmission_permission !== 'explicitly_authorized' || permission.no_identifying_confidential_or_uncleared_material !== true) throw new Error('Exact-image permission is missing or mismatched.')
  if (protocol.model !== 'gemini-3.5-flash-lite' || protocol.max_total_inference_requests !== 1 || protocol.max_output_tokens !== 8192 ||
      protocol.automatic_retries !== 0 || protocol.automatic_continuations !== 0 || protocol.approved_spend_usd !== 0) throw new Error('Frozen request budget or model changed.')
  const image = previous.prepareImage(c, root)
  if (previous.hash(image.png) !== exactHash) throw new Error('Prepared bytes differ from the exact cleared PNG.')
  const prompt = fs.readFileSync(path.join(root, protocol.prompt))
  const schema = fs.readFileSync(path.join(root, protocol.schema))
  if (previous.hash(prompt) !== protocol.prompt_sha256 || previous.hash(schema) !== protocol.schema_sha256) throw new Error('Frozen prompt or schema changed.')
  const body = previous.buildPreview(image, prompt.toString('utf8'), JSON.parse(schema))
  const bytes = Buffer.from(JSON.stringify(body))
  if (bytes.length >= 20_000_000) throw new Error('Request exceeds the frozen inline size limit.')
  return { body, audit: { version: '4g2.1', mode: 'offline_preflight', model: body.model, case_id: c.id,
    image_size: [image.width, image.height], source_sha256: c.sha256, prepared_image_sha256: previous.hash(image.png),
    decoded_rgba_sha256: image.rgba_sha256, prompt_sha256: previous.hash(prompt), schema_sha256: previous.hash(schema),
    request_sha256: previous.hash(bytes), request_bytes: bytes.length, input_fields: body.input.map(p => Object.keys(p)),
    max_total_inference_requests: 1, model_inference_requests: 0, ready_for_inference: false,
    blockers: ['Offline construction only. The separate executor requires explicit authorization and an unused one-shot journal; UNKNOWN instantaneous quota is accepted by the latest user authorization.'],
    request_count_scope: 'This preparation command only; cumulative actual requests are recorded in results/attempt.json.',
    prediction: null, latency_ms: null, provider_usage: null, provider_cost_usd: null, confirmed_incurred_cost_usd: 0 } }
}
if (require.main === module) {
  try {
    if (process.argv.length !== 2) throw new Error('Offline preflight only; live execution is unavailable.')
    console.log(JSON.stringify(prepare().audit, null, 2))
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
module.exports = { prepare }
