# SteadyStack

SteadyStack is a production-minded Nx monorepo template for TypeScript web applications maintained by humans and coding agents under human ownership.

The published [SteadyStack Wiki](https://github.com/kaleigh-dem/steady-stack/wiki) is the primary human-facing documentation surface for product evaluation, onboarding, workspace profiles, everyday development, operations, production readiness, releases, upgrades, and troubleshooting. Repository Markdown beside the code is intentionally reserved for implementation, validation, governance, review, generated evidence, and agent/machine control surfaces.

## Start here

- [Wiki Home](https://github.com/kaleigh-dem/steady-stack/wiki)
- [Quick Start](https://github.com/kaleigh-dem/steady-stack/wiki/Quick-Start)
- [Choosing Workspace Profiles](https://github.com/kaleigh-dem/steady-stack/wiki/Choosing-Workspace-Profiles)
- [Repository Tour](https://github.com/kaleigh-dem/steady-stack/wiki/Repository-Tour)
- [Production Readiness](https://github.com/kaleigh-dem/steady-stack/wiki/Production-Readiness)
- [Releases and Upgrades](https://github.com/kaleigh-dem/steady-stack/wiki/Releases-and-Upgrades)

## Repository control surfaces

Contributors and coding agents should use the versioned repository controls that live beside the code:

- `AGENTS.md` and the closest nested `AGENTS.md` for always-on rules;
- `.agents/skills` for reviewed progressively disclosed procedures;
- `docs/TODO.md` for the upstream roadmap and task control plane;
- `docs/adr/` for durable architecture and governance decisions;
- `docs/documentation-integrity.md` for executable documentation checks and ownership rules;
- executable contracts, generated evidence, and runbooks under `docs/`, `tools/`, and the Nx project graph when a change needs implementation-level detail.

Human-facing explanation belongs in the Wiki. Do not create a second onboarding, operator, product, or explanatory manual under root Markdown or `docs/` unless the repository copy has an explicit implementation, automation, governance, review, or machine-consumption reason and is accepted by the documentation-surface gate.

## Create a workspace

Use the Wiki Quick Start for the complete supported sequence. The bootstrap entry point is:

```bash
npx create-nx-workspace@23.1.1 my-workspace \
  --template kaleigh-dem/steady-stack
```

## Repository status

Phase 15 is complete through P15-03. Portable agent procedures live in the canonical `.agents/skills` tree, maintained hosts discover the same project-level skill root, and human-facing documentation has a single reviewed Wiki home while repository controls remain versioned beside the code.
