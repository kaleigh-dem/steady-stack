---
name: architecture-discovery
description: Discover workspace ownership, dependency direction, version-matched framework guidance, source-of-truth files, and applicable repository rules before making a change. Use when orienting to a task, locating the correct project, or checking architectural boundaries.
license: MIT
metadata:
  steadystack-origin: repository
  steadystack-required-tools: read-files run-repository-commands
  steadystack-authority: none
---

# Architecture discovery

Use this skill after reading the root and closest `AGENTS.md`. It provides the repeatable discovery procedure; the explicitly selected open GitHub Issue, `AGENTS.md`, ADRs, and executable contracts remain authoritative.

## Procedure

1. Read the explicitly selected open GitHub Issue completely, including relevant comments, and read the relevant records under `docs/adr/`.
2. Prefer live, version-matched workspace and framework context over copied prose:
   - when the host supports MCP, use the Nx server configured in `.mcp.json` for project and dependency context;
   - inspect the installed Nx project graph and targets rather than inferring boundaries from folders;
   - for Next.js work, read the packaged documentation under `node_modules/next/dist/docs/` that ships with the installed Next.js version before relying on remembered framework behavior.
3. Discover projects and inspect the likely owner:

```bash
pnpm nx show projects
pnpm nx show project PROJECT_NAME
pnpm graph
```

4. Identify the source of truth before editing:
   - HTTP transport shapes: `packages/contracts/openapi/source`
   - asynchronous contracts: `packages/contracts/src`
   - backend domain/application behavior: `packages/backend/`
   - browser feature behavior: `packages/web/features/`
   - persistence and migrations: `packages/database`
   - application composition: `apps/`
   - environment contracts: `packages/env` and `infra/environments`
5. Use the project graph to identify direct dependencies and dependents. Prefer public package entry points and preserve existing scope, runtime, and project-type boundaries.
6. Before changing files, state the owning project or repository control surface, the authoritative source being changed, and which dependents require validation.

## Authority boundary

This skill does not override the selected GitHub Issue, `AGENTS.md`, ADRs, contracts, branch protection, validation, or human approval. It grants no credentials, production authority, architecture exception, or permission to weaken a repository check.
