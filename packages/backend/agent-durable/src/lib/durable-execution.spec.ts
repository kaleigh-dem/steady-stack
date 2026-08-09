import { getCorrelationContext } from '@steadystack/observability';
import { describe, expect, it } from 'vitest';

import {
  DurableExecutionCoordinator,
  DurableExecutionError,
  type DurableExecutionEvent,
  type DurableRunIdentity,
} from './durable-execution';
import { InMemoryDurableExecutionAdapter } from './memory-adapter';

const identity: DurableRunIdentity = {
  runId: 'run-01',
  traceId: 'trace-01',
  actorId: 'actor-01',
  conversationId: 'conversation-01',
};

function requireClaimed(
  result: Awaited<ReturnType<DurableExecutionCoordinator['claimRun']>>,
) {
  if (result.outcome !== 'claimed') {
    throw new Error(`Expected claimed run, received ${result.outcome}.`);
  }
  return result;
}

describe('durable execution lifecycle', () => {
  it('checkpoints and completes with payload-safe correlated observation', async () => {
    let nowMs = Date.parse('2026-08-08T12:00:00.000Z');
    const events: Array<{
      event: DurableExecutionEvent;
      context: ReturnType<typeof getCorrelationContext>;
    }> = [];
    const coordinator = new DurableExecutionCoordinator(
      new InMemoryDurableExecutionAdapter(),
      {
        now: () => new Date(nowMs),
        observer: (event) => {
          events.push({ event, context: getCorrelationContext() });
        },
      },
    );

    await coordinator.createRun(identity);
    const claimed = requireClaimed(
      await coordinator.claimRun({
        runId: identity.runId,
        leaseOwnerId: 'worker-01',
        leaseDurationMs: 30_000,
      }),
    );
    const secret = 'TOP-SECRET-CHECKPOINT';
    nowMs += 5;
    const checkpointed = await claimed.session.checkpoint({
      checkpointId: 'checkpoint-01',
      sequence: 1,
      stepId: 'model-response',
      state: { privateValue: secret, cursor: 3 },
    });
    expect(checkpointed.checkpoint).toMatchObject({
      checkpointId: 'checkpoint-01',
      sequence: 1,
      stepId: 'model-response',
      state: { privateValue: secret, cursor: 3 },
    });

    nowMs += 5;
    const completed = await claimed.session.complete();
    expect(completed).toMatchObject({
      status: 'completed',
      attemptCount: 1,
      fence: 1,
      leaseOwnerId: null,
      leaseExpiresAt: null,
    });
    expect(events.map(({ event }) => event.type)).toEqual([
      'run.created',
      'run.claimed',
      'checkpoint.saved',
      'run.completed',
    ]);
    expect(JSON.stringify(events)).not.toContain(secret);
    for (const { context } of events) {
      expect(context).toMatchObject({
        requestId: identity.runId,
        traceId: identity.traceId,
        actorId: identity.actorId,
        eventId: identity.runId,
        jobId: identity.runId,
        correlationId: identity.conversationId,
      });
    }
  });

  it('recovers an interrupted run from a persisted adapter snapshot', async () => {
    let nowMs = Date.parse('2026-08-08T13:00:00.000Z');
    const firstAdapter = new InMemoryDurableExecutionAdapter();
    const first = new DurableExecutionCoordinator(firstAdapter, {
      now: () => new Date(nowMs),
    });

    await first.createRun(identity);
    const original = requireClaimed(
      await first.claimRun({
        runId: identity.runId,
        leaseOwnerId: 'worker-before-crash',
        leaseDurationMs: 1_000,
      }),
    );
    await original.session.checkpoint({
      checkpointId: 'checkpoint-before-crash',
      sequence: 1,
      stepId: 'tool-result',
      state: { nextStep: 'summarize', completedToolCalls: ['call-01'] },
    });

    const restoredAdapter = new InMemoryDurableExecutionAdapter(
      firstAdapter.snapshot(),
    );
    nowMs += 1_001;
    const recoveredCoordinator = new DurableExecutionCoordinator(
      restoredAdapter,
      { now: () => new Date(nowMs) },
    );
    const recovered = requireClaimed(
      await recoveredCoordinator.claimRun({
        runId: identity.runId,
        leaseOwnerId: 'worker-after-crash',
        leaseDurationMs: 1_000,
      }),
    );

    expect(recovered.recovered).toBe(true);
    expect(recovered.session.run).toMatchObject({
      attemptCount: 2,
      fence: 2,
      status: 'running',
      checkpoint: {
        checkpointId: 'checkpoint-before-crash',
        sequence: 1,
        stepId: 'tool-result',
        state: { nextStep: 'summarize', completedToolCalls: ['call-01'] },
      },
    });
  });

  it('rejects a stale writer after an expired lease is reclaimed', async () => {
    let nowMs = Date.parse('2026-08-08T14:00:00.000Z');
    const coordinator = new DurableExecutionCoordinator(
      new InMemoryDurableExecutionAdapter(),
      { now: () => new Date(nowMs) },
    );
    await coordinator.createRun(identity);
    const stale = requireClaimed(
      await coordinator.claimRun({
        runId: identity.runId,
        leaseOwnerId: 'worker-stale',
        leaseDurationMs: 100,
      }),
    );

    nowMs += 101;
    const current = requireClaimed(
      await coordinator.claimRun({
        runId: identity.runId,
        leaseOwnerId: 'worker-current',
        leaseDurationMs: 100,
      }),
    );
    expect(current.recovered).toBe(true);

    await expect(
      stale.session.checkpoint({
        checkpointId: 'stale-checkpoint',
        sequence: 1,
        stepId: 'stale-step',
        state: { ignored: true },
      }),
    ).rejects.toMatchObject({ code: 'stale_fence' });
  });

  it('treats checkpoint ids as idempotency keys and fails closed on conflicts', async () => {
    const coordinator = new DurableExecutionCoordinator(
      new InMemoryDurableExecutionAdapter(),
      { now: () => new Date('2026-08-08T15:00:00.000Z') },
    );
    await coordinator.createRun(identity);
    const claimed = requireClaimed(
      await coordinator.claimRun({
        runId: identity.runId,
        leaseOwnerId: 'worker-01',
        leaseDurationMs: 1_000,
      }),
    );
    const checkpoint = {
      checkpointId: 'checkpoint-idempotent',
      sequence: 1,
      stepId: 'step-01',
      state: { cursor: 1 },
    } as const;

    await claimed.session.checkpoint(checkpoint);
    await expect(claimed.session.checkpoint(checkpoint)).resolves.toMatchObject(
      {
        checkpoint: { checkpointId: 'checkpoint-idempotent', sequence: 1 },
      },
    );
    await expect(
      claimed.session.checkpoint({
        ...checkpoint,
        state: { cursor: 2 },
      }),
    ).rejects.toMatchObject({ code: 'idempotency_conflict' });
  });

  it('pauses atomically for approval and resumes only after approval', async () => {
    let nowMs = Date.parse('2026-08-08T16:00:00.000Z');
    const coordinator = new DurableExecutionCoordinator(
      new InMemoryDurableExecutionAdapter(),
      { now: () => new Date(nowMs) },
    );
    await coordinator.createRun(identity);
    const claimed = requireClaimed(
      await coordinator.claimRun({
        runId: identity.runId,
        leaseOwnerId: 'worker-01',
        leaseDurationMs: 10_000,
      }),
    );

    const paused = await claimed.session.pauseForApproval({
      checkpoint: {
        checkpointId: 'checkpoint-approval',
        sequence: 1,
        stepId: 'destructive-tool',
        state: { proposedToolCallId: 'call-01' },
      },
      approvalId: 'approval-01',
      reasonCode: 'human_review_required',
    });
    expect(paused).toMatchObject({
      status: 'waiting_for_approval',
      leaseOwnerId: null,
      leaseExpiresAt: null,
      checkpoint: { checkpointId: 'checkpoint-approval', sequence: 1 },
      approval: {
        approvalId: 'approval-01',
        status: 'pending',
        reasonCode: 'human_review_required',
      },
    });

    const waiting = await coordinator.claimRun({
      runId: identity.runId,
      leaseOwnerId: 'worker-02',
      leaseDurationMs: 10_000,
    });
    expect(waiting.outcome).toBe('waiting-for-approval');

    nowMs += 10;
    const approved = await coordinator.resolveApproval({
      runId: identity.runId,
      approvalId: 'approval-01',
      decision: 'approved',
      decidedBy: 'reviewer-01',
    });
    expect(approved).toMatchObject({
      status: 'pending',
      approval: { status: 'approved', decidedBy: 'reviewer-01' },
    });

    const resumed = requireClaimed(
      await coordinator.claimRun({
        runId: identity.runId,
        leaseOwnerId: 'worker-02',
        leaseDurationMs: 10_000,
      }),
    );
    expect(resumed.session.run).toMatchObject({
      attemptCount: 2,
      fence: 2,
      checkpoint: { checkpointId: 'checkpoint-approval', sequence: 1 },
      approval: { status: 'approved' },
    });
  });

  it('makes human rejection terminal without model-controlled free text', async () => {
    const coordinator = new DurableExecutionCoordinator(
      new InMemoryDurableExecutionAdapter(),
      { now: () => new Date('2026-08-08T17:00:00.000Z') },
    );
    await coordinator.createRun(identity);
    const claimed = requireClaimed(
      await coordinator.claimRun({
        runId: identity.runId,
        leaseOwnerId: 'worker-01',
        leaseDurationMs: 10_000,
      }),
    );
    await claimed.session.pauseForApproval({
      checkpoint: {
        checkpointId: 'checkpoint-reject',
        sequence: 1,
        stepId: 'external-write',
        state: { cursor: 1 },
      },
      approvalId: 'approval-reject',
      reasonCode: 'human_review_required',
    });

    const rejected = await coordinator.resolveApproval({
      runId: identity.runId,
      approvalId: 'approval-reject',
      decision: 'rejected',
      decidedBy: 'reviewer-01',
    });
    expect(rejected).toMatchObject({
      status: 'failed',
      failureCode: 'approval_rejected',
      approval: { status: 'rejected', decidedBy: 'reviewer-01' },
    });
    expect(
      await coordinator.claimRun({
        runId: identity.runId,
        leaseOwnerId: 'worker-02',
        leaseDurationMs: 10_000,
      }),
    ).toMatchObject({ outcome: 'failed' });
  });

  it('rejects non-JSON checkpoint state and unsafe approval codes', async () => {
    const coordinator = new DurableExecutionCoordinator(
      new InMemoryDurableExecutionAdapter(),
      { now: () => new Date('2026-08-08T18:00:00.000Z') },
    );
    await coordinator.createRun(identity);
    const claimed = requireClaimed(
      await coordinator.claimRun({
        runId: identity.runId,
        leaseOwnerId: 'worker-01',
        leaseDurationMs: 10_000,
      }),
    );

    await expect(
      claimed.session.checkpoint({
        checkpointId: 'checkpoint-invalid',
        sequence: 1,
        stepId: 'step-01',
        state: { invalid: Number.POSITIVE_INFINITY },
      }),
    ).rejects.toBeInstanceOf(DurableExecutionError);
    await expect(
      claimed.session.pauseForApproval({
        checkpoint: {
          checkpointId: 'checkpoint-safe-code',
          sequence: 1,
          stepId: 'step-01',
          state: { cursor: 1 },
        },
        approvalId: 'approval-safe-code',
        reasonCode: 'RAW SUBJECT OUTPUT',
      }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
  });
});
