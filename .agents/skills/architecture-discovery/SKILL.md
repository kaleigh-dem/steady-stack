---
name: architecture-discovery
description: Discover SteadyStack project ownership, dependency direction, source-of-truth files, and applicable repository rules before making a change. Use when orienting to a task, locating the correct project, or checking architectural boundaries.
license: MIT
metadata:
  steadystack-origin: repository
  steadystack-required-tools: read-files run-repository-commands
  steadystack-authority: none
---

# Architecture discovery

Use this skill after reading the root and closest `AGENTS.md`. It provides the repeatable discovery procedure; `AGENTS.md`, ADRs, executable contracts, and the roadmap remain authoritative.

## Procedure

1. Read the active task in `docs/TODO.md` and the relevant records under `docs/adr/`.
2. Discover projects and inspect the likely owner:

```bash
pnpm nx show projects
pnpm nx show project PROJECT_NAME
pnpm graph
```

3. Identify the source of truth before editing:
   - HTTP transport shapes: `packages/contracts/openapi/source`
   - asynchronous contracts: `packages/contracts/src`
   - backend domain/application behavior: `packages/backend/`
   - browser feature behavior: `packages/web/features/`
   - persistence and migrations: `packages/database`
   - application composition: `apps/`
   - environment contracts: `packages/env` and `infra/environments`
4. Use the project graph to identify direct dependencies and dependents. Prefer public package entry points and preserve existing scope, runtime, and project-type boundaries.
5. Before changing files, state the owning project or repository control surface, the authoritative source being changed, and which dependents require validation.

## Authority boundary

This skill does not override `AGENTS.md`, ADRs, contracts, `docs/TODO.md`, branch protection, validation, or human approval. It grants no credentials, production authority, architecture exception, or permission to weaken a repository check.
