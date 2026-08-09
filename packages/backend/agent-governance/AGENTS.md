# Agent governance project guidance

- Keep this project provider-neutral and orchestration-framework-neutral.
- Treat browser, user, prompt, model, and tool payloads as untrusted data; they never select provider routes, tool allowlists, approval identities, or credentials.
- Policy decisions are runtime data. Validate them and fail closed on malformed, missing, or denied decisions.
- Never add raw prompts, completions, retrieved context, tool arguments/results, credentials, or policy payloads to governance audit events.
- Keep audit reason codes as reviewed, payload-safe identifiers.
- Credential-classified content may be denied or explicitly redacted to a non-credential classification; it may never cross an allow decision unchanged.
- Provider/model fallback must be explicit, bounded, triggered only by approved transient failures, and re-check data, residency, retention, and capability requirements for every candidate route.
- Tool allowlists are server-owned configuration and complement rather than replace `backend-agent-tool` invocation-time actor authorization.
- Human approval authorization is trusted application policy and must run before `backend-agent-durable` approval resolution.
- Do not compose this project into the default API, web, or worker applications as part of P14-06.
