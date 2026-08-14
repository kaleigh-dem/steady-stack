# Portable Agent Skills

SteadyStack uses the open Agent Skills format for detailed, progressively disclosed agent procedures while keeping `AGENTS.md` concise and always on. P15-02 makes the same validated skill set part of generated workspaces and proves project-level discovery for multiple maintained hosts without vendor-specific copies.

## Authority and precedence

Skills are procedure packages, not policy or authorization. Use repository context in this order:

1. root and closest nested `AGENTS.md`;
2. executable contracts, generated sources of truth, and project boundaries;
3. applicable ADRs and `docs/TODO.md`;
4. a relevant repository-owned skill under `.agents/skills/`;
5. transient chat context.

A skill cannot override an `AGENTS.md` rule, weaken validation, grant credentials or production authority, approve an architecture exception, or bypass a human approval gate.

## Canonical generated layout

The canonical project-level source is generated into both the upstream template and initialized products:

```text
.agents/skills/
├── provenance.json
├── architecture-discovery/
│   └── SKILL.md
├── downstream-upgrades/
│   └── SKILL.md
├── release-evidence/
│   └── SKILL.md
└── validation-debugging/
    └── SKILL.md
```

Do not maintain independent vendor-specific project skill directories for Claude, Codex, Copilot, or editors. Maintained hosts that support the open project format discover `.agents/skills/` directly. Vendor adapters, if ever required, must be generated from this source rather than edited independently.

The contract follows the open Agent Skills `SKILL.md` format. Each skill directory contains `SKILL.md` with YAML frontmatter and Markdown instructions. `name` and `description` are required by the open format; SteadyStack additionally requires an explicit license and repository metadata.

## Maintained host discovery proof

`tools/agent-skills/host-discovery.json` records the maintained-host contract. P15-02 pins upstream evidence showing that both GitHub Copilot and OpenAI Codex recognize the same project-level `.agents/skills` location. `tools/agent-skills/verify-host-discovery.mjs` deterministically requires at least two unique hosts, an immutable evidence commit for each host, the canonical project root, and exact agreement between the discovered skill directories and `.agents/skills/provenance.json`.

The host proof is intentionally offline at validation time. It records reviewed immutable evidence instead of fetching moving vendor documentation during CI, and it does not create a vendor-specific skill tree.

## Version-matched framework and workspace context

Skills should point agents to framework-provided context rather than copy framework prose that can drift. The architecture-discovery skill therefore prefers:

- the Nx MCP server already configured by `.mcp.json` when the active host supports MCP;
- installed Nx project/target metadata and the project graph;
- the Next.js documentation shipped with the installed package under `node_modules/next/dist/docs/` for Next.js-specific work.

Repository rules still take precedence over framework guidance when SteadyStack intentionally constrains a framework capability.

## Required SteadyStack metadata

Every skill must declare:

```yaml
license: MIT
metadata:
  steadystack-origin: repository
  steadystack-required-tools: read-files run-repository-commands
  steadystack-authority: none
```

`steadystack-origin` may be `repository` or `third-party`. `steadystack-required-tools` is a space-separated set of reviewed conceptual capabilities, not vendor-specific command syntax. `steadystack-authority` must always be `none`.

The recognized capabilities are:

- `read-files`
- `write-files`
- `run-repository-commands`
- `read-git-history`
- `read-github`
- `write-github-review-artifacts`
- `local-containers`

Declaring a capability does not grant it. The active host and human/repository controls decide whether a tool is available or authorized. Adding a new conceptual capability requires changing the reviewed validator.

SteadyStack intentionally rejects the experimental top-level Agent Skills `allowed-tools` field. Tool names and preapproval syntax vary by host and are not an authorization boundary.

## Provenance registry

`.agents/skills/provenance.json` records one entry for every canonical skill. Each entry includes:

- `name`
- `origin`
- `source`
- `sourceRef`
- `license`
- `reviewedScripts`
- `contentSha256`

`contentSha256` covers the complete sorted skill tree, not only frontmatter. A content change without a matching reviewed provenance update fails validation.

Repository-owned skills use `kaleigh-dem/steady-stack` as `source` and the stable roadmap task ID that introduced or materially revised the skill as `sourceRef`.

Third-party imports require an HTTPS source, immutable source reference, explicit license review, and matching content hash. Moving refs such as `main`, `master`, `latest`, and `HEAD` are rejected. Importing is a normal reviewed repository change; there is no runtime download-or-install path for unreviewed skills.

If a third-party skill contains `scripts/`, the provenance entry must set `reviewedScripts: true`. A script is never trusted merely because it arrived inside a skill package.

## Skill authoring rules

Keep `SKILL.md` focused on the procedure that should load when the skill activates. The validator enforces a 500-line maximum to preserve progressive disclosure.

Supporting material stays inside the same skill directory and is linked relatively from `SKILL.md`. Do not use symbolic links or references that escape the skill tree. Static repository paths named by a skill are checked when they are part of the repository path contract.

Shell examples are constrained. Use reviewed root/Nx commands or a tracked Node entry point. Do not embed package-install one-liners, remote script execution, or ad hoc shell acquisition paths.

## Maintained skills

### `architecture-discovery`

Use before editing when ownership, dependency direction, source of truth, applicable instructions, or version-matched framework context is unclear. It uses root/closest `AGENTS.md`, roadmap/ADRs, Nx MCP/project graph context, reviewed Nx commands, and packaged Next.js docs when relevant.

### `validation-debugging`

Use while iterating, diagnosing a failed gate, or preparing a review handoff. It selects reviewed validation commands, requires fixing the first actionable failure without weakening checks, and treats exact-head GitHub workflows as broad CI authority.

### `release-evidence`

Use to prepare and validate immutable release evidence. It can inspect exact workflow/run identities and validate a downloaded release-record bundle, but it cannot authorize deployment, promotion, rollback, protected-environment approval, credential use, or risk acceptance.

### `downstream-upgrades`

Use in generated workspaces to preview and apply a reviewed template migration path while respecting template-managed, generated-once, and application-owned boundaries. It assumes the target release artifact has already been acquired through the adopting team's reviewed process and does not download remote code.

The maintained skills contain no bundled executable scripts.

## Generated-workspace behavior

The preset preserves the canonical Agent Skills contract byte-for-byte through workspace identity rewriting and formatting. Generated workspaces therefore receive the same `.agents/skills` tree, provenance hashes, validator, host-discovery contract, and Agent Skills ADR/documentation as the upstream template.

The preservation is deliberate: identity initialization may rewrite product-facing SteadyStack names, but it must not rewrite reserved `steadystack-*` metadata keys, upstream provenance, validator policy, or skill content after the hashes have been reviewed. `tools/template/check-identity.mjs` treats those exact portable-contract paths as approved upstream metadata rather than product identity leakage.

Generated `pnpm check` runs the same `pnpm agent-skills:check` gate. The P15-01 downstream skip is no longer the product contract: P15-02-generated products contain a provenance registry, and the host-discovery verifier fails if that generated registry or canonical tree is missing.

## Validation

Run after any skill, provenance, generation, or host-discovery change:

```bash
pnpm agent-skills:check
pnpm docs:check
pnpm format:check
```

When preset behavior changes, also run the focused workspace-plugin tests and generated-workspace lifecycle required by CI. The full repository contract includes the skill gate:

```bash
pnpm check
```

`pnpm agent-skills:check` validates metadata, canonical location, provenance hashes, third-party source policy, script review, conceptual capabilities, authority, referenced resources/repository paths, reviewed commands, and the multi-host discovery contract.

## Changing or importing a skill

1. Confirm the procedure belongs in a skill rather than concise `AGENTS.md` policy or human-facing Wiki prose.
2. Create or update only `.agents/skills/<name>/`.
3. Keep required tools least-privilege and `steadystack-authority: none`.
4. For third-party content, pin the reviewed source and immutable revision; inspect the license and every bundled script before copying it into the repository.
5. Recompute and update the provenance hash in the same reviewed change.
6. Update `host-discovery.json` only when maintained host support or evidence changes; evidence refs must remain immutable.
7. Run `pnpm agent-skills:check`, focused validation, and the full repository contract required by the task.
8. Update the relevant ADR and roadmap status when the skill contract, capability model, generation model, or maintained-host proof changes.

See ADR 0026 for the architectural decision and P15-01/P15-02 rollout history.
