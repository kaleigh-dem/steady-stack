# Architecture overview

The repository is an Nx monorepo designed for long-lived web applications that may be built across many human and AI-agent sessions. Nx projects, not folders alone, are the units of ownership, caching, affected analysis, generation, and dependency-boundary enforcement.

The architecture is intentionally represented in forms that contributors can inspect and tools can enforce. Written guidance explains intent; project tags, public entry points, generated contracts, TypeScript references, and lint rules determine whether a proposed change conforms.

## Agent-facing control plane

- Root and nested `AGENTS.md` files describe repository-wide and local rules.
- `.mcp.json` exposes the Nx MCP server for compatible agent clients.
- `project.json` files and the Nx graph expose targets, tags, dependencies, and affected projects.
- `src/index.ts` files define supported cross-project APIs.
- `docs/adr` records durable architecture decisions.
- Local generators create approved domain, feature, job, and contract structures.
- Root package scripts provide stable validation and delivery commands.

See `docs/agentic-development.md` for the standard workflow and human approval boundaries.

## Deployable applications

```text
apps/web       Next.js App Router delivery application
apps/api       NestJS HTTP delivery application
apps/worker    Node.js PostgreSQL-outbox worker and operations endpoint
```

Applications are composition roots. HTTP, framework, process lifecycle, and transport concerns stay in applications; reusable business behavior belongs in libraries.

## Current libraries

```text
packages/backend/agent-durable       optional durable-run leases, checkpoints, approval pauses, recovery, and adapter contract
packages/backend/agent-eval          reviewed prompt artifacts, deterministic evaluations, budgets, and evidence enforcement
packages/backend/agent-governance    optional content/tool/approval policy hooks, payload-safe audit events, and compatible model fallback
packages/backend/agent-task          framework-free Agent Task domain and use cases
packages/backend/agent-tool          framework-neutral typed tool invocation and authorization boundary
packages/backend/model               provider-neutral model contracts, execution policy, and optional adapters
packages/backend/rate-limit          framework-free rate-limit policies and storage port
packages/web/features/agent-tasks    browser-facing Agent Tasks feature, client behavior, and agent-stream consumer
packages/ui                          shared React presentation
packages/contracts                   OpenAPI source, generated client/server types, runtime validators, and versioned agent-stream contract
packages/database                    PostgreSQL schema, migrations, repositories, outbox, and rate-limit adapters
packages/env                         Node-only validated configuration
packages/observability               structured logging, metrics, tracing, and telemetry setup
```

The model project is backend-only and is not composed into the default API, worker, or web applications. It owns provider-neutral generation, structured-output, embedding, streaming, usage, cancellation, timeout, retry, and error semantics. Provider wire formats stay behind replaceable adapters; the current OpenAI adapter uses the Node runtime `fetch` API and adds no provider SDK dependency. See `docs/model-interfaces.md` and ADRs 0020–0021.

The P14-03 tool and browser-stream boundaries remain optional runtime primitives rather than default application composition. `backend-agent-tool` validates model-controlled input and handler output and requires authorization against application-supplied actor context before execution. `contracts` owns strict V1 NDJSON agent-stream events, while the Agent Tasks web feature incrementally consumes that universal contract and enforces sequence plus stream-identity continuity. Raw prompts and tool payloads are not V1 transport fields. See `docs/typed-tools-and-streaming.md` and ADR 0022.

The P14-04 evaluation boundary is also backend-only and uncomposed. `backend-agent-eval` owns strict reviewed prompt/tool-instruction artifacts, deterministic fixture and grader contracts, quality/latency/token/cost budgets, and payload-safe evidence manifests. CI requires changed evidence for governed prompt artifacts plus non-test model and typed-tool runtime changes. Model grading remains an application-supplied callback, so this boundary does not choose a provider or add provider dependencies. See `docs/prompt-evaluation-lifecycle.md` and ADR 0023.

The P14-05 durable-execution boundary remains backend-only and uncomposed. `backend-agent-durable` owns a replaceable persistence adapter plus renewable lease/fence, idempotent checkpoint, atomic approval-pause, resume, and interruption-recovery semantics. It reuses the shared correlation context for payload-safe lifecycle observation. Its in-memory adapter is deterministic test support only; production applications must opt into a persistent adapter with explicit retention, deletion, tenant isolation, encryption, and access controls. See `docs/durable-agent-execution.md` and ADR 0024.

The P14-06 governance boundary is backend-only and uncomposed. `backend-agent-governance` owns runtime-validated input/output policy hooks, explicit data classifications, server-owned tool allowlists, trusted approval-authorization hooks, schema-V1 payload-safe audit events, and server-configured provider/model route compatibility plus bounded fallback. Credential-classified content cannot pass unchanged, tool allowlists do not replace actor authorization, approval authorization remains independent of model output, and fallback is limited to configured transient failures and revalidates classification, region, retention, and capability requirements. See `docs/agent-safety-and-governance.md` and ADR 0025.

`tools/workspace-plugin` owns the released preset, structural generators, and downstream upgrade tooling. `tools/delivery`, `infra`, and `performance` own production-image preparation, environment validation, preview orchestration, release manifests and plans, and performance budgets. `tools/documentation` validates documented links, paths, commands, environment names, identity and authentication descriptions, architecture evidence, and change records.

## Generated project graph

`docs/architecture/project-graph.md` is generated from the current Nx project graph and committed for review. Regenerate it whenever an Nx project is added, removed, retagged, or rewired:

```bash
pnpm docs:architecture
pnpm docs:check
```

The graph check fails when the committed diagram differs from Nx. See `docs/documentation-integrity.md` for the complete validation contract.

## Dependency direction

- Applications may compose libraries; libraries never import applications.
- Browser projects cannot depend on Node-only projects.
- Domain and contract projects remain framework-free.
- Infrastructure adapters implement ports owned by domain or policy libraries.
- Provider-specific model protocol translation stays behind the provider-neutral model boundary and is not a default application dependency.
- Tool authorization uses trusted application actor context at the invocation boundary; model output is never an authorization decision.
- Governance policy uses explicit classification and trusted server configuration; prompt/model/browser data cannot expand tool allowlists, choose credentials/providers, or authorize approvals.
- Provider/model fallback is explicit and bounded, is triggered only by configured transient failures, and must preserve classification, residency, retention, and required capability constraints for every selected route.
- Governance audit events retain identifiers, classifications, outcomes, and safe reason codes rather than raw prompts, completions, retrieved content, policy payloads, tool payloads, checkpoint state, or credentials.
- Prompt and tool-instruction changes use reviewed versioned artifacts and changed evaluation evidence; model grading does not select providers inside the shared evaluation boundary.
- Durable run mutations require the current lease owner and fence; approval decisions come from trusted application context, and checkpoint state never becomes an observability payload.
- Browser-facing AI events use the shared versioned agent-stream contract rather than provider-native streaming frames.
- HTTP contracts originate in `packages/contracts/openapi/source`; generated artifacts are consumed at API and browser boundaries.
- The API persists Agent Tasks and outbox events transactionally. The worker claims outbox rows at least once and executes fenced, idempotent handlers.
- Cross-project imports use public entry points rather than deep internal paths.

Do not weaken a boundary merely to make an agent-authored change compile. Move the behavior to the correct project, introduce a deliberate public boundary, or document an intentional architecture decision.

See `docs/architecture/dependency-rules.md` for the exact enforced tag matrix and `docs/reference-feature-agent-tasks.md` for the canonical end-to-end flow.
