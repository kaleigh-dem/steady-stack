export function referenceWorkflowSource(packageScope: string): string {
  return `import {
  DurableExecutionCoordinator,
  type DurableExecutionAdapter,
  type DurableExecutionObserver,
  type DurableRunSession,
} from '${packageScope}/backend-agent-durable';
import {
  runEvaluationCase,
  type EvaluationCaseResult,
} from '${packageScope}/backend-agent-eval';
import {
  applyInputPolicy,
  applyOutputPolicy,
  authorizeApprovalDecision,
  evaluateToolAllowlist,
  selectFallbackModelRoute,
  selectPrimaryModelRoute,
  type ApprovalAuthorizationPolicy,
  type ContentEnvelope,
  type GovernanceAuditSink,
  type InputPolicy,
  type ModelFallbackPolicy,
  type ModelRoute,
  type OutputPolicy,
  type ToolAllowlistPolicy,
} from '${packageScope}/backend-agent-governance';
import {
  invokeTool,
  type ToolAuthorizationDecision,
  type ToolDefinition,
  type ToolExecutionContext,
} from '${packageScope}/backend-agent-tool';
import {
  ModelError,
  type ModelClient,
  type ModelUsage,
} from '${packageScope}/backend-model';
import {
  AGENT_STREAM_PROTOCOL,
  AGENT_STREAM_VERSION,
  type AgentStreamEventV1,
} from '${packageScope}/contracts';
import {
  createCorrelationContext,
  createStructuredLogger,
  MetricsRegistry,
  runWithCorrelationContext,
  type StructuredLogger,
} from '${packageScope}/observability';

export const REFERENCE_LOOKUP_TOOL_ID = 'reference.lookup' as const;
const REFERENCE_LEASE_MS = 30_000;
const REFERENCE_MAX_OUTPUT_TOKENS = 256;

export interface ReferenceLookupInput {
  readonly key: string;
}

export interface ReferenceLookupOutput {
  readonly found: boolean;
  readonly value?: string;
}

export interface ReferenceLookupToolOptions {
  readonly authorize: (
    context: ToolExecutionContext,
    input: ReferenceLookupInput,
  ) => ToolAuthorizationDecision | Promise<ToolAuthorizationDecision>;
  readonly lookup: (
    context: ToolExecutionContext,
    input: ReferenceLookupInput,
  ) => ReferenceLookupOutput | Promise<ReferenceLookupOutput>;
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(label + ' must be an object.');
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === allowed.length &&
    keys.every((key) => allowed.includes(key))
  );
}

export function createReferenceLookupTool(
  options: ReferenceLookupToolOptions,
): ToolDefinition<ReferenceLookupInput, ReferenceLookupOutput> {
  return {
    id: REFERENCE_LOOKUP_TOOL_ID,
    inputSchema: {
      parse(value: unknown): ReferenceLookupInput {
        const input = objectValue(value, 'lookup input');
        if (
          !exactKeys(input, ['key']) ||
          typeof input.key !== 'string' ||
          !input.key.trim()
        ) {
          throw new Error('lookup input requires exactly one non-empty key.');
        }
        return { key: input.key.trim() };
      },
    },
    outputSchema: {
      parse(value: unknown): ReferenceLookupOutput {
        const output = objectValue(value, 'lookup output');
        const allowed =
          output.value === undefined ? ['found'] : ['found', 'value'];
        if (
          !exactKeys(output, allowed) ||
          typeof output.found !== 'boolean' ||
          (output.value !== undefined && typeof output.value !== 'string')
        ) {
          throw new Error('lookup output was invalid.');
        }
        return output.value === undefined
          ? { found: output.found }
          : { found: output.found, value: output.value };
      },
    },
    authorize: options.authorize,
    execute: options.lookup,
  };
}

export interface ReferenceAiWorkflowConfig extends ReferenceLookupToolOptions {
  readonly modelClients: Readonly<Record<string, ModelClient>>;
  readonly routes: readonly ModelRoute[];
  readonly fallbackPolicy: ModelFallbackPolicy;
  readonly persistence: DurableExecutionAdapter;
  readonly durableObserver?: DurableExecutionObserver;
  readonly audit: GovernanceAuditSink;
  readonly inputPolicy: InputPolicy<string>;
  readonly outputPolicy: OutputPolicy<string>;
  readonly toolPolicy: ToolAllowlistPolicy;
  readonly approvalPolicy: ApprovalAuthorizationPolicy;
  readonly allowedRegions?: readonly string[];
  readonly leaseOwnerId?: string;
  readonly logger?: StructuredLogger;
  readonly metrics?: MetricsRegistry;
  readonly now?: () => Date;
}

export interface ReferenceAiWorkflowRequest {
  readonly runId: string;
  readonly traceId: string;
  readonly actorId: string;
  readonly conversationId: string;
  readonly content: ContentEnvelope<string>;
  readonly toolCallId: string;
  readonly toolInput: unknown;
  readonly approvalId: string;
}

export interface ReferenceApprovalRequest {
  readonly runId: string;
  readonly traceId: string;
  readonly actorId: string;
  readonly conversationId: string;
  readonly approvalId: string;
  readonly decidedBy: string;
  readonly decision: 'approved' | 'rejected';
}

function streamBase(
  sequence: number,
  request: ReferenceAiWorkflowRequest,
  route: ModelRoute,
  now: () => Date,
) {
  return {
    protocol: AGENT_STREAM_PROTOCOL,
    version: AGENT_STREAM_VERSION,
    sequence,
    emittedAt: now().toISOString(),
    traceId: request.traceId,
    actorId: request.actorId,
    conversationId: request.conversationId,
    providerId: route.providerId,
    modelId: route.modelId,
  } as const;
}

function modelClient(
  config: ReferenceAiWorkflowConfig,
  route: ModelRoute,
): ModelClient {
  const client = config.modelClients[route.routeId];
  if (!client) {
    throw new Error(
      'No server-owned model client is configured for route ' +
        route.routeId +
        '.',
    );
  }
  return client;
}

function failureCode(error: unknown): string {
  if (error instanceof ModelError) return 'model_' + error.code;
  return 'reference_workflow_failed';
}

async function failRun(
  session: DurableRunSession,
  code: string,
): Promise<void> {
  if (session.run.status !== 'running') return;
  try {
    await session.fail(code);
  } catch {
    // The original failure remains authoritative; stale/expired leases fail closed.
  }
}

export async function* runReferenceAiWorkflow(
  config: ReferenceAiWorkflowConfig,
  request: ReferenceAiWorkflowRequest,
): AsyncIterable<AgentStreamEventV1> {
  const now = config.now ?? (() => new Date());
  const logger = config.logger ?? createStructuredLogger('api-ai-reference');
  const metrics = config.metrics ?? new MetricsRegistry();
  const correlation = createCorrelationContext({
    requestId: request.runId,
    traceId: request.traceId,
    actorId: request.actorId,
    correlationId: request.conversationId,
  });
  const routeRequirements = {
    classification: request.content.classification,
    ...(config.allowedRegions === undefined
      ? {}
      : { allowedRegions: config.allowedRegions }),
    requireNoProviderRetention: true,
    requiresTools: true,
    requiresStreaming: true,
  } as const;

  let route = await runWithCorrelationContext(correlation, () =>
    selectPrimaryModelRoute(
      config.routes,
      config.fallbackPolicy,
      routeRequirements,
      {
        traceId: request.traceId,
        actorId: request.actorId,
        conversationId: request.conversationId,
      },
      config.audit,
    ),
  );
  const coordinator = new DurableExecutionCoordinator(config.persistence, {
    now,
    ...(config.durableObserver === undefined
      ? {}
      : { observer: config.durableObserver }),
  });
  await coordinator.createRun({
    runId: request.runId,
    traceId: request.traceId,
    actorId: request.actorId,
    conversationId: request.conversationId,
  });
  const claim = await coordinator.claimRun({
    runId: request.runId,
    leaseOwnerId: config.leaseOwnerId ?? 'reference-ai-workflow',
    leaseDurationMs: REFERENCE_LEASE_MS,
  });
  if (claim.outcome !== 'claimed') {
    throw new Error('Durable AI run is not claimable: ' + claim.outcome + '.');
  }
  const session = claim.session;
  let sequence = 0;
  let checkpointSequence = session.run.checkpoint?.sequence ?? 0;
  const usedRouteIds = [route.routeId];
  let completion: {
    readonly finishReason: 'stop' | 'length' | 'content_filter' | 'unknown';
    readonly usage: ModelUsage;
  } | null = null;

  metrics.increment('ai.reference.started');
  runWithCorrelationContext(correlation, () =>
    logger.info('ai.reference.started', {
      runId: request.runId,
      routeId: route.routeId,
      providerId: route.providerId,
      modelId: route.modelId,
      classification: request.content.classification,
    }),
  );
  yield { ...streamBase(sequence++, request, route, now), type: 'started' };

  try {
    for (;;) {
      const safeInput = await runWithCorrelationContext(correlation, () =>
        applyInputPolicy(
          {
            traceId: request.traceId,
            actorId: request.actorId,
            conversationId: request.conversationId,
            providerId: route.providerId,
            modelId: route.modelId,
          },
          request.content,
          config.inputPolicy,
          config.audit,
        ),
      );
      await session.checkpoint({
        checkpointId:
          request.runId + '-input-' + String(checkpointSequence + 1),
        sequence: ++checkpointSequence,
        stepId: 'input_policy',
        state: {
          stage: 'input_approved',
          classification: safeInput.classification,
          routeId: route.routeId,
        },
      });

      let consumedModelEvent = false;
      try {
        for await (const event of modelClient(config, route).stream({
          model: route.modelId,
          messages: [{ role: 'user', content: safeInput.value }],
          maxOutputTokens: REFERENCE_MAX_OUTPUT_TOKENS,
        })) {
          consumedModelEvent = true;
          if (event.type === 'text_delta') {
            const safeOutput = await runWithCorrelationContext(
              correlation,
              () =>
                applyOutputPolicy(
                  {
                    traceId: request.traceId,
                    actorId: request.actorId,
                    conversationId: request.conversationId,
                    providerId: route.providerId,
                    modelId: route.modelId,
                  },
                  {
                    value: event.text,
                    classification: safeInput.classification,
                  },
                  config.outputPolicy,
                  config.audit,
                ),
            );
            yield {
              ...streamBase(sequence++, request, route, now),
              type: 'text_delta',
              text: safeOutput.value,
            };
          } else if (event.type === 'usage') {
            yield {
              ...streamBase(sequence++, request, route, now),
              type: 'usage',
              usage: event.usage,
            };
          } else {
            completion = {
              finishReason: event.finishReason,
              usage: event.usage,
            };
          }
        }
        break;
      } catch (error) {
        if (!(error instanceof ModelError) || consumedModelEvent) throw error;
        const fallback = await runWithCorrelationContext(correlation, () =>
          selectFallbackModelRoute({
            routes: config.routes,
            policy: config.fallbackPolicy,
            requirements: routeRequirements,
            currentRouteId: route.routeId,
            failureCode: error.code,
            usedRouteIds,
            context: {
              traceId: request.traceId,
              actorId: request.actorId,
              conversationId: request.conversationId,
            },
            audit: config.audit,
          }),
        );
        if (fallback.outcome !== 'selected') throw error;
        route = fallback.route;
        usedRouteIds.push(route.routeId);
        runWithCorrelationContext(correlation, () =>
          logger.warn('ai.reference.fallback', {
            runId: request.runId,
            routeId: route.routeId,
            providerId: route.providerId,
            modelId: route.modelId,
            failureCode: error.code,
          }),
        );
      }
    }

    if (completion === null) {
      throw new Error('Model stream completed without a terminal event.');
    }

    const tool = createReferenceLookupTool(config);
    const toolContext = {
      traceId: request.traceId,
      actorId: request.actorId,
      conversationId: request.conversationId,
      providerId: route.providerId,
      modelId: route.modelId,
      toolId: tool.id,
      toolCallId: request.toolCallId,
    };
    const toolDecision = await runWithCorrelationContext(correlation, () =>
      evaluateToolAllowlist(toolContext, config.toolPolicy, config.audit),
    );
    if (toolDecision.outcome === 'denied') {
      await failRun(session, 'tool_not_allowed');
      yield {
        ...streamBase(sequence++, request, route, now),
        type: 'tool_denied',
        toolId: tool.id,
        toolCallId: request.toolCallId,
        reasonCode: toolDecision.reasonCode,
      };
      return;
    }
    if (
      toolDecision.outcome === 'approval_required' &&
      !(
        session.run.approval?.approvalId === request.approvalId &&
        session.run.approval.status === 'approved'
      )
    ) {
      await session.pauseForApproval({
        checkpoint: {
          checkpointId:
            request.runId + '-approval-' + String(checkpointSequence + 1),
          sequence: ++checkpointSequence,
          stepId: 'tool_approval',
          state: { stage: 'approval_required', toolId: tool.id },
        },
        approvalId: request.approvalId,
        reasonCode: toolDecision.reasonCode,
      });
      yield {
        ...streamBase(sequence++, request, route, now),
        type: 'error',
        code: 'human_approval_required',
      };
      return;
    }

    yield {
      ...streamBase(sequence++, request, route, now),
      type: 'tool_started',
      toolId: tool.id,
      toolCallId: request.toolCallId,
    };
    await runWithCorrelationContext(correlation, () =>
      invokeTool(tool, {
        context: {
          traceId: request.traceId,
          actorId: request.actorId,
          conversationId: request.conversationId,
          providerId: route.providerId,
          modelId: route.modelId,
          toolCallId: request.toolCallId,
        },
        input: request.toolInput,
      }),
    );
    await session.checkpoint({
      checkpointId: request.runId + '-tool-' + String(checkpointSequence + 1),
      sequence: ++checkpointSequence,
      stepId: 'typed_tool',
      state: { stage: 'tool_completed', toolId: tool.id },
    });
    metrics.increment('ai.reference.tool.completed');
    runWithCorrelationContext(correlation, () =>
      logger.info('ai.reference.tool.completed', {
        runId: request.runId,
        toolId: tool.id,
        toolCallId: request.toolCallId,
      }),
    );
    yield {
      ...streamBase(sequence++, request, route, now),
      type: 'tool_completed',
      toolId: tool.id,
      toolCallId: request.toolCallId,
    };

    await session.complete();
    metrics.increment('ai.reference.completed');
    runWithCorrelationContext(correlation, () =>
      logger.info('ai.reference.completed', {
        runId: request.runId,
        providerId: route.providerId,
        modelId: route.modelId,
        totalTokens: completion?.usage.totalTokens ?? 0,
      }),
    );
    yield {
      ...streamBase(sequence++, request, route, now),
      type: 'completed',
      finishReason: completion.finishReason,
      usage: completion.usage,
    };
  } catch (error) {
    const code = failureCode(error);
    await failRun(session, code);
    runWithCorrelationContext(correlation, () =>
      logger.error('ai.reference.failed', error, {
        runId: request.runId,
        code,
      }),
    );
    yield {
      ...streamBase(sequence++, request, route, now),
      type: 'error',
      code,
    };
  }
}

export async function resolveReferenceAiApproval(
  config: ReferenceAiWorkflowConfig,
  request: ReferenceApprovalRequest,
): Promise<void> {
  await authorizeApprovalDecision(
    {
      traceId: request.traceId,
      actorId: request.actorId,
      conversationId: request.conversationId,
      runId: request.runId,
      approvalId: request.approvalId,
      decidedBy: request.decidedBy,
      decision: request.decision,
    },
    config.approvalPolicy,
    config.audit,
  );
  const coordinator = new DurableExecutionCoordinator(config.persistence, {
    ...(config.now === undefined ? {} : { now: config.now }),
    ...(config.durableObserver === undefined
      ? {}
      : { observer: config.durableObserver }),
  });
  await coordinator.resolveApproval({
    runId: request.runId,
    approvalId: request.approvalId,
    decision: request.decision,
    decidedBy: request.decidedBy,
  });
}

export async function evaluateReferenceAiEvents(
  events: readonly AgentStreamEventV1[],
): Promise<EvaluationCaseResult> {
  const eventTypes = events.map((event) => event.type);
  const completed = [...events]
    .reverse()
    .find((event) => event.type === 'completed');
  const expected = [
    'started',
    'text_delta',
    'usage',
    'tool_started',
    'tool_completed',
    'completed',
  ] as const;
  let clock = 0;
  return runEvaluationCase({
    fixture: {
      id: 'reference-ai-stream',
      classification: 'synthetic',
      input: eventTypes,
      expected,
    },
    subject: (input) => ({
      output: input,
      ...(completed === undefined
        ? {}
        : {
            providerId: completed.providerId,
            modelId: completed.modelId,
            usage: completed.usage,
          }),
    }),
    evaluators: [
      {
        id: 'required_stream_events',
        kind: 'rule',
        evaluate: ({ output, expected: required }) => {
          const passed = required.every((type) => output.includes(type));
          return {
            score: passed ? 1 : 0,
            passed,
            code: passed
              ? 'required_events_present'
              : 'required_events_missing',
          };
        },
      },
    ],
    budget: {
      minQualityScore: 1,
      maxLatencyMs: 1,
      maxTotalTokens: 128,
    },
    clock: () => clock++,
  });
}
`;
}

export function referenceWorkflowSpecSource(packageScope: string): string {
  return `import { InMemoryDurableExecutionAdapter } from '${packageScope}/backend-agent-durable';
import type { GovernanceAuditEvent } from '${packageScope}/backend-agent-governance';
import { DeterministicModelAdapter } from '${packageScope}/backend-model';
import {
  createStructuredLogger,
  type LogRecord,
} from '${packageScope}/observability';
import { describe, expect, it } from 'vitest';

import {
  REFERENCE_LOOKUP_TOOL_ID,
  evaluateReferenceAiEvents,
  resolveReferenceAiApproval,
  runReferenceAiWorkflow,
  type ReferenceAiWorkflowConfig,
  type ReferenceAiWorkflowRequest,
} from './reference-workflow';

function fixture(options: { readonly approvalRequired?: boolean } = {}) {
  const persistence = new InMemoryDurableExecutionAdapter();
  const auditEvents: GovernanceAuditEvent[] = [];
  const logRecords: LogRecord[] = [];
  const config: ReferenceAiWorkflowConfig = {
    modelClients: {
      primary: new DeterministicModelAdapter({
        generationText: 'synthetic answer',
        structuredValue: {},
        embeddings: [],
        streamTextChunks: ['synthetic ', 'answer'],
        usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
      }),
    },
    routes: [
      {
        routeId: 'primary',
        providerId: 'deterministic',
        modelId: 'fixture-model',
        region: 'local',
        allowedClassifications: ['public'],
        retention: 'none',
        capabilities: {
          tools: true,
          structuredOutput: true,
          streaming: true,
        },
      },
    ],
    fallbackPolicy: {
      primaryRouteId: 'primary',
      fallbackRouteIds: [],
      fallbackOn: ['timeout'],
      maxFallbacks: 0,
    },
    persistence,
    audit: { emit: (event) => void auditEvents.push(event) },
    inputPolicy: { evaluate: () => ({ action: 'allow' }) },
    outputPolicy: { evaluate: () => ({ action: 'allow' }) },
    toolPolicy: {
      allowedToolIds: [REFERENCE_LOOKUP_TOOL_ID],
      ...(options.approvalRequired
        ? { humanApprovalToolIds: [REFERENCE_LOOKUP_TOOL_ID] }
        : {}),
    },
    approvalPolicy: { authorize: () => ({ allowed: true }) },
    authorize: () => ({ allowed: true }),
    lookup: () => ({ found: true, value: 'synthetic-value' }),
    logger: createStructuredLogger('reference-ai-test', (record) =>
      void logRecords.push(record),
    ),
    now: () => new Date('2026-01-01T00:00:00.000Z'),
  };
  const request: ReferenceAiWorkflowRequest = {
    runId: 'run-1',
    traceId: 'trace-1',
    actorId: 'actor-1',
    conversationId: 'conversation-1',
    content: { value: 'synthetic request', classification: 'public' },
    toolCallId: 'tool-call-1',
    toolInput: { key: 'synthetic-key' },
    approvalId: 'approval-1',
  };
  return { persistence, auditEvents, logRecords, config, request };
}

async function collect(
  config: ReferenceAiWorkflowConfig,
  request: ReferenceAiWorkflowRequest,
) {
  const events = [];
  for await (const event of runReferenceAiWorkflow(config, request)) {
    events.push(event);
  }
  return events;
}

describe('generated AI reference workflow', () => {
  it('streams a governed typed tool workflow with durable state and evaluation evidence', async () => {
    const setup = fixture();
    const events = await collect(setup.config, setup.request);

    expect(events.map((event) => event.type)).toEqual([
      'started',
      'text_delta',
      'text_delta',
      'usage',
      'tool_started',
      'tool_completed',
      'completed',
    ]);
    expect(events.every((event) => event.traceId === 'trace-1')).toBe(true);
    expect(await setup.persistence.get('run-1')).toMatchObject({
      status: 'completed',
      checkpoint: {
        stepId: 'typed_tool',
        state: {
          stage: 'tool_completed',
          toolId: REFERENCE_LOOKUP_TOOL_ID,
        },
      },
    });
    expect(setup.auditEvents.map((event) => event.type)).toContain(
      'model_route',
    );
    expect(setup.auditEvents.map((event) => event.type)).toContain(
      'content_policy',
    );
    expect(setup.auditEvents.map((event) => event.type)).toContain(
      'tool_policy',
    );
    expect(JSON.stringify(setup.logRecords)).not.toContain('synthetic request');
    expect(JSON.stringify(setup.logRecords)).not.toContain('synthetic-value');

    const evaluation = await evaluateReferenceAiEvents(events);
    expect(evaluation).toMatchObject({
      fixtureId: 'reference-ai-stream',
      classification: 'synthetic',
      passed: true,
      qualityScore: 1,
      budget: { passed: true, violations: [] },
      providerId: 'deterministic',
      modelId: 'fixture-model',
      usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
    });
  });

  it('requires trusted approval before the side-effect boundary can proceed', async () => {
    const setup = fixture({ approvalRequired: true });
    const first = await collect(setup.config, setup.request);
    expect(first.at(-1)).toMatchObject({
      type: 'error',
      code: 'human_approval_required',
    });
    expect(await setup.persistence.get('run-1')).toMatchObject({
      status: 'waiting_for_approval',
      approval: { approvalId: 'approval-1', status: 'pending' },
    });

    await resolveReferenceAiApproval(setup.config, {
      runId: 'run-1',
      traceId: 'trace-1',
      actorId: 'actor-1',
      conversationId: 'conversation-1',
      approvalId: 'approval-1',
      decidedBy: 'human-reviewer',
      decision: 'approved',
    });
    const second = await collect(setup.config, setup.request);
    expect(second.at(-1)?.type).toBe('completed');
    expect(await setup.persistence.get('run-1')).toMatchObject({
      status: 'completed',
    });
    expect(setup.auditEvents).toContainEqual(
      expect.objectContaining({
        type: 'approval_policy',
        outcome: 'allowed',
        decidedBy: 'human-reviewer',
      }),
    );
  });
});
`;
}

export function referenceReadme(): string {
  return `# Optional AI reference workflow

This directory is generated only when the workspace preset is invoked with \`--ai=true\`. It composes the provider-neutral Phase 14 boundaries; it is not a production provider selection or an autonomous agent framework.

- \`reference-workflow.ts\` streams strict V1 agent events while model traffic stays behind \`ModelClient\`.
- \`reference.lookup\` is the single example tool. Its input and output are runtime validated, the server-owned allowlist runs first, and authenticated actor authorization still runs immediately before execution.
- Input and output content pass explicit classification policy. The reference route requires no provider retention, server-owned region compatibility, tools, and streaming. Fallback is bounded by the configured Phase 14 policy and is attempted only before a model stream emits any event.
- Durable execution receives a caller-supplied adapter, stores only payload-safe control-plane checkpoints, fences mutations, and pauses for trusted human approval when policy requires it. Replace the in-memory adapter used in tests with a production adapter that documents owner, purpose, classification, retention, deletion, tenant isolation, encryption, access controls, backup/restore behavior, and regional constraints.
- Approval resolution calls the governance authorization hook before durable state changes. Model output never supplies the approver identity.
- Structured logs, metrics, audit events, and browser stream metadata retain identifiers and policy outcomes without persisting raw prompts, completions, tool arguments/results, or credentials.
- \`evaluateReferenceAiEvents\` runs a synthetic deterministic rule evaluation over event types and normalized usage. Keep production-derived evaluation data behind the existing explicit data-review policy.

Provide model routes, model clients, policies, audit storage, durable persistence, and tool implementation from trusted server composition. Do not read provider/model identifiers or credentials from browser input. The generated default profile removes this directory and all Phase 14 AI dependencies from the API package graph.
`;
}
