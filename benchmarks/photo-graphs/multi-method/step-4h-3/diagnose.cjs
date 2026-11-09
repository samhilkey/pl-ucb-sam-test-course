// Evaluator-only diagnosis of frozen measured pixels. Never an inference input.
const fs = require('node:fs'); const path = require('node:path'); const crypto = require('node:crypto')
const root = path.resolve(__dirname, '../../../..')
const Targeted = require(path.join(root, 'elements/pl-sketch/star-targeted.js'))
const Native = require(path.join(root, 'elements/pl-sketch/star-native.js'))
const PNG = require(path.join(root, 'tests/helpers/png.cjs'))
const previous = require('../step-4h-2/results/new-paper/results.json')
const source = previous.initial_automatic.geometry; const manual = previous.assisted_accepted.geometry
const o = manual.coordinate_frame.origin_pixel; const c = manual.calibration
const config = previous.original_grade.submission.meta.config
const geometry = Targeted.fromSelection({ source, photoSha256: previous.original_sha256, inputRevision: source.input_revision,
  axisValues: { origin: o, xMarker: o.map((v, i) => v + 4 * c.x_unit_vector_pixel[i]), yMarker: o.map((v, i) => v + 4 * c.y_unit_vector_pixel[i]), xValue: 4, yValue: 4 }, selections: [[[483, 310], [1193, 275]]], pointSelections: [] })
const segments = geometry.strokes.flatMap(s => Native.functionViolations(s, config))
const matches = segments.map(s => ({ ...s, source_stroke_ids: source.strokes.filter(t => s.pixels.every(p => t.vertices.some(v => JSON.stringify(v.pixel) === JSON.stringify(p)))).map(t => t.id),
  duplicate_positions: JSON.stringify(s.pixels[0]) === JSON.stringify(s.pixels[1]),
  nearest_junction_source_pixel: Math.min(...source.topology.junctions.map(j => Math.hypot(...j.pixel.map((v, i) => v - s.pixels[0][i])))),
  nearest_attached_mark_source_pixel: Math.min(...previous.manual_mark_source_pixels.map(p => Math.hypot(...p.map((v, i) => v - s.pixels[0][i])))) }))
const image = path.resolve(__dirname, '../step-4h-2/inputs/IMG_1678--source.png'); const im = PNG.read(image)
const crop = (overlay, filename) => {
  const bounds = [1120, 220, 1250, 400]; const factor = 5; const w = (bounds[2] - bounds[0]) * factor; const h = (bounds[3] - bounds[1]) * factor; const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(im.data.subarray(((bounds[1] + Math.floor(y / factor)) * im.width + bounds[0] + Math.floor(x / factor)) * 4, ((bounds[1] + Math.floor(y / factor)) * im.width + bounds[0] + Math.floor(x / factor)) * 4 + 4), (y * w + x) * 4)
  if (overlay) for (const s of segments) { const [a, b] = s.pixels.map(p => p.map((v, i) => (v - bounds[i]) * factor)); const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2); for (let k = 0; k <= n; k++) { const x = Math.round(a[0] + (b[0] - a[0]) * k / n); const y = Math.round(a[1] + (b[1] - a[1]) * k / n); for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (xx >= 0 && yy >= 0 && xx < w && yy < h) data.set([235, 20, 25, 255], (yy * w + xx) * 4) } }
  PNG.write(path.join(__dirname, 'results', filename), { width: w, height: h, data })
}
fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true }); crop(false, 'endpoint-original.png'); crop(true, 'endpoint-backtrack.png')
const report = { evaluator_only: true, original_jpeg_sha256: previous.original_sha256, metadata_free_png_sha256: crypto.createHash('sha256').update(fs.readFileSync(image)).digest('hex'),
  calibration: 'Prior explicitly manual 3-anchor frame; not automatic calibration or recognizer input.', measured_backtracking_segments: matches,
  visual_diagnosis: 'Top-right terminal hook visibly present in original ink. Not axis/label contamination, duplicate vertices, attached dot or skeleton junction. Skeleton follows the hook; orientation reversal is invariant under path reversal.',
  largest_reverse_graph_x: Math.max(...segments.map(s => Math.abs(s.graph[1][0] - s.graph[0][0]))),
  inference_calls: 0, automatic_native_import: false, decision: 'Retain original measured hook and reject unchanged function-input import. Do not sort x, trim endpoint or replace with expected parabola.' }
fs.writeFileSync(path.join(__dirname, 'results/diagnosis.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ backtracking_segments: segments.length, source_strokes: matches.map(s => s.source_stroke_ids), largest_reverse_graph_x: report.largest_reverse_graph_x }))
