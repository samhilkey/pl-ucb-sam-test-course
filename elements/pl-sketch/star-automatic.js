/* global StarNative, StarProviders */
// Opt-in automatic photo review. Recognition never receives the native config.
window.StarAutomatic = (function () {
  'use strict'
  function mount ({ id, si, config, onAssist }) {
    const container = document.getElementById(id + '-si-container')
    if (!container || document.getElementById(id + '-automatic-button')) return
    const button = document.createElement('button')
    button.type = 'button'; button.id = id + '-automatic-button'; button.className = 'btn btn-primary star-automatic-button'
    button.textContent = 'Recognize a graph photo'
    const manualButton = document.getElementById(id + '-star-photo-btn')
    container.insertBefore(button, manualButton ? manualButton.parentElement : null)
    const dialog = document.createElement('dialog')
    dialog.id = id + '-automatic-dialog'; dialog.className = 'star-automatic-dialog'
    dialog.setAttribute('aria-labelledby', id + '-automatic-heading')
    dialog.innerHTML = `
      <header><h5 id="${id}-automatic-heading">Review your recognized graph</h5><button type="button" class="btn btn-light border star-auto-close">Close</button></header>
      <div class="star-auto-body" tabindex="0" role="region" aria-label="Photo recognition comparison">
        <p>Choose a clear graph-paper image with dark, thick graph strokes and readable numeric axis labels. Recognition is experimental.</p>
        <p class="star-auto-method">Method: CV automatic · local pixels only</p>
        <label class="star-auto-upload">Graph photo <input type="file" accept="image/png,image/jpeg,image/webp" capture="environment"></label>
        <p class="star-auto-status" role="status">Choose a photo to recognize its graph.</p>
        <div class="star-auto-comparison" hidden>
          <figure><canvas class="star-auto-photo" aria-label="Original photograph with extracted graph overlay"></canvas><figcaption>Photo and extracted strokes <label><input class="star-auto-overlay" type="checkbox" checked> Show overlay</label></figcaption></figure>
          <figure class="star-auto-proposal" hidden><svg class="star-auto-preview" role="img" aria-label="Detected geometry"></svg><figcaption class="star-auto-preview-caption"></figcaption></figure>
        </div>
        <p class="star-auto-diagnostics" hidden></p>
        <ul class="star-auto-warnings" aria-label="Recognition issues"></ul>
        <p class="star-auto-edit-help" hidden>After import, use Select to move or delete an entire branch. Individual landmark correction is not available yet.</p>
      </div>
      <footer>
        <label><input class="star-auto-ack" type="checkbox" disabled> This matches the marks on my paper, including any mistakes.</label>
        <div class="star-auto-actions"><button type="button" class="btn btn-light border star-auto-retry" disabled>Analyze again</button><button type="button" class="btn btn-light border star-auto-reject" disabled>Reject proposal</button><button type="button" class="btn btn-light border star-auto-correct" disabled>Correct recognition / Use manual tracing</button><button type="button" class="btn btn-success star-auto-confirm" disabled>Confirm and add graph</button></div>
      </footer>`
    container.append(dialog)
    const q = selector => dialog.querySelector(selector)
    const canvas = q('.star-auto-photo'); const status = q('.star-auto-status')
    const session = StarNative.createSession(si, config)
    let revision = 0; let proposal = null; let geometry = null; let marks = []; let photo = null; let file = null; let busy = false
    q('.star-auto-correct').hidden = typeof onAssist !== 'function'
    function clear () {
      session.invalidate(++revision); proposal = null; geometry = null; marks = []
      q('.star-auto-ack').checked = false; q('.star-auto-ack').disabled = true
      q('.star-auto-confirm').disabled = true; q('.star-auto-reject').disabled = true
      q('.star-auto-comparison').hidden = true; q('.star-auto-proposal').hidden = true
      q('.star-auto-edit-help').hidden = true; q('.star-auto-warnings').replaceChildren()
      q('.star-auto-preview').replaceChildren()
      q('.star-auto-diagnostics').hidden = true
      q('.star-auto-correct').disabled = !file
    }
    function drawPhoto () {
      if (!photo) return
      canvas.width = photo.width; canvas.height = photo.height
      const ctx = canvas.getContext('2d'); ctx.putImageData(photo, 0, 0)
      if (!geometry || !q('.star-auto-overlay').checked) return
      ctx.strokeStyle = '#ed7200'; ctx.lineWidth = Math.max(1.5, photo.width / 450)
      for (const stroke of geometry.strokes) {
        ctx.beginPath(); stroke.vertices.forEach((v, i) => i ? ctx.lineTo(...v.pixel) : ctx.moveTo(...v.pixel)); ctx.stroke()
        for (const v of stroke.vertices) if (v.corner || v.endpoint) {
          ctx.beginPath(); ctx.arc(...v.pixel, Math.max(3, photo.width / 170), 0, Math.PI * 2)
          ctx.strokeStyle = v.corner ? '#c42648' : '#168043'; ctx.stroke(); ctx.strokeStyle = '#ed7200'
        }
      }
      ctx.strokeStyle = '#0085af'; ctx.lineWidth = 1.5
      for (const axis of ['x', 'y']) for (const line of geometry.coordinate_frame.axes[axis].candidates) {
        ctx.beginPath(); ctx.moveTo(...line.start); ctx.lineTo(...line.end); ctx.stroke()
      }
      ctx.strokeStyle = '#ae1888'
      for (const mark of marks) {
        const [a, b] = mark.bounds_pixel
        ctx.strokeRect(a[0] - 3, a[1] - 3, b[0] - a[0] + 6, b[1] - a[1] + 6)
      }
    }
    function preview (prepared) {
      const svg = q('.star-auto-preview'); const ns = 'http://www.w3.org/2000/svg'
      svg.replaceChildren(); svg.setAttribute('viewBox', `0 0 ${config.width} ${config.height}`)
      const add = (tag, attributes) => { const el = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, value); svg.append(el) }
      add('rect', { width: config.width, height: config.height, fill: '#fff' })
      const origin = StarNative.graphToNative(config, [0, 0])
      if (origin.x >= 0 && origin.x <= config.width) add('line', { x1: origin.x, y1: 0, x2: origin.x, y2: config.height, stroke: '#8394a3' })
      if (origin.y >= 0 && origin.y <= config.height) add('line', { x1: 0, y1: origin.y, x2: config.width, y2: origin.y, stroke: '#8394a3' })
      for (const controls of prepared.drawings) add('path', { d: StarNative.pathData(controls), stroke: '#ce6200', 'stroke-width': 3, fill: 'none' })
      q('.star-auto-proposal').hidden = false
      q('.star-auto-preview-caption').textContent = 'Validated proposal in native canvas coordinates. Existing native drawings will be kept.'
    }
    function pixelPreview () {
      const svg = q('.star-auto-preview'); const ns = 'http://www.w3.org/2000/svg'
      svg.replaceChildren(); svg.setAttribute('viewBox', `0 0 ${photo.width} ${photo.height}`)
      const background = document.createElementNS(ns, 'rect')
      background.setAttribute('width', photo.width); background.setAttribute('height', photo.height); background.setAttribute('fill', '#fff'); svg.append(background)
      for (const s of geometry.strokes) {
        const path = document.createElementNS(ns, 'path')
        path.setAttribute('d', s.vertices.map((v, i) => (i ? 'L' : 'M') + v.pixel.join(' ')).join(' '))
        path.setAttribute('stroke', '#ce6200'); path.setAttribute('stroke-width', Math.max(2, photo.width / 350)); path.setAttribute('fill', 'none'); svg.append(path)
      }
      q('.star-auto-proposal').hidden = false
      q('.star-auto-preview-caption').textContent = 'Incomplete pixel-space detection only. No mathematical scale or native import is implied. Blank areas mean no extracted paths.'
    }
    async function analyze () {
      clear(); const request = revision
      if (!file) { busy = false; q('.star-auto-retry').disabled = true; status.textContent = 'Choose a photo to recognize its graph.'; return }
      busy = true; q('.star-auto-retry').disabled = true; status.textContent = 'Recognizing the photo…'
      let bitmap
      try {
        try { bitmap = await window.createImageBitmap(file, { imageOrientation: 'from-image' }) } catch (_) { bitmap = await window.createImageBitmap(file) }
        if (request !== revision) return
        if (bitmap.width * bitmap.height > 40000000) throw new Error('Choose an image smaller than 40 megapixels.')
        const source = document.createElement('canvas'); source.width = bitmap.width; source.height = bitmap.height
        const ctx = source.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bitmap, 0, 0)
        photo = ctx.getImageData(0, 0, source.width, source.height)
        // Only RGBA pixels and a revision enter recognition. No answer/config.
        const result = await StarProviders.recognize(photo, { inputRevision: request })
        if (request !== revision) return
        geometry = result.geometry; marks = result.marks
        q('.star-auto-method').textContent = 'Method: ' + result.method + ' · local pixels only'
        drawPhoto(); q('.star-auto-comparison').hidden = false; q('.star-auto-reject').disabled = false
        q('.star-auto-warnings').replaceChildren(...geometry.warnings.map(w => { const li = document.createElement('li'); li.textContent = w.message; return li }))
        q('.star-auto-diagnostics').hidden = false
        q('.star-auto-diagnostics').textContent = `${result.method}: ${geometry.status}. ${geometry.strokes.length} paths in ${geometry.topology.component_count} components; axes ${geometry.coordinate_frame.status}; scale ${geometry.calibration.status}. Orange: extracted paths; green: endpoints; red: corners; cyan: axis candidates; purple: ${marks.length} small components (including axis-intersection residue). Small marks are not imported as points. Thin or unsupported ink may be missed; compare the entire photograph. Confidence is heuristic, not a probability.`
        pixelPreview()
        try {
          proposal = session.propose(geometry); preview(proposal)
          q('.star-auto-ack').disabled = false; q('.star-auto-edit-help').hidden = false
          status.textContent = `Review ${geometry.strokes.length} extracted branch${geometry.strokes.length === 1 ? '' : 'es'} against your photo. Nothing has been added yet.`
        } catch (error) {
          proposal = null; status.textContent = `${geometry.strokes.length} candidate paths. ` + error.message + ' Choose a clearer photo, or use manual tracing with this same photo.'
        }
      } catch (error) {
        if (request === revision) { proposal = null; status.textContent = 'Could not recognize this photo: ' + error.message }
      } finally {
        if (bitmap) bitmap.close()
        if (request === revision) { busy = false; q('.star-auto-retry').disabled = false }
      }
    }
    function close () {
      clear(); busy = false; q('.star-auto-retry').disabled = !file
      if (dialog.open) dialog.close()
      button.focus({ preventScroll: true })
    }
    button.addEventListener('click', () => { dialog.showModal() })
    q('.star-auto-close').addEventListener('click', close)
    dialog.addEventListener('cancel', event => { event.preventDefault(); close() })
    dialog.addEventListener('keydown', event => { event.stopPropagation(); if (event.key === 'Enter' && !event.target.matches('button')) event.preventDefault() })
    dialog.addEventListener('keyup', event => event.stopPropagation())
    q('input[type=file]').addEventListener('change', event => { file = event.target.files[0] || null; photo = null; analyze() })
    q('.star-auto-retry').addEventListener('click', analyze)
    q('.star-auto-correct').addEventListener('click', () => {
      if (!file || typeof onAssist !== 'function') return
      const selected = file
      close() // Invalidates the automatic token before opening the fallback.
      onAssist(selected)
    })
    q('.star-auto-overlay').addEventListener('change', drawPhoto)
    q('.star-auto-ack').addEventListener('change', () => { q('.star-auto-confirm').disabled = busy || !proposal || !q('.star-auto-ack').checked })
    q('.star-auto-reject').addEventListener('click', () => { clear(); busy = false; q('.star-auto-retry').disabled = !file; status.textContent = 'Proposal rejected. No native drawing was added.' })
    q('.star-auto-confirm').addEventListener('click', () => {
      if (busy || !proposal || q('.star-auto-confirm').disabled || !q('.star-auto-ack').checked) return
      try {
        session.commit(proposal.token, true); close()
        status.textContent = 'Graph added. Use Select to move or delete a branch.'
      } catch (error) { clear(); status.textContent = error.message; q('.star-auto-retry').disabled = false }
    })
  }
  return { mount }
})()
