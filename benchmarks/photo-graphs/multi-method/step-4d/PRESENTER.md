# November 9 presenter script — constrained assisted reconstruction

Use the two approved, already tested physical-paper photos. This is a scripted
manual-assisted demonstration, not a claim of automatic real-photo recognition.
The original peak and separate lines are preserved; intentionally wrong graphs
are not corrected to the x-squared target.

## Before presenting

1. Use this checkout and `feat/automatic-photo-recognition-cv`. Keep the local
   Docker/PrairieLearn database used in rehearsal. Node was 20.19.6; the existing
   ARM container is `star-automatic-cv-baseline-arm64`, port 3000. Do not pull a
   new Docker image or use the amd64 compose definition immediately before the
   presentation.
2. Check `docker ps --filter name=star-automatic-cv-baseline-arm64`. If Docker
   Desktop is running but this container is stopped, use
   `docker start star-automatic-cv-baseline-arm64`. No Gemini key is needed.
3. Open [the local assisted question](http://localhost:3000/pl/course/1/question/255/preview/).
   Confirm its title is `STAR: faithful assisted paper-graph demo` and the
   primary button says **Trace a paper graph (manual)**. If this database's ID
   differs, locate `star-assisted-photo-demo` by name. Use local **Load from
   disk** if necessary, not production Sync.
4. Keep two fresh preview tabs, one per case, matching the rehearsal. The other
   canvas can remain blank. Put the two `results/*--original.png` files in an
   easy-to-find local folder; their exact hashes are in
   [tested-inputs.json](tested-inputs.json). Never choose an overlay as input.
5. Have the recorded backup open in a third tab. If its viewer is not running,
   start it from the repository root in another terminal:

   ```bash
   node benchmarks/photo-graphs/multi-method/step-4d/serve-backup.cjs
   ```

   Open [recorded backup](http://127.0.0.1:3019/offline-backup.html). It needs
   Node and the local artifact, not PrairieLearn, its database or internet.
   Direct `file://` navigation is blocked in the automation environment and
   was not used for acceptance. Use this tested viewer path.

## Opening statement

“These are real photographs of handwritten graphs. I manually identify the
axes and trace the visible student ink. The reconstruction preserves my trace
as editable PrairieLearn geometry. It does not infer the expected equation,
repair mathematical mistakes or demonstrate automatic recognition.”

## Case 1: sharp corner / real--06

1. In the **Paper graph with a sharp peak** canvas, select **Other marks** and
   place a point near the upper right. Say: “This existing object must survive
   the import.”
2. Click **Trace a paper graph (manual)**. Select
   `results/real--06-piecewise-graph-paper--original.png`. Axes opens automatically.
3. Align X at source pixel (441,334), Y at (77,170), and O at (50,323). Enter
   X=9 and Y=160. These are visible labeled references, chosen manually.
   The coordinate list is an exact replay aid; align visually in the photo.
4. Click **Continue to tracing**. Trace one continuous shaft from (50,321),
   through the kink near (108,294), up to the sharp peak near (240,94), then
   down to (397,328). Keep the actual kink, corner and endpoints.
5. Click **Read my trace**. Compare the orange line with the photo, with
   **Show trace** unchecked if useful. Zoom/pan if needed. Say: “No equation
   family is selected or fitted. The orange polyline is what will be imported.”
6. Check the axis/branch/corner/endpoint acknowledgment, then **This matches my
   sketch**. Show the native sharp peak and the retained upper-right point.
7. Click **Save & Grade**. Explain the 0%: “This sandbox asks for x-squared. It
   correctly grades this different graph as wrong while preserving its shape.”
   Refresh; show the same submitted native graph and existing point.
8. Select **Select**, drag the whole branch slightly, then Save & Grade and
   refresh again. Say: “This is a deliberate native edit; its position now
   differs from the original photo. The branch shape remains intact.”

## Case 2: separate branches / real--01

1. In the second fresh tab, use **Paper graph with separate branches**. Add an
   upper-right **Other marks** point before importing, as in rehearsal.
2. Choose `results/real--01-multiple-lines-graph-paper--original.png` with the
   manual button. Set O=(238,255), X=(450,245), Y=(230,50), X value=5, Y value=5.
3. Say: “This photo has no numeric labels. These units are assigned for this
   demo; they are not recovered student units.”
4. Continue to tracing. Trace the upper shaft (14,321) → (236,256) → (781,74),
   following its visible bends. **Lift the pointer.** Trace the lower shaft
   (57,434) → (240,385) → (722,246). Full waypoints remain in the unchanged
   [operator replay](../step-4c/operator-actions.json).
5. Read, inspect both orange branches and their gap/endpoints, acknowledge,
   and import. Show two separate native objects; no joining line is invented.
   Arrowhead decorations and open/closed endpoint symbols are not reconstructed.
6. Save & Grade, then refresh. Show the preserved branches and existing point.
   The multivalued graph is a saved incorrect attempt, not an Invalid submission.
7. With Select, move only the upper branch. Show that the lower branch and point
   are unchanged. Save & Grade and refresh to show persistence of this edit.

## Recovery script

- **Before confirming, something looks wrong:** use **Edit my trace** or Axes;
  correct/retrace, Read my trace, review and acknowledge again. To abandon
  import, Close without confirming; no native state changes. Close retains the
  local draft until replacement or refresh; it is not a persistent draft save.
- **Wrong/replaced/invalid image:** choose the correct original again. Replacement
  clears the old trace/proposal. Invalid bytes are rejected. Place axes and trace
  again; the previously existing native objects remain intact.
- **Axes are ambiguous:** separate the O/X/Y markers and enter nonzero references.
  Import remains blocked until calibration is usable and the new preview reviewed.
- **Native canvas changed after review:** the stale confirmation is rejected.
  Read/review again; do not try to reuse the consumed proposal.
- **Browser refresh during photo review:** only the last **submitted native
  attempt** is restored. The unsaved photograph/calibration/trace is cleared.
  Upload and trace again, or use the recorded backup. Do not promise draft
  recovery. Refresh after Save & Grade is the planned persistence demonstration.
- **Local correction after import:** delete the affected branch and retrace it.
  Select moves whole branches; there is no per-vertex imported-geometry editor.
  Avoid appending a replacement on top of an old branch.

## Dependable backup statement

If the live photo workflow or PrairieLearn fails, switch to the already-open
local viewer and say: “This is the recorded assisted reconstruction from our
rehearsal, not live recognition or live grading.” Show each original, manual
review, native graph, recorded grade, native edit and restored result. The viewer
also downloads the exact original/edited native JSON. Its embedded images and
downloads were tested with the browser offline after initial local loading.

Saved PrairieLearn variant URLs in `results/rehearsal.json` provide a second
backup while that database is available; their latest state includes the
demonstrated branch move. The standalone recorded viewer is the backup if
PrairieLearn/database access is unavailable. Do not call a recorded screenshot
an editable live canvas or a newly computed grade.

The projector, presenter timing, uncoached-student use and new handwritten
examples have not been tested. Keep this demonstration within the rehearsed
scope. Do not open Gemini, billing settings or recognition experiments on stage.
