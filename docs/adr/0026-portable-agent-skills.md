# ADR 0026: Portable Agent Skills contract

- Status: Accepted
- Date: 2026-08-12
- Task: P15-01

## Context

SteadyStack already exposes concise always-on repository rules through root and nested `AGENTS.md`, executable structure through Nx and package scripts, and human-facing explanation through the Wiki. Detailed repeatable procedures do not belong in every agent session: copying them into `AGENTS.md` increases always-on context, while maintaining separate Claude-, Codex-, Copilot-, or editor-specific instruction trees would create drift and vendor lock-in.

The open [Agent Skills specification](https://agentskills.io/specification) defines a portable `SKILL.md` directory format with required `name` and `description` metadata and progressive disclosure. Its client guidance recognizes project-level `.agents/skills/` discovery. SteadyStack needs a repository-owned contract that uses that open format without allowing skill metadata or imported scripts to become an alternate authority system.

## Decision

### Instruction hierarchy

Root and nested `AGENTS.md` remain concise, always-on, agent-agnostic rules. They define repository boundaries and completion requirements. Detailed repeatable procedures live in skills and are loaded only when relevant.

A skill supplements but never overrides, weakens, or replaces:

1. the root and closest nested `AGENTS.md`;
2. executable repository contracts and generated sources of truth;
3. ADRs and `docs/TODO.md`;
4. protected GitHub/environment controls and human approval.

### Canonical location and format

`.agents/skills/<name>/SKILL.md` is the only repository-owned skill source. Do not maintain duplicate `.claude/skills`, `.codex/skills`, editor-specific copies, or generated vendor wrappers as independent sources of truth.

Each skill follows the open Agent Skills frontmatter contract and additionally requires:

```yaml
license: <reviewed license>
metadata:
  steadystack-origin: repository | third-party
  steadystack-required-tools: <space-separated conceptual capabilities>
  steadystack-authority: none
```

`steadystack-required-tools` describes conceptual least-privilege capabilities rather than a vendor tool syntax. The experimental Agent Skills `allowed-tools` field is deliberately rejected because support and syntax vary by host. Every SteadyStack skill has `steadystack-authority: none`; skills cannot grant production authority, credentials, approval power, vulnerability exceptions, or permission to bypass repository gates.

### Provenance and third-party review

`.agents/skills/provenance.json` is the reviewed registry for every canonical skill. It records:

- stable skill name and origin;
- source and source reference;
- reviewed license;
- whether bundled scripts received explicit review;
- a SHA-256 digest of the complete committed skill tree.

Repository-owned skills use a stable roadmap task ID as `sourceRef`. Third-party skills require an HTTPS source and an immutable source reference; moving refs such as `main`, `master`, `latest`, or `HEAD` are rejected.

There is no auto-install path for third-party skills. Importing or updating one is a normal reviewed repository change. Bundled scripts are inert source files until committed review records `reviewedScripts: true`; the validator rejects a skill tree that contains scripts without that explicit provenance.

### Deterministic validation

`pnpm agent-skills:check` validates:

- canonical location and absence of vendor-specific duplicate `SKILL.md` sources;
- required Agent Skills metadata, naming constraints, and bounded description/body size;
- SteadyStack provenance, content hashes, license consistency, origin, and immutable third-party refs;
- declared least-privilege capabilities and `authority: none`;
- referenced skill resources and repository paths;
- fenced commands, allowing only reviewed root/Nx commands or tracked Node entry points;
- symbolic-link rejection so a skill cannot silently escape its reviewed tree.

The root `pnpm check` includes this gate. Until P15-02 actually generates skills into downstream workspaces, an initialized downstream workspace with no `.agents/skills/provenance.json` skips only this new skill-set audit; the upstream template must always contain and pass the registry.

### Initial skills

P15-01 establishes two instruction-only repository skills:

- `architecture-discovery` for finding project ownership, dependency direction, applicable instructions, and sources of truth;
- `validation-debugging` for selecting reviewed validation commands and diagnosing failures without weakening checks.

Neither skill contains executable scripts or requires network access. P15-02 owns generation into downstream workspaces, additional release/upgrade skills, and multi-host discovery verification.

## Consequences

- Detailed procedures can evolve without expanding always-on `AGENTS.md` context.
- One reviewed source can be discovered by multiple Agent Skills-compatible hosts.
- Skill changes are reviewable and tamper-evident through provenance hashes.
- Expanding a skill's conceptual tool capabilities or authority model requires an explicit validator/ADR review rather than a vendor-specific permission string.
- Generated workspaces do not receive the skills until P15-02; this ADR intentionally avoids taking over that task.

## Rejected alternatives

### Vendor-specific skill directories

Rejected because duplicate Claude/Codex/editor skill trees would drift and make one host implicitly authoritative.

### Put every procedure in `AGENTS.md`

Rejected because detailed workflows would consume context on every task and defeat progressive disclosure.

### Auto-download skills from a registry

Rejected because source provenance, script review, license review, and exact content would no longer be guaranteed by the repository review process.

### Treat `allowed-tools` as the authorization boundary

Rejected because the field is experimental and host-specific, and tool preapproval is not equivalent to SteadyStack's human approval or production authority boundaries.
