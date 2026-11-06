// Offline setup checks. Private credential files are never read by this suite.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')
const checker = path.join(root, 'benchmarks/photo-graphs/multi-method/step-4c/check-gemini-env.cjs')
test('credential ignore rules exclude local files and allow only the blank example', () => {
  assert.equal(fs.readFileSync(path.join(root, '.env.example'), 'utf8'), 'GEMINI_API_KEY=\n')
  for (const file of ['.env', '.env.local', '.env.test']) assert.equal(spawnSync('git', ['check-ignore', '--quiet', '--', file], { cwd: root }).status, 0)
  assert.equal(spawnSync('git', ['check-ignore', '--quiet', '--', '.env.example'], { cwd: root }).status, 1)
  const tracked = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).stdout.split('\0')
  assert.deepEqual(tracked.filter(p => /^\.env(?:$|\.)/.test(p) && p !== '.env.example'), [])
})
test('the current Node loads a server-only env file without exposing its value', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'star-gemini-config-'))
  const file = path.join(directory, '.env.local'); const secret = 'offline-test-key-not-a-credential'
  fs.writeFileSync(file, 'GEMINI_API_KEY="' + secret + '"\n', { mode: 0o600 })
  const env = { ...process.env }; delete env.GEMINI_API_KEY; delete env.GOOGLE_API_KEY; delete env.NODE_OPTIONS
  try {
    const result = spawnSync(process.execPath, ['--env-file=' + file, checker], { env, encoding: 'utf8' })
    assert.equal(result.status, 0); assert.equal(result.stderr, '')
    assert.deepEqual(JSON.parse(result.stdout), { gemini_api_key_configured: true, inference_enabled: false, check_scope: 'environment_presence_only' })
    assert.equal(result.stdout.includes(secret), false)
    const overridden = spawnSync(process.execPath, ['--env-file=' + file, checker], { env: { ...env, GEMINI_API_KEY: '' }, encoding: 'utf8' })
    assert.equal(overridden.status, 0); assert.equal(JSON.parse(overridden.stdout).gemini_api_key_configured, false)
  } finally { fs.rmSync(directory, { recursive: true }) }
})
test('the empty example can be loaded offline without a key or enabled inference', () => {
  const env = { ...process.env }; delete env.GEMINI_API_KEY; delete env.GOOGLE_API_KEY; delete env.NODE_OPTIONS
  const result = spawnSync(process.execPath, ['--env-file=' + path.join(root, '.env.example'), checker], { env, encoding: 'utf8' })
  assert.equal(result.status, 0); assert.equal(JSON.parse(result.stdout).gemini_api_key_configured, false)
  assert.equal(JSON.parse(result.stdout).inference_enabled, false)
})
test('browser application files do not reference the server credential', () => {
  const directory = path.join(root, 'elements/pl-sketch')
  for (const name of fs.readdirSync(directory).filter(n => n.endsWith('.js'))) {
    assert.equal(fs.readFileSync(path.join(directory, name), 'utf8').includes('GEMINI_API_KEY'), false, name)
  }
})
