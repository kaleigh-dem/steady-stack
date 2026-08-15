# Documentation Integrity

SteadyStack treats documentation as part of the executable repository contract. `pnpm docs:check` validates repository documentation, documentation-surface ownership, and the task-management control plane for the upstream `@steadystack/source` repository.

Initialized downstream products keep deterministic checker tests but intentionally skip upstream topology/content audits when their repository identity and structure differ.

## Authority and surfaces

The documentation model is:

- the Wiki is the primary human-facing documentation surface;
- README is a landing and routing exception;
- `AGENTS.md`, `.agents/skills`, repository contracts, runbooks, security/delivery controls, ADRs, and generated evidence stay beside the code for agents, automation, maintainers, and reviewers;
- GitHub Issues are the source of truth for actionable work;
- Milestones may group releases or larger coordinated work;
- ADRs retain durable architecture and governance decisions;
- closed Issues, merged PRs, and Git history retain completed-work history.

The retired `docs/TODO.md` file must not exist or be recreated as an authoritative task source.

## Task-management control-plane gate

The task-control regression audit scans the tracked upstream repository and fails when the old model returns in an active surface. It detects:

- recreation of `docs/TODO.md`;
- active Markdown or workflow guidance that references the retired roadmap as a task source;
- instructions to select the first or next unchecked task/TODO item;
- automation that discovers the next task from a Markdown roadmap;
- reviewer handoff examples or active guidance that require a roadmap-style `Pxx-xx` task identifier.

The audit deliberately permits historical evidence in `CHANGELOG.md`, ADRs, migration records, and evaluation evidence. Old task identifiers such as `P14-07` are valid history; they simply are not required identity for new work.

The current agent contract requires one explicitly assigned or explicitly selected **open GitHub Issue**. An agent with no selected Issue must remain idle rather than manufacture roadmap work. Reviewer handoffs use `TASK: #<issue>` and preserve exact-head/fail-closed validation.

## Documentation integrity checks

The upstream checker validates:

- Markdown links and repository-path references;
- documented root `pnpm` scripts and Nx commands;
- referenced Node scripts;
- documented environment-variable names;
- current authentication descriptions;
- legacy pre-SteadyStack identity outside explicit historical records;
- the generated Nx project-graph artifact;
- ADR evidence for generator or architectural-boundary changes;
- documentation-surface ownership;
- task-management control-plane regression rules.

GitHub Issue linkage cannot be proven from an offline local diff, so the documentation checker does not invent Issue identity. The PR workflow and repository automation own Issue linkage; PRs normally use `Closes #<issue>`.

## Documentation-surface ownership

Every tracked Markdown file in repository root, `docs/`, or `wiki/` must be classified by the documentation-surface checker.

The gate requires:

- root repository-control Markdown to have a declared machine/reviewer/governance reason;
- top-level `docs/` files to have an explicit repository-control classification;
- `docs/adr/`, generated evidence, runbooks, security, delivery, and operations documentation to remain classified repository controls;
- primary human-facing content to live under `wiki/`;
- required Wiki Home, Quick Start, and sidebar sources to exist;
- README to remain a routing surface with the required Wiki and control references.

Human-facing duplicates that were migrated to the Wiki must not be restored under `docs/`.

## Change evidence

Generator or architectural-boundary changes must update a relevant ADR when they alter a durable architecture or governance decision. The former requirement to update a Markdown roadmap is removed because actionable work is Issue-backed and lives in GitHub rather than the local diff.

If implementation discovers future actionable work, create or identify a GitHub Issue. Do not add a repository checklist to satisfy documentation validation.

## Commands

Run the complete documentation contract with:

```bash
pnpm docs:check
```

Regenerate the Nx project graph when project topology changes:

```bash
pnpm docs:architecture
```

Before review, the complete repository contract is:

```bash
pnpm check
```

Do not weaken documentation checks, historical allowlists, or task-control patterns to make a PR pass. If a new legitimate historical surface is needed, add the narrowest explicit classification and test why it is historical rather than excluding broad directories.

## Generated workspaces

Generated-workspace validation must prove the retired upstream roadmap is absent from initialized products. Downstream repositories are free to define product-specific planning practices, but SteadyStack generation must not copy an upstream Markdown task control plane into them.

Release validation remains independent of roadmap state. Release preparation and verification operate on exact repository/release identity and existing release contracts; deleting the retired roadmap must not create a release prerequisite or silently trigger release preparation.

## Reviewer bridge boundary

The local Python reviewer bridge is external to this repository. SteadyStack documents its required Issue-backed handoff contract in `docs/AUTOMATION_WORKFLOW.md`, including the exact parser/state changes required when migrating from roadmap IDs. Repository validation must not pretend that external bridge code was changed when it is unavailable.
