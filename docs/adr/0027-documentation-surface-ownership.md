# ADR 0027: Separate human and repository documentation surfaces

- Status: Accepted
- Date: 2026-08-14
- Task: P15-03

## Context

SteadyStack historically accumulated human onboarding and explanatory prose in both repository Markdown and the reviewed Wiki source. That duplication made it possible for two independently edited documents to describe the same workflow, status, or operating model while appearing equally authoritative.

The repository also contains Markdown that must remain versioned beside implementation because it is consumed by agents, automation, validation, reviewers, release processes, governance, or generated-workspace contracts. Treating every Markdown file as interchangeable human documentation would weaken those executable control surfaces.

## Decision

The published GitHub Wiki, sourced from reviewed `wiki/` files, is the primary human-facing documentation surface for product evaluation, onboarding, workspace profiles, operations, production readiness, releases, upgrades, and explanatory guidance.

The root `README.md` is the repository-site landing exception. It routes people to the Wiki and routes contributors and coding agents to repository controls; it is not a second operator or onboarding manual. `docs/TODO.md` remains the roadmap/control-plane exception.

Repository-resident Markdown under root and `docs/` must have an explicit implementation, automation, governance, review, generated-evidence, executable-runbook, release, security, compatibility, or agent/machine reason to live beside the code. Root `AGENTS.md`, ADRs, contracts, generated architecture/evaluation evidence, security and delivery controls, and executable runbooks remain repository-authoritative for those purposes.

The former generated-workspace onboarding guide under `docs/` is removed because the Wiki Quick Start already owns that human journey. Future human-first guides belong under `wiki/` rather than reintroducing a repository copy.

## Deterministic enforcement

`tools/documentation/documentation-surfaces.mjs` classifies every tracked Markdown file in the P15-03 inventory scope: root Markdown plus `docs/` and `wiki/`.

The gate:

- treats all reviewed `wiki/*.md` pages as primary human-facing source;
- treats `README.md` as the only human landing exception in repository root;
- records the allowed repository-control reasons for root and top-level `docs/` Markdown and for control/evidence subtrees;
- rejects an unclassified root or `docs/` Markdown file;
- rejects restoration of the migrated onboarding duplicate;
- requires the Wiki Home, Quick Start, and sidebar sources;
- constrains README to routing-oriented sections and required control links;
- runs only for the upstream `@steadystack/source` repository so generated products are not forced to retain upstream documentation topology.

The focused ownership suite is imported by the existing documentation-integrity test entry point, so `pnpm docs:check` and therefore `pnpm check` fail closed when the surfaces drift.

## Consequences

Human readers have one reviewed explanatory home. Repository documentation remains close to the implementation only when proximity provides an executable or governance benefit. Adding a new root or `docs/` Markdown file now requires an explicit repository-control classification instead of silently creating a competing human source of truth.

The Wiki remains published through the reviewed `wiki/` source and the existing publication workflow. Human approval boundaries are unchanged: documentation and agent procedures can route, explain, validate, and prepare evidence, but they cannot grant production credentials, protected-environment approval, deployment authority, or risk acceptance.
