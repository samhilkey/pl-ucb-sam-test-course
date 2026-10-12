// STAR: registry of live SketchResponse instances, keyed by the element's
// answers-name. The upstream element keeps `si` as a local variable, so nothing
// outside this function can reach the running canvas. Our photo workflow has to
// add a curve to a canvas that is already on screen, so we publish the handle.
window.SketchInput = window.SketchInput || {};
window.SketchInput.instances = window.SketchInput.instances || {};

const starInstances = window.SketchInput.instances;

window.SketchInput = Object.assign(function (id, overlay_solution = false, hand_drawn = false) {
  function prepareData() {
    // Load SketchResponse
    const si = new window.sketchresponse.default(
      document.getElementById(id + '-si-container'),
      id,
      config,
    );

    // STAR: publish the handle so the hand-drawn workflow can reach this canvas.
    starInstances[id] = si;

    // STAR: the photo route, when the instructor turned it on for this question.
    if (hand_drawn) {
      starAddHandDrawnButton(id, si);
    }

    // Inject overlay toggle button into si-container if it is enabled
    if (overlay_solution) {
      si.messageBus.on('ready', function (_) {
        const container = document.getElementById(id + '-si-container');
        const buttonWrapper = document.createElement('div');
        buttonWrapper.className = 'position-relative';
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
      `;
        container.append(buttonWrapper);

        const overlayButton = document.getElementById(id + '-overlay-toggle');
        overlayButton.addEventListener('click', function () {
          const overlays = document.querySelectorAll(`#${id}-si-container .overlay`);
          if (overlays.length > 0) {
            overlays.forEach((overlay) => {
              overlay.style.display = overlay.style.display === 'none' ? 'inherit' : 'none';
            });
            const icon = overlayButton.querySelector('i');
            if (icon) {
              icon.classList.toggle('bi-layers-half');
              icon.classList.toggle('bi-layers-fill');
            }
          }
        });
      });
    }

    si.messageBus.on('warnUser', function (_, error) {
      console.error(error);
    });
    const updateState = function () {
      const siGradeable = JSON.parse(si.getGradeable());
      const siState = JSON.parse(si.getState());
      // State is needed for restoring submissions, gradeable for grading; merge the two dicts to reduce redundancy
      siState['gradeable'] = siGradeable['data'];
      $('#' + id + '-sketchresponse-submission').val(
        btoa(unescape(encodeURIComponent(JSON.stringify(siState)))),
      );
    };
    // si.getGradeable exits drawing mode, so only call it upon form submission instead of live updates
    const questionForm = document.getElementById(id + '-si-container').closest('form');
    if (questionForm) {
      questionForm.addEventListener('submit', updateState);
    }
  }
  const configData = decodeURIComponent(escape(atob($('#' + id + '-sketchresponse-data').text())));
  const config = JSON.parse(configData);

  prepareData();
}, { instances: starInstances });

// ---------------------------------------------------------------------------
// STAR: hand-drawn submission route.
//
// Step 2 of the build: the button and an empty panel. The panel is where the
// upload, the axis placement, the ink trace, the fit and the corrections will
// go. Nothing in here talks to a model or to the network.
// ---------------------------------------------------------------------------

function starAddHandDrawnButton(id, si) {
  const mount = function () {
    const container = document.getElementById(id + '-si-container');
    if (!container || document.getElementById(id + '-star-photo-btn')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'position-relative';
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
    `;
    container.append(wrapper);

    const panel = document.createElement('div');
    panel.id = id + '-star-panel';
    panel.className = 'star-photo-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="star-photo-panel-inner">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="m-0">Submit a hand-drawn graph</h5>
          <button type="button" class="btn btn-sm btn-light border" id="${id}-star-close">
            Close
          </button>
        </div>
        <div id="${id}-star-ui"></div>
      </div>
    `;
    container.append(panel);

    // The capture UI builds itself into that mount point. It hands back points
    // in graph coordinates; turning those into a curve on the canvas is the
    // next piece of work.
    window.StarPhoto.create({
      root: document.getElementById(id + '-star-ui'),
      onPoints: function (result) {
        console.log('[STAR] traced points for ' + id, result);
      },
    });

    document.getElementById(id + '-star-photo-btn').addEventListener('click', function () {
      panel.hidden = false;
    });
    document.getElementById(id + '-star-close').addEventListener('click', function () {
      panel.hidden = true;
    });
  };

  // Wait for the canvas to finish building before adding to it, the same way
  // the overlay toggle does. Fall back to mounting directly if the bus is
  // missing, so a change upstream cannot silently remove the button.
  if (si && si.messageBus && typeof si.messageBus.on === 'function') {
    si.messageBus.on('ready', mount);
  } else {
    mount();
  }
}
