// Offline readiness evidence only. No HTTP, SDK, API-key lookup or inference.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '../../../..')
const env = { ...process.env }; delete env.GEMINI_API_KEY; delete env.GOOGLE_API_KEY
const git = (args, input) => spawnSync('git', args, { cwd: root, env, input, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const configured = [process.env.GEMINI_API_KEY, process.env.GOOGLE_API_KEY].filter(v => typeof v === 'string' && v.trim())
let keyAbsent = true
for (const key of configured) if (git(['grep', '--cached', '-l', '-F', '-f', '-', '--'], key + '\n').status !== 1) keyAbsent = false
const trackedEnv = git(['ls-files', '-z']).stdout.split('\0').filter(p => /^\.env(?:$|\.)/.test(p))
const projectFields = ['GOOGLE_CLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT_ID', 'GCLOUD_PROJECT', 'GEMINI_PROJECT_ID', 'GEMINI_PROJECT_NUMBER', 'GEMINI_KEY_NAME']
const source = JSON.parse(fs.readFileSync(path.join(root, 'benchmarks/photo-graphs/automatic-cv/experiment-01/source-attribution.json')))
const inputRoot = path.resolve(__dirname, '../step-4a')
const inputs = JSON.parse(fs.readFileSync(path.join(inputRoot, 'inputs.json')))
const cases = inputs.cases.map(c => {
  const file = path.resolve(inputRoot, c.image); const bytes = fs.readFileSync(file)
  const p = source.selected_crop_provenance.find(p => p.id === c.id)
  return { id: c.id, original_png_sha256: c.sha256, hash_verified: hash(file) === c.sha256,
    dimensions_verified: bytes.readUInt32BE(16) === c.image_size[0] && bytes.readUInt32BE(20) === c.image_size[1], image_size: c.image_size,
    crop_provenance_verified: p.input_sha256 === c.sha256, source_jpeg_sha256: p.source_sha256, crop_xyxy: p.crop_xyxy,
    local_use_permission: 'VERIFIED: explicit user approval for local testing', google_unpaid_service_permission: 'BLOCKED: image-specific clearance not supplied',
    privacy_note: 'Pinned bytes match prior locally screened crops. No new visual-screening or deidentification guarantee is claimed; images were not transmitted.' }
})
const frontend = path.join(root, 'elements/pl-sketch')
const result = { step: '4E', date_local: '2026-11-05', offline_only: true, node: process.version,
  credentials: { private_env_file_exists: fs.existsSync(path.join(root, '.env.local')), gemini_api_key_configured: typeof process.env.GEMINI_API_KEY === 'string' && !!process.env.GEMINI_API_KEY.trim(),
    private_file_ignored: git(['check-ignore', '--quiet', '--', '.env.local']).status === 0, ignore_evidence: git(['check-ignore', '-v', '--', '.env.local']).stdout.trim(),
    only_blank_example_tracked: trackedEnv.length === 1 && trackedEnv[0] === '.env.example' && fs.readFileSync(path.join(root, '.env.example'), 'utf8') === 'GEMINI_API_KEY=\n',
    configured_key_absent_from_current_index: keyAbsent, browser_code_has_no_credential_variable: fs.readdirSync(frontend).filter(p => p.endsWith('.js')).every(p => !fs.readFileSync(path.join(frontend, p), 'utf8').includes('GEMINI_API_KEY')),
    key_value_logged: false, key_hash_or_fragment_saved: false, credential_validity: 'UNKNOWN: no authenticated request permitted' },
  local_project_metadata_presence: Object.fromEntries(projectFields.map(n => [n, !!process.env[n]])), key_to_project_binding: 'UNKNOWN: no binding evidence',
  cases, frozen_demo_commit: '1d9be84f67d1f699249cedbbbf5fcbf26fc1ad0c',
  frozen_demo_and_existing_repository_unchanged: git(['diff', '--quiet', '1d9be84f67d1f699249cedbbbf5fcbf26fc1ad0c', '--', '.', ':(exclude)benchmarks/photo-graphs/multi-method/step-4e']).status === 0,
  inference_requests: 0, authenticated_provider_requests: 0, image_uploads: 0, billing_changes: 0 }
const ok = result.credentials.private_file_ignored && result.credentials.only_blank_example_tracked && keyAbsent && result.credentials.browser_code_has_no_credential_variable && result.frozen_demo_and_existing_repository_unchanged && cases.every(c => c.hash_verified && c.dimensions_verified && c.crop_provenance_verified)
if (process.argv.includes('--output')) fs.writeFileSync(process.argv[process.argv.indexOf('--output') + 1], JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({ local_safety_checks_passed: ok, credential_configured: result.credentials.gemini_api_key_configured, project_binding: result.key_to_project_binding, frozen_demo_unchanged: result.frozen_demo_and_existing_repository_unchanged, inference_requests: 0 }))
if (!ok) process.exitCode = 1
