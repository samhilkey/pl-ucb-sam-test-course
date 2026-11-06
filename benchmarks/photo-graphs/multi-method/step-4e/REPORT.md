# Step 4E — Gemini prerequisite verification, no inference

**Recommendation: BLOCKED.** The credential configuration passes local checks.
The user now reports the key's project, displayed Free tier and exact-model quota
row. Disabled billing, eligibility, live quota and prospective $0 protection
remain unverified. Both intended photographs
lack an image-specific clearance record for Google's unpaid-service processing.
No inference is authorized by this audit.

Branch: `feat/automatic-photo-recognition-cv`. Frozen demo commit:
`1d9be84f67d1f699249cedbbbf5fcbf26fc1ad0c`; initial audit commit:
`79220cf3ffdb6327d592ff6e945187b46dfe3722`. This follow-up records UI facts received
after the first audit was committed. All changes are confined to this
audit directory. The November 9 assisted demo, environment files, production
code, tests and existing benchmarks remain unchanged.

## Checklist

| Prerequisite | Status | Evidence / unresolved item |
| --- | --- | --- |
| `.env.local` loads; ignored/untracked; no key output/client reference | **VERIFIED** | Node 20.19.6 loaded the user file in an isolated process. Presence-only result is true; only blank `.env.example` is tracked; local index/client checks pass. This does not authenticate or validate the key. |
| Configured key → owning AI Studio project | **VERIFIED — user-reported UI** | User identifies the API key's project as STAR Sketch2Graph. No independent key authentication; numeric project identifier omitted. |
| Displayed project Free tier | **VERIFIED — user-reported UI** | User reports Free tier; this is separately recorded from billing-enabled status. |
| Billing disabled / no active billing account linked | **UNKNOWN** | Those explicit billing states were not supplied; not inferred from a Free label. |
| Displayed exact-model access and RPM/TPM/RPD row | **VERIFIED — user-reported UI** | `gemini-3.5-flash-lite`: RPM 3/15, TPM 3.75k/250k, RPD 8/500. No API access test. |
| Immediate remaining quota | **UNKNOWN** | Conditional used/limit arithmetic is available, but the dashboard time/window and live availability are not verified. |
| Exact two inputs and source provenance | **VERIFIED** | Both original PNG hashes, dimensions and recorded JPEG crops match the frozen Step 4A list. Local use was explicitly approved. |
| real--01 Google unpaid-service clearance | **BLOCKED** | No image-specific third-party submission/rights clearance supplied. |
| real--06 Google unpaid-service clearance | **BLOCKED** | Same blocker, independently recorded for this exact hash. |
| Operator/client/region eligibility under applicable terms | **UNKNOWN** | No current eligibility attestation supplied; not inferred from timezone or dataset availability. |
| Two future requests remain at $0 | **UNKNOWN** | Disabled billing, eligibility and immediate quota remain unresolved. A Free label, budget alert or public price alone is insufficient. |

[user-ui-evidence.json](user-ui-evidence.json) records only the non-sensitive alias
and supplied UI values. Interpreting each fraction as **used / limit** and k as
1,000 gives nominal headroom of **12 RPM, 246,250 input TPM, and 492 RPD**. These
are conditional calculations, not freshly measured available quota. The supplied
8/500 reflects reported project usage, not requests made by this audit.

The Playwright inventory was empty; CUA reported no available browser for the
AI Studio URL. This means no usable account session was available **to this
audit**, not that the user is signed out. `gcloud` is not installed. No login,
key lookup endpoint, credential-store search, account change, key transmission
or authenticated Gemini/Google API request was attempted. No numeric project
identifier, key value, fragment or credential hash was preserved.

## Exact images and permission boundary

| Input | Original PNG SHA-256 | Size | External submission |
| --- | --- | --- | --- |
| real--01-multiple-lines-graph-paper | `ad95e07043f98c8c4772c694401ae5692f996ecc18ed86df90f98d6623d7b701` | 801×529 | BLOCKED |
| real--06-piecewise-graph-paper | `fea59f67b07f33432c8b2974489dc0a600547cc347f20bf46abf75a6d62b5ad6` | 529×420 | BLOCKED |

The unchanged [source manifest](../../automatic-cv/experiment-01/source-attribution.json)
records DrawEduMath source JPEG hashes and crop bounds; both crop records match.
The [official dataset card](https://huggingface.co/datasets/allenai/DrawEduMath/blob/main/README.md)
lists CC BY-NC 4.0 and describes repeated PII removal. The images are public
development cases, not held-out examples. Prior local screening of these same
bytes reported no obvious direct identifiers; this is not formal deidentification
or a new privacy guarantee. No image was uploaded or newly processed by a model.

Local test permission, public availability and attribution are separate from
permission to grant Google's required submission rights. Its applicable
[unpaid-service terms](https://aistudio.google.com/docs/terms#unpaid-services)
describe product-improvement use and possible human review, and exclude sensitive,
confidential or personal submissions. Responsible project/rights clearance is
needed for **each exact image**, including that processing/data use. This audit
records missing clearance; it does not conclude the dataset license categorically
forbids every external use. Eligibility and jurisdiction-specific terms must also
be checked. No substitute image or provider was selected.

## Actions to unblock

Follow [USER-CHECKS.md](USER-CHECKS.md) in AI Studio and provide only redacted text:
confirm explicit billing-disabled/no-active-account status, the quota check
time/window, operator/client/region eligibility, and a permission basis for each
image hash. The supplied project/Free/model facts are now recorded as user UI
evidence; they are not independent API verification. Do not send any key fragment.

The pasted sample `curl` targets `gemini-flash-latest`, a different identifier
from the frozen `gemini-3.5-flash-lite`, and would perform inference. It was not
executed or treated as authorization/access/cost evidence. No full command or
numeric project ID was copied into this package.

If any gate remains unverified, keep the pilot blocked. If all become verified,
the result can become **READY FOR SEPARATE INFERENCE APPROVAL**; it still does not
authorize a call. A future approved run must retain the frozen two-image protocol:
one request per image, max two, sequential, 8,192 output tokens, 120 seconds, no
tools/retries/continuations/paid fallback/substitution, $0 authorized spend, and
image-only separation from references, answers and the demo's manual traces.
Live transport/conversion is not added or tested in Step 4E.

## Validation and evidence

- **11 existing offline tests passed**, zero failed:
  `node --test tests/star-gemini-config.test.cjs tests/star-method-feasibility.test.cjs`.
  They cover ignore/template/env loading, browser exclusion, frozen image-only
  preparation, metadata stripping, hash guards and rejection of live execution.
- [verify-local.cjs](verify-local.cjs) passed with `.env.local` loaded into a
  short-lived process. It uses no HTTP/SDK and emits only safe metadata/booleans.
  [local-checks.json](local-checks.json), [offline-tests.log](offline-tests.log)
  and [verification.json](verification.json) preserve results.
- [audit.json](audit.json) holds explicit statuses/nulls and zero-call accounting.
  [public-sources.json](public-sources.json) records fresh public-document URLs
  and hashes. Google's markdown failed in the web fetcher; a public-only HTTP
  read succeeded without cookies or authentication. Public sources support the
  checklist instructions, not project-specific claims.
- JSON/links/syntax/diff, staged credential checks and frozen-demo preservation
  were reviewed; [evidence-manifest.json](evidence-manifest.json) records hashes.

**Zero** model/authenticated-provider requests, photograph uploads, billing
changes, tier upgrades or provider switches. Incurred inference cost is $0
because there were no calls; future cost/usage are unknown, not assumed free.
The local commit and clean tree are verified after committing. No push or merge.
Stop after Step 4E. The frozen November 9 assisted demonstration has no dependency
on resolving these Gemini blockers.
