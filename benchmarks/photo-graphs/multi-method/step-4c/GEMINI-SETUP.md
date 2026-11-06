# Optional Gemini setup — offline preparation only

This guide does not enable Gemini in the demo. Step 4C makes **no inference
request, authenticated provider request, photograph upload or billing change**.
The existing [Step 4B prerequisite record](../step-4b/prerequisites.json) remains
blocked. Local use of the two photographs is approved; permission to send them
to Google under unpaid-service terms is still unverified.

## Create and configure a key yourself

1. Open [Google AI Studio API keys](https://aistudio.google.com/apikey), sign in
   with your intended account, and review the terms yourself. In the dashboard,
   select the intended project. An existing project may need importing in
   **Dashboard → Projects → Import projects**. Select **Create API key** for
   that project. Do not paste the key into chat or a repository file.
2. Follow Google's [API key guide](https://aistudio.google.com/docs/api-key).
   Current documentation says new keys are authorization keys restricted to
   the Generative Language API. If the project lacks permissions or requires
   verification, stop and resolve that with its owner; do not use a different
   account/project implicitly.
3. In **Projects**, verify this exact key's project shows **Free**, has no linked
   active billing account, and is eligible for the exact
   `gemini-3.5-flash-lite` model. Some free projects need verification. Do not
   select **Set up billing**, add payment details, prepay or buy credits.
   [Billing documentation](https://aistudio.google.com/docs/billing) describes
   the distinction; public model pricing does not establish this project's tier.
4. Inspect [active rate limits](https://aistudio.google.com/rate-limit) and
   [usage](https://aistudio.google.com/usage) for that project and model.
   Record current remaining RPM, input TPM and daily requests, time of check,
   and capacity for two sequential requests with up to 8,192 output tokens
   each. Limits apply per project; another key does not create fresh quota.
   See [quota documentation](https://aistudio.google.com/docs/rate-limits).

In a local **zsh** terminal, use hidden input rather than typing a secret into a
shell command that would be stored in history:

```zsh
read -rs 'GEMINI_API_KEY?Gemini API key (hidden): '
printf '\n'
export GEMINI_API_KEY
node benchmarks/photo-graphs/multi-method/step-4c/check-gemini-env.cjs
```

The checker prints only presence, an explicit disabled-inference flag, and its
scope. It does not open files, make network calls, validate a key, check billing,
or test model access. An absent key is informational and does not block the
assisted demo. Do not run `echo`, `printenv`, tracing/debug output or environment
dumps on the credential. Do not put it in `.env`, source, logs, screenshots or
committed shell files. Exporting in a separate terminal does not change the
environment of an already-running Codex process. Only an explicitly approved
future runner launched in that same environment should inherit it. Use
`unset GEMINI_API_KEY` when finished.

## Which scripts use the credential

- [check-gemini-env.cjs](check-gemini-env.cjs) inspects only environment presence.
- [Step 4A preflight](../step-4a/preflight.cjs) prepares/audits image-only payloads
  offline. It does **not** read this credential or send requests.
- Step 4B currently contains a prerequisite audit and offline request hashes,
  **no live transport or provider-to-geometry converter**. Those still require
  implementation and review in an approved resumption. No existing demo script
  sends Gemini requests. Do not use an unrelated branch's runner or a paid
  default provider.

## Exact gates before resuming Step 4B

All gates must be documented and rechecked immediately before any call:

1. **Fresh user approval** to resume Step 4B after Step 4C. Keep the frozen
   [protocol](../step-4a/protocol.json), prompt, schema and input hashes unchanged.
   The scope is one image-only request per selected image, at most two total,
   sequential, 120-second timeout, 8,192 maximum output tokens. No retries,
   continuations, tools, model/provider/image substitutions or paid fallbacks.
2. **Account eligibility and $0 exposure:** bind the credential to the verified
   project without exposing its value; confirm operator/client/region
   eligibility under current terms and the frozen protocol, exact model access,
   unbilled Free tier, disabled billing, and enough current quota. Stop on any
   uncertainty. A spending budget alert is not a hard $0 gate. No billing may be
   enabled to unblock this pilot. Public free pricing and key presence alone
   are insufficient.
3. **Separate image-specific permission:** the responsible rights/permission
   holder must clear each exact hash for Google's unpaid-service processing
   and required content license, including possible product improvement and
   human review. Screen the actual crop for identifiable, personal,
   confidential or otherwise uncleared material. Record the authorization's
   basis and authority. Public availability, CC BY-NC 4.0 attribution, dataset
   PII screening and approval for local testing do not by themselves complete
   this project-specific clearance. If either image is uncleared, stop without
   replacing it. Recheck [Google's terms](https://aistudio.google.com/docs/terms),
   including any jurisdiction-specific provisions; this guide grants no rights.
4. **Image-only isolation:** audit exact payload/hash and metadata stripping.
   Send no reference annotations, expected equations, grading answers, manual
   traces, Step 4C operator actions or native geometry. These new assisted
   artifacts must stay outside inference. Keep evaluators separate.

| Exact selected image | Original PNG SHA-256 | Google unpaid-service clearance |
| --- | --- | --- |
| real--01 | `ad95e07043f98c8c4772c694401ae5692f996ecc18ed86df90f98d6623d7b701` | Unverified |
| real--06 | `fea59f67b07f33432c8b2974489dc0a600547cc347f20bf46abf75a6d62b5ad6` | Unverified |

Google's unpaid terms describe use of submissions/responses to improve its
products and possible human review, and prohibit sensitive, confidential or
personal submissions. Read the full terms for applicable exceptions and
eligibility. Public documentation was read on 2026-11-05; retrieval URLs and
hashes are recorded in [gemini-public-sources.json](gemini-public-sources.json).
The web fetcher rejected the markdown content type, so public-document-only
HTTP reads supplied these sources. No account dashboard was accessed.

Current readiness is **guide/check prepared; inference blocked**. Credential
presence is recorded separately in results; account model access, free-tier
eligibility, remaining quota and prospective $0 exposure remain unknown. The
assisted workflow has no dependency on any of these prerequisites.
