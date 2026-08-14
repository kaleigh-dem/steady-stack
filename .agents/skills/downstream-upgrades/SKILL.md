---
name: downstream-upgrades
description: Plan and apply reviewed SteadyStack template upgrades in generated repositories while preserving downstream ownership and conflicts. Use when evaluating a target template release, reviewing migration operations, or validating an authorized upgrade.
license: MIT
metadata:
  steadystack-origin: repository
  steadystack-required-tools: read-files write-files run-repository-commands read-git-history
  steadystack-authority: none
---

# Downstream upgrades

Use this procedure in a generated workspace after reading the root and closest `AGENTS.md`. The target release artifact must already be available through the adopting team's reviewed acquisition process; this skill does not download or install remote code.

## Procedure

1. Read `workspace.template.json`, `docs/template-upgrades.md`, and `tools/template/ownership.json`. Confirm the current recorded upstream version and the intended target release before changing files.
2. Ensure unrelated work is committed or otherwise protected. Preview the ordered migration path first:

```bash
pnpm template:upgrade -- --to TARGET_VERSION --dry-run
```

3. Review every reported operation by ownership class:
   - template-managed infrastructure may be replaced only from the verified target release;
   - generated-once files receive only explicit structured edits or create-if-missing behavior;
   - application-owned files are never silently overwritten and require manual follow-up when a migration reports it.
4. Resolve conflicts deliberately and rerun the same dry run until the remaining plan is understood. Do not downgrade or bypass an ambiguous/missing migration path.
5. Apply the reviewed plan only when the task and accountable human authorize the upgrade:

```bash
pnpm template:upgrade -- --to TARGET_VERSION --apply
pnpm check
pnpm template:identity:check
```

6. Review the final diff, `workspace.template.json`, retained local upgrade runner/policy, and validation output. Commit the upgrade separately from unrelated product work.

## Failure rules

- Do not replace application-owned content just to make an upgrade succeed.
- Do not edit ownership policy, migration history, or validation gates to hide a conflict.
- Do not use an unreviewed moving branch, package install one-liner, or remote script as the target release source.
- Do not claim success when the dry run, apply step, identity check, or repository contract is red.

## Authority boundary

This skill does not grant credentials, production deployment authority, architecture exceptions, permission to overwrite product-owned code, or permission to weaken repository checks. Upgrade acceptance and any production rollout remain accountable human decisions.
