# Template Roadmap

Last updated: 2026-08-12

This file tracks active work required to evolve the repository as a reusable, upgradeable application platform. Completed implementation history remains available in merged pull requests, ADRs, and Git history instead of being repeated as a separate historical roadmap.

## Completed baseline

Phases 2–12 established the current foundation:

- Nx workspace migration and enforceable project boundaries
- architecture-aware domain, feature, job, and contract generators
- deterministic template initialization, releases, generated-workspace validation, and downstream upgrades
- PostgreSQL migrations, integration tests, repositories, transactional outbox delivery, and distributed rate limits
- deterministic OpenAPI generation, browser clients, and runtime HTTP contract enforcement
- a complete asynchronous Agent Tasks reference feature
- structured logging, OpenTelemetry, health checks, worker metrics, and runbooks
- development and production browser authentication profiles plus OIDC access-token verification
- production images, preview validation, production-readiness checks, release planning, and performance budgets
- security verification for token expiry, issuer and audience mismatch, signing-key rotation, permission denial, and rate-limit behavior

Detailed completed-phase task lists are intentionally omitted. Relevant implementation evidence remains recorded in merged PRs #2–#49, `docs/adr/`, and Git history.

## Status conventions

- `[ ]` planned
- `[-]` in progress
- `[x]` completed and verified
- `[!]` blocked; include the blocker and decision required

## Maintenance rules

1. Keep task IDs stable after they appear in a PR, issue, release note, or ADR.
2. Update this file in every PR that changes roadmap status, sequencing, scope, or exit criteria.
3. Mark work complete only after implementation, tests, documentation, and applicable CI checks pass.
4. Add newly discovered work under the closest phase instead of hiding it in PR comments.
5. Record intentional deferrals with a reason and the phase or condition that should reopen them.
6. Split tasks when a PR would otherwise mix unrelated architectural changes.
7. After a phase is fully completed and verified, replace its detailed task list with a concise baseline summary; retain the detailed record in merged PRs, ADRs, and Git history.

## Execution order

1. Phase 13 is complete through P13-07; ongoing dependency/security maintenance is tracked through the repository's normal security and issue workflows.
2. Phase 14 is complete through P14-07; the default workspace profile remains free of AI runtime dependencies.
3. Phase 15 follows completed Phase 14 and strengthens development-time agent portability and documentation ownership independently of runtime AI; P15-01 through P15-03 are planned.

## Phase 13 — Supply chain, CI scale, and documentation integrity

Goal: promote tested immutable artifacts with verifiable provenance while keeping CI fast and failures diagnosable.

Phase 13 progress record (2026-08-10): P13-01 is completed in reviewed PR #50 and squash commit `d4766a30d2e39f308a830ce4c6099edfe3ed045c`. P13-02 is completed in PR #52 and was hardened in PR #53. P13-03 is completed in PR #55 and merge commit `fe8a8644458803ca35d35e4262ccd39a9b02e825`; it adds pull-request cancellation, optional persisted BuildKit caches with deterministic local fallback, and retained failure diagnostics. P13-04 audits environment, Docker, generator, contract, and delivery cache inputs; adds deterministic invalidation fixtures; records a representative CI sample; moves required typecheck and build to affected execution; and retains explicit generator and generated-workspace coverage. P13-05 adds fail-closed documentation checks for links, paths, commands, environment names, identity and authentication descriptions, a generated Nx project-graph diagram, and roadmap-plus-ADR evidence for generator or boundary changes. P13-06 adds tamper-evident release records that bind immutable digests to SBOM and attestation verification, migration plans, backup identifiers, rollback-window and schema-compatibility decisions, and deployed smoke evidence; it also adds a quarterly isolated PostgreSQL restore exercise with retained recovery evidence. P13-07 is completed in reviewed PR #72 and merge commit `aa2cc96c14ede69f9f84e2465fb91304fbde2454`; it upgrades vulnerable owner dependencies, adds narrowly scoped transitive overrides where necessary, clears resolved audit exceptions, and rejects duplicate audit-baseline entries.

- [x] **P13-01 Add image and dependency supply-chain artifacts.**
  - Generate an SBOM for each production image.
  - Scan images and fail according to an explicit severity and exception policy.
  - Produce build provenance or attestations.
  - Sign published image digests and document verification.

- [x] **P13-02 Promote digests instead of rebuilding releases.**
  - Publish immutable images once after validation.
  - Record image digests in the release plan.
  - Promote the same tested digests between preview and production environments.
  - Add GitHub Environment approval and least-privilege permissions for production publication or deployment.

- [x] **P13-03 Improve CI cancellation, caching, and diagnostics.**
  - Add workflow concurrency and cancel superseded pull-request runs.
  - Add Docker BuildKit cache reuse.
  - Upload Playwright traces, screenshots, service logs, release plans, and performance reports after failures.
  - Keep deterministic local fallbacks when remote caching is unavailable.

- [x] **P13-04 Audit Nx cache inputs and affected execution.**
  - Declare environment-sensitive inputs for builds, generated contracts, containers, and delivery tasks.
  - Verify cache invalidation for public browser environment variables and image metadata.
  - Add fixtures proving that relevant environment, configuration, Docker, generator, and contract changes invalidate every required target while unrelated changes do not.
  - Record a representative CI baseline and verify that affected execution preserves required-check and generated-workspace coverage before replacing full-workspace steps.
  - Move full-workspace typecheck and build steps to affected execution when graph coverage proves it safe.
  - Re-evaluate Nx Cloud only after collecting the documented representative CI sample.

- [x] **P13-05 Add documentation integrity checks.**
  - Check internal links, referenced files, commands, and environment-variable names.
  - Detect stale identity and authentication descriptions.
  - Generate or validate architecture diagrams from the Nx project graph.
  - Require roadmap and ADR updates when generator output or architectural boundaries change.

- [x] **P13-06 Validate release metadata and rollback evidence.**
  - Attach SBOMs, attestations, digests, migration plans, backup identifiers, and smoke-test results to release records.
  - Add automated checks that the rollback window and schema-compatibility decision are recorded.
  - Exercise disaster recovery and restore procedures on a scheduled basis.

- [x] **P13-07 Remediate dependency vulnerabilities.**
  - Upgrade owning direct dependencies to patched compatible releases where available.
  - Use narrowly scoped transitive overrides only when the owning package cannot yet select the required patched release.
  - Remove resolved and duplicate dependency-audit baseline exceptions instead of extending them.
  - Verify frozen installation, dependency audit, affected Nx targets, delivery checks, and generated-workspace behavior on the exact PR head.

Exit criteria: production uses the exact image digests validated in preview, each artifact has scan results, SBOM, provenance, and signature, finalized production releases retain validated backup, migration, rollback, schema-compatibility, and smoke evidence, scheduled restore exercises prove the baseline recovery path, CI failures retain actionable evidence, dependency exceptions remain explicit, expiring, and non-duplicated, and documentation checks prevent known forms of drift.

## Phase 14 — Optional agentic application profile

Goal: offer reusable AI application capabilities without coupling ordinary generated web applications to a specific model provider or orchestration framework.

Phase 14 progress record (2026-08-12): P14-01 is completed by ADR 0020. It separates coding-agent repository support from runtime AI product capabilities, keeps provider-neutral contracts distinct from optional provider adapters, preserves `ai=false` as the default profile, and establishes fail-closed data-classification, explicit-retention, and server-side provider-selection constraints. P14-02 adds the backend `ModelClient` boundary for generation, JSON-Schema structured output, embeddings, and streaming; normalizes usage, cancellation, timeouts, errors, and bounded retries; and supplies an OpenAI native-fetch adapter plus a deterministic no-network adapter without adding a provider SDK dependency or wiring model calls into the default applications. P14-03 adds runtime-validated typed tools with mandatory invocation-time authorization, a strict V1 NDJSON agent-stream contract consumed by the web feature, and identifier-preserving browser decoding without composing AI runtime behavior into the default applications. P14-04 adds reviewed versioned prompt and tool-instruction artifacts, deterministic rule/model-grader evaluation boundaries, quality/latency/token/cost budgets, and a CI-enforced evidence manifest requirement for governed prompt, model, and tool changes without composing runtime AI into the default applications. P14-05 adds a backend-only replaceable durable-run adapter boundary with renewable leases and fences, idempotent ordered checkpoints, atomic human-approval pauses, approval-driven resume/rejection, interruption recovery, and payload-safe correlated observation while keeping persistence technology and durable-agent frameworks optional. P14-06 adds a backend-only governance boundary with runtime-validated input/output policy hooks, explicit data classifications, credential redaction/denial, server-owned tool allowlists, trusted approval authorization, payload-safe audit events, and bounded server-configured provider/model fallback that rechecks classification, region, retention, and capability compatibility. P14-07 is completed: the public preset composes those existing boundaries only when `ai=true`, generates and tests a reference workflow, and exact-head generated-workspace validation proves both default-profile isolation and the AI-enabled lifecycle.

- [x] **P14-01 Define profile boundaries in an ADR.**
  - Separate coding-agent repository support from runtime AI product capabilities.
  - Define which interfaces belong in the shared platform and which implementations remain optional.
  - Establish data classification, retention, and provider-selection constraints.

- [x] **P14-02 Add provider-neutral model interfaces.**
  - Define chat or generation, structured-output, embedding, and streaming interfaces.
  - Implement at least two provider adapters or one provider plus a deterministic test adapter.
  - Normalize timeouts, cancellation, usage, errors, and retry behavior.

- [x] **P14-03 Add typed tools and streaming transport.**
  - Define tools with runtime input and output schemas.
  - Add authorization at tool invocation boundaries.
  - Stream events through a versioned protocol consumed by the web profile.
  - Preserve trace, actor, conversation, model, and tool identifiers.

- [x] **P14-04 Add prompt and evaluation lifecycle.**
  - Version prompts and tool instructions as reviewed artifacts.
  - Add deterministic fixtures and model-graded or rule-based evaluations where appropriate.
  - Track quality, latency, token use, and estimated cost budgets.
  - Require evaluation evidence for prompt, model, or tool changes.

- [x] **P14-05 Add optional durable execution.**
  - Provide a replaceable adapter for checkpointing, resumable runs, human approval, and recovery after interruption.
  - Reuse the worker reliability, idempotency, and observability foundations from Phase 11.
  - Do not require a durable-agent framework in the default profile.

- [x] **P14-06 Add safety and governance hooks.**
  - Add input and output policy interfaces, sensitive-data handling, tool allowlists, and audit events.
  - Define model and provider fallback policy.
  - Document prompt-injection, data-exfiltration, excessive-agency, and runaway-cost mitigations.

- [x] **P14-07 Generate and test the AI profile.**
  - Add a preset option or generator that installs only the selected AI capabilities.
  - Add a reference workflow with streaming, one typed tool, persistence, evaluation, and observability.
  - Verify that the default non-AI profile contains no model-provider dependencies.

Exit criteria: the optional profile generates a provider-replaceable, observable, evaluated AI workflow with typed tools and explicit safety boundaries, while the base template remains free of AI runtime dependencies.

## Phase 15 — Portable agent ergonomics

Goal: make repository-specific operating knowledge discoverable on demand across maintained coding-agent hosts while keeping `AGENTS.md`, executable repository contracts, human-facing wiki documentation, and human approval boundaries clearly separated and authoritative for their audiences.

- [ ] **P15-01 Establish the portable Agent Skills contract.**
  - Keep root and nested `AGENTS.md` as concise always-on, agent-agnostic rules; use progressively disclosed skills for detailed repeatable procedures.
  - Use `.agents/skills` as the canonical repository-owned skill location and avoid maintaining vendor-specific duplicate skill sources.
  - Define deterministic validation for skill metadata, referenced files, repository commands, provenance, and least-privilege tool expectations.
  - Add initial repository-owned skills for architecture discovery and validation/debugging using only reviewed repository commands.
  - Require review and provenance for imported third-party skills; never auto-install unreviewed scripts.

- [ ] **P15-02 Generate and verify portable agent skills.**
  - Add maintained skills for release evidence and downstream upgrades after the core skill contract is proven.
  - Include the validated portable skill set in generated workspaces without requiring a specific commercial coding-agent product.
  - Prefer framework-provided, version-matched documentation and diagnostics, including Next.js packaged agent guidance and Nx MCP/project-graph context, over copied framework prose.
  - Demonstrate that at least two maintained agent hosts can discover the same repository rules and task procedures.
  - Preserve all existing human approval boundaries; no skill may grant production authority, credentials, or an alternate path around repository checks.

- [ ] **P15-03 Separate human and agent documentation surfaces.**
  - Establish the published GitHub Wiki, sourced from reviewed `wiki/` files, as the primary home for human-facing product, operator, onboarding, and explanatory documentation.
  - Keep repository-resident documentation focused on agent/machine-facing source-of-truth material needed for implementation, validation, governance, and review, including `AGENTS.md`, ADRs, contracts, generated evidence, and executable runbooks.
  - Keep the root `README.md` as the human landing page for the repository site, routing people to the Wiki and contributors/agents to the appropriate repository control surfaces; retain `docs/TODO.md` as the roadmap/control-plane exception unless a later migration explicitly replaces it.
  - Inventory root Markdown, `docs/`, and `wiki/`; classify each document by audience and authority, migrate or cull duplicated human-facing prose from repository documentation, and preserve only repository copies that have an implementation, automation, governance, or review reason to live beside the code.
  - Extend documentation-integrity checks so links and ownership rules prevent the Wiki and repository documentation from silently becoming competing sources of truth.

Exit criteria: portable agent procedures are validated and generated without vendor lock-in, at least two maintained agent hosts can discover the same repository rules and procedures, framework guidance is tied to installed versions rather than stale copied prose, human-facing documentation has one clear Wiki home with only explicit repository exceptions, agent/machine-facing guidance remains versioned beside the code, and no skill or documentation path weakens existing human approval gates.

## Definition of done for roadmap tasks

A task may be marked complete only when:

- implementation and migrations are merged
- focused unit, integration, contract, and end-to-end tests pass as applicable
- generated-workspace behavior is covered when the change affects the template
- security, delivery, and operational implications are documented
- relevant ADRs, runbooks, reference-feature documentation, and this roadmap are current
- the repository and generated workspace remain clean after validation
