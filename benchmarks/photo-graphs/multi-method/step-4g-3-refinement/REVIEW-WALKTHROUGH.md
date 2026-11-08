# Test the refined review

Use Chrome on this Mac and reload the local page to get the updated dialog:
http://localhost:3000/pl/course/1/question/254/preview/

The tested photograph is the user's original file. In the file picker, Cmd+Shift+G
opens a path field:

```text
/Users/alaiasun/Library/Mobile Documents/com~apple~CloudDocs/D. UC Berkeley/Courses/CS294 STAR FA2026/Experiment/examples/IMG_1670.jpg
```

The tracked, metadata-free version with identical decoded pixels is also available:
`../step-4g-1/results/IMG_1670--source.png`. No Gemini key or inference is involved.

1. Optionally put an **Other marks** point in an empty corner of the native canvas,
   so you can check it survives. Click **Recognize a graph photo** and choose the
   photo. Its raw CV result is incomplete, not Gemini or successful recognition.
2. **Continue with detected strokes**. Place O at the axes' intersection, X on
   the positive x-axis tick labeled 3, and Y on the y-axis tick labeled 3. Enter
   3 independently for both values. **Review detected lines** enables as soon as
   the references are mathematically valid; there is no acknowledgment checkbox.
3. Click the highlighted left and right curve and the tiny connecting part at
   the y-axis crossing to keep them. Blue means kept; orange means unresolved;
   dashed/faded lines mean removed. Click again to remove; **Undo last change**
   restores the previous choice. **Zoom photo** helps with small parts. Keyboard
   users can move between highlighted lines with arrows and keep/remove with
   Space. Advanced individual editing remains optional.
4. **Review other lines**. Inspect the still-orange axes/labels/fragments on the
   photo. Choose **Not part of my graph** only if those other lines should be
   left out; otherwise **Keep editing lines**. No unchosen line is excluded merely
   by requesting preview. If the tiny connector is unclear, choose **Trace manually**.
5. In **Check separate points**, the real dot is circled on the original photo
   and shown next to its y-axis/tick/curve context. Choose **Keep as point** for
   that dot. Choose **Not part of graph** for the three label/axis fragments.
   Each decision advances to the next unresolved mark. Arrow keys on the marked
   photo switch points; undo restores a decision. **Not sure / Correct manually**
   transfers the same File into the unchanged manual tracing route without import.
6. When every necessary decision is resolved, click **Preview graph**. Compare
   the calibrated native preview with the photo, use the retained final review
   acknowledgment, then **Confirm and add graph**. Expect one connected curve
   plus one independent dot, with existing native objects retained.
7. **Save & Grade** → refresh. The sandbox target is x-squared, so this different
   graph correctly receives 0%. Check that the curve, dot and old objects remain.
   Use **Select** to translate the curve, Save & Grade and refresh again.

You should not need the 44-item advanced list for this case. The tested visual
choices correspond internally to source paths 10/11/12; those identifiers are
reproduction aids, not automatic branch labels. They remain separate until human
selection permits the existing exact-endpoint native preparation. Do not invent
connections or force import when ambiguity remains.

CV-assisted selection preserves the detector's errors (11.69/11.90px p95). For
November 9, use the more faithful tested manual-assisted route at:
http://localhost:3000/pl/course/1/question/255/preview/#paper-lines-si-container

The original manual interactions, input, deck and recorded backup are unchanged
in `../step-4f/`. The historical package's Gemini status text is not a current
research claim: the later one-image pilot ran and failed fidelity. No model calls
run in either local demo route.

The recorded backup is http://127.0.0.1:3020/backup after starting the existing
viewer if needed:

```sh
node benchmarks/photo-graphs/multi-method/step-4f/local-runtime.cjs status
# Only if PrairieLearn is stopped:
node benchmarks/photo-graphs/multi-method/step-4f/local-runtime.cjs start
# Independent local backup/deck viewer, in another terminal:
node benchmarks/photo-graphs/multi-method/step-4f/serve-package.cjs
```

Physical projector check, after separate rehearsal approval: full-screen Chrome
at intended resolution/zoom; read the method, disabled reason, axis values,
point question and final confirmation from the back row; check footer visibility,
photo scrolling, focus/Escape, native edit/save/refresh and the already-open
recorded backup. Automated viewport checks do not establish physical readability
or human presentation timing. No Safari or actual VoiceOver pass is claimed.
