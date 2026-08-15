# Automated Development and Local Review Workflow

This document is the durable protocol for the low-Codex-credit development loop. GitHub and the repository are authoritative; chat history is not. ChatGPT performs development work, deterministic CI proves broad correctness, a local Python bridge performs routing and state management, and Codex is invoked only for a focused exact-head local review.

## Source of truth

Use current data in this order:

1. The explicitly assigned or explicitly selected **open GitHub Issue** for task scope and acceptance criteria.
2. GitHub pull-request metadata, exact head SHA, review threads, comments, labels, and workflow results.
3. Applicable `AGENTS.md` files, ADRs, repository code, and executable contracts.
4. The local bridge SQLite state and only the latest compact handoff.
5. Chat history only as advisory context.

GitHub Issues are the source of truth for actionable work. Milestones may group releases or larger coordinated work, but they are not task identity. Durable architectural decisions remain in ADRs. Completed-work history remains in closed Issues, merged PRs, and Git history.

Never copy old chat history forward. Ignore superseded PR heads, resolved findings, and handoffs whose `SOURCE + HEAD + ACTION` key has already been consumed in GitHub or the bridge state store.

## Task selection

An agent may start work only when an **open GitHub Issue has been explicitly assigned to it or explicitly selected by a human or controlling workflow**.

1. Fetch the selected Issue and verify that it is open.
2. Read the complete Issue body and relevant comments.
3. Record the Issue number, title, acceptance criteria, constraints, and affected control surfaces.
4. Search for an existing PR for the Issue before creating a branch.
5. Work on only that Issue until its PR is merged, abandoned, or the controlling human explicitly changes the selection.

If no Issue is assigned or selected, remain idle. Do not scan a Markdown roadmap, select work by historical task sequence, infer a next task from a milestone, or invent new roadmap work.

Use the Issue number as task identity, for example `#88`. Historical identifiers such as `P14-07` may remain in historical evidence but are not required for new work. The same Issue-backed identity applies to implementation, maintenance, documentation, governance, and proposal work.

## Roles

### ChatGPT Scheduled Developer

- Runs in ChatGPT using the strongest practical reasoning level and the authorized GitHub connector.
- Implements one explicitly selected open Issue or fixes one existing PR. It never reviews, approves, or merges its own work.
- Does not begin another Issue while a PR or requested fix is active.
- Reads `AGENTS.md`, the selected Issue, relevant ADRs, the active PR, review threads, and exact-head workflow results before changing code.
- Publishes through the GitHub connector. Missing Mac-local `gh` or Codex authentication is not a blocker for the ChatGPT environment.
- When Docker or another OS-level feature is unavailable, preserves completed validation, documents the unavailable gate in the PR, and relies on exact-head CI for that gate.
- After a ready head or fix is pushed and all required workflows pass, posts one valid `[reviewer-handoff]` comment.
- An optional scheduled run may monitor the **already selected Issue or active PR** for new `CHANGES_REQUIRED` results. It must not discover or choose unrelated work when no Issue is selected.

### Local Python Review Bridge

- Runs on the trusted local development machine continuously or on demand.
- Polls GitHub or receives a future webhook; it does not use a model for monitoring, deduplication, scheduling, or state reconstruction.
- Consumes only the newest valid unconsumed `[reviewer-handoff]` for each PR.
- Deduplicates by `SOURCE + HEAD + ACTION` in GitHub and SQLite.
- Verifies that the PR is open, non-draft, targets `main`, is conflict-free, and still points to the full handed-off SHA.
- Verifies that configured required workflows passed for that exact SHA.
- Accepts only named verification profiles from local configuration. A PR comment can never provide a shell command.
- Validates `TASK` as a GitHub Issue reference and fails closed when the referenced Issue is missing or closed.
- Creates a disposable detached Git worktree at the exact SHA.
- Runs allowlisted deterministic commands as argument arrays without a shell.
- Invokes Codex only after deterministic local validation passes.
- Posts structured PASS, CHANGES_REQUIRED, or REVIEW_ERROR results to GitHub.
- Removes the worktree after success or failure and retains only compact local state and logs.
- Does not implement product fixes.
- Does not merge unless automatic merging is explicitly enabled and every exact-head merge gate passes.

### Local Codex Reviewer

- Is invoked on demand by the Python bridge through non-interactive `codex exec`; it has no polling heartbeat or supervisor schedule.
- Uses the real local worktree and reviews only the handed-off exact head.
- Runs proportionate additional functional checks rather than repeating the complete CI suite.
- Never implements fixes, broadens scope, or makes style-only recommendations.
- Returns schema-constrained PASS or FAIL output with reproducible findings.
- Leaves tracked files unchanged. A tracked-file modification converts the result to failure.

### Human Operator

- Selects or assigns Issues and owns changes to task scope when automation cannot infer them safely.
- Authenticates `gh` and Codex on the trusted machine and maintains the local bridge configuration.
- Intervenes for credentials, product decisions, destructive actions, unsupported tooling, or failed bridge recovery.
- Keeps automatic merge disabled until several one-shot review cycles have behaved correctly.

## State flow

`explicit open Issue -> ChatGPT development -> exact-head CI -> reviewer handoff -> Python validation -> local Codex review -> PASS or CHANGES_REQUIRED -> merge or ChatGPT fix`

GitHub is the durable handoff queue. A direct chat message is never required for correctness. Python replaces reviewer heartbeats and the former AI supervisor.

## Compact reviewer handoffs

Every handoff is at most 12 lines and 900 characters. Fetch detail from GitHub; never paste diffs, logs, Issue bodies, or full blocker explanations when IDs and locations are enough.

First review:

```text
[reviewer-handoff]
TYPE: REVIEW_READY
TASK: #88
PR: 90
HEAD: <full 40-character lowercase SHA>
VERIFY: contracts
CHECKS: GREEN
ACTION: REVIEW_EXACT_HEAD
```

Re-review after fixes:

```text
[reviewer-handoff]
TYPE: RE_REVIEW
TASK: #88
PR: 90
HEAD: <full 40-character lowercase SHA>
VERIFY: contracts
SOURCE: <prior review or blocker ID>
CHECKS: GREEN
ACTION: REVIEW_EXACT_HEAD
```

Rules:

- `REVIEW_READY` and `RE_REVIEW` are the only valid types.
- `REVIEW_EXACT_HEAD` is the only valid action.
- `TASK` is exactly `#` plus a positive GitHub Issue number for the same repository.
- The bridge must resolve `TASK` through GitHub and require the Issue to be open when accepting a new handoff.
- `VERIFY` names a locally configured allowlisted profile such as `affected`, `delivery`, `security`, or `contracts`.
- `HEAD` must be the current full PR head SHA.
- A new SHA is a new review state.
- The bridge ignores old or already consumed handoffs and processes only the newest unconsumed valid handoff per PR.
- Task category is not validated from a roadmap prefix; documentation, maintenance, governance, proposal, and implementation Issues use the same Issue-number identity.

## External reviewer bridge compatibility requirement

The Python reviewer bridge implementation is intentionally external/local and is not stored in this repository. Its task parser and validation must be updated with this migration before Issue #88 can be considered fully complete in an environment that uses the bridge.

The required bridge-side change is exact and fail-closed:

1. replace any roadmap-ID validator such as `^P\d{2}-\d{2}$` with an Issue-reference validator equivalent to `^#[1-9]\d*$`;
2. resolve the referenced Issue in the PR repository and reject a missing or closed Issue before deterministic commands or Codex run;
3. preserve the `TASK: #<issue>` value unchanged in accepted, result, and error records;
4. do not infer work category from the old ID format;
5. preserve `SOURCE + HEAD + ACTION` deduplication, full-SHA comparison, required-workflow checks, allowlisted verification profiles, worktree isolation, tracked-file cleanliness, and expected-head merge protection;
6. add bridge tests for a valid open Issue plus missing, closed, malformed, superseded-head, and duplicate handoffs.

Do not substitute a permissive parser or skip Issue-state validation merely to keep the bridge running. If the bridge repository is unavailable, record this exact external follow-up in the PR and do not claim bridge compatibility was validated.

## Handoff consumption

Before local work, the bridge posts:

```text
[handoff-accepted]
SOURCE: <handoff comment ID>
HEAD: <full SHA>
ACTION: REVIEW_STARTED
```

A source is considered consumed when GitHub contains a matching `[handoff-accepted]`, `[handoff-duplicate]`, or `[reviewer-result]` comment, or when SQLite already contains the same `SOURCE + HEAD + ACTION` key.

The bridge must re-check the PR head and required workflows after reading the handoff and again immediately before an automatic merge. An older acknowledgement never consumes a newer head.

Unknown types, actions, Issue references, closed Issues, SHA formats, or verification profiles fail closed. They do not invoke Codex.

## Verification profiles

Verification profiles live only in the trusted local bridge configuration. Each profile contains:

- a Codex profile name;
- a fixed ordered list of command argument arrays;
- optional `{BASE}` and `{HEAD}` placeholders replaced by the bridge;
- no shell interpolation, `eval`, or command text from GitHub.

Recommended initial profiles:

- `affected`: frozen install plus Nx affected lint, typecheck, test, and build;
- `delivery`: frozen install plus focused delivery tests;
- `security`: secret and license checks plus affected tests;
- `contracts`: contract generation and compatibility checks plus affected tests.

Broad exact-head GitHub workflows remain authoritative for full CI. The local profile should target the behavior that requires a real machine or independent execution.

## Reviewer results

Pass:

```text
[reviewer-result]
TYPE: PASS
TASK: #88
PR: 90
HEAD: <full SHA>
SOURCE: <handoff comment ID>
LOCAL_CHECKS: PASS
SUMMARY: <compact verification summary>
ACTION: MERGE_EXACT_HEAD
```

Changes required:

```text
[reviewer-result]
TYPE: CHANGES_REQUIRED
TASK: #88
PR: 90
HEAD: <full SHA>
SOURCE: <handoff comment ID>
ACTION: DEVELOPER_FIX_EXISTING_PR

FINDINGS:
- P1: concise title
  Reproduction: command or concrete steps
  Expected: expected behavior
  Actual: actual behavior
  File: relevant path
```

Bridge or environment failure:

```text
[reviewer-result]
TYPE: REVIEW_ERROR
TASK: #88
PR: 90
HEAD: <full SHA>
SOURCE: <handoff comment ID>
ERROR: concise operational failure
ACTION: USER_INSPECT_REVIEWER
```

A deterministic command failure is a review error and must not invoke Codex. The developer posts a new handoff only after repairing the branch or the operator repairs the local environment.

## Review and development gates

- Review only an open, non-draft PR targeting `main` at the exact handed-off SHA.
- Never merge a draft, conflicted PR, changed SHA, unresolved blocker, or failing or pending required workflow.
- Never carry findings from an older head into a new result without verifying they still apply.
- Treat the selected Issue as complete only after implementation or requested artifact, tests where applicable, documentation, applicable CI, and required local review pass.
- The developer starts another Issue only after the active PR is merged or explicitly abandoned **and** another open Issue is explicitly assigned or selected.

## Automatic merge

Automatic merge is disabled by default. Enable it only after at least three successful one-shot local review cycles.

Even when enabled, the bridge may merge only when:

1. Codex returned PASS for the exact current head.
2. Required workflows remain green for that head.
3. The PR remains open, non-draft, conflict-free, and mergeable.
4. The configured authorization label, for example `automation:merge`, is present.
5. GitHub accepts a squash merge with the reviewed SHA supplied as the expected head.

Keep final human merge approval for authentication, authorization, database migrations, secrets, destructive operations, production infrastructure, payments, financial logic, data deletion, and dependency trust-policy changes.

## Developer monitoring fallback

An optional scheduled ChatGPT developer task reconstructs state from GitHub on every run. It may:

1. fix a new unconsumed `CHANGES_REQUIRED` result for the current selected Issue and head;
2. continue the single active unfinished development PR for that Issue;
3. remain silent when no action is required.

It must not search for or start an unrelated Issue merely because the current work is finished. A new Issue requires a new explicit assignment or selection.

## Blocker routing and recovery

GitHub Issue #33, `Automation control queue`, remains the durable queue for blockers that occur before a PR or cannot be represented as a PR review result.

Developer blocker:

```text
[scheduler-blocked]
TYPE: BLOCKED
TASK: #88
BASE: <full SHA>
PR: number or none
BRANCH: branch or none
CHECKS: compact pass/fail summary
BLOCKER: concise blocker
ACTION: UNBLOCK_AND_RESUME
```

Deduplicate by `TASK + BASE + PR + BRANCH + BLOCKER`. Tooling, access, and environment recovery may repair configuration or identify a safe alternate path but must not take over product implementation. Credentials, product decisions, destructive actions, and broader authority require the human operator.

The Python bridge reports its own operational failures as `REVIEW_ERROR`; it does not repeatedly spend Codex credits retrying the same source. After repair, create a new handoff comment or explicitly clear the failed local state.

## Completion and history

When an Issue PR merges, the Issue, merged PR, commit history, CI, and review records are the completed-work history. Do not append a phase-completion checklist to a repository roadmap.

When no Issue is assigned or selected, automation remains idle. Future actionable work must first be represented by an open GitHub Issue and explicitly selected or assigned before an agent acts on it.
