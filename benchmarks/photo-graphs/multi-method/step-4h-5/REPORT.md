# Step 4H-5 — adaptive native curve representation

**CONDITIONAL PASS for local, CV-assisted native curve editing on IMG_1678.**
The measured real photograph produces two actual native spline sections and
three protected native polylines. Long arms are smoother; the irregular middle
and terminal hook remain visible and editable. This is a bounded representation
improvement, not successful fully automatic calibration or general recognition.

The new local question is separate from the unchanged H4 polyline demo and frozen
F manual fallback. Nothing was pushed, merged, deployed, or sent to Gemini.

## Observed real-photo behavior

Input: the user-owned, existing development photograph `IMG_1678.jpg`, SHA-256
`f86a0acd1dc1fcad32884c202e4fffe44adc5d88c1062a0f8a2cbd60dbc74d49`.
The original JPEG stays local; committed overlays use the earlier metadata-free
PNG `step-4h-2/inputs/IMG_1678--source.png`, SHA-256
`bc1a75a4f46e0ebc43d43cfb26942d15306a69cc25530ae57309bd3f1a8dd9d9`.
This is not a new held-out recognition case.

| Outcome | Actual result |
|---|---|
| Photo visible on the native canvas | Yes, same source photograph throughout |
| CV-measured candidate | Yes; no equation, reference, trace, or target in recognition options |
| Automatic numeric calibration | No; three axis clicks and two written tick values still required |
| Manual tracing / endpoint selection for extraction | None |
| Provisional review | Actual spline approximation shown; native answer unchanged until acceptance |
| Native state | Two spline objects (8 anchors each), three polylines (3, 15, 2 vertices) |
| Handles | **43 → 36**, a **16.3% reduction**, counting shared endpoints on both objects |
| Branch continuity | One measured branch; five native pieces meet with **zero native-pixel gaps** |
| Original trace recovery | All 43 original measured vertices, one polyline, no spline or duplicate objects |
| Individual spline-anchor dragging | One anchor moves; other anchors, protected polylines and existing point stay fixed |
| Undo / Redo | Actual native anchor edit reversed and restored |
| Save & Grade / refresh | Valid native state submitted and restored, including the spline edit |
| Uncorrected grade | **0%**, retaining the measured non-function hook |
| Student endpoint correction | Drag original hook endpoint 12 native pixels right; **100%** after explicit student edits, with Save & Grade and refresh passing |

## Measured fidelity

`evaluate.cjs` evaluates **actual Chrome SVG path samples** from native tools,
not just a fitted mathematical proposal. Sampling is at most 0.5 native pixels of
arc length. Distances are in original source pixels. The retained 43-vertex CV
centerline is the reference for this comparison; it is **not an independent
blinded annotation** of the photograph.

| Representation | p95 drift | Maximum drift | Handles |
|---|---:|---:|---:|
| Original measured polyline | 0 by definition | 0 by definition | 43 |
| Adaptive rendered native pieces | **2.79 px** bidirectional | **4.03 px** | 36 |

Source-to-rendered p95 is 2.80 px; rendered-to-source p95 is 2.75 px. Actual SVG
endpoint sampling differs by less than 0.00004 source pixels; original endpoint
coordinates remain in native state. The measured hook, vertex, extrema and
protected sharp turns retain their source positions (round-trip error below
1e-9 source pixels for their anchors). The two spline spans have worst p95
3.30 px and maximum 4.03 px. `results/fidelity.json` gives per-part/per-branch
directional distances, landmarks, handle counts, joins and endpoint errors.

No additional direction changes above **0.01 native pixels** are accepted in
the smooth spans. This is the installed renderer's coordinate precision;
subprecision rounding ripples are not counted as significant extrema. This is
not a claim of mathematically zero interpolation artifacts. Important extrema
and corners remain protected polyline regions. The unchanged original trace
is retained in proposal provenance and available before native editing.

The 36 handles include four duplicated join positions. This is a modest
improvement, not a low-handle ideal parabola. Conservative protection keeps the
middle jagged rather than flattening ambiguous marks. Pixel ink support, missing
strokes, isolated-dot semantics and overall recognition accuracy are not
re-established by a small representation-drift score.

## Other real-paper representation replays

These use the **previously recorded manual traces and calibration**, with actual
native rendering in Chrome. They test representation safety, not automatic
recognition or new Save & Grade success on question-incompatible photos.

| Case | Retained source | Native result |
|---|---|---|
| `real--06-piecewise-graph-paper` | One branch, 7 manual-trace vertices | One 7-vertex polyline; sharp peak preserved |
| `real--01-multiple-lines-graph-paper` | Two disconnected branches, 13 manual-trace vertices | One spline plus one original polyline; 10 handles; branches remain separate |

The second photo has no numeric labels. Its old operator-assigned demo units
are **not recovered student units**. Each case has original-trace and actual
native overlays, native state, gradeable data, source hashes and calibration
provenance. Separate controlled tests cover independent reviewed points, dense
straight-line-to-polyline selection and duplicate-free representation changes.
The real IMG_1678 CV route does not establish isolated-point recognition; its
previously existing annotation point is preserved.

## Implementation and grading

`star-adaptive-geometry.js` uses measured pixels and calibrated native coordinates.
Turns at least 35 degrees, explicit corners and significant local/global extrema
protect adjacent source edges. A straight measured stroke within one source
pixel of its endpoint segment uses a polyline. Other unprotected spans undergo
ordered anchor reduction with renderer-aware error and topology gates. No x
sorting, equation fitting, answer lookup, endpoint trimming or gap invention is
used. Failed/low-benefit smoothing retains the original measured polyline.

The fitting kernel is extracted from the installed SketchResponse **0.2.1**
source map (`freeform/fitcurve.js`, source SHA-256
`95e3e8a7080b8a752c6798584e6f44facb311d6b001112fdc01993dbcf1c5777`).
Its public-domain Graphics Gems attribution is retained. Only the module wrapper
and comment trailing whitespace change; executable fitting code is unchanged.
Native spline fitting uses tolerance zero and rounds controls and
shared anchors to 0.01 native pixels. Candidates are evaluated using that exact
behavior; the browser test compares actual native SVG path data byte-for-byte
with the audited renderer prediction. A SketchResponse upgrade needs this check
rerun before relying on the approximation.

`star-adaptive-native.js` reuses existing Photo Geometry validation and native
tool checks, explicit confirmation, revision/token guards, stale-state rejection
and rollback. Style changes replace only this session's **unchanged owned draft**.
Any intervening native edit blocks replacement. Separate branches and reviewed
points are retained without duplicating existing objects. After refresh, native
objects restore, but replacement ownership is deliberately not guessed.

Only the experimental question opts into `adaptive-photo-spline-tool`. The
server independently reconstructs spline gradeable controls from raw submitted
native anchors through a bounded local Node bridge (5-second timeout, size and
finite-coordinate checks, no network). It grades complementary spline/polyline
parts as one function-domain union. It does not trust a client-supplied ideal
gradeable curve. Python tests prove correct complementary parts grade 100%, a
changed spline anchor grades 0%, and corrupt coordinates fail closed. Existing
non-opted-in grading remains unchanged. Native raw state and per-tool submission
evidence are preserved.

## Verification, failures and limitations

Commands, counts, environment and logs: `results/verification.json` and
`results/logs/`. Files: `results/FILE-INVENTORY.txt`. Browser tooling uses the
installed Playwright CLI because the Browser plugin/skill is unavailable.
The final runs pass **159 Node tests, 13 Python server tests and 331 browser
assertions**: 33 adaptive real-photo, 6 real-paper representation replay, 43 H4
polyline, 84 frozen manual and 165 native adapter checks. No failed check is
included in those counts.

Testing found and fixed a real readonly-feedback error: editable-only spline
grading was installed on submission/solution canvases. A focused readonly
regression now prevents that. Replay sampling initially ran before native paint;
the harness now waits for animation frames. An early straight-line test used
already simplified two-point input; it now explicitly tests dense measured
anchors. None of these failures is counted as a passing result.

Native SVG hit circles are declared with radius 8, with actual targeting also
affected by native styling and z-order. Around the tiny hook, overlapping
polyline/spline handles can select the wrong vertex or entire section. The
rehearsal verifies the actual endpoint target and uses its exposed hit area.
Earlier attempts grabbed the adjacent spline or missed the handle, so the
endpoint-correction check was rerun rather than claimed passed. This is a native
selection limitation, not automatically corrected geometry. Dense touch editing
and physical projector readability remain unverified. Editing a shared join on
one object can separate it from its neighbor; joins are initially coincident,
not permanently welded. No hidden propagation of student edits is introduced.

Chrome desktop, 1280×720 presentation viewport and 390px mobile layout are tested.
The physical projector, Safari/Firefox and a new blind photo set are not tested.
Photos remain local tab-scoped references; only accepted native drawings grade.
Spline anchors too close to represent at native precision are rejected rather
than silently collapsed.

## November 9 decision and stopping point

The demo is today. Keep the **H4 polyline question and F manual/recorded backup**
as the dependable rehearsal routes. The new experimental URL is available for
review, with the modest handle reduction and remaining calibration/selection
limitations disclosed. Do not promote it as general automatic recognition or
replace the frozen demo without user review. Further recognition research or
Gemini schema/inference work needs a separate approved step. No new inference
request, model switch, billing change or external photo upload occurred.

See `PRESENTER.md` for exact URLs, clicks, source file and fallback instructions.
