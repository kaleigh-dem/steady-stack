# SteadyStack

SteadyStack is a production-minded TypeScript web-application template for products built and maintained by humans and coding agents under human ownership.

This Wiki is the **primary human-facing documentation** surface for SteadyStack. Use it for product evaluation, onboarding, workspace profiles, everyday development, operations, production readiness, releases, upgrades, and troubleshooting. The main repository keeps a narrower set of versioned control surfaces for implementation, validation, governance, review, generated evidence, executable runbooks, and agent/machine instructions.

> **Agentic development is not a product AI feature.** Coding-agent compatibility comes from repository rules, portable skills, Nx context, generators, executable boundaries, and validation. The optional `ai=true` workspace profile is a separate runtime product choice.

> **Production remains human-owned.** Passing repository checks or having an agent prepare evidence does not grant credentials, protected-environment approval, deployment authority, rollback authority, or risk acceptance.

## Start here

1. [Quick Start](Quick-Start) — create, initialize, run, and validate a workspace.
2. [Choosing Workspace Profiles](Choosing-Workspace-Profiles) — choose applications, authentication, worker transport, telemetry, deployment, and optional AI composition.
3. [Repository Tour](Repository-Tour) — understand the project layout, `AGENTS.md`, portable skills, and source-of-truth boundaries.
4. [Agentic Development Model](Agentic-Development-Model) — understand the contributor/agent workflow and human approval boundaries.
5. [Everyday Development](Everyday-Development), [Code Generation](Code-Generation), and [Validation and Testing](Validation-and-Testing) — make and verify changes.
6. [Production Readiness](Production-Readiness), [Releases and Upgrades](Releases-and-Upgrades), and [Troubleshooting](Troubleshooting) — prepare and operate shared environments responsibly.

## What SteadyStack includes

- Next.js App Router web application and NestJS API;
- PostgreSQL-backed worker and shared data/contracts packages;
- Nx project graph, tags, generators, caching, affected execution, and MCP configuration;
- layered `AGENTS.md` rules plus canonical `.agents/skills` procedures;
- deterministic workspace initialization and ownership-aware upgrades;
- runtime contract enforcement, authentication boundaries, distributed rate limiting, observability, and production-shaped delivery controls;
- optional default-off AI runtime primitives and a generated reference profile when `ai=true` is selected;
- required validation, security, delivery, generated-workspace, and release evidence workflows.

Detailed implementation contracts live beside the code only when they need to remain version-matched to automation, validation, governance, review, generated evidence, or executable runbooks. Human-first explanation lives here in the Wiki.

## Documentation and work ownership

P15-03 established the audience split; Issue #88 moves actionable-work authority from the former Markdown roadmap to GitHub Issues:

- **Wiki:** primary human-facing documentation, reviewed under `wiki/` and published after merge.
- **README:** repository-site landing page that routes people to the Wiki and contributors/agents to controls.
- **Repository controls:** `AGENTS.md`, `.agents/skills`, ADRs, contracts, generated evidence, security/delivery controls, and executable runbooks.
- **Actionable work:** GitHub Issues. Coding agents require an explicitly assigned or explicitly selected open Issue and do not invent or discover roadmap work when none is selected.
- **Coordination:** GitHub Milestones may group releases or larger bodies of work without becoming task identity.
- **Decisions and history:** ADRs retain durable decisions; closed Issues, merged PRs, and Git history retain completed-work history.

The documentation-integrity suite inventories root Markdown plus `docs/` and `wiki/`, rejects unclassified repository prose, prevents the migrated onboarding duplicate from returning, keeps README constrained to a routing role, and prevents the retired Markdown task-control model from silently returning.

## Current status

Phases 13 and 14 are completed baseline. **Phase 15 is complete through the historical task P15-03:** the repository owns a canonical portable Agent Skills contract, generates it into initialized products, verifies maintained-host discovery for the same project-level skill root, and separates human-facing Wiki documentation from repository control surfaces with deterministic ownership checks.

Future actionable work is tracked in GitHub Issues. Historical `Pxx-xx` identifiers may remain in completed evidence, but new work uses its Issue number as task identity.

## Common tasks

| Goal                                    | Page                                                                                                                   |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Create and run a workspace              | [Quick Start](Quick-Start)                                                                                             |
| Choose workspace profiles               | [Choosing Workspace Profiles](Choosing-Workspace-Profiles)                                                             |
| Understand apps, packages, and controls | [Repository Tour](Repository-Tour)                                                                                     |
| Work with coding agents safely          | [Agentic Development Model](Agentic-Development-Model)                                                                 |
| Develop and generate code               | [Everyday Development](Everyday-Development), [Code Generation](Code-Generation)                                       |
| Understand architecture                 | [Architecture](Architecture)                                                                                           |
| Configure authentication                | [Authentication and Authorization](Authentication-and-Authorization)                                                   |
| Operate PostgreSQL and workers          | [Database and Data Management](Database-and-Data-Management), [Worker and Background Jobs](Worker-and-Background-Jobs) |
| Validate changes and diagnose CI        | [Validation and Testing](Validation-and-Testing), [CI Diagnostics](CI-Diagnostics)                                     |
| Build preview/release evidence          | [Containers and Preview Environments](Containers-and-Preview-Environments), [Image Supply Chain](Image-Supply-Chain)   |
| Prepare production                      | [Repository and GitHub Setup](Repository-and-GitHub-Setup), [Production Readiness](Production-Readiness)               |
| Release, upgrade, or recover            | [Releases and Upgrades](Releases-and-Upgrades), [Troubleshooting](Troubleshooting)                                     |
| Review documentation ownership          | [Documentation Audit](Documentation-Audit)                                                                             |

## Source of truth

When a human-facing Wiki explanation and a repository control appear to overlap, use them for different purposes: the Wiki explains the workflow and decisions to people; the repository control remains authoritative for executable behavior, implementation constraints, validation, governance, or review evidence. If they conflict, fix the Wiki explanation or the implementation/control surface rather than maintaining two competing human manuals.

[Back to Home](Home)
