# Reliable local rehearsal

Use this Mac and branch `feat/automatic-photo-recognition-cv`. Nothing in this
step was pushed or deployed. The running local PrairieLearn container is
`star-automatic-cv-baseline-arm64`, bound to this checkout on port 3000.

1. Open Chrome at <http://localhost:3000/pl/course/1/question/254/preview/> for a
   fresh sandbox attempt. The target function is used only by the grader.
2. Upload the actual paper photo:
   `/Users/alaiasun/Library/Mobile Documents/com~apple~CloudDocs/D. UC Berkeley/Courses/CS294 STAR FA2026/Experiment/examples/IMG_1678.jpg`.
3. Choose **Edit detected graph**. CV has not read a reliable mathematical scale.
   Click the paper's origin, the written x=4 tick and written y=4 tick, then enter
   `4` in each value field. No curve retracing or endpoint selection is needed.
   For the tested photo, approximate source positions are O=(842,1147),
   X=(1490,1130), Y=(826,517); these are presenter actions, never model input.
4. Compare the green provisional curve and red endpoint ring with the photo.
   Click **Edit detected graph** to accept. The purple curve and vertex handles
   are actual native polyline objects. The graph is now in `si.getState()`.
5. Say: “This is an assisted estimate from the photographed ink. I confirmed its
   axes. The small hook is still there; the system has not replaced my drawing
   with a perfect equation.”
6. With **Select**, drag the top-right endpoint slightly right. Closely spaced
   handles overlap: grab its exposed upper-left edge. The test moved just that
   endpoint 12 native pixels right. Undo/Redo can show the original/corrected turn.
7. Use ordinary **Save & Grade**, then refresh the same attempt. The uncorrected
   hook saved as a valid 0% answer; the demonstrated student correction graded
   100%. Different clicks/edits can produce other scores. Do not call this
   automatic mathematical correction or automatic recognition accuracy.

The expected primary interaction count is one file selection, one entry click,
three axis clicks, two value entries, one acceptance click, one vertex drag,
Save & Grade, and refresh. Native Select is activated automatically after import.

The source JPEG is local and never sent by the normal UI. The one approved Gemini
semantic attempt used only the metadata-free PNG, failed with HTTP 400, and is
exhausted. Do not execute another request while presenting. No key is needed for
this demo; keep credential files and the IDE out of screen sharing.

## Recovery and backup

- If CV cannot find a useful route, expand **Photo options** for **Align / select
  graph ink** or **Trace a paper graph (manual)**. Label those interactions honestly.
- The unchanged Step 4F manual route is
  <http://localhost:3000/pl/course/1/question/255/preview/>. Its original browser
  rehearsal passed 84 assertions at desktop/presentation sizes.
- Native drawings restore from the saved attempt. The photo/reference frame is
  browser-tab storage, scoped to the attempt, for up to 24 hours. If unavailable
  or on another browser, reupload the original photo; native drawings remain saved.
- If the primary service is unavailable, open
  `benchmarks/photo-graphs/multi-method/step-4f/offline-backup.html` locally, or use
  the unchanged `STAR-Nov09-demo.zip` in that directory. This is recorded evidence,
  not live server grading or Gemini inference.

## Presentation-screen check still requiring the presenter

1. Full-screen Chrome on the actual projector; confirm controls, values, purple
   handles and red ring are readable from the back of the room.
2. Check browser zoom and scroll placement. At 1280×720, the full page may require
   scrolling; use browser zoom if needed and confirm both curve endpoints are visible.
3. Perform one endpoint drag and Undo/Redo with the actual presentation pointer.
4. Save and refresh once; confirm native vertices restore in that same attempt.
5. Open the offline backup before the talk and keep the original photo accessible.

No physical-projector or touch-editing pass is claimed by the automated tests.
