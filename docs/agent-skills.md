# Portable Agent Skills

SteadyStack uses the open Agent Skills format for detailed, progressively disclosed agent procedures while keeping `AGENTS.md` concise and always on.

## Authority and precedence

Skills are procedure packages, not policy or authorization. Use repository context in this order:

1. root and closest nested `AGENTS.md`;
2. executable contracts, generated sources of truth, and project boundaries;
3. applicable ADRs and `docs/TODO.md`;
4. a relevant repository-owned skill under `.agents/skills/`;
5. transient chat context.

A skill cannot override an `AGENTS.md` rule, weaken validation, grant credentials or production authority, approve an architecture exception, or bypass a human approval gate.

## Canonical layout

The repository-owned source is:

```text
.agents/skills/
├── provenance.json
├── architecture-discovery/
│   └── SKILL.md
└── validation-debugging/
    └── SKILL.md
```

Do not maintain independent `.claude/skills`, `.codex/skills`, or editor-specific skill copies. Hosts that support the open format should discover the canonical project-level `.agents/skills/` tree directly. Vendor adapters, if one is ever required, must be generated from this source rather than edited independently.

The upstream contract follows the [Agent Skills specification](https://agentskills.io/specification): each skill directory contains `SKILL.md` with YAML frontmatter and Markdown instructions. `name` and `description` are required by the open format; SteadyStack also requires an explicit license and repository metadata.

## Required SteadyStack metadata

Every skill must declare:

```yaml
license: MIT
metadata:
  steadystack-origin: repository
  steadystack-required-tools: read-files run-repository-commands
  steadystack-authority: none
```

The values above are examples for the initial repository skills. `steadystack-origin` may be `repository` or `third-party`. `steadystack-required-tools` is a space-separated set of reviewed conceptual capabilities, not a vendor-specific command or permission syntax. `steadystack-authority` must always be `none`.

The current recognized capabilities are:

- `read-files`
- `write-files`
- `run-repository-commands`
- `read-git-history`
- `read-github`
- `write-github-review-artifacts`
- `local-containers`

Declaring a capability does not grant it. The active agent host and human/repository controls still decide whether a tool is available or authorized. Adding a new conceptual capability requires changing the reviewed validator.

SteadyStack intentionally rejects the experimental top-level Agent Skills `allowed-tools` field. Tool names and preapproval syntax vary by host, and they are not an authorization boundary.

## Provenance registry

`.agents/skills/provenance.json` records one entry for every canonical skill. Each entry includes:

- `name`
- `origin`
- `source`
- `sourceRef`
- `license`
- `reviewedScripts`
- `contentSha256`

`contentSha256` covers the complete sorted skill tree, not only the frontmatter. A content change without a matching reviewed provenance update fails validation.

Repository-owned skills use `kaleigh-dem/steady-stack` as `source` and the stable roadmap task ID that introduced or materially revised the skill as `sourceRef`.

Third-party imports require an HTTPS source, an immutable source reference, an explicit license review, and a matching content hash. Moving refs such as `main`, `master`, `latest`, and `HEAD` are rejected. Importing is a normal reviewed repository change; there is no download-or-install command that pulls unreviewed skills at agent runtime.

If a third-party skill contains `scripts/`, the provenance entry must set `reviewedScripts: true`. A script is never trusted merely because it arrived inside a skill package.

## Skill authoring rules

Keep the main `SKILL.md` focused on the procedure that should load when the skill activates. The validator enforces a 500-line maximum to preserve progressive disclosure.

When a skill needs supporting material, keep it inside the same skill directory and link it relatively from `SKILL.md`. Do not use symbolic links or references that escape the skill tree. Repository source paths such as `AGENTS.md`, `docs/TODO.md`, or `packages/contracts` may be named explicitly; validation confirms that static repository references exist.

Shell examples inside a skill are intentionally constrained. Use reviewed root/Nx commands or a tracked Node entry point. Do not embed `curl`, `wget`, package-install one-liners, remote script execution, or other ad hoc shell acquisition paths.

## Initial skills

### `architecture-discovery`

Use before editing when the owning project, dependency direction, source of truth, or applicable boundaries are not yet clear. It relies on the root/closest `AGENTS.md`, the active roadmap/ADRs, and reviewed Nx discovery commands.

### `validation-debugging`

Use while iterating, diagnosing a failed gate, or preparing a review handoff. It selects reviewed root validation commands, requires fixing the first actionable failure without weakening checks, and treats exact-head GitHub workflows as the broad CI authority.

Neither initial skill contains scripts or requires network access.

## Validation

Run after any skill, provenance, or skill-validator change:

```bash
pnpm agent-skills:check
pnpm docs:check
pnpm format:check
```

The full repository contract also runs the skill gate:

```bash
pnpm check
```

`pnpm agent-skills:check` validates metadata, canonical location, provenance hashes, third-party source policy, script review, conceptual tool capabilities, authority, referenced resources/repository paths, and reviewed commands.

P15-01 validates the upstream repository skill set only. Initialized downstream workspaces without a generated skill registry skip this gate until P15-02 adds the portable skill set to generated workspaces.

## Changing or importing a skill

1. Confirm the procedure belongs in a skill rather than concise `AGENTS.md` policy or human-facing Wiki prose.
2. Create or update only the canonical `.agents/skills/<name>/` source.
3. Keep required tools least-privilege and `steadystack-authority: none`.
4. For third-party content, pin the reviewed source and immutable revision; inspect the license and every bundled script before copying it into the repository.
5. Recompute and update the provenance hash as part of the same reviewed change.
6. Run `pnpm agent-skills:check`, focused validation, and the full repository contract required by the task.
7. Update the relevant ADR and roadmap status when the skill contract or capability model changes.

See ADR 0026 for the architectural decision and scope boundary with P15-02.
