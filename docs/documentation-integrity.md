# Documentation integrity

SteadyStack treats documentation as a validated interface. The repository checks reviewed Markdown against files, commands, configuration names, identity rules, authentication behavior, Nx architecture, and P15-03 documentation-surface ownership.

## Run the checks

Install dependencies, then run:

```bash
pnpm docs:check
```

The command runs focused Node tests and the repository audit. It is also part of `pnpm check` and required pull-request CI.

Regenerate the architecture artifact after adding, removing, retagging, or rewiring an Nx project:

```bash
pnpm docs:architecture
pnpm docs:check
```

Commit `docs/architecture/project-graph.md` with the source change. The file is generated from `pnpm nx graph --file=...`; do not edit it manually.

## Documentation surface ownership

The published GitHub Wiki, sourced from reviewed `wiki/` files, is the primary human-facing product, onboarding, operator, and explanatory documentation surface.

Repository Markdown is intentionally narrower:

- `README.md` is the human landing-page exception and routes readers to the Wiki and repository controls;
- `AGENTS.md` and `.agents/skills` provide agent-facing rules and procedures;
- `docs/TODO.md` remains the roadmap/control-plane exception;
- ADRs, implementation contracts, generated evidence, validation/security/release controls, and executable runbooks remain beside the code because agents, automation, reviewers, or operators need them as version-matched repository controls.

`tools/documentation/documentation-surfaces.mjs` inventories tracked root Markdown plus `docs/` and `wiki/`, classifies each document by audience and authority, requires the core reviewed Wiki sources, rejects unclassified repository prose, prevents the migrated onboarding duplicate from returning, and constrains README to a routing surface. The focused suite is imported by the existing documentation-integrity test entry point, so the ownership rules run through `pnpm docs:check` without creating a second validation command.

## Scope

The content, topology, and documentation-surface audits are specific to the reviewed upstream template package, `@steadystack/source`. Initialization intentionally removes template-maintainer workflows and release documents, replaces the public identity with the adopting product identity, and can remove projects through profile selection. An initialized downstream workspace therefore runs the deterministic test code but skips the upstream repository inventory/topology audits. Adopting teams can extend the inherited validation command with product-specific documentation rules.

## What is validated

The upstream audit checks:

- relative Markdown links and linked files;
- repository paths written in inline code;
- root `pnpm` scripts, static `node` entry points, Nx project names, and Nx targets shown in shell examples;
- environment variables documented in dotenv blocks or inline code;
- retired pre-SteadyStack identity outside approved historical records;
- the implemented browser profiles and OIDC verifier behavior described in authentication repository controls;
- byte-for-byte agreement between the committed Mermaid diagram and the current Nx project graph;
- roadmap and ADR evidence for changes to generator output or architectural boundaries;
- audience/authority classification for tracked root, `docs/`, and `wiki/` Markdown;
- the Wiki-first human documentation rule and the README landing-page exception.

External URLs and section anchors are not fetched. Their availability and prose quality remain review responsibilities. Explicit generator examples and untracked runtime environment files are recognized as examples rather than repository artifacts.

## Change-evidence gate

A pull request must update both `docs/TODO.md` and at least one file under `docs/adr/` when it changes any of these surfaces:

- workspace generator implementations or template lifecycle files;
- `eslint.config.mjs`, `nx.json`, or `tsconfig.base.json`;
- the tags or implicit dependencies of an existing `project.json`;
- the addition, removal, or rename of an Nx project.

The gate uses the exact Nx base and head revisions supplied by CI. Local source archives without a comparison ref still run every content and graph check, but skip only this diff-based requirement.

## Fixing failures

Treat the implementation or designated control surface as the source of truth unless that source is itself wrong.

- Broken link or path: correct the destination or restore the referenced file.
- Unknown command: correct the example or add the intended reviewed script or target.
- Unknown environment variable: correct the name and keep the canonical environment example or implementation source current.
- Stale identity or authentication language: align the repository control; preserve retired names only in approved migration and historical ADR files.
- Stale graph: run `pnpm docs:architecture` and review the dependency change.
- Missing change evidence: update the roadmap and record the durable architectural decision in an ADR.
- Unclassified Markdown: move human-first prose to `wiki/` or add an explicit repository-control classification with a concrete implementation, automation, governance, review, evidence, or runbook reason.
- README ownership failure: keep README as a landing/routing surface and move detailed human guidance to the Wiki.

The checker writes the expected graph to the CI diagnostics directory when graph validation fails, so the normal retained CI failure artifact contains the correction candidate.
