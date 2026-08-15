# Agent Operating Guide

## Purpose

This repository is operated using an issue-driven agent workflow.

Agents must work on **exactly one explicitly assigned or explicitly selected open GitHub Issue at a time**. GitHub Issues are the source of truth for actionable work; GitHub Milestones may group releases or larger coordinated work, but they do not replace Issues.

If no open Issue has been assigned or explicitly selected for the agent, the agent must stop. It must not scan repository prose for a next task, invent roadmap work, or create implementation scope from an unassigned idea.

---

## Canonical Sources

Agents must treat these as authoritative for their respective concerns:

1. The explicitly selected open GitHub Issue — task scope and acceptance criteria.
2. Applicable `AGENTS.md` files — repository and subsystem operating rules.
3. `docs/AUTOMATION_WORKFLOW.md` — development, validation, and exact-head reviewer protocol.
4. `.github/pull_request_template.md` — PR evidence contract.
5. `docs/adr/` — durable architecture and governance decisions.
6. `README.md` and the Wiki — contributor routing and human-facing documentation.

If Issue scope and repository state disagree, agents must stop and report the inconsistency rather than silently broadening the Issue.

Historical identifiers such as `P14-07` may remain in ADRs, changelogs, evidence, or migrated Issue text for traceability. They are not required task identity for new work. Use the GitHub Issue number, for example `#88`.

---

## Issue Selection

- Work only from an **open GitHub Issue** that a human or controlling workflow explicitly assigned or selected.
- Never choose work merely because it appears next in a Markdown file, comment, milestone, or historical task sequence.
- Never create new roadmap work independently because no Issue is available.
- Never expand scope beyond the selected Issue without explicit human direction or an Issue update.
- Only one Issue may be advanced per PR unless the selected Issue explicitly requires coordinated closure of another Issue.
- For implementation PRs, normally use `Closes #<issue>` so merge history and Issue history remain connected.
- Maintenance, documentation, governance, and proposal work use the same Issue-backed identity model as feature implementation.

---

## Research-First and Proposal Issues

Some Issues intentionally ask for research, governance, documentation, or a proposal before implementation.

For those Issues:

- produce only the evidence or artifact the Issue requests;
- do not turn a proposal into implementation unless the Issue authorizes it;
- record durable architecture decisions in an ADR when required;
- keep future actionable work in GitHub Issues rather than adding a repository roadmap checklist.

---

## Workflow (Ascending Privilege)

### 1. Inspect the Issue

Before editing:

1. confirm the explicitly selected Issue number;
2. fetch the current Issue and verify it is open;
3. read the full body and relevant comments;
4. identify acceptance criteria, constraints, and affected control surfaces;
5. read the root and closest nested `AGENTS.md`, relevant ADRs, and repository guidance.

If the Issue is closed, missing, ambiguous, or no longer matches repository state, stop and report the problem.

### 2. Inspect Before Editing

Use the project graph, public package entry points, generators, contracts, and existing tests to locate the correct ownership boundary. Prefer repository commands and documented workflows over guessed tool invocations.

### 3. Make the Smallest Coherent Change

Keep the change atomic to the selected Issue. Do not mix unrelated cleanup, speculative work, or another Issue into the same PR.

### 4. Validate Locally

Follow `docs/AUTOMATION_WORKFLOW.md` and repository scripts. Run focused checks while iterating and the complete applicable validation contract before review when the environment supports it.

Never weaken CI, security, documentation integrity, exact-head review, or fail-closed checks to make a change pass.

### 5. Publish Review Evidence

Open a PR linked to the Issue. The PR must explain the change, acceptance-criteria evidence, validation performed, risks, generated artifacts, and any unavailable gate.

When the external/local reviewer bridge is used, hand off only the exact current PR head and the selected GitHub Issue identity. A changed head requires a new review state.

### 6. Complete Only With Evidence

An Issue is complete only when its acceptance criteria have implementation or documentation evidence, required validation is green for the exact reviewed head, required review is satisfied, and the PR has merged.

Do not close an Issue merely because an agent reports completion.

---

## Pull Request Requirements

Every PR implementing actionable work should normally:

- identify the selected GitHub Issue with `Closes #<issue>`;
- map acceptance criteria directly to that Issue;
- list validation commands and results;
- call out unavailable or external validation instead of claiming it ran;
- preserve exact-head review semantics for any reviewer handoff;
- document migration or follow-up evidence when the Issue requires it.

---

## Definition of Done

For the selected Issue:

- Issue acceptance criteria are satisfied with reviewable evidence;
- implementation, tests, and documentation are coherent;
- required formatting, lint, typecheck, tests, documentation, security, generated-workspace, release, or affected checks pass as applicable;
- exact-head CI and required local review pass when required;
- no unrelated Issue scope was added;
- durable decisions are captured in ADRs where appropriate;
- future actionable work discovered during implementation is represented by an Issue rather than a Markdown roadmap;
- the PR is ready to merge under repository policy.
