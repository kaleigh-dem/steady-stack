# Template Roadmap

Last updated: 2026-08-12

This file tracks active work required to evolve the repository as a reusable, upgradeable application platform. Completed implementation history remains available in merged pull requests, ADRs, and Git history instead of being repeated as a separate historical roadmap.

## Completed baseline

Phases 2–14 established the current foundation:

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
- Phase 13 (P13-01–P13-07): image and dependency supply-chain evidence, immutable digest promotion, CI cancellation/caching/diagnostics, cache-input and affected-execution auditing, documentation integrity, release/rollback/recovery evidence, and dependency-vulnerability remediation
- Phase 14 (P14-01–P14-07): a default-off optional AI profile with provider-neutral model interfaces, typed authorized tools and browser streaming, governed prompt/evaluation evidence, replaceable durable execution, safety/governance hooks, and deterministic generated reference-profile composition while the ordinary profile remains isolated from AI runtime dependencies

Detailed completed-phase task lists are intentionally omitted. Relevant implementation evidence remains recorded in merged PRs #2–#81, `docs/adr/`, and Git history.

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

1. Phases 13 and 14 are completed baseline; ongoing dependency/security maintenance continues through the repository's normal security and issue workflows, and the default workspace profile remains free of AI runtime dependencies unless the optional AI profile is selected.
2. Phase 15 is the active roadmap and strengthens development-time agent portability and documentation ownership independently of runtime AI; P15-01 is in progress, while P15-02 and P15-03 remain planned.

## Phase 15 — Portable agent ergonomics

Goal: make repository-specific operating knowledge discoverable on demand across maintained coding-agent hosts while keeping `AGENTS.md`, executable repository contracts, human-facing wiki documentation, and human approval boundaries clearly separated and authoritative for their audiences.

Phase 15 progress record (2026-08-12): P15-01 is in progress. The upstream repository now defines `.agents/skills` as the canonical open Agent Skills source, adds repository-owned architecture-discovery and validation/debugging skills, records reviewed provenance/content hashes, and introduces deterministic metadata/reference/command/least-privilege validation through `pnpm agent-skills:check`. Generated-workspace installation and multi-host discovery remain P15-02 scope; P15-01 completion remains gated on applicable exact-head validation and review.

- [-] **P15-01 Establish the portable Agent Skills contract.**
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
