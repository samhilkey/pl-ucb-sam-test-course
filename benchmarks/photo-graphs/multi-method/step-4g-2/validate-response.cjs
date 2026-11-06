// Real provider evidence only; no request transport and no evaluator imports.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { extract, convert } = require('./observations.cjs')
const directory = path.resolve(process.argv[2] || path.join(__dirname, 'results'))
const save = (file, value) => fs.writeFileSync(path.join(directory, file), JSON.stringify(value, null, 2) + '\n')
const attempt = JSON.parse(fs.readFileSync(path.join(directory, 'attempt.json')))
if (attempt.source_kind !== 'real_provider_request' || attempt.request_count !== 1 || attempt.http_status !== 200) throw new Error('A successful real one-request response is required.')
const raw = fs.readFileSync(path.join(directory, 'response.raw.txt'))
if (crypto.createHash('sha256').update(raw).digest('hex') !== attempt.stored_response_sha256) throw new Error('Stored response hash changed.')
const validation = { version: '4g2.3', source_kind: attempt.source_kind, json_repaired: false, coordinate_rescaling_or_reference_correction: false,
  provider_envelope_valid: false, schema_valid: false, photo_geometry_v1_valid: false, recognition_fidelity_passed: null }
try {
  const response = JSON.parse(raw); const { observation, text } = extract(response, 1688, 1473)
  validation.provider_envelope_valid = true; validation.schema_valid = true
  fs.writeFileSync(path.join(directory, 'prediction.raw.json'), text)
  save('observation.json', observation)
  const converted = convert(observation)
  validation.photo_geometry_v1_valid = true; validation.geometry_status = converted.geometry.status
  validation.manual_correction_required = converted.geometry.status !== 'automatic'
  validation.warnings = converted.geometry.warnings
  save('geometry.json', converted.geometry); save('conversion.json', converted)
} catch (error) { validation.error = error.message }
save('validation.json', validation)
console.log(JSON.stringify(validation, null, 2))
