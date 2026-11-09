// Sole approved semantic request. No evaluator, question, trace or grader reads.
const fs = require('node:fs'); const path = require('node:path')
const Provider = require('../../../../server/star-gemini-semantic.cjs')
const manifest = { image: path.resolve(__dirname, '../step-4h-2/inputs/IMG_1678--source.png'), imageSha256: 'bc1a75a4f46e0ebc43d43cfb26942d15306a69cc25530ae57309bd3f1a8dd9d9', size: [1934, 2047], inputRevision: 0 }
const prepared = Provider.prepare(manifest)
if (prepared.audit.request_sha256 !== 'e33a94b89c0bc41217f1e26193140416884dfe68e52622e052bdfda01a6c6416' || prepared.audit.model !== 'gemini-3.5-flash-lite') throw Error('Approved semantic payload/model changed. Stop.')
const directory = path.join(__dirname, 'results/provider')
const grant = JSON.parse(fs.readFileSync(path.join(__dirname, 'execution-authorization.json')))
if (process.argv.length === 2) console.log(JSON.stringify({ ...prepared.audit, mode: 'offline_preflight', attempt_already_reserved: fs.existsSync(path.join(directory, 'attempt.json')), request_count_this_command: 0 }))
else if (process.argv.length === 3 && process.argv[2] === '--execute') {
  Provider.recognizeOnce({ manifest, grant, directory }).then(result => console.log(JSON.stringify({ state: result.record.state, http_status: result.record.http_status, request_count: result.record.request_count, source_kind: result.record.source_kind, latency_ms: result.record.latency_ms, provider_usage: result.record.provider_usage, semantic_output_validated: !!result.envelope }))).catch(error => { console.error(error.message); process.exitCode = 1 })
} else throw Error('Use no arguments for offline preflight, or --execute for the sole approved attempt. Never retry.')
