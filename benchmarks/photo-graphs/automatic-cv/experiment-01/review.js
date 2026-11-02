/* global StarRecognition, StarGeometry */
// Evidence viewer, independent of PrairieLearn. Never writes native state.
'use strict'
const status = document.getElementById('live-status')
const canvas = document.getElementById('live-overlay')
const download = document.getElementById('download')
let revision = 0; let downloadUrl
window.latestRecognition = null
async function run (blob, name) {
  const current = ++revision
  window.latestRecognition = null; canvas.hidden = true; download.hidden = true
  if (downloadUrl) URL.revokeObjectURL(downloadUrl)
  status.textContent = 'Reading ' + name + '…'
  let bitmap
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
    if (current !== revision) return
    if (bitmap.width * bitmap.height > 40000000) throw new Error('Image exceeds the 40 megapixel input limit.')
    canvas.width = bitmap.width; canvas.height = bitmap.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(bitmap, 0, 0)
    const result = StarRecognition.recognize(ctx.getImageData(0, 0, canvas.width, canvas.height), { inputRevision: current })
    const g = StarGeometry.validate(result.geometry)
    if (current !== revision) return
    const line = (a, b, color, width) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke() }
    for (const x of g.coordinate_frame.grid.x.lines_pixel) line([x, 0], [x, canvas.height], '#1eaa5555', 1)
    for (const y of g.coordinate_frame.grid.y.lines_pixel) line([0, y], [canvas.width, y], '#1eaa5555', 1)
    for (const axis of ['x', 'y']) for (const c of g.coordinate_frame.axes[axis].candidates) line(c.start, c.end, '#00aadcaa', 3)
    const d = result.debug
    ctx.fillStyle = '#2832eb'
    for (let k = 0; k < d.skeleton.length; k++) if (d.skeleton[k]) ctx.fillRect((k % d.width + 0.5) * canvas.width / d.width - 1.5, (Math.floor(k / d.width) + 0.5) * canvas.height / d.height - 1.5, 3, 3)
    for (const s of g.strokes) {
      s.vertices.slice(1).forEach((v, i) => line(s.vertices[i].pixel, v.pixel, '#f07500', 1.5))
      for (const v of s.vertices) if (v.corner || v.endpoint) {
        ctx.strokeStyle = v.corner ? '#dc193c' : '#009141'; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(...v.pixel, 4, 0, Math.PI * 2); ctx.stroke()
      }
    }
    window.latestRecognition = g
    status.textContent = name + ': ' + g.status + ' · ' + g.strokes.length + ' paths · calibration ' + g.calibration.status + (g.warnings.length ? ' · ' + g.warnings.map(w => w.code).join(', ') : '')
    canvas.hidden = false
    downloadUrl = URL.createObjectURL(new Blob([JSON.stringify(g, null, 2)], { type: 'application/json' }))
    download.href = downloadUrl; download.download = 'photo-geometry.json'; download.hidden = false
  } catch (err) { if (current === revision) status.textContent = 'Recognition failed: ' + err.message } finally { if (bitmap) bitmap.close() }
}
document.getElementById('upload').addEventListener('change', e => { if (e.target.files[0]) run(e.target.files[0], e.target.files[0].name) })
async function load () {
  const response = await fetch('results/summary.json')
  if (!response.ok) throw new Error('Run evaluate.cjs before serving the gallery.')
  const report = await response.json(); const c = report.counts
  document.getElementById('summary').textContent = c.supported_controlled_automatic + '/' + c.supported_controlled_cases + ' supported controlled cases automatic; ' + c.controlled_challenge_automatic + '/' + c.controlled_challenge_cases + ' controlled challenges automatic; ' + c.real_photo_automatic + '/' + c.real_photo_cases + ' real-photo cases automatic.'
  for (const outcome of report.outcomes) {
    const article = document.createElement('article'); const heading = document.createElement('h2'); heading.textContent = outcome.id; article.append(heading)
    const details = document.createElement('p'); details.className = 'status' + (outcome.status === 'automatic' ? '' : ' review')
    details.textContent = outcome.source_kind + ' · ' + outcome.status + ' · ' + outcome.metrics.extracted_paths + ' paths · scale ' + outcome.calibration
    article.append(details)
    const warnings = document.createElement('p'); warnings.className = 'meta'; warnings.textContent = outcome.warnings.join(', ') || 'No recognition warnings within the constrained supported vocabulary.'; article.append(warnings)
    const figures = document.createElement('div'); figures.className = 'comparison'
    for (const [src, label] of [[outcome.input, 'Original input'], ['results/' + outcome.id + '.overlay.png', 'Detected axes/grid, skeleton and proposed geometry'], ['results/' + outcome.id + '.proposal.png', 'Proposed geometry in image space — not native import']]) {
      const figure = document.createElement('figure'); const img = document.createElement('img'); img.src = src; img.alt = outcome.id + ': ' + label; img.loading = 'lazy'
      const caption = document.createElement('figcaption'); caption.textContent = label; figure.append(img, caption); figures.append(figure)
    }
    article.append(figures)
    const links = document.createElement('p'); links.className = 'row'
    const button = document.createElement('button'); button.textContent = 'Re-run ' + outcome.id
    button.addEventListener('click', async () => { const r = await fetch(outcome.input); run(await r.blob(), outcome.id); document.getElementById('live').scrollIntoView({ block: 'start' }) })
    links.append(button)
    for (const [suffix, label] of [['geometry.json', 'Geometry JSON'], ['ink.png', 'Ink mask'], ['skeleton.png', 'Skeleton mask'], ['paths.json', 'Raw paths']]) {
      const a = document.createElement('a'); a.href = 'results/' + outcome.id + '.' + suffix; a.textContent = label; links.append(a)
    }
    article.append(links); document.getElementById('cases').append(article)
  }
}
load().catch(err => { document.getElementById('summary').textContent = err.message })
