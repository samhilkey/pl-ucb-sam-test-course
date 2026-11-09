# Local rehearsal — adaptive native curves

Use Chrome on this Mac. Docker container `star-automatic-cv-baseline-arm64`
must serve PrairieLearn on port 3000 with this checkout mounted at `/course`.
The implementation is **only on the unpushed local feature branch**. Another
computer and the deployed course do not automatically receive it.

New experimental question:
http://localhost:3000/pl/course/1/question/256/preview/

Working H4 polyline fallback:
http://localhost:3000/pl/course/1/question/254/preview/

Frozen manual fallback:
http://localhost:3000/pl/course/1/question/255/preview/

These numeric IDs were verified in this local database; a fresh installation
must load the course from disk and find QIDs `star-adaptive-photo-test`,
`star-automatic-photo-test`, and `star-assisted-photo-demo` rather than assume IDs.

## Experimental route, about 3 minutes

1. Open the experimental question in a new preview attempt. Say: “CV measures
   the photograph. I confirm its coordinates; this is CV-assisted, not fully
   automatic recognition. The displayed equation is only the sandbox grader.”
2. Choose **Upload / Take photo** and select the original local user photograph:
   `/Users/alaiasun/Library/Mobile Documents/com~apple~CloudDocs/D. UC Berkeley/Courses/CS294 STAR FA2026/Experiment/examples/IMG_1678.jpg`.
   Portable metadata-free alternative already in the repository:
   `../step-4h-2/inputs/IMG_1678--source.png`.
   The acceptance run used the original JPEG; no external service receives it.
3. Choose **Edit detected graph**. Click the actual drawn origin, a positive x
   tick and a positive y tick. The recorded original-photo coordinates are
   O=(842,1147), X=(1490,1130), Y=(826,517); X and Y both mean **4**. These clicks
   are manual calibration, not curve tracing. Use the photograph to confirm.
4. Leave **Curve style: Auto**. The green smooth sections and retained irregular
   trace are a provisional estimate. Choose **Edit detected graph** to explicitly
   accept it into actual native objects. No native answer exists before acceptance.
5. Use **Select** to drag an exposed green spline anchor. Show Undo and Redo.
   Say: “These are native editable splines; the endpoint hook and uneven middle
   were retained rather than replaced with a perfect parabola.”
6. **Save & Grade**, then refresh. The original hook is intentionally incorrect,
   so 0% is a valid result. Native objects and the student edit restore. A later
   explicit student endpoint correction (12 native pixels right) reached 100%
   in acceptance, with another Save & Grade and refresh. That is separate from
   recognition evidence; overlapping endpoint handles can be fiddly.
7. Optional, **before any edit or refresh**: Photo options → **Change curve style
   (before editing)** → **Original trace** → accept. This restores all 43 measured
   vertices without duplicating objects. Auto can be selected again. After
   editing, replacement is blocked to retain student work; use Undo/native tools.

Do not promise a seven-handle ideal curve: this case has 36 handles across five
pieces, versus 43 originally. The long arms are smooth; ambiguous details stay
original. Adjacent pieces can be moved independently after import.

## Reliable fallback

For the main demo, retain the previously tested H4 route and its endpoint-edit
rehearsal in `../step-4h-4/PRESENTER.md`. Manual tracing remains in Photo options.
If localhost is unavailable, use the unchanged recorded package:
`../step-4f/offline-backup.html` or `../step-4f/STAR-Nov09-demo.zip`.
That backup is a recording/restored-state demonstration, not a live recognition
service. It does not contain this new experimental spline feature.

To replay local acceptance without inference:

```sh
node tests/star-adaptive-browser.cjs
node tests/star-adaptive-replays-browser.cjs
node benchmarks/photo-graphs/multi-method/step-4h-5/evaluate.cjs
```

The browser scripts write to `/private/tmp/star-h5`. Copy their `browser/` and
`replays/` result folders to this step's `results/` before rerunning the evaluator.
No key is required. Do not run provider inference scripts during rehearsal.

## Presentation-screen checks requiring the presenter

- Connect the actual projector and open the exact local URL.
- At 1280×720 or the projector's native resolution, confirm the calibration help,
  curve, tool labels and Save & Grade are legible from the back of the room.
- Drag a green anchor with the actual mouse/trackpad; verify Undo and Redo.
- Verify the tiny hooked endpoint can be selected without grabbing the nearby
  spline. Native hit areas overlap; use an exposed side or fall back to H4.
- Disconnect the primary service and open the recorded offline package locally.
- Describe all manual calibration and student correction explicitly.

The physical projector and live touch-handle editing have not been verified.
