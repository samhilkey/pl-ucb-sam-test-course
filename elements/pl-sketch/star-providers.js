/* Pixel-only provider boundary. No network transport or credentials live here. */
;(function (root) {
  'use strict'
  const Geometry = typeof module !== 'undefined' && module.exports ? require('./star-geometry.js') : root.StarGeometry
  const CV = typeof module !== 'undefined' && module.exports ? require('./star-recognition.js') : root.StarRecognition
  const methods = { cv: 'CV automatic', gemini: 'VLM automatic', hybrid: 'hybrid automatic' }

  // Future server responses enter through this same validation boundary. The
  // provider cannot supply the receiving question's config, answer or traces.
  function candidate (value, { provider, inputRevision, width, height }) {
    if (!Object.hasOwn(methods, provider)) throw new Error('Unknown recognition provider.')
    const geometry = Geometry.validate(JSON.parse(JSON.stringify(value)))
    if (geometry.input_revision !== inputRevision || geometry.image.width !== width || geometry.image.height !== height) throw new Error('Stale or mismatched photo geometry.')
    const smallComponents = geometry.uncertainty.rejected_small_components === undefined ? [] : geometry.uncertainty.rejected_small_components
    if (!Array.isArray(smallComponents)) throw new Error('Invalid small-component diagnostics.')
    const origin = geometry.coordinate_frame.origin_pixel
    const marks = smallComponents.map(c => {
      const b = c && c.bounds_pixel
      if (!Array.isArray(b) || b.length !== 2 || b.some(p => !Array.isArray(p) || p.length !== 2 || p.some(v => !Number.isFinite(v))) ||
          b[0][0] < 0 || b[0][1] < 0 || b[1][0] >= width || b[1][1] >= height || b[1][0] < b[0][0] || b[1][1] < b[0][1]) throw new Error('Invalid small-component diagnostic.')
      // A residual covering the detected axis intersection is displayed too.
      // It is not claimed as a separately recognized mathematical point.
      return { bounds_pixel: b, at_axis_intersection: !!origin && origin.every((v, i) => v >= b[0][i] && v <= b[1][i]) }
    })
    if (marks.some(m => !m.at_axis_intersection)) {
      geometry.warnings.push({ code: 'unclassified_small_marks', message: 'Small ink components remain unclassified. They may be dots, labels or fragments; they cannot be imported automatically. Continue with detected strokes to review these marks, or use manual tracing and the native point tool.' })
      geometry.assistance.push({ target: 'marks', reason: 'unclassified_small_marks' })
      if (geometry.status === 'automatic') geometry.status = 'needs_review'
    }
    Geometry.validate(geometry)
    return { geometry, method: methods[provider], marks }
  }

  function recognize (image, options = {}) {
    if (Object.keys(options).some(k => !['provider', 'inputRevision'].includes(k))) throw new Error('Only a provider and photo revision may enter recognition.')
    const provider = options.provider || 'cv'; const inputRevision = options.inputRevision ?? 0
    if (provider !== 'cv') throw new Error('This provider is not enabled. A separately approved server-side experiment is required.')
    const result = CV.recognize(image, { inputRevision })
    return { ...candidate(result.geometry, { provider, inputRevision, width: image.width, height: image.height }), debug: result.debug }
  }
  const api = { recognize, candidate }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.StarProviders = api
})(typeof window !== 'undefined' ? window : globalThis)
