// Fit each axis independently from the photo readings and the student's coordinates.
const StarCalibration = (() => {
  function fitReferences (references) {
    const coordinates = new Set()
    const locations = new Set()
    if (!references.length) throw new Error('Add a reference point.')
    for (const ref of references) {
      if (!ref || !ref.read.every(Number.isFinite) || !ref.known.every(Number.isFinite)) {
        throw new Error('Select each point on the photo and enter its x and y coordinates.')
      }
      const coordinate = ref.known.join(',')
      const location = ref.read.join(',')
      if (coordinates.has(coordinate) || locations.has(location)) {
        throw new Error('Each point needs a distinct photo location and coordinate pair. Move or remove the duplicate point.')
      }
      coordinates.add(coordinate)
      locations.add(location)
    }
    const scale = [1, 1]
    const offset = [0, 0]
    for (const axis of [0, 1]) {
      const meanRead = references.reduce((sum, r) => sum + r.read[axis], 0) / references.length
      const meanKnown = references.reduce((sum, r) => sum + r.known[axis], 0) / references.length
      if (references.some(r => r.known[axis] !== references[0].known[axis])) {
        let variance = 0
        let covariance = 0
        let minRead = Infinity
        let maxRead = -Infinity
        for (const ref of references) {
          const reading = ref.read[axis]
          minRead = Math.min(minRead, reading)
          maxRead = Math.max(maxRead, reading)
          const delta = reading - meanRead
          variance += delta * delta
          covariance += delta * (ref.known[axis] - meanKnown)
        }
        scale[axis] = covariance / variance
        if (maxRead - minRead < 1e-8 || !Number.isFinite(scale[axis]) || scale[axis] <= 0) {
          const name = axis === 0 ? 'x' : 'y'
          throw new Error('Check the order and spacing of your points along the ' + name + '-axis.')
        }
      }
      offset[axis] = meanKnown - scale[axis] * meanRead
    }
    return { scale, offset, map: ([x, y]) => [scale[0] * x + offset[0], scale[1] * y + offset[1]] }
  }

  // Match clicks to the original, separate strokes in photo pixels. Insert each
  // target as a spline knot after simplification so it survives conversion to Béziers.
  function constrainBranches (branches, references, toPhoto) {
    const hits = branches.map(() => [])
    const pixels = branches.map(branch => branch.map(toPhoto))
    for (const ref of references.filter(r => r.onCurve)) {
      let best = null
      for (const [b, points] of pixels.entries()) {
        for (let i = 1; i < points.length; i++) {
          const [x, y] = points[i - 1]
          const dx = points[i][0] - x, dy = points[i][1] - y
          const length2 = dx * dx + dy * dy
          const t = length2 ? Math.max(0, Math.min(1, ((ref.photo[0] - x) * dx + (ref.photo[1] - y) * dy) / length2)) : 0
          const distance = Math.hypot(ref.photo[0] - x - t * dx, ref.photo[1] - y - t * dy)
          if (!best || distance < best.distance) best = { b, i, t, distance }
        }
      }
      if (!best) continue
      const { b, i, t } = best
      const start = branches[b][i - 1], end = branches[b][i]
      const delta = ref.known.map((v, axis) => v - (start[axis] + t * (end[axis] - start[axis])))
      hits[b].push({ at: i - 1 + t, point: ref.known, delta })
    }
    return branches.map((branch, b) => {
      const pins = hits[b].sort((a, b) => a.at - b.at)
      if (!pins.length) return branch
      // Blend the displacement into the neighboring knots. Leave the rest of
      // the branch alone, including both ends unless a nearby marker moves one.
      const knots = pins.slice()
      for (const [at, point] of branch.entries()) {
        if (pins.some(pin => pin.at === at)) continue
        const left = pins.findLast(pin => pin.at < at)
        const right = pins.find(pin => pin.at > at)
        const wl = left ? Math.max(0, 1 - (at - left.at)) : 0
        const wr = right ? Math.max(0, 1 - (right.at - at)) : 0
        const moved = point.map((v, axis) => v + (wl * (left?.delta[axis] || 0) + wr * (right?.delta[axis] || 0)) / Math.max(1, wl + wr))
        knots.push({ at, point: moved })
      }
      return knots.sort((a, b) => a.at - b.at).map(knot => knot.point)
    })
  }

  function drawMarkers (ctx, points, position, unit = 1, active = -1) {
    ctx.save()
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'
    points.forEach((ref, i) => {
      const p = position(ref)
      if (!p?.every(Number.isFinite)) return
      const [x, y] = p
      const color = i === active ? '#b12432' : '#175a91'
      ctx.beginPath()
      ctx.arc(x, y, 5 * unit, 0, Math.PI * 2)
      ctx.lineWidth = 4 * unit
      ctx.strokeStyle = '#fff'
      ctx.stroke()
      ctx.lineWidth = 2 * unit
      ctx.strokeStyle = color
      ctx.stroke()
      if (ref.onCurve) { ctx.fillStyle = color; ctx.fill() }
      ctx.font = 'bold ' + (13 * unit) + 'px sans-serif'
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 3 * unit
      ctx.strokeText(String(i + 1), x + 6 * unit, y - 3 * unit)
      ctx.fillStyle = color
      ctx.fillText(String(i + 1), x + 6 * unit, y - 3 * unit)
    })
    ctx.restore()
  }

  function drawCurves (ctx, curves, tool, pixel) {
    for (const stroke of curves) {
      const points = stroke.map(pixel)
      ctx.beginPath()
      ctx.moveTo(...points[0])
      if (tool === 'freeform') {
        for (let i = 1; i + 2 < points.length; i += 3) {
          ctx.bezierCurveTo(...points[i], ...points[i + 1], ...points[i + 2])
        }
      } else {
        for (const p of points.slice(1)) ctx.lineTo(...p)
      }
      ctx.stroke()
    }
  }

  function drawPreview (canvas, curves, config, tool, references) {
    const ctx = canvas.getContext('2d')
    const { width, height, xrange, yrange } = config
    const pixel = ([x, y]) => [
      width * (x - xrange[0]) / (xrange[1] - xrange[0]),
      height * (yrange[1] - y) / (yrange[1] - yrange[0])
    ]
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    // Limit the number of ticks if an author uses a wider graphing window.
    const tick = Math.max(1, Math.ceil(Math.max(xrange[1] - xrange[0], yrange[1] - yrange[0]) / 14))
    ctx.font = '12px sans-serif'
    for (const axis of [0, 1]) {
      const range = axis === 0 ? xrange : yrange
      for (let value = Math.ceil(range[0] / tick) * tick; value <= range[1]; value += tick) {
        const [x, y] = pixel(axis === 0 ? [value, 0] : [0, value])
        ctx.beginPath()
        ctx.moveTo(axis === 0 ? x : 0, axis === 0 ? 0 : y)
        ctx.lineTo(axis === 0 ? x : width, axis === 0 ? height : y)
        ctx.strokeStyle = value === 0 ? '#334652' : '#d4e1e8'
        ctx.lineWidth = value === 0 ? 1.5 : 1
        ctx.stroke()
        if (value !== 0) {
          ctx.fillStyle = '#3d525d'
          ctx.fillText(String(value), Math.max(2, Math.min(width - 16, x + 3)), Math.max(12, Math.min(height - 2, y + 14)))
        }
      }
    }
    ctx.strokeStyle = '#134eaa'
    ctx.lineWidth = 2.5
    drawCurves(ctx, curves, tool, pixel)
    drawMarkers(ctx, references, ref => ref && pixel(ref.known))
  }

  function render ({ section, photo, locate, prepare, initial, config, tool, next, back, skip }) {
    const doc = section.ownerDocument
    section.innerHTML = `
      <style>
        .reference-calibration .pair { grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr)); align-items:start }
        .reference-calibration canvas { width:100%; height:auto; border:0; outline:1px solid var(--rule) }
        .reference-calibration canvas:focus-visible { outline:3px solid var(--focus) }
        .reference-calibration .photo-point { cursor:crosshair }
        .reference-calibration fieldset { min-width:0; padding:8px; margin:0; border:1px solid var(--rule) }
        .reference-calibration fieldset:focus-within { border-color:var(--axis) }
        .reference-calibration input[type=number] { width:6em }
      </style>
      <div class="panel">
        <h2 id="calibration-title" tabindex="-1">Calibrate photo</h2>
        <p>Click a point on the photo and enter its x and y coordinates. To set spacing on both axes, include points with different x and y values. Check “Curve must pass through this point” to guide the nearest traced branch through those coordinates.</p>
        <div class="row">
          <button type="button" data-skip>Skip calibration and fix axes</button>
          <button type="button" data-back>Back to review</button>
        </div>
        <div class="pair">
          <div class="panel">
            <div class="label">Original photo</div>
            <canvas class="photo-point" tabindex="0" aria-label="Choose a known point on the photo. Use the arrow keys to adjust the marker by one image pixel."></canvas>
            <small>Use the arrow keys on the photo to move the active marker one pixel.</small>
          </div>
          <div class="panel">
            <div class="label" data-preview-label>Original graph</div>
            <canvas data-preview aria-label="Graph preview"></canvas>
          </div>
        </div>
        <div data-references class="panel"></div>
        <div class="row">
          <button type="button" data-add>Add another point</button>
          <button type="button" data-remove>Remove selected point</button>
        </div>
        <p role="status"></p>
        <div class="row">
          <button type="button" class="primary" data-apply disabled>Continue to axis fix</button>
        </div>
      </div>`
    const find = selector => section.querySelector(selector)
    const photoCanvas = find('.photo-point')
    photoCanvas.width = photo.width
    photoCanvas.height = photo.height
    const preview = find('[data-preview]')
    preview.width = config.width
    preview.height = config.height
    const status = find('[role=status]')
    const apply = find('[data-apply]')
    const refs = []
    let active = 0
    let calibration = null

    function drawPhoto () {
      const ctx = photoCanvas.getContext('2d')
      ctx.drawImage(photo, 0, 0)
      const unit = photo.width / (photoCanvas.getBoundingClientRect().width || photo.width)
      drawMarkers(ctx, refs, ref => ref.photo, unit, active)
    }

    function update () {
      calibration = null
      let corrected = null
      const references = refs.map(ref => ref.photo && {
        photo: ref.photo, onCurve: ref.onCurve, read: locate(...ref.photo),
        known: ref.fields.map(field => field.valueAsNumber)
      })
      try {
        const fit = fitReferences(references)
        const result = prepare(fit, references)
        if (result.some(stroke => stroke.some(p => !p.every(Number.isFinite)))) {
          throw new Error('Check the coordinate values and try again.')
        }
        corrected = result
        calibration = { ...fit, points: references.map(({ photo, known, onCurve }) => ({ photo, known, onCurve })) }
        if (references.length === 1) {
          status.textContent = 'Position adjusted. Tick spacing is unchanged.'
        } else if (references.every(r => r.known[1] === references[0].known[1])) {
          status.textContent = 'Horizontal spacing calibrated. Vertical spacing uses the photo’s original scale.'
        } else if (references.every(r => r.known[0] === references[0].known[0])) {
          status.textContent = 'Vertical spacing calibrated. Horizontal spacing uses the photo’s original scale.'
        } else {
          status.textContent = 'Position and tick spacing adjusted.'
        }
      } catch (error) {
        status.textContent = error.message
      }
      for (const [i, ref] of refs.entries()) {
        ref.number.textContent = 'Point ' + (i + 1)
        ref.fields[0].setAttribute('aria-label', 'Point ' + (i + 1) + ' x')
        ref.fields[1].setAttribute('aria-label', 'Point ' + (i + 1) + ' y')
        const read = references[i]?.read
        ref.readout.textContent = read?.every(Number.isFinite)
          ? 'Photo currently reads (' + read.map(x => Number(x.toFixed(2))).join(', ') + ').'
          : 'Select this point on the photo.'
      }
      apply.disabled = !corrected
      find('[data-remove]').disabled = refs.length === 1
      find('[data-preview-label]').textContent = corrected ? 'Calibrated graph' : 'Original graph'
      drawPreview(preview, corrected || prepare(null, []), config, tool, references)
      drawPhoto()
    }

    function addReference (saved) {
      const row = doc.createElement('fieldset')
      row.innerHTML = `<legend><label><input type="radio" name="photo-reference" checked> <span></span></label></legend>
        <div class="row">
          <label>x <input type="number" step="any"></label>
          <label>y <input type="number" step="any"></label>
          <label><input type="checkbox"> Curve must pass through this point</label>
          <small></small>
        </div>`
      find('[data-references]').appendChild(row)
      const select = row.querySelector('[type=radio]')
      const fields = Array.from(row.querySelectorAll('[type=number]'))
      const ref = { photo: saved?.photo || null, onCurve: saved?.onCurve === true, row, fields, select, number: row.querySelector('legend span'), readout: row.querySelector('small') }
      const checkbox = row.querySelector('[type=checkbox]')
      checkbox.checked = ref.onCurve
      checkbox.addEventListener('input', () => { ref.onCurve = checkbox.checked })
      if (saved) fields.forEach((field, axis) => { field.value = saved.known[axis] })
      refs.push(ref)
      active = refs.length - 1
      row.addEventListener('focusin', () => { active = refs.indexOf(ref); select.checked = true; drawPhoto() })
      row.addEventListener('input', update)
    }

    function pick (x, y) {
      refs[active].photo = [
        Math.max(0, Math.min(photo.width - 1, x)),
        Math.max(0, Math.min(photo.height - 1, y))
      ]
      update()
    }
    photoCanvas.addEventListener('click', event => {
      const box = photoCanvas.getBoundingClientRect()
      pick((event.clientX - box.left) * photo.width / box.width, (event.clientY - box.top) * photo.height / box.height)
    })
    photoCanvas.addEventListener('keydown', event => {
      const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
      if (!delta) return
      event.preventDefault()
      const [x, y] = refs[active].photo || [photo.width / 2, photo.height / 2]
      pick(x + delta[0], y + delta[1])
    })
    find('[data-add]').addEventListener('click', () => {
      addReference()
      photoCanvas.focus()
      update()
    })
    find('[data-remove]').addEventListener('click', () => {
      refs.splice(active, 1)[0].row.remove()
      active = Math.min(active, refs.length - 1)
      refs[active].select.checked = true
      refs[active].select.focus()
      update()
    })
    apply.addEventListener('click', () => {
      if (!calibration) return
      try { next(calibration) } catch (error) { status.textContent = error.message }
    })
    find('[data-back]').addEventListener('click', back)
    find('[data-skip]').addEventListener('click', skip)
    if (initial.length) initial.forEach(addReference)
    else addReference()
    update()
    find('h2').focus({ preventScroll: true })
  }

  return { render, drawMarkers, drawCurves, drawPreview, constrainBranches, fromReferences: references => fitReferences(references).map }
})()

if (typeof module !== 'undefined' && module.exports) module.exports = StarCalibration
if (typeof window !== 'undefined') window.StarCalibration = StarCalibration
