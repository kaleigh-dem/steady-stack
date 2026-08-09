# Durable agent execution

P14-05 adds a backend-only durable-run boundary for applications that opt into checkpointed agent workflows. It does not wire model calls, tools, or durable state into the default SteadyStack applications.

## What the boundary provides

`packages/backend/agent-durable` exports:

- `DurableExecutionAdapter`, the replaceable persistence contract;
- `DurableExecutionCoordinator`, which creates, claims, observes, and resolves durable runs;
- `DurableRunSession`, which renews a lease, checkpoints progress, pauses atomically for approval, and completes or fails a run;
- `InMemoryDurableExecutionAdapter`, deterministic test support that can snapshot/restore state but is not production durable storage.

The coordinator preserves four stable identifiers on every run: `runId`, `traceId`, `actorId`, and `conversationId`.

## Run lifecycle

A new run starts as `pending`.

```text
pending
  -> running
     -> running                  checkpoint or lease renewal
     -> waiting_for_approval     atomic checkpoint + approval request
     -> completed
     -> failed
waiting_for_approval
  -> pending                     trusted approval
  -> failed                      trusted rejection
running with expired lease
  -> running                     recovered claim with a higher fence
```

Every claim has a bounded lease, a lease-owner identifier, a monotonically increasing fence, and an attempt count. A mutating session call succeeds only while its lease is current. If another worker reclaims an expired run, the previous session becomes stale and cannot checkpoint, pause, complete, or fail newer work.

This is the same reliability model used by the Phase 11 worker: renewable ownership plus fencing prevents stale work from acknowledging or overwriting a newer attempt.

## Checkpoints and idempotency

A checkpoint has:

- `checkpointId`: an idempotency key;
- `sequence`: contiguous one-based ordering;
- `stepId`: a stable application step identifier;
- `state`: JSON-compatible application-owned resume state;
- `savedAt`: adapter-visible persistence time.

Retrying the same checkpoint identifier with the same sequence, step, and state is a duplicate success. Reusing the identifier with different content fails as an idempotency conflict. A new checkpoint must increment the previous sequence by exactly one.

Checkpoint state is intentionally opaque to the shared runtime. Keep it as small as possible. Do not use a checkpoint as an implicit transcript store.

## Recovery after interruption

When a worker disappears, its lease eventually expires. A later worker may reclaim the run. The new claim:

- increments the attempt count and fence;
- reports that the run was recovered;
- retains the latest committed checkpoint;
- prevents the previous owner from writing with the old fence.

The deterministic adapter exposes `snapshot()` so tests can construct a new adapter/coordinator instance from persisted state and prove that recovery resumes from the committed checkpoint. Production applications need an adapter backed by actual persistent storage; the in-memory adapter does not survive process or host loss by itself.

Worker outbox retry scheduling remains separate. A durable run does not automatically replay a side-effecting tool call merely because its transport delivery retries.

## Human approval

`pauseForApproval` performs one adapter mutation that writes both the resume checkpoint and the pending approval, then releases the execution lease. This avoids crash windows where only one half of the pause is durable.

Approval metadata contains stable identifiers and safe codes rather than free-form model or tool payloads. The application must authenticate and authorize the human before calling `resolveApproval`.

- `approved` moves the run back to `pending`; the next claim resumes from the saved checkpoint.
- `rejected` terminates the run with `failureCode=approval_rejected`.

Model output never supplies the trusted `decidedBy` identity and never grants approval. P14-06 adds broader safety/governance hooks; P14-05 only supplies the durable lifecycle state needed to support an application-owned approval policy.

## Observation

Lifecycle observers run inside the existing `packages/observability` correlation context using the run, trace, actor, and conversation identifiers. Events may include:

- status;
- attempt count and fence;
- checkpoint sequence;
- approval identifier and decision;
- safe failure code.

Observer events do not include raw checkpoint state, prompts, completions, tool arguments, tool results, credentials, or approval free text.

## Production adapter requirements

`DurableExecutionAdapter` is intentionally storage-neutral. A production implementation must provide atomic mutations for claims, fences, checkpoints, approval pauses, approval decisions, and terminal transitions.

Before persisting production checkpoint state, document and enforce:

- data owner and purpose;
- data classification;
- retention duration and deletion path;
- tenant isolation/partitioning;
- encryption and access control;
- backup and restore behavior;
- regional/residency constraints where applicable.

These requirements follow ADR 0020. Using the deterministic memory adapter does not satisfy them.

## Focused validation

```bash
pnpm nx run backend-agent-durable:test
pnpm nx run backend-agent-durable:typecheck
pnpm nx run backend-agent-durable:lint
pnpm nx run backend-agent-durable:build
pnpm docs:check
pnpm format:check
```

The new project is not composed into a default application, so P14-05 does not add a provider dependency, durable-agent framework, database migration, environment variable, API route, browser route, or generated-profile behavior.

## Related decisions

- ADR 0020: optional AI profile boundaries
- ADR 0022: typed tools and versioned agent streaming
- ADR 0023: reviewed prompt artifacts and evaluation evidence
- ADR 0024: optional durable agent execution
- `docs/reference-feature-agent-tasks.md`: Phase 11 worker reliability baseline
