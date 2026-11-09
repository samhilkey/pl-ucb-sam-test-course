/* Short draft route; provisional pixels never enter native answer state. */
window.StarEditableDraftUI = (function () {
  'use strict'
  const instances = {}
  function mount ({ id, si, config, reference }) {
    if (!config.editablePhotoDraftTool || config.readonly) return { update () {} }
    const container = document.getElementById(id + '-si-container'); const svg = document.getElementById(id + '-si-canvas'); const panel = container.querySelector('.star-canvas-photo')
    const advanced = panel.querySelector('.star-canvas-advanced-actions')
    for (const el of [panel.querySelector('.star-canvas-correct'), panel.querySelector('.star-canvas-edit')]) if (el) advanced.append(el)
    const start = document.createElement('button'); start.type = 'button'; start.className = 'btn btn-primary star-draft-start'; start.textContent = 'Edit detected graph'; start.disabled = true; panel.querySelector('.star-canvas-photo-actions').append(start)
    const ui = document.createElement('div'); ui.className = 'star-editable-draft-panel'; ui.hidden = true
    ui.innerHTML = `<p class="star-draft-method"></p><div class="star-draft-axis-inputs"><p>Confirm the photo's axes to place the graph. Click O, a known x tick and a known y tick; enter their written values.</p><div class="star-draft-markers"><button type="button" class="btn btn-light border" data-marker="origin">O = (0,0)</button><button type="button" class="btn btn-light border" data-marker="xMarker">x tick</button><label>x value <input type="number" step="any" class="star-draft-x" aria-label="Photo x tick value"></label><button type="button" class="btn btn-light border" data-marker="yMarker">y tick</button><label>y value <input type="number" step="any" class="star-draft-y" aria-label="Photo y tick value"></label></div></div><p class="star-draft-help" role="status"></p><div class="star-draft-actions"><button type="button" class="btn btn-primary star-draft-accept" hidden>Edit detected graph</button><button type="button" class="btn btn-light border star-draft-realign" hidden>Change axes</button><button type="button" class="btn btn-light border star-draft-cancel">Cancel</button></div>`
    panel.append(ui); const q = s => ui.querySelector(s)
    const layer = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject'); layer.setAttribute('width', config.width); layer.setAttribute('height', config.height); layer.setAttribute('aria-hidden', 'true'); layer.classList.add('star-draft-highlights'); layer.style.pointerEvents = 'none'
    const canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas'); canvas.width = config.width; canvas.height = config.height; layer.append(canvas); svg.append(layer)
    const adaptive = !!config.adaptivePhotoSplineTool
    const session = adaptive ? StarAdaptiveNative.createSession(si, config) : StarNative.createSession(si, config, undefined, { editableDraft: true })
    let acceptedGeometry = null
    let styleChoice = null; let styleButton = null
    if (adaptive) {
      const label = document.createElement('label'); label.className = 'star-adaptive-choice'; label.textContent = 'Curve style '
      styleChoice = document.createElement('select'); styleChoice.setAttribute('aria-label', 'Curve style'); styleChoice.innerHTML = '<option value="auto">Auto (recommended)</option><option value="smooth">Smooth curve when faithful</option><option value="original">Original trace</option>'; label.append(styleChoice); ui.insertBefore(label, q('.star-draft-axis-inputs'))
      styleButton = document.createElement('button'); styleButton.type = 'button'; styleButton.className = 'btn btn-light border star-adaptive-style'; styleButton.textContent = 'Change curve style (before editing)'; styleButton.disabled = true; advanced.append(styleButton)
    }
    let source = null; let hash = ''; let revision = 0; let phase = 'empty'; let axes = {}; let marker = 'origin'; let proposal = null; let geometry = null; let priorFrame = null; let automatic = false; let cursor = [config.width / 2, config.height / 2]
    const state = () => JSON.parse(si.getState())
    const cacheKey = () => reference.status().scope ? reference.status().scope + ':accepted-draft' : null
    const accepted = () => { try { const data = state().data; return !!hash && sessionStorage.getItem(cacheKey()) === hash && [config.editablePhotoDraftTool, config.adaptivePhotoSplineTool].filter(Boolean).some(id => data[id].some(ps => ps.length >= 2)) } catch (_) { return phase === 'student_accepted_native_draft' } }
    const frame = g => ({ origin_pixel: g.coordinate_frame.origin_pixel, origin_graph: g.calibration.origin_graph, x_unit_vector_pixel: g.calibration.x_unit_vector_pixel, y_unit_vector_pixel: g.calibration.y_unit_vector_pixel })
    const values = () => ({ ...axes, xValue: q('.star-draft-x').value === '' ? NaN : Number(q('.star-draft-x').value), yValue: q('.star-draft-y').value === '' ? NaN : Number(q('.star-draft-y').value) })
    function invalidate () { proposal = geometry = null; session.invalidate(revision); q('.star-draft-accept').hidden = true }
    function paint () {
      const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height)
      const ring = p => { ctx.strokeStyle = '#b91c1c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p[0], p[1], 10, 0, Math.PI * 2); ctx.stroke() }
      if (geometry && phase === 'provisional_prediction') {
        ctx.strokeStyle = '#087e41'; ctx.lineWidth = 3
        if (proposal?.previewPaths) for (const ps of proposal.previewPaths) { ctx.beginPath(); ps.forEach((p, i) => { if (i) ctx.lineTo(...p); else ctx.moveTo(...p) }); ctx.stroke() }
        else for (const s of geometry.strokes) { ctx.beginPath(); s.vertices.forEach((v, i) => { const p = reference.toCanvas(v.pixel); if (i) ctx.lineTo(...p); else ctx.moveTo(...p) }); ctx.stroke() }
        for (const s of geometry.strokes) for (const issue of StarNative.functionViolations(s, config)) ring(reference.toCanvas(issue.pixels[0]))
      } else if (phase === 'calibration') {
        for (const [name, p] of Object.entries(axes)) { const v = reference.toCanvas(p); ctx.fillStyle = '#6930a8'; ctx.beginPath(); ctx.arc(...v, 5, 0, Math.PI * 2); ctx.fill(); ctx.font = 'bold 14px sans-serif'; ctx.fillText({ origin: 'O', xMarker: 'X', yMarker: 'Y' }[name], v[0] + 7, v[1] - 6) }
      }
      for (const ps of state().data[config.editablePhotoDraftTool] || []) {
        const ds = ps.slice(1).map((p, i) => p.x - ps[i].x); const direction = ps.length ? Math.sign(ps.at(-1).x - ps[0].x) : 0
        if (ds.some(d => d > 1e-7) && ds.some(d => d < -1e-7)) ds.forEach((d, i) => { if (d * direction < -1e-7) ring([ps[i].x, ps[i].y]) })
      }
      svg.querySelector('path.plugin-id-' + CSS.escape(config.editablePhotoDraftTool))?.parentElement.classList.add('star-draft-native-tool')
    }
    let scheduled = false
    new MutationObserver(() => { if (!scheduled) { scheduled = true; requestAnimationFrame(() => { scheduled = false; paint() }) } }).observe(svg, { childList: true, subtree: true, attributes: true, attributeFilter: ['d', 'cx', 'cy'] })
    function selectNative () {
      const button = [...container.querySelectorAll('.si-toolbar button')].find(b => b.textContent.trim() === 'Select')
      button?.click(); svg.scrollIntoView({ block: 'nearest' }); svg.focus({ preventScroll: true }); paint()
    }
    function close (restore = true) { ui.hidden = true; start.hidden = false; if (restore) reference.setFrame(priorFrame); invalidate(); if (!accepted()) phase = source ? 'ready' : 'empty'; paint() }
    function preview (preparedGeometry = null) {
      invalidate()
      try {
        automatic = source.status === 'automatic' && source.calibration.status === 'calibrated'
        const g = preparedGeometry || (automatic ? source : StarEditableDraft.build({ source, photoSha256: hash, axisValues: values(), inputRevision: revision }))
        const p = session.propose(g); geometry = g; proposal = p; phase = 'provisional_prediction'; reference.setFrame(frame(g))
        q('.star-draft-axis-inputs').hidden = true; q('.star-draft-accept').hidden = false; q('.star-draft-realign').hidden = false
        q('.star-draft-method').textContent = automatic ? 'CV estimate · not imported yet' : 'CV-assisted estimate · axes confirmed by you; not imported yet'
        if (p.plan) q('.star-draft-method').textContent += p.plan.spline_count ? ' · smooth sections; original corners and turns' : ' · original trace is safer for this ink'
        q('.star-draft-help').textContent = 'Here’s our best estimate. Accept it to move the vertices and adjust the curve before submitting. Red rings flag turns to check; some marks may be missing. Only accepted native drawings are graded.'
        paint()
      } catch (e) { q('.star-draft-help').textContent = e.message; paint() }
    }
    start.addEventListener('click', () => {
      if (!source) return
      if (accepted()) { phase = 'student_accepted_native_draft'; selectNative(); reference.message('Your editable draft is on the canvas. Use Select to drag its vertices, then Save & Grade.'); return }
      priorFrame = reference.getFrame(); axes = {}; marker = 'origin'; phase = 'calibration'; ui.hidden = false; start.hidden = true; q('.star-draft-axis-inputs').hidden = false; q('.star-draft-realign').hidden = true; q('.star-draft-x').value = q('.star-draft-y').value = ''; invalidate()
      q('.star-draft-method').textContent = 'CV-assisted · confirm axes; no retracing or fragment checklist'
      q('.star-draft-help').textContent = 'Click the photo’s origin O = (0,0). No curve is imported until you accept the estimate.'
      const cv = panel.querySelector('.star-canvas-cv'); if (cv.checked) cv.click()
      if (source.status === 'automatic') preview()
      else if (priorFrame && priorFrame.origin_graph.every(v => v === 0)) {
        axes = { origin: priorFrame.origin_pixel, xMarker: priorFrame.origin_pixel.map((v, i) => v + priorFrame.x_unit_vector_pixel[i]), yMarker: priorFrame.origin_pixel.map((v, i) => v + priorFrame.y_unit_vector_pixel[i]) }; q('.star-draft-x').value = q('.star-draft-y').value = '1'; preview()
      }
      svg.scrollIntoView({ block: 'nearest' }); svg.focus({ preventScroll: true }); paint()
    })
    function pick (event) {
      if (ui.hidden || phase !== 'calibration') return
      event.preventDefault(); event.stopImmediatePropagation(); if (event.type !== 'pointerdown') return
      const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse()); cursor = [p.x, p.y]; const photo = reference.toPhoto(cursor)
      if (photo.some((v, i) => v < 0 || v >= [source.image.width, source.image.height][i])) { q('.star-draft-help').textContent = 'Choose a position inside the photograph.'; return }
      axes[marker] = photo; marker = marker === 'origin' ? 'xMarker' : marker === 'xMarker' ? 'yMarker' : 'origin'; invalidate()
      q('.star-draft-help').textContent = axes.origin && axes.xMarker && axes.yMarker ? 'Enter the values written at your x and y ticks.' : marker === 'xMarker' ? 'Click a known x tick.' : 'Click a known y tick.'
      if (Object.keys(axes).length === 3 && Number.isFinite(values().xValue) && Number.isFinite(values().yValue)) preview(); else paint()
    }
    for (const name of ['pointerdown', 'pointermove', 'pointerup', 'click', 'mousedown', 'mouseup', 'touchstart', 'touchend']) svg.addEventListener(name, pick, true)
    svg.addEventListener('keydown', e => {
      if (ui.hidden) return
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); start.focus(); return }
      if (phase !== 'calibration' || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) return
      e.preventDefault(); e.stopImmediatePropagation()
      if (e.key === 'Enter') { const p = new DOMPoint(...cursor).matrixTransform(svg.getScreenCTM()); pick({ type: 'pointerdown', clientX: p.x, clientY: p.y, preventDefault () {}, stopImmediatePropagation () {} }) }
      else { const k = ['ArrowLeft', 'ArrowRight'].includes(e.key) ? 0 : 1; cursor[k] = Math.max(0, Math.min(k ? config.height : config.width, cursor[k] + (['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 1) * (e.shiftKey ? 10 : 1))) }
    }, true)
    for (const b of ui.querySelectorAll('[data-marker]')) b.addEventListener('click', () => { marker = b.dataset.marker; svg.focus({ preventScroll: true }) })
    for (const name of ['.star-draft-x', '.star-draft-y']) q(name).addEventListener('input', () => { invalidate(); if (Object.keys(axes).length === 3) preview() })
    ui.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.preventDefault(); if (e.key === 'Escape') close() }); ui.addEventListener('keyup', e => e.stopPropagation())
    q('.star-draft-realign').addEventListener('click', () => { invalidate(); phase = 'calibration'; reference.setFrame(priorFrame); q('.star-draft-axis-inputs').hidden = false; q('.star-draft-help').textContent = 'Adjust the markers or written tick values.'; paint() })
    q('.star-draft-cancel').addEventListener('click', () => close())
    if (adaptive) {
      styleChoice.addEventListener('change', () => { session.setMode(styleChoice.value); preview(acceptedGeometry) })
      styleButton.addEventListener('click', () => { if (!acceptedGeometry) return; priorFrame = reference.getFrame(); ui.hidden = false; start.hidden = true; preview(acceptedGeometry) })
    }
    panel.addEventListener('click', e => { if (!ui.hidden && e.target.closest('.star-canvas-correct, .star-canvas-edit, .star-canvas-advanced-actions button')) close() }, true)
    container.querySelector('.si-toolbar')?.addEventListener('click', () => { if (!ui.hidden) close() })
    q('.star-draft-accept').addEventListener('click', () => {
      if (!proposal || !geometry) return
      try {
        const g = geometry; const representation = proposal.plan; const receipt = session.commit(proposal.token, true); reference.setFrame(frame(g), true); const key = cacheKey(); if (key) try { sessionStorage.setItem(key, hash) } catch (_) {}
        if (adaptive) { acceptedGeometry = g; styleButton.disabled = false }
        ui.hidden = true; start.hidden = false; phase = 'student_accepted_native_draft'; invalidate(); start.textContent = 'Edit detected graph'; selectNative()
        reference.message('Here’s our best estimate. Drag its vertices with Select to adjust the curve, then Save & Grade. Highlighted turns are still part of your drawing.')
        container.dispatchEvent(new CustomEvent('star-draft-imported', { detail: { geometry: g, receipt, ...(representation ? { representation } : {}), method: automatic ? 'CV automatic candidate, explicitly accepted' : 'CV-assisted draft, student-confirmed axes', state: phase } }))
      } catch (e) { invalidate(); start.hidden = false; q('.star-draft-help').textContent = e.message + ' Reopen Edit detected graph to prepare a current estimate.' }
    })
    container.closest('form')?.addEventListener('submit', () => { if (accepted()) phase = 'submitted_answer' })
    panel.querySelector('.star-canvas-remove').addEventListener('click', () => { close(false); source = null; hash = ''; phase = 'empty'; start.disabled = true; if (adaptive) { session.resetOwnership(); acceptedGeometry = null; styleButton.disabled = true } })
    const api = { update (event) {
      if (event.kind === 'loading') { close(); revision = event.revision; session.invalidate(revision); source = null; start.disabled = true; if (adaptive) { session.resetOwnership(); acceptedGeometry = null; styleButton.disabled = true } }
      if (event.kind === 'photo') hash = event.sha256
      if (event.kind === 'recognition' && event.revision === revision) { source = event.geometry; start.disabled = !source.strokes.length; const upload = panel.querySelector('.star-canvas-upload'); upload.classList.toggle('btn-primary', !source.strokes.length); upload.classList.toggle('btn-light', !!source.strokes.length); upload.classList.toggle('border', !!source.strokes.length); phase = accepted() ? 'student_accepted_native_draft' : 'ready'; reference.message(accepted() ? 'Your saved editable draft is restored. Use Select to drag its vertices.' : source.strokes.length ? 'A CV estimate is available. Choose Edit detected graph; confirm axes if needed.' : 'No usable curve was detected. Your photo is visible; draw with native tools or use manual tracing in Photo options.'); paint() }
    }, status: () => ({ phase, revision, hasProposal: !!proposal, photoSha256: hash, axisValues: values(), automatic, nativeTool: config.editablePhotoDraftTool }) }
    instances[id] = api; return api
  }
  return { mount, instances }
})()
