import { describe, expect, it } from 'vitest';

import {
  DurableExecutionCoordinator,
  type DurableRunIdentity,
} from './durable-execution';
import { InMemoryDurableExecutionAdapter } from './memory-adapter';

function requireClaimed(
  result: Awaited<ReturnType<DurableExecutionCoordinator['claimRun']>>,
) {
  if (result.outcome !== 'claimed') {
    throw new Error(`Expected claimed run, received ${result.outcome}.`);
  }
  return result;
}

function identity(runId: string): DurableRunIdentity {
  return {
    runId,
    traceId: `trace-${runId}`,
    actorId: 'actor-01',
    conversationId: 'conversation-01',
  };
}

describe('durable execution lease fencing', () => {
  it('rejects an identical checkpoint replay from a stale owner after takeover', async () => {
    let nowMs = Date.parse('2026-08-08T19:00:00.000Z');
    const coordinator = new DurableExecutionCoordinator(
      new InMemoryDurableExecutionAdapter(),
      { now: () => new Date(nowMs) },
    );
    const run = identity('run-checkpoint-replay');
    await coordinator.createRun(run);
    const stale = requireClaimed(
      await coordinator.claimRun({
        runId: run.runId,
        leaseOwnerId: 'worker-old',
        leaseDurationMs: 100,
      }),
    );
    const checkpoint = {
      checkpointId: 'checkpoint-01',
      sequence: 1,
      stepId: 'step-01',
      state: { cursor: 1 },
    } as const;
    await stale.session.checkpoint(checkpoint);

    nowMs += 101;
    const current = requireClaimed(
      await coordinator.claimRun({
        runId: run.runId,
        leaseOwnerId: 'worker-new',
        leaseDurationMs: 100,
      }),
    );
    expect(current.session.run.fence).toBe(2);

    await expect(stale.session.checkpoint(checkpoint)).rejects.toMatchObject({
      code: 'stale_fence',
    });
  });

  it('rejects an identical approval replay from a stale owner after resume takeover', async () => {
    let nowMs = Date.parse('2026-08-08T20:00:00.000Z');
    const coordinator = new DurableExecutionCoordinator(
      new InMemoryDurableExecutionAdapter(),
      { now: () => new Date(nowMs) },
    );
    const run = identity('run-approval-replay');
    await coordinator.createRun(run);
    const stale = requireClaimed(
      await coordinator.claimRun({
        runId: run.runId,
        leaseOwnerId: 'worker-old',
        leaseDurationMs: 1_000,
      }),
    );
    const approval = {
      checkpoint: {
        checkpointId: 'checkpoint-approval',
        sequence: 1,
        stepId: 'destructive-tool',
        state: { proposedToolCallId: 'call-01' },
      },
      approvalId: 'approval-01',
      reasonCode: 'human_review_required',
    } as const;
    await stale.session.pauseForApproval(approval);

    nowMs += 1;
    await coordinator.resolveApproval({
      runId: run.runId,
      approvalId: approval.approvalId,
      decision: 'approved',
      decidedBy: 'reviewer-01',
    });
    const current = requireClaimed(
      await coordinator.claimRun({
        runId: run.runId,
        leaseOwnerId: 'worker-new',
        leaseDurationMs: 1_000,
      }),
    );
    expect(current.session.run.fence).toBe(2);

    await expect(
      stale.session.pauseForApproval(approval),
    ).rejects.toMatchObject({
      code: 'stale_fence',
    });
  });
});
