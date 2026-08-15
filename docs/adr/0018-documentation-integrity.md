# ADR 0018: Documentation Integrity

- Status: Accepted
- Date: 2026-08-05
- Scope: `P7-02` (historical task identifier)

## Context

SteadyStack documentation is part of the repository contract used by humans, coding agents, CI, generators, and operators. Stale links, commands, identities, task-selection instructions, architecture evidence, or authentication descriptions can cause the repository to be changed or operated incorrectly even when application code still compiles.

Documentation validation therefore needs to be deterministic, version-matched to the repository, and strict enough to fail when active control surfaces drift.

## Decision

SteadyStack maintains executable documentation-integrity checks with these responsibilities:

- validate tracked Markdown links and referenced repository paths;
- validate documented root and Nx commands against repository scripts and the project graph;
- validate documented environment-variable names and current authentication descriptions;
- reject legacy pre-SteadyStack identity outside explicit historical records;
- validate the generated Nx project-graph artifact;
- require ADR evidence when generator or architectural-boundary changes need a durable decision record;
- enforce documentation-surface ownership between the Wiki, README, repository control documents, and generated evidence;
- enforce the GitHub-Issues task-control model so the retired Markdown roadmap cannot silently return as an active work source.

Actionable work is represented by GitHub Issues. The selected open Issue owns task scope and acceptance criteria; PRs normally use `Closes #<issue>`. Milestones may coordinate releases or larger bodies of work. ADRs remain the durable record for architectural and governance decisions rather than becoming a task queue.

The documentation checker does not attempt to replace GitHub by inferring Issue identity from a local diff. Issue linkage is a PR/workflow responsibility. Repository checks instead prevent active instructions and automation from reverting to Markdown task discovery, while preserving historical references in ADRs, changelogs, migration records, and evidence.

## Consequences

- `pnpm docs:check` is a blocking repository validation surface.
- Changes to repository commands, identities, environment contracts, architecture, documentation ownership, or task-control instructions must update their documentation and tests in the same PR.
- Generator or architectural-boundary changes require a relevant ADR update when the existing decision record no longer describes the changed contract.
- Future actionable work discovered during a change belongs in a GitHub Issue, not a repository roadmap checklist.
- Historical task identifiers and historical descriptions may remain when they are evidence rather than current instructions.
- Initialized downstream products keep deterministic checker tests while upstream topology/content audits may intentionally skip when repository identity changes.
