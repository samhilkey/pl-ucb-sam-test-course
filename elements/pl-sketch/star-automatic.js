/* global StarNative, StarProviders, StarCVAssisted */
// Recognition sees pixels only. Human calibration/review is separately labeled.
window.StarAutomatic = (function () {
  'use strict'
  function mount ({ id, si, config, onAssist, onPhotoState }) {
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
          <p class="star-auto-marker-help">Choose a marker, then click its position on the photo. On the photo, Enter places a new marker at the center for you to adjust. Arrow keys move it; Shift moves ten pixels.</p>
        </section>
        <section class="star-auto-selection" aria-label="Review your detected graph" hidden>
          <h6>Review your detected graph</h6><p>Click or tap a highlighted line on your photo to keep it. Click again to remove it. Keep separate lines and gaps as drawn.</p>
          <div class="star-auto-selection-actions"><button type="button" class="btn btn-light border star-auto-undo" disabled>Undo last change</button><span class="star-auto-selection-count" aria-live="polite">Some lines need your review.</span></div>
        </section>
        <section class="star-auto-remaining" aria-label="Review other detected lines" hidden><h6>Do any of these other lines belong to your graph?</h6><p>The orange lines still need a decision. Check their locations on your photo. Nothing is removed until you choose.</p><div><button type="button" class="btn btn-light border star-auto-dismiss-remaining">Not part of my graph</button><button type="button" class="btn btn-link star-auto-keep-editing">Keep editing lines</button></div></section>
        <div class="star-auto-comparison" hidden>
          <figure><div class="star-auto-figure-title">Original photograph</div><div class="star-auto-photo-viewport"><div class="star-auto-photo-stage"><canvas class="star-auto-photo" tabindex="0" aria-label="Original photograph. During calibration, click to place the selected axis marker; arrow keys adjust it."></canvas><svg class="star-auto-photo-overlay" role="group" aria-label="Select graph lines on your photograph"></svg></div></div><figcaption><span class="star-auto-photo-name"></span><label><input class="star-auto-overlay" type="checkbox"> Show detected lines on photo</label><button type="button" class="btn btn-light border star-auto-zoom" hidden>Zoom photo</button></figcaption></figure>
          <figure class="star-auto-proposal" hidden><div class="star-auto-preview-title">Pixel-space preview · scale unconfirmed</div><svg class="star-auto-preview" role="group" aria-label="Detected geometry"></svg><section class="star-auto-point-review" aria-label="Check separate points" hidden><p id="${id}-point-question" class="star-auto-point-question" tabindex="-1" aria-describedby="${id}-point-progress">Is this a point on your graph?</p><p id="${id}-point-progress" class="star-auto-point-progress" aria-live="polite"></p><canvas class="star-auto-point-context" aria-label="Zoomed photo region around the highlighted possible point"></canvas><div class="star-auto-point-actions" role="group" aria-labelledby="${id}-point-question"><button type="button" class="btn btn-light border" data-point-decision="point">Keep as point</button><button type="button" class="btn btn-light border" data-point-decision="exclude">Not part of graph</button><button type="button" class="btn btn-link star-auto-point-manual">Not sure / Correct manually</button></div></section><figcaption class="star-auto-preview-caption"></figcaption></figure>
        </div>
        <p class="star-auto-edit-help" hidden>After import, use Select to move or delete a branch or dot. Existing drawings will be kept. Individual vertex editing is not available.</p>
        <details class="star-auto-technical" hidden><summary>Advanced details</summary><p class="star-auto-diagnostics"></p><ul class="star-auto-warnings" aria-label="Recognition issues"></ul><details class="star-auto-line-details" hidden><summary>Advanced line editing</summary><div class="star-auto-lines"></div></details></details>
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
    let phase = 'empty'; let method = 'CV automatic'; let hash = ''; let marker = 'origin'; let axes = {}; let decisions = {}; let markDecisions = {}; let smallMarks = []; let groups = []; let history = []; let activePoint = 0; let activeCandidate = 0
    let lastGoodFile = null
    const cvEnabled = () => config.assistedPhotoGeometry === true && method === 'CV automatic' && geometry?.strokes.length > 0
    const axisValues = () => ({ ...axes, xValue: q('.star-auto-x-value').value === '' ? NaN : Number(q('.star-auto-x-value').value), yValue: q('.star-auto-y-value').value === '' ? NaN : Number(q('.star-auto-y-value').value) })
    const build = () => StarCVAssisted.fromSelection({ source: geometry, photoSha256: hash, axisValues: axisValues(), strokeDecisions: decisions, markDecisions, reviewBasis: 'explicit_decisions', inputRevision: revision })
    function invalidate () {
      session.invalidate(++revision); cvSession.invalidate(revision); proposal = null
      q('.star-auto-ack').checked = false; q('.star-auto-ack').disabled = true; q('.star-auto-confirm').disabled = true
    }
    function clear () {
      invalidate(); geometry = null; smallMarks = []; phase = 'empty'; hash = ''; axes = {}; decisions = {}; markDecisions = {}; groups = []; history = []; activePoint = 0; activeCandidate = 0
      q('.star-auto-comparison').hidden = true; q('.star-auto-proposal').hidden = true; q('.star-auto-edit-help').hidden = true
      q('.star-auto-warnings').replaceChildren(); q('.star-auto-preview').replaceChildren(); q('.star-auto-technical').hidden = true
      q('.star-auto-x-value').value = ''; q('.star-auto-y-value').value = ''; q('.star-auto-reject').disabled = true
      q('.star-auto-technical').open = false; q('.star-auto-line-details').open = false; setZoom(false)
      update()
    }
    const reviewing = () => ['selection', 'remainder', 'points'].includes(phase)
    const unreviewed = () => geometry.strokes.filter(s => !decisions[s.id])
    const kept = () => Object.values(decisions).some(d => d === 'keep')
    function update (error) {
      q('.star-auto-calibration').hidden = phase !== 'calibration'
      q('.star-auto-selection').hidden = !reviewing()
      q('.star-auto-selection h6').textContent = phase === 'points' ? 'Check separate points' : 'Review your detected graph'
      q('.star-auto-selection p').textContent = phase === 'points' ? 'Choose a highlighted mark to see it in context. Keep it, leave it out, or correct manually.' : 'Click or tap a highlighted line on your photo to keep it. Click again to remove it. Keep separate lines and gaps as drawn.'
      q('.star-auto-remaining').hidden = phase !== 'remainder'
      q('.star-auto-line-details').hidden = !reviewing()
      q('.star-auto-back').hidden = !['selection', 'remainder', 'points', 'preview'].includes(phase) || method !== 'CV-assisted'
      q('.star-auto-back').textContent = phase === 'selection' ? 'Edit axes' : phase === 'preview' && smallMarks.length ? 'Edit points' : 'Edit lines'
      q('.star-auto-undo').disabled = !history.length
      q('.star-auto-zoom').hidden = !['selection', 'remainder'].includes(phase)
      q('.star-auto-ack-label').hidden = phase !== 'preview'
      q('.star-auto-correct').hidden = typeof onAssist !== 'function'; q('.star-auto-correct').disabled = !file || busy
      const next = q('.star-auto-next'); next.hidden = !(['calibration', 'selection', 'remainder', 'points'].includes(phase) || phase === 'detected' && cvEnabled()); next.disabled = busy
      q('.star-auto-confirm').hidden = phase !== 'preview'
      const manualPrimary = phase === 'detected' && !cvEnabled() && !proposal && !busy
      q('.star-auto-correct').classList.toggle('btn-primary', manualPrimary); q('.star-auto-correct').classList.toggle('btn-light', !manualPrimary)
      let help = 'Choose a photo to start. Nothing will be added without your confirmation.'
      if (phase === 'detected') { next.textContent = 'Continue with detected strokes'; help = cvEnabled() ? 'Set the axes, then review which lines and points belong to your graph.' : 'Use manual tracing or choose a clearer photo.' }
      if (phase === 'calibration') {
        next.textContent = 'Review detected lines'
        try { StarCVAssisted.calibration(geometry.image, axisValues()); help = 'Axes and scale are valid. Continue to review your graph.' } catch (e) { help = e.message; next.disabled = true }
        for (const b of dialog.querySelectorAll('[data-marker]')) { b.setAttribute('aria-pressed', String(b.dataset.marker === marker)); b.textContent = (axes[b.dataset.marker] ? 'Move ' : 'Place ') + ({ origin: 'O', xMarker: 'X', yMarker: 'Y' })[b.dataset.marker] }
      }
      if (reviewing()) {
        const pending = unreviewed().length
        q('.star-auto-selection-count').textContent = phase === 'points' ? (smallMarks.some(m => !markDecisions[m.id]) ? 'Each possible point needs a decision.' : 'Your point choices are saved.') : pending ? 'Some lines need your review.' : 'Your line choices are saved.'
        if (phase === 'points') {
          next.textContent = 'Preview graph'
          try { build(); help = 'Point choices complete. Preview the graph before adding it.' } catch (_) { help = 'Check each highlighted possible point, or choose Correct manually.'; next.disabled = true }
        } else if (!kept()) { next.textContent = 'Review other lines'; help = 'Choose the lines that belong to your graph on the photo.'; next.disabled = true } else if (pending) {
          next.textContent = phase === 'remainder' ? 'Check separate points' : 'Review other lines'
          help = phase === 'remainder' ? 'Decide whether the orange lines belong to your graph, or keep editing.' : 'Review the other lines before continuing. No unchosen line is silently removed.'
          next.disabled = phase === 'remainder'
        } else {
          next.textContent = smallMarks.length ? 'Check separate points' : 'Preview graph'
          try { StarCVAssisted.branches(geometry, decisions); help = smallMarks.length ? 'Line choices complete. Check the separate points next.' : 'Line choices complete. Preview your graph.' } catch (e) { help = e.message; next.disabled = true }
        }
      }
      if (phase === 'preview') help = q('.star-auto-ack').checked ? 'Ready to add your reviewed graph. Existing drawings will be kept.' : 'Compare both views, then check the confirmation box to enable import.'
      q('.star-auto-disabled-help').textContent = error || help
      q('.star-auto-confirm').disabled = busy || !proposal || !q('.star-auto-ack').checked
      q('.star-auto-method').textContent = method + ' · experimental · processed on this device'
    }
    function drawPhoto () {
      if (!photo) return
      canvas.width = photo.width; canvas.height = photo.height
      const ctx = canvas.getContext('2d'); ctx.putImageData(photo, 0, 0)
      if (geometry && !reviewing() && q('.star-auto-overlay').checked) for (const s of geometry.strokes) {
        if (decisions[s.id] === 'exclude') continue
        ctx.strokeStyle = decisions[s.id] === 'keep' ? '#075aaa' : '#b45b00'; ctx.lineWidth = Math.max(2, photo.width / 400)
        ctx.beginPath(); s.vertices.forEach((v, i) => i ? ctx.lineTo(...v.pixel) : ctx.moveTo(...v.pixel)); ctx.stroke()
      }
      if (method === 'CV-assisted' && ['calibration', 'preview'].includes(phase)) {
        const colors = { origin: '#111827', xMarker: '#a43116', yMarker: '#075aaa' }
        for (const [name, p] of Object.entries(axes)) {
          ctx.strokeStyle = colors[name]; ctx.fillStyle = colors[name]; ctx.lineWidth = photo.width / 300
          ctx.beginPath(); ctx.arc(...p, photo.width / 65, 0, Math.PI * 2); ctx.stroke()
          ctx.font = `bold ${photo.width / 35}px system-ui`; ctx.fillText({ origin: 'O', xMarker: 'X', yMarker: 'Y' }[name], p[0] + photo.width / 50, p[1] - photo.width / 70)
        }
      }
    }
    function svgElement (tag, attrs, target = q('.star-auto-preview')) {
      const el = document.createElementNS('http://www.w3.org/2000/svg', tag)
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
      target.append(el); return el
    }
    function preview (prepared) {
      q('.star-auto-photo-overlay').replaceChildren(); q('.star-auto-point-review').hidden = true; q('.star-auto-preview').removeAttribute('hidden')
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
    function remember () {
      history.push(JSON.parse(JSON.stringify({ decisions, markDecisions, activePoint, phase })))
      if (history.length > 60) history.shift()
      invalidate()
    }
    function chooseLine (id, value) {
      remember(); if (value) decisions[id] = value; else delete decisions[id]
      renderReview()
    }
    function chooseCandidate (group) {
      remember(); const value = group.stroke_ids.every(id => decisions[id] === 'keep') ? 'exclude' : 'keep'
      for (const id of group.stroke_ids) decisions[id] = value
      renderReview()
    }
    function setZoom (zoomed) {
      q('.star-auto-photo-stage').style.width = zoomed ? '200%' : '100%'
      q('.star-auto-zoom').setAttribute('aria-pressed', String(zoomed)); q('.star-auto-zoom').textContent = zoomed ? 'Show whole photo' : 'Zoom photo'
    }
    function renderReview () { selectionControls(); drawPhoto(); pixelPreview(); update() }
    function pixelPreview () {
      const svg = q('.star-auto-preview'); const overlay = q('.star-auto-photo-overlay')
      svg.replaceChildren(); overlay.replaceChildren()
      for (const target of [svg, overlay]) target.setAttribute('viewBox', `0 0 ${photo.width} ${photo.height}`)
      svgElement('rect', { width: photo.width, height: photo.height, fill: '#fff' })
      for (const group of groups) {
        const states = group.stroke_ids.map(id => decisions[id]); const state = states.every(s => s === 'keep') ? 'keep' : states.every(s => s === 'exclude') ? 'exclude' : 'unreviewed'
        const paths = geometry.strokes.filter(s => group.stroke_ids.includes(s.id))
        for (const path of paths) {
          const choice = decisions[path.id]
          const d = path.vertices.map((v, j) => (j ? 'L' : 'M') + v.pixel.join(' ')).join(' ')
          const attrs = { d, stroke: choice === 'keep' ? '#075aaa' : choice === 'exclude' ? '#718293' : '#a45a08', 'stroke-width': Math.max(3, photo.width / 280), fill: 'none', 'pointer-events': 'none', 'stroke-opacity': choice === 'exclude' ? 0.3 : 1 }
          if (choice === 'exclude') attrs['stroke-dasharray'] = '10 8'
          for (const target of [svg, overlay]) if (target === svg || reviewing() && q('.star-auto-overlay').checked) svgElement('path', { ...attrs, 'data-pixel-stroke': path.id }, target)
        }
        if (!['selection', 'remainder'].includes(phase)) continue
        const d = paths.map(s => s.vertices.map((v, i) => (i ? 'L' : 'M') + v.pixel.join(' ')).join(' ')).join(' ')
        for (const target of [overlay, svg]) {
          const i = groups.indexOf(group)
          const hit = svgElement('path', { d, stroke: 'transparent', 'stroke-width': photo.width / 65, fill: 'none', 'pointer-events': 'stroke', tabindex: target === overlay && i === activeCandidate ? 0 : -1, role: 'button', 'aria-label': `Detected line ${i + 1}: ${state}. Press Space to keep or remove. Arrow keys move between lines.`, 'aria-pressed': String(state === 'keep'), 'data-candidate': group.id }, target)
          hit.addEventListener('focus', () => { activeCandidate = i })
          const act = () => { chooseCandidate(group); const replacement = q('.star-auto-photo-overlay').querySelector(`[data-candidate="${group.id}"]`); replacement?.focus({ preventScroll: true }) }
          hit.addEventListener('click', act)
          hit.addEventListener('keydown', e => {
            if (['Enter', ' '].includes(e.key)) { e.preventDefault(); act() } else if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
              e.preventDefault(); activeCandidate = e.key === 'Home' ? 0 : e.key === 'End' ? groups.length - 1 : (i + (['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : -1) + groups.length) % groups.length
              for (const p of overlay.querySelectorAll('[data-candidate]')) p.setAttribute('tabindex', p.dataset.candidate === groups[activeCandidate].id ? 0 : -1)
              overlay.querySelector(`[data-candidate="${groups[activeCandidate].id}"]`).focus()
            }
          })
        }
      }
      if (phase === 'points') {
        for (const [i, m] of smallMarks.entries()) {
          const selected = i === activePoint
          const circle = svgElement('circle', { cx: m.pixel[0], cy: m.pixel[1], r: photo.width / (selected ? 38 : 65), fill: 'none', stroke: selected ? '#ae3812' : '#075aaa', 'stroke-width': photo.width / (selected ? 250 : 450), tabindex: i === activePoint ? 0 : -1, role: 'button', 'aria-label': `Possible point ${i + 1}: ${markDecisions[m.id] === 'point' ? 'kept' : markDecisions[m.id] === 'exclude' ? 'not part of graph' : 'needs review'}`, 'data-possible-point': m.id, 'pointer-events': 'all' }, overlay)
          const select = () => { activePoint = i; pixelPreview() }; circle.addEventListener('click', select); circle.addEventListener('keydown', e => {
            if (['Enter', ' '].includes(e.key)) { e.preventDefault(); select(); q('.star-auto-point-question').focus({ preventScroll: true }) } else if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) {
              e.preventDefault(); activePoint = (i + (['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : -1) + smallMarks.length) % smallMarks.length; pixelPreview()
              overlay.querySelector(`[data-possible-point="${smallMarks[activePoint].id}"]`).focus({ preventScroll: true })
            }
          })
        }
        pointContext()
      }
      q('.star-auto-proposal').hidden = false; q('.star-auto-preview').toggleAttribute('hidden', phase === 'points'); q('.star-auto-point-review').hidden = phase !== 'points'
      q('.star-auto-preview-title').textContent = phase === 'points' ? 'Check separate points' : 'Pixel-space preview · ' + (reviewing() ? 'your line choices' : 'scale unconfirmed')
      q('.star-auto-preview-caption').textContent = phase === 'points' ? 'The ring shows the exact possible point on your original photo. Its position will not be moved.' : reviewing() ? 'Blue: kept. Orange: needs review. Faded dashed lines: removed. Selection keeps the detected positions; missing ink needs manual correction.' : 'Detected photo pixels only. Axes, scale, lines and points may need review; this is not a calibrated import preview.'
    }
    function pointContext () {
      const m = smallMarks[activePoint]; if (!m) return
      q('.star-auto-point-progress').textContent = `Possible point ${activePoint + 1} of ${smallMarks.length} · ${markDecisions[m.id] === 'point' ? 'kept as a point' : markDecisions[m.id] === 'exclude' ? 'not part of graph' : 'needs your review'}`
      const crop = q('.star-auto-point-context'); crop.width = 480; crop.height = 280
      const w = Math.min(photo.width, Math.max(300, photo.width * 0.35)); const h = Math.min(photo.height, w * crop.height / crop.width)
      const x = Math.max(0, Math.min(photo.width - w, m.pixel[0] - w / 2)); const y = Math.max(0, Math.min(photo.height - h, m.pixel[1] - h / 2))
      const ctx = crop.getContext('2d'); ctx.drawImage(canvas, x, y, w, h, 0, 0, crop.width, crop.height)
      ctx.strokeStyle = '#ae3812'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc((m.pixel[0] - x) * crop.width / w, (m.pixel[1] - y) * crop.height / h, 15, 0, Math.PI * 2); ctx.stroke()
      for (const b of dialog.querySelectorAll('[data-point-decision]')) b.setAttribute('aria-pressed', String(markDecisions[m.id] === b.dataset.pointDecision))
    }
    function selectionControls () {
      const lines = q('.star-auto-lines'); lines.replaceChildren()
      for (const [i, s] of geometry.strokes.entries()) {
        const label = document.createElement('label'); label.textContent = 'Line ' + (i + 1)
        const select = document.createElement('select'); select.className = 'form-control'; select.dataset.stroke = s.id
        for (const [value, text] of [['', 'Needs review'], ['keep', 'Keep'], ['exclude', 'Not part of graph']]) select.add(new Option(text, value))
        select.value = decisions[s.id] || ''; select.addEventListener('change', () => chooseLine(s.id, select.value))
        const highlight = on => { for (const path of dialog.querySelectorAll('[data-pixel-stroke]')) if (path.dataset.pixelStroke === s.id) { path.style.stroke = on ? '#ae3812' : ''; path.style.strokeWidth = on ? String(photo.width / 110) : '' } }
        label.addEventListener('mouseenter', () => highlight(true)); label.addEventListener('mouseleave', () => highlight(false)); select.addEventListener('focus', () => highlight(true)); select.addEventListener('blur', () => highlight(false))
        label.append(select); lines.append(label)
      }
    }
    function showPointsOrPreview () {
      StarCVAssisted.branches(geometry, decisions)
      if (smallMarks.length) { phase = 'points'; activePoint = Math.max(0, smallMarks.findIndex(m => !markDecisions[m.id])); setZoom(false); drawPhoto(); pixelPreview(); status.textContent = 'Check each possible point in the photo. Nothing is classified for you.' } else showPreview()
    }
    function showPreview () {
      const corrected = build(); proposal = cvSession.propose(corrected); phase = 'preview'; setZoom(false); drawPhoto(); preview(proposal); q('.star-auto-ack').disabled = false; q('.star-auto-edit-help').hidden = false
      status.textContent = 'CV-assisted graph ready for your final comparison. Nothing has been added yet.'
    }
    async function analyze () {
      clear(); const request = revision
      if (!file) { busy = false; q('.star-auto-retry').disabled = true; status.textContent = 'Choose a photo to detect its graph strokes.'; return }
      if (onPhotoState) onPhotoState({ kind: 'loading', revision: request })
      busy = true; q('.star-auto-retry').disabled = true; method = 'CV automatic'; status.textContent = 'Detecting strokes on this device…'; update()
      let bitmap
      try {
        const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
        if (request !== revision) return
        hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
        try { bitmap = await window.createImageBitmap(file, { imageOrientation: 'from-image' }) } catch (_) { bitmap = await window.createImageBitmap(file) }
        if (request !== revision) return
        lastGoodFile = file
        // Visibility is independent of CV eligibility, calibration and proposals.
        if (onPhotoState) onPhotoState({ kind: 'photo', revision: request, bitmap, file, sha256: hash })
        // Give the reference layer a paint before synchronous CV processing.
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)))
        if (request !== revision) return
        if (bitmap.width * bitmap.height > 40000000) throw new Error('Choose an image smaller than 40 megapixels.')
        const source = document.createElement('canvas'); source.width = bitmap.width; source.height = bitmap.height
        const ctx = source.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bitmap, 0, 0)
        photo = ctx.getImageData(0, 0, source.width, source.height)
        // Only RGBA pixels and a revision enter recognition. No answer/config.
        const result = await StarProviders.recognize(photo, { inputRevision: request })
        if (request !== revision) return
        geometry = result.geometry; method = result.method; smallMarks = StarCVAssisted.marks(geometry); groups = StarCVAssisted.candidates(geometry); phase = 'detected'
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
        if (onPhotoState) onPhotoState({ kind: 'recognition', revision: request, geometry, nativeDraftReady: !!proposal })
      } catch (e) { if (request === revision) { proposal = null; status.textContent = 'Could not recognize this photo: ' + e.message; if (onPhotoState) onPhotoState({ kind: 'error', revision: request }); if (!bitmap && lastGoodFile) file = lastGoodFile } } finally {
        if (bitmap) bitmap.close()
        if (request === revision) { busy = false; q('.star-auto-retry').disabled = false; update() }
      }
    }
    function close () { clear(); busy = false; q('.star-auto-retry').disabled = !file; if (onPhotoState) onPhotoState({ kind: 'draft-cleared', revision }); if (dialog.open) dialog.close(); button.focus({ preventScroll: true }) }
    function openReview () {
      // Canvas editing may have continued since background recognition. A
      // newly opened preview gets a fresh snapshot, never an automatic commit.
      if (geometry?.status === 'automatic' && method === 'CV automatic') {
        try { proposal = session.propose(geometry); phase = 'preview'; preview(proposal); q('.star-auto-ack').disabled = false; q('.star-auto-ack').checked = false } catch (error) {
          proposal = null; phase = 'detected'; pixelPreview(); status.textContent = error.message
          if (onPhotoState) onPhotoState({ kind: 'draft-cleared', revision })
        }
        update()
      } else if (file && !geometry && !busy) analyze()
      if (!dialog.open) dialog.showModal()
    }
    button.addEventListener('click', openReview)
    q('.star-auto-close').addEventListener('click', close)
    dialog.addEventListener('cancel', e => { e.preventDefault(); close() })
    dialog.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && e.target.matches('input')) e.preventDefault() })
    dialog.addEventListener('keyup', e => e.stopPropagation())
    q('input[type=file]').addEventListener('change', e => { file = e.target.files[0] || null; photo = null; analyze() })
    q('.star-auto-retry').addEventListener('click', analyze)
    q('.star-auto-correct').addEventListener('click', () => { if (!file || typeof onAssist !== 'function') return; const selected = file; close(); onAssist(selected) })
    q('.star-auto-overlay').addEventListener('change', () => { drawPhoto(); if (reviewing()) pixelPreview() })
    q('.star-auto-ack').addEventListener('change', () => update())
    q('.star-auto-reject').addEventListener('click', () => { clear(); if (onPhotoState) onPhotoState({ kind: 'draft-cleared', revision }); busy = false; q('.star-auto-retry').disabled = !file; status.textContent = 'Proposal rejected. No native drawing was added.' })
    q('.star-auto-next').addEventListener('click', () => {
      if (busy || q('.star-auto-next').disabled) return
      try {
        if (phase === 'detected' && cvEnabled()) { invalidate(); method = 'CV-assisted'; phase = 'calibration'; marker = 'origin'; status.textContent = 'Set the axes and scale on this same photo.'; pixelPreview(); drawPhoto() } else if (phase === 'calibration') {
          StarCVAssisted.calibration(geometry.image, axisValues()); phase = 'selection'; q('.star-auto-overlay').checked = true; renderReview(); status.textContent = 'Review your detected graph. Choose its lines directly on the photo.'
        } else if (phase === 'selection' || phase === 'remainder') {
          if (unreviewed().length) { phase = 'remainder'; renderReview(); status.textContent = 'Check the other highlighted lines before leaving them out.' } else showPointsOrPreview()
        } else if (phase === 'points') showPreview()
        update()
      } catch (e) { proposal = null; update(e.message) }
    })
    q('.star-auto-back').addEventListener('click', () => {
      invalidate(); phase = phase === 'preview' ? (smallMarks.length ? 'points' : 'selection') : phase === 'selection' ? 'calibration' : 'selection'
      setZoom(false); q('.star-auto-edit-help').hidden = true; renderReview()
    })
    for (const b of dialog.querySelectorAll('[data-marker]')) b.addEventListener('click', () => { marker = b.dataset.marker; q('.star-auto-marker-help').textContent = `Place ${b.textContent.split(' ').at(-1)} on the photo. Arrow keys adjust a placed marker; Shift moves ten pixels.`; update(); canvas.focus() })
    function place (p) {
      invalidate(); axes[marker] = p.map((v, i) => Math.max(0, Math.min(v, [photo.width - 1, photo.height - 1][i])))
      drawPhoto(); update()
    }
    canvas.addEventListener('click', e => { if (phase !== 'calibration') return; const b = canvas.getBoundingClientRect(); place([(e.clientX - b.left) * photo.width / b.width, (e.clientY - b.top) * photo.height / b.height]) })
    canvas.addEventListener('keydown', e => { if (phase !== 'calibration') return; if (e.key === 'Enter' && !axes[marker]) { e.preventDefault(); place([photo.width / 2, photo.height / 2]); return } if (!axes[marker] || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return; e.preventDefault(); const d = e.shiftKey ? 10 : 1; const p = axes[marker].slice(); p[0] += e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0; p[1] += e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0; place(p) })
    for (const selector of ['.star-auto-x-value', '.star-auto-y-value']) q(selector).addEventListener('input', () => { invalidate(); update() })
    q('.star-auto-dismiss-remaining').addEventListener('click', () => {
      if (phase !== 'remainder') return
      remember(); for (const s of unreviewed()) decisions[s.id] = 'exclude'
      try { showPointsOrPreview(); update() } catch (e) { renderReview(); update(e.message) }
    })
    q('.star-auto-keep-editing').addEventListener('click', () => { phase = 'selection'; renderReview() })
    q('.star-auto-undo').addEventListener('click', () => {
      if (!history.length) return
      invalidate(); const prior = history.pop(); decisions = prior.decisions; markDecisions = prior.markDecisions; activePoint = prior.activePoint; phase = prior.phase; renderReview()
    })
    q('.star-auto-zoom').addEventListener('click', () => setZoom(q('.star-auto-zoom').getAttribute('aria-pressed') !== 'true'))
    for (const b of dialog.querySelectorAll('[data-point-decision]')) b.addEventListener('click', () => {
      if (phase !== 'points' || !smallMarks[activePoint]) return
      remember(); markDecisions[smallMarks[activePoint].id] = b.dataset.pointDecision
      const pending = smallMarks.findIndex(m => !markDecisions[m.id]); if (pending >= 0) activePoint = pending
      drawPhoto(); pixelPreview(); update(); q('.star-auto-point-question').focus({ preventScroll: true })
    })
    q('.star-auto-point-manual').addEventListener('click', () => q('.star-auto-correct').click())
    q('.star-auto-confirm').addEventListener('click', () => {
      if (busy || !proposal || q('.star-auto-confirm').disabled || !q('.star-auto-ack').checked) return
      try { (method === 'CV-assisted' ? cvSession : session).commit(proposal.token, true); close(); status.textContent = 'Graph added. Use Select to move or delete a branch or dot.' } catch (e) { invalidate(); update(e.message); status.textContent = e.message; q('.star-auto-back').hidden = method !== 'CV-assisted'; q('.star-auto-retry').disabled = false }
    })
    return {
      loadPhoto: f => { file = f; photo = null; q('input[type=file]').value = ''; return analyze() },
      clearPhoto: () => { file = lastGoodFile = null; photo = null; q('input[type=file]').value = ''; close() },
      open: openReview
    }
  }
  return { mount }
})()
