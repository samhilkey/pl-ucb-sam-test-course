/* Deterministic, local CV. Input is RGBA pixels, never a solution or trace. */
;(function (root) {
  'use strict'
  const Geometry = typeof module !== 'undefined' && module.exports ? require('./star-geometry.js') : root.StarGeometry
  const median = xs => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  const digits = {
    0: ['01110', '11011', '11011', '11011', '11011', '11011', '01110'],
    1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    2: ['01110', '11011', '00011', '00110', '01100', '11000', '11111'],
    3: ['11110', '00011', '00011', '01110', '00011', '00011', '11110'],
    4: ['00011', '00111', '01111', '11011', '11111', '00011', '00011'],
    5: ['11111', '11000', '11000', '11110', '00011', '00011', '11110'],
    6: ['01110', '11000', '11000', '11110', '11011', '11011', '01110'],
    7: ['11111', '00011', '00011', '00110', '01100', '01100', '01100'],
    8: ['01110', '11011', '11011', '01110', '11011', '11011', '01110'],
    9: ['01110', '11011', '11011', '01111', '00011', '00011', '01110']
  }

  function resize (image, maxDimension) {
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
    const w = Math.max(1, Math.round(image.width * scale)); const h = Math.max(1, Math.round(image.height * scale))
    const data = new Uint8ClampedArray(w * h * 4)
    const sx = w / image.width; const sy = h / image.height
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const px = clamp((x + 0.5) / sx - 0.5, 0, image.width - 1); const py = clamp((y + 0.5) / sy - 0.5, 0, image.height - 1)
      const x0 = Math.floor(px); const y0 = Math.floor(py); const tx = px - x0; const ty = py - y0
      for (let c = 0; c < 3; c++) {
        let v = 0
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
          const k = (Math.min(image.height - 1, y0 + j) * image.width + Math.min(image.width - 1, x0 + i)) * 4
          const alpha = image.data[k + 3] / 255
          v += (image.data[k + c] * alpha + 255 * (1 - alpha)) * (i ? tx : 1 - tx) * (j ? ty : 1 - ty)
        }
        data[(y * w + x) * 4 + c] = v
      }
      data[(y * w + x) * 4 + 3] = 255
    }
    return { width: w, height: h, data, sx, sy, toSource: p => [(p[0] + 0.5) / sx - 0.5, (p[1] + 0.5) / sy - 0.5] }
  }

  function components (mask, w, h) {
    const seen = new Uint8Array(mask.length); const out = []
    for (let k = 0; k < mask.length; k++) {
      if (!mask[k] || seen[k]) continue
      const pixels = [k]; seen[k] = 1
      let minX = w; let maxX = 0; let minY = h; let maxY = 0
      for (let q = 0; q < pixels.length; q++) {
        const p = pixels[q]; const x = p % w; const y = Math.floor(p / w)
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx; const yy = y + dy; const n = yy * w + xx
          if (xx >= 0 && yy >= 0 && xx < w && yy < h && mask[n] && !seen[n]) { seen[n] = 1; pixels.push(n) }
        }
      }
      out.push({ pixels, bounds: [minX, minY, maxX, maxY] })
    }
    return out
  }

  function opening (mask, w, h, radius) {
    const disk = []
    for (let y = -radius; y <= radius; y++) for (let x = -radius; x <= radius; x++) if (x * x + y * y <= radius * radius) disk.push([x, y])
    const eroded = new Uint8Array(mask.length); const out = new Uint8Array(mask.length)
    for (let y = radius; y < h - radius; y++) for (let x = radius; x < w - radius; x++) {
      if (disk.every(([dx, dy]) => mask[(y + dy) * w + x + dx])) eroded[y * w + x] = 1
    }
    for (let y = radius; y < h - radius; y++) for (let x = radius; x < w - radius; x++) {
      if (eroded[y * w + x]) for (const [dx, dy] of disk) out[(y + dy) * w + x + dx] = 1
    }
    return out
  }

  function preprocess (im) {
    const { width: w, height: h, data } = im
    const gray = new Float32Array(w * h); const chroma = new Float32Array(w * h); const maximum = new Uint8Array(w * h)
    const integral = new Float64Array((w + 1) * (h + 1))
    for (let y = 0; y < h; y++) {
      let sum = 0
      for (let x = 0; x < w; x++) {
        const k = y * w + x; const [r, g, b] = data.subarray(4 * k, 4 * k + 3)
        maximum[k] = Math.max(r, g, b); chroma[k] = maximum[k] - Math.min(r, g, b)
        gray[k] = 0.299 * r + 0.587 * g + 0.114 * b
        sum += gray[k]; integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + sum
      }
    }
    const neutral = new Uint8Array(w * h); const grid = new Uint8Array(w * h)
    const dark = new Uint8Array(w * h); const color = new Uint8Array(w * h)
    const radius = Math.max(8, Math.round(Math.max(w, h) / 30))
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = y * w + x; const x0 = Math.max(0, x - radius); const x1 = Math.min(w, x + radius + 1)
      const y0 = Math.max(0, y - radius); const y1 = Math.min(h, y + radius + 1)
      const mean = (integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0))
      neutral[k] = gray[k] < 155 && chroma[k] < 45 ? 1 : 0
      grid[k] = gray[k] > 120 && gray[k] < 242 ? 1 : 0
      dark[k] = gray[k] < 125 && gray[k] < mean - 28 && chroma[k] < 55 ? 1 : 0
      color[k] = maximum[k] < 205 && chroma[k] > 55 && gray[k] < mean - 22 ? 1 : 0
    }
    // Opening removes thin neutral grid/axis lines by stroke width, never by
    // subtracting an entire row or column. Colored ink is kept independently,
    // including pixels where it crosses grid/axes. No gap filling is performed.
    const thick = opening(dark, w, h, 2)
    const ink = Uint8Array.from(thick, (v, i) => v || color[i] ? 1 : 0)
    const rejected = []
    for (const c of components(ink, w, h)) {
      const [x0, y0, x1, y1] = c.bounds
      if (c.pixels.length < 45 || Math.hypot(x1 - x0, y1 - y0) < 18) {
        c.pixels.forEach(p => { ink[p] = 0 }); rejected.push({ bounds: c.bounds, pixels: c.pixels.length })
      }
    }
    return { gray, neutral, grid, dark, color, ink, rejected }
  }

  function projectionLines (mask, w, h, vertical, threshold) {
    const count = vertical ? w : h; const length = vertical ? h : w
    const sums = new Float32Array(count)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) sums[vertical ? x : y]++
    const lines = []
    for (let i = 0; i < count; i++) {
      if (sums[i] < length * threshold) continue
      const first = i; let weighted = 0; let total = 0; let support = 0
      while (i < count && sums[i] >= length * threshold) { weighted += sums[i] * i; total += sums[i]; support = Math.max(support, sums[i] / length); i++ }
      lines.push({ position: weighted / total, width: i - first, support })
    }
    return lines
  }

  function detectGrid (lines) {
    const positions = lines.map(l => l.position)
    const differences = positions.slice(1).map((x, i) => x - positions[i])
    const spacing = median(differences)
    const consistent = spacing > 8 && differences.filter(d => Math.abs(d - spacing) < spacing * 0.12).length >= differences.length * 0.8
    return { status: positions.length >= 5 && consistent ? 'detected' : 'unknown', spacing_pixel: positions.length >= 5 && consistent ? spacing : null, lines_pixel: positions }
  }

  function readDigit (component, mask, w) {
    const [x0, y0, x1, y1] = component.bounds
    const width = x1 - x0 + 1; const height = y1 - y0 + 1
    if (height < 7 || height > 35 || width < 2 || width > 24 || width / height > 1.1) return null
    const scores = Object.entries(digits).map(([value, pattern]) => {
      // Crop the template to its nonempty bounding box, as the image component is.
      const occupied = pattern.flatMap((row, y) => [...row].flatMap((v, x) => v === '1' ? [[x, y]] : []))
      const left = Math.min(...occupied.map(p => p[0])); const right = Math.max(...occupied.map(p => p[0]))
      let mismatch = 0
      for (let y = 0; y < 7; y++) for (let x = left; x <= right; x++) {
        const px = x0 + Math.min(width - 1, Math.floor((x - left + 0.5) * width / (right - left + 1)))
        const py = y0 + Math.min(height - 1, Math.floor((y + 0.5) * height / 7))
        mismatch += Number(mask[py * w + px] !== Number(pattern[y][x]))
      }
      const shapeError = Math.abs(width / height - (right - left + 1) / 7) * 0.2
      return { value: Number(value), error: mismatch / (7 * (right - left + 1)) + shapeError }
    }).sort((a, b) => a.error - b.error)
    if (scores[0].error > 0.16 || scores[1].error - scores[0].error < 0.075) return null
    return { value: scores[0].value, match_error: scores[0].error, bounds: component.bounds }
  }

  function scaleEvidence (axis, origin, spacing, neutral, w, h) {
    if (!origin || !spacing) return { status: 'unknown', source: 'unknown', labels: [] }
    const mask = new Uint8Array(neutral.length); const [ox, oy] = origin
    const near = clamp(spacing * 0.18, 5, 10); const far = clamp(spacing * 0.85, 18, 36)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const inStrip = axis === 'x' ? y > oy + near && y < oy + far && x > ox + spacing * 0.5 : x < ox - near && x > ox - far && y < oy - spacing * 0.5
      if (inStrip) mask[y * w + x] = neutral[y * w + x]
    }
    const labels = []
    const cs = components(mask, w, h)
    for (const c of cs) {
      const d = readDigit(c, mask, w)
      if (!d || d.value === 0) continue
      const [x0, y0, x1, y1] = c.bounds
      const position = axis === 'x' ? (x0 + x1) / 2 : (y0 + y1) / 2
      const delta = axis === 'x' ? position - ox : oy - position
      const tick = Math.round(delta / spacing)
      if (tick < 1 || Math.abs(delta - tick * spacing) > Math.max(3, spacing * 0.13)) continue
      // Multi-digit, signed, and touching glyphs are deliberately unsupported.
      // Reject nearby disconnected glyphs instead of interpreting part of "10".
      if (cs.some(other => other !== c && (axis === 'x'
        ? Math.abs((other.bounds[0] + other.bounds[2]) / 2 - position)
        : Math.abs((other.bounds[1] + other.bounds[3]) / 2 - position)) < 13)) continue
      labels.push({ value: d.value, match_error: d.match_error, bounds_pixel: [[x0, y0], [x1, y1]], anchor_pixel: axis === 'x' ? [ox + tick * spacing, oy] : [ox, oy - tick * spacing], tick })
    }
    labels.sort((a, b) => a.tick - b.tick)
    if (labels.length < 2 || new Set(labels.map(l => l.tick)).size !== labels.length) return { status: 'unknown', source: 'unknown', labels }
    const slopes = []
    for (let i = 1; i < labels.length; i++) slopes.push((labels[i].value - labels[i - 1].value) / (labels[i].tick - labels[i - 1].tick))
    const units = median(slopes); const intercept = median(labels.map(l => l.value - l.tick * units))
    if (!(units > 0) || labels.some(l => Math.abs(l.value - (intercept + l.tick * units)) > 0.01)) return { status: 'unknown', source: 'unknown', labels }
    return { status: 'known', source: 'photo_detected', labels, units_per_grid: units, intersection_value: intercept }
  }

  // Zhang-Suen thinning: topology-preserving deletion of boundary pixels.
  function skeletonize (mask, w, h) {
    const s = mask.slice()
    let changed = true; let iterations = 0
    while (changed && iterations++ < Math.max(w, h)) {
      changed = false
      for (let pass = 0; pass < 2; pass++) {
        const remove = []
        for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
          const k = y * w + x
          if (!s[k]) continue
          const p = [s[k - w], s[k - w + 1], s[k + 1], s[k + w + 1], s[k + w], s[k + w - 1], s[k - 1], s[k - w - 1]]
          const n = p.reduce((a, b) => a + b, 0)
          if (n < 2 || n > 6 || p.reduce((a, b, i) => a + Number(!b && p[(i + 1) % 8]), 0) !== 1) continue
          if (pass === 0 ? p[0] * p[2] * p[4] || p[2] * p[4] * p[6] : p[0] * p[2] * p[6] || p[0] * p[4] * p[6]) continue
          remove.push(k)
        }
        if (remove.length) changed = true
        remove.forEach(k => { s[k] = 0 })
      }
    }
    return s
  }

  function neighbors (s, k, w, h) {
    const x = k % w; const y = Math.floor(k / w); const out = []
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue
      const xx = x + dx; const yy = y + dy; const n = yy * w + xx
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || !s[n]) continue
      // Avoid redundant diagonal edges in a one-pixel staircase.
      if (dx && dy && (s[y * w + xx] || s[yy * w + x])) continue
      out.push(n)
    }
    return out
  }

  function trace (skeleton, w, h) {
    // Remove only terminal skeleton spurs of <= 2.5 pixels. Never bridge gaps.
    const s = skeleton.slice()
    for (let pass = 0; pass < 2; pass++) {
      const remove = new Set()
      for (let k = 0; k < s.length; k++) {
        if (!s[k] || neighbors(s, k, w, h).length !== 1) continue
        const path = [k]; let prev = -1; let current = k; let length = 0
        while (length <= 2.5) {
          const ns = neighbors(s, current, w, h).filter(n => n !== prev)
          if (ns.length !== 1) { if (ns.length > 1) path.slice(0, -1).forEach(p => remove.add(p)); break }
          const n = ns[0]; length += Math.hypot(n % w - current % w, Math.floor(n / w) - Math.floor(current / w))
          prev = current; current = n; path.push(n)
        }
      }
      remove.forEach(k => { s[k] = 0 })
    }
    const paths = []; const junctions = []; const componentList = []
    for (const [ci, component] of components(s, w, h).entries()) {
      const componentId = 'component-' + (ci + 1); const visited = new Set(); const own = []
      const degree = k => neighbors(s, k, w, h).length
      const edge = (a, b) => Math.min(a, b) + ':' + Math.max(a, b)
      const walk = (start, next) => {
        const pixels = [start]; let prev = start; let current = next
        visited.add(edge(start, next))
        while (true) {
          pixels.push(current)
          if (current === start || degree(current) !== 2) break
          const n = neighbors(s, current, w, h).find(n => n !== prev)
          if (visited.has(edge(current, n))) break
          visited.add(edge(current, n)); prev = current; current = n
        }
        if (pixels.length < 2) return
        const path = { id: 'stroke-' + (paths.length + 1), component_id: componentId, pixels, closed: current === start,
          endpoints: [degree(start) === 1, degree(current) === 1] }
        paths.push(path); own.push(path.id)
      }
      for (const k of component.pixels) if (degree(k) !== 2) for (const n of neighbors(s, k, w, h)) if (!visited.has(edge(k, n))) walk(k, n)
      // A component with no degree != 2 node is a closed cycle.
      for (const k of component.pixels) for (const n of neighbors(s, k, w, h)) if (!visited.has(edge(k, n))) walk(k, n)
      if (own.length) componentList.push({ id: componentId, stroke_ids: own })
      for (const k of component.pixels) if (degree(k) > 2) {
        const ids = paths.filter(p => p.component_id === componentId && (p.pixels[0] === k || p.pixels.at(-1) === k)).map(p => p.id)
        if (ids.length > 1) junctions.push({ pixel: [k % w, Math.floor(k / w)], stroke_ids: ids })
      }
    }
    return { paths, junctions, components: componentList, skeleton: s }
  }

  function recognize (image, options = {}) {
    if (!image || ![image.width, image.height].every(n => Number.isInteger(n) && n >= 16 && n <= 20000) ||
        image.width * image.height > 40000000 || !(image.data instanceof Uint8Array || image.data instanceof Uint8ClampedArray) || image.data.length !== image.width * image.height * 4) throw new Error('Expected bounded RGBA image pixels.')
    if (!options || Object.keys(options).some(k => !['inputRevision', 'maxDimension', 'simplificationTolerance', 'calibration'].includes(k))) throw new Error('Unknown recognizer option. Do not pass question/solution configuration.')
    const revision = options.inputRevision ?? 0; const maximum = options.maxDimension ?? 900; const tolerance = options.simplificationTolerance ?? 1.25
    if (!Number.isSafeInteger(revision) || revision < 0 || !Number.isInteger(maximum) || maximum < 128 || maximum > 1200 || !Number.isFinite(tolerance) || tolerance < 0 || tolerance > 3) throw new Error('Invalid recognition limits.')
    if (options.calibration && (Object.keys(options.calibration).some(k => !['unitsPerGridSquare', 'axisIntersectionValue'].includes(k)) ||
        !Array.isArray(options.calibration.unitsPerGridSquare) || options.calibration.unitsPerGridSquare.length !== 2 || !options.calibration.unitsPerGridSquare.every(v => Number.isFinite(v) && v > 0) ||
        !Array.isArray(options.calibration.axisIntersectionValue) || options.calibration.axisIntersectionValue.length !== 2 || !options.calibration.axisIntersectionValue.every(Number.isFinite))) throw new Error('Explicit question calibration requires units and intersection values.')
    const im = resize(image, maximum); const { width: w, height: h, toSource } = im
    const masks = preprocess(im); const warnings = []; const assistance = []; const regions = []
    const warn = (code, message, target) => { warnings.push({ code, message }); assistance.push({ target, reason: code }) }
    // Broad dark backgrounds/bands are not axis lines, even with full support.
    const maxAxisWidth = Math.max(7, Math.round(Math.min(w, h) * 0.02))
    const vertical = projectionLines(masks.neutral, w, h, true, 0.62).filter(l => l.width <= maxAxisWidth)
    const horizontal = projectionLines(masks.neutral, w, h, false, 0.62).filter(l => l.width <= maxAxisWidth)
    const origin = vertical.length === 1 && horizontal.length === 1 ? [vertical[0].position, horizontal[0].position] : null
    if (!origin) warn('ambiguous_axes', 'A unique upright dark axis pair was not detected. Confirm the coordinate frame.', 'axes')
    const gridX = detectGrid(projectionLines(masks.grid, w, h, true, 0.58))
    const gridY = detectGrid(projectionLines(masks.grid, w, h, false, 0.58))
    if (gridX.status !== 'detected' || gridY.status !== 'detected') warn('uncertain_grid', 'Regular graph-paper spacing was not recovered on both axes.', 'grid')
    const scales = { x: scaleEvidence('x', origin, gridX.spacing_pixel, masks.neutral, w, h), y: scaleEvidence('y', origin, gridY.spacing_pixel, masks.neutral, w, h) }
    if (options.calibration && origin) {
      for (const [i, axis] of ['x', 'y'].entries()) if (scales[axis].status !== 'known' && [gridX, gridY][i].status === 'detected') {
        scales[axis] = { ...scales[axis], status: 'known', source: 'question_configuration', units_per_grid: options.calibration.unitsPerGridSquare[i], intersection_value: options.calibration.axisIntersectionValue[i] }
      }
    }
    for (const axis of ['x', 'y']) if (scales[axis].status !== 'known') warn('unknown_' + axis + '_scale', 'No consistent numeric scale evidence was found for the ' + axis + ' axis.', axis + '_scale')
    const frame = {
      status: origin ? 'detected' : 'uncertain', origin_pixel: origin ? toSource(origin) : null,
      axes: {}, grid: {}
    }
    for (const [axis, lines, verticalAxis, grid] of [['x', horizontal, false, gridX], ['y', vertical, true, gridY]]) {
      frame.axes[axis] = { status: lines.length === 1 ? 'detected' : 'uncertain', candidates: lines.map(l => ({
        start: toSource(verticalAxis ? [l.position, 0] : [0, l.position]), end: toSource(verticalAxis ? [l.position, h - 1] : [w - 1, l.position]), support: l.support, width_pixel: l.width / (verticalAxis ? im.sx : im.sy)
      })) }
      frame.grid[axis] = { ...grid, spacing_pixel: grid.spacing_pixel === null ? null : grid.spacing_pixel / (axis === 'x' ? im.sx : im.sy),
        lines_pixel: grid.lines_pixel.map(v => axis === 'x' ? toSource([v, 0])[0] : toSource([0, v])[1]) }
      scales[axis].labels = scales[axis].labels.map(l => ({ ...l, anchor_pixel: toSource(l.anchor_pixel), bounds_pixel: l.bounds_pixel.map(toSource) }))
    }
    const calibrated = !!origin && ['x', 'y'].every(a => scales[a].status === 'known')
    const calibration = {
      status: calibrated ? 'calibrated' : 'uncertain', axes: scales,
      origin_graph: calibrated ? [scales.x.intersection_value, scales.y.intersection_value] : null,
      x_unit_vector_pixel: calibrated ? [frame.grid.x.spacing_pixel / scales.x.units_per_grid, 0] : null,
      y_unit_vector_pixel: calibrated ? [0, -frame.grid.y.spacing_pixel / scales.y.units_per_grid] : null
    }
    const traced = trace(skeletonize(masks.ink, w, h), w, h)
    if (traced.junctions.length) warn('ink_junction', 'Touching or branching ink has multiple possible paths; no branch pairing was guessed.', 'strokes')
    const strokes = traced.paths.map(path => {
      const raw = path.pixels.map(k => [k % w, Math.floor(k / w)])
      const simple = Geometry.simplify(raw, tolerance)
      return { id: path.id, component_id: path.component_id, kind: 'polyline', closed: path.closed,
        simplification_tolerance_pixel: tolerance / Math.min(im.sx, im.sy), vertices: simple.map((p, i) => {
          let corner = false
          if (i > 0 && i < simple.length - 1) {
            const a = simple[i - 1]; const b = simple[i + 1]
            const cosine = ((p[0] - a[0]) * (b[0] - p[0]) + (p[1] - a[1]) * (b[1] - p[1])) / (Math.hypot(p[0] - a[0], p[1] - a[1]) * Math.hypot(b[0] - p[0], b[1] - p[1]))
            corner = cosine < Math.cos(Math.PI / 4)
          }
          const pixel = toSource(p)
          return { pixel, graph: Geometry.pixelToGraph(pixel, frame, calibration), corner,
            endpoint: !path.closed && ((i === 0 && path.endpoints[0]) || (i === simple.length - 1 && path.endpoints[1])) }
        }) }
    })
    const junctions = traced.junctions.map(j => ({ ...j, pixel: toSource(j.pixel) }))
    junctions.forEach(j => regions.push({ pixel: j.pixel, reason: 'ink_junction' }))
    // Thick, long axis-aligned components can be axis ink or overlapping answer
    // ink. Keep their pixels and report ambiguity instead of deleting them.
    for (const s of strokes) {
      const ps = s.vertices.map(v => v.pixel)
      const dx = Math.max(...ps.map(p => p[0])) - Math.min(...ps.map(p => p[0])); const dy = Math.max(...ps.map(p => p[1])) - Math.min(...ps.map(p => p[1]))
      if ((dx > image.width * 0.62 && dy < 6 / im.sy) || (dy > image.height * 0.62 && dx < 6 / im.sx)) {
        warn('axis_ink_overlap', 'A long straight ink component may include an axis. Resolve it before import.', s.id)
        regions.push({ pixel: ps[Math.floor(ps.length / 2)], reason: 'axis_ink_overlap' })
      }
      if (ps.some(p => p[0] < 3 / im.sx || p[1] < 3 / im.sy || p[0] > image.width - 1 - 3 / im.sx || p[1] > image.height - 1 - 3 / im.sy)) warn('clipped_ink', 'Ink reaches the image boundary; its visible extent may be clipped.', s.id)
    }
    if (!strokes.length) warn('no_supported_ink', 'No supported thick-marker stroke was extracted. Thin or pale marks may be missed.', 'strokes')
    const geometry = {
      schema_version: 1, input_revision: revision,
      image: { width: image.width, height: image.height, processing: { width: w, height: h, source_to_processing: [im.sx, 0, 0, im.sy, (im.sx - 1) / 2, (im.sy - 1) / 2] } },
      coordinate_frame: frame, calibration, strokes,
      topology: { stroke_count: strokes.length, component_count: traced.components.length, components: traced.components, junctions },
      status: !strokes.length ? 'abstained' : warnings.length ? 'needs_review' : 'automatic', warnings, assistance,
      uncertainty: { confidence_kind: 'heuristic_not_probability', regions,
        rejected_small_components: masks.rejected.map(c => ({ bounds_pixel: [toSource(c.bounds.slice(0, 2)), toSource(c.bounds.slice(2))], pixels_processing: c.pixels })),
        assumptions: ['Upright, approximately straight-on graph paper.', 'Thick neutral marker or dark saturated marker distinguishable from thin/pale axes and grid.', 'Local OCR accepts only isolated positive single-digit bitmap-like labels; two consistent labels per axis are required.'] }
    }
    Geometry.validate(geometry)
    return { geometry, debug: { width: w, height: h, gray: masks.gray, neutral: masks.neutral, grid: masks.grid, dark: masks.dark, color: masks.color, ink: masks.ink, skeleton: traced.skeleton,
      paths_processing: traced.paths.map(p => ({ id: p.id, component_id: p.component_id, closed: p.closed, pixels: p.pixels.map(k => [k % w, Math.floor(k / w)]) })) } }
  }

  const api = { recognize }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.StarRecognition = api
})(typeof window !== 'undefined' ? window : globalThis)
