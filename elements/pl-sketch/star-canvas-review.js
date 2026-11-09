/* Short, on-canvas CV-assisted correction. Never imports before acceptance. */
window.StarCanvasReview = (function () {
  'use strict'
  const instances = {}
  function mount ({ id, si, config, reference }) {
    if (!config.assistedPhotoGeometry || config.readonly) return { update: () => {} }
    const container = document.getElementById(id + '-si-container'); const svg = document.getElementById(id + '-si-canvas'); const panel = container.querySelector('.star-canvas-photo')
    const start = document.createElement('button'); start.type = 'button'; start.className = 'btn btn-primary star-canvas-correct'; start.textContent = 'Align / select graph ink'; start.disabled = true; panel.querySelector('.star-canvas-photo-actions').append(start)
    const ui = document.createElement('div'); ui.className = 'star-canvas-correction'; ui.hidden = true
    ui.innerHTML = `<p class="star-correction-method">CV-assisted · confirm axes and select actual ink; no Gemini recognition</p><div class="star-correction-picks"><button type="button" class="btn btn-light border" data-pick="origin">O = (0,0)</button><button type="button" class="btn btn-light border" data-pick="xMarker">Known x tick</button><label>x value <input class="star-correction-x" type="number" step="any" aria-label="Known x tick value"></label><button type="button" class="btn btn-light border" data-pick="yMarker">Known y tick</button><label>y value <input class="star-correction-y" type="number" step="any" aria-label="Known y tick value"></label><button type="button" class="btn btn-light border" data-pick="curve">Curve endpoints</button><button type="button" class="btn btn-light border" data-pick="point">Filled dot</button></div><p class="star-correction-help" role="status"></p><p class="star-correction-count"></p><p class="star-correction-warning">Only selected curves and dots will be added. Check the entire photo for missing ink and wrong paths.</p><div class="star-correction-actions"><button type="button" class="btn btn-light border star-correction-undo">Undo selection</button><button type="button" class="btn btn-light border star-correction-preview">Preview selected graph</button><button type="button" class="btn btn-primary star-correction-accept" hidden>Accept as editable graph</button><button type="button" class="btn btn-light border star-correction-align">Use alignment & draw</button><button type="button" class="btn btn-light border star-correction-back" hidden>Edit selection</button><button type="button" class="btn btn-light border star-correction-manual">Trace manually</button><button type="button" class="btn btn-light border star-correction-cancel">Cancel</button></div>`
    panel.append(ui); const q = s => ui.querySelector(s)
    const traceButton = document.createElement('button'); traceButton.type = 'button'; traceButton.className = 'btn btn-light border'; traceButton.dataset.pick = 'trace'; traceButton.textContent = 'Trace instead'; q('.star-correction-picks').append(traceButton)
    q('.star-correction-warning').textContent += ' Dots touching a curve may need Other marks after import.'
    const keyboardHelp = document.createElement('details'); keyboardHelp.innerHTML = '<summary>Keyboard controls</summary><p>Focus the canvas; arrows move the crosshair (Shift = 10), Enter selects and Escape cancels. In trace mode, Enter adds a vertex and Shift+Enter finishes the curve.</p>'; ui.append(keyboardHelp)
    const layer = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject'); layer.setAttribute('width', config.width); layer.setAttribute('height', config.height); layer.setAttribute('aria-hidden', 'true'); layer.setAttribute('class', 'star-canvas-correction-layer')
    const paint = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas'); paint.width = config.width; paint.height = config.height; layer.append(paint); svg.append(layer)
    const session = StarNative.createSession(si, config, undefined, { targeted: true }); const autoSession = StarNative.createSession(si, config); const manualSession = StarNative.createSession(si, config, undefined, { assisted: true })
    let source = null; let file = null; let hash = ''; let revision = 0; let active = false; let phase = 'select'; let mode = 'origin'; let axes = {}; let selections = []; let dots = []; let pending = null; let proposal = null; let candidate = null; let priorFrame = null; let automatic = false
    let cursor = [config.width / 2, config.height / 2]; let keyboard = false
    let traces = []; let currentTrace = null; let manuallyTraced = false; let blockedSegments = []
    const values = () => ({ ...axes, xValue: q('.star-correction-x').value === '' ? NaN : Number(q('.star-correction-x').value), yValue: q('.star-correction-y').value === '' ? NaN : Number(q('.star-correction-y').value) })
    const frame = g => ({ origin_pixel: g.coordinate_frame.origin_pixel, origin_graph: g.calibration.origin_graph, x_unit_vector_pixel: g.calibration.x_unit_vector_pixel, y_unit_vector_pixel: g.calibration.y_unit_vector_pixel })
    const axisFrame = () => { const c = StarCVAssisted.calibration(source.image, values()); return { origin_pixel: c.frame.origin_pixel, origin_graph: c.scale.origin_graph, x_unit_vector_pixel: c.scale.x_unit_vector_pixel, y_unit_vector_pixel: c.scale.y_unit_vector_pixel } }
    function invalidate () { proposal = candidate = null; blockedSegments = []; session.invalidate(revision); autoSession.invalidate(revision); manualSession.invalidate(revision) }
    function draw () {
      if (layer.parentNode !== svg) svg.append(layer)
      const ctx = paint.getContext('2d'); ctx.clearRect(0, 0, paint.width, paint.height); layer.style.display = active ? '' : 'none'
      if (!active) return
      const dot = (p, color, text) => { const v = reference.toCanvas(p); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(...v, 5, 0, Math.PI * 2); ctx.fill(); ctx.font = 'bold 14px sans-serif'; ctx.fillText(text, v[0] + 7, v[1] - 7) }
      for (const [name, p] of Object.entries(axes)) dot(p, '#a327c5', { origin: 'O', xMarker: 'X', yMarker: 'Y' }[name])
      let shown = candidate?.strokes
      if (!shown && selections.length) { try { const selected = StarTargeted.select(source, selections, dots); shown = source.strokes.filter(s => selected.strokeDecisions[s.id] === 'keep') } catch (_) {} }
      if (shown) {
        ctx.strokeStyle = '#087e41'; ctx.lineWidth = 3
        for (const s of shown) { ctx.beginPath(); s.vertices.forEach((v, i) => { const p = reference.toCanvas(v.pixel); if (i) ctx.lineTo(...p); else ctx.moveTo(...p) }); ctx.stroke() }
        for (const p of candidate?.points || []) dot(p.pixel, '#087e41', 'dot')
      }
      for (const pair of selections) { dot(pair[0], '#0068c7', 'start'); dot(pair[1], '#0068c7', 'end') }
      for (const p of dots) dot(p, '#0068c7', 'dot')
      ctx.strokeStyle = '#087e41'; ctx.lineWidth = 3
      for (const ps of traces.concat(currentTrace ? [currentTrace] : [])) { ctx.beginPath(); ps.forEach((v, i) => { const p = reference.toCanvas(v); if (i) ctx.lineTo(...p); else ctx.moveTo(...p) }); ctx.stroke() }
      if (pending) dot(pending, '#0068c7', 'start')
      for (const segment of blockedSegments) {
        const a = reference.toCanvas(segment.pixels[0]); const b = reference.toCanvas(segment.pixels[1]); ctx.strokeStyle = '#b91c1c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke()
        ctx.beginPath(); ctx.arc(a[0], a[1], 12, 0, Math.PI * 2); ctx.stroke()
      }
      if (keyboard && phase === 'select') { ctx.strokeStyle = '#0068c7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cursor[0] - 9, cursor[1]); ctx.lineTo(cursor[0] + 9, cursor[1]); ctx.moveTo(cursor[0], cursor[1] - 9); ctx.lineTo(cursor[0], cursor[1] + 9); ctx.stroke() }
    }
    function controls (message) {
      const preview = phase === 'preview'; q('.star-correction-picks').hidden = preview
      q('.star-correction-method').textContent = manuallyTraced ? 'Manually traced · original pointer geometry, not automatic recognition' : automatic ? 'CV automatic candidate · compare and accept before native import' : 'CV-assisted · confirm axes and select actual ink'
      q('.star-correction-preview').hidden = preview; q('.star-correction-undo').hidden = preview; q('.star-correction-align').hidden = preview; q('.star-correction-accept').hidden = !preview; q('.star-correction-back').hidden = !preview
      q('.star-correction-accept').disabled = !proposal; q('.star-correction-preview').disabled = !source || !(selections.length || traces.length) || !!pending || !!currentTrace
      q('.star-correction-count').textContent = `${preview ? candidate?.strokes.length || 0 : selections.length + traces.length} selected/traced curve(s), ${preview ? candidate?.points?.length || 0 : dots.length} filled dot(s). ${pending ? 'Choose the other endpoint.' : ''}`
      for (const b of ui.querySelectorAll('[data-pick]')) b.setAttribute('aria-pressed', String(b.dataset.pick === mode))
      q('.star-correction-help').textContent = message || (preview ? 'Preview only, not graded. Compare the green curves/dots, axes, corners and endpoints with the photo. Accept only if this represents your drawing.' : ({ origin: 'Click the photo’s coordinate origin O = (0,0).', xMarker: 'Click a known x tick on the photo and enter its written value.', yMarker: 'Click a known y tick on the photo and enter its written value.', curve: 'Click both visible endpoints of each complete curve. CV reuses connected pixels; you do not retrace.', point: 'Click a visible isolated filled dot. Its measured component center will be used.', trace: 'Drag along each original curve, from its first endpoint to its last. Separate gestures stay separate. This replaces CV selection; add dots with Other marks after import.' }[mode]))
      draw()
    }
    function close (restore = true) { active = false; if (restore) reference.setFrame(priorFrame); ui.hidden = true; invalidate(); draw(); start.focus({ preventScroll: true }) }
    function edit () { phase = 'select'; automatic = false; reference.setFrame(priorFrame); invalidate(); controls() }
    function preview (g, isAutomatic = false, isManual = false) {
      invalidate(); candidate = g; automatic = isAutomatic; manuallyTraced = isManual; proposal = (manuallyTraced ? manualSession : automatic ? autoSession : session).propose(g)
      reference.setFrame(frame(g)); phase = 'preview'; controls()
    }
    start.addEventListener('click', () => {
      if (!source) return
      active = true; phase = 'select'; priorFrame = reference.getFrame(); axes = {}; selections = []; dots = []; traces = []; currentTrace = null; manuallyTraced = false; pending = null; mode = 'origin'; q('.star-correction-x').value = q('.star-correction-y').value = ''; ui.hidden = false; invalidate()
      const cv = panel.querySelector('.star-canvas-cv'); if (cv.checked) cv.click()
      try { if (source.status === 'automatic' && !reference.status().aligned) preview(source, true); else controls() } catch (e) { edit(); controls(e.message) }
      svg.scrollIntoView({ block: 'nearest' }); svg.focus({ preventScroll: true })
    })
    function pick (event) {
      if (!active || phase !== 'select') return
      event.preventDefault(); event.stopImmediatePropagation()
      if (event.type !== 'pointerdown' && !(mode === 'trace' && currentTrace && ['pointermove', 'pointerup'].includes(event.type))) return
      const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse()); cursor = [local.x, local.y]; const p = reference.toPhoto(cursor)
      if (p.some((v, i) => v < 0 || v >= [source.image.width, source.image.height][i])) { controls('Choose a position inside the photograph.'); return }
      invalidate()
      if (mode === 'trace') {
        if (event.type === 'pointerdown') currentTrace = [p]
        else { if (Math.hypot(...p.map((v, i) => v - currentTrace.at(-1)[i])) > 0.01) currentTrace.push(p); if (event.type === 'pointerup') { if (currentTrace.length >= 3) traces.push(currentTrace); currentTrace = null } }
        manuallyTraced = true; controls(); return
      }
      if (['origin', 'xMarker', 'yMarker'].includes(mode)) { axes[mode] = p; mode = mode === 'origin' ? 'xMarker' : mode === 'xMarker' ? 'yMarker' : 'curve' } else if (mode === 'point') {
        dots.push(p)
        try { if (selections.length) StarTargeted.select(source, selections, dots) } catch (e) { dots.pop(); controls(e.message); return }
      } else if (!pending) pending = p
      else {
        selections.push([pending, p]); pending = null
        try { StarTargeted.select(source, selections, dots) } catch (e) { selections.pop(); controls(e.message); return }
      }
      controls()
    }
    for (const name of ['pointerdown', 'pointermove', 'pointerup', 'click', 'mousedown', 'mouseup', 'touchstart', 'touchend']) svg.addEventListener(name, pick, true)
    svg.addEventListener('keydown', e => {
      if (!active) return
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); return }
      if (phase !== 'select' || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) return
      e.preventDefault(); e.stopImmediatePropagation(); keyboard = true
      if (e.key === 'Enter') { const p = new DOMPoint(...cursor).matrixTransform(svg.getScreenCTM()); pick({ type: mode === 'trace' && currentTrace ? e.shiftKey ? 'pointerup' : 'pointermove' : 'pointerdown', clientX: p.x, clientY: p.y, preventDefault () {}, stopImmediatePropagation () {} }) } else {
        const k = ['ArrowLeft', 'ArrowRight'].includes(e.key) ? 0 : 1; cursor[k] = Math.max(0, Math.min(k ? config.height : config.width, cursor[k] + (['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 1) * (e.shiftKey ? 10 : 1))); draw()
      }
    }, true)
    ui.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.preventDefault(); if (e.key === 'Escape') close() })
    ui.addEventListener('keyup', e => e.stopPropagation())
    ui.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.pick; pending = null; currentTrace = null; if (mode === 'trace') { selections = []; dots = []; manuallyTraced = true } invalidate(); controls(); svg.focus({ preventScroll: true }) }))
    for (const name of ['.star-correction-x', '.star-correction-y']) q(name).addEventListener('input', () => { invalidate(); controls() })
    q('.star-correction-undo').addEventListener('click', () => { if (pending) pending = null; else if (mode === 'trace' && traces.length) traces.pop(); else if (mode === 'point' && dots.length) dots.pop(); else selections.pop(); invalidate(); controls() })
    q('.star-correction-preview').addEventListener('click', () => {
      try {
        if (traces.length) {
          if (selections.length || dots.length) throw new Error('Use either endpoint selection or manual traces. Add separate dots with Other marks after manual import.')
          const im = source.image; const sx = im.processing.width / im.width; const sy = im.processing.height / im.height; const toProcessing = p => [(p[0] + 0.5) * sx - 0.5, (p[1] + 0.5) * sy - 0.5]; const v = values()
          preview(StarAssisted.fromTrace({ width: im.width, height: im.height, processingWidth: im.processing.width, processingHeight: im.processing.height, origin: toProcessing(v.origin || []), xMarker: toProcessing(v.xMarker || []), yMarker: toProcessing(v.yMarker || []), xValue: v.xValue, yValue: v.yValue, strokes: traces.map(ps => ps.map(toProcessing)), inputRevision: revision }), false, true)
        } else preview(StarTargeted.fromSelection({ source, photoSha256: hash, axisValues: values(), selections, pointSelections: dots, inputRevision: revision }))
      } catch (e) { invalidate(); blockedSegments = e.segments || []; controls(e.message + (e.code === 'function_x_backtrack' ? ' The red segment marks the measured turn. The photo remains a reference only. Check this turn against your paper; importing it unchanged is blocked for this function question.' : manuallyTraced ? ' Nothing was added; check your trace against the photo.' : ' Nothing was added. Choose Trace instead to follow the original ink if the detected route is wrong.')) }
    })
    q('.star-correction-back').addEventListener('click', edit)
    q('.star-correction-accept').addEventListener('click', () => {
      if (!proposal || !candidate) return
      try {
        const accepted = candidate; const receipt = (manuallyTraced ? manualSession : automatic ? autoSession : session).commit(proposal.token, true); reference.setFrame(frame(accepted), true)
        const detail = { geometry: accepted, receipt, method: manuallyTraced ? 'Manually traced, student calibration' : automatic ? 'CV automatic, student accepted' : 'CV-assisted, student calibration and endpoint selection' }; close(false)
        reference.message(manuallyTraced ? 'Your manually traced graph was added without fitting an equation. Use native tools to edit, then Save & Grade.' : automatic ? 'Recognized graph added as editable native objects. Use Save & Grade.' : 'CV-assisted graph added. Check the native drawing; only your accepted objects are graded.')
        container.dispatchEvent(new CustomEvent('star-canvas-imported', { detail }))
      } catch (e) { invalidate(); controls(e.message + ' Preview the current drawing again before accepting.'); q('.star-correction-back').hidden = false }
    })
    q('.star-correction-align').addEventListener('click', () => {
      try { reference.setFrame(axisFrame(), true); close(false); panel.querySelector('.star-canvas-edit').click(); reference.message('Reference photo aligned only; no photo curves were imported. Draw with native tools before Save & Grade. An empty native answer is Invalid.') } catch (e) { controls(e.message) }
    })
    q('.star-correction-cancel').addEventListener('click', () => close())
    q('.star-correction-manual').addEventListener('click', () => { if (file) { close(); container.dispatchEvent(new CustomEvent('star-assist-photo', { detail: { file } })) } })
    panel.querySelector('.star-canvas-remove').addEventListener('click', () => { if (active) close(false); source = null; start.disabled = true })
    panel.querySelector('.star-canvas-edit').addEventListener('click', () => { if (active) close() })
    container.querySelector('.si-toolbar')?.addEventListener('click', () => { if (active) close() })
    const api = { update: event => {
      if (event.kind === 'loading') { if (active) close(); revision = event.revision; session.invalidate(revision); autoSession.invalidate(revision); source = null; start.disabled = true }
      if (event.kind === 'photo') { file = event.file; hash = event.sha256 }
      if (event.kind === 'recognition' && event.revision === revision) { source = event.geometry; start.disabled = false; const aligned = reference.status().aligned; start.textContent = aligned ? 'Align / select more ink' : source.status === 'automatic' ? 'Review detected graph' : source.strokes.length ? 'Align / select graph ink' : 'Align photo & draw'; reference.message(aligned ? 'Photo alignment restored. Your native drawings remain editable; select more ink only if needed.' : source.status === 'automatic' ? 'A calibrated candidate is ready. Review it on this canvas before accepting.' : 'CV needs help. Align the photo and select curve endpoints, or trace the original ink.') }
    }, status: () => ({ active, phase, mode, revision, axisValues: values(), selections, pointSelections: dots, traceCount: traces.length, hasProposal: !!proposal }) }
    instances[id] = api; return api
  }
  return { mount, instances }
})()
