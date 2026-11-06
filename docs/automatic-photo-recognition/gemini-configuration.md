# Current Gemini configuration — server side only

Step 4D permits a user-created, untracked **`.env.local`** file. This supersedes
the environment-only storage advice in the historical Step 4C setup guide;
that committed experiment record is retained unchanged. Configuration does not
authorize inference or enable a model in the assisted demonstration.

The tracked root `.env.example` contains exactly:

```dotenv
GEMINI_API_KEY=
```

Create or edit `.env.local` yourself in your editor and enter your real key
there. Do not put it into `.env.example`, chat, a shell command, screenshots,
browser code or test artifacts. Use the exact `.env.local` name; a file named
`.env copy.local` is not covered by the `.env.*` rule. No copy is needed. Keep
the real file private; on macOS you may restrict its permissions with
`chmod 600 .env.local`.

The root ignore rules are:

```gitignore
.env
.env.*
!.env.example
```

Verify locally, without displaying the file:

```bash
git check-ignore -v .env.local
git ls-files -- .env.local
```

The first command must identify `.env.*`; the second must print no path. Git
ignore rules do not protect files already tracked, and are not an HTTP access
control. Do not force-add a credential file or serve the repository root.

## Load the file with this project's Node

The verified local Node is **20.19.6**. Its built-in `--env-file` option loads
variables before the entry script runs. The path is relative to the working
directory; an already-set process variable takes precedence. This is documented
in the [Node 20.19.6 CLI reference](https://nodejs.org/download/release/v20.19.6/docs/api/cli.html#--env-fileconfig)
and verified with offline tests here. No dotenv dependency or shell `source`
command is needed.

From the repository root, this **offline presence-only check** is executable:

```bash
node --env-file=.env.local benchmarks/photo-graphs/multi-method/step-4c/check-gemini-env.cjs
```

It reports only `gemini_api_key_configured`, `inference_enabled: false`, and its
scope. It does not validate the key, contact Google, check the project or prove
$0 cost. If the file is absent, the explicit `--env-file` command fails; that is
not a demo blocker. The assisted demo uses no key and needs no env-file loading.
If a parent `GEMINI_API_KEY` is already set, that value overrides the file; use
a fresh terminal or unset that variable before checking this particular file.
Do not print either value to diagnose precedence.

After a later experiment is approved and its server entry point exists, launch
that **server-only** entry point using the same pattern:

```text
node --env-file=.env.local <future-approved-server-runner.cjs>
```

This is a template, not a currently implemented inference command. The current
repository still has no approved live Gemini transport/converter. A future
server can read `process.env.GEMINI_API_KEY` internally; it must not return the
value in responses or logs, pass it to a client bundle, place it in HTML, or
expose it through a public/prefixed build variable. Do not load this file into
the PrairieLearn frontend or a static backup server. Browser rehearsal subprocesses
explicitly remove Gemini/Google credential variables.

## Gates still required before any photograph is sent

No inference, billing change, quota probe or photograph upload is part of Step
4D. A future Step 4B resumption requires separate explicit approval, the frozen
[two-image protocol](../../benchmarks/photo-graphs/multi-method/step-4a/protocol.json),
verified exact-model/project Free-tier access, disabled billing and confirmed
$0 exposure, sufficient project quota, current account/region eligibility, and
image-specific permission under Google's applicable unpaid-service terms for
**both exact original hashes**. Key presence completes none of those gates.

The previous [prerequisite audit](../../benchmarks/photo-graphs/multi-method/step-4b/prerequisites.json)
and [permission/cost checklist](../../benchmarks/photo-graphs/multi-method/step-4c/GEMINI-SETUP.md#exact-gates-before-resuming-step-4b)
remain the starting point. Public-image local testing approval is separate from
Google transmission clearance. Do not substitute images or include the manual
traces, expected answers, references or this demo's native geometry in inference.
The maximum remains two sequential image-only requests, one per image, no
retries/continuations/tools/paid fallback, only after approval and verified gates.
