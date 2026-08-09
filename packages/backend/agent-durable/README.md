# Durable agent execution boundary

Provider- and framework-neutral primitives for optional checkpointed agent runs. This project is backend-only and is not composed into the default API, worker, or web applications.

## Responsibilities

- replaceable persistence adapter contract for durable run state
- renewable leases and monotonic fencing aligned with the Phase 11 worker reliability model
- idempotent checkpoints with ordered sequences
- atomic checkpoint plus human-approval pause
- approval-driven resume or terminal rejection
- recovery after an interrupted lease expires
- payload-safe lifecycle observation under the existing correlation context
- deterministic in-memory adapter for tests and local composition

Checkpoint state is application-owned JSON data and may contain sensitive information. The shared boundary does not choose what to persist or how long to retain it. Production adapters must explicitly define data ownership, classification, retention, deletion, tenant isolation, encryption, access control, and backup behavior before storing production state.

`InMemoryDurableExecutionAdapter` is deterministic test support only. It is not durable across process or host loss and is not a production persistence implementation.

## Validation

```bash
pnpm nx run backend-agent-durable:test
pnpm nx run backend-agent-durable:typecheck
pnpm nx run backend-agent-durable:lint
pnpm nx run backend-agent-durable:build
```

See `docs/durable-agent-execution.md` and ADR 0024 for lifecycle and adapter semantics.
