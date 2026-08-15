# Repository Tour

This page explains how a human or AI agent should navigate the workspace: where deployable applications, reusable libraries, infrastructure, tooling, instructions, and documentation live, and why Nx context is more authoritative than folder browsing alone.

## Prerequisites

- A generated workspace with dependencies installed.

## Explore with Nx first

```bash
pnpm nx show projects
pnpm nx show project web
pnpm nx show project api
pnpm nx show project worker
pnpm graph
```

`pnpm graph` opens the interactive Nx project graph. Use it to inspect direct and transitive dependencies before moving code, changing boundaries, or selecting affected tests.

## Agent-facing control plane

The repository exposes its operating rules through several complementary surfaces:

- **GitHub Issues:** actionable-work scope and acceptance criteria; one open Issue must be explicitly assigned or selected.
- **`AGENTS.md`:** repository-wide instructions and subsystem-specific rules.
- **`.agents/skills/<name>/SKILL.md`:** canonical progressively disclosed repository procedures loaded only when relevant.
- **`.agents/skills/provenance.json`:** reviewed skill origin, license, script-review state, and complete-tree content hashes.
- **`.mcp.json`:** starts the Nx MCP server so compatible agent clients can query workspace context.
- **`project.json` and the Nx graph:** project ownership, tags, targets, dependencies, and affected analysis.
- **`src/index.ts` public entry points:** supported cross-project APIs.
- **`docs/adr`:** durable reasons for architectural decisions.
- **Root `package.json` scripts:** stable, copyable development and validation commands, including `pnpm agent-skills:check` in the root gate.
- **`workspace.template.json`:** generated repository identity, profile choices, provenance, and upgrade metadata.
- **Local generators:** approved write paths for repeated architectural structures.

Authority remains explicit. The explicitly selected open GitHub Issue defines actionable-work scope and acceptance criteria. Root and closest nested `AGENTS.md`, executable repository contracts/generated sources of truth, and applicable ADRs then constrain how that work is performed. A relevant `.agents/skills` procedure can supplement those sources but cannot override them, weaken validation, grant credentials or production authority, approve an architecture exception, or bypass a human approval gate.

If no open Issue is explicitly assigned or selected, a coding agent remains idle rather than scanning repository prose, Milestones, or historical task sequences for work.

P15-02 distributes the validated portable skill set into initialized products. Generated workspaces receive the same canonical `.agents/skills` tree and provenance registry, and `pnpm agent-skills:check` verifies both the skill contract and maintained-host discovery without creating vendor-specific copies.

An agent should combine these sources rather than treating any single README, folder tree, skill, or prior conversation as complete context.

## Deployable applications

| Path          | Purpose                                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`    | Next.js App Router composition root. Route files should remain thin and compose browser feature packages.                                                  |
| `apps/api`    | NestJS HTTP composition root. Controllers translate transport input/output and compose domain, database, security, rate-limit, and observability adapters. |
| `apps/worker` | Node.js worker composition root. Polls the PostgreSQL outbox, dispatches jobs, exposes operations endpoints, and drains during shutdown.                   |

Applications can depend on libraries. Applications must not import other applications.

## Shared and feature libraries

| Path                                | Purpose                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| `packages/backend/agent-task`       | Framework-free Agent Task domain and application use cases.                                       |
| `packages/backend/rate-limit`       | Framework-free policies and the `RateLimitStore` port.                                            |
| `packages/web/features/agent-tasks` | Browser-facing Agent Tasks feature, typed client behavior, and accessible UI states.              |
| `packages/ui`                       | Shared React presentation.                                                                        |
| `packages/contracts`                | OpenAPI source, generated client/server types, runtime validators, and versioned event contracts. |
| `packages/database`                 | PostgreSQL schema, migrations, repositories, outbox delivery, replay, and rate-limit adapters.    |
| `packages/env`                      | Node-only validated environment configuration.                                                    |
| `packages/observability`            | Structured logs, metrics, tracing, and OpenTelemetry setup.                                       |

Use package public entry points such as `src/index.ts`; do not deep-import internal files across projects.

## Contracts

HTTP contract changes start in `packages/contracts/openapi/source`. Generated files under `openapi/generated` and `src/generated` are outputs and must not be hand-edited. The API consumes server aliases and runtime validators; browser code consumes the generated client.

Versioned asynchronous event schemas live under `packages/contracts/src`. Additive changes are preferred; breaking changes require explicit versioning and compatibility review.

## Database and environment handling

`packages/database` owns PostgreSQL adapters, not domain models. Migrations are reversible by default and tracked separately from application tables. `.env.example` is the local configuration template; production examples are under `infra/environments`.

Application code should access environment variables through explicit configuration projects rather than reading `process.env` everywhere.

## Infrastructure and delivery

| Path                                | Purpose                                                                                                          |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `compose.yaml`                      | Local PostgreSQL and optional OpenTelemetry collector.                                                           |
| `infra/docker`                      | Production image Dockerfiles.                                                                                    |
| `infra/deploy/compose.preview.yaml` | Production-shaped local preview stack.                                                                           |
| `infra/environments`                | Preview and production environment examples.                                                                     |
| `infra/otel-collector-config.yaml`  | Local OpenTelemetry collector configuration.                                                                     |
| `tools/delivery`                    | Environment validation, preview orchestration, smoke tests, load tests, release plans, and production readiness. |
| `performance/budgets.json`          | Versioned local/CI performance thresholds.                                                                       |

## Workspace tooling

`tools/workspace-plugin` contains:

- the public released `preset`
- initialization
- domain, feature, job, and contract generators
- downstream upgrade binary and migrations
- file ownership policy

Use the root scripts rather than copying structures manually.

## Delivery and repository automation

`.github/workflows` contains separate CI, Security, Delivery, Generated workspace, template release, and image release workflows. Generated repositories remove upstream template-maintainer release machinery while retaining downstream validation and upgrade tooling.

## Documentation and decisions

- GitHub Issues contain upstream actionable work and acceptance criteria; PRs normally link implementation with `Closes #<issue>`.
- GitHub Milestones may group releases or coordinated work but do not replace Issue identity.
- `AGENTS.md` at the root defines repository-wide development rules; nested `AGENTS.md` files add subsystem-specific instructions.
- `.agents/skills/<name>/SKILL.md` is the canonical progressively disclosed procedure layer in both the upstream template and initialized products, with `.agents/skills/provenance.json` providing reviewed origin and complete-tree integrity records.
- `docs/agent-skills.md` and ADR 0026 define the Agent Skills metadata, authority, provenance, command, generation, and maintained-host discovery contract.
- `docs/adr` contains architectural decision records.
- `docs/runbooks` contains release rollback, disaster recovery, and degraded-dependency procedures.
- `docs/security` contains threat-model and identity operations guidance.
- closed Issues, merged PRs, and Git history retain completed-work history; historical `Pxx-xx` identifiers may remain in genuine historical evidence.

Generated application teams may define their own product backlog. P15-02-generated products contain the canonical portable skill registry and validate the same host-discovery contract as the upstream template, but the upstream maintainer task-control plane is not copied into them.

## Architectural tags

Every Nx project uses three tag dimensions:

- `scope:web`, `scope:backend`, or `scope:shared`
- `type:app`, `type:domain`, `type:feature`, `type:job`, `type:ui`, `type:contract`, `type:config`, `type:data-access`, or `type:util`
- `runtime:browser`, `runtime:node`, or a universal runtime tag

The executable constraints live in [`eslint.config.mjs`](https://github.com/kaleigh-dem/steady-stack/blob/main/eslint.config.mjs). See [Architecture](Architecture) for the enforced direction.

## Related pages

- [Agentic Development Model](Agentic-Development-Model)
- [Architecture](Architecture)
- [Everyday Development](Everyday-Development)
- [Code Generation](Code-Generation)

## Next steps

1. [Everyday Development](Everyday-Development)
2. [Architecture](Architecture)

[Back to Home](Home)
