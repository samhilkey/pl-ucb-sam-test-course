# One review UI, interchangeable candidate suppliers

Only local CV is enabled. `StarProviders.recognize(rgba, {inputRevision})`
delegates to the existing `StarRecognition` pipeline. It receives neither the
PrairieLearn configuration nor an equation, reference, manual calibration or
selected point. The UI awaits the result, checks the revision before touching
current UI state, and sends validated geometry to the existing `StarNative`
session. Student acknowledgment is required before the one-use commit.

`StarProviders.candidate(geometry, {provider, inputRevision, width, height})`
is the shared **offline validation boundary**, not an inference transport.
It checks Photo Geometry v1, the source image dimensions and revision. It
returns `{geometry, method, marks}`. Method labels are `CV automatic`,
`VLM automatic` and `hybrid automatic`; the separate existing assisted route
is labelled `manually assisted`. `recognize(..., {provider: 'gemini'})` and
`hybrid` currently throw; no request, SDK, endpoint or retry loop exists.

Small components already rejected by CV remain visible as purple boxes. A
component outside the detected axis-intersection box adds a warning and
assistance requirement and prevents automatic import. An intersection residue
is shown and disclosed too, but is not claimed as an independently detected
point. This is a diagnostic, not a point classifier. The v1 native curve
adapter does not support importing isolated dots, open/closed endpoint styles,
arrowheads, colors or uncertain mark semantics. Any future provider must
explicitly mark unsupported observations as unresolved; it must not silently
drop them to obtain `automatic` status. A dot coincident with an axis still
requires careful student review; general dot recognition is not solved.

## Future Gemini transport (design only, requires separate approval)

1. A server-side experimental runner loads its credential using Node 20's
   `node --env-file=.env.local <approved-runner.cjs>`. The file stays ignored.
   Never supply the credential to `pl-sketch` client configuration, element
   scripts, submission state, URLs, artifacts or logs. Do not add a public
   browser endpoint that accepts or exposes an API key.
2. Send only the separately cleared photo and the frozen image-only protocol.
   Keep evaluator references, question answers, prior traces and calibration
   separate. Pin the model, request budget and request count. No automatic
   retries, model fallback or provider switching. Save redacted usage/latency
   and the actual response before evaluation.
3. Convert observations into Photo Geometry v1 on the server, preserving pixel
   order, distinct components, endpoints, corners, gaps and uncertainty. A
   schema-valid JSON response is not evidence of recognition accuracy. Unknown
   photo scale stays uncertain with null graph coordinates. Unsupported marks
   remain blocking observations. No equation fitting or answer-conditioned
   reconstruction.
4. Return a credential-free candidate associated with the exact image bytes,
   dimensions and input revision to this same review UI. Run `candidate` and
   the unchanged native adapter. Guard delayed responses, replacement photos,
   changed native drawings and explicit confirmation exactly as for CV.
5. Evaluate withheld photo fidelity/topology before enabling any student-facing
   provider. Existing native bounds, editable-tool and ambiguity guards remain.

No server transport or Gemini-to-v1 converter was implemented in Step 4G-1.
There is no current Gemini inference script to invoke. See the historical
[setup guide](../step-4c/GEMINI-SETUP.md) and [Step 4E audit](../step-4e/REPORT.md).

## Gates for a later experiment

The user's Step 4G-1 request confirms that the configured key belongs to the
STAR Sketch2Graph Free-tier project without paid billing exposure. This is a
user attestation; this step made no authenticated check. Current access to the
previously proposed `gemini-3.5-flash-lite`, remaining project quota and the
applicable service terms must be checked at
the time of a separately approved experiment. No account identifiers or key
material are retained here.

Local use is authorized for IMG_1670 and the two DrawEduMath photographs.
Permission to send **each exact image** under Google's unpaid-service data-use
terms remains **uncleared**, including for a publicly licensed photograph.
Local-use permission does not clear external transmission. No substitute
photos, billing changes or inference requests are authorized by this step.
Separate image clearance and explicit inference approval remain mandatory.
