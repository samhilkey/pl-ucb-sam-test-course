// Offline design audit only: deliberately has no credential lookup or transport.
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { read } = require('../../../../tests/helpers/png.cjs')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const exact = (object, keys) => object && Object.keys(object).sort().join('|') === keys.slice().sort().join('|')

function loadInputs (file = path.join(__dirname, 'inputs.json')) {
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!exact(manifest, ['version', 'cases']) || manifest.version !== '4a.1' || !Array.isArray(manifest.cases) || !manifest.cases.length) throw new Error('Invalid image-only manifest')
  const ids = new Set()
  for (const c of manifest.cases) {
    if (!exact(c, ['id', 'image', 'image_size', 'sha256']) || typeof c.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(c.id) || ids.has(c.id) ||
        typeof c.image !== 'string' || path.isAbsolute(c.image) || !/^[a-f0-9]{64}$/.test(c.sha256) ||
        !Array.isArray(c.image_size) || c.image_size.length !== 2 || c.image_size.some(n => !Number.isInteger(n) || n <= 0 || n > 20000)) throw new Error('Invalid image-only case')
    ids.add(c.id)
  }
  return manifest
}

function prepareImage (c, base = __dirname) {
  const filename = path.resolve(base, c.image)
  const source = fs.readFileSync(filename)
  if (hash(source) !== c.sha256) throw new Error('Image hash mismatch')
  const im = read(filename)
  if (im.width !== c.image_size[0] || im.height !== c.image_size[1]) throw new Error('Image dimensions mismatch')
  // The restricted PNG decoder rejects unsupported formats. Retain only pixel
  // chunks: strips EXIF/text/time/color-profile metadata without a pixel change.
  const chunks = [source.subarray(0, 8)]
  for (let p = 8; p < source.length;) {
    const n = source.readUInt32BE(p)
    if (p + n + 12 > source.length) throw new Error('Truncated PNG')
    const type = source.toString('ascii', p + 4, p + 8)
    if (['IHDR', 'IDAT', 'IEND'].includes(type)) chunks.push(source.subarray(p, p + n + 12))
    p += n + 12
  }
  return { png: Buffer.concat(chunks), width: im.width, height: im.height, rgba_sha256: hash(im.data) }
}

function buildPreview (image, prompt, schema) {
  // Generic schema/prompt and source pixels only; case identity stays local.
  return {
    model: 'gemini-3.5-flash-lite', store: false,
    input: [
      { type: 'text', text: prompt + `\nImage width=${image.width} height=${image.height} pixels.` },
      { type: 'image', mime_type: 'image/png', data: image.png.toString('base64') }
    ],
    response_format: { type: 'text', mime_type: 'application/json', schema },
    generation_config: { max_output_tokens: 8192 }
  }
}

function audit (manifestFile = path.join(__dirname, 'inputs.json')) {
  const base = path.dirname(manifestFile)
  const manifest = loadInputs(manifestFile)
  const promptBytes = fs.readFileSync(path.join(__dirname, 'prompt.txt'))
  const schemaBytes = fs.readFileSync(path.join(__dirname, 'observation.schema.json'))
  const schema = JSON.parse(schemaBytes)
  const cases = manifest.cases.map(c => {
    const im = prepareImage(c, base)
    const body = buildPreview(im, promptBytes.toString('utf8'), schema)
    const bytes = Buffer.from(JSON.stringify(body))
    if (bytes.length >= 20 * 1000 * 1000) throw new Error('Inline request exceeds 20MB limit')
    return { id: c.id, status: 'dry_run_no_inference', image_size: c.image_size, source_sha256: c.sha256,
      transmitted_png_sha256: hash(im.png), decoded_rgba_sha256: im.rgba_sha256,
      request_sha256: hash(bytes), request_bytes: bytes.length,
      payload_fields: Object.keys(body), input_fields: body.input.map(p => Object.keys(p)),
      graph_prediction: null, model_latency_ms: null, model_usage: null, model_cost_usd: null }
  })
  return {
    step: '4A', mode: 'offline_preflight', model_inference_requests: 0,
    ready_for_live_inference: false,
    blockers: ['Step 4B approval pending', 'image release and provider data-use permission pending',
      'environment credential and unbilled project tier not verified', 'active quota not verified',
      'live transport, strict response parser and observation-to-geometry adapter belong to Step 4B',
      'independent drawings and blinded annotations not yet acquired'],
    proposed_endpoint: 'https://generativelanguage.googleapis.com/v1beta/interactions',
    proposed_api_revision: '2026-05-20',
    prompt_sha256: hash(promptBytes), schema_sha256: hash(schemaBytes),
    manifest_sha256: hash(fs.readFileSync(manifestFile)),
    preflight_code_sha256: hash(fs.readFileSync(__filename)),
    note: 'Local request construction only. Provider acceptance and recognition fidelity are untested. No request bodies or credentials are written.',
    cases
  }
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2)
    if (args.length && !(args.length === 2 && args[0] === '--output')) throw new Error('Usage: node preflight.cjs [--output new-report.json]; live execution is unavailable in Step 4A')
    const result = JSON.stringify(audit(), null, 2) + '\n'
    if (args.length) fs.writeFileSync(path.resolve(args[1]), result, { flag: 'wx' })
    else process.stdout.write(result)
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
module.exports = { loadInputs, prepareImage, buildPreview, audit, hash }
