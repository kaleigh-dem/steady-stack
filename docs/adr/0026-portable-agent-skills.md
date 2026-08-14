# ADR 0026: Portable Agent Skills contract

- Status: Accepted
- Date: 2026-08-12
- Last updated: 2026-08-14
- Tasks: P15-01, P15-02

## Context

SteadyStack exposes concise always-on repository rules through root and nested `AGENTS.md`, executable structure through Nx and package scripts, and human-facing explanation through the Wiki. Detailed repeatable procedures should be progressively disclosed rather than copied into every agent session or duplicated into Claude-, Codex-, Copilot-, or editor-specific instruction trees.

P15-01 established the open Agent Skills format under `.agents/skills`, deterministic provenance/command/authority validation, and two initial repository skills. It intentionally removed that tree from initialized products until distribution and multi-host discovery were proven.

P15-02 must now generate the same reviewed procedures into downstream workspaces, add release-evidence and downstream-upgrade procedures, prefer framework-provided version-matched context over copied framework prose, and prove that at least two maintained agent hosts recognize the same canonical project-level location.

## Decision

### Instruction hierarchy

Root and nested `AGENTS.md` remain concise, always-on, agent-agnostic rules. Skills are loaded only when relevant and supplement but never override, weaken, or replace:

1. root and closest nested `AGENTS.md`;
2. executable repository contracts and generated sources of truth;
3. ADRs and `docs/TODO.md`;
4. protected GitHub/environment controls and human approval.

### Canonical location and format

`.agents/skills/<name>/SKILL.md` remains the only repository-owned skill source. Independent `.claude/skills`, `.codex/skills`, `.github/skills`, or editor-specific copies are rejected as alternate sources of truth.

Each skill follows the open Agent Skills frontmatter contract and additionally requires:

```yaml
license: <reviewed license>
metadata:
  steadystack-origin: repository | third-party
  steadystack-required-tools: <space-separated conceptual capabilities>
  steadystack-authority: none
```

Conceptual capabilities express least-privilege expectations rather than host-specific permissions. The experimental Agent Skills `allowed-tools` field remains rejected. Every SteadyStack skill has `steadystack-authority: none`; a skill cannot grant production authority, credentials, approval power, vulnerability exceptions, or permission to bypass repository gates.

### Provenance and third-party review

`.agents/skills/provenance.json` remains the reviewed registry for every canonical skill. It records stable name/origin, source and immutable source reference, reviewed license, bundled-script review state, and a SHA-256 digest of the complete committed skill tree.

There is no runtime auto-install path for third-party skills. Importing or updating one is a normal reviewed repository change. Bundled scripts are rejected until provenance explicitly records script review.

### Deterministic validation and maintained-host proof

`pnpm agent-skills:check` continues to validate canonical location, metadata, naming/size bounds, provenance/content hashes, third-party source policy, conceptual capabilities, `authority: none`, resource/repository references, reviewed commands, and symlink rejection.

P15-02 adds `tools/agent-skills/host-discovery.json` and `verify-host-discovery.mjs`. The contract requires at least two unique maintained hosts, the same canonical `.agents/skills` project root for each, immutable source evidence for host support, and exact agreement between provenance and discovered skill directories.

The maintained proof currently records GitHub Copilot and OpenAI Codex. Their support evidence is pinned to immutable commits in the maintainers' repositories, so CI does not rely on moving documentation or network access. No vendor-specific wrapper or duplicate skill tree is generated.

### Generated-workspace distribution

P15-02 includes the canonical Agent Skills contract in initialized products. The preset no longer removes `.agents/skills`.

Initialization performs broad product-identity rewriting, so retaining the tree without protection would rewrite reserved `steadystack-*` metadata and upstream provenance after hashes were reviewed. The preset therefore snapshots the portable contract before identity initialization and restores the exact bytes after identity rewriting, maintainer-file removal, and formatting. The protected set includes:

- `.agents/skills`
- `tools/agent-skills`
- `docs/agent-skills.md`
- this ADR

`tools/template/check-identity.mjs` recognizes those exact paths as approved upstream contract metadata instead of product identity leakage. Product-facing files continue to use generated identity normally.

Generated workspaces retain the root Agent Skills validation command, so the P15-01 downstream skip is no longer the expected product state. The P15-02 host-discovery verifier requires a generated provenance registry and canonical tree.

### Version-matched framework and workspace context

Portable skills should reference live workspace/framework context rather than copy framework manuals into the repository. Architecture discovery therefore prefers:

- Nx MCP context through the existing `.mcp.json` when supported by the active host;
- the installed Nx project graph and targets;
- Next.js packaged documentation under `node_modules/next/dist/docs/` for Next.js-specific behavior.

This keeps framework guidance tied to installed versions while repository controls remain authoritative where SteadyStack intentionally narrows framework choices.

### Maintained skills

P15-02 maintains four instruction-only skills:

- `architecture-discovery`, materially updated for version-matched Next.js and Nx context;
- `validation-debugging`;
- `release-evidence`, for exact-identity release evidence inspection and deterministic bundle validation without deployment authority;
- `downstream-upgrades`, for dry-run-first ownership-aware template migrations using the repository-local upgrade contract.

None contains bundled scripts or requires runtime skill downloads.

## Consequences

- Generated products receive the same reviewed procedures and provenance as the upstream template.
- GitHub Copilot and OpenAI Codex can discover the same canonical project skill tree without independent vendor copies.
- Framework guidance can follow installed Next.js/Nx versions instead of copied prose becoming stale.
- Identity initialization cannot silently invalidate Agent Skills hashes or policy metadata.
- Release and upgrade procedures become discoverable without granting production authority or an alternate path around human approval.
- Host-support evidence is intentionally reviewed and pinned; changing maintained hosts or their discovery contract requires a repository change rather than a runtime fetch.

## Rejected alternatives

### Vendor-specific skill directories

Rejected because duplicate Claude/Codex/Copilot/editor skill trees would drift and make one host implicitly authoritative.

### Rewrite skill content to generated product identity

Rejected because the canonical procedures contain reserved contract keys and reviewed upstream provenance. Rewriting them after hashing would invalidate the review record and could change policy semantics.

### Fetch moving host documentation during CI

Rejected because network availability and moving vendor docs would make validation nondeterministic. Immutable reviewed evidence proves the maintained-host contract instead.

### Copy framework documentation into skills

Rejected because copied Next.js or Nx prose becomes stale independently of installed package versions. Skills should route agents to packaged or live workspace context.

### Treat skill metadata as authorization

Rejected because procedure metadata is not equivalent to credentials, protected-environment approval, production authority, or human risk acceptance.
