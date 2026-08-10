# ADR 0020: Define optional AI profile boundaries

- Status: Accepted
- Date: 2026-08-07

## Context

SteadyStack is intentionally agent-compatible even when a generated product has no runtime AI features. The repository control plane described in `docs/agentic-development.md` gives humans and coding agents durable instructions, an Nx project graph, MCP discovery, deterministic generators, executable boundaries, validation, and review handoffs. Those development-time capabilities must not be confused with application code that sends product data to a model provider or lets a model invoke product tools.

The initialization contract records an optional AI profile in `workspace.template.json`. The profile defaults to disabled and requires the web and API applications when enabled. P14-01 established the boundary before provider-neutral model ports, tools, evaluations, durable execution, safety hooks, or provider adapters were added; P14-07 realizes that accepted boundary as generated runtime composition without changing the default profile.

Without that boundary, future work could accidentally make coding-agent support depend on a runtime model SDK, place provider-specific types in shared product code, persist prompts or tool payloads implicitly, or let client input select providers whose data-handling terms do not match the application.

## Decision

1. **Keep coding-agent repository support separate from runtime AI product capabilities.**
   - Repository instructions, Nx/MCP discovery, structural generators, validation, documentation integrity, review handoffs, and delivery controls are development-time infrastructure and remain available independently of the optional AI profile.
   - Runtime AI begins only at an application boundary that prepares model input, invokes a model-facing interface, streams or consumes model output, or exposes a product tool to model-directed execution.
   - Enabling the optional AI profile does not grant agents production authority, repository credentials, deployment permissions, or access to arbitrary application tools. Existing human approval and least-privilege boundaries continue to apply.

2. **Put provider-neutral contracts in the reusable platform; keep provider implementations optional.**
   - Shared AI-facing interfaces may define generation or chat, structured output, embeddings, streaming, request cancellation and timeouts, normalized usage, and normalized error behavior.
   - Shared boundaries may also define typed tool invocation, policy and audit hooks, prompt/evaluation identifiers, and durable-execution ports when later Phase 14 tasks require them.
   - These contracts must remain framework-neutral and provider-neutral. Shared domain or application code must not expose provider SDK request, response, error, usage, or model classes through its public API.
   - Provider SDKs, provider authentication, provider-specific retries, wire formats, regional endpoints, and provider-specific streaming translation belong in replaceable adapters selected only for the optional runtime AI profile.
   - The default non-AI generated workspace must remain free of model-provider runtime dependencies. The upstream template may carry reusable source needed to generate an AI-enabled workspace, but initialization must not make those dependencies part of the default product profile.

3. **Treat the AI setting as an explicit opt-in.**
   - `ai=false` remains the default and has no effect on coding-agent compatibility.
   - P14-01 initially made `ai=true` record product intent and the required web-plus-API shape without adding runtime composition.
   - P14-07 realizes `ai=true` by composing the existing provider-neutral Phase 14 model, typed-tool, evaluation, durable-execution, governance, streaming-contract, and observability boundaries into the generated API. It does not choose or require a model-provider SDK, orchestration framework, provider credential, production durable store, or production policy implementation.
   - Generation must remain deterministic and must prove that `ai=false` contains no provider runtime dependency or AI application dependency edge.

4. **Classify AI data from its source and fail closed on prohibited data.**
   - Prompt content, conversation state, retrieved context, attachments, structured model input/output, tool arguments, and tool results inherit the strictest data classification of the source data they contain.
   - Secrets, access tokens, session credentials, signing material, database credentials, and other authentication material must not be sent to model providers.
   - Sensitive, regulated, tenant-confidential, or residency-constrained data may be routed to a model only after the application has an explicit policy that permits that classification for the selected provider and deployment region.
   - Tool authorization is evaluated at invocation time from the authenticated application actor and tool policy; model output is never an authorization decision.
   - Logs and traces should record identifiers, timing, model/provider selection, usage, policy outcomes, and errors without recording raw prompts, completions, tool payloads, or retrieved sensitive content by default.

5. **Make retention explicit at every storage boundary.**
   - The shared platform must not implicitly persist prompts, completions, conversations, embeddings, or tool payloads merely because the AI profile is enabled.
   - Any application-owned persistence must name the data owner, purpose, retention duration, deletion path, tenant boundary, and encryption/access controls appropriate to the data classification.
   - Provider-side retention, training use, abuse-review storage, and regional processing must be disabled where configurable or otherwise contractually compatible with the application's classification and retention policy before that provider is allowed.
   - Evaluation fixtures should be synthetic or redacted by default. Production-derived fixtures require the same classification and retention review as production model traffic.
   - In-memory buffers and caches must be bounded to their operational purpose and must not mix tenants or silently become a long-term transcript store.

6. **Select providers and models on the server through an allowlisted policy.**
   - SteadyStack has no default model provider. Provider and model selection is application configuration resolved behind provider-neutral interfaces.
   - Browser input, user input, prompt content, or model output must not directly choose an unapproved provider, model, region, tool set, or credential.
   - Credentials remain server-side and are scoped to the minimum models, APIs, projects, and environments required.
   - Fallback between models or providers must be explicitly configured. A fallback is allowed only when its data handling, residency, retention, safety, tool capability, and output-contract requirements are compatible with the original request.
   - Provider selection must remain observable and auditable so evaluations, incidents, cost analysis, and data-handling reviews can identify which configured provider and model served a request.

7. **Preserve these boundaries in tests and documentation as Phase 14 evolves.**
   - Changes that add provider-neutral interfaces must keep provider SDK types behind adapters.
   - Changes that make the AI profile generate runtime code or dependencies must add generated-workspace coverage for both enabled and disabled profiles.
   - Changes to data handling, retention, provider selection, tool authority, or fallback policy require documentation and architecture evidence in the same pull request.

## P14-07 implementation status

P14-07 implements the already accepted optional-profile decision rather than introducing a new architecture. The public `preset` now treats `ai=true` as the deliberate composition point: it materializes only the package entry points needed to consume the existing Phase 14 capabilities, adds those workspace dependencies and TypeScript references to the generated API, and writes an AI-only reference workflow plus deterministic tests and replacement guidance.

The reference workflow demonstrates the existing boundaries together: provider-neutral model streaming; strict V1 stream events; one runtime-validated tool with both a server-owned allowlist and invocation-time actor authorization; durable runs, payload-safe checkpoints, and trusted human approval; input/output classification policy; no-provider-retention route requirements; bounded server-configured fallback that is not attempted after a partial stream has been consumed; synthetic rule-based evaluation evidence and normalized usage; and correlated logs, metrics, and governance audit events that exclude raw prompt and tool payloads.

`ai=false` remains the default and removes the generated AI workflow, AI-specific API dependencies/references, and optional AI package entry points. Generated-workspace CI exercises the ordinary profile through its existing production-shaped lifecycle, separately scans its package manifests for model-provider runtime dependencies, and validates an AI-enabled workspace through repeated deterministic generation, frozen installation, repository checks, generated workflow tests, Nx graph assertions, identity checks, and cleanliness checks.

## Consequences

SteadyStack can continue improving coding-agent ergonomics without introducing runtime AI dependencies, credentials, or data flows. Provider-neutral Phase 14 capabilities are available to an AI-enabled generated workspace only after deliberate profile selection.

The default workspace remains a conventional web/API/worker platform. An AI-enabled workspace must opt into runtime capabilities deliberately, select approved adapters through server-side configuration, and own the resulting privacy, retention, safety, cost, persistence, evaluation, and operational policies.

This ADR intentionally does not choose model vendors, orchestration frameworks, vector databases, prompt-management products, or durable-agent frameworks. Those implementations remain replaceable follow-up decisions subject to the boundaries above.
