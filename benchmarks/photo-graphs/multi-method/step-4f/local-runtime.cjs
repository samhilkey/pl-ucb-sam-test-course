// Tested local runtime operations only. Does not edit course code or delete data.
const { spawnSync } = require('node:child_process')
const name = 'star-automatic-cv-baseline-arm64'
const env = { ...process.env }; delete env.GEMINI_API_KEY; delete env.GOOGLE_API_KEY
function docker (args) {
  const r = spawnSync('docker', args, { env, encoding: 'utf8', timeout: 40000 })
  if (r.status !== 0) throw new Error('Local Docker operation failed: ' + args.slice(0, 2).join(' '))
  return r.stdout.trim()
}
async function action (mode) {
  if (mode === 'stop') {
    if (docker(['inspect', name, '--format', '{{.State.Running}}']) === 'true') {
      const ready = spawnSync('docker', ['exec', name, 'pg_isready', '-q'], { env })
      if (ready.status === 0) docker(['exec', '-u', 'postgres', name, 'pg_ctl', '-D', '/var/postgres', '-m', 'fast', '-w', '-t', '20', 'stop'])
      docker(['stop', '--time', '5', name])
    }
    console.log(JSON.stringify({ container: name, running: false, graceful_postgres_stop_used: true, database_files_deleted: false })); return
  }
  if (mode === 'start') {
    if (docker(['inspect', name, '--format', '{{.State.Running}}']) !== 'true') docker(['start', name])
    let recovered = false
    for (let i = 0; i < 55; i++) {
      try { const r = await fetch('http://127.0.0.1:3000/pl/course/1/question/255/preview/', { signal: AbortSignal.timeout(1500) }); recovered = r.status === 200; await r.arrayBuffer(); if (recovered) break } catch (_) {}
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    console.log(JSON.stringify({ container: name, running: true, primary_http_restored: recovered, database_files_deleted: false }))
    if (!recovered) throw new Error('Primary HTTP did not recover. Use the recorded backup and inspect startup logs; do not delete the database.')
    return
  }
  if (mode !== 'status') throw new Error('Use status, start or stop only.')
  console.log(JSON.stringify({ container: name, running: docker(['inspect', name, '--format', '{{.State.Running}}']) === 'true' }))
}
if (require.main === module) action(process.argv[2] || 'status').catch(error => { console.error(error.message); process.exitCode = 1 })
module.exports = { action }
