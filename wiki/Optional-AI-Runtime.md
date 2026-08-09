# Optional AI Runtime

SteadyStack now includes reusable **optional** runtime AI boundaries for provider-neutral model access, typed tool execution, browser streaming, prompt/evaluation evidence, durable agent execution, and safety/governance. These capabilities are intentionally separate from the repository's coding-agent operating model and are **not composed into the default generated applications**.

## Prerequisites

- Understand [Choosing Workspace Profiles](Choosing-Workspace-Profiles), especially that `--ai=false` remains the default.
- Treat runtime AI as an application capability with explicit data, provider, authorization, retention, evaluation, durability, safety, governance, and operational ownership.

## Profile boundary and current status

The optional AI profile describes the product being built; it does not control whether coding agents can work in the repository.

- `ai=false` remains the default profile.
- Coding-agent support through `AGENTS.md`, Nx/MCP discovery, generators, validation, delivery controls, and review handoffs remains available regardless of the AI profile.
- `ai=true` currently records product intent and requires the web and API applications, but it still does **not** generate or compose a runnable model-backed application workflow.
- The default workspace must remain free of model-provider runtime dependencies.

Phase 14 status:

- **P14-01 — complete:** profile, data-classification, retention, and provider-selection boundaries.
- **P14-02 — complete:** provider-neutral `ModelClient`, OpenAI native-`fetch` adapter, and deterministic no-network adapter.
- **P14-03 — complete:** typed authorized tools and the V1 browser agent-stream contract.
- **P14-04 — complete:** reviewed prompt/tool-instruction artifacts and CI-enforced evaluation evidence.
- **P14-05 — complete:** replaceable durable execution with leases/fences, checkpoints, resumable runs, human approval, and interruption recovery.
- **P14-06 — complete:** input/output governance hooks, classification-aware sensitive-data handling, server-owned tool allowlists, approval authorization, payload-safe audit events, and bounded compatible provider/model fallback policy.
- **P14-07 — next:** generate and test the runnable optional AI profile.

The repository roadmap in `docs/TODO.md` is authoritative for future sequencing.

## Provider-neutral model boundary

`packages/backend/model` exposes a backend-only `ModelClient` interface without choosing a default provider or wiring model calls into the API or web application.

The public operations are:

| Operation            | Purpose                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `generate`           | Text generation with normalized finish reason, provider/model identity, token usage, cancellation, timeout, and retry behavior. |
| `generateStructured` | JSON-Schema-constrained generation plus application-owned parsing before a typed value crosses the boundary.                    |
| `embed`              | Ordered embedding vectors with normalized provider/model identity and usage.                                                    |
| `stream`             | Provider-neutral async runtime events for text deltas, usage, and completion.                                                   |

Two adapters are available:

- `OpenAIModelAdapter` uses Node's built-in `fetch`; no OpenAI SDK is added to the dependency graph.
- `DeterministicModelAdapter` performs no network access and supplies predictable fixtures for tests and local composition.

The model project is stateless. It does not persist prompts, completions, vectors, structured values, or stream events.

## Data classification, retention, and provider selection

AI data inherits the strictest classification of the source data it contains. Prompts, retrieved context, attachments, structured model input/output, tool arguments, tool results, and durable checkpoints must be evaluated under the application's data policy.

Fail closed on prohibited data:

- Do not send secrets, access tokens, session credentials, signing material, database credentials, or other authentication material to model providers.
- Sensitive, regulated, tenant-confidential, or residency-constrained data requires an explicit policy allowing that classification for the selected provider and region.
- Provider-side retention, training use, abuse-review storage, and regional processing must be compatible with the application's policy before that provider is allowed.
- Production-derived evaluation fixtures require the same classification and retention review as production model traffic; synthetic or redacted fixtures are preferred.
- Production durable adapters require explicit ownership, purpose, retention, deletion, tenant isolation, encryption/access control, backup/restore, and regional policy for checkpoint state.

Provider and model selection is server-side and allowlisted. Browser input, prompt text, user input, or model output must not directly select an unapproved provider, model, region, credential, or tool set. Credentials remain server-side.

P14-06 makes fallback an explicit server policy rather than an implicit retry across providers. Every candidate route must preserve the original request's data classification, region, retention, safety, tool, structured-output, and streaming requirements.

## Typed tool authorization

`packages/backend/agent-tool` provides runtime-validated typed tool invocation. A tool definition has:

- an application-owned tool identifier;
- a runtime input schema;
- a runtime output schema;
- an authorization function;
- an execution function.

Invocation is ordered deliberately:

1. validate trusted invocation identifiers;
2. parse model-provided input;
3. authorize the authenticated actor against the selected server-side tool;
4. execute only when authorization allows the call;
5. validate the handler output;
6. return typed output with correlation identifiers preserved.

Model output is never an authorization decision. Actor identity, tenant identity, scopes, credentials, provider/model choice, and tool allowlists are trusted application context, not model-controlled arguments.

P14-03 does not automatically retry side-effecting tool execution. P14-05 supplies optional checkpoint/resume and approval lifecycle primitives, and P14-06 adds server-owned tool allowlists plus approval authorization, but applications remain responsible for deciding which side effects are safe to resume or retry.

## V1 browser agent stream

The shared browser-safe stream contract is:

```text
protocol: steadystack.agent-stream
version: 1
content type: application/x-ndjson; charset=utf-8
```

Each NDJSON line is one strict event. Every V1 event carries sequence and correlation identity, including trace, actor, conversation, provider, and model identifiers. Tool lifecycle events additionally carry tool and tool-call identifiers.

V1 event types are:

- `started`
- `text_delta`
- `usage`
- `tool_started`
- `tool_completed`
- `tool_denied`
- `completed`
- `error`

The protocol intentionally has no raw prompt, completion, tool-input, or tool-result field. The Agent Tasks web feature consumes the shared decoder, requires contiguous sequence numbers and stable actor/conversation identity, and preserves validated provider/model/tool identifiers.

This is a transport boundary only. The default API does not expose a model-backed streaming endpoint.

## Prompt and evaluation lifecycle

`packages/backend/agent-eval` adds reviewed, versioned prompt and tool-instruction artifacts plus deterministic evaluation evidence.

Prompt artifacts record a stable identifier and semantic version, kind, content, template variables, review metadata, and `toolId` for tool instructions. Behavior-bearing fields are fingerprinted with SHA-256. Changing prompt or tool-instruction behavior requires a new version, a new review, and updated evaluation evidence.

Evaluation fixtures declare `synthetic`, `redacted`, or `production-derived` classification. Evaluators can be deterministic rules or application-supplied model graders. Evidence can enforce quality, latency, input/output/total token, and estimated cost budgets.

Run the focused evidence gate with:

```bash
pnpm agent-eval:check
```

The root `pnpm check` runs this immediately after `pnpm docs:check`. In CI, the evidence checker inspects the diff and requires changed evidence to cover governed prompt artifacts and non-test model/tool runtime behavior changes. A governed prompt, model, or tool behavior change must therefore include reviewed evaluation evidence rather than only code and tests.

## Durable execution

`packages/backend/agent-durable` adds a backend-only replaceable lifecycle for checkpointed/resumable runs without selecting a workflow framework or persistence product.

A durable run preserves `runId`, `traceId`, `actorId`, and `conversationId`. Claims use a bounded lease, a server-owned lease-owner identifier, an attempt count, and a monotonically increasing fence. Every mutating session operation must still own the current lease and fence. When an interrupted lease expires, another worker can reclaim the run with a higher fence and resume from the latest checkpoint; the stale session cannot overwrite newer progress.

Checkpoints use contiguous sequence numbers and stable checkpoint identifiers as idempotency keys. Replaying the same identifier with identical state is a duplicate success; changing content behind the same identifier fails closed. Checkpoint state must be JSON-compatible application data.

`pauseForApproval` atomically persists the resume checkpoint and a pending approval before releasing the lease. A waiting run cannot be reclaimed until the application resolves that approval. Approval returns the run to `pending`; rejection terminates it with the safe `approval_rejected` code. Model output never supplies the trusted approver identity.

Lifecycle observation reuses the repository correlation context and retains only identifiers, status, attempt/fence, checkpoint sequence, approval identifiers/decisions, and safe failure codes. Raw checkpoint state is not an observer event field.

`InMemoryDurableExecutionAdapter` is deterministic test support. Its snapshot/restore path proves recovery semantics in tests, but it does not survive process or host loss by itself. Production applications must provide an actual persistent `DurableExecutionAdapter` implementation and own retention, deletion, tenant isolation, encryption/access control, backup/restore, and residency policy for stored checkpoint state.

## Safety and governance hooks

`packages/backend/agent-governance` adds the reusable P14-06 safety boundary without composing a workflow.

The content-policy boundary uses explicit classifications:

```text
public
internal
confidential
restricted
credential
```

`InputPolicy<T>` and `OutputPolicy<T>` return strict runtime decisions: allow, redact, or deny. Malformed policy output and policy exceptions fail closed. Credential-classified content cannot pass unchanged; it must be explicitly redacted to a non-credential classification or denied. Applications still own source classification and concrete detection/redaction rules.

Tool governance is server-owned. `ToolAllowlistPolicy` denies unregistered tools and can mark selected tools as requiring human approval. That control does not replace `backend-agent-tool` actor authorization. Before a durable approval is resolved, `ApprovalAuthorizationPolicy` verifies the trusted approver independently; model output never supplies approval authority.

Every governance guard receives a required `GovernanceAuditSink`. Schema-V1 events carry identifiers, classifications, outcomes, normalized failure classes, route identity, and safe reason codes. Raw prompts, completions, retrieved content, policy payloads, tool arguments/results, checkpoint state, credentials, and provider error bodies are not event fields. If the required audit sink fails, the guarded operation fails closed.

### Provider/model fallback

Routes are configured on the server with provider/model/region identity, allowed classifications, retention posture, and support for tools, structured output, and streaming. `selectPrimaryModelRoute` validates the primary route before dispatch.

Fallback is ordered and bounded by `maxFallbacks`. Only these normalized failures may trigger fallback, and only when explicitly configured:

```text
timeout
rate_limited
unavailable
provider_error
```

Caller aborts, authentication failures, permission failures, invalid requests, and invalid responses do not trigger provider fallback. Every fallback candidate is rechecked against the original classification, residency, retention, tool, structured-output, and streaming requirements. If no compatible route remains, fallback stops.

### Threat mitigations

Prompt injection is handled as an authority-boundary problem, not only a prompt-writing problem: external/model text remains untrusted, route/tool/credential/approval choices remain trusted server context, policies run around model boundaries, and typed tools re-authorize the actor immediately before execution.

Data exfiltration controls combine source classification, credential redaction/denial, compatible route selection, retention/residency constraints, minimal durable/evaluation data, and payload-safe logs/audit/streaming.

Excessive agency is bounded by server tool allowlists, optional human approval, independent approval authorization, typed actor authorization, durable fencing/idempotency, and no automatic retries of side-effecting tools.

Runaway cost is bounded with `backend-model` retry limits, finite provider fallback, per-request output-token limits, P14-04 evaluation token/cost budgets, and application-owned caps for workflow/model/tool iterations, wall-clock duration, and aggregate usage/spend.

See `docs/agent-safety-and-governance.md` and ADR 0025 for the full composition contract.

Useful focused checks include:

```bash
pnpm nx run backend-model:test
pnpm nx run backend-model:typecheck
pnpm nx run backend-agent-tool:test
pnpm nx run backend-agent-tool:typecheck
pnpm nx run backend-agent-eval:test
pnpm nx run backend-agent-eval:typecheck
pnpm nx run backend-agent-durable:test
pnpm nx run backend-agent-durable:typecheck
pnpm nx run backend-agent-governance:test
pnpm nx run backend-agent-governance:typecheck
pnpm agent-eval:check
```

## What is not implemented yet

The current reusable boundaries should not be described as a complete generated AI application profile. Phase 14 still has explicit gaps:

- **Generated runnable AI profile (P14-07):** `ai=true` does not yet install or wire a reference model-backed workflow into generated applications.
- No production durable persistence adapter is selected by the shared platform; applications that need durable execution choose and operate one explicitly.
- The repository does not choose a default model provider, orchestration framework, vector database, prompt-management service, or durable-agent framework.

Applications that compose the current primitives must still own provider credentials and allowlisting, source data classification and concrete redaction/detection rules, actor/approver policy, safe tool registration, prompt content, runtime iteration/spend budgets, durable persistence selection, production monitoring, abuse handling, and incident response.

## Related pages

- [Home](Home)
- [Architecture](Architecture)
- [Choosing Workspace Profiles](Choosing-Workspace-Profiles)
- [Validation and Testing](Validation-and-Testing)
- [Agentic Development Model](Agentic-Development-Model)

## Next steps

1. [Choosing Workspace Profiles](Choosing-Workspace-Profiles)
2. [Architecture](Architecture)
3. [Validation and Testing](Validation-and-Testing)

[Back to Home](Home)
