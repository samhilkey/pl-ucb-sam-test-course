// Diagnostic bounding boxes only; never turns OCR text into calibration.
const fs = require('node:fs')
const { read, write } = require('../../../../tests/helpers/png.cjs')
const [imagePath, ocrPath, outputPath] = process.argv.slice(2)
if (!imagePath || !ocrPath || !outputPath || process.argv.length !== 5) throw new Error('Usage: node render-ocr.cjs image.png ocr.json new-overlay.png')
if (fs.existsSync(outputPath)) throw new Error('Refusing to overwrite evidence')
const im = read(imagePath); const ocr = JSON.parse(fs.readFileSync(ocrPath, 'utf8'))
if (ocr.image.width !== im.width || ocr.image.height !== im.height || ocr.coordinate_frame !== 'top_left_xy_pixel_edges') throw new Error('OCR coordinate frame mismatch')
function pixel (x, y) {
  if (x >= 0 && y >= 0 && x < im.width && y < im.height) im.data.set([220, 25, 60, 255], (y * im.width + x) * 4)
}
for (const observation of ocr.observations) {
  const b = observation.bounds_pixel_edges
  if (!Array.isArray(b) || b.length !== 4 || !b.every(Number.isFinite) || b[0] < 0 || b[1] < 0 || b[2] > im.width || b[3] > im.height || b[2] <= b[0] || b[3] <= b[1]) throw new Error('Invalid OCR bounds')
  const [x0, y0, x1, y1] = b.map(Math.round)
  for (let x = x0; x <= x1; x++) { pixel(x, y0); pixel(x, y1) }
  for (let y = y0; y <= y1; y++) { pixel(x0, y); pixel(x1, y) }
}
write(outputPath, im)
