# Documentation Audit

This page records the current documentation ownership model and the P15-03 audit that separates human-facing guidance from repository control surfaces.

## Result

P15-03 is complete. The reviewed `wiki/` tree is the primary human-facing documentation source. Root and `docs/` Markdown remain only when they have an implementation, automation, governance, review, generated-evidence, executable-runbook, release, security, compatibility, or agent/machine reason to live beside the code. The root README is the human landing exception, and the repository roadmap remains the task-control exception.

The generated-workspace onboarding guide that previously lived under `docs/` was culled because [Quick Start](Quick-Start) already owns that human journey. README was reduced from a second manual to a routing page.

## Audience and authority matrix

| Surface                                            | Primary audience                                                  | Authority                                                            |
| -------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| `wiki/*.md`                                        | Humans evaluating, adopting, developing, or operating SteadyStack | Primary human-facing explanation                                     |
| root `README.md`                                   | Repository-site visitors                                          | Human landing/routing exception                                      |
| root and nested `AGENTS.md`                        | Coding agents and contributors                                    | Always-on repository rules                                           |
| `.agents/skills`                                   | Coding agents                                                     | Reviewed progressively disclosed procedures; no production authority |
| `docs/TODO.md`                                     | Maintainers/reviewers                                             | Roadmap and task control plane                                       |
| `docs/adr/`                                        | Maintainers, agents, reviewers                                    | Durable architecture/governance decisions                            |
| implementation contracts under `docs/`             | Agents, automation, reviewers, operators                          | Version-matched repository control                                   |
| generated architecture/evaluation evidence         | Automation and reviewers                                          | Generated evidence                                                   |
| security/delivery controls and executable runbooks | Operators, automation, reviewers                                  | Version-matched operational control                                  |

## Deterministic ownership gate

`pnpm docs:check` imports the P15-03 documentation-surface suite. The suite inventories every tracked Markdown file in repository root, `docs/`, and `wiki/` and fails when:

- a root or `docs/` Markdown file has no declared repository-control classification;
- the migrated onboarding duplicate is restored;
- the required Wiki Home, Quick Start, or sidebar source is missing;
- README regrows non-routing sections or loses required Wiki/control routes;
- Wiki Home stops identifying the Wiki as the primary human-facing documentation surface.

The gate runs only for the upstream `@steadystack/source` topology. Generated products are not required to preserve upstream maintainer documentation and may define their own product-specific documentation policy.

## Reviewed human information architecture

1. Home
2. Agentic Development Model
3. Quick Start
4. Choosing Workspace Profiles
5. Repository Tour
6. Everyday Development
7. Code Generation
8. Architecture
9. Optional AI Runtime
10. Authentication and Authorization
11. Database and Data Management
12. Worker and Background Jobs
13. Validation and Testing
14. CI Diagnostics
15. Containers and Preview Environments
16. Repository and GitHub Setup
17. Image Supply Chain
18. Production Readiness
19. Releases and Upgrades
20. Troubleshooting
21. Documentation Audit
22. `_Sidebar` and `_Footer`

The Wiki explains these topics to people. Where an implementation-level repository contract also exists, the Wiki links to it as the version-matched source for executable behavior rather than copying that contract as a second human manual.

## Publication model

The hidden rendered Wiki repository does not participate in ordinary pull-request review. Reviewed source lives under `wiki/`, and `.github/workflows/wiki-publish.yml` publishes changed pages after they merge to `main`. Rendered page deletions remain explicitly reviewed through `wiki/deletions.txt`.

If rendered content differs from reviewed `wiki/` source, correct the publication mechanism and republish. Do not edit the rendered Wiki as an independent source of truth.

## Phase 15 outcome

P15-01 established the canonical portable Agent Skills contract. P15-02 generates the reviewed skill set into initialized products and proves maintained-host discovery for the same project-level `.agents/skills` root. P15-03 completes the phase by separating human and agent/machine documentation surfaces and enforcing that ownership split in deterministic documentation checks.

Human approval boundaries remain unchanged throughout Phase 15. Documentation and skills may guide work and prepare evidence, but they do not grant credentials, deployment authority, protected-environment approval, rollback authority, or risk acceptance.
