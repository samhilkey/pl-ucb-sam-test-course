// Local presentation/recorded backup only. Never serves the repository root.
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const routes = {
  '/presentation': ['presentation.html', 'text/html; charset=utf-8'],
  '/backup': ['offline-backup.html', 'text/html; charset=utf-8'],
  '/presentation.pdf': ['presentation.pdf', 'application/pdf'],
  '/presenter-script': ['PRESENTER.md', 'text/plain; charset=utf-8'],
  '/inputs/new-paper-01.png': ['inputs/new-paper-01.png', 'image/png']
}
function createServer (root = __dirname) {
  return http.createServer((req, res) => {
    if (req.url === '/') { res.writeHead(302, { Location: '/presentation' }); res.end(); return }
    const item = routes[req.url]
    if (!item || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); res.end(); return }
    fs.readFile(path.join(root, item[0]), (error, data) => {
      if (error) { res.writeHead(503); res.end('Package file is not prepared.'); return }
      res.writeHead(200, { 'Content-Type': item[1], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
      res.end(req.method === 'HEAD' ? undefined : data)
    })
  })
}
if (require.main === module) {
  const server = createServer(); server.listen(3020, '127.0.0.1', () => console.log('STAR presentation http://127.0.0.1:3020/presentation ; recorded backup /backup'))
  for (const name of ['SIGINT', 'SIGTERM']) process.on(name, () => server.close())
}
module.exports = { createServer }
