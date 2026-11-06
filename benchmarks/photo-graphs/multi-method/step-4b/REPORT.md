# Step 4B — Gemini pilot blocked at prerequisites

**No Gemini request or image upload occurred.** The user approved the two-image
pilot subject to verified prerequisites. That execution approval is recorded;
it is not the blocker. The prerequisite check could not establish account-level
free-tier eligibility, remaining quota, prospective $0 billing exposure, or
terms-compatible image clearance. The user explicitly required stopping in this
situation. This is a blocked experiment, not a completed recognition comparison.

Branch: `feat/automatic-photo-recognition-cv`. Starting commit:
`b12b9989de6c46155bc75b82fb3305e2cc359b58`. No contrast-only experiment was repeated.

## What was verified

| Check | Obtained evidence | Outcome |
| --- | --- | --- |
| Exact model | Fresh official `gemini-3.5-flash-lite` page lists the stable model, image input, text output and structured outputs. | Public listing verified; account access unknown. |
| Advertised pricing | Fresh Standard pricing table lists free input/output; a distinct paid tier also exists. | Public free tier verified; this account/project tier unknown. |
| Runtime credentials | Checked presence only for `GEMINI_API_KEY` and `GOOGLE_API_KEY`. Both absent. | No usable environment credential. No values, `.env`, password store or credential file read. |
| Account/billing/quota | No `gcloud` CLI; browser inventory returned no connected browser session. No project dashboard or authenticated account metadata verified. | Remaining RPM/TPM/RPD and disabled billing unknown. Native Chrome being open does not establish account access or sign-in status. |
| Exact inputs and protocol | Both original image hashes and dimensions verified; prompt/schema/protocol unchanged. Locally reconstructed request hashes exactly match Step 4A. | Frozen input identity verified, no substitute images. |
| Visual screening | Locally inspected both exact graph crops; no obvious names, faces or contact details visible. Dataset card describes repeated PII-removal review. | Helpful screening evidence, not formal deidentification or third-party transmission clearance. |
| Image-use authorization | Dataset mirror lists CC BY-NC 4.0. Existing project records do not establish authorization for each image under Google's unpaid-service submission/data-use terms. | Both images remain unverified for this run. |

Official sources were retrieved afresh as public documentation only:
[model](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite),
[pricing](https://aistudio.google.com/docs/pricing#gemini-3.5-flash-lite),
[project-specific rate limits](https://aistudio.google.com/docs/rate-limits),
[Google terms](https://aistudio.google.com/docs/terms), and the
[official dataset card](https://huggingface.co/datasets/allenai/DrawEduMath/blob/main/README.md).
The browser/web fetcher rejected Google's markdown content type; a public
documentation-only HTTP read succeeded. Retrieval URLs, content hashes and
findings are saved in [public-sources.json](public-sources.json).

Google's unpaid-service terms permit product-improvement use and human review of
submitted content, and exclude sensitive, confidential or personal information.
They also impose operator/client/region eligibility requirements. The dataset's
published license and PII-removal description do not themselves establish that
the project can grant the rights needed for this particular third-party use.
This report does not conclude that transmission is forbidden; it records that
permission was **not verified**, as required by the user's stop rule.

## Exact blocked cases

| Case | Dimensions | SHA-256 | Request state |
| --- | --- | --- | --- |
| `real--01-multiple-lines-graph-paper` | 801 × 529 | `ad95e07043f98c8c4772c694401ae5692f996ecc18ed86df90f98d6623d7b701` | Blocked before request; clearance unverified. |
| `real--06-piecewise-graph-paper` | 529 × 420 | `fea59f67b07f33432c8b2974489dc0a600547cc347f20bf46abf75a6d62b5ad6` | Blocked before request; clearance unverified. |

The authorized budget remains at most **two** requests, one per case, 8,192
maximum output tokens each, sequential, 120-second timeout, no tools, retries,
automatic continuations, paid fallback or model/image substitution. **Zero of
those requests were attempted.** No authenticated provider/model API was called.
Only generic frozen prompt/schema, dimensions and metadata-free pixels were
prepared locally; references, equations, answers and manual traces did not enter
that preparation. The frozen request hashes match Step 4A exactly.

[prerequisites.json](prerequisites.json) records the user approval separately from
the three blocking categories, both image records and budget/accounting state.
[offline-payload-audit.json](offline-payload-audit.json) records local identity
checks. Its prepared PNG hashes do **not** indicate transmission.

## Recognition, comparison and cost

There is no response to validate or convert into Photo Geometry v1. Gemini
branches, topology, axes, scales, corner/endpoint preservation, missing/invented
geometry, distances, coverage, uncertainty, latency, usage and provider-reported
cost are **not evaluated / null**. No prediction, repaired geometry, mock response
or Gemini overlay was fabricated. No live transport/converter was added after
the hard stop; that work remains necessary if this experiment is resumed.

The observed CV baseline remains: real--01 abstains with zero paths; real--06
returns four paths and approximately 2.0% reference coverage at 3px. Contrast-01
did not resolve either graph. The paired [comparison record](comparison.json)
retains these existing CV results beside explicitly unexecuted Gemini rows,
with no invented comparative score. Gemini's pixel fidelity and structural
understanding are both unknown; this run establishes neither improvement nor
inferiority.

Confirmed incurred inference cost for **this attempt is $0 because no requests
occurred**. Provider-reported cost/usage remain null, and prospective request
billing exposure remains unverified. A zero request count does not prove that a
later request using an unknown project would be free.

## Validation and review

Ran the existing relevant offline suite:

```bash
node --test tests/star-method-feasibility.test.cjs tests/star-recognition.test.cjs tests/star-geometry.test.cjs tests/star-native.test.cjs tests/star-fit-branches.cjs tests/star-fit-coverage.cjs
git diff --check
```

**71 tests passed, zero failed.** [node-tests.log](node-tests.log) includes the
network-blocked image-only preflight and geometry/native/fitting regressions.
The offline payload audit additionally verifies both frozen request hashes.
Structured evidence was checked for zero request/upload counts, null unavailable
results, unchanged hashes, valid JSON, intact local links and credential-shaped
strings. [verification.json](verification.json) and
[evidence-manifest.json](evidence-manifest.json) preserve the checks and file hashes.
No new tests were added for documentation-only changes.

Self-review: execution approval is not reported as missing; image permission is
unverified rather than asserted denied; public pricing is separate from account
eligibility; absent Gemini predictions are not scored as zero coverage or false
recognition; zero incurred cost is separate from unknown future billing exposure.
No production workflow, prior benchmark, branch history or other branch changed.
No browser integration test or independent real-paper demo acceptance is claimed.

## Recommendation and resumption requirements

**Recommend a constrained assisted workflow for the November 9 demo.** Current
automatic CV has failed the two actual photos, contrast normalization did not
resolve them, and Gemini has no measured result. There is no observed evidence
supporting VLM-only integration or VLM-guided CV yet. This is a demo contingency
recommendation, not a conclusion that Gemini recognition failed. Independent
real-paper recognition/correction/native editing/Save & Grade/restoration checks
are still required before claiming the assisted demo is stabilized.

To resume Step 4B with the same images, supply or make available:

1. A credential through the execution environment, never pasted into chat or
   committed; identify its project without exposing the key.
2. Current account evidence that this exact model is eligible on the project's
   unbilled Free tier, billing is disabled, and active remaining quota supports
   the planned requests. No account or billing settings were changed here.
3. An authorized image-use clearance tied to **each exact hash**, covering
   Google's unpaid-service terms, plus operator/client/region eligibility.
   The clearance should identify its authority/basis; a general experiment
   approval is not recorded as a rights determination.

Recheck those facts immediately before any request; retain the existing two-call
cap and frozen protocol. If either image remains uncleared, stop without a
substitution. Given the demo deadline, do not start another contrast comparison,
model comparison or hybrid implementation to fill this gap.

The prerequisite audit is committed locally and stops here. Step 4B inference
remains blocked. Any resumption or next phase requires the user's review.
