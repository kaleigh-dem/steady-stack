# Template Roadmap

Last updated: 2026-08-14

This file tracks active work required to evolve the repository as a reusable, upgradeable application platform. Completed implementation history remains available in merged pull requests, ADRs, and Git history instead of being repeated as a separate historical roadmap.

## Completed baseline

Phases 2–15 established the current foundation:

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
- Phase 15 (P15-01–P15-03): portable repository-owned Agent Skills with reviewed provenance and maintained-host discovery, generated-workspace distribution with version-matched framework context, and an enforced documentation ownership split in which the published Wiki is the primary human-facing surface while repository Markdown is limited to explicit implementation, automation, governance, agent, evidence, runbook, review, and roadmap control purposes

Detailed completed-phase task lists are intentionally omitted. Relevant implementation evidence remains recorded in merged pull requests, `docs/adr/`, and Git history.

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

1. Phases 13–15 are completed baseline. Ongoing dependency, security, release, and documentation maintenance continues through the repository's normal workflows.
2. No roadmap implementation task follows P15-03 yet. Start future feature work under a new stable task ID and phase rather than extending a completed Phase 15 task.

## Phase 15 completion record

Phase 15 is complete as of 2026-08-14.

- P15-01 established `.agents/skills` as the canonical progressively disclosed procedure source, with deterministic metadata, command, provenance, capability, authority, third-party import, and script-review validation.
- P15-02 generates the reviewed skill set into initialized products, adds release-evidence and downstream-upgrade procedures, preserves exact skill/provenance bytes through product identity initialization, verifies maintained-host discovery against the same project-level skill root, and prefers installed Nx/Next.js context over copied framework prose.
- P15-03 establishes the reviewed `wiki/` source and published GitHub Wiki as the primary human-facing product, operator, onboarding, and explanatory documentation. The root `README.md` is a routing landing page; `docs/TODO.md` remains the roadmap exception; repository-resident Markdown is classified as an implementation, automation, governance, agent, evidence, runbook, review, or control surface. The documentation-integrity gate inventories root Markdown, `docs/`, and `wiki/`, rejects unclassified repository prose and restored onboarding duplication, and prevents README from becoming a second human manual.

The Phase 15 documentation and Agent Skills changes do not grant production authority, credentials, approval power, or an alternate path around repository checks. Human approval boundaries remain unchanged.

## Definition of done for roadmap tasks

A task may be marked complete only when:

- implementation and migrations are merged
- focused unit, integration, contract, and end-to-end tests pass as applicable
- generated-workspace behavior is covered when the change affects the template
- security, delivery, and operational implications are documented
- relevant ADRs, runbooks, reference-feature documentation, and this roadmap are current
- the repository and generated workspace remain clean after validation
