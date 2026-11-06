// Serve only the prepared recorded artifact, never the repository or env files.
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
function createServer (file = path.join(__dirname, 'offline-backup.html')) {
  return http.createServer((req, res) => {
    if (!['/', '/offline-backup.html'].includes(req.url) || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); res.end(); return }
    fs.readFile(file, (error, body) => {
      if (error) { res.writeHead(503); res.end('Build the recorded backup first.'); return }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
      res.end(req.method === 'HEAD' ? undefined : body)
    })
  })
}
if (require.main === module) {
  const server = createServer()
  server.listen(3019, '127.0.0.1', () => console.log('Recorded backup only: http://127.0.0.1:3019/offline-backup.html'))
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close())
}
module.exports = { createServer }
