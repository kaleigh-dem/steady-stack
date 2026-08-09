# ADR 0025: Agent safety and governance hooks

- Status: Accepted
- Date: 2026-08-09

## Context

ADRs 0020–0024 establish an optional runtime AI boundary with provider-neutral model access, typed invocation-time tool authorization, reviewed prompt/evaluation evidence, and durable checkpoint/approval primitives. Those projects intentionally leave broader runtime safety policy, sensitive-data handling, tool allowlists, approval authorization, audit-event policy, and provider/model fallback to P14-06.

The missing boundary matters because model and prompt output are untrusted runtime data. A model can suggest a provider, tool, or action, but it must not gain authority to choose credentials, expand the server-owned tool surface, authorize a human approval, bypass data-classification rules, or silently route sensitive data to an incompatible fallback provider. Safety decisions are also operational evidence: policy outcomes must be observable without turning logs into prompt, completion, or tool-payload stores.

Fallback introduces a second class of risk. A request that is safe for one provider/model/region may not be safe for another because retention, residency, tool capability, or output-contract support differs. Retrying through arbitrary providers after authentication, permission, invalid-request, or policy failures can also hide configuration defects rather than recover from transient service failure.

## Decision

1. **Add a backend-only provider-neutral governance boundary.**
   - `packages/backend/agent-governance` defines input/output policy hooks, data classifications, tool allowlists, trusted approval-authorization hooks, governance audit events, and server-side model routing/fallback policy.
   - The project is not composed into `apps/api`, `apps/worker`, or `apps/web` in P14-06 and adds no provider SDK, credential source, persistence product, or orchestration framework.
   - Applications opt into the boundary and compose it around the model, typed-tool, and durable-execution primitives. P14-07 remains responsible for generated AI-profile composition.

2. **Validate content-policy decisions at runtime and fail closed.**
   - Input and output policies receive trusted correlation/model identity plus a caller-supplied value and explicit data classification.
   - Policy results are runtime-validated strict decisions: `allow`, `redact`, or `deny`. Malformed results, thrown policy callbacks, and failed audit emission fail closed.
   - Redaction supplies a replacement value and a reviewed safe reason code. Redacted content cannot remain `credential` classified.
   - Credential-classified content may never cross an unchanged `allow` decision. A policy may explicitly redact it to a non-credential classification or deny it.
   - The shared project does not inspect arbitrary payload strings to guess whether they contain secrets. Classification and redaction implementations remain application-owned and must be conservative at source boundaries.

3. **Keep tool and approval authority server-owned.**
   - Tool allowlists are configuration supplied by trusted application composition. A tool absent from the allowlist is denied before model-directed execution.
   - An allowlisted tool may additionally require human approval. That result is a control-flow signal to pause through the durable-execution boundary; it is not itself execution permission.
   - The existing `backend-agent-tool` actor authorization remains mandatory immediately before tool execution. The allowlist complements rather than replaces authenticated actor authorization and runtime input/output validation.
   - Human approval decisions use a separate trusted approval-authorization hook before `backend-agent-durable` resolves an approval. Model output never supplies `decidedBy`, grants approval, or expands approver authority.

4. **Emit payload-safe governance audit events and fail closed if required audit cannot be recorded.**
   - Governance audit events use schema version 1 and carry trace, actor, conversation, provider/model, tool/tool-call, run/approval, classification, outcome, failure, and reviewed reason identifiers as applicable.
   - Raw prompts, completions, retrieved context, input/output policy payloads, tool arguments/results, checkpoint state, credentials, and provider error bodies are not audit-event fields.
   - Reason codes are constrained to short lowercase snake-case identifiers so policy callbacks cannot use arbitrary free text as an audit payload channel.
   - The reusable guard requires an audit sink. If the sink fails while recording a governance decision, the guarded operation fails closed instead of proceeding unaudited.

5. **Make model/provider fallback explicit, bounded, and compatibility-checked.**
   - Routes are server-owned records with stable route/provider/model/region identity, allowed data classifications, retention posture, and tool/structured-output/streaming capabilities.
   - A route can never declare `credential` data as provider-eligible.
   - Primary selection checks request classification, allowed regions, retention requirements, and required capabilities before the provider call.
   - Fallback is an ordered server-configured chain with an explicit maximum number of fallback routes and an explicit set of transient normalized failures.
   - Only `timeout`, `rate_limited`, `unavailable`, and `provider_error` are eligible fallback classes, and only when explicitly configured. Aborts, authentication/permission failures, invalid requests, and invalid responses do not trigger provider fallback.
   - Every fallback candidate is rechecked against the original request requirements. An incompatible route is skipped; if no compatible configured route remains, fallback fails closed.
   - Browser input, prompt content, user input, model output, or tool payloads never directly choose a route, provider, model, region, credential, or fallback chain.

6. **Treat common agentic threats as layered controls rather than a single prompt rule.**
   - Prompt injection: external and retrieved text is untrusted content, not authority. Apply input/output policy, keep route/tool/approval decisions in trusted application context, validate structured outputs, and require actor authorization at the tool boundary.
   - Data exfiltration: classify data at source, redact or deny sensitive material before model/provider or browser boundaries, route only to compatible provider regions/retention postures, minimize durable state, and keep audit/telemetry payload-safe.
   - Excessive agency: expose only allowlisted typed tools, require human approval for selected side effects, keep actor authorization mandatory, preserve durable fencing/idempotency, and do not automatically retry side-effecting tools.
   - Runaway cost: keep model retries bounded, fallback count bounded, set per-request output limits, use P14-04 token/cost evaluation budgets, cap application workflow/model/tool iterations, and require operational monitoring for aggregate spend. P14-06 does not add an autonomous retry loop.

7. **Preserve the optional profile boundary.**
   - P14-06 does not add a model-backed API route, provider credentials, production tool registration, durable persistence selection, browser AI feature, or generated AI runtime composition.
   - The default non-AI profile remains free of model-provider dependencies.
   - P14-07 may compose these primitives into an explicitly selected generated AI profile, but it must keep the same policy, authority, audit, and fallback boundaries.

## Consequences

SteadyStack now has reusable safety hooks that applications can place around provider calls, model output, tool selection, and durable approval decisions without choosing a vendor or framework. Sensitive-data handling and route compatibility are explicit, fallback cannot silently widen provider/data policy, and governance outcomes can be retained as audit evidence without retaining raw AI payloads.

The boundary deliberately does not claim that generic hooks are a complete product safety program. Applications still own data classification, concrete redaction/detection rules, actor and approver policy, tool registration, provider contracts, runtime iteration/spend budgets, monitoring, abuse handling, incident response, and any domain-specific safety evaluation. P14-07 remains the task that proves these reusable pieces can be generated and composed only when the AI profile is selected.
