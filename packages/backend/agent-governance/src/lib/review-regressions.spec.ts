import { describe, expect, it } from 'vitest';

import {
  applyInputPolicy,
  applyOutputPolicy,
  selectPrimaryModelRoute,
  type GovernanceAuditEvent,
  type GovernanceAuditSink,
  type ModelRoute,
} from './governance';

const modelContext = {
  traceId: 'trace-review',
  actorId: 'actor-review',
  conversationId: 'conversation-review',
  providerId: 'provider-review',
  modelId: 'model-review',
} as const;

function recordingAudit(events: GovernanceAuditEvent[]): GovernanceAuditSink {
  return {
    emit: (event) => {
      events.push(event);
    },
  };
}

const validRoute: ModelRoute = {
  routeId: 'primary',
  providerId: 'provider-review',
  modelId: 'model-review',
  region: 'us-east',
  allowedClassifications: ['public'],
  retention: 'none',
  capabilities: { tools: true, structuredOutput: true, streaming: true },
};

const fallbackPolicy = {
  primaryRouteId: 'primary',
  fallbackRouteIds: [],
  fallbackOn: [],
  maxFallbacks: 0,
} as const;

describe('P14-06 review regressions', () => {
  it('rejects policy actions inherited through the prototype chain', async () => {
    const events: GovernanceAuditEvent[] = [];
    const inheritedAllow = Object.create({ action: 'allow' }) as object;

    await expect(
      applyOutputPolicy(
        modelContext,
        { value: 'answer', classification: 'public' },
        { evaluate: () => inheritedAllow },
        recordingAudit(events),
      ),
    ).rejects.toMatchObject({
      code: 'policy_failed',
      reasonCode: 'policy_evaluation_failed',
    });
    expect(events).toEqual([
      expect.objectContaining({
        type: 'content_policy',
        stage: 'output',
        outcome: 'denied',
        reasonCode: 'policy_evaluation_failed',
      }),
    ]);
  });

  it('rejects non-string identifiers before policy evaluation or audit emission', async () => {
    const events: GovernanceAuditEvent[] = [];
    let evaluated = false;
    const malformedContext = {
      ...modelContext,
      traceId: {
        toString: () => 'trace-safe',
        leaked: 'RAW-PAYLOAD',
      },
    };

    await expect(
      applyInputPolicy(
        malformedContext as unknown as typeof modelContext,
        { value: 'input', classification: 'public' },
        {
          evaluate: () => {
            evaluated = true;
            return { action: 'allow' };
          },
        },
        recordingAudit(events),
      ),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    expect(evaluated).toBe(false);
    expect(events).toEqual([]);
  });

  it('rejects non-boolean route capabilities before route selection', async () => {
    const events: GovernanceAuditEvent[] = [];
    const malformedRoute = {
      ...validRoute,
      capabilities: {
        ...validRoute.capabilities,
        tools: 'yes',
      },
    } as unknown as ModelRoute;

    await expect(
      selectPrimaryModelRoute(
        [malformedRoute],
        fallbackPolicy,
        { classification: 'public', requiresTools: true },
        {
          traceId: modelContext.traceId,
          actorId: modelContext.actorId,
          conversationId: modelContext.conversationId,
        },
        recordingAudit(events),
      ),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    expect(events).toEqual([]);
  });

  it('rejects non-boolean route requirements before compatibility checks', async () => {
    const events: GovernanceAuditEvent[] = [];

    await expect(
      selectPrimaryModelRoute(
        [validRoute],
        fallbackPolicy,
        {
          classification: 'public',
          requiresTools: 'yes',
        } as unknown as { classification: 'public'; requiresTools: boolean },
        {
          traceId: modelContext.traceId,
          actorId: modelContext.actorId,
          conversationId: modelContext.conversationId,
        },
        recordingAudit(events),
      ),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    expect(events).toEqual([]);
  });
});
