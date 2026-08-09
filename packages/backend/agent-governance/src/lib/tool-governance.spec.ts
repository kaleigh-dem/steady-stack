import { describe, expect, it } from 'vitest';

import {
  evaluateToolGovernance,
  type GovernedToolContext,
} from './tool-governance';

const context: Omit<GovernedToolContext, 'humanApprovalSatisfied'> = {
  traceId: 'trace-approval',
  actorId: 'actor-01',
  conversationId: 'conversation-01',
  providerId: 'provider-01',
  modelId: 'model-01',
  toolId: 'external_write',
  toolCallId: 'call-01',
};

const policy = {
  allowedToolIds: ['external_write'],
  humanApprovalToolIds: ['external_write'],
} as const;

describe('tool governance after durable approval', () => {
  it('requires approval before the trusted approval state is satisfied', async () => {
    await expect(
      evaluateToolGovernance(
        { ...context, humanApprovalSatisfied: false },
        policy,
        { emit: () => undefined },
      ),
    ).resolves.toEqual({
      outcome: 'approval_required',
      reasonCode: 'human_approval_required',
    });
  });

  it('allows the same allowlisted tool after trusted approval is satisfied', async () => {
    await expect(
      evaluateToolGovernance(
        { ...context, humanApprovalSatisfied: true },
        policy,
        { emit: () => undefined },
      ),
    ).resolves.toEqual({ outcome: 'allowed' });
  });
});
