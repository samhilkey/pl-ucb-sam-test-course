/* Offline semantic-region + measured-CV proof. Not loaded by the student UI. */
;(function (root) {
  'use strict'
  const Geometry = typeof module !== 'undefined' && module.exports ? require('./star-geometry.js') : root.StarGeometry
  const Assisted = typeof module !== 'undefined' && module.exports ? require('./star-cv-assisted.js') : root.StarCVAssisted
  const clone = v => JSON.parse(JSON.stringify(v))
  const box = b => Array.isArray(b) && b.length === 4 && b.every(Number.isFinite) && b[0] >= 0 && b[1] >= 0 && b[2] <= 1000 && b[3] <= 1000 && b[0] < b[2] && b[1] < b[3]
  function validateSemantics (s) {
    const fail = () => { throw new Error('Invalid coarse semantic observation.') }
    const keys = (o, names) => o && !Array.isArray(o) && Object.keys(o).length === names.length && names.every(k => Object.hasOwn(o, k))
    if (!keys(s, ['schema_version', 'coordinate_system', 'branch_count', 'origin', 'axes', 'branches', 'isolated_points', 'non_graph_regions', 'discontinuities', 'unsupported', 'uncertainty']) || !keys(s.axes, ['x', 'y']) || !keys(s.origin, ['region', 'uncertain'])) fail()
    if (!s || s.schema_version !== 1 || s.coordinate_system !== 'normalized_0_1000' || !s.axes || !s.origin ||
      !(s.origin.region === null || box(s.origin.region)) || typeof s.origin.uncertain !== 'boolean' ||
      !(s.branch_count === null || Number.isInteger(s.branch_count) && s.branch_count >= 0 && s.branch_count <= 20) || !Array.isArray(s.branches) || s.branches.length > 20 || s.branch_count !== null && s.branches.length !== s.branch_count ||
      !Array.isArray(s.isolated_points) || !Array.isArray(s.non_graph_regions) || !Array.isArray(s.discontinuities) ||
      !Array.isArray(s.unsupported) || !Array.isArray(s.uncertainty) || [...s.unsupported, ...s.uncertainty].some(v => typeof v !== 'string')) fail()
    const ids = new Set()
    for (const a of ['x', 'y']) {
      const v = s.axes[a]
      if (!keys(v, ['region', 'positive_direction', 'intersection_value', 'uncertain', 'ticks'])) fail()
      if (!v || !(v.region === null || box(v.region)) || ![null, 'right', 'left', 'up', 'down'].includes(v.positive_direction) ||
        !(v.intersection_value === null || Number.isFinite(v.intersection_value)) || typeof v.uncertain !== 'boolean' || !Array.isArray(v.ticks)) fail()
      for (const t of v.ticks) if (!keys(t, ['region', 'value', 'uncertain']) || !box(t.region) || !(t.value === null || Number.isFinite(t.value)) || typeof t.uncertain !== 'boolean') fail()
    }
    for (const b of s.branches) {
      if (!keys(b, ['id', 'region', 'endpoint_regions', 'corner_regions', 'extremum_regions', 'uncertain'])) fail()
      if (!b || typeof b.id !== 'string' || !b.id || ids.has(b.id) || !box(b.region) || typeof b.uncertain !== 'boolean' ||
        !Array.isArray(b.endpoint_regions) || b.endpoint_regions.length !== 2 || b.endpoint_regions.some(r => r !== null && !box(r)) ||
        !Array.isArray(b.corner_regions) || !b.corner_regions.every(box) || !Array.isArray(b.extremum_regions) || !b.extremum_regions.every(box)) fail()
      ids.add(b.id)
    }
    for (const p of s.isolated_points) if (!keys(p, ['id', 'region', 'filled', 'uncertain']) || typeof p.id !== 'string' || !p.id || ids.has(p.id) || !box(p.region) || ![true, false, null].includes(p.filled) || typeof p.uncertain !== 'boolean') fail(); else ids.add(p.id)
    for (const r of s.non_graph_regions) if (!keys(r, ['kind', 'region']) || !['axis', 'label', 'grid', 'noise'].includes(r.kind) || !box(r.region)) fail()
    for (const d of s.discontinuities) if (!keys(d, ['region', 'branch_ids']) || !box(d.region) || !Array.isArray(d.branch_ids) || d.branch_ids.length < 2 || d.branch_ids.some(id => !s.branches.some(b => b.id === id))) fail()
    return s
  }
  function inspect (source, envelope) {
    Geometry.validate(source)
    if (source.provenance || source.points?.length) throw new Error('Use the original measured CV observation.')
    if (!envelope || envelope.kind !== 'development_fixture' || envelope.model !== null || !/^[a-f0-9]{64}$/.test(envelope.photo_sha256 || '') ||
      envelope.width !== source.image.width || envelope.height !== source.image.height) throw new Error('Only a matching, labeled offline semantic fixture is enabled. No Gemini transport is implemented.')
    const s = validateSemantics(envelope.semantics); const w = source.image.width; const h = source.image.height
    const inBox = (p, r) => r && p[0] * 1000 / w >= r[0] && p[0] * 1000 / w <= r[2] && p[1] * 1000 / h >= r[1] && p[1] * 1000 / h <= r[3]
    const blockers = []; const decisions = {}; const markDecisions = {}; const assigned = {}; const measuredPoints = []
    const block = (code, detail) => blockers.push({ code, detail })
    if (s.branch_count === null || s.uncertainty.length || s.unsupported.length || s.origin.uncertain || Object.values(s.axes).some(a => a.uncertain) || s.branches.some(b => b.uncertain)) block('semantic_uncertainty', 'Resolve the reported semantic uncertainty; it is not silently discarded.')
    for (const stroke of source.strokes) {
      const hits = s.branches.filter(b => stroke.vertices.every(v => inBox(v.pixel, b.region)))
      const excluded = s.non_graph_regions.some(r => stroke.vertices.every(v => inBox(v.pixel, r.region)))
      if (hits.length === 1 && !excluded) { decisions[stroke.id] = 'keep'; assigned[stroke.id] = hits[0].id } else if (!hits.length && excluded) decisions[stroke.id] = 'exclude'
      else block('ambiguous_stroke', stroke.id + ': no unique complete graph/non-graph region; no clipping, guessing or axis subtraction.')
    }
    const marks = Assisted.marks(source)
    for (const m of marks) {
      const hits = s.isolated_points.filter(p => inBox(m.bounds_pixel[0], p.region) && inBox(m.bounds_pixel[1], p.region))
      const excluded = s.non_graph_regions.some(r => inBox(m.pixel, r.region))
      const component = source.uncertainty.rejected_small_components[Number(m.id.split('-')[1]) - 1]
      if (hits.length && excluded) block('ambiguous_small_mark', m.id + ': point and non-graph regions overlap; keep the measured candidate but block import.')
      const dx = (m.bounds_pixel[1][0] - m.bounds_pixel[0][0]) * source.image.processing.width / w + 1
      const dy = (m.bounds_pixel[1][1] - m.bounds_pixel[0][1]) * source.image.processing.height / h + 1
      if (hits.length === 1 && hits[0].filled === true && !hits[0].uncertain && dx / dy >= 0.5 && dx / dy <= 2 && component.pixels_processing / (dx * dy) >= 0.35) {
        markDecisions[m.id] = 'point'; measuredPoints.push({ semantic_id: hits[0].id, component_id: m.id, pixel: m.pixel })
      } else if (!hits.length && excluded) markDecisions[m.id] = 'exclude'
      else block('ambiguous_small_mark', m.id + ': filled-dot evidence/classification is unresolved.')
    }
    for (const p of s.isolated_points) if (measuredPoints.filter(m => m.semantic_id === p.id).length !== 1) block('point_count', p.id + ': expected exactly one measured filled component.')
    let paths = []
    if (Object.keys(decisions).length === source.strokes.length) {
      try { paths = Assisted.branches(source, decisions) } catch (e) { block('unresolved_connectivity', e.message) }
    }
    if (paths.length !== s.branch_count) block('branch_count', 'Measured connected branches do not match the semantic observation.')
    const mapping = paths.map(p => [...new Set(p.source_stroke_ids.map(id => assigned[id]))])
    if (mapping.some(ids => ids.length !== 1) || new Set(mapping.flat()).size !== s.branch_count) block('branch_identity', 'Branches cannot be paired uniquely without inventing connectivity.')
    for (const b of s.branches) {
      const p = paths.find(p => p.source_stroke_ids.every(id => assigned[id] === b.id))
      if (!p) continue
      const ends = [p.vertices[0].pixel, p.vertices.at(-1).pixel]
      if (b.endpoint_regions.some(r => r === null) || !([0, 1].every(i => inBox(ends[i], b.endpoint_regions[i])) || [0, 1].every(i => inBox(ends[1 - i], b.endpoint_regions[i])))) block('endpoint_grounding', b.id + ': measured endpoints disagree with coarse regions.')
      for (const r of b.corner_regions) if (!p.vertices.some(v => v.corner && inBox(v.pixel, r))) block('corner_grounding', b.id + ': no measured corner in the stated region.')
      for (const r of b.extremum_regions) if (!p.vertices.some((v, i, vs) => i > 0 && i < vs.length - 1 && inBox(v.pixel, r) && (v.pixel[1] - vs[i - 1].pixel[1]) * (vs[i + 1].pixel[1] - v.pixel[1]) <= 0)) block('extremum_grounding', b.id + ': no measured extremum in the stated region.')
    }
    const c = source.calibration
    const knownWarnings = ['ambiguous_axes', 'uncertain_grid', 'unknown_x_scale', 'unknown_y_scale', 'ink_junction', 'axis_ink_overlap', 'clipped_ink', 'no_supported_ink', 'unclassified_small_marks']
    if (source.warnings.some(w => !knownWarnings.includes(w.code)) || source.uncertainty.regions.some(r => !['ink_junction', 'axis_ink_overlap'].includes(r.reason))) block('unsupported_cv_uncertainty', 'An unsupported CV warning remains unresolved.')
    if (c.status !== 'calibrated' || ['x', 'y'].some(a => c.axes[a].source !== 'photo_detected')) block('calibration_missing', 'Numeric image evidence is insufficient. A future canvas correction must establish the unresolved axes/values; question answers cannot supply them.')
    else {
      if (c.origin_graph.some(v => v !== 0)) block('unsupported_nonzero_intersection', 'This bounded proof does not yet support nonzero axis-intersection values; no transform is silently changed.')
      if (!inBox(source.coordinate_frame.origin_pixel, s.origin.region)) block('origin_grounding', 'Measured origin disagrees with its coarse region.')
      for (const a of ['x', 'y']) {
        const axis = s.axes[a]
        if (!axis.region || axis.intersection_value !== c.axes[a].intersection_value || axis.ticks.length < 2 || axis.ticks.some(t => t.value === null || t.uncertain)) block('tick_grounding', a + ': incomplete semantic scale observation.')
        if (!inBox(source.coordinate_frame.origin_pixel, axis.region) || c.axes[a].labels.some(l => !inBox(l.anchor_pixel, axis.region))) block('axis_grounding', a + ': semantic axis region disagrees with measured origin/tick anchors.')
        for (const label of c.axes[a].labels) {
          const center = label.bounds_pixel[0].map((v, i) => (v + label.bounds_pixel[1][i]) / 2)
          if (!axis.ticks.some(t => t.value === label.value && inBox(center, t.region))) block('tick_grounding', a + ': CV-read numeric label disagrees with semantic label regions/values.')
        }
        const v = a === 'x' ? c.x_unit_vector_pixel : c.y_unit_vector_pixel
        const direction = Math.abs(v[0]) > Math.abs(v[1]) ? v[0] > 0 ? 'right' : 'left' : v[1] > 0 ? 'down' : 'up'
        if (axis.positive_direction !== direction) block('direction_grounding', a + ': positive axis direction disagrees with pixels.')
      }
    }
    return { source_kind: 'development_fixture', automatically_recognized: false, importable_after_explicit_review: blockers.length === 0, blockers, strokeDecisions: decisions, markDecisions, measured_points: measuredPoints, measured_branch_count: paths.length, inserted_vertices: 0, pixel_source: 'unchanged_local_CV_centerlines' }
  }
  function reviewed (source, envelope, review, inputRevision = source.input_revision) {
    if (inputRevision !== source.input_revision) throw new Error('Cannot relabel stale CV pixels as a new photo revision.')
    const result = inspect(source, envelope)
    if (!result.importable_after_explicit_review) throw new Error('Hybrid proof blocked: ' + result.blockers.map(b => b.code).join(', '))
    if (review?.confirmed !== true || Object.keys(review).length !== 1) throw new Error('Compare the measured draft and explicitly confirm before native import.')
    const c = source.calibration; const o = source.coordinate_frame.origin_pixel
    if (c.origin_graph.some(v => v !== 0)) throw new Error('This small proof does not yet handle nonzero axis-intersection values.')
    const geometry = Assisted.fromSelection({ source, photoSha256: envelope.photo_sha256, strokeDecisions: result.strokeDecisions, markDecisions: result.markDecisions, reviewBasis: 'explicit_decisions', inputRevision,
      axisValues: { origin: o, xMarker: o.map((v, i) => v + c.x_unit_vector_pixel[i]), yMarker: o.map((v, i) => v + c.y_unit_vector_pixel[i]), xValue: 1, yValue: 1 } })
    geometry.provenance = { method: 'hybrid_development', automatically_recognized: false, semantic_source_kind: 'development_fixture', photo_sha256: envelope.photo_sha256,
      calibration_basis: 'existing_CV_numeric_image_evidence_explicitly_confirmed', source_geometry: clone(source), semantic_envelope: clone(envelope), review: clone(review) }
    geometry.uncertainty.assumptions = ['OFFLINE DEVELOPMENT PROOF: human-authored coarse semantic regions, not Gemini recognition.', 'Vertices/dots are measured CV pixels; no fitting, clipping, snapping or inferred joins.', 'Existing CV numeric calibration was explicitly confirmed; compatibility axis fields are student-confirmed.']
    return Geometry.validate(geometry)
  }
  function validate (geometry) {
    const p = geometry.provenance
    if (p?.method !== 'hybrid_development' || p.automatically_recognized !== false || p.semantic_source_kind !== 'development_fixture') throw new Error('A labeled, reviewed offline hybrid provenance is required.')
    const expected = reviewed(p.source_geometry, p.semantic_envelope, p.review, geometry.input_revision)
    if (JSON.stringify(geometry) !== JSON.stringify(expected)) throw new Error('Hybrid measured geometry changed after review.')
    return geometry
  }
  const api = { validateSemantics, inspect, reviewed, validate }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.StarHybrid = api
})(typeof window !== 'undefined' ? window : globalThis)
