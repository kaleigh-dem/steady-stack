# Agent safety and governance

P14-06 adds a reusable backend-only governance boundary for optional runtime AI composition. The boundary is provider-neutral and is not wired into the default web, API, or worker applications.

## Public boundary

`packages/backend/agent-governance` exports:

- `InputPolicy<T>` and `OutputPolicy<T>` runtime hooks;
- `ContentEnvelope<T>` with explicit `AgentDataClassification`;
- `applyInputPolicy` and `applyOutputPolicy` fail-closed guards;
- `ToolAllowlistPolicy` and `evaluateToolAllowlist`;
- `ApprovalAuthorizationPolicy` and `authorizeApprovalDecision`;
- schema-V1 `GovernanceAuditEvent` and required `GovernanceAuditSink`;
- `ModelRoute`, `ModelRouteRequirements`, and `ModelFallbackPolicy`;
- `selectPrimaryModelRoute` and `selectFallbackModelRoute`.

The project has no provider SDK dependency and does not select credentials or persist policy payloads.

## Data classifications and content policy

The shared classifications are:

```text
public
internal
confidential
restricted
credential
```

Classification is application-owned and should be assigned from the source data before content reaches a model boundary. The library does not scan arbitrary strings and pretend that heuristic detection is sufficient classification.

Input/output policy callbacks return one strict runtime decision:

- `allow` — continue with the original value;
- `redact` — continue with an explicitly supplied replacement value, non-credential classification, and safe reason code;
- `deny` — stop with a safe reason code.

Malformed callback results and callback exceptions fail closed. Credential-classified content cannot pass unchanged: it must be explicitly redacted to a non-credential classification or denied.

Use the input guard before constructing or dispatching provider requests. Use the output guard before model output is shown to a user, persisted, returned to a browser, or reused as higher-trust application input. Tool outputs and retrieved content should be classified at their source and pass the applicable content policy before they are placed back into model context.

## Tool allowlists and human approval

A model may request a tool identifier, but the server owns the available tool set.

Recommended order for a tool request:

1. validate the model-produced tool request through the typed tool schema;
2. evaluate the server-owned `ToolAllowlistPolicy` using trusted provider/model/tool-call identity;
3. deny tools that are not allowlisted;
4. if the allowlist marks the tool as `approval_required`, persist a durable approval checkpoint before any side effect;
5. authorize the trusted human approval through `ApprovalAuthorizationPolicy` before resolving the durable approval;
6. immediately before execution, run the existing `backend-agent-tool` authenticated actor authorization;
7. execute the tool once and runtime-validate its output;
8. classify and policy-check any output before exposing it to the model or browser.

The allowlist never replaces actor authorization. Human approval never replaces actor authorization. Model output never grants either form of authority.

## Governance audit events

Every reusable governance guard requires a `GovernanceAuditSink`. Audit events are schema version 1 and contain only policy-relevant metadata such as:

- trace, actor, and conversation identifiers;
- provider/model or tool/tool-call identifiers when applicable;
- run, approval, and trusted approver identifiers for approval policy;
- classification before/after a content decision;
- selected route identifiers and normalized fallback failure code;
- allow/redact/deny/approval-required/selected/blocked outcomes;
- reviewed lowercase snake-case reason codes.

Do not put raw prompts, completions, retrieved text, policy payloads, tool arguments/results, checkpoint state, credentials, or provider error bodies into the audit sink. The library does not expose those values on its audit event contract.

Audit is a governance boundary. If the configured sink cannot record the event, the guarded operation fails closed rather than proceeding without the required decision record.

## Server-side provider and model routing

A `ModelRoute` records server-owned route identity and the compatibility facts needed before traffic can use it:

- `routeId`, `providerId`, and `modelId`;
- provider processing `region`;
- allowed data classifications;
- whether provider-side retention is `none` or explicitly `approved`;
- support for tools, structured output, and streaming.

`selectPrimaryModelRoute` checks the route against the request requirements before any provider invocation. Requirements can constrain data classification, allowed regions, no-provider-retention, tools, structured output, and streaming.

Browser/user/prompt/model content is never a route-selection input. Applications choose the route table and fallback policy from trusted server configuration.

## Fallback policy

Fallback is not an implicit retry across vendors. It is an ordered, bounded policy.

Only these normalized model failures are eligible for fallback, and only when listed in `fallbackOn`:

```text
timeout
rate_limited
unavailable
provider_error
```

Do not fall back for caller aborts, authentication failures, permission failures, invalid requests, or invalid responses. Those conditions require cancellation or correction, not silent routing to another provider.

Each fallback candidate is checked again against the original classification, region, retention, tool, structured-output, and streaming requirements. Incompatible candidates are skipped. If the configured fallback ceiling is reached or no compatible candidate remains, the fallback returns a blocked/exhausted result and the application stops or handles the failure explicitly.

Provider fallback should also preserve application-level output validation and safety policy. A provider being technically available does not make its output acceptable.

## Threat mitigation checklist

### Prompt injection

- Treat user, retrieved, webpage, attachment, and model text as untrusted content rather than instructions with application authority.
- Keep system policy, route configuration, credentials, actor identity, tool allowlists, and approval identities outside model-controlled data.
- Apply input and output policy around model boundaries.
- Runtime-validate structured output and typed tool arguments/results.
- Re-authorize the authenticated actor immediately before every tool invocation.
- Never let prompt text disable governance hooks or select a broader tool/provider policy.

### Data exfiltration

- Classify source data before it enters prompts, retrieved context, tool results, evaluation fixtures, or durable checkpoints.
- Deny or explicitly redact credential material before model/provider or browser boundaries.
- Route sensitive data only to explicitly compatible classifications, regions, and retention postures.
- Minimize checkpoint/evaluation content and retain it only under documented ownership, deletion, tenant, encryption, and residency policy.
- Keep logs, traces, audit events, normalized errors, and browser streaming payload-safe by default.

### Excessive agency

- Expose only server-owned allowlisted typed tools.
- Require human approval for high-impact side effects and authorize the approver independently.
- Preserve existing actor authorization even after human approval.
- Use durable leases/fences and idempotency keys for resumable work.
- Do not automatically retry side-effecting tool calls merely because a model or provider operation failed.
- Bound workflow steps and tool/model invocation counts in application composition.

### Runaway cost

- Keep `backend-model` retry attempts and delays bounded.
- Configure a finite `maxFallbacks`; do not cycle providers indefinitely.
- Set model `maxOutputTokens` according to the use case.
- Keep prompt/evaluation token and estimated-cost budgets under P14-04 evaluation evidence.
- Add application-level limits for workflow steps, model calls, tool calls, wall-clock duration, and aggregate token/cost usage before production composition.
- Monitor provider usage and spend with provider/model/route identifiers, without logging raw content.

## Suggested composition flow

```text
trusted actor + conversation context
  -> classify input
  -> apply input policy
  -> select compatible primary route
  -> call provider-neutral ModelClient
       -> on configured transient failure only:
            select compatible bounded fallback
  -> classify + apply output policy
  -> for requested tools:
       server tool allowlist
       -> optional durable human approval
       -> trusted approval authorization
       -> typed tool actor authorization
       -> execute + validate
       -> classify + policy-check tool output
  -> emit payload-safe application/stream output
```

P14-06 supplies reusable hooks, not a composed workflow. P14-07 is responsible for generating and testing an explicitly selected AI profile that wires these boundaries together while proving `ai=false` remains provider-free.

## Focused checks

```bash
pnpm nx run backend-agent-governance:test
pnpm nx run backend-agent-governance:typecheck
pnpm nx run backend-agent-governance:lint
pnpm nx run backend-agent-governance:build
pnpm docs:check
pnpm agent-eval:check
pnpm format:check
```

## Related decisions

- ADR 0020 — optional AI profile boundaries
- ADR 0021 — provider-neutral model interfaces
- ADR 0022 — typed tools and versioned agent streaming
- ADR 0023 — reviewed prompt artifacts and evaluation evidence
- ADR 0024 — optional durable agent execution
- ADR 0025 — agent safety and governance hooks
