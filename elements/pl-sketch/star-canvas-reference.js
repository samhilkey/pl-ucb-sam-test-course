/* Ungraded canvas reference. Never writes SketchResponse state or gradeable data. */
;(function (root) {
  'use strict'
  const prefix = 'star.canvas-photo.v1:'; const maxAge = 24 * 60 * 60 * 1000; const maxData = 4000000
  function fit (image, canvas, inset = 10) {
    if (![image.width, image.height, canvas.width, canvas.height].every(n => Number.isFinite(n) && n > 0) || !Number.isFinite(inset) || inset < 0 || canvas.width <= inset * 2 || canvas.height <= inset * 2) throw new Error('Invalid reference frame.')
    const scale = Math.min((canvas.width - inset * 2) / image.width, (canvas.height - inset * 2) / image.height)
    return { x: (canvas.width - image.width * scale) / 2, y: (canvas.height - image.height * scale) / 2, width: image.width * scale, height: image.height * scale, scale }
  }
  function storageKey (path, variant, id, signature) {
    return typeof path === 'string' && path.startsWith('/pl/') && /^\d+$/.test(variant || '') && typeof id === 'string' && id.length && typeof signature === 'string'
      ? prefix + JSON.stringify([path, variant, id, signature]) : null
  }
  function savedRecord (text, scope, now = Date.now()) {
    const r = JSON.parse(text)
    if (!r || r.version !== 1 || r.scope !== scope || !Number.isFinite(r.savedAt) || r.savedAt > now || now - r.savedAt > maxAge ||
        typeof r.name !== 'string' || !r.name.length || r.name.length > 255 || !['image/png', 'image/jpeg', 'image/webp'].includes(r.type) ||
        !/^[a-f0-9]{64}$/.test(r.sha256 || '') || typeof r.data !== 'string' || r.data.length > maxData ||
        !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(r.data) || !r.data.startsWith('data:' + r.type + ';') ||
        typeof r.visible !== 'boolean' || typeof r.showCV !== 'boolean') throw new Error('Invalid saved photo reference.')
    return r
  }
  const instances = {}
  function mount ({ id, config }) {
    const container = document.getElementById(id + '-si-container'); const svg = document.getElementById(id + '-si-canvas')
    if (!container || !svg || instances[id]) return instances[id]
    const panel = document.createElement('section'); panel.className = 'star-canvas-photo'; panel.setAttribute('aria-label', 'Canvas photo reference')
    panel.innerHTML = `<div class="star-canvas-photo-actions"><label class="btn btn-primary star-canvas-upload">Upload / Take photo<input type="file" accept="image/png,image/jpeg,image/webp" capture="environment" aria-label="Upload or take a graph photo"></label><button type="button" class="btn btn-light border star-canvas-edit" disabled>Edit on canvas</button><button type="button" class="btn btn-light border star-canvas-visible" disabled>Hide photo</button></div><p class="star-canvas-photo-status" role="status">Upload a photo, then draw or correct your graph on the canvas.</p><p class="star-canvas-photo-note" hidden>Reference only; not aligned to canvas axes. Only your native drawings are graded.</p><p class="star-canvas-storage-note" hidden></p><details class="star-canvas-photo-options"><summary>Photo options</summary><div class="star-canvas-photo-extra"><label><input type="checkbox" class="star-canvas-cv" checked> Show provisional CV lines (not graded)</label><label>Photo visibility <input class="star-canvas-opacity" type="range" min="20" max="80" value="55" aria-label="Photo opacity"></label><button type="button" class="btn btn-light border star-canvas-remove" disabled>Remove photo</button><button type="button" class="btn btn-light border star-canvas-draft" hidden>Review recognized draft</button></div><div class="star-canvas-advanced-actions"></div></details>`
    panel.style.width = config.width + 'px'; container.insertBefore(panel, svg)
    const q = s => panel.querySelector(s)
    // Paint only pixels in an SVG foreignObject: no extra SVG paths or native
    // plugin IDs, so even DOM-based path selection cannot adopt provisional ink.
    const layer = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject')
    layer.id = id + '-photo-reference'; layer.setAttribute('class', 'star-canvas-reference-layer'); layer.setAttribute('x', 0); layer.setAttribute('y', 0); layer.setAttribute('width', config.width); layer.setAttribute('height', config.height); layer.setAttribute('pointer-events', 'none'); layer.setAttribute('aria-hidden', 'true')
    const paint = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas'); paint.width = config.width; paint.height = config.height; paint.style.pointerEvents = 'none'; layer.append(paint)
    function placeLayer () {
      // The inspected native SVG begins with two background rectangles. Place
      // the reference after these, before axes, drawing previews and objects.
      const anchor = [...svg.children].find(n => n !== layer && n.tagName.toLowerCase() !== 'rect')
      if (layer.parentNode !== svg || layer.nextElementSibling !== anchor) svg.insertBefore(layer, anchor || null)
    }
    placeLayer()
    new MutationObserver(placeLayer).observe(svg, { childList: true })
    svg.setAttribute('tabindex', svg.getAttribute('tabindex') || '0')
    let controller = null; let revision = -1; let source = null; let original = null; let geometry = null; let sha256 = ''; let visible = true; let showCV = true; let stored = false; let record = null; let restoring = null; let sourceRevision = -1
    const signature = JSON.stringify([config.width, config.height, config.xrange, config.yrange])
    const variant = container.closest('form')?.querySelector('input[name="__variant_id"]')?.value
    const scope = storageKey(location.pathname, variant, id, signature)
    function forget () { if (scope) try { sessionStorage.removeItem(scope) } catch (_) {} }
    function storageNote (text) { q('.star-canvas-storage-note').hidden = false; q('.star-canvas-storage-note').textContent = text }
    function writeRecord () {
      if (!scope || !record) return
      try { sessionStorage.setItem(scope, JSON.stringify({ ...record, visible, showCV })); stored = true; storageNote('Photo kept in this tab for this attempt (up to 24 hours), not submitted to PrairieLearn.') } catch (_) {
        stored = false; forget(); storageNote('Photo is available now but could not be kept in this tab. Reupload it after refresh; your saved drawings are unaffected.')
      }
    }
    function persist (file, token) {
      stored = false; record = null; forget()
      if (!scope) { storageNote('Photo lasts until refresh in this view. Saved native drawings still restore normally.'); return }
      const reader = new FileReader()
      reader.onload = () => {
        if (token !== revision || original !== file) return
        if (typeof reader.result !== 'string' || reader.result.length > maxData || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { storageNote('Photo is available now but too large to keep in this tab. Reupload it after refresh.'); return }
        record = { version: 1, scope, name: file.name.slice(0, 255), type: file.type, sha256, data: reader.result, savedAt: Date.now(), visible, showCV }; writeRecord()
      }
      reader.onerror = () => { if (token === revision) storageNote('Photo is available now. Reupload it after refresh; browser storage is unavailable.') }
      reader.readAsDataURL(file)
    }
    function render () {
      const ctx = paint.getContext('2d'); ctx.clearRect(0, 0, paint.width, paint.height)
      layer.style.display = source && visible ? '' : 'none'
      if (source) {
        const rect = fit(source.originalSize, config); ctx.globalAlpha = Number(q('.star-canvas-opacity').value) / 100
        ctx.drawImage(source.canvas, rect.x, rect.y, rect.width, rect.height); ctx.globalAlpha = 1
        if (showCV && geometry) {
          ctx.strokeStyle = '#b95800'; ctx.lineWidth = 2; ctx.setLineDash([5, 4])
          for (const s of geometry.strokes) { ctx.beginPath(); s.vertices.forEach((v, i) => { const p = [rect.x + v.pixel[0] * rect.scale, rect.y + v.pixel[1] * rect.scale]; if (i) ctx.lineTo(...p); else ctx.moveTo(...p) }); ctx.stroke() }
          ctx.setLineDash([])
        }
      }
      q('.star-canvas-visible').textContent = visible ? 'Hide photo' : 'Show photo'; q('.star-canvas-visible').setAttribute('aria-pressed', String(visible))
      for (const s of ['.star-canvas-edit', '.star-canvas-visible', '.star-canvas-remove']) q(s).disabled = !source || s === '.star-canvas-edit' && !!config.readonly
      q('.star-canvas-photo-note').hidden = !source
      if (source) q('.star-canvas-photo-note').textContent = original.name + ' · Reference only; not aligned to canvas axes. Only native drawings are graded.' + (visible && showCV && geometry?.strokes.length ? ' Dashed orange lines: provisional CV, not graded.' : '')
      placeLayer()
    }
    function update (event) {
      if (event.kind === 'draft-cleared') { q('.star-canvas-draft').hidden = true; return }
      if (event.revision < revision) return
      if (event.kind === 'loading') { revision = event.revision; geometry = null; q('.star-canvas-draft').hidden = true; q('.star-canvas-photo-status').textContent = 'Opening photo… Your existing drawings are kept.'; render(); return }
      if (event.revision !== revision) return
      if (event.kind === 'photo') {
        const max = Math.min(1, 1200 / Math.max(event.bitmap.width, event.bitmap.height)); const buffer = document.createElement('canvas'); buffer.width = Math.max(1, Math.round(event.bitmap.width * max)); buffer.height = Math.max(1, Math.round(event.bitmap.height * max)); buffer.getContext('2d').drawImage(event.bitmap, 0, 0, buffer.width, buffer.height)
        sourceRevision = revision; source = { canvas: buffer, originalSize: { width: event.bitmap.width, height: event.bitmap.height } }; original = event.file; sha256 = event.sha256; geometry = null
        visible = restoring ? restoring.visible : true; showCV = restoring ? restoring.showCV : true; q('.star-canvas-cv').checked = showCV; restoring = null
        q('.star-canvas-photo-status').textContent = 'Your photo is ready. Draw or correct directly on the canvas while CV checks it.'; render(); persist(original, revision); svg.scrollIntoView({ block: 'nearest' })
      } else if (event.kind === 'recognition') {
        geometry = event.geometry; q('.star-canvas-draft').hidden = !event.nativeDraftReady
        q('.star-canvas-photo-status').textContent = event.nativeDraftReady ? 'Your photo is ready. Draw directly, or review the recognized draft in Photo options.' : "We couldn't recognize every part of your graph. Your photo is ready—correct the drawing directly on the canvas."
        render()
      } else if (event.kind === 'error') {
        q('.star-canvas-draft').hidden = true
        q('.star-canvas-photo-status').textContent = source ? (sourceRevision === revision ? 'Recognition is unavailable. Your photo stays ready for drawing directly on the canvas.' : 'Could not open the new image. Your previous photo stays on the canvas; your drawings are unchanged.') : 'Could not open this image. Choose another photo; your drawings are unchanged.'
        if (!source && restoring) { restoring = null; forget() } else if (source && sourceRevision !== revision && original) persist(original, revision)
        render()
      }
    }
    async function restore () {
      if (!scope) return
      try {
        const text = sessionStorage.getItem(scope); if (!text) return
        const saved = savedRecord(text, scope); const bytes = Uint8Array.from(atob(saved.data.split(',')[1]), c => c.charCodeAt(0))
        const digest = await crypto.subtle.digest('SHA-256', bytes); const actual = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
        if (actual !== saved.sha256) throw new Error('Saved image mismatch.')
        if (source || revision !== -1) return // a new selection wins over restoration
        restoring = saved; await controller.loadPhoto(new File([bytes], saved.name, { type: saved.type }))
      } catch (_) { if (!source && revision === -1) { forget(); storageNote('The saved photo could not be restored. Reupload it; native drawings are unaffected.') } }
    }
    q('input[type=file]').disabled = !!config.readonly
    q('input[type=file]').addEventListener('change', e => { const file = e.target.files[0]; if (file && controller) { restoring = null; controller.loadPhoto(file) } })
    q('.star-canvas-edit').addEventListener('click', () => { const tool = (config.plugins || []).find(t => t.name === 'freeform' && !t.readonly && !t.helper && !t.overlay); const draw = tool?.label && [...container.querySelectorAll('.si-toolbar button')].find(b => b.textContent.replace(/\s+/g, ' ').trim() === tool.label); if (draw) draw.click(); svg.scrollIntoView({ block: 'nearest' }); svg.focus({ preventScroll: true }) })
    q('.star-canvas-visible').addEventListener('click', () => { visible = !visible; render(); writeRecord() })
    q('.star-canvas-cv').addEventListener('change', e => { showCV = e.target.checked; render(); writeRecord() })
    q('.star-canvas-opacity').addEventListener('input', render)
    q('.star-canvas-remove').addEventListener('click', () => { revision++; source = original = geometry = record = restoring = null; sha256 = ''; stored = false; forget(); controller.clearPhoto(); q('input[type=file]').value = ''; q('.star-canvas-draft').hidden = true; q('.star-canvas-storage-note').hidden = true; q('.star-canvas-photo-status').textContent = 'Reference removed. Your native drawings are kept.'; render() })
    q('.star-canvas-draft').addEventListener('click', () => { if (!q('.star-canvas-draft').hidden) controller.open() })
    panel.addEventListener('keydown', e => e.stopPropagation()); panel.addEventListener('keyup', e => e.stopPropagation())
    const api = {
      update,
      connect: automatic => {
        controller = automatic
        const advanced = document.getElementById(id + '-automatic-button'); advanced.className = 'btn btn-light border'; advanced.textContent = 'Advanced photo review'; q('.star-canvas-advanced-actions').append(advanced)
        const manual = document.getElementById(id + '-star-photo-btn'); if (manual) q('.star-canvas-advanced-actions').append(manual.parentElement)
        restore()
      },
      status: () => ({ photoVisible: !!source && visible, cvOverlayVisible: !!source && visible && showCV && !!geometry?.strokes.length, sourceName: original?.name || null, sourceSha256: sha256 || null, revision, recognitionStatus: geometry?.status || null, stored, scope, fit: source ? fit(source.originalSize, config) : null, ungraded: true })
    }
    instances[id] = api; render(); return api
  }
  const api = { fit, storageKey, savedRecord, mount, instances }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.StarCanvasReference = api
})(typeof window !== 'undefined' ? window : globalThis)
