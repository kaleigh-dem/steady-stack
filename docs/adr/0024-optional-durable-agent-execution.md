# ADR 0024: Optional durable agent execution

- Status: Accepted
- Date: 2026-08-08

## Context

ADR 0020 permits provider-neutral durable-execution ports in the reusable platform but requires runtime AI capabilities to remain optional and forbids implicit persistence of prompts, completions, conversations, or tool payloads. ADR 0022 intentionally left retries, checkpoints, resumable execution, and human approval to P14-05. The Phase 11 Agent Tasks worker already provides at-least-once delivery, renewable claims, delivery-attempt fencing, idempotent terminal transitions, bounded retry scheduling, interruption cancellation, and correlated observability.

A durable agent workflow needs a reusable state boundary without replacing those worker guarantees or choosing an orchestration framework. Checkpoints can contain sensitive application state, and human approval is an authority boundary rather than a model decision. A safe shared primitive therefore needs to define persistence, ownership, idempotency, fencing, and approval semantics while leaving storage technology, retention policy, and application composition replaceable.

## Decision

1. **Add a backend-only provider- and framework-neutral durable execution boundary.**
   - `packages/backend/agent-durable` defines durable run identity, checkpoint, approval, lease, mutation, observer, and adapter contracts.
   - The project is not composed into `apps/api`, `apps/worker`, or `apps/web` in P14-05 and adds no durable-agent framework or model-provider dependency.
   - `DurableExecutionAdapter` is the replaceable persistence port. Applications may implement it with PostgreSQL, a managed workflow service, a transactional key-value store, or another approved durable backend without changing the coordinator contract.
   - `InMemoryDurableExecutionAdapter` exists only for deterministic tests and local composition. It can snapshot and restore state for interruption tests but is not a production durability implementation.

2. **Reuse Phase 11 lease, fencing, idempotency, and interruption semantics.**
   - A run is claimed for a bounded lease by a server-owned lease owner identifier. Every successful claim increments a monotonic fence and attempt count.
   - Mutating session operations require the current lease owner and fence and fail closed after lease expiry or takeover. This mirrors the worker's claim-token/delivery-attempt protection against stale owners.
   - An expired running lease may be reclaimed. The new session receives the latest persisted checkpoint and is marked as a recovered attempt rather than silently restarting from the beginning.
   - Checkpoint identifiers are idempotency keys. Retrying the same identifier with the same ordered checkpoint is a duplicate success; reusing it with different step/state content is an idempotency conflict.
   - Checkpoint sequence numbers are contiguous and monotonic so recovery has one unambiguous latest resume point.
   - Worker-level retry scheduling remains outside this library. P14-05 does not automatically retry model or tool side effects.

3. **Make approval pauses atomic with their resume checkpoint.**
   - `pauseForApproval` persists the checkpoint and pending approval in one adapter mutation and releases the execution lease.
   - A waiting run cannot be claimed until a trusted application caller resolves its current approval.
   - Approval stores only a stable approval identifier, step identifier, safe reason code, timestamps, status, and trusted approver identifier. Raw prompt/model/tool content is not an approval metadata field.
   - Approval moves the run back to pending so a later worker claim receives the saved checkpoint. Rejection terminates the run with the safe `approval_rejected` failure code.
   - Model output never supplies the trusted approver identity or grants approval. Authentication, authorization, approver policy, and audit policy remain application responsibilities and are expanded in P14-06.

4. **Keep checkpoint persistence explicit and application-owned.**
   - Checkpoint state is JSON-compatible application data because durable adapters must serialize it predictably. Non-finite numbers, cyclic graphs, functions, class instances, and other non-JSON values are rejected before persistence.
   - The shared library does not decide which prompt, completion, tool state, or retrieved content should be checkpointed. Callers must minimize persisted state according to the application's data policy.
   - Before a production adapter stores checkpoint state, the application must document the data owner, purpose, classification, retention period, deletion path, tenant isolation, encryption, access controls, backup/restore behavior, and regional constraints required by ADR 0020.
   - The deterministic memory adapter must not be described as durable storage or used as a production persistence mechanism.

5. **Reuse the existing correlation context while keeping observation payload-safe.**
   - Lifecycle events preserve run, trace, actor, and conversation identifiers plus status, attempt, fence, checkpoint sequence, approval identifiers/decisions, and safe failure codes when applicable.
   - Observer callbacks execute under `packages/observability` correlation context so applications can connect the lifecycle to the same structured logging, metrics, and tracing foundation as the Phase 11 worker.
   - Raw checkpoint state, prompt/completion text, tool arguments/results, approval free text, and credentials are not lifecycle event fields.

6. **Preserve later Phase 14 boundaries.**
   - P14-05 does not define model/provider fallback, input/output policy, sensitive-data policy orchestration, tool allowlists, approval authorization policy, or broader audit-event policy; those remain P14-06.
   - P14-05 does not make `ai=true` generate or compose a durable workflow. P14-07 owns generated AI-profile composition and must prove the default non-AI profile remains free of AI runtime dependencies.

## Consequences

SteadyStack now has a reusable durable-run lifecycle that can checkpoint, pause for a human decision, resume from the latest checkpoint after approval, and recover after worker interruption without allowing stale owners to overwrite newer progress. The same contract can sit behind different persistence technologies or workflow products.

The boundary deliberately does not pretend that an in-memory map is production durability and does not add database tables to every generated workspace. Applications that opt into durable AI execution must select and operate a persistent adapter explicitly, including data-retention and tenant-isolation controls.

Human approval is represented as durable state but is not itself an authorization policy. Broader safety, governance, fallback, and audit decisions remain P14-06, while installation and reference-workflow composition remain P14-07.
