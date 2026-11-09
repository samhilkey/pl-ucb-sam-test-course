// Offline only. No key lookup, transport, authorization or payload upload.
const fs = require('node:fs'); const path = require('node:path')
const Provider = require('../../../../server/star-gemini-semantic.cjs')
const manifest = { image: path.resolve(__dirname, '../step-4h-2/inputs/IMG_1678--source.png'),
  imageSha256: 'bc1a75a4f46e0ebc43d43cfb26942d15306a69cc25530ae57309bd3f1a8dd9d9', size: [1934, 2047], inputRevision: 0 }
const prepared = Provider.prepare(manifest)
const audit = { ...prepared.audit, mode: 'offline_only', source_kind: 'user_owned_real_paper_photo',
  image: '../step-4h-2/inputs/IMG_1678--source.png', original_jpeg_sha256: 'f86a0acd1dc1fcad32884c202e4fffe44adc5d88c1062a0f8a2cbd60dbc74d49',
  local_test_permission: true, exact_image_external_permission: false, fresh_inference_approval: false,
  previous_one_request_approval_consumed: true, provider_schema_compatibility_verified_live: false,
  current_model_access_reverified: false, current_free_tier_reverified: false, instantaneous_quota: null,
  requests_executed: 0, tokens_used: 0, cost_this_step_usd: 0, automatic_recognition_success: false,
  blockers: ['Fresh explicit approval of this exact metadata-free PNG for unpaid-service external transmission is absent.', 'Fresh single-request approval is absent.', 'Actual semantic-response fidelity and current access are untested.', 'Faithfully retaining the visible terminal hook is incompatible with unchanged function-input import.'] }
fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true })
fs.writeFileSync(path.join(__dirname, 'results/semantic-preflight.json'), JSON.stringify(audit, null, 2) + '\n')
console.log(JSON.stringify(audit, null, 2))
