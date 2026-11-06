const test = require('node:test')
const assert = require('node:assert/strict')
const { createServer } = require('../benchmarks/photo-graphs/multi-method/step-4d/serve-backup.cjs')
test('backup viewer serves only the standalone artifact and cannot expose env/repository files', async t => {
  const server = createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const root = 'http://127.0.0.1:' + server.address().port
  const response = await fetch(root + '/offline-backup.html'); assert.equal(response.status, 200)
  const body = await response.text(); assert.match(body, /Recorded assisted reconstruction/)
  assert.equal(/<script\b/i.test(body), false); assert.equal((body.match(/src="data:image\/png;base64,/g) || []).length, 12)
  assert.equal((body.match(/download="real--0[16]-native-evidence.json"/g) || []).length, 2)
  for (const url of ['/.env.local', '/.env.example', '/tests/star-demo-browser.cjs', '/offline-backup.html?file=.env.local']) assert.equal((await fetch(root + url)).status, 404)
})
