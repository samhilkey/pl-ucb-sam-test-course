/* global StarNative, StarProviders, StarCVAssisted */
// Recognition sees pixels only. Human calibration/review is separately labeled.
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
      <header><div><h5 id="${id}-automatic-heading">Review your graph photo</h5><div class="star-auto-progress" aria-label="Progress">Photo <span aria-hidden="true">→</span> Recognition <span aria-hidden="true">→</span> Review & import</div></div><button type="button" class="btn btn-light border star-auto-close">Close</button></header>
      <div class="star-auto-body" tabindex="0" role="region" aria-label="Photo recognition comparison">
        <label class="star-auto-upload">Graph photo <input type="file" accept="image/png,image/jpeg,image/webp" capture="environment"></label>
        <p class="star-auto-method">CV automatic · experimental · processed on this device</p>
        <p class="star-auto-status" role="status">Choose a photo to detect its graph strokes.</p>
        <section class="star-auto-calibration" aria-label="Confirm axes and scale" hidden>
          <h6>Confirm axes and scale</h6><p>On your photo, place O at (0, 0), X at a known value on the x-axis, and Y at a known value on the y-axis. Set each axis independently.</p>
          <div class="star-auto-axis-controls"><div class="star-auto-marker-buttons"><button type="button" class="btn btn-light border" data-marker="origin">Place O</button><button type="button" class="btn btn-light border" data-marker="xMarker">Place X</button><button type="button" class="btn btn-light border" data-marker="yMarker">Place Y</button></div><label>X value <input class="star-auto-x-value" type="number" step="any" placeholder="e.g. 3"></label><label>Y value <input class="star-auto-y-value" type="number" step="any" placeholder="e.g. 3"></label></div>
          <p class="star-auto-marker-help">Choose a marker, then click its position on the photo. Arrow keys move a placed marker by one photo pixel; Shift moves ten.</p>
          <label><input class="star-auto-calibration-ack" type="checkbox"> O and both axis values match my photo.</label>
        </section>
        <div class="star-auto-comparison" hidden>
          <figure><div class="star-auto-figure-title">Original photograph</div><canvas class="star-auto-photo" tabindex="0" aria-label="Original photograph. During calibration, click to place the selected axis marker; arrow keys adjust it."></canvas><figcaption><span class="star-auto-photo-name"></span><label><input class="star-auto-overlay" type="checkbox"> Show detected lines on photo</label></figcaption></figure>
          <figure class="star-auto-proposal" hidden><div class="star-auto-preview-title">Pixel-space preview · scale unconfirmed</div><svg class="star-auto-preview" role="group" aria-label="Detected geometry"></svg><figcaption class="star-auto-preview-caption"></figcaption></figure>
        </div>
        <section class="star-auto-selection" aria-label="Review branches and small marks" hidden>
          <h6>Choose the graph ink</h6><p>Click a line in the pixel preview to keep it. Click again to exclude it. Keep connecting graph segments; exclude axes, labels and grid lines. Only exact shared endpoints join.</p>
          <div class="star-auto-selection-actions"><button type="button" class="btn btn-light border star-auto-exclude-rest">Exclude remaining lines</button><span class="star-auto-selection-count" aria-live="polite"></span></div>
          <details class="star-auto-line-details"><summary>Review lines individually</summary><div class="star-auto-lines"></div></details>
          <div class="star-auto-marks"></div>
          <label class="star-auto-geometry-review"><input class="star-auto-reviewed" type="checkbox"> My selected branches, gaps, corners, endpoints and filled dots match the entire photo.</label>
          <p>Missing ink, open circles and arrow semantics need manual correction. Selection does not improve the detected line positions.</p>
        </section>
        <p class="star-auto-edit-help" hidden>After import, use Select to move or delete a branch or dot. Existing drawings will be kept. Individual vertex editing is not available.</p>
        <details class="star-auto-technical" hidden><summary>Technical details & recognition uncertainty</summary><p class="star-auto-diagnostics"></p><ul class="star-auto-warnings" aria-label="Recognition issues"></ul></details>
      </div>
      <footer><label class="star-auto-ack-label" hidden><input class="star-auto-ack" type="checkbox" disabled> This matches the marks on my paper, including any mistakes.</label>
        <p class="star-auto-disabled-help" role="status">A photo and reviewed geometry are required before import.</p>
        <div class="star-auto-actions"><div class="star-auto-secondary"><button type="button" class="btn btn-light border star-auto-correct" disabled>Trace manually</button><button type="button" class="btn btn-light border star-auto-retry" disabled>Retry detection</button><button type="button" class="btn btn-light border star-auto-reject" disabled>Reject</button><button type="button" class="btn btn-light border star-auto-back" hidden>Edit review</button></div><button type="button" class="btn btn-primary star-auto-next" hidden>Continue with detected strokes</button><button type="button" class="btn btn-primary star-auto-confirm" disabled>Confirm and add graph</button></div>
      </footer>`
    container.append(dialog)
    const q = selector => dialog.querySelector(selector)
    const canvas = q('.star-auto-photo'); const status = q('.star-auto-status')
    const session = StarNative.createSession(si, config)
    const cvSession = StarNative.createSession(si, config, undefined, { cvAssisted: true })
    let revision = 0; let proposal = null; let geometry = null; let photo = null; let file = null; let busy = false
    let phase = 'empty'; let method = 'CV automatic'; let hash = ''; let marker = 'origin'; let axes = {}; let decisions = {}; let markDecisions = {}; let smallMarks = []
    const cvEnabled = () => config.assistedPhotoGeometry === true && method === 'CV automatic' && geometry?.strokes.length > 0
    const axisValues = () => ({ ...axes, xValue: q('.star-auto-x-value').value === '' ? NaN : Number(q('.star-auto-x-value').value), yValue: q('.star-auto-y-value').value === '' ? NaN : Number(q('.star-auto-y-value').value), confirmed: q('.star-auto-calibration-ack').checked })
    const build = () => StarCVAssisted.fromSelection({ source: geometry, photoSha256: hash, axisValues: axisValues(), strokeDecisions: decisions, markDecisions, reviewed: q('.star-auto-reviewed').checked, inputRevision: revision })
    function invalidate () {
      session.invalidate(++revision); cvSession.invalidate(revision); proposal = null
      q('.star-auto-ack').checked = false; q('.star-auto-ack').disabled = true; q('.star-auto-confirm').disabled = true
    }
    function clear () {
      invalidate(); geometry = null; smallMarks = []; phase = 'empty'; hash = ''; axes = {}; decisions = {}; markDecisions = {}
      q('.star-auto-comparison').hidden = true; q('.star-auto-proposal').hidden = true; q('.star-auto-edit-help').hidden = true
      q('.star-auto-warnings').replaceChildren(); q('.star-auto-preview').replaceChildren(); q('.star-auto-technical').hidden = true
      q('.star-auto-calibration-ack').checked = false; q('.star-auto-reviewed').checked = false
      q('.star-auto-x-value').value = ''; q('.star-auto-y-value').value = ''; q('.star-auto-reject').disabled = true
      q('.star-auto-technical').open = false; q('.star-auto-line-details').open = false
      update()
    }
    function update (error) {
      q('.star-auto-calibration').hidden = phase !== 'calibration'
      q('.star-auto-selection').hidden = phase !== 'selection'
      q('.star-auto-back').hidden = !['selection', 'preview'].includes(phase) || method !== 'CV-assisted'
      q('.star-auto-ack-label').hidden = phase !== 'preview'
      q('.star-auto-correct').hidden = typeof onAssist !== 'function'; q('.star-auto-correct').disabled = !file || busy
      const next = q('.star-auto-next'); next.hidden = !(['calibration', 'selection'].includes(phase) || phase === 'detected' && cvEnabled()); next.disabled = busy
      q('.star-auto-confirm').hidden = phase !== 'preview'
      const manualPrimary = phase === 'detected' && !cvEnabled() && !proposal && !busy
      q('.star-auto-correct').classList.toggle('btn-primary', manualPrimary); q('.star-auto-correct').classList.toggle('btn-light', !manualPrimary)
      let help = 'A photo and reviewed geometry are required before import.'
      if (phase === 'detected') help = cvEnabled() ? 'Continue to confirm axes and review the detected ink. Nothing is ready to import yet.' : 'This result needs manual tracing or a clearer photo before import.'
      if (phase === 'detected') next.textContent = 'Continue with detected strokes'
      if (phase === 'calibration') {
        next.textContent = 'Review detected lines'
        try { StarCVAssisted.calibration(geometry.image, axisValues()); help = 'Axes confirmed. Continue to choose the graph ink.' } catch (e) { help = e.message; next.disabled = true }
        for (const b of dialog.querySelectorAll('[data-marker]')) { b.setAttribute('aria-pressed', String(b.dataset.marker === marker)); b.textContent = (axes[b.dataset.marker] ? 'Move ' : 'Place ') + ({ origin: 'O', xMarker: 'X', yMarker: 'Y' })[b.dataset.marker] }
      }
      if (phase === 'selection') {
        next.textContent = 'Preview graph'
        try { build(); help = 'Review complete. Preview the calibrated graph before importing.' } catch (e) { help = e.message; next.disabled = true }
        q('.star-auto-selection-count').textContent = `${Object.values(decisions).filter(v => v === 'keep').length} kept · ${geometry.strokes.length - Object.keys(decisions).length} not reviewed`
      }
      if (phase === 'preview') help = q('.star-auto-ack').checked ? 'Ready to add the reviewed graph. Existing drawings will be kept.' : 'Compare both views, then check the confirmation box to enable import.'
      q('.star-auto-disabled-help').textContent = error || help
      q('.star-auto-confirm').disabled = busy || !proposal || !q('.star-auto-ack').checked
      q('.star-auto-method').textContent = method + ' · experimental · processed on this device'
    }
    function drawPhoto () {
      if (!photo) return
      canvas.width = photo.width; canvas.height = photo.height
      const ctx = canvas.getContext('2d'); ctx.putImageData(photo, 0, 0)
      if (geometry && q('.star-auto-overlay').checked) for (const s of geometry.strokes) {
        if (decisions[s.id] === 'exclude') continue
        ctx.strokeStyle = decisions[s.id] === 'keep' ? '#075aaa' : '#b45b00'; ctx.lineWidth = Math.max(2, photo.width / 400)
        ctx.beginPath(); s.vertices.forEach((v, i) => i ? ctx.lineTo(...v.pixel) : ctx.moveTo(...v.pixel)); ctx.stroke()
      }
      if (method === 'CV-assisted') {
        const colors = { origin: '#111827', xMarker: '#a43116', yMarker: '#075aaa' }
        for (const [name, p] of Object.entries(axes)) {
          ctx.strokeStyle = colors[name]; ctx.fillStyle = colors[name]; ctx.lineWidth = photo.width / 300
          ctx.beginPath(); ctx.arc(...p, photo.width / 65, 0, Math.PI * 2); ctx.stroke()
          ctx.font = `bold ${photo.width / 35}px system-ui`; ctx.fillText({ origin: 'O', xMarker: 'X', yMarker: 'Y' }[name], p[0] + photo.width / 50, p[1] - photo.width / 70)
        }
      }
    }
    function svgElement (tag, attrs) {
      const el = document.createElementNS('http://www.w3.org/2000/svg', tag)
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
      q('.star-auto-preview').append(el); return el
    }
    function preview (prepared) {
      const svg = q('.star-auto-preview'); svg.replaceChildren(); svg.setAttribute('viewBox', `0 0 ${config.width} ${config.height}`)
      svgElement('rect', { width: config.width, height: config.height, fill: '#fff' })
      const o = StarNative.graphToNative(config, [0, 0])
      if (o.x >= 0 && o.x <= config.width) svgElement('line', { x1: o.x, y1: 0, x2: o.x, y2: config.height, stroke: '#8394a3' })
      if (o.y >= 0 && o.y <= config.height) svgElement('line', { x1: 0, y1: o.y, x2: config.width, y2: o.y, stroke: '#8394a3' })
      // Match the receiving canvas ranges; labels make scale review possible.
      for (const axis of ['x', 'y']) for (let i = 0; i <= 8; i++) {
        const range = config[axis + 'range']; const value = range[0] + (range[1] - range[0]) * i / 8
        const p = StarNative.graphToNative(config, axis === 'x' ? [value, 0] : [0, value])
        if (Math.abs(value) < 1e-9 || p.x < 18 || p.y < 18 || p.x > config.width - 18 || p.y > config.height - 18) continue
        svgElement('line', { x1: p.x - (axis === 'y' ? 4 : 0), y1: p.y - (axis === 'x' ? 4 : 0), x2: p.x + (axis === 'y' ? 4 : 0), y2: p.y + (axis === 'x' ? 4 : 0), stroke: '#596a78' })
        const label = svgElement('text', { x: p.x + (axis === 'y' ? -9 : 0), y: p.y + (axis === 'x' ? 20 : 4), fill: '#384957', 'font-size': 16, 'text-anchor': axis === 'x' ? 'middle' : 'end' }); label.textContent = String(Number(value.toPrecision(4)))
      }
      for (const controls of prepared.drawings) svgElement('path', { d: StarNative.pathData(controls), stroke: '#075aaa', 'stroke-width': 3, fill: 'none' })
      for (const p of prepared.points) svgElement('circle', { cx: p.x, cy: p.y, r: 5, fill: '#075aaa' })
      q('.star-auto-proposal').hidden = false
      q('.star-auto-preview-title').textContent = 'Calibrated native-graph preview'
      q('.star-auto-preview-caption').textContent = method === 'CV-assisted' ? 'Your axes and selected CV pixels, mapped to the native canvas. Check positions and missing ink; no line was retraced or fitted.' : 'Validated geometry in native canvas coordinates. Compare every branch with your photo.'
    }
    function chooseLine (id, value) {
      invalidate(); if (value) decisions[id] = value; else delete decisions[id]
      q('.star-auto-reviewed').checked = false
      const select = [...dialog.querySelectorAll('.star-auto-lines select')].find(s => s.dataset.stroke === id); if (select) select.value = value
      pixelPreview(); drawPhoto(); update()
    }
    function pixelPreview () {
      const svg = q('.star-auto-preview'); svg.replaceChildren(); svg.setAttribute('viewBox', `0 0 ${photo.width} ${photo.height}`)
      svgElement('rect', { width: photo.width, height: photo.height, fill: '#fff' })
      for (const [i, s] of geometry.strokes.entries()) {
        const d = s.vertices.map((v, j) => (j ? 'L' : 'M') + v.pixel.join(' ')).join(' ')
        const selected = decisions[s.id]; const attrs = { d, stroke: selected === 'keep' ? '#075aaa' : selected === 'exclude' ? '#c4cbd2' : '#80521d', 'stroke-width': Math.max(3, photo.width / 330), fill: 'none', 'pointer-events': 'none' }
        if (selected === 'exclude') attrs['stroke-dasharray'] = '8 8'
        svgElement('path', { ...attrs, 'data-pixel-stroke': s.id })
        if (phase === 'selection') {
          const hit = svgElement('path', { d, stroke: 'transparent', 'stroke-width': Math.max(18, photo.width / 70), fill: 'none', tabindex: 0, role: 'button', 'aria-label': `Detected line ${i + 1}: ${selected || 'not reviewed'}`, 'aria-pressed': String(selected === 'keep'), 'data-stroke': s.id })
          const title = document.createElementNS('http://www.w3.org/2000/svg', 'title'); title.textContent = `Line ${i + 1}: ${selected || 'not reviewed'}. Click or press Space to keep/exclude.`; hit.append(title)
          const act = () => chooseLine(s.id, selected === 'keep' ? 'exclude' : 'keep')
          hit.addEventListener('click', act); hit.addEventListener('keydown', e => { if (['Enter', ' '].includes(e.key)) { e.preventDefault(); act(); const replacement = [...svg.querySelectorAll('[data-stroke]')].find(p => p.dataset.stroke === s.id); replacement?.focus() } })
        }
      }
      if (phase === 'selection') for (const m of smallMarks) svgElement('circle', { cx: m.pixel[0], cy: m.pixel[1], r: photo.width / 110, fill: markDecisions[m.id] === 'point' ? '#075aaa' : '#fff', stroke: '#80521d', 'stroke-width': photo.width / 500 })
      q('.star-auto-proposal').hidden = false
      q('.star-auto-preview-title').textContent = 'Pixel-space preview · ' + (method === 'CV-assisted' ? 'detected ink selection' : 'scale unconfirmed')
      q('.star-auto-preview-caption').textContent = phase === 'selection' ? 'Blue: keep. Brown: not reviewed. Dashed gray: excluded. This view uses photo pixels; preview the calibrated graph before import.' : 'Detected photo pixels only. Axes, scale, branches and small marks may still need confirmation; this is not an import preview.'
    }
    function selectionControls () {
      const lines = q('.star-auto-lines'); lines.replaceChildren()
      for (const [i, s] of geometry.strokes.entries()) {
        const label = document.createElement('label'); label.textContent = 'Line ' + (i + 1)
        const select = document.createElement('select'); select.className = 'form-control'; select.dataset.stroke = s.id
        for (const [value, text] of [['', 'Not reviewed'], ['keep', 'Keep graph ink'], ['exclude', 'Exclude']]) select.add(new Option(text, value))
        select.value = decisions[s.id] || ''; select.addEventListener('change', () => chooseLine(s.id, select.value))
        const highlight = on => { const path = [...q('.star-auto-preview').querySelectorAll('[data-pixel-stroke]')].find(p => p.dataset.pixelStroke === s.id); if (path) { path.style.stroke = on ? '#b44110' : ''; path.style.strokeWidth = on ? String(photo.width / 120) : '' } }
        label.addEventListener('mouseenter', () => highlight(true)); label.addEventListener('mouseleave', () => highlight(false)); select.addEventListener('focus', () => highlight(true)); select.addEventListener('blur', () => highlight(false))
        label.append(select); lines.append(label)
      }
      const target = q('.star-auto-marks'); target.replaceChildren()
      if (smallMarks.length) { const h = document.createElement('h6'); h.textContent = 'Review each small mark'; target.append(h) }
      for (const [i, m] of smallMarks.entries()) {
        const label = document.createElement('label'); label.className = 'star-auto-mark'
        const crop = document.createElement('canvas'); crop.width = crop.height = 100; crop.setAttribute('aria-label', 'Photo crop for small mark ' + (i + 1))
        const source = document.createElement('canvas'); source.width = photo.width; source.height = photo.height; source.getContext('2d').putImageData(photo, 0, 0)
        const size = Math.max(70, m.bounds_pixel[1][0] - m.bounds_pixel[0][0] + 32, m.bounds_pixel[1][1] - m.bounds_pixel[0][1] + 32)
        crop.getContext('2d').drawImage(source, m.pixel[0] - size / 2, m.pixel[1] - size / 2, size, size, 0, 0, 100, 100)
        const span = document.createElement('span'); span.textContent = 'Small mark ' + (i + 1)
        const select = document.createElement('select'); select.className = 'form-control'; select.dataset.mark = m.id
        for (const [v, t] of [['', 'Not reviewed'], ['point', 'Keep as filled dot'], ['exclude', 'Exclude text / axis / fragment']]) select.add(new Option(t, v))
        select.value = markDecisions[m.id] || ''; select.addEventListener('change', () => { invalidate(); if (select.value) markDecisions[m.id] = select.value; else delete markDecisions[m.id]; q('.star-auto-reviewed').checked = false; pixelPreview(); update() })
        span.append(select); label.append(crop, span); target.append(label)
      }
    }
    async function analyze () {
      clear(); const request = revision
      if (!file) { busy = false; q('.star-auto-retry').disabled = true; status.textContent = 'Choose a photo to detect its graph strokes.'; return }
      busy = true; q('.star-auto-retry').disabled = true; method = 'CV automatic'; status.textContent = 'Detecting strokes on this device…'; update()
      let bitmap
      try {
        const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
        if (request !== revision) return
        hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
        try { bitmap = await window.createImageBitmap(file, { imageOrientation: 'from-image' }) } catch (_) { bitmap = await window.createImageBitmap(file) }
        if (request !== revision) return
        if (bitmap.width * bitmap.height > 40000000) throw new Error('Choose an image smaller than 40 megapixels.')
        const source = document.createElement('canvas'); source.width = bitmap.width; source.height = bitmap.height
        const ctx = source.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bitmap, 0, 0)
        photo = ctx.getImageData(0, 0, source.width, source.height)
        // Only RGBA pixels and a revision enter recognition. No answer/config.
        const result = await StarProviders.recognize(photo, { inputRevision: request })
        if (request !== revision) return
        geometry = result.geometry; method = result.method; smallMarks = StarCVAssisted.marks(geometry); phase = 'detected'
        q('.star-auto-photo-name').textContent = file.name
        drawPhoto(); q('.star-auto-comparison').hidden = false; q('.star-auto-reject').disabled = false
        q('.star-auto-warnings').replaceChildren(...geometry.warnings.map(w => { const li = document.createElement('li'); li.textContent = w.message; return li }))
        q('.star-auto-technical').hidden = false
        q('.star-auto-diagnostics').textContent = `${result.method}: ${geometry.status}. ${geometry.strokes.length} paths; axes ${geometry.coordinate_frame.status}; scale ${geometry.calibration.status}; ${smallMarks.length} small components. Confidence is heuristic, not a probability. Thin or unsupported ink may be missed. Review the entire photo. CV-assisted joins only exact degree-two endpoints, with no gap filling or equation fitting.`
        pixelPreview()
        try {
          proposal = session.propose(geometry); phase = 'preview'; preview(proposal)
          q('.star-auto-ack').disabled = false; q('.star-auto-edit-help').hidden = false
          status.textContent = 'Graph detected. Compare it with your photo before importing.'
        } catch (_) {
          proposal = null; status.textContent = geometry.strokes.length ? 'Curves detected; axes and ink need confirmation.' : 'No usable graph strokes detected. Trace manually or try a clearer photo.'
        }
      } catch (e) { if (request === revision) { proposal = null; status.textContent = 'Could not recognize this photo: ' + e.message } } finally {
        if (bitmap) bitmap.close()
        if (request === revision) { busy = false; q('.star-auto-retry').disabled = false; update() }
      }
    }
    function close () { clear(); busy = false; q('.star-auto-retry').disabled = !file; if (dialog.open) dialog.close(); button.focus({ preventScroll: true }) }
    button.addEventListener('click', () => dialog.showModal())
    q('.star-auto-close').addEventListener('click', close)
    dialog.addEventListener('cancel', e => { e.preventDefault(); close() })
    dialog.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && e.target.matches('input')) e.preventDefault() })
    dialog.addEventListener('keyup', e => e.stopPropagation())
    q('input[type=file]').addEventListener('change', e => { file = e.target.files[0] || null; photo = null; analyze() })
    q('.star-auto-retry').addEventListener('click', analyze)
    q('.star-auto-correct').addEventListener('click', () => { if (!file || typeof onAssist !== 'function') return; const selected = file; close(); onAssist(selected) })
    q('.star-auto-overlay').addEventListener('change', drawPhoto)
    q('.star-auto-ack').addEventListener('change', () => update())
    q('.star-auto-reject').addEventListener('click', () => { clear(); busy = false; q('.star-auto-retry').disabled = !file; status.textContent = 'Proposal rejected. No native drawing was added.' })
    q('.star-auto-next').addEventListener('click', () => {
      if (busy || q('.star-auto-next').disabled) return
      try {
        if (phase === 'detected' && cvEnabled()) { invalidate(); method = 'CV-assisted'; phase = 'calibration'; marker = 'origin'; status.textContent = 'Keep your detected strokes. Confirm axes and scale on this same photo.'; pixelPreview(); drawPhoto() } else if (phase === 'calibration') {
          StarCVAssisted.calibration(geometry.image, axisValues()); phase = 'selection'; selectionControls(); pixelPreview(); status.textContent = 'Keep graph ink; exclude axes, labels and fragments. Review every small mark.'
        } else if (phase === 'selection') {
          const corrected = build(); proposal = cvSession.propose(corrected); phase = 'preview'; preview(proposal); q('.star-auto-ack').disabled = false; q('.star-auto-edit-help').hidden = false
          status.textContent = 'CV-assisted graph ready for your final review. Nothing has been added yet.'
        }
        update()
      } catch (e) { proposal = null; update(e.message) }
    })
    q('.star-auto-back').addEventListener('click', () => { invalidate(); phase = phase === 'preview' ? 'selection' : 'calibration'; q('.star-auto-edit-help').hidden = true; if (phase === 'selection') selectionControls(); pixelPreview(); drawPhoto(); update() })
    for (const b of dialog.querySelectorAll('[data-marker]')) b.addEventListener('click', () => { marker = b.dataset.marker; q('.star-auto-marker-help').textContent = `Place ${b.textContent.split(' ').at(-1)} on the photo. Arrow keys adjust a placed marker; Shift moves ten pixels.`; update(); canvas.focus() })
    function place (p) {
      invalidate(); axes[marker] = p.map((v, i) => Math.max(0, Math.min(v, [photo.width - 1, photo.height - 1][i])))
      q('.star-auto-calibration-ack').checked = false; q('.star-auto-reviewed').checked = false; drawPhoto(); update()
    }
    canvas.addEventListener('click', e => { if (phase !== 'calibration') return; const b = canvas.getBoundingClientRect(); place([(e.clientX - b.left) * photo.width / b.width, (e.clientY - b.top) * photo.height / b.height]) })
    canvas.addEventListener('keydown', e => { if (phase !== 'calibration' || !axes[marker] || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return; e.preventDefault(); const d = e.shiftKey ? 10 : 1; const p = axes[marker].slice(); p[0] += e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0; p[1] += e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0; place(p) })
    for (const selector of ['.star-auto-x-value', '.star-auto-y-value', '.star-auto-calibration-ack', '.star-auto-reviewed']) q(selector).addEventListener(selector.includes('value') ? 'input' : 'change', () => { invalidate(); if (selector.includes('value')) { q('.star-auto-calibration-ack').checked = false; q('.star-auto-reviewed').checked = false } update() })
    q('.star-auto-exclude-rest').addEventListener('click', () => { invalidate(); for (const s of geometry.strokes) decisions[s.id] ||= 'exclude'; q('.star-auto-reviewed').checked = false; selectionControls(); pixelPreview(); drawPhoto(); update() })
    q('.star-auto-confirm').addEventListener('click', () => {
      if (busy || !proposal || q('.star-auto-confirm').disabled || !q('.star-auto-ack').checked) return
      try { (method === 'CV-assisted' ? cvSession : session).commit(proposal.token, true); close(); status.textContent = 'Graph added. Use Select to move or delete a branch or dot.' } catch (e) { invalidate(); update(e.message); status.textContent = e.message; q('.star-auto-back').hidden = method !== 'CV-assisted'; q('.star-auto-retry').disabled = false }
    })
  }
  return { mount }
})()
