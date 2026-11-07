# November 9 presenter route after Step4G-3

Use this Mac and Chrome. The timings below are a proposed 4–5-minute allocation,
not measured human performance. Keep the manually traced route as the dependable
live demo. CV-assisted reuse is optional; its 12px p95 error fails the frozen
photo-fidelity screen. It is not an automatic recognition success.

## Preflight and exact inputs

From `/Users/alaiasun/GitHub/pl-ucb-sam-test-course`:

```sh
node benchmarks/photo-graphs/multi-method/step-4f/local-runtime.cjs status
# Only if the local service is stopped:
node benchmarks/photo-graphs/multi-method/step-4f/local-runtime.cjs start
# Start the independent recorded viewer in another terminal if needed:
node benchmarks/photo-graphs/multi-method/step-4f/serve-package.cjs
```

- Primary photo workflow: http://localhost:3000/pl/course/1/question/254/preview/
- Frozen wide-range manual demo: http://localhost:3000/pl/course/1/question/255/preview/#paper-lines-si-container
- Recorded backup: http://127.0.0.1:3020/backup
- Frozen visual deck: http://127.0.0.1:3020/presentation
- PDF: http://127.0.0.1:3020/presentation.pdf
- New prepared saved attempts from this rehearsal: `results/frozen-demo-evaluation.json`
  → each `prepared_original_variant_url` (desktop example ends `variant_id=295`).
  These depend on this Mac's local database. Use the JSON value if rerun changes it.

Photo for automatic → CV-assisted reuse:
`benchmarks/photo-graphs/multi-method/step-4g-1/results/IMG_1670--source.png`.
SHA-256: `9c8247ec0be7d4ca68c4536eea990a0c5b0fce6250e8478a13b5aa5a0e190231`.

Photo for the frozen full manual route:
`benchmarks/photo-graphs/multi-method/step-4f/inputs/new-paper-01.png`.
Use that tested file, not an overlay or the AI-labelled comparison PNG.
The disconnected fallback fixture and its exact actions remain in
`../step-4c/operator-actions.json` (real--01).

No Gemini key or internet connection is required. Code and inputs are local on
this unpushed feature branch; no deployed course has been updated. The old deck
and recorded backup describe their historical assisted acceptance. Use this
script's current research status: one prior Gemini pilot ran and failed fidelity;
prerequisites are not the current reason for rejecting that prediction.

## 0:00–0:40 — Motivation

“We want assessment to keep what a student actually drew, including mistakes.
Turning a photograph into an ideal equation can erase corners, separate branches
or errors. Our goal is reviewed, editable PrairieLearn geometry.”

Show the real paper photo with two peaks, off-origin minimum and separate dot.

## 0:40–1:15 — What is automatic and what is assisted

“Upload runs a local CV detector. On this example it follows useful curve pixels,
but also extracts axes and labels. That is an incomplete automatic result.”

Open question 254, **Recognize a graph photo**, and choose the exact source PNG.
Show **Curves detected; axes and ink need confirmation** and the explicitly
uncalibrated pixel-space preview. Do not call it Gemini.

“A new CV-assisted option reuses those pixels while a person sets scale and
classifies ink. It removes false paths here, but does not correct their positions.
For today's most faithful reconstruction, we use the tested manual route.”

## 1:15–2:50 — Reliable live route

For a short slot, prepare the manual review first and state which actions were
prepared. Full tracing can exceed the live allocation; never imply it was automatic.

1. In question 255, use the lower **Paper graph with separate branches** canvas.
   Add an **Other marks** point far from the intended graph, proving preservation.
2. **Trace a paper graph (manual)** → select the tested Step4F input. Alternatively,
   in question 254 choose **Trace manually** from the automatic/CV-assisted dialog:
   it transfers the same File without another file picker.
3. Set axes on the photograph: **O=(782,786); X=(1229,775), value 3;
   Y=(751,300), value 3** (source-pixel rehearsal aids, not detector outputs).
4. **Continue to tracing**. Trace one continuous real stroke from left endpoint
   (110,714) → peak (373,451) → curved minimum around (682,676) → peak (1008,309)
   → right endpoint (1469,629). Follow the ink, not a fitted parabola. Exact
   waypoints are in `../step-4f/operator-actions.json`.
5. **Read my trace**, compare the review, acknowledge, then **This matches my sketch**.
   Point out the off-origin minimum and both corners.
6. Use native **Other marks** to place the photo's dot near (x≈0.47,y≈3.03).
   This is manual placement, separate from the unrelated existing point.
7. **Save & Grade** → refresh. Explain the existing x-squared target gives this
   different graph 0%, while keeping the actual drawn geometry.
8. **Select** → drag the curve → Save & Grade → refresh. Both dots stay independent.

## Optional CV-assisted walkthrough (replace the live tracing segment only)

Use question 254 and the exact source PNG. **Continue with detected strokes**.
Place O/X/Y and enter 3 and 3 as above; confirm axes → **Review detected lines**.
Keep the left and right graph strokes in the pixel preview (keyboard Space also
works). In **Review lines individually**, keep **Line 11** as the small connector
at the y-axis crossing; the selected source IDs are `stroke-10/11/12`.
Choose **Exclude remaining lines**. Keep **Small mark 1** as a filled dot and
exclude small marks 2–4. Confirm the whole-photo review → **Preview graph** →
compare → final acknowledgment → **Confirm and add graph**.

All 43 resulting vertices are original CV coordinates; two duplicate shared
endpoints were joined, with no bridge invented. This retains the original CV
errors. Do not call it equally faithful to the manual trace. If selecting a
fragment is unclear or import stays blocked, choose **Trace manually**. Do not
force acceptance or change the native validation.

## 2:50–3:30 — Measured result

“The manual trace is about 3.50/3.49 source pixels from approximate visual
centerlines at the 95th percentile; 91.27% is within 3px. Native encoding adds
less than 0.001px drift to the entered geometry. Those are one-case engineering
diagnostics with uncertain visual annotations, not general recognition accuracy.”

“CV-assisted selection improves structure and removes false paths, but its
11.69/11.90px distances still fail the frozen photo-fidelity screen.”

## 3:30–4:30 — Limits, future work and backup

“Fully automatic CV remains 0/3 on these real-photo cases. The one-image Gemini
pilot also failed geometric fidelity. No more model calls run here. Future
recognition work must measure the student's actual geometry before integration.”

“Native editing currently moves/deletes whole branches; missing ink and detailed
corrections use manual tracing. Photo drafts do not survive refresh, but submitted
native answers do. Open circles, arrows and projective camera correction remain
limitations.”

If the primary service fails, switch to the already-open **localhost:3020/backup**.
Say: “This is recorded manual reconstruction, native editing and real submission
from acceptance testing, not live recognition or a newly computed grade.” The
viewer is independent of PrairieLearn; after loading, all images/navigation/native
JSON downloads work offline. Keep the PDF as a further static backup. Do not
restart or delete databases on stage.

## Required human screen/timing check

1. On the actual November 9 projector, mirror this Mac; open Chrome full screen
   at the intended resolution and zoom. This step has only automated Chrome-engine
   1280×720 viewport evidence, not a physical projector pass or Safari acceptance.
2. From the back row, read the method/status, pixel-vs-native caption, axis values,
   disabled-action explanation and final confirmation. Increase zoom as needed.
3. Verify the footer stays visible; scroll the dialog body to the whole photo and
   mark crops without horizontal scrolling. Check focus is visible with Tab;
   Escape returns to the opener. Do not select keep/exclude by color alone.
4. Confirm both sharp peaks, two native points and independent branch examples
   are distinguishable. Test native Select and Save & Grade once on the projector.
5. Time the actual spoken route and tab switches. Prepare review in advance for
   a 3-minute slot and disclose that preparation. Keep the backup/PDF open.
6. Refresh the saved attempt, then unplug external internet and verify local
   PrairieLearn and the already-loaded backup remain usable. Do not stop Docker.

Stop after this rehearsal/freeze. Another implementation or model experiment
requires separate explicit approval.
