# Durable agent execution guidance

- Keep this project provider-neutral and durable-framework-neutral; do not compose it into default applications.
- Treat checkpoint state as application-owned persisted data. Never log or emit raw checkpoint state from lifecycle observers.
- Every mutating run session operation must be fenced by the current lease owner and fence value.
- Checkpoint identifiers are idempotency keys. Reusing an identifier with different content must fail closed.
- Human approval decisions come from trusted application context, never model-controlled input. P14-05 does not define who is authorized to approve; P14-06 owns broader policy and audit hooks.
- Production adapters must provide actual durable storage plus explicit retention, deletion, tenant isolation, encryption, and access controls. The in-memory adapter is test-only.
- Do not add provider fallback, input/output safety policy, tool allowlists, or AI-profile generation here; those remain P14-06 and P14-07.
