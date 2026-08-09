import type {
  ClaimDurableRunInput,
  ClaimDurableRunResult,
  CreateDurableRunInput,
  CreateDurableRunResult,
  DurableApproval,
  DurableCheckpoint,
  DurableExecutionAdapter,
  DurableLeaseReference,
  DurableMutationResult,
  DurableRunRecord,
  FailDurableRunInput,
  FinishDurableRunInput,
  PauseDurableRunForApprovalInput,
  RenewDurableRunLeaseInput,
  ResolveDurableApprovalInput,
  SaveDurableCheckpointInput,
} from './durable-execution';
import {
  canonicalCheckpointValue,
  cloneCheckpointValue,
  durableCode,
  durableIdentifier,
  positiveDuration,
  positiveInteger,
  validDate,
} from './validation';

function cloneDate(value: Date | null): Date | null {
  return value === null ? null : new Date(value.getTime());
}

function cloneCheckpoint(
  checkpoint: DurableCheckpoint | null,
): DurableCheckpoint | null {
  if (checkpoint === null) return null;
  return {
    checkpointId: checkpoint.checkpointId,
    sequence: checkpoint.sequence,
    stepId: checkpoint.stepId,
    state: cloneCheckpointValue(checkpoint.state),
    savedAt: new Date(checkpoint.savedAt.getTime()),
  };
}

function cloneApproval(
  approval: DurableApproval | null,
): DurableApproval | null {
  if (approval === null) return null;
  return {
    approvalId: approval.approvalId,
    stepId: approval.stepId,
    reasonCode: approval.reasonCode,
    requestedAt: new Date(approval.requestedAt.getTime()),
    status: approval.status,
    decidedBy: approval.decidedBy,
    decidedAt: cloneDate(approval.decidedAt),
  };
}

function cloneRecord(record: DurableRunRecord): DurableRunRecord {
  return {
    runId: record.runId,
    traceId: record.traceId,
    actorId: record.actorId,
    conversationId: record.conversationId,
    status: record.status,
    attemptCount: record.attemptCount,
    fence: record.fence,
    leaseOwnerId: record.leaseOwnerId,
    leaseExpiresAt: cloneDate(record.leaseExpiresAt),
    checkpoint: cloneCheckpoint(record.checkpoint),
    approval: cloneApproval(record.approval),
    createdAt: new Date(record.createdAt.getTime()),
    completedAt: cloneDate(record.completedAt),
    failedAt: cloneDate(record.failedAt),
    failureCode: record.failureCode,
  };
}

function sameIdentity(
  record: DurableRunRecord,
  input: CreateDurableRunInput,
): boolean {
  return (
    record.runId === input.runId &&
    record.traceId === input.traceId &&
    record.actorId === input.actorId &&
    record.conversationId === input.conversationId
  );
}

function sameCheckpoint(
  left: DurableCheckpoint,
  right: DurableCheckpoint,
): boolean {
  return (
    left.checkpointId === right.checkpointId &&
    left.sequence === right.sequence &&
    left.stepId === right.stepId &&
    canonicalCheckpointValue(left.state) ===
      canonicalCheckpointValue(right.state)
  );
}

function mutation(
  outcome: Exclude<DurableMutationResult['outcome'], 'missing'>,
  record: DurableRunRecord,
): DurableMutationResult {
  return { outcome, record: cloneRecord(record) };
}

export class InMemoryDurableExecutionAdapter implements DurableExecutionAdapter {
  private readonly runs = new Map<string, DurableRunRecord>();

  public constructor(snapshot: readonly DurableRunRecord[] = []) {
    for (const record of snapshot) {
      if (this.runs.has(record.runId)) {
        throw new Error(`Duplicate run ${record.runId} in memory snapshot.`);
      }
      this.runs.set(record.runId, cloneRecord(record));
    }
  }

  public snapshot(): readonly DurableRunRecord[] {
    return [...this.runs.values()].map(cloneRecord);
  }

  public async create(
    input: CreateDurableRunInput,
  ): Promise<CreateDurableRunResult> {
    const runId = durableIdentifier(input.runId, 'runId');
    durableIdentifier(input.traceId, 'traceId');
    durableIdentifier(input.actorId, 'actorId');
    durableIdentifier(input.conversationId, 'conversationId');
    const createdAt = validDate(input.createdAt, 'createdAt');
    const existing = this.runs.get(runId);
    if (existing) {
      return {
        outcome: sameIdentity(existing, input) ? 'exists' : 'conflict',
        record: cloneRecord(existing),
      };
    }

    const record: DurableRunRecord = {
      runId,
      traceId: input.traceId,
      actorId: input.actorId,
      conversationId: input.conversationId,
      status: 'pending',
      attemptCount: 0,
      fence: 0,
      leaseOwnerId: null,
      leaseExpiresAt: null,
      checkpoint: null,
      approval: null,
      createdAt: new Date(createdAt.getTime()),
      completedAt: null,
      failedAt: null,
      failureCode: null,
    };
    this.runs.set(runId, record);
    return { outcome: 'created', record: cloneRecord(record) };
  }

  public async get(runIdValue: string): Promise<DurableRunRecord | null> {
    const runId = durableIdentifier(runIdValue, 'runId');
    const record = this.runs.get(runId);
    return record ? cloneRecord(record) : null;
  }

  public async claim(
    input: ClaimDurableRunInput,
  ): Promise<ClaimDurableRunResult> {
    const runId = durableIdentifier(input.runId, 'runId');
    const leaseOwnerId = durableIdentifier(input.leaseOwnerId, 'leaseOwnerId');
    const now = validDate(input.now, 'now');
    const leaseDurationMs = positiveDuration(
      input.leaseDurationMs,
      'leaseDurationMs',
    );
    const record = this.runs.get(runId);
    if (!record) return { outcome: 'missing' };
    if (record.status === 'completed' || record.status === 'failed') {
      return { outcome: record.status, record: cloneRecord(record) };
    }
    if (record.status === 'waiting_for_approval') {
      return { outcome: 'waiting-for-approval', record: cloneRecord(record) };
    }

    const activeLease =
      record.status === 'running' &&
      record.leaseExpiresAt !== null &&
      record.leaseExpiresAt.getTime() > now.getTime();
    if (activeLease) {
      return { outcome: 'in-progress', record: cloneRecord(record) };
    }

    const recovered = record.status === 'running';
    const claimed: DurableRunRecord = {
      ...record,
      status: 'running',
      attemptCount: record.attemptCount + 1,
      fence: record.fence + 1,
      leaseOwnerId,
      leaseExpiresAt: new Date(now.getTime() + leaseDurationMs),
      completedAt: null,
      failedAt: null,
      failureCode: null,
    };
    this.runs.set(runId, claimed);
    return { outcome: 'claimed', record: cloneRecord(claimed), recovered };
  }

  private leaseFailure(
    record: DurableRunRecord,
    input: DurableLeaseReference,
  ): DurableMutationResult | null {
    const now = validDate(input.now, 'now');
    if (record.status !== 'running') return mutation('invalid-state', record);
    if (
      record.leaseOwnerId !== input.leaseOwnerId ||
      record.fence !== input.fence
    ) {
      return mutation('stale-fence', record);
    }
    if (
      record.leaseExpiresAt === null ||
      record.leaseExpiresAt.getTime() <= now.getTime()
    ) {
      return mutation('lease-expired', record);
    }
    return null;
  }

  public async renew(
    input: RenewDurableRunLeaseInput,
  ): Promise<DurableMutationResult> {
    durableIdentifier(input.runId, 'runId');
    durableIdentifier(input.leaseOwnerId, 'leaseOwnerId');
    positiveInteger(input.fence, 'fence');
    const leaseDurationMs = positiveDuration(
      input.leaseDurationMs,
      'leaseDurationMs',
    );
    const record = this.runs.get(input.runId);
    if (!record) return { outcome: 'missing' };
    const failure = this.leaseFailure(record, input);
    if (failure) return failure;
    const renewed = {
      ...record,
      leaseExpiresAt: new Date(input.now.getTime() + leaseDurationMs),
    };
    this.runs.set(input.runId, renewed);
    return mutation('transitioned', renewed);
  }

  public async checkpoint(
    input: SaveDurableCheckpointInput,
  ): Promise<DurableMutationResult> {
    durableIdentifier(input.runId, 'runId');
    durableIdentifier(input.leaseOwnerId, 'leaseOwnerId');
    positiveInteger(input.fence, 'fence');
    const record = this.runs.get(input.runId);
    if (!record) return { outcome: 'missing' };

    if (record.checkpoint?.checkpointId === input.checkpoint.checkpointId) {
      return sameCheckpoint(record.checkpoint, input.checkpoint)
        ? mutation('duplicate', record)
        : mutation('idempotency-conflict', record);
    }

    const failure = this.leaseFailure(record, input);
    if (failure) return failure;
    const expectedSequence = (record.checkpoint?.sequence ?? 0) + 1;
    if (input.checkpoint.sequence !== expectedSequence) {
      return mutation('invalid-state', record);
    }
    const updated = {
      ...record,
      checkpoint: cloneCheckpoint(input.checkpoint),
    };
    this.runs.set(input.runId, updated);
    return mutation('transitioned', updated);
  }

  public async pauseForApproval(
    input: PauseDurableRunForApprovalInput,
  ): Promise<DurableMutationResult> {
    durableIdentifier(input.runId, 'runId');
    durableIdentifier(input.leaseOwnerId, 'leaseOwnerId');
    positiveInteger(input.fence, 'fence');
    const approvalId = durableIdentifier(input.approvalId, 'approvalId');
    const reasonCode = durableCode(input.reasonCode, 'reasonCode');
    const requestedAt = validDate(input.requestedAt, 'requestedAt');
    const record = this.runs.get(input.runId);
    if (!record) return { outcome: 'missing' };

    if (record.approval?.approvalId === approvalId) {
      return record.checkpoint &&
        sameCheckpoint(record.checkpoint, input.checkpoint)
        ? mutation('duplicate', record)
        : mutation('idempotency-conflict', record);
    }

    const failure = this.leaseFailure(record, input);
    if (failure) return failure;
    const expectedSequence = (record.checkpoint?.sequence ?? 0) + 1;
    if (input.checkpoint.sequence !== expectedSequence) {
      return mutation('invalid-state', record);
    }

    const approval: DurableApproval = {
      approvalId,
      stepId: input.checkpoint.stepId,
      reasonCode,
      requestedAt: new Date(requestedAt.getTime()),
      status: 'pending',
      decidedBy: null,
      decidedAt: null,
    };
    const paused: DurableRunRecord = {
      ...record,
      status: 'waiting_for_approval',
      leaseOwnerId: null,
      leaseExpiresAt: null,
      checkpoint: cloneCheckpoint(input.checkpoint),
      approval,
    };
    this.runs.set(input.runId, paused);
    return mutation('transitioned', paused);
  }

  public async resolveApproval(
    input: ResolveDurableApprovalInput,
  ): Promise<DurableMutationResult> {
    durableIdentifier(input.runId, 'runId');
    const approvalId = durableIdentifier(input.approvalId, 'approvalId');
    const decidedBy = durableIdentifier(input.decidedBy, 'decidedBy');
    const decidedAt = validDate(input.decidedAt, 'decidedAt');
    const record = this.runs.get(input.runId);
    if (!record) return { outcome: 'missing' };
    const approval = record.approval;
    if (!approval || approval.approvalId !== approvalId) {
      return mutation('invalid-state', record);
    }
    if (approval.status !== 'pending') {
      const sameDecision = approval.status === input.decision;
      const sameActor = approval.decidedBy === decidedBy;
      return sameDecision && sameActor
        ? mutation('duplicate', record)
        : mutation('idempotency-conflict', record);
    }
    if (record.status !== 'waiting_for_approval') {
      return mutation('invalid-state', record);
    }

    const resolvedApproval: DurableApproval = {
      ...approval,
      status: input.decision,
      decidedBy,
      decidedAt: new Date(decidedAt.getTime()),
    };
    const updated: DurableRunRecord =
      input.decision === 'approved'
        ? {
            ...record,
            status: 'pending',
            approval: resolvedApproval,
          }
        : {
            ...record,
            status: 'failed',
            approval: resolvedApproval,
            failedAt: new Date(decidedAt.getTime()),
            failureCode: 'approval_rejected',
          };
    this.runs.set(input.runId, updated);
    return mutation('transitioned', updated);
  }

  public async complete(
    input: FinishDurableRunInput,
  ): Promise<DurableMutationResult> {
    durableIdentifier(input.runId, 'runId');
    durableIdentifier(input.leaseOwnerId, 'leaseOwnerId');
    positiveInteger(input.fence, 'fence');
    const finishedAt = validDate(input.finishedAt, 'finishedAt');
    const record = this.runs.get(input.runId);
    if (!record) return { outcome: 'missing' };
    if (record.status === 'completed' && record.fence === input.fence) {
      return mutation('duplicate', record);
    }
    const failure = this.leaseFailure(record, input);
    if (failure) return failure;
    const completed: DurableRunRecord = {
      ...record,
      status: 'completed',
      leaseOwnerId: null,
      leaseExpiresAt: null,
      completedAt: new Date(finishedAt.getTime()),
      failedAt: null,
      failureCode: null,
    };
    this.runs.set(input.runId, completed);
    return mutation('transitioned', completed);
  }

  public async fail(
    input: FailDurableRunInput,
  ): Promise<DurableMutationResult> {
    durableIdentifier(input.runId, 'runId');
    durableIdentifier(input.leaseOwnerId, 'leaseOwnerId');
    positiveInteger(input.fence, 'fence');
    const failureCode = durableCode(input.failureCode, 'failureCode');
    const finishedAt = validDate(input.finishedAt, 'finishedAt');
    const record = this.runs.get(input.runId);
    if (!record) return { outcome: 'missing' };
    if (
      record.status === 'failed' &&
      record.fence === input.fence &&
      record.failureCode === failureCode
    ) {
      return mutation('duplicate', record);
    }
    const failure = this.leaseFailure(record, input);
    if (failure) return failure;
    const failed: DurableRunRecord = {
      ...record,
      status: 'failed',
      leaseOwnerId: null,
      leaseExpiresAt: null,
      completedAt: null,
      failedAt: new Date(finishedAt.getTime()),
      failureCode,
    };
    this.runs.set(input.runId, failed);
    return mutation('transitioned', failed);
  }
}
