# SteadyStack

A production-minded Nx monorepo template designed to become the foundation for many TypeScript web applications that are built and maintained substantially by humans and coding agents.

> Upstream template: https://github.com/kaleigh-dem/steady-stack. Generated workspaces use their configured identity throughout.

## Primary goal

This is not only a full-stack starter. It is a repository operating model for agent-led software development.

The template makes the preferred engineering path explicit enough for a capable contributor with no prior conversation history to:

- discover repository-wide and subsystem-specific rules;
- inspect project ownership and dependency direction;
- generate approved structures instead of copying examples;
- change code through stable public boundaries;
- receive focused and repository-wide feedback;
- produce reviewable validation and release evidence;
- upgrade a long-lived generated project without treating every file as replaceable.

Agentic compatibility is independent of product AI features. The optional `ai` workspace profile defaults to disabled. When selected, `ai=true` materializes the Phase 14 capability package entry points, adds the generated API dependencies and project references, and creates a provider-neutral reference workflow with focused tests; `ai=false` keeps the ordinary generated application isolated from those optional AI application dependencies. The generated reference does not select a provider SDK, provider credentials, or production persistence.

Human-facing product, onboarding, operator, and explanatory guidance is published in the [SteadyStack Wiki](https://github.com/kaleigh-dem/steady-stack/wiki). See [Optional AI Runtime](https://github.com/kaleigh-dem/steady-stack/wiki/Optional-AI-Runtime) for the generated AI profile and its production replacement points. Contributors and coding agents should also read `docs/agentic-development.md` for the repository workflow, human approval boundaries, and maintenance controls.

## Why Nx

Nx supplies the project graph, generators, architectural boundary enforcement, computation caching, affected-only CI, and coding-agent integration that a large monorepo needs. This repository adds opinionated web/backend boundaries, layered `AGENTS.md` guidance, Nx MCP configuration, deterministic local generators, and the application-specific platform pieces that Nx does not prescribe.

## Agentic development controls

- Root and nested `AGENTS.md` files provide layered instructions.
- `.mcp.json` exposes the Nx MCP server to compatible agent clients.
- Nx projects and tags make ownership and dependency direction queryable.
- Local generators create correctly tagged domains, features, jobs, and contracts.
- ESLint, TypeScript references, generated contracts, and synchronization checks reject architectural drift.
- Focused targets and affected commands support fast iteration.
- `pnpm check`, preview smoke, delivery policy, and production gates provide objective completion criteria.
- Template provenance, ownership-aware migrations, and release evidence support long-lived generated products.

## Included now

- Next.js App Router web application
- NestJS API with generated runtime contract enforcement and replaceable development or OIDC access-token verification
- Node.js worker with PostgreSQL outbox polling, lease fencing, retries, dead-letter inspection, and bounded shutdown
- framework-free Agent Task and rate-limit backend libraries
- shared UI, contracts, database, environment, observability, and web-feature packages
- optional generated AI profile with provider-neutral model access, typed tools and streaming, evaluation evidence, durable execution, governance hooks, and a generated reference workflow while the default profile stays isolated
- pnpm workspaces
- enforced scope, runtime, and project-type boundaries
- Nx project graph, caching, affected commands, local generators, MCP configuration, and agent instructions
- versioned Nx preset artifacts, downstream migrations, and upgrade ownership policy
- PostgreSQL development service and optional OpenTelemetry collector
- PostgreSQL-backed distributed API rate limiting with explicit proxy trust
- production OCI images, preview orchestration, immutable release manifests, production-readiness checks, and performance budgets
- image SBOMs, vulnerability policy, keyless signatures, and provenance/SBOM attestations
- GitHub Actions using standalone, affected, security, delivery, release, promotion, and generated-workspace validation
- generated-repository onboarding and governance checklists

## Create a workspace

```bash
npx create-nx-workspace@23.1.1 my-workspace \
  --template kaleigh-dem/steady-stack
```

After installing dependencies, replace the template identity and record the generated repository's profiles:

```bash
pnpm initialize:workspace my-workspace \
  --displayName="My Workspace" \
  --packageScope=@my-org \
  --repositoryOwner=my-org
pnpm install --frozen-lockfile
pnpm template:identity:check
```

Initialization rewrites package scopes, service and image names, Compose projects and labels, database defaults, telemetry identifiers, TypeScript conditions, CODEOWNERS, and other text-based identity surfaces. The generated `workspace.template.json` records the exact upstream template version and upgrade ownership-policy version.

Start with the Wiki's [Quick Start](https://github.com/kaleigh-dem/steady-stack/wiki/Quick-Start) and [Choosing Workspace Profiles](https://github.com/kaleigh-dem/steady-stack/wiki/Choosing-Workspace-Profiles). Contributors and coding agents can use `docs/agentic-development.md` and `docs/template-initialization.md` as repository-local implementation and review references.

## Standard contributor or agent workflow

Before changing a subsystem:

```bash
cat AGENTS.md
pnpm nx show projects
pnpm nx show project <PROJECT_NAME>
pnpm graph
```

Read the closest nested `AGENTS.md`, identify the source of truth, and use a local generator for repeated structure. During iteration, run focused project targets and `pnpm affected`. Before handoff:

```bash
pnpm format
pnpm check
pnpm template:identity:check
git status --short
```

An agent's completion statement is not evidence by itself. Review the diff, generated files, migrations, validation output, and remaining human decisions.

## Template releases

Template releases use semantic versions and `template-v<version>` tags. Each GitHub Release contains an installable workspace-plugin tarball with the public `preset` entry point and the `steadystack-upgrade` command. CI validates generation, a previous-release upgrade fixture, and a differently named generated repository through frozen installation, validation, migrations, seed data, production images, preview smoke tests, performance budgets, deterministic teardown, identity checks, and Git-cleanliness checks before publication.

See `docs/template-releases.md` for versioning and publishing, `docs/template-validation.md` for the generated-workspace lifecycle, and `docs/template-upgrades.md` for downstream migrations.

## Upgrade a generated workspace

Install the target release artifact temporarily and preview its ordered migration plan. Replace the example version with the release you downloaded:

```bash
TARGET_VERSION=0.2.0
pnpm add --save-dev "./steadystack-workspace-plugin-${TARGET_VERSION}.tgz"
pnpm exec steadystack-upgrade --to "$TARGET_VERSION" --dry-run
```

After reviewing ownership classes and conflicts, rerun with `--apply`, execute `pnpm check`, and commit the upgrade separately from application changes. Applied migrations synchronize the repository-local `pnpm template:upgrade` command.

## Runtime requirements

Use Node.js 24 LTS and pnpm 10.13.1. The repository includes `.node-version` for compatible version managers, and `package.json` enforces the supported Node.js major release.

See `docs/runtime-support.md` for the support policy, compatibility lane, and validation coverage.

## Local development

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm infra:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The complete first-run and shutdown sequence is documented in the Wiki's [Quick Start](https://github.com/kaleigh-dem/steady-stack/wiki/Quick-Start).

## Authentication and distributed controls

Local development uses deterministic browser and API development adapters. Production web builds must explicitly select OIDC, session, or intentionally unauthenticated behavior; OIDC and session profiles obtain and renew short-lived bearer credentials through a same-origin secure-session endpoint. See `docs/browser-authentication.md` for browser storage, renewal, endpoint, and generator behavior. See `docs/oidc-authentication.md` and `docs/security/identity-operations.md` for API discovery, JWKS, claim validation, rotation, and outage behavior.

Production API replicas share anonymous, authenticated, route, and tenant rate-limit policies through PostgreSQL. See `docs/rate-limiting.md` for thresholds, trusted-proxy configuration, failure behavior, and operations.

## Validation

```bash
pnpm check
```

The validation contract includes workspace synchronization, generated contracts and compatibility, formatting, documentation integrity, AI evaluation evidence, security policy, delivery configuration, release-manifest and supply-chain policy, performance budgets, linting, type checking, tests, and production builds. A production build must leave the Git working tree clean.

## Build and validate release artifacts

```bash
pnpm preview:up
pnpm performance:load
pnpm preview:down
```

The **Release images** workflow publishes each semantic image version once from `main`, generates supply-chain evidence, resolves exact digests, and writes `release-manifest.json` plus `release-images.env`. Generate a production plan from that immutable evidence with:

```bash
node tools/delivery/release-plan.mjs \
  --environment production \
  --manifest release-manifest.json \
  --image-environment-file release-images.env \
  --output release-plan.production.json
```

The **Promote release digests** workflow verifies the source run, signatures, attestations, production build inputs, and protected environment before producing an approved plan. It does not rebuild, retag, push, or deploy images.

See `docs/delivery/`, `docs/runbooks/release-rollback.md`, and `docs/runbooks/disaster-recovery.md` before operating an environment.

## Production readiness

A generated repository is not production-ready solely because agents completed the implementation, local and preview paths pass, or immutable release evidence exists. Complete `docs/generated-project-checklist.md` to configure repository access, agent permissions, CODEOWNERS, required checks, branch protection, environments, secrets, release permissions, operational ownership, and deployment evidence.

Validate the exact production environment contract before promotion:

```bash
pnpm production:check -- infra/environments/production.env
```

See `docs/production-readiness.md` for every enforced property and the release-workflow contract.

## Generate approved structure

Use the local plugin instead of creating repeated structures manually:

```bash
pnpm generate:domain billing
pnpm generate:feature account-settings
pnpm generate:job refresh-search-index --queue=search
pnpm generate:contract project-created
```

Generator details and output contracts are documented in `tools/workspace-plugin/README.md`.

## Explore the workspace

```bash
pnpm graph
pnpm nx show projects
pnpm nx show project web
```

Read `AGENTS.md`, the closest nested `AGENTS.md`, and relevant ADRs before changing a subsystem. Upstream template maintainers also review `docs/TODO.md`; generated application teams maintain their own product backlog and decisions.
