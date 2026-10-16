/* ---------------------------------------------------------------------------
 * STAR: hand-drawn graph capture for pl-sketch.
 *
 * Ported from the Sketch to Graph prototype. This file covers the guided
 * markup path only: upload a photo, place the axes by dragging three handles,
 * trace roughly along the curve, and snap that trace onto the actual ink.
 * The result is a list of points in GRAPH coordinates.
 *
 * Everything here runs in the browser with no network and no model calls,
 * which is what lets it work inside a locked-down exam.
 *
 * Each canvas on a page gets its own instance, so nothing is shared in module
 * scope — the upstream prototype used page-wide globals and would collide if
 * a question had two sketch canvases.
 * ------------------------------------------------------------------------- */

window.StarPhoto = (function () {
  'use strict';

  function create(options) {
    const root = options.root; // container element for the UI
    const onConfirm = options.onConfirm || function () { return { ok: false, message: '' }; };

    // ---- per-instance state (was module-global in the prototype) ----
    let photoBmp = null;
    let MW = 0;
    let MH = 0;
    let maskCache = null;
    let markup = null;
    let mode = 'axes';
    let drag = null;
    let refined = null;
    let lastHandle = 'X';
    let tracedPoints = null;
    let currentModel = null;
    let photoLoading = false;
    let photoRequest = 0;

    root.innerHTML = `
      <div class="star-photo-ui">
        <div class="star-row">
          <label class="btn btn-sm btn-primary star-file-btn">
            Take or choose photo
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden>
          </label>
          <button type="button" class="btn btn-sm btn-light border star-mode-axes star-on">1 &middot; Place the axes</button>
          <button type="button" class="btn btn-sm btn-light border star-mode-curve">2 &middot; Trace the curve</button>
          <button type="button" class="btn btn-sm btn-light border star-undo">Undo stroke</button>
          <button type="button" class="btn btn-sm btn-light border star-clear">Clear trace</button>
        </div>

        <p class="star-hint text-muted"></p>

        <div class="star-canvas-wrap"><canvas class="star-canvas"></canvas></div>

        <div class="star-row star-scale">
          <label>x-dot sits at x = <input type="number" step="any" value="1" class="star-xval"></label>
          <label>y-dot sits at y = <input type="number" step="any" value="1" class="star-yval"></label>
          <label><input type="checkbox" class="star-equal"> Same scale on both axes</label>
          <label><input type="checkbox" class="star-units" checked> Show unit grid</label>
          <label>Search width <input type="range" min="6" max="48" value="16" class="star-brush"></label>
        </div>

        <p class="star-scale-read text-muted"></p>

        <div class="star-row">
          <button type="button" class="btn btn-sm btn-success star-use" disabled>Read my trace</button>
          <span class="star-status text-muted"></span>
        </div>

        <div class="star-fit-box" hidden>
          <p class="star-fit-eq"></p>
          <p class="star-fit-meta text-muted"></p>
          <div class="star-row">
            <label>
              Curve type
              <select class="star-family">
                <option value="">Let it choose</option>
                <option value="polynomial">Polynomial</option>
                <option value="sine">Sine wave</option>
                <option value="exponential">Exponential</option>
                <option value="sqrt">Square root</option>
                <option value="logarithmic">Logarithm</option>
                <option value="abs">Absolute value</option>
                <option value="rational">Rational (1/x type)</option>
                <option value="tan">Tangent</option>
              </select>
            </label>
            <label class="star-degree-wrap" hidden>
              Degree <input type="number" class="star-degree" min="1" max="6" step="1" value="3">
            </label>
            <button type="button" class="btn btn-sm btn-light border star-refit">Refit</button>
            <button type="button" class="btn btn-sm btn-success star-confirm" disabled>This matches my sketch</button>
          </div>
        </div>

        <pre class="star-result" hidden></pre>
      </div>
    `;

    const q = (sel) => root.querySelector(sel);
    const canvas = q('.star-canvas');
    const statusEl = q('.star-status');

    const setStatus = (text) => {
      statusEl.textContent = text || '';
    };

    function clearFit() {
      currentModel = null;
      q('.star-confirm').disabled = true;
      q('.star-fit-eq').textContent = '';
      q('.star-fit-meta').textContent = '';
      q('.star-result').textContent = '';
      q('.star-result').hidden = true;
    }

    // A fit belongs to the photo, calibration and trace it was calculated from.
    // Keep extracted points only when changing fit settings, not those inputs.
    function invalidateTrace() {
      tracedPoints = null;
      refined = null;
      clearFit();
      q('.star-fit-box').hidden = true;
      setStatus('Read your trace again to update the preview.');
    }

    // ---- photo loading -----------------------------------------------------
    async function showPhoto(blob, request) {
      let bitmap;
      try {
        bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      } catch (e) {
        bitmap = await createImageBitmap(blob);
      }
      // A slower, superseded upload must not replace the latest chosen photo.
      if (request !== photoRequest) {
        bitmap.close();
        return;
      }
      if (photoBmp) photoBmp.close();
      photoBmp = bitmap;
      const sc = Math.min(1, 900 / Math.max(photoBmp.width, photoBmp.height));
      MW = Math.round(photoBmp.width * sc);
      MH = Math.round(photoBmp.height * sc);
      maskCache = null;
      refined = null;
      markup = {
        O: [MW * 0.5, MH * 0.55],
        X: [MW * 0.75, MH * 0.55],
        Y: [MW * 0.5, MH * 0.3],
        strokes: [],
      };
      setMode('axes');
      q('.star-use').disabled = false;
      drawPhoto();
    }

    function setMode(m) {
      mode = m;
      q('.star-mode-axes').classList.toggle('star-on', m === 'axes');
      q('.star-mode-curve').classList.toggle('star-on', m === 'curve');
      q('.star-hint').textContent =
        m === 'axes'
          ? 'Drag the three dots: O onto your origin, then x and y onto the points where they equal the numbers below. The blue grid shows the scale that implies — drag until it lines up with the paper.'
          : 'Drag roughly along your curve. Several strokes are fine, one per branch. The tracer snaps to the ink near your line.';
    }

    // ---- drawing the photo, handles and unit grid --------------------------
    function drawPhoto() {
      if (!photoBmp) return;
      if (canvas.width !== MW) {
        canvas.width = MW;
        canvas.height = MH;
      }
      const x = canvas.getContext('2d');
      x.clearRect(0, 0, MW, MH);
      x.drawImage(photoBmp, 0, 0, MW, MH);
      if (!markup) return;

      const O = markup.O;
      const X = markup.X;
      const Y = markup.Y;

      const ray = (A, B) => {
        const dx = B[0] - A[0];
        const dy = B[1] - A[1];
        const L = Math.hypot(dx, dy) || 1;
        const k = (4 * Math.max(MW, MH)) / L;
        x.beginPath();
        x.moveTo(A[0] - dx * k, A[1] - dy * k);
        x.lineTo(A[0] + dx * k, A[1] + dy * k);
        x.stroke();
      };

      const xv = +q('.star-xval').value || 1;
      const yv = +q('.star-yval').value || 1;
      const uxv = [(X[0] - O[0]) / xv, (X[1] - O[1]) / xv];
      const uyv = [(Y[0] - O[0]) / yv, (Y[1] - O[1]) / yv];
      const lux = Math.hypot(uxv[0], uxv[1]);
      const luy = Math.hypot(uyv[0], uyv[1]);

      if (q('.star-units').checked && lux > 3 && luy > 3) {
        const diag = Math.hypot(MW, MH);
        const nx = Math.min(60, Math.ceil(diag / lux));
        const ny = Math.min(60, Math.ceil(diag / luy));
        x.lineWidth = 1;
        for (let k = -nx; k <= nx; k++) {
          if (!k) continue;
          const b0 = [O[0] + uxv[0] * k, O[1] + uxv[1] * k];
          x.strokeStyle = k % 5 ? 'rgba(30,100,215,.18)' : 'rgba(30,100,215,.38)';
          x.beginPath();
          x.moveTo(b0[0] - (uyv[0] / luy) * diag, b0[1] - (uyv[1] / luy) * diag);
          x.lineTo(b0[0] + (uyv[0] / luy) * diag, b0[1] + (uyv[1] / luy) * diag);
          x.stroke();
        }
        for (let k = -ny; k <= ny; k++) {
          if (!k) continue;
          const b0 = [O[0] + uyv[0] * k, O[1] + uyv[1] * k];
          x.strokeStyle = k % 5 ? 'rgba(30,100,215,.18)' : 'rgba(30,100,215,.38)';
          x.beginPath();
          x.moveTo(b0[0] - (uxv[0] / lux) * diag, b0[1] - (uxv[1] / lux) * diag);
          x.lineTo(b0[0] + (uxv[0] / lux) * diag, b0[1] + (uxv[1] / lux) * diag);
          x.stroke();
        }
      }

      x.lineWidth = 2.5;
      x.strokeStyle = 'rgba(214,48,32,.9)';
      ray(O, X);
      ray(O, Y);

      // rough strokes, then the ink the tracer locked onto
      x.strokeStyle = 'rgba(175,60,190,.32)';
      x.lineWidth = Math.max(6, +q('.star-brush').value);
      x.lineCap = 'round';
      x.lineJoin = 'round';
      markup.strokes.forEach((st) => {
        x.beginPath();
        st.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
        if (st.length === 1) x.lineTo(st[0][0] + 0.1, st[0][1]);
        x.stroke();
      });
      if (refined) {
        x.strokeStyle = 'rgba(30,100,215,.95)';
        x.lineWidth = 4;
        refined.forEach((st) => {
          x.beginPath();
          st.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
          x.stroke();
        });
      }

      const dot = (p, r, fill, txt) => {
        x.beginPath();
        x.arc(p[0], p[1], r, 0, 7);
        x.fillStyle = fill;
        x.fill();
        x.lineWidth = 2.5;
        x.strokeStyle = '#fff';
        x.stroke();
        x.fillStyle = '#fff';
        x.font = '600 13px ui-sans-serif,system-ui';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText(txt, p[0], p[1]);
      };
      dot(X, 11, '#b0431f', 'x');
      dot(Y, 11, '#1f6bb0', 'y');
      dot(O, 13, '#c2452d', 'O');

      const ratio = lux && luy ? lux / luy : 1;
      q('.star-scale-read').textContent =
        `Scale: ${lux.toFixed(1)} px per x-unit, ${luy.toFixed(1)} px per y-unit` +
        (Math.abs(ratio - 1) < 0.03 ? ' — square units.' : ' — units are not square.');
    }

    function applyEqual(from) {
      if (!q('.star-equal').checked || !markup) return;
      const xv = +q('.star-xval').value || 1;
      const yv = +q('.star-yval').value || 1;
      const O = markup.O;
      const dx = [markup.X[0] - O[0], markup.X[1] - O[1]];
      const dy = [markup.Y[0] - O[0], markup.Y[1] - O[1]];
      const lx = Math.hypot(dx[0], dx[1]) / Math.abs(xv);
      const ly = Math.hypot(dy[0], dy[1]) / Math.abs(yv);
      if (!lx || !ly) return;
      if (from === 'X') {
        const k = (lx * Math.abs(yv)) / Math.hypot(dy[0], dy[1]);
        markup.Y = [O[0] + dy[0] * k, O[1] + dy[1] * k];
      } else {
        const k = (ly * Math.abs(xv)) / Math.hypot(dx[0], dx[1]);
        markup.X = [O[0] + dx[0] * k, O[1] + dx[1] * k];
      }
    }

    // ---- pointer handling --------------------------------------------------
    function canvasPt(ev) {
      const r = canvas.getBoundingClientRect();
      return [((ev.clientX - r.left) * MW) / r.width, ((ev.clientY - r.top) * MH) / r.height];
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (!markup || photoLoading) return;
      const p = canvasPt(e);
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
      if (mode === 'axes') {
        const near = [
          ['O', markup.O],
          ['X', markup.X],
          ['Y', markup.Y],
        ]
          .map(([k, v]) => [k, Math.hypot(v[0] - p[0], v[1] - p[1])])
          .sort((a, b) => a[1] - b[1])[0];
        drag = near[1] < Math.max(26, MW * 0.04) ? { kind: 'handle', key: near[0] } : null;
        if (drag) {
          invalidateTrace();
          markup[drag.key] = p;
          if (drag.key !== 'O') applyEqual(drag.key);
          lastHandle = drag.key;
          drawPhoto();
        }
      } else {
        invalidateTrace();
        drag = { kind: 'stroke' };
        markup.strokes.push([p]);
        drawPhoto();
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!drag || photoLoading) return;
      const p = canvasPt(e);
      e.preventDefault();
      invalidateTrace();
      if (drag.kind === 'handle') {
        markup[drag.key] = p;
        if (drag.key !== 'O') applyEqual(drag.key);
      } else {
        const st = markup.strokes[markup.strokes.length - 1];
        const last = st[st.length - 1];
        if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 2) st.push(p);
      }
      drawPhoto();
    });

    const endDrag = () => {
      if (drag && drag.kind === 'stroke') {
        const st = markup.strokes[markup.strokes.length - 1];
        if (st.length < 3) markup.strokes.pop();
      }
      drag = null;
      drawPhoto();
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    // ---- ink detection -----------------------------------------------------
    // Adaptive threshold: a pixel counts as ink when it is meaningfully darker
    // than the average of its neighbourhood. That handles uneven lighting and
    // shadows across a photographed page, which a fixed threshold does not.
    function buildMask() {
      if (maskCache) return maskCache;
      const c = document.createElement('canvas');
      c.width = MW;
      c.height = MH;
      const cx = c.getContext('2d', { willReadFrequently: true });
      cx.fillStyle = '#fff';
      cx.fillRect(0, 0, MW, MH);
      cx.drawImage(photoBmp, 0, 0, MW, MH);
      const d = cx.getImageData(0, 0, MW, MH).data;
      const v = new Float32Array(MW * MH);
      for (let i = 0; i < MW * MH; i++) {
        const r = d[i * 4];
        const g = d[i * 4 + 1];
        const b = d[i * 4 + 2];
        const mx = Math.max(r, g, b);
        const mn = Math.min(r, g, b);
        v[i] = 0.299 * r + 0.587 * g + 0.114 * b + 0.6 * (mx - mn);
      }
      const I = new Float64Array((MW + 1) * (MH + 1));
      for (let y = 0; y < MH; y++) {
        let rs = 0;
        for (let x = 0; x < MW; x++) {
          rs += v[y * MW + x];
          I[(y + 1) * (MW + 1) + x + 1] = I[y * (MW + 1) + x + 1] + rs;
        }
      }
      const R = Math.max(8, Math.round(Math.max(MW, MH) / 40));
      const dk = new Uint8Array(MW * MH);
      for (let y = 0; y < MH; y++) {
        const y0 = Math.max(0, y - R);
        const y1 = Math.min(MH, y + R + 1);
        for (let x = 0; x < MW; x++) {
          const x0 = Math.max(0, x - R);
          const x1 = Math.min(MW, x + R + 1);
          const m =
            (I[y1 * (MW + 1) + x1] - I[y0 * (MW + 1) + x1] - I[y1 * (MW + 1) + x0] + I[y0 * (MW + 1) + x0]) /
            ((y1 - y0) * (x1 - x0));
          if (v[y * MW + x] < m - 20) dk[y * MW + x] = 1;
        }
      }
      maskCache = { dark: dk };
      return maskCache;
    }

    // Walk along the rough stroke; at each step look sideways (perpendicular to
    // the direction of travel) for ink, and move the point onto it. Runs that
    // sit on the axis lines are ignored so the trace does not get captured by
    // them where the curve crosses.
    function snapStroke(st, R) {
      const dark = buildMask().dark;
      const D = (x, y) => {
        x = Math.round(x);
        y = Math.round(y);
        return x >= 0 && y >= 0 && x < MW && y < MH && dark[y * MW + x];
      };
      const O = markup.O;
      const X = markup.X;
      const Y = markup.Y;
      const distLine = (p, A, B) => {
        const dx = B[0] - A[0];
        const dy = B[1] - A[1];
        const L = Math.hypot(dx, dy) || 1;
        return Math.abs((p[0] - A[0]) * dy - (p[1] - A[1]) * dx) / L;
      };
      const onAxis = (p) => distLine(p, O, X) < 4 || distLine(p, O, Y) < 4;

      const path = [];
      for (let i = 1; i < st.length; i++) {
        const a = st[i - 1];
        const b = st[i];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const n = Math.max(1, Math.round(L / 2));
        for (let k = 0; k < n; k++) {
          path.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
        }
      }
      path.push(st[st.length - 1]);

      const out = [];
      let prevOff = 0;
      let hits = 0;
      path.forEach((p, i) => {
        const a = path[Math.max(0, i - 3)];
        const b = path[Math.min(path.length - 1, i + 3)];
        let tx = b[0] - a[0];
        let ty = b[1] - a[1];
        const L = Math.hypot(tx, ty) || 1;
        tx /= L;
        ty /= L;
        const nx = -ty;
        const ny = tx;
        const runs = [];
        let s0 = null;
        for (let k = -R; k <= R; k++) {
          const pt = [p[0] + nx * k, p[1] + ny * k];
          const on = D(pt[0], pt[1]) && !onAxis(pt);
          if (on && s0 === null) s0 = k;
          if ((!on || k === R) && s0 !== null) {
            runs.push([(s0 + (on ? k : k - 1)) / 2, (on ? k : k - 1) - s0 + 1]);
            s0 = null;
          }
        }
        const good = runs.filter((r) => r[1] <= Math.max(6, R * 0.8));
        const pick = (good.length ? good : runs).sort(
          (A, B) =>
            Math.abs(A[0]) + Math.abs(A[0] - prevOff) * 0.8 - (Math.abs(B[0]) + Math.abs(B[0] - prevOff) * 0.8),
        )[0];
        if (pick) {
          prevOff = 0.5 * prevOff + 0.5 * pick[0];
          hits++;
          out.push([p[0] + nx * pick[0], p[1] + ny * pick[0]]);
        } else {
          out.push([p[0], p[1]]);
        }
      });

      const sm = out.map((p, i) => {
        let sx = 0;
        let sy = 0;
        let n = 0;
        for (let k = Math.max(0, i - 2); k <= Math.min(out.length - 1, i + 2); k++) {
          sx += out[k][0];
          sy += out[k][1];
          n++;
        }
        return [sx / n, sy / n];
      });
      return { pts: sm, snapped: hits / Math.max(1, path.length) };
    }

    // ---- pixels to graph coordinates ---------------------------------------
    // The three handles define an affine frame. Inverting it maps any pixel to
    // graph coordinates, which also means a photo taken at a slight angle still
    // reads correctly: the axes need not be perpendicular on the page.
    function markupToGraph() {
      const O = markup.O;
      const X = markup.X;
      const Y = markup.Y;
      const ux = +q('.star-xval').value || 1;
      const uy = +q('.star-yval').value || 1;
      const R = Math.round(+q('.star-brush').value);
      const ax = [X[0] - O[0], X[1] - O[1]];
      const ay = [Y[0] - O[0], Y[1] - O[1]];
      const det = ax[0] * ay[1] - ax[1] * ay[0];
      if (!det) throw new Error('The three axis dots are in a straight line — move them apart.');

      const toData = (p) => {
        const dx = p[0] - O[0];
        const dy = p[1] - O[1];
        return [((dx * ay[1] - dy * ay[0]) / det) * ux, ((ax[0] * dy - ax[1] * dx) / det) * uy];
      };

      refined = [];
      const curves = [];
      let snap = 0;
      let n = 0;
      markup.strokes.forEach((st) => {
        if (st.length < 3) return;
        const r = snapStroke(st, R);
        refined.push(r.pts);
        snap += r.snapped;
        n++;
        // Collapse to one y per x, since pl-sketch treats a curve as a function.
        const seen = new Map();
        r.pts.map(toData).forEach(([x, y]) => {
          const k = Math.round(x * 200) / 200;
          const e = seen.get(k);
          if (e) {
            e[0] += y;
            e[1]++;
          } else {
            seen.set(k, [y, 1]);
          }
        });
        const pts = [...seen.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([x, [sy, c]]) => [Math.round(x * 100) / 100, Math.round((sy / c) * 100) / 100]);
        const step = Math.max(1, Math.floor(pts.length / 60));
        const out = [];
        for (let i = 0; i < pts.length; i += step) out.push(pts[i]);
        if (pts.length) out.push(pts[pts.length - 1]);
        if (out.length > 2) curves.push({ points: out });
      });

      if (!curves.length) throw new Error('No usable trace. Switch to "Trace the curve" and drag along your line.');

      const frac = snap / Math.max(1, n);
      drawPhoto();
      return { curves, snapFraction: frac, xUnit: ux, yUnit: uy };
    }

    // ---- wiring ------------------------------------------------------------
    q('.star-file-btn input').addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const request = ++photoRequest;
      photoLoading = true;
      drag = null;
      invalidateTrace();
      q('.star-use').disabled = true;
      setStatus('Loading photo…');
      try {
        await showPhoto(f, request);
        if (request !== photoRequest) return;
        photoLoading = false;
        setStatus('Place the axes, then trace your curve.');
      } catch (err) {
        if (request !== photoRequest) return;
        photoLoading = false;
        q('.star-use').disabled = true;
        setStatus('Could not read that image.');
      }
    });

    q('.star-mode-axes').addEventListener('click', () => setMode('axes'));
    q('.star-mode-curve').addEventListener('click', () => setMode('curve'));
    q('.star-undo').addEventListener('click', () => {
      if (markup && markup.strokes.length) {
        markup.strokes.pop();
        invalidateTrace();
        drawPhoto();
      }
    });
    q('.star-clear').addEventListener('click', () => {
      if (markup) {
        markup.strokes = [];
        invalidateTrace();
        drawPhoto();
      }
    });
    q('.star-brush').addEventListener('input', () => {
      invalidateTrace();
      drawPhoto();
    });
    q('.star-units').addEventListener('change', drawPhoto);
    q('.star-xval').addEventListener('input', () => {
      invalidateTrace();
      applyEqual('X');
      drawPhoto();
    });
    q('.star-yval').addEventListener('input', () => {
      invalidateTrace();
      applyEqual('Y');
      drawPhoto();
    });
    q('.star-equal').addEventListener('change', () => {
      invalidateTrace();
      applyEqual(lastHandle === 'Y' ? 'Y' : 'X');
      drawPhoto();
    });

    // ---- fitting ------------------------------------------------------------
    function runFit(spec) {
      clearFit();
      if (!tracedPoints || photoLoading) return;
      try {
        const model = window.StarFit.fit(tracedPoints, spec);
        if (!model) throw new Error('Could not fit a curve to that trace.');

        q('.star-fit-box').hidden = false;
        q('.star-fit-eq').textContent = model.expr;
        q('.star-fit-meta').textContent =
          `${model.label} · within ${model.rmse.toFixed(3)} units of your drawing on average` +
          (model.poles && model.poles.length
            ? ` · vertical asymptote${model.poles.length > 1 ? 's' : ''} at ` +
              model.poles.map((p) => p.toFixed(2)).join(', ')
            : '');

        // Keep the dropdown in step when the fitter chose for us.
        if (!spec || !spec.family) q('.star-family').value = model.family;
        const isPoly = model.family === 'polynomial';
        q('.star-degree-wrap').hidden = !isPoly;
        if (isPoly && model.degree) q('.star-degree').value = model.degree;

        const out = q('.star-result');
        out.hidden = false;
        out.textContent =
          'pl-sketch function:  ' + window.StarFit.toPlFunction(model.expr) + '\n' +
          'domain:              ' + model.lo.toFixed(3) + ' to ' + model.hi.toFixed(3) + '\n\n' +
          'sampled curve (' + window.StarFit.sampleCurve(model).length + ' points):\n' +
          window.StarFit.sampleCurve(model).map((p) => `(${p[0]}, ${p[1]})`).join('  ');
        currentModel = model;
        q('.star-confirm').disabled = false;
      } catch (err) {
        clearFit();
        setStatus(err.message || 'Could not fit a curve to that trace.');
      }
    }

    // The student confirms the curve is a fair transcription of what they drew.
    // Only at that point does anything reach the canvas.
    q('.star-confirm').addEventListener('click', () => {
      if (!currentModel || photoLoading || q('.star-confirm').disabled) return;
      const res = onConfirm(currentModel);
      setStatus(res && res.message ? res.message : '');
    });

    q('.star-use').addEventListener('click', () => {
      if (!markup || photoLoading || q('.star-use').disabled) return;
      invalidateTrace();
      try {
        const result = markupToGraph();
        tracedPoints = result.curves[0].points;
        const pct = Math.round(result.snapFraction * 100);
        setStatus(
          pct > 80
            ? `Snapped to ink along ${pct}% of your trace.`
            : `Only ${pct}% of your trace found ink. Widen the search width or trace closer to the curve.`,
        );
        runFit(null); // let the fitter choose the family
      } catch (err) {
        setStatus(err.message || 'Could not read the markup.');
      }
    });

    // Structured correction: the student overrides the family rather than
    // describing the problem in words. Same constraint objects the prototype
    // produced, without needing anything to interpret English.
    q('.star-family').addEventListener('change', () => {
      const fam = q('.star-family').value;
      q('.star-degree-wrap').hidden = fam !== 'polynomial';
      runFit(fam ? { family: fam, degree: +q('.star-degree').value || 3, constraints: [], traceWeight: 1 } : null);
    });
    q('.star-refit').addEventListener('click', () => {
      const fam = q('.star-family').value;
      runFit(fam ? { family: fam, degree: +q('.star-degree').value || 3, constraints: [], traceWeight: 1 } : null);
    });
    q('.star-degree').addEventListener('input', () => {
      clearFit();
      setStatus('Fit settings changed. Refit to update the preview.');
    });

    setMode('axes');
    return { drawPhoto };
  }

  return { create: create };
})();
