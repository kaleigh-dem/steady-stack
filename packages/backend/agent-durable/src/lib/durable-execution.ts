import {
  createCorrelationContext,
  runWithCorrelationContext,
} from '@steadystack/observability';

import {
  durableCheckpointState,
  durableCode,
  durableIdentifier,
  positiveDuration,
  positiveInteger,
  validDate,
} from './validation';

export type DurableCheckpointValue =
  | null
  | boolean
  | number
  | string
  | readonly DurableCheckpointValue[]
  | { readonly [key: string]: DurableCheckpointValue };

export type DurableRunStatus =
  'pending' | 'running' | 'waiting_for_approval' | 'completed' | 'failed';

export interface DurableRunIdentity {
  readonly runId: string;
  readonly traceId: string;
  readonly actorId: string;
  readonly conversationId: string;
}

export interface DurableCheckpoint {
  readonly checkpointId: string;
  readonly sequence: number;
  readonly stepId: string;
  readonly state: DurableCheckpointValue;
  readonly savedAt: Date;
}

export type DurableApprovalStatus = 'pending' | 'approved' | 'rejected';
export type DurableApprovalDecision = 'approved' | 'rejected';

export interface DurableApproval {
  readonly approvalId: string;
  readonly stepId: string;
  readonly reasonCode: string;
  readonly requestedAt: Date;
  readonly status: DurableApprovalStatus;
  readonly decidedBy: string | null;
  readonly decidedAt: Date | null;
}

export interface DurableRunRecord extends DurableRunIdentity {
  readonly status: DurableRunStatus;
  readonly attemptCount: number;
  readonly fence: number;
  readonly leaseOwnerId: string | null;
  readonly leaseExpiresAt: Date | null;
  readonly checkpoint: DurableCheckpoint | null;
  readonly approval: DurableApproval | null;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
  readonly failedAt: Date | null;
  readonly failureCode: string | null;
}

export interface CreateDurableRunInput extends DurableRunIdentity {
  readonly createdAt: Date;
}

export type CreateDurableRunResult =
  | {
      readonly outcome: 'created' | 'exists';
      readonly record: DurableRunRecord;
    }
  | { readonly outcome: 'conflict'; readonly record: DurableRunRecord };

export interface ClaimDurableRunInput {
  readonly runId: string;
  readonly leaseOwnerId: string;
  readonly now: Date;
  readonly leaseDurationMs: number;
}

export type ClaimDurableRunResult =
  | {
      readonly outcome: 'claimed';
      readonly record: DurableRunRecord;
      readonly recovered: boolean;
    }
  | {
      readonly outcome:
        'in-progress' | 'waiting-for-approval' | 'completed' | 'failed';
      readonly record: DurableRunRecord;
    }
  | { readonly outcome: 'missing' };

export interface DurableLeaseReference {
  readonly runId: string;
  readonly leaseOwnerId: string;
  readonly fence: number;
  readonly now: Date;
}

export interface RenewDurableRunLeaseInput extends DurableLeaseReference {
  readonly leaseDurationMs: number;
}

export interface SaveDurableCheckpointInput extends DurableLeaseReference {
  readonly checkpoint: DurableCheckpoint;
}

export interface PauseDurableRunForApprovalInput extends DurableLeaseReference {
  readonly checkpoint: DurableCheckpoint;
  readonly approvalId: string;
  readonly reasonCode: string;
  readonly requestedAt: Date;
}

export interface ResolveDurableApprovalInput {
  readonly runId: string;
  readonly approvalId: string;
  readonly decision: DurableApprovalDecision;
  readonly decidedBy: string;
  readonly decidedAt: Date;
}

export interface FinishDurableRunInput extends DurableLeaseReference {
  readonly finishedAt: Date;
}

export interface FailDurableRunInput extends FinishDurableRunInput {
  readonly failureCode: string;
}

export type DurableMutationResult =
  | {
      readonly outcome: 'transitioned' | 'duplicate';
      readonly record: DurableRunRecord;
    }
  | {
      readonly outcome:
        | 'stale-fence'
        | 'lease-expired'
        | 'invalid-state'
        | 'idempotency-conflict';
      readonly record: DurableRunRecord;
    }
  | { readonly outcome: 'missing' };

export interface DurableExecutionAdapter {
  create(input: CreateDurableRunInput): Promise<CreateDurableRunResult>;
  get(runId: string): Promise<DurableRunRecord | null>;
  claim(input: ClaimDurableRunInput): Promise<ClaimDurableRunResult>;
  renew(input: RenewDurableRunLeaseInput): Promise<DurableMutationResult>;
  checkpoint(input: SaveDurableCheckpointInput): Promise<DurableMutationResult>;
  pauseForApproval(
    input: PauseDurableRunForApprovalInput,
  ): Promise<DurableMutationResult>;
  resolveApproval(
    input: ResolveDurableApprovalInput,
  ): Promise<DurableMutationResult>;
  complete(input: FinishDurableRunInput): Promise<DurableMutationResult>;
  fail(input: FailDurableRunInput): Promise<DurableMutationResult>;
}

export type DurableExecutionEventType =
  | 'run.created'
  | 'run.claimed'
  | 'run.recovered'
  | 'lease.renewed'
  | 'checkpoint.saved'
  | 'approval.requested'
  | 'approval.resolved'
  | 'run.completed'
  | 'run.failed';

export interface DurableExecutionEvent extends DurableRunIdentity {
  readonly type: DurableExecutionEventType;
  readonly status: DurableRunStatus;
  readonly attemptCount: number;
  readonly fence: number;
  readonly checkpointSequence?: number;
  readonly approvalId?: string;
  readonly approvalDecision?: DurableApprovalDecision;
  readonly failureCode?: string;
}

export type DurableExecutionObserver = (
  event: DurableExecutionEvent,
) => void | Promise<void>;

export type DurableExecutionErrorCode =
  | 'invalid_input'
  | 'run_conflict'
  | 'run_missing'
  | 'stale_fence'
  | 'lease_expired'
  | 'invalid_state'
  | 'idempotency_conflict';

export class DurableExecutionError extends Error {
  public constructor(
    public readonly code: DurableExecutionErrorCode,
    public readonly runId: string,
    public readonly operation: string,
  ) {
    super(`Durable execution ${operation} failed with ${code}.`);
    this.name = 'DurableExecutionError';
  }
}

function safeRunId(value: unknown): string {
  try {
    return durableIdentifier(value, 'runId');
  } catch {
    return 'unknown';
  }
}

function validateInput<T>(
  operation: string,
  runId: unknown,
  callback: () => T,
): T {
  try {
    return callback();
  } catch {
    throw new DurableExecutionError(
      'invalid_input',
      safeRunId(runId),
      operation,
    );
  }
}

function validateIdentity(identity: DurableRunIdentity): DurableRunIdentity {
  return {
    runId: durableIdentifier(identity.runId, 'runId'),
    traceId: durableIdentifier(identity.traceId, 'traceId'),
    actorId: durableIdentifier(identity.actorId, 'actorId'),
    conversationId: durableIdentifier(
      identity.conversationId,
      'conversationId',
    ),
  };
}

function validateCheckpointInput(
  input: DurableCheckpointInput,
  savedAt: Date,
): DurableCheckpoint {
  return {
    checkpointId: durableIdentifier(input.checkpointId, 'checkpointId'),
    sequence: positiveInteger(input.sequence, 'checkpoint.sequence'),
    stepId: durableIdentifier(input.stepId, 'checkpoint.stepId'),
    state: durableCheckpointState(input.state),
    savedAt: validDate(savedAt, 'checkpoint.savedAt'),
  };
}

function resultErrorCode(
  outcome: Exclude<
    DurableMutationResult['outcome'],
    'transitioned' | 'duplicate'
  >,
): DurableExecutionErrorCode {
  switch (outcome) {
    case 'missing':
      return 'run_missing';
    case 'stale-fence':
      return 'stale_fence';
    case 'lease-expired':
      return 'lease_expired';
    case 'invalid-state':
      return 'invalid_state';
    case 'idempotency-conflict':
      return 'idempotency_conflict';
  }
}

function requireMutation(
  result: DurableMutationResult,
  runId: string,
  operation: string,
): { readonly duplicate: boolean; readonly record: DurableRunRecord } {
  if (result.outcome === 'transitioned' || result.outcome === 'duplicate') {
    return { duplicate: result.outcome === 'duplicate', record: result.record };
  }
  throw new DurableExecutionError(
    resultErrorCode(result.outcome),
    runId,
    operation,
  );
}

async function emit(
  observer: DurableExecutionObserver | undefined,
  record: DurableRunRecord,
  event: Omit<
    DurableExecutionEvent,
    keyof DurableRunIdentity | 'status' | 'attemptCount' | 'fence'
  >,
): Promise<void> {
  if (!observer) return;
  const payload: DurableExecutionEvent = {
    type: event.type,
    runId: record.runId,
    traceId: record.traceId,
    actorId: record.actorId,
    conversationId: record.conversationId,
    status: record.status,
    attemptCount: record.attemptCount,
    fence: record.fence,
    ...(event.checkpointSequence === undefined
      ? {}
      : { checkpointSequence: event.checkpointSequence }),
    ...(event.approvalId === undefined ? {} : { approvalId: event.approvalId }),
    ...(event.approvalDecision === undefined
      ? {}
      : { approvalDecision: event.approvalDecision }),
    ...(event.failureCode === undefined
      ? {}
      : { failureCode: event.failureCode }),
  };

  const correlation = createCorrelationContext({
    requestId: record.runId,
    traceId: record.traceId,
    actorId: record.actorId,
    eventId: record.runId,
    jobId: record.runId,
    correlationId: record.conversationId,
  });
  await runWithCorrelationContext(correlation, () => observer(payload));
}

export interface DurableCheckpointInput {
  readonly checkpointId: string;
  readonly sequence: number;
  readonly stepId: string;
  readonly state: DurableCheckpointValue;
}

export interface PauseForApprovalInput {
  readonly checkpoint: DurableCheckpointInput;
  readonly approvalId: string;
  readonly reasonCode: string;
}

export interface ClaimRunInput {
  readonly runId: string;
  readonly leaseOwnerId: string;
  readonly leaseDurationMs: number;
}

export type ClaimRunOutcome =
  | {
      readonly outcome: 'claimed';
      readonly recovered: boolean;
      readonly session: DurableRunSession;
    }
  | {
      readonly outcome:
        'in-progress' | 'waiting-for-approval' | 'completed' | 'failed';
      readonly record: DurableRunRecord;
    }
  | { readonly outcome: 'missing' };

export interface ResolveApprovalInput {
  readonly runId: string;
  readonly approvalId: string;
  readonly decision: DurableApprovalDecision;
  readonly decidedBy: string;
}

export interface DurableExecutionCoordinatorOptions {
  readonly now?: () => Date;
  readonly observer?: DurableExecutionObserver;
}

export class DurableExecutionCoordinator {
  private readonly now: () => Date;
  private readonly observer: DurableExecutionObserver | undefined;

  public constructor(
    private readonly adapter: DurableExecutionAdapter,
    options: DurableExecutionCoordinatorOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.observer = options.observer;
  }

  public async createRun(
    identity: DurableRunIdentity,
  ): Promise<DurableRunRecord> {
    const validated = validateInput('create', identity.runId, () =>
      validateIdentity(identity),
    );
    const createdAt = validateInput('create', validated.runId, () =>
      validDate(this.now(), 'now'),
    );
    const result = await this.adapter.create({ ...validated, createdAt });
    if (result.outcome === 'conflict') {
      throw new DurableExecutionError(
        'run_conflict',
        validated.runId,
        'create',
      );
    }
    if (result.outcome === 'created') {
      await emit(this.observer, result.record, { type: 'run.created' });
    }
    return result.record;
  }

  public async getRun(runId: string): Promise<DurableRunRecord | null> {
    const validatedRunId = validateInput('get', runId, () =>
      durableIdentifier(runId, 'runId'),
    );
    return this.adapter.get(validatedRunId);
  }

  public async claimRun(input: ClaimRunInput): Promise<ClaimRunOutcome> {
    const validated = validateInput('claim', input.runId, () => ({
      runId: durableIdentifier(input.runId, 'runId'),
      leaseOwnerId: durableIdentifier(input.leaseOwnerId, 'leaseOwnerId'),
      leaseDurationMs: positiveDuration(
        input.leaseDurationMs,
        'leaseDurationMs',
      ),
      now: validDate(this.now(), 'now'),
    }));
    const result = await this.adapter.claim(validated);
    if (result.outcome !== 'claimed') return result;
    await emit(this.observer, result.record, {
      type: result.recovered ? 'run.recovered' : 'run.claimed',
    });
    return {
      outcome: 'claimed',
      recovered: result.recovered,
      session: new DurableRunSession(
        this.adapter,
        result.record,
        validated.leaseOwnerId,
        this.now,
        this.observer,
      ),
    };
  }

  public async resolveApproval(
    input: ResolveApprovalInput,
  ): Promise<DurableRunRecord> {
    const validated = validateInput('resolve-approval', input.runId, () => ({
      runId: durableIdentifier(input.runId, 'runId'),
      approvalId: durableIdentifier(input.approvalId, 'approvalId'),
      decision:
        input.decision === 'approved' || input.decision === 'rejected'
          ? input.decision
          : (() => {
              throw new Error('invalid decision');
            })(),
      decidedBy: durableIdentifier(input.decidedBy, 'decidedBy'),
      decidedAt: validDate(this.now(), 'now'),
    }));
    const mutation = requireMutation(
      await this.adapter.resolveApproval(validated),
      validated.runId,
      'resolve-approval',
    );
    if (!mutation.duplicate) {
      await emit(this.observer, mutation.record, {
        type: 'approval.resolved',
        approvalId: validated.approvalId,
        approvalDecision: validated.decision,
      });
      if (validated.decision === 'rejected') {
        await emit(this.observer, mutation.record, {
          type: 'run.failed',
          failureCode: 'approval_rejected',
        });
      }
    }
    return mutation.record;
  }
}

export class DurableRunSession {
  private record: DurableRunRecord;

  public constructor(
    private readonly adapter: DurableExecutionAdapter,
    record: DurableRunRecord,
    private readonly leaseOwnerId: string,
    private readonly now: () => Date,
    private readonly observer?: DurableExecutionObserver,
  ) {
    this.record = record;
  }

  public get run(): DurableRunRecord {
    return this.record;
  }

  public async renew(leaseDurationMs: number): Promise<DurableRunRecord> {
    const validatedDuration = validateInput('renew', this.record.runId, () =>
      positiveDuration(leaseDurationMs, 'leaseDurationMs'),
    );
    const now = validateInput('renew', this.record.runId, () =>
      validDate(this.now(), 'now'),
    );
    const mutation = requireMutation(
      await this.adapter.renew({
        runId: this.record.runId,
        leaseOwnerId: this.leaseOwnerId,
        fence: this.record.fence,
        now,
        leaseDurationMs: validatedDuration,
      }),
      this.record.runId,
      'renew',
    );
    this.record = mutation.record;
    if (!mutation.duplicate) {
      await emit(this.observer, this.record, { type: 'lease.renewed' });
    }
    return this.record;
  }

  public async checkpoint(
    input: DurableCheckpointInput,
  ): Promise<DurableRunRecord> {
    const now = validateInput('checkpoint', this.record.runId, () =>
      validDate(this.now(), 'now'),
    );
    const checkpoint = validateInput('checkpoint', this.record.runId, () =>
      validateCheckpointInput(input, now),
    );
    const mutation = requireMutation(
      await this.adapter.checkpoint({
        runId: this.record.runId,
        leaseOwnerId: this.leaseOwnerId,
        fence: this.record.fence,
        now,
        checkpoint,
      }),
      this.record.runId,
      'checkpoint',
    );
    this.record = mutation.record;
    if (!mutation.duplicate) {
      await emit(this.observer, this.record, {
        type: 'checkpoint.saved',
        checkpointSequence: checkpoint.sequence,
      });
    }
    return this.record;
  }

  public async pauseForApproval(
    input: PauseForApprovalInput,
  ): Promise<DurableRunRecord> {
    const now = validateInput('pause-for-approval', this.record.runId, () =>
      validDate(this.now(), 'now'),
    );
    const validated = validateInput(
      'pause-for-approval',
      this.record.runId,
      () => ({
        checkpoint: validateCheckpointInput(input.checkpoint, now),
        approvalId: durableIdentifier(input.approvalId, 'approvalId'),
        reasonCode: durableCode(input.reasonCode, 'reasonCode'),
      }),
    );
    const mutation = requireMutation(
      await this.adapter.pauseForApproval({
        runId: this.record.runId,
        leaseOwnerId: this.leaseOwnerId,
        fence: this.record.fence,
        now,
        checkpoint: validated.checkpoint,
        approvalId: validated.approvalId,
        reasonCode: validated.reasonCode,
        requestedAt: now,
      }),
      this.record.runId,
      'pause-for-approval',
    );
    this.record = mutation.record;
    if (!mutation.duplicate) {
      await emit(this.observer, this.record, {
        type: 'checkpoint.saved',
        checkpointSequence: validated.checkpoint.sequence,
      });
      await emit(this.observer, this.record, {
        type: 'approval.requested',
        approvalId: validated.approvalId,
      });
    }
    return this.record;
  }

  public async complete(): Promise<DurableRunRecord> {
    const now = validateInput('complete', this.record.runId, () =>
      validDate(this.now(), 'now'),
    );
    const mutation = requireMutation(
      await this.adapter.complete({
        runId: this.record.runId,
        leaseOwnerId: this.leaseOwnerId,
        fence: this.record.fence,
        now,
        finishedAt: now,
      }),
      this.record.runId,
      'complete',
    );
    this.record = mutation.record;
    if (!mutation.duplicate) {
      await emit(this.observer, this.record, { type: 'run.completed' });
    }
    return this.record;
  }

  public async fail(failureCode: string): Promise<DurableRunRecord> {
    const validatedFailureCode = validateInput('fail', this.record.runId, () =>
      durableCode(failureCode, 'failureCode'),
    );
    const now = validateInput('fail', this.record.runId, () =>
      validDate(this.now(), 'now'),
    );
    const mutation = requireMutation(
      await this.adapter.fail({
        runId: this.record.runId,
        leaseOwnerId: this.leaseOwnerId,
        fence: this.record.fence,
        now,
        finishedAt: now,
        failureCode: validatedFailureCode,
      }),
      this.record.runId,
      'fail',
    );
    this.record = mutation.record;
    if (!mutation.duplicate) {
      await emit(this.observer, this.record, {
        type: 'run.failed',
        failureCode: validatedFailureCode,
      });
    }
    return this.record;
  }
}
