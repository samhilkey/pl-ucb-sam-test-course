# Step 4H-2 — Try the visible workflow

On this Mac, open **http://localhost:3000/pl/course/1/question/254/preview/**.
Reload an older tab; Chrome's Cmd+Shift+R refreshes cached scripts. Verify that
Upload / Take photo is followed by the visible **Align / select graph ink**
action after an uncertain recognition. No Gemini key or internet API is needed.
The local course remains separate from the deployed course.

## IMG_1670: reuse CV without retracing

1. Upload the original `examples/IMG_1670.jpg`. The portable metadata-free copy is
   `../step-4g-1/results/IMG_1670--source.png`. The original JPEG is the tested input.
2. Click **Align / select graph ink**. On the original photograph click O=(0,0),
   a known x tick and a known y tick. Enter their values independently. Recorded
   replay aids in original source pixels: **O=(782,786)**,
   **X=(1229,775), value 3**, **Y=(751,300), value 3**.
3. Click the curve's two endpoints: approximately **(110,714)** and **(1469,629)**.
   The green selection reuses the connected CV pixels; do not drag a new trace.
4. Click **Filled dot**, then the separate dot near **(821,294)**.
5. Click **Preview selected graph**. Compare axes, both peaks, the off-origin
   minimum, endpoints and dot against the photo. The preview is ungraded.
   Its measured source-photo error is still about 12 pixels p95; use **Trace
   instead** if that candidate does not represent your ink faithfully.
6. **Accept as editable graph** adds one real native curve and one point. No
   fragment review dialog is required. Select can move a curve; Delete removes
   selected native objects. Existing drawings stay intact.
7. **Save & Grade**, then refresh. This drawing is not x-squared and the recorded
   result is **0%**. The grade is not a transcription-accuracy measurement.

## IMG_1678: genuine real-paper positive grading through manual recovery

1. Upload your new original `examples/IMG_1678.jpg`, SHA-256
   `f86a0acd1dc1fcad32884c202e4fffe44adc5d88c1062a0f8a2cbd60dbc74d49`.
   A metadata-free copy is [inputs/IMG_1678--source.png](inputs/IMG_1678--source.png).
2. Choose **Align / select graph ink**. Recorded source-pixel aids:
   **O=(842,1147)**, **X=(1490,1130), value 4**,
   **Y=(826,517), value 4**. These are manually read photo locations, not model output.
3. Endpoint-guided selection can find the curve, but the native function-input
   check rejects its x reversal. Nothing is imported. For the dependable tested
   route, choose **Trace instead** directly after calibration.
4. Drag along the actual curve from its left endpoint through the vertex to its
   right endpoint, releasing on that endpoint. The on-canvas tracer captures
   pointer-up and preserves the trace through the existing manual adapter.
   It does not infer a parabola. Exact replay waypoints are recorded in
   [new-paper results](results/new-paper/results.json).
5. Preview, compare with the original photo and explicitly accept. The result
   is **manually traced**, not automatically recognized or CV-extracted.
6. With native **Other marks**, place the four dots that touch the curve at
   their visible photo positions. Replay aids: approximately **(542,508)**,
   **(1130,505)**, **(700,1006)** and **(1012,993)**. These are manual placements;
   do not snap them to ideal mathematical coordinates.
7. Save & Grade and refresh. The recorded actual result is **100%** for the
   existing x-squared function criterion. The point tool is not separately graded.
8. Select/drag the curve slightly, save and refresh to demonstrate editing.
   The test's deliberate displacement changed the current grade to 0%. The
   prepared variant is then returned to the original actual native snapshot,
   saved again and verified at its original grade; see
   [prepared result](results/new-paper/results.json).

The photograph is only a reference, even after alignment. Three anchors do not
prove globally correct calibration on bent/nonuniform handwritten axes. Native
stroke/point styles differ from paper ink. The ordinary freehand tool may round
shapes and leave a trailing endpoint; use **Trace instead** for the tested
geometry-preserving manual path.

## November 9 fallback and limits

Keep the frozen Step 4F route available at
**http://localhost:3000/pl/course/1/question/255/preview/#paper-lines-si-container**.
Click **Photo options → Trace a paper graph (manual)** and follow
[the frozen presenter script](../step-4f/PRESENTER.md). Its original acceptance
body passed 84 assertions in this step; no backup assets were rebuilt.

If the primary PrairieLearn service is unavailable, run the existing
`node benchmarks/photo-graphs/multi-method/step-4f/serve-package.cjs` and open
**http://127.0.0.1:3020/backup**, or open `../step-4f/offline-backup.html` directly.
This is a recorded assisted example, not live automatic recognition. This step
checks unchanged backup bytes; it does not repeat the earlier outage exercise.

Use the existing [projector checklist](../step-4f/MANUAL-CHECKLIST.md). Actual
projector readability, a timed human rehearsal, phone camera capture and other
browsers remain unverified. Present assistance explicitly; a full automatic
Gemini+CV demonstration is not established. No new Gemini request is authorized.

Prepared real-paper original (returned to its actual traced Native snapshot):
**http://localhost:3000/pl/course/1/question/254/preview/?variant_id=517** — verified current grade 100%.
See [urls.json](urls.json). This is assisted work, not automatic recognition.
