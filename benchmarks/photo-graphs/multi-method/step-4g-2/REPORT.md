# Step 4G-2 v1 — Cleared image frozen; inference blocked at account prerequisites

**No Gemini request or image upload occurred.** This is a prerequisite
checkpoint, not a completed recognition experiment. The user has approved the
pilot and explicitly cleared the sole exact image below. Those approvals need
not be requested again. Fresh user-reported STAR project/model UI observations
and eligibility are now recorded. **Current remaining quota is still unknown.**

## Verified and pending gates

| Prerequisite | Status | Evidence |
|---|---|---|
| Secure credential configuration | VERIFIED | Node `--env-file=.env.local` presence check succeeded; Git ignores the file. No value, fragment or credential hash was displayed or retained. |
| Key/project binding, Free tier and no paid exposure | USER-CONFIRMED | User explicitly confirms the configured key belongs to STAR Sketch2Graph Free-tier project without paid billing exposure. No authenticated independent audit. |
| Exact image identity and transmission permission | VERIFIED | [Manifest](inputs.json), [permission record](permissions.json), and byte-identical prepared-image hash in [offline preflight](offline-preflight.json). |
| Public model capabilities | VERIFIED | Official model page lists `gemini-3.5-flash-lite`, image input and structured outputs. This is not account access verification. |
| Current project-specific model display row | VERIFIED user observation | STAR project shows Gemini 3.5 Flash Lite in Free tier, checked November 6 around 10:29 AM PST. The official model-name mapping gives the requested API code; direct API acceptance remains untested. |
| Current remaining RPM/input TPM/RPD | UNKNOWN | UI reports **peak usage / limit over Last 28 days**: `0/15`, `0/250000`, `0/500`. Usage page was not checked; these are not live remaining balances. Earlier nonzero figures belonged to another project and are excluded. |
| Operator/client/region eligibility | VERIFIED user attestation | User answered yes to the adult operator, private professional/research client and supported-region question. |

The remaining account information requested is current-day request usage and
current request/token quota status, period and check time from the same
project's [Usage page](https://aistudio.google.com/usage). The latest
[user-provided UI observations](user-ui-evidence.json) preserve the peak window
and the display-name/API-code distinction. If the UI cannot establish available
quota, retain UNKNOWN. Do not run a test prompt, upload
an image, enable billing or share a key/account identifier to obtain it.

The existing [Step 4A protocol](../step-4a/protocol.json) says to verify the adult
operator, eligible client audience and region before upload. The requested
attestation covers an adult operator, a private professional/research client
unavailable to under-18 users, and a supported region. It has now been received;
no repeat attestation is needed. This gate comes from the frozen
protocol and [Google's terms](https://ai.google.dev/gemini-api/terms), not from a
new approval requirement invented for this checkpoint.

## Frozen image and request design

- File: `../step-4g-1/results/IMG_1670--source.png`, 1688 × 1473.
- SHA-256: `9c8247ec0be7d4ca68c4536eea990a0c5b0fce6250e8478a13b5aa5a0e190231`.
- Provenance: user owns the paper drawing and photograph; the exact PNG is the
  metadata-free browser decode used for Step 4G-1's CV attempt. The user
  explicitly confirms that it has no identifying, confidential or uncleared
  material and authorizes this file's transmission to Google's unpaid Gemini
  API for this bounded experiment. No other photograph is cleared.
- Prepared bytes have the **same hash**. No resize, crop, re-encoding or further
  metadata transformation changes the cleared file. Only IHDR/IDAT/IEND PNG
  chunk types are present. The original JPEG is not an authorized substitute.

The one-image design stays within the approved at-most-two request cap; its
frozen maximum is **one request**, not two attempts at the same image. It reuses
the exact Step 4A prompt and observation schema, unchanged, with 8,192 maximum
output tokens, 120-second timeout, no tools, retries, continuations, other
models or paid fallback, and a $0 spending limit. Model:
`gemini-3.5-flash-lite`. The payload contains only generic instructions/schema,
dimensions and the cleared image, without its filename, local identity, SHA,
annotations, calibrated coordinates, equations or grading answers.

The prepared request hash is
`0cd99ad83965bfb96f8b8254e25fe99ea132c5b22eb39a3f944f1a5d6b75ac2c`
(3,417,740 bytes). This is a **local construction hash**, not a transmission
record. `store:false` is retained; it does not override unpaid-service data-use
terms. See [protocol](protocol.json) and [public sources](public-sources.json).

`preflight.cjs` deliberately has no credential lookup or live transport and
rejects `--execute`. It reuses Step 4A's payload builder. No live parser,
converter, UI integration or production code was added after the prerequisite
blocker was identified. These remain work within the already approved pilot
once its gates are satisfied, not evidence of a completed experiment.

## Comparison and unexecuted validation

The aggregate CV baseline is 0/3 automatic successes. Only IMG_1670 is eligible
for a paired Gemini comparison in this cleared one-image pilot: CV returned 44
paths for one reference branch, 40 wholly spurious paths, 53.94% reference
coverage within 3px, p95 distances 11.69/382.51px, uncertain calibration, and no
native import. This is reused Step 4G-1 evidence, not a new CV run.

The successful manually assisted reconstruction remains a separate result:
approximately 3.50/3.49px bidirectional p95, 100% coverage within 5px, with
manual calibration, tracing and separate native point placement. It is not an
automatic benchmark success.

[Evaluation policy](evaluation-policy.json) pins the withheld approximate visual
reference, exact CV prediction/evaluation and manual comparison by SHA. Those
files are never read by the request preflight. Existing 3px coverage and the
Step 4A engineering screen are retained. Independent numeric calibration truth
is unavailable, so a future response cannot earn a measured calibration-
accuracy pass from these annotations alone.

Gemini predictions, topology, axes/ticks/scale, dots, geometry distances,
missing/invented strokes, uncertainty, latency, usage, Photo Geometry v1
conversion, native import and isolated UI compatibility are **not evaluated**.
No synthetic prediction, repaired JSON, mock-model result or overlay was
substituted. There is no basis to claim Gemini improves geometry or structure.

Actual inference requests: **0**. Authenticated provider requests: **0**.
Photograph uploads: **0**. Confirmed incurred inference cost: **$0**, solely
because no requests occurred. Provider-reported cost and usage are null.

## Offline verification and next action

Run:

```sh
node benchmarks/photo-graphs/multi-method/step-4g-2/preflight.cjs
node --test tests/star-gemini-pilot.test.cjs
```

The complete relevant offline regression command and counts are recorded in
[verification.json](verification.json); [offline-tests.log](offline-tests.log)
contains the results. New tests block all network entry points and evaluator
reads during request preparation, enforce the exact single cleared hash,
reject missing/substituted/additional images, keep CLI live execution disabled
and check that a sentinel credential is never printed. Existing recognition,
geometry, native, assisted, fitting, provider-boundary, credential and backup
regressions are preserved. The PrairieLearn implementation and Step 4F package
remain unchanged from `8eefbf996816ad1074a6f443835e05bf0b1c0c0d`.

**Recommendation: finish the outstanding account checks, then resume this same
one-image pilot.** Image clearance and experiment approval are already granted;
do not ask for them again or substitute another image. Do not run a diagnostic
inference to discover quota. If the gates cannot be established, keep inference
blocked and use the tested assisted route for November 9. Current evidence does
not justify VLM integration or a hybrid implementation. No next phase begins
from this checkpoint.
