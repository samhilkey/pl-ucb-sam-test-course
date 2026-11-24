/* global $ */
// STAR: registry of live SketchResponse instances, keyed by the element's
// answers-name. The upstream element keeps `si` as a local variable, so nothing
// outside this function can reach the running canvas. Our photo workflow has to
// add a curve to a canvas that is already on screen, so we publish the handle.
window.SketchInput = window.SketchInput || {}
window.SketchInput.instances = window.SketchInput.instances || {}

const starInstances = window.SketchInput.instances

window.SketchInput = Object.assign(function (id, overlaySolution = false, handDrawn = false) {
  function prepareData () {
    // Load SketchResponse
    const SketchResponse = window.sketchresponse.default
    const si = new SketchResponse(
      document.getElementById(id + '-si-container'),
      id,
      config
    )

    // STAR: publish the handle so the hand-drawn workflow can reach this canvas.
    starInstances[id] = si
    if (config.pointCalibration) {
      si.messageBus.on('ready', () => starDrawCalibrationPoints(id, config))
    }

    // STAR: the photo route, when the instructor turned it on for this question.
    if (handDrawn) {
      starAddHandDrawnButton(id, si, config)
    }

    // Inject overlay toggle button into si-container if it is enabled
    if (overlaySolution) {
      si.messageBus.on('ready', function (_) {
        const container = document.getElementById(id + '-si-container')
        const buttonWrapper = document.createElement('div')
        buttonWrapper.className = 'position-relative'
        buttonWrapper.innerHTML = `
        <button
            type="button"
            class="js-overlay-toggle btn btn-light border border-dark position-absolute translate-middle bottom-0 end-0 m-3"
            id="${id}-overlay-toggle"
            title="Toggle solution display"
            data-bs-toggle="tooltip"
            data-bs-placement="top"
            aria-label="Toggle solution display"
        >
            <i class="bi bi-layers-fill" aria-hidden="true"></i>
        </button>
      `
        container.append(buttonWrapper)

        const overlayButton = document.getElementById(id + '-overlay-toggle')
        overlayButton.addEventListener('click', function () {
          const overlays = document.querySelectorAll(`#${id}-si-container .overlay`)
          if (overlays.length > 0) {
            overlays.forEach((overlay) => {
              overlay.style.display = overlay.style.display === 'none' ? 'inherit' : 'none'
            })
            const icon = overlayButton.querySelector('i')
            if (icon) {
              icon.classList.toggle('bi-layers-half')
              icon.classList.toggle('bi-layers-fill')
            }
          }
        })
      })
    }

    si.messageBus.on('warnUser', function (_, error) {
      console.error(error)
    })
    const updateState = function () {
      const siGradeable = JSON.parse(si.getGradeable())
      const siState = JSON.parse(si.getState())
      if (config.calibrationPoints?.length) siState.calibrationPoints = config.calibrationPoints
      // State is needed for restoring submissions, gradeable for grading; merge the two dicts to reduce redundancy
      siState.gradeable = siGradeable.data
      $('#' + id + '-sketchresponse-submission').val(
        btoa(unescape(encodeURIComponent(JSON.stringify(siState))))
      )
    }
    // si.getGradeable exits drawing mode, so only call it upon form submission instead of live updates
    const questionForm = document.getElementById(id + '-si-container').closest('form')
    if (questionForm) {
      questionForm.addEventListener('submit', updateState)
    }
  }
  const configData = decodeURIComponent(escape(atob($('#' + id + '-sketchresponse-data').text())))
  const config = JSON.parse(configData)

  prepareData()
}, { instances: starInstances })

function starDrawCalibrationPoints (id, config) {
  const container = document.getElementById(id + '-si-container')
  const canvas = container.querySelector('svg.si-canvas')
  if (!canvas) return
  canvas.querySelector('.star-calibration-markers')?.remove()
  document.getElementById(id + '-calibration-key')?.remove()
  const points = config.calibrationPoints || []
  if (!points.length) return
  const make = name => document.createElementNS('http://www.w3.org/2000/svg', name)
  const layer = make('g')
  layer.setAttribute('class', 'star-calibration-markers')
  layer.setAttribute('pointer-events', 'none')
  const pixels = window.StarFit.graphToPixels(config, points.map(ref => ref.known))
  const key = document.createElement('details')
  key.id = id + '-calibration-key'
  const summary = document.createElement('summary')
  summary.textContent = 'Calibration points (' + points.length + ')'
  const list = document.createElement('ol')
  key.append(summary, list)
  points.forEach(({ known, onCurve }, i) => {
    const group = make('g')
    const description = '(' + known.join(', ') + '), ' + (onCurve ? 'on curve' : 'calibration reference')
    const item = document.createElement('li')
    item.textContent = description
    list.append(item)
    group.setAttribute('transform', 'translate(' + pixels[i].x + ' ' + pixels[i].y + ')')
    group.setAttribute('role', 'img')
    group.setAttribute('aria-label', 'Point ' + (i + 1) + ' ' + description)
    const circle = make('circle')
    circle.setAttribute('r', '4')
    circle.setAttribute('fill', onCurve ? '#175a91' : 'none')
    circle.setAttribute('stroke', '#175a91')
    circle.setAttribute('stroke-width', '2')
    const label = make('text')
    label.setAttribute('x', '6')
    label.setAttribute('y', '-5')
    label.setAttribute('fill', '#175a91')
    label.setAttribute('stroke', 'white')
    label.setAttribute('stroke-width', '3')
    label.setAttribute('paint-order', 'stroke')
    label.textContent = String(i + 1)
    group.append(circle, label)
    layer.append(group)
  })
  canvas.append(layer)
  container.after(key)
}

// ---------------------------------------------------------------------------
// STAR: hand-drawn submission route.
//
// Step 2 of the build: the button and an empty panel. The panel is where the
// upload, the axis placement, the ink trace, the fit and the corrections will
// go. Nothing in here talks to a model or to the network.
// ---------------------------------------------------------------------------

// `config` has to be passed in: it is a local inside window.SketchInput and is
// not visible from out here.
function starAddHandDrawnButton (id, si, config) {
  const mount = function () {
    const container = document.getElementById(id + '-si-container')
    if (!container || document.getElementById(id + '-star-photo-btn')) return

    const wrapper = document.createElement('div')
    wrapper.className = 'position-relative'
    wrapper.innerHTML = `
      <button
        type="button"
        class="btn btn-light border border-dark position-absolute translate-middle bottom-0 start-0 m-3"
        id="${id}-star-photo-btn"
        title="Submit a photo of a hand-drawn graph"
        aria-label="Submit a photo of a hand-drawn graph"
      >
        <i class="bi bi-camera-fill" aria-hidden="true"></i>
      </button>
    `
    container.append(wrapper)

    const panel = document.createElement('dialog')
    panel.id = id + '-star-panel'
    panel.className = 'star-photo-panel'
    panel.hidden = true
    panel.setAttribute('aria-labelledby', id + '-star-title')
    panel.innerHTML = `
      <div class="star-photo-panel-inner">
        <div class="star-panel-header">
          <h5 id="${id}-star-title">Use your paper graph</h5>
          <button type="button" class="btn btn-sm btn-light border" id="${id}-star-close">
            Close
          </button>
        </div>
        <div id="${id}-star-ui"></div>
      </div>
    `
    container.append(panel)
    let photoUI
    const photoButton = document.getElementById(id + '-star-photo-btn')
    const closePanel = function () {
      if (panel.open) panel.close()
      panel.hidden = true
      photoButton.focus({ preventScroll: true })
    }

    // Open/close first. If building the capture UI below fails, the button
    // still works and the panel still opens — showing an error the student can
    // report, rather than a button that silently does nothing.
    photoButton.addEventListener('click', function () {
      panel.hidden = false
      if (!panel.open) panel.showModal()
      if (photoUI) photoUI.resizeView()
    })
    document.getElementById(id + '-star-close').addEventListener('click', function () {
      closePanel()
    })
    panel.addEventListener('cancel', function (event) {
      event.preventDefault()
      closePanel()
    })
    // Editing photo coordinates must not submit the surrounding question form
    // or send drawing shortcuts to the native canvas behind this dialog.
    panel.addEventListener('keydown', function (event) {
      event.stopPropagation()
      if (event.key === 'Enter' && event.target.matches('input[type="number"]')) event.preventDefault()
    })
    panel.addEventListener('keyup', function (event) {
      event.stopPropagation()
    })

    // The capture UI builds itself into that mount point. On confirm it hands
    // back every fitted branch, which we sample and place on this canvas.
    try {
      photoUI = window.StarPhoto.create({
        root: document.getElementById(id + '-star-ui'),
        config,
        onConfirm: function (models, points = []) {
          const toolId = window.StarFit.curveToolId(config)
          if (!toolId) {
            return { ok: false, message: 'This question has no editable curve tool to draw into.' }
          }
          // Fewer control points than we sample for display: the student has to
          // be able to drag these, and a spline interpolates between them.
          try {
            // New photo tool: models carry ready-made spline points. Old fitted models carry f/lo/hi.
            const curves = models.map((model) => model.points || window.StarFit.sampleCurve(model, 16))
            window.StarFit.placeCurves(si, config, toolId, curves)
            if (config.pointCalibration) {
              config.calibrationPoints = points.map(({ known, onCurve }) => ({ known, onCurve }))
              starDrawCalibrationPoints(id, config)
            }
          } catch (err) {
            return { ok: false, message: 'Could not place the curve: ' + err.message }
          }
          closePanel()
          return { ok: true, message: models.length === 1 ? 'Curve placed on the canvas.' : 'All branches placed on the canvas.' }
        }
      })
    } catch (err) {
      console.error('[STAR] could not build the capture UI', err)
      document.getElementById(id + '-star-ui').innerHTML =
        '<p class="text-danger">The photo tool failed to load: ' + err.message + '</p>'
    }
  }

  // Wait for the canvas to finish building before adding to it, the same way
  // the overlay toggle does. Fall back to mounting directly if the bus is
  // missing, so a change upstream cannot silently remove the button.
  if (si && si.messageBus && typeof si.messageBus.on === 'function') {
    si.messageBus.on('ready', mount)
  } else {
    mount()
  }
}
