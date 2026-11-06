# STAR presentation and live demo, target 4–5 minutes

The timings below are a proposed allocation, not measured human performance.
Use the tested Chrome route on this Mac. Keep the recorded backup open before
speaking. No Gemini credential or internet connection is required.

## Preflight on this Mac

From `/Users/alaiasun/GitHub/pl-ucb-sam-test-course`:

```bash
node benchmarks/photo-graphs/multi-method/step-4f/local-runtime.cjs status
# If the local container is stopped:
node benchmarks/photo-graphs/multi-method/step-4f/local-runtime.cjs start
# If the independent package viewer is not already running:
node benchmarks/photo-graphs/multi-method/step-4f/serve-package.cjs
```

Open:

- Slides: **http://127.0.0.1:3020/presentation**. Right/left arrows or Page Down/Up
  advance one slide. Use Chrome's View → Enter Full Screen.
- Recorded fallback: **http://127.0.0.1:3020/backup** in another tab.
- Printable deck: **http://127.0.0.1:3020/presentation.pdf**.
- Fresh live attempt:
  **http://localhost:3000/pl/course/1/question/255/preview/#paper-lines-si-container**.
- Prepared saved variants: exact URLs in [urls.json](urls.json). The new-paper
  prepared variant has been returned to its original position and saved.

Select `inputs/new-paper-01.png` from this folder in the photo picker. It is a
metadata-free, pixel-identical PNG decoded from the user-supplied `IMG_1670.jpg`.
Do not select an overlay or the AI-labelled comparison PNG. All assets and the
course code are local on this confirmed presenter Mac, on the unpushed feature
branch. No deployed course was changed.

Before November 9, perform [MANUAL-CHECKLIST.md](MANUAL-CHECKLIST.md) on the actual
projector and rehearse the timing. A screenshot/viewport check does not establish
back-row readability. Stay with Chrome unless the Safari checklist also passes.

## 0:00–0:30 — Educational problem

“We want digital assessment to retain what the student actually drew, including
mistakes. Asking them to recreate a photographed graph with an equation can
change its shape. Our goal is an editable PrairieLearn answer that preserves the
visible work.”

Show slide 1 with the new user-drawn physical-paper photo. It has two sharp
peaks, an off-origin curved minimum and a separate dot. The AI-labelled PNG
provided alongside it was not an acceptance input or a source of target geometry.

## 0:30–0:55 — Workflow and responsibilities

“This route is assisted. A person places axes, supplies their values, traces the
ink and reviews the reconstruction. The system maps that trace into native
editable geometry and preserves its submission. We do not fit the expected
equation or run a VLM here.”

Slide 2 shows the actual review. Explain that the separate dot needs the existing
native **Other marks** point tool after curve import; it is not automatically
extracted by the stroke route.

## 0:55–2:45 — Live photo-to-native demonstration

Use the **lower, wide-range canvas**, titled “Paper graph with separate branches”.
Its existing range includes this new photograph's negative x-values. The static
helper text mentions the old unlabeled example; this new input has visible labels.
Do not change the question or target during the talk.

1. Select **Other marks** and put a test note near (10,6). Say “This existing
   canvas object must survive import.” It is not a mark inferred from the photo.
2. Click **Trace a paper graph (manual)** and select `inputs/new-paper-01.png`.
   Place X, Y, then O on the visible axes. Source-pixel replay aids:
   **O=(782,786); X=(1229,775), value 3; Y=(751,300), value 3**.
3. Click **Continue to tracing**. In one continuous gesture follow the real ink:
   left endpoint (110,714), left peak (373,451), curved minimum near (682,676),
   right peak (1008,309), right endpoint (1469,629). Follow the visible curved
   section; do not replace it with a parabola. Full waypoints are in
   [operator-actions.json](operator-actions.json).
4. Click **Read my trace**. Compare the orange line against the photo. Point out
   both corners, endpoint positions and the off-origin minimum. Check the review
   acknowledgment, then **This matches my sketch**.
5. With native **Other marks**, manually retain the separate photo dot near
   **(x≈0.47,y≈3.03)**. This is a manual transcription of the isolated mark;
   its mathematical role is uncertain. The separate far-right point is the
   unrelated object added in step 1.
6. Click **Save & Grade**, then refresh. Say “The sandbox target is x-squared.
   This different graph correctly receives 0%; the system keeps its shape.”
7. With **Select**, drag the curve slightly, Save & Grade and refresh again.
   Show that the curve is editable while both points stay put. This deliberate
   edit changes its position; it is no longer the original photo location.

For a tight 3-minute slot, prepare the manual review before speaking and explain
that preparation explicitly. Demonstrate import, manual dot placement, native
editing and persistence live. If a refresh loses the unsubmitted photo draft,
use the prepared saved variant or recorded backup; do not imply automatic recovery.

## 2:45–3:15 — Measured preservation

“On this new photo, distance to our approximate visual centerline is about
3.50 source pixels at the 95th percentile in both directions. Both peaks are
within 2.85 pixels of those visual annotations. The native rendering adds less
than 0.001 source pixel of drift to the entered trace.”

“Those are engineering diagnostics from one new photo and uncertain visual
annotations, not general automatic-recognition accuracy. Manual transcription
can still be wrong. The isolated point was placed manually.”

## 3:15–4:15 — Limits, reliability and future work

Use slides 5–6. “Native Select moves whole branches. Local corrections require
delete/retrace. Only submitted native state survives refresh; photo drafts do
not. The existing two-line test also keeps separate branches independent.”

“The recorded backup works with PrairieLearn stopped. Gemini recognition remains
future research, with unresolved permission and billing/quota gates. We would
measure actual drawn geometry before integrating any model.”

Allow up to 45seconds for tab switching/questions. Physical projector readability
and presenter timing need the manual rehearsal; automated replay is not a human
usability study.

## Fallback and safe shutdown

If the primary service fails, switch to the already-open localhost3020 backup.
Say “This is the recorded assisted reconstruction and real submission from our
acceptance run, not live recognition or a newly computed grade.” Show original,
review, native graph, edit, restoration and the downloadable native JSON. The
viewer is independent of PrairieLearn and has embedded assets. The PDF is an
additional static fallback.

Keep the local primary service running before the demo. A plain container stop
left stale PostgreSQL socket entries in this image during testing. To shut down
deliberately, use the tested graceful helper:

```bash
node benchmarks/photo-graphs/multi-method/step-4f/local-runtime.cjs stop
```

It stops PostgreSQL cleanly before Docker. If startup still fails, use the backup
and inspect logs later. Do not delete the database, container or volume on stage.
