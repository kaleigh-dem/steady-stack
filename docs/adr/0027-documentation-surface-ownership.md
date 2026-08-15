# ADR 0027: Documentation Surface Ownership

- Status: Accepted
- Date: 2026-08-12
- Scope: `P15-03` (historical task identifier)

## Context

SteadyStack previously accumulated human-facing explanation and repository-control documentation across README, root Markdown, `docs/`, and the Wiki. That duplication made it unclear which surface humans should read and which files existed because agents, automation, reviewers, generators, or operators needed version-matched repository contracts.

The P15-03 documentation audit established a single human-facing documentation home while preserving executable repository controls beside the code. The later GitHub-Issues task-management migration removes the former Markdown-roadmap exception from that ownership model.

## Decision

Documentation ownership is split by audience and authority:

- `wiki/*.md` is the reviewed source for primary human-facing explanation, onboarding, development, operations, releases, upgrades, and troubleshooting.
- Root `README.md` is the repository-site landing and routing exception. It may summarize repository control surfaces but must not become a second manual.
- Root and nested `AGENTS.md`, `.agents/skills`, implementation contracts, validation contracts, executable runbooks, security/delivery controls, generated evidence, and review/automation protocols remain versioned beside the code for agents, automation, maintainers, and reviewers.
- GitHub Issues are the source of truth for actionable work. An explicitly assigned or explicitly selected open Issue is required before agent work begins.
- GitHub Milestones may group releases or larger coordinated work; they are not an alternate task queue.
- `docs/adr/` remains the durable architecture and governance decision record.
- Git history, closed Issues, and merged PRs retain completed-work history.

There is no repository Markdown roadmap/task-authority exception. A newly added root or `docs/` Markdown file must have an explicit repository-control reason or be moved to the Wiki.

Historical references to the former task system may remain in ADRs, changelog entries, migration records, or evidence where they provide genuine history. They do not confer current authority.

## Consequences

- README and Wiki do not enumerate the `docs/` directory as a second human manual.
- Human-facing product and operator explanation belongs in reviewed Wiki sources.
- Version-sensitive implementation, automation, validation, security, release, and agent contracts remain in the repository.
- The documentation-surface gate no longer classifies a Markdown roadmap as an active control surface.
- The documentation-integrity gate prevents recreation of the retired roadmap as an authoritative task source and prevents active instructions from telling agents or automation to discover work from a Markdown checklist.
- Issue identity is independent of work category, so implementation, maintenance, documentation, governance, and proposal work use the same `#<issue>` identity model.
- Durable architectural decisions stay in ADRs; actionable follow-up from those decisions is tracked in Issues.
