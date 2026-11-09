// Deterministic native-renderer bridge. stdin contains native anchors only.
const Fit = require('./star-adaptive-geometry.js')
let input = ''
process.stdin.on('data', b => { input += b; if (input.length > 2000000) throw Error('Native spline input too large.') })
process.stdin.on('end', () => {
  const paths = JSON.parse(input)
  if (!Array.isArray(paths) || paths.length > 100 || paths.some(p => !Array.isArray(p))) throw Error('Invalid native spline state.')
  const result = paths.filter(ps => ps.length).map(ps => ({ spline: Fit.controls(ps).map(p => [p.x, p.y]) }))
  process.stdout.write(JSON.stringify(result))
})
