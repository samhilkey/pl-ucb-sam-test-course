# Read-only AI Studio checks needed from the project owner

Do not run a prompt, upload an image, test the key, call `generateContent`,
`countTokens`, model listing or an API-key lookup endpoint. Do not enable/link
billing, upgrade tiers, create/rotate a key or change projects to bypass a gate.
Use the existing project's dashboard UI only. Send redacted text, not a raw
export or screenshot containing credentials/account details.

1. **Bind the actual key to a project.** Open
   [AI Studio API keys](https://aistudio.google.com/apikey). Privately identify
   the existing key used in `.env.local` from your creation record/key entry;
   confirm its project. Do not share or expose the key or any key fragment.
   Send a non-sensitive project alias and `configured_key_matches_project: yes`.
   If you cannot establish the match, report UNKNOWN rather than testing it.
   A default project selected elsewhere is not proof of this key's owner.
2. **Tier and billing for that same project.** Open
   [Projects](https://aistudio.google.com/projects). Record its displayed
   **Billing Tier**. Inspect the project's billing status through its linked
   Cloud Billing page/management view, without changing anything. Confirm
   whether an active billing account is linked and whether project billing is
   enabled. Send the alias, displayed tier and yes/no/unknown billing states.
   The frozen pilot requires an eligible **unbilled Free** project. A free AI
   Studio chat session, trial credits or an alert budget does not prove that.
   If billing is enabled, record it and stop; do not change it in this audit.
3. **Exact model access and limits.** In
   [active rate limits](https://aistudio.google.com/rate-limit), select that
   same project and find **`gemini-3.5-flash-lite`** exactly. Record whether
   its row/access is displayed and the RPM, **input TPM**, RPD and any other
   applicable displayed limits. Do not substitute a similarly named model.
   A public model/pricing page does not verify this project's access.
4. **Current quota/usage.** In [Usage](https://aistudio.google.com/usage), keep
   the same project/model and inspect the current quota period. Record remaining
   quota if displayed, or the displayed limits and used amounts separately.
   If calculating a remainder, label it derived and retain the period/timezone.
   Google documents RPD reset at midnight Pacific; minute limits are separate.
   If rolling RPM/TPM or daily usage cannot be established, mark them UNKNOWN.
   Include when you checked. Do not make an API call to measure remaining quota.
5. **Eligibility and $0 configuration.** Review the
   [applicable terms](https://aistudio.google.com/docs/terms) and confirm the
   adult operator, intended client audience and supported region satisfy the
   requirements. Do not send DOB, personal/account identifiers or an address.
   Terms include restrictions on under-18-directed/likely-accessed API clients
   and on unpaid clients made available in EEA/Switzerland/UK. Confirm the
   selected model's free Developer API eligibility for this project and that
   the bounded plan cannot enter paid use. If not demonstrable, report UNKNOWN.
   Do not use billing changes to obtain a different privacy tier in this step.
6. **Clear both photographs separately.** For each full original PNG hash in
   [REPORT.md](REPORT.md), record an authorized clearance basis covering Google's
   applicable unpaid-service content license, possible product improvement and
   human review; confirm the crop has no identifying, personal, confidential
   or uncleared material. Identify the approving role/authority without private
   names or confidential records. Local-use approval, dataset PII screening
   and a public CC BY-NC label alone are not this project-specific clearance.
   If authority or rights remain uncertain, report BLOCKED; do not substitute.

Suggested redacted reply:

```text
Project alias: [non-sensitive alias only]
Configured key privately confirmed to belong to this project: yes/no/unknown
Displayed Billing Tier: Free/other/unknown
Active billing account linked: yes/no/unknown
Project billing enabled: yes/no/unknown
Exact gemini-3.5-flash-lite row/access: displayed/unavailable/unknown
Displayed RPM / input TPM / RPD: [values or unknown]
Current usage / remaining quota / period / time checked: [values or unknown]
Operator/client/region eligibility checked: yes/no/unknown
Prospective $0 exposure verified for this exact project/plan: yes/no/unknown; basis
real--01 hash clearance: approved/blocked; authority role and scope/basis
real--06 hash clearance: approved/blocked; authority role and scope/basis
```

These facts support a follow-up audit only. Even a fully verified checklist needs
**separate explicit inference approval**. Immediately before a later approved
run, recheck the project/model/quota/billing facts, since they can change. The
November 9 assisted demo remains frozen and independent.

Official explanations: [key/project association](https://aistudio.google.com/docs/api-key),
[billing tiers](https://aistudio.google.com/docs/billing),
[project/model rate limits](https://aistudio.google.com/docs/rate-limits).
