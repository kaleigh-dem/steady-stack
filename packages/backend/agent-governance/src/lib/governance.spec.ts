import { describe, expect, it } from 'vitest';

import {
  GovernanceError,
  applyInputPolicy,
  applyOutputPolicy,
  authorizeApprovalDecision,
  evaluateToolAllowlist,
  selectFallbackModelRoute,
  selectPrimaryModelRoute,
  type GovernanceAuditEvent,
  type GovernanceAuditSink,
  type GovernanceContext,
  type ModelFallbackPolicy,
  type ModelRoute,
} from './governance';

const modelContext = {
  traceId: 'trace-01',
  actorId: 'actor-01',
  conversationId: 'conversation-01',
  providerId: 'provider-primary',
  modelId: 'model-primary',
} as const;

const governanceContext: GovernanceContext = {
  traceId: modelContext.traceId,
  actorId: modelContext.actorId,
  conversationId: modelContext.conversationId,
};

function recordingAudit(events: GovernanceAuditEvent[]): GovernanceAuditSink {
  return {
    emit: (event) => {
      events.push(event);
    },
  };
}

const routes: readonly ModelRoute[] = [
  {
    routeId: 'primary',
    providerId: 'provider-primary',
    modelId: 'model-primary',
    region: 'us-east',
    allowedClassifications: ['public', 'internal', 'confidential'],
    retention: 'none',
    capabilities: { tools: true, structuredOutput: true, streaming: true },
  },
  {
    routeId: 'fallback-incompatible',
    providerId: 'provider-secondary',
    modelId: 'model-secondary',
    region: 'eu-west',
    allowedClassifications: ['public'],
    retention: 'approved',
    capabilities: { tools: false, structuredOutput: true, streaming: true },
  },
  {
    routeId: 'fallback-compatible',
    providerId: 'provider-tertiary',
    modelId: 'model-tertiary',
    region: 'us-east',
    allowedClassifications: ['public', 'internal', 'confidential'],
    retention: 'none',
    capabilities: { tools: true, structuredOutput: true, streaming: true },
  },
];

const fallbackPolicy: ModelFallbackPolicy = {
  primaryRouteId: 'primary',
  fallbackRouteIds: ['fallback-incompatible', 'fallback-compatible'],
  fallbackOn: ['timeout', 'rate_limited', 'unavailable'],
  maxFallbacks: 2,
};

describe('agent governance', () => {
  it('redacts sensitive input without retaining raw payloads in audit events', async () => {
    const events: GovernanceAuditEvent[] = [];
    const secret = 'TOP-SECRET-INPUT';
    const result = await applyInputPolicy(
      modelContext,
      { value: { secret }, classification: 'restricted' },
      {
        evaluate: () => ({
          action: 'redact',
          value: { secret: '[redacted]' },
          classification: 'internal',
          reasonCode: 'sensitive_value_redacted',
        }),
      },
      recordingAudit(events),
    );

    expect(result).toEqual({
      value: { secret: '[redacted]' },
      classification: 'internal',
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'content_policy',
      stage: 'input',
      outcome: 'redacted',
      classificationBefore: 'restricted',
      classificationAfter: 'internal',
      reasonCode: 'sensitive_value_redacted',
    });
    expect(JSON.stringify(events)).not.toContain(secret);
  });

  it('fails closed when credential-classified input is allowed unchanged', async () => {
    const events: GovernanceAuditEvent[] = [];
    await expect(
      applyInputPolicy(
        modelContext,
        { value: 'credential-value', classification: 'credential' },
        { evaluate: () => ({ action: 'allow' }) },
        recordingAudit(events),
      ),
    ).rejects.toMatchObject({
      code: 'policy_denied',
      reasonCode: 'credential_data_prohibited',
    });
    expect(events).toEqual([
      expect.objectContaining({
        type: 'content_policy',
        outcome: 'denied',
        reasonCode: 'credential_data_prohibited',
      }),
    ]);
  });

  it('fails closed on malformed output-policy decisions', async () => {
    const events: GovernanceAuditEvent[] = [];
    await expect(
      applyOutputPolicy(
        modelContext,
        { value: 'answer', classification: 'public' },
        { evaluate: () => ({ action: 'allow', raw: 'unexpected' }) },
        recordingAudit(events),
      ),
    ).rejects.toMatchObject({
      code: 'policy_failed',
      reasonCode: 'policy_evaluation_failed',
    });
    expect(events[0]).toMatchObject({
      type: 'content_policy',
      stage: 'output',
      outcome: 'denied',
      reasonCode: 'policy_evaluation_failed',
    });
  });

  it('enforces server-owned tool allowlists and approval requirements', async () => {
    const events: GovernanceAuditEvent[] = [];
    const audit = recordingAudit(events);
    const policy = {
      allowedToolIds: ['lookup', 'external_write'],
      humanApprovalToolIds: ['external_write'],
    } as const;

    await expect(
      evaluateToolAllowlist(
        { ...modelContext, toolId: 'lookup', toolCallId: 'call-01' },
        policy,
        audit,
      ),
    ).resolves.toEqual({ outcome: 'allowed' });
    await expect(
      evaluateToolAllowlist(
        { ...modelContext, toolId: 'external_write', toolCallId: 'call-02' },
        policy,
        audit,
      ),
    ).resolves.toEqual({
      outcome: 'approval_required',
      reasonCode: 'human_approval_required',
    });
    await expect(
      evaluateToolAllowlist(
        { ...modelContext, toolId: 'unregistered', toolCallId: 'call-03' },
        policy,
        audit,
      ),
    ).resolves.toEqual({
      outcome: 'denied',
      reasonCode: 'tool_not_allowlisted',
    });
    expect(events.map((event) => event.type)).toEqual([
      'tool_policy',
      'tool_policy',
      'tool_policy',
    ]);
  });

  it('fails closed when approval authorization is denied or malformed', async () => {
    const events: GovernanceAuditEvent[] = [];
    const context = {
      ...governanceContext,
      runId: 'run-01',
      approvalId: 'approval-01',
      decidedBy: 'reviewer-01',
      decision: 'approved' as const,
    };

    await expect(
      authorizeApprovalDecision(
        context,
        {
          authorize: () => ({
            allowed: false,
            reasonCode: 'approver_not_authorized',
          }),
        },
        recordingAudit(events),
      ),
    ).rejects.toMatchObject({
      code: 'policy_denied',
      reasonCode: 'approver_not_authorized',
    });

    await expect(
      authorizeApprovalDecision(
        context,
        { authorize: () => ({ allowed: 'yes' }) },
        recordingAudit(events),
      ),
    ).rejects.toMatchObject({
      code: 'policy_failed',
      reasonCode: 'approval_policy_failed',
    });
  });

  it('selects only a compatible server-configured primary model route', async () => {
    const events: GovernanceAuditEvent[] = [];
    await expect(
      selectPrimaryModelRoute(
        routes,
        fallbackPolicy,
        {
          classification: 'confidential',
          allowedRegions: ['us-east'],
          requireNoProviderRetention: true,
          requiresTools: true,
          requiresStructuredOutput: true,
        },
        governanceContext,
        recordingAudit(events),
      ),
    ).resolves.toMatchObject({
      routeId: 'primary',
      providerId: 'provider-primary',
      modelId: 'model-primary',
    });

    await expect(
      selectPrimaryModelRoute(
        routes,
        fallbackPolicy,
        { classification: 'credential' },
        governanceContext,
        recordingAudit(events),
      ),
    ).rejects.toMatchObject({
      code: 'route_blocked',
      reasonCode: 'route_classification_blocked',
    });
  });

  it('falls back only for configured transient failures and rechecks compatibility', async () => {
    const events: GovernanceAuditEvent[] = [];
    const audit = recordingAudit(events);
    const requirements = {
      classification: 'confidential' as const,
      allowedRegions: ['us-east'],
      requireNoProviderRetention: true,
      requiresTools: true,
      requiresStreaming: true,
    };

    const fallback = await selectFallbackModelRoute({
      routes,
      policy: fallbackPolicy,
      requirements,
      currentRouteId: 'primary',
      failureCode: 'unavailable',
      usedRouteIds: ['primary'],
      context: governanceContext,
      audit,
    });
    expect(fallback).toMatchObject({
      outcome: 'selected',
      route: { routeId: 'fallback-compatible' },
    });

    await expect(
      selectFallbackModelRoute({
        routes,
        policy: fallbackPolicy,
        requirements,
        currentRouteId: 'primary',
        failureCode: 'authentication',
        usedRouteIds: ['primary'],
        context: governanceContext,
        audit,
      }),
    ).resolves.toEqual({
      outcome: 'blocked',
      reasonCode: 'fallback_failure_not_allowed',
    });
  });

  it('enforces the fallback-attempt ceiling', async () => {
    const events: GovernanceAuditEvent[] = [];
    await expect(
      selectFallbackModelRoute({
        routes,
        policy: { ...fallbackPolicy, maxFallbacks: 1 },
        requirements: { classification: 'public' },
        currentRouteId: 'fallback-incompatible',
        failureCode: 'timeout',
        usedRouteIds: ['primary', 'fallback-incompatible'],
        context: governanceContext,
        audit: recordingAudit(events),
      }),
    ).resolves.toEqual({
      outcome: 'exhausted',
      reasonCode: 'fallback_limit_reached',
    });
  });

  it('fails closed when the audit sink cannot record an allowed decision', async () => {
    await expect(
      applyInputPolicy(
        modelContext,
        { value: 'safe', classification: 'public' },
        { evaluate: () => ({ action: 'allow' }) },
        {
          emit: () => {
            throw new Error('audit backend unavailable');
          },
        },
      ),
    ).rejects.toBeInstanceOf(GovernanceError);
    await expect(
      applyInputPolicy(
        modelContext,
        { value: 'safe', classification: 'public' },
        { evaluate: () => ({ action: 'allow' }) },
        {
          emit: () => {
            throw new Error('audit backend unavailable');
          },
        },
      ),
    ).rejects.toMatchObject({ code: 'audit_failed' });
  });
});
