# Step 4G-4 self-test and short demonstration

Use Chrome on this presenter Mac. No Gemini key or external API is needed.
All URLs below are local; the deployed course is unchanged.

## Try the canvas-first route

1. Verify the local runtime with
   `node benchmarks/photo-graphs/multi-method/step-4f/local-runtime.cjs status`.
   If stopped, use that command with `start`.
2. Open **http://localhost:3000/pl/course/1/question/254/preview/**.
3. Click **Upload / Take photo**. Select the existing local original
   `IMG_1670.jpg`, or this metadata-free repository copy:
   `benchmarks/photo-graphs/multi-method/step-4g-1/results/IMG_1670--source.png`.
   Failed fixtures are in `benchmarks/photo-graphs/automatic-cv/experiment-01/inputs/`:
   `real--01-multiple-lines-graph-paper.png` and
   `real--06-piecewise-graph-paper.png`.
4. The photo appears inside the native canvas without opening a review dialog.
   CV runs on this Mac. Dashed orange lines, when available, are provisional and
   **not graded**. A failed recognition does not disable drawing.
5. Click **Edit on canvas**. Draw with **Graph strokes**, add a separate dot
   with **Other marks**, then use **Select** to move an object or **Delete** to
   remove it. The photograph is a visual reference, **not aligned to the native
   mathematical axes**. Check the receiving axes before submitting. Native
   freehand may round corners; this is not automatic/calibrated reconstruction.
6. Use **Hide photo / Show photo** to compare native ink. Under **Photo options**
   you can hide provisional lines, adjust opacity or remove the reference.
   Existing native objects stay intact.
7. Click the ordinary **Save & Grade**, then refresh the resulting variant URL.
   Native drawings restore; a stored reference restores only in this tab and
   attempt. The sandbox target is x-squared, so these different drawings should
   receive 0%, not recognition credit. A photo without native drawings is invalid.
8. Replace the photo or remove it: your native objects must remain. If the
   storage message asks for reupload, do so after refresh. A fresh preview
   variant intentionally does not inherit an old photograph.

## Suggested 60–90 second explanation

“A student should be able to work with their photograph even when recognition
fails. Here the original paper graph is visible inside PrairieLearn. Orange
lines are CV's provisional pixels, including incorrect fragments. They are not
an answer. I can draw, add a point and correct native objects immediately, then
use normal Save & Grade. Only those native objects are submitted. The photo is
not mathematically aligned, so a faithful coordinate transcription still needs
our optional calibrated assistance. We have not solved general automatic photo
recognition.”

The [workflow GIF](results/workflow.gif) presents discrete actual test captures
of upload/CV, hide/show, native drawing, native editing and saved/restored output.
It is not a recording of human timing. A small unrelated curve and dot were
deliberately present before upload to prove preservation.

## Reliable geometry demonstration and backup

For the established faithful route, open
**http://localhost:3000/pl/course/1/question/255/preview/#paper-lines-si-container**.
On the lower wide-range canvas click **Photo options → Trace a paper graph
(manual)**. Then follow the unchanged
[Step 4F presenter actions](../step-4f/PRESENTER.md), starting with its photo
selection/calibration. The new disclosure click is the only entry difference.
This calibrated, fully manual route was replayed with 84 original assertions,
including 1280×720, native editing, Save & Grade and refresh.

If the primary PrairieLearn service fails, use the **unchanged recorded** backup:

```bash
node benchmarks/photo-graphs/multi-method/step-4f/serve-package.cjs
```

Open **http://127.0.0.1:3020/backup**; slides are at
**http://127.0.0.1:3020/presentation**. The local
`../step-4f/offline-backup.html` also opens directly as a file. It shows the
earlier tested assisted route, not this new canvas layer. This step verified
that those assets were unchanged; it did not rerun the earlier service-outage
exercise. Do not describe recorded output as live recognition.

Before presenting, use the existing [projector checklist](../step-4f/MANUAL-CHECKLIST.md).
Actual projector/back-row readability and a timed human rehearsal remain manual
checks. On a 720-high screen scroll to the canvas or check browser zoom with the
projector. Safari, Firefox and phone-camera capture were not tested this step.
