// Additional real-paper REPRESENTATION replays, not automatic recognition.
const fs = require('node:fs'); const path = require('node:path'); const crypto = require('node:crypto')
const Assisted = require('../../../../elements/pl-sketch/star-assisted.js')
const Adaptive = require('../../../../elements/pl-sketch/star-adaptive-geometry.js')
function cases () {
  const parent = path.resolve(__dirname, '../step-4c'); const input = require('../step-4c/operator-actions.json')
  return input.cases.map(c => {
    const image = path.resolve(parent, c.image); if (crypto.createHash('sha256').update(fs.readFileSync(image)).digest('hex') !== c.sha256) throw Error('Frozen real-paper image changed.')
    const [width, height] = c.image_size; const a = c.calibration
    const geometry = Assisted.fromTrace({ width, height, processingWidth: width, processingHeight: height, origin: a.origin, xMarker: a.x_marker, yMarker: a.y_marker, xValue: a.x_value, yValue: a.y_value, strokes: c.pointer_strokes, inputRevision: 0 })
    const points = geometry.strokes.flatMap(s => s.vertices.map(v => v.graph)); const xs = points.map(p => p[0]); const ys = points.map(p => p[1])
    const config = { width: 800, height: 600, xrange: [Math.floor(Math.min(0, ...xs)) - 1, Math.ceil(Math.max(0, ...xs)) + 1], yrange: [Math.floor(Math.min(0, ...ys)) - 1, Math.ceil(Math.max(0, ...ys)) + 1], assistedPhotoGeometry: true, editablePhotoDraftTool: 'poly', adaptivePhotoSplineTool: 'smooth', plugins: [{ id: 'ink', name: 'freeform', label: 'Free draw' }, { id: 'poly', name: 'polyline', label: 'Original trace' }, { id: 'smooth', name: 'spline', label: 'Smooth curve' }, { id: 'dots', name: 'point', label: 'Points' }] }
    return { id: c.id, image, sha256: c.sha256, source_kind: 'real_photo_with_frozen_manual_trace_replay', automatic_recognition: false, calibration_evidence: a.evidence, geometry, config, plan: Adaptive.plan(geometry, config) }
  })
}
module.exports = { cases }
if (require.main === module) console.log(JSON.stringify(cases().map(c => ({ id: c.id, source_kind: c.source_kind, source_branches: c.geometry.strokes.length, original_handles: c.plan.original_handle_count, handles: c.plan.handle_count, spline_count: c.plan.spline_count, polyline_count: c.plan.polyline_count, calibration_evidence: c.calibration_evidence })), null, 2))
