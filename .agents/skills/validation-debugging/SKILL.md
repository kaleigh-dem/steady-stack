---
name: validation-debugging
description: Select and run SteadyStack's reviewed validation commands, then diagnose failures without weakening checks. Use while iterating on a change, investigating CI-equivalent failures, or preparing an exact-head review handoff.
license: MIT
metadata:
  steadystack-origin: repository
  steadystack-required-tools: read-files run-repository-commands
  steadystack-authority: none
---

# Validation and debugging

Use repository-owned commands as the feedback loop. Do not replace a failing gate with a weaker command or suppress its result.

## Procedure

1. Start with the smallest relevant reviewed command. For ordinary code changes:

```bash
pnpm affected
```

2. Use the focused contract that matches the changed surface:

```bash
pnpm docs:check
pnpm agent-skills:check
pnpm template:identity:check
pnpm contracts:check
pnpm contracts:compat
pnpm delivery:check
```

Run only the commands relevant to the current change; a command that is not applicable does not need to be invented or simulated.

3. When a command fails, read the first actionable failure, trace it to the owning source file, make the smallest coherent correction, and rerun that same command before broadening validation.
4. Before review handoff, run the repository contract:

```bash
pnpm format:check
pnpm check
```

5. Treat exact-head GitHub workflows as the authoritative broad CI evidence. Do not claim a pending, cancelled, superseded, or older-head run is green.

## Failure rules

- Do not add `continue-on-error`, skip lifecycle steps, delete assertions, or loosen policy merely to make validation pass.
- Do not substitute an unfrozen install, an unreviewed script, or an ad hoc network command for a repository-owned command.
- Preserve failure diagnostics when the repository workflow retains them.
- If the environment cannot execute an applicable gate, report the unavailable gate and rely on the repository's established exact-head CI process rather than claiming local success.

## Authority boundary

This skill does not authorize merges, production deployment, credential use, vulnerability exceptions, destructive operations, or bypasses of human approval. Repository rules and protected-environment decisions remain authoritative.
