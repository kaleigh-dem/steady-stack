# Backend agent governance

`backend-agent-governance` supplies provider-neutral safety and governance hooks for the optional AI runtime profile. It is not composed into the default API, web, or worker applications.

The public boundary includes:

- runtime-validated input and output policy hooks;
- classification-aware sensitive-data handling with fail-closed credential treatment;
- server-owned tool allowlists and explicit human-approval requirements;
- trusted approval-authorization hooks for durable approval decisions;
- payload-safe, versioned governance audit events;
- explicit server-side provider/model routing and bounded compatible fallback policy.

The project intentionally does not choose a model provider, register tools, inspect browser state, persist prompts, provide provider credentials, or install an orchestration framework. Applications compose these hooks around `backend-model`, `backend-agent-tool`, and `backend-agent-durable` when they opt into runtime AI behavior.

## Focused checks

```bash
pnpm nx run backend-agent-governance:test
pnpm nx run backend-agent-governance:typecheck
pnpm nx run backend-agent-governance:lint
pnpm nx run backend-agent-governance:build
```

See `docs/agent-safety-and-governance.md` and ADR 0025 for the complete contract and composition guidance.
