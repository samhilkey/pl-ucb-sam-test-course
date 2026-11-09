// Human-authored development semantics. Never Gemini output or held-out data.
const fs = require('node:fs'); const path = require('node:path'); const crypto = require('node:crypto')
const PNG = require('../../../../tests/helpers/png.cjs')
const root = path.resolve(__dirname, '../../../..')
const base = path.join(root, 'benchmarks/photo-graphs/automatic-cv/experiment-01')
const norm = (b, w = 640, h = 480) => b.map((v, i) => v * 1000 / (i % 2 ? h : w))
function semantics (branches, points = [], w = 640, h = 480) {
  return { schema_version: 1, coordinate_system: 'normalized_0_1000', branch_count: branches.length,
    origin: { region: norm([260, 290, 280, 310], w, h), uncertain: false }, axes: Object.fromEntries(['x', 'y'].map((a, j) => [a, {
      region: norm(j ? [260, 20, 280, 460] : [30, 290, 610, 310], w, h), positive_direction: j ? 'up' : 'right', intersection_value: 0, uncertain: false,
      ticks: [1, 2, 3].map(value => ({ value, uncertain: false, region: norm(j ? [238, 290 - value * 40, 262, 310 - value * 40] : [260 + value * 40, 309, 280 + value * 40, 330], w, h) }))
    }])), branches: branches.map((b, i) => ({ id: 'branch-' + (i + 1), region: norm(b.region, w, h), endpoint_regions: b.ends.map(r => norm(r, w, h)), corner_regions: (b.corners || []).map(r => norm(r, w, h)), extremum_regions: (b.extrema || []).map(r => norm(r, w, h)), uncertain: false })),
    isolated_points: points.map((b, i) => ({ id: 'dot-' + (i + 1), region: norm(b, w, h), filled: true, uncertain: false })),
    non_graph_regions: [[260, 10, 280, 470], [20, 290, 620, 310]].map(b => ({ kind: 'axis', region: norm(b, w, h) })).concat([{ kind: 'label', region: norm([235, 50, 263, 285], w, h) }, { kind: 'label', region: norm([290, 309, 405, 335], w, h) }]),
    discontinuities: [], unsupported: [], uncertainty: [] }
}
function prepare () {
  fs.mkdirSync(path.join(__dirname, 'inputs'), { recursive: true }); fs.mkdirSync(path.join(__dirname, 'references'), { recursive: true })
  // A new controlled raster with independently explicit axes/bitmap labels.
  // The function is used only to DRAW the test input and evaluator reference.
  const w = 640; const h = 480; const im = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(255) }
  const disk = (x, y, radius, rgb) => { for (let yy = Math.max(0, Math.floor(y - radius)); yy <= Math.min(h - 1, Math.ceil(y + radius)); yy++) for (let xx = Math.max(0, Math.floor(x - radius)); xx <= Math.min(w - 1, Math.ceil(x + radius)); xx++) if (Math.hypot(xx - x, yy - y) <= radius) im.data.set([...rgb, 255], (yy * w + xx) * 4) }
  for (let y = 20; y < 470; y += 40) for (let x = 30; x <= 610; x++) disk(x, y, 0.55, [190, 208, 225])
  for (let x = 30; x <= 610; x += 40) for (let y = 20; y <= 460; y++) disk(x, y, 0.55, [190, 208, 225])
  for (let x = 30; x <= 610; x++) disk(x, 300, 1, [45, 45, 45])
  for (let y = 20; y <= 460; y++) disk(270, y, 1, [45, 45, 45])
  const glyphs = { 1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'], 2: ['01110', '11011', '00011', '00110', '01100', '11000', '11111'], 3: ['11110', '11011', '00011', '01110', '00011', '00011', '11110'] }
  for (const v of [1, 2, 3]) for (const [cx, cy] of [[270 + v * 40, 319], [250, 300 - v * 40]]) for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) if (glyphs[v][y][x] === '1') for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) im.data.set([45, 45, 45, 255], ((cy - 7 + y * 2 + dy) * w + cx - 5 + x * 2 + dx) * 4)
  const center = []
  for (let x = -2.2; x <= 2.200001; x += 0.005) { const p = [270 + x * 40, 300 - x * x * 40]; center.push(p); disk(...p, 4, [30, 40, 140]) }
  const parabola = path.join(__dirname, 'inputs/matching-answer-controlled.png'); PNG.write(parabola, im)
  fs.writeFileSync(path.join(__dirname, 'references/matching-answer-controlled.json'), JSON.stringify({ source_kind: 'controlled_raster', expected_strokes: 1, centerlines_pixel: [center], origin_pixel: [270, 300], graph_function_for_evaluation_only: 'x**2' }) + '\n')
  const dotImage = PNG.read(path.join(base, 'inputs/two-branches.png'))
  for (let y = 96; y <= 104; y++) for (let x = 516; x <= 524; x++) if (Math.hypot(x - 520, y - 100) <= 4) dotImage.data.set([25, 25, 25, 255], (y * 640 + x) * 4)
  const twoDot = path.join(__dirname, 'inputs/two-branches-dot-controlled.png'); PNG.write(twoDot, dotImage)
  const cases = [
    { id: 'matching-answer-controlled', image: parabola, source_kind: 'controlled_raster', semantics: semantics([{ region: [170, 90, 370, 306], ends: [[170, 90, 195, 125], [345, 90, 370, 125]], extrema: [[255, 285, 285, 305]] }]) },
    { id: 'sharp-v', image: path.join(base, 'inputs/sharp-v.png'), source_kind: 'controlled_raster', semantics: semantics([{ region: [90, 60, 450, 275], ends: [[95, 85, 130, 120], [410, 65, 445, 100]], corners: [[265, 235, 295, 265]] }]) },
    { id: 'two-branches-dot-controlled', image: twoDot, source_kind: 'controlled_raster', semantics: semantics([{ region: [90, 320, 245, 450], ends: [[90, 320, 125, 350], [210, 415, 245, 450]] }, { region: [305, 55, 515, 210], ends: [[305, 55, 335, 90], [485, 175, 515, 210]] }], [[505, 85, 535, 115]]) }
  ]
  // Coarse boxes from the visible independent user-owned photograph; no traces.
  const real = { schema_version: 1, coordinate_system: 'normalized_0_1000', branch_count: 1,
    origin: { region: [440, 495, 490, 560], uncertain: true }, axes: {
      x: { region: [75, 490, 820, 575], positive_direction: 'right', intersection_value: 0, uncertain: true, ticks: [] },
      y: { region: [415, 60, 505, 960], positive_direction: 'up', intersection_value: 0, uncertain: true, ticks: [] } },
    branches: [{ id: 'branch-1', region: [45, 180, 900, 510], endpoint_regions: [[45, 450, 90, 510], [835, 395, 900, 450]], corner_regions: [[195, 280, 250, 330], [565, 185, 630, 240]], extremum_regions: [[360, 430, 435, 480]], uncertain: false }],
    isolated_points: [{ id: 'dot-1', region: [470, 185, 505, 220], filled: true, uncertain: false }],
    non_graph_regions: [{ kind: 'axis', region: [415, 60, 505, 960] }, { kind: 'axis', region: [75, 490, 820, 575] }, { kind: 'label', region: [90, 560, 800, 700] }, { kind: 'label', region: [365, 140, 425, 450] }],
    discontinuities: [], unsupported: ['Bent hand-drawn axes are not a verified affine frame.'], uncertainty: ['Numeric tick grounding and crossing separation need image evidence or a short user correction.'] }
  cases.push({ id: 'IMG_1670', image: path.join(root, 'benchmarks/photo-graphs/multi-method/step-4g-1/results/IMG_1670--source.png'), source_kind: 'real_photo', semantics: real })
  for (const c of cases) c.envelope = { kind: 'development_fixture', model: null, photo_sha256: crypto.createHash('sha256').update(fs.readFileSync(c.image)).digest('hex'), width: PNG.read(c.image).width, height: PNG.read(c.image).height, semantics: c.semantics }
  return cases
}
module.exports = { prepare }
if (require.main === module) console.log(JSON.stringify(prepare().map(c => ({ id: c.id, source_kind: c.source_kind, hash: c.envelope.photo_sha256 })), null, 2))
