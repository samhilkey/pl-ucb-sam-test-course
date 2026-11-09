# Server semantic provider — dormant, not deployed

Step 4H-4 update: one separately approved request for the exact metadata-free
IMG_1678 PNG was executed and consumed. Google returned HTTP 400 for excessive
schema constraint complexity; no semantic prediction was produced or used. The
module also supports a separately bound `4H-4-semantic` grant with its fixed
`step-4h-4/results/provider` journal. Neither journal may be deleted or reused to
retry. A changed schema/payload requires fresh approval. The local student UI
remains CV-assisted and makes no Gemini requests. See
`benchmarks/photo-graphs/multi-method/step-4h-4/REPORT.md` for actual evidence.

The original Step 4H-3 design notes follow; they describe the pre-execution state.

`star-gemini-semantic.cjs` is a server-side module, not a public HTTP proxy or a
browser dependency. The normal PrairieLearn upload still runs **CV only**. No
automatic Gemini call has been added to it. `info.json` does not load this module
or `star-hybrid.js`. No new API request is authorized by this implementation.

The boundary is executable offline with `node --test
tests/star-semantic-provider.test.cjs`. Mock outputs are labeled `test_fixture`;
they cannot be counted as Gemini recognition. No credential is needed for these
tests.

## Future, separately approved invocation

1. Freeze an exact metadata-free PNG and its SHA-256, size and photo revision.
   Obtain explicit unpaid-service transmission clearance for **those bytes**.
   The original IMG_1678 JPEG and its metadata-free PNG are different files; no
   external-use permission for either is recorded in Step 4H-3.
2. Call `prepare(manifest)` offline. It returns the exact request bytes and hashes
   of image, generic prompt, Step 4H semantic schema and payload. It rejects
   metadata changes, extra inputs and oversized rasters. No reference, equation,
   selected coordinates, traces or question config enters the payload.
3. Obtain fresh approval for one request matching that payload and image, plus
   current project/model access, operator eligibility, unpaid data terms and
   confirmed unbilled Free-tier exposure. Instantaneous quota may remain unknown
   when explicitly accepted. No promise of available capacity is made.
4. A **trusted server operator**, never a browser request, supplies a grant with:
   `phase: "4H-3-semantic"`, `explicit_inference_approval`,
   `exact_image_external_permission`, `owner_or_authorized`,
   `no_identifying_confidential_or_uncleared_material`,
   `unpaid_data_terms_accepted`, `operator_eligibility_confirmed`,
   `model_access_confirmed`, `quota_unknown_accepted` all true;
   `project_alias: "STAR Sketch2Graph"`, `billing_tier: "Free"`,
   `paid_billing_exposure: false`, `maximum_requests: 1`, `retries: 0`,
   the exact model/image/request hashes, and `checked_at`/`expires_at` no more
   than 24 hours apart. This is a local audit binding, not independent proof of
   account settings or a new permission grant.
5. The user creates the ignored `.env.local`. On this Mac's Node 20.19.6 use
   `node --env-file=.env.local <separately-reviewed-server-entrypoint>`.
   The key stays in server memory and the `x-goog-api-key` header; never put it
   in JavaScript served to the browser, source, shell arguments or artifacts.
   No execution entrypoint or approved live grant is shipped in this step.
6. `recognizeOnce` requires the fixed live journal directory
   `benchmarks/photo-graphs/multi-method/step-4h-3/results/provider` and reserves
   `attempt.json` exclusively and durably before one HTTPS POST. Never delete
   this journal to retry. Transport failure, timeout, access/quota error,
   incomplete output or invalid JSON consumes the attempt. No redirects, retries,
   polling, continuation, model switch, billing changes or paid fallback exist.
7. Save redacted raw output, reported usage, latency and validated coarse semantic
   envelope. Token counts are not reported monetary charges; cost stays unknown
   unless independently confirmed. HTTP/schema validity is not geometry fidelity.
8. `ground(manifest, envelope)` recomputes CV on the exact local PNG. Coarse boxes
   classify whole measured paths and compact isolated components; they never
   supply dense coordinates. Existing numeric CV evidence must establish the
   frame. Missing calibration, ambiguous crossings/boxes, missing points,
   unsupported observations and contradictory ticks remain blockers. There is
   no new OCR, local junction disambiguation or gap reconstruction in this step.
9. A successful inspection can be reviewed with `StarHybrid.reviewed`. Its
   provenance distinguishes real provider responses from fixtures and remains
   `needs_review`, `automatically_recognized: false` until explicit acceptance.
   Native import additionally requires the existing experimental and assisted
   opt-ins, unchanged native base state, current revision and the ordinary
   function/bounds/tool checks. These opt-ins remain **off** in the normal UI.

This implements a tested transport/grounding boundary, **not live Gemini UI
integration**. Connecting a server route to the student upload, live schema
compatibility, recognition fidelity and real-photo native success remain
incomplete. Do not authorize another call merely to work around the terminal
hook; the current function-input contract would still reject that geometry.
