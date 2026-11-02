// Controlled raster tests, NOT photographs or independent student samples.
// References are evaluator-only. The recognizer receives only decoded pixels.
const { mkdirSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const { write } = require('../../../../tests/helpers/png.cjs')
const root = __dirname
mkdirSync(join(root, 'inputs'), { recursive: true }); mkdirSync(join(root, 'references'), { recursive: true })
const glyphs = {
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '11011', '00011', '00110', '01100', '11000', '11111'],
  3: ['11110', '00011', '00011', '01110', '00011', '00011', '11110']
}
const cases = [
  { id: 'line', drawing_id: 'controlled-line', strokes: [[[100, 238], [185, 210], [280, 180], [390, 147], [518, 106]]], ink: [28, 28, 28] },
  { id: 'sharp-v', drawing_id: 'controlled-v', strokes: [[[112, 100], [200, 202], [278, 250], [340, 166], [425, 82]]], ink: [30, 40, 140] },
  { id: 'smooth-curve', drawing_id: 'controlled-smooth', strokes: [[[116, 86], [130, 123], [145, 163], [163, 198], [185, 229], [211, 252], [240, 264], [273, 271], [304, 265], [330, 249], [354, 222], [371, 188], [389, 151], [406, 111], [420, 73]]], ink: [28, 28, 28] },
  { id: 'two-branches', drawing_id: 'controlled-two', strokes: [[[106, 334], [144, 344], [181, 361], [210, 391], [227, 431]], [[320, 74], [339, 120], [366, 155], [400, 172], [445, 185], [501, 191]]], ink: [34, 38, 125] },
  { id: 'ambiguous-axes', drawing_id: 'controlled-ambiguous', strokes: [[[100, 140], [200, 200], [390, 105]]], ink: [32, 35, 140], extraAxis: true },
  { id: 'unknown-scale', drawing_id: 'controlled-line', strokes: [[[100, 238], [185, 210], [280, 180], [390, 147], [518, 106]]], ink: [28, 28, 28], labels: false },
  { id: 'grid-axis-crossing', drawing_id: 'controlled-crossing', strokes: [[[150, 370], [220, 325], [270, 290], [330, 245], [420, 177], [500, 120]]], ink: [28, 28, 28] },
  { id: 'touching-junction', drawing_id: 'controlled-junction', strokes: [[[120, 130], [190, 180], [240, 220], [330, 150]], [[240, 220], [290, 270], [370, 310]]], ink: [30, 35, 140] }
]
for (const c of cases) {
  const w = 640; const h = 480; const data = new Uint8ClampedArray(w * h * 4)
  const pixel = (x, y, rgb) => { if (x >= 0 && y >= 0 && x < w && y < h) data.set([...rgb, 255], (y * w + x) * 4) }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = Math.round(251 - 9 * x / w - 4 * y / h); pixel(x, y, [v, v, v - 2]) }
  const segment = (a, b, width, color) => {
    const r = width / 2; const dx = b[0] - a[0]; const dy = b[1] - a[1]; const d2 = dx * dx + dy * dy
    for (let y = Math.max(0, Math.floor(Math.min(a[1], b[1]) - r)); y <= Math.min(h - 1, Math.ceil(Math.max(a[1], b[1]) + r)); y++) {
      for (let x = Math.max(0, Math.floor(Math.min(a[0], b[0]) - r)); x <= Math.min(w - 1, Math.ceil(Math.max(a[0], b[0]) + r)); x++) {
        const t = d2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / d2)) : 0
        if (Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy) <= r) pixel(x, y, color)
      }
    }
  }
  for (let x = 30; x <= 610; x += 40) segment([x, 20], [x, 460], 1, [189, 207, 225])
  for (let y = 20; y <= 460; y += 40) segment([30, y], [610, y], 1, [189, 207, 225])
  segment([30, 300], [610, 300], 2.4, [54, 54, 54]); segment([270, 20], [270, 460], 2.4, [54, 54, 54])
  if (c.extraAxis) segment([350, 20], [350, 460], 2.4, [54, 54, 54])
  const glyph = (value, cx, cy) => {
    const pattern = glyphs[value]
    for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) if (pattern[y][x] === '1') {
      for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) pixel(cx - 5 + x * 2 + xx, cy - 7 + y * 2 + yy, [45, 45, 45])
    }
  }
  if (c.labels !== false) for (let i = 1; i <= 3; i++) { glyph(i, 270 + i * 40, 319); glyph(i, 250, 300 - i * 40) }
  c.strokes.forEach(st => st.slice(1).forEach((p, i) => segment(st[i], p, 8, c.ink)))
  write(join(root, 'inputs', c.id + '.png'), { width: w, height: h, data })
  writeFileSync(join(root, 'references', c.id + '.json'), JSON.stringify({ source_kind: 'controlled_raster', drawing_id: c.drawing_id, centerlines_pixel: c.strokes, origin_pixel: [270, 300], grid_spacing_pixel: [40, 40], expected_strokes: c.id === 'touching-junction' ? null : c.strokes.length, expected_status: c.extraAxis || c.labels === false || c.id === 'touching-junction' ? 'needs_review' : 'automatic' }, null, 2) + '\n')
}
writeFileSync(join(root, 'controlled-cases.json'), JSON.stringify(cases.map(({ id, drawing_id }) => ({ id, drawing_id, source_kind: 'controlled_raster', input: 'inputs/' + id + '.png', reference: 'references/' + id + '.json' })), null, 2) + '\n')
console.log('Wrote ' + cases.length + ' controlled raster fixtures, not photographs.')
