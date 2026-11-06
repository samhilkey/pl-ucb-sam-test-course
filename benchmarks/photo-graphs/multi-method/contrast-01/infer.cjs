// Image-only phase. Never loads evaluation policy, annotations or prior geometry.
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { recognize } = require('../../../../elements/pl-sketch/star-recognition.js')
const { read, write } = require('../../../../tests/helpers/png.cjs')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const json = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' })

function line (im, a, b, color, radius = 0) {
  const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2))
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(a[0] + (b[0] - a[0]) * i / steps); const y = Math.round(a[1] + (b[1] - a[1]) * i / steps)
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) if (x + dx >= 0 && y + dy >= 0 && x + dx < im.width && y + dy < im.height) im.data.set([...color, 255], ((y + dy) * im.width + x + dx) * 4)
  }
}

function draw (original, geometry, axes = false, blank = false) {
  const im = { ...original, data: blank ? new Uint8ClampedArray(original.data.length).fill(255) : original.data.slice() }
  if (axes) {
    for (const axis of ['x', 'y']) for (const c of geometry.coordinate_frame.axes[axis].candidates) line(im, c.start, c.end, [0, 170, 220], 1)
  } else {
    const colors = [[245, 100, 0], [170, 0, 230], [0, 140, 75], [0, 95, 240]]
    for (const [index, s] of geometry.strokes.entries()) {
      const color = colors[index % colors.length]
      s.vertices.slice(1).forEach((v, i) => line(im, s.vertices[i].pixel, v.pixel, color))
      for (const v of s.vertices.filter(v => v.endpoint || v.corner)) {
        line(im, [v.pixel[0] - 2, v.pixel[1]], [v.pixel[0] + 2, v.pixel[1]], [220, 20, 50])
        line(im, [v.pixel[0], v.pixel[1] - 2], [v.pixel[0], v.pixel[1] + 2], [220, 20, 50])
      }
    }
  }
  return im
}

function maskImage (mask, width, height) {
  const data = new Uint8ClampedArray(width * height * 4)
  mask.forEach((v, i) => { const c = v ? 0 : 255; data.set([c, c, c, 255], i * 4) })
  return { width, height, data }
}

function inferOne (row, root) {
  const imageFile = path.join(root, row.image); const originalFile = path.join(root, row.original)
  if (hash(fs.readFileSync(imageFile)) !== row.image_sha256 || hash(fs.readFileSync(originalFile)) !== row.source_sha256) throw new Error('Recognition input identity changed')
  const image = read(imageFile)
  if (image.width !== row.image_size[0] || image.height !== row.image_size[1]) throw new Error('Recognition dimensions changed')
  // Exact same recognizer and default options for every condition. No metadata,
  // reference, scale, teacher answer, equation or manual guide enters recognize.
  const started = performance.now(); const result = recognize(image)
  return { ...result, duration_ms: performance.now() - started }
}

function run (root) {
  if (fs.existsSync(path.join(root, 'recognition.json'))) throw new Error('Refusing to overwrite recognition evidence')
  const preparation = JSON.parse(fs.readFileSync(path.join(root, 'preprocessing.json')))
  const outcomes = []
  for (const row of preparation.rows) {
    const dest = path.join(root, row.id, row.condition, 'recognition')
    fs.mkdirSync(dest)
    const result = inferOne(row, root); const g = result.geometry; const d = result.debug
    json(path.join(dest, 'geometry.json'), g)
    json(path.join(dest, 'raw-paths.json'), d.paths_processing)
    json(path.join(dest, 'calibration.json'), { coordinate_frame: g.coordinate_frame, calibration: g.calibration, status: g.status, warnings: g.warnings, assistance: g.assistance })
    const counts = {}
    for (const name of ['neutral', 'grid', 'dark', 'color', 'ink', 'skeleton']) {
      write(path.join(dest, name + '.png'), maskImage(d[name], d.width, d.height))
      counts[name] = d[name].reduce((a, b) => a + b, 0)
    }
    const original = read(path.join(root, row.original))
    write(path.join(dest, 'stroke-overlay.png'), draw(original, g))
    write(path.join(dest, 'proposal.png'), draw(original, g, false, true))
    write(path.join(dest, 'axes-overlay.png'), draw(original, g, true))
    outcomes.push({ id: row.id, condition: row.condition, geometry: path.relative(root, path.join(dest, 'geometry.json')),
      duration_ms: result.duration_ms, status: g.status, geometry_sha256: hash(fs.readFileSync(path.join(dest, 'geometry.json'))),
      masks: counts, image_sha256: row.image_sha256, source_sha256: row.source_sha256 })
    console.log(row.id + '/' + row.condition + ': ' + g.status + ', ' + g.strokes.length + ' paths')
  }
  const sourceHash = file => hash(fs.readFileSync(path.resolve(__dirname, '../../../../elements/pl-sketch', file)))
  json(path.join(root, 'recognition.json'), { experiment: 'contrast-01', stage: 'image_only_recognition',
    inference_code_sha256: hash(fs.readFileSync(__filename)), recognizer_sha256: sourceHash('star-recognition.js'),
    geometry_validator_sha256: sourceHash('star-geometry.js'), options: {}, reference_reads: 0, network_requests: 0, outcomes })
}

if (require.main === module) {
  if (process.argv.length !== 3) throw new Error('Usage: node infer.cjs run-directory')
  run(path.resolve(process.argv[2]))
}
module.exports = { inferOne, draw, line, maskImage, hash, run }
