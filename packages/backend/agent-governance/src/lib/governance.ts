const SAFE_CODE = /^[a-z][a-z0-9_]{0,63}$/;
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export type AgentDataClassification =
  'public' | 'internal' | 'confidential' | 'restricted' | 'credential';

const DATA_CLASSIFICATIONS: readonly AgentDataClassification[] = [
  'public',
  'internal',
  'confidential',
  'restricted',
  'credential',
];

export interface GovernanceContext {
  readonly traceId: string;
  readonly actorId: string;
  readonly conversationId: string;
}

export interface ModelGovernanceContext extends GovernanceContext {
  readonly providerId: string;
  readonly modelId: string;
}

export interface ContentEnvelope<T> {
  readonly value: T;
  readonly classification: AgentDataClassification;
}

export interface ContentPolicyContext extends ModelGovernanceContext {
  readonly stage: 'input' | 'output';
}

export type ContentPolicyDecision<T> =
  | { readonly action: 'allow' }
  | {
      readonly action: 'redact';
      readonly value: T;
      readonly classification: Exclude<AgentDataClassification, 'credential'>;
      readonly reasonCode: string;
    }
  | { readonly action: 'deny'; readonly reasonCode: string };

export interface InputPolicy<T> {
  evaluate(
    context: ContentPolicyContext,
    content: ContentEnvelope<T>,
  ): unknown | Promise<unknown>;
}

export interface OutputPolicy<T> {
  evaluate(
    context: ContentPolicyContext,
    content: ContentEnvelope<T>,
  ): unknown | Promise<unknown>;
}

export interface ToolGovernanceContext extends ModelGovernanceContext {
  readonly toolId: string;
  readonly toolCallId: string;
}

export interface ToolAllowlistPolicy {
  readonly allowedToolIds: readonly string[];
  readonly humanApprovalToolIds?: readonly string[];
}

export type ToolGovernanceDecision =
  | { readonly outcome: 'allowed' }
  | { readonly outcome: 'approval_required'; readonly reasonCode: string }
  | { readonly outcome: 'denied'; readonly reasonCode: string };

export interface ApprovalAuthorizationContext extends GovernanceContext {
  readonly runId: string;
  readonly approvalId: string;
  readonly decidedBy: string;
  readonly decision: 'approved' | 'rejected';
}

export type ApprovalAuthorizationDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reasonCode: string };

export interface ApprovalAuthorizationPolicy {
  authorize(context: ApprovalAuthorizationContext): unknown | Promise<unknown>;
}

export type ModelFailureCode =
  | 'aborted'
  | 'timeout'
  | 'rate_limited'
  | 'authentication'
  | 'permission'
  | 'invalid_request'
  | 'invalid_response'
  | 'unavailable'
  | 'provider_error';

export type ModelFallbackFailureCode = Extract<
  ModelFailureCode,
  'timeout' | 'rate_limited' | 'unavailable' | 'provider_error'
>;

const FALLBACK_FAILURE_CODES: readonly ModelFallbackFailureCode[] = [
  'timeout',
  'rate_limited',
  'unavailable',
  'provider_error',
];

export type ProviderRetentionPolicy = 'none' | 'approved';

export interface ModelRouteCapabilities {
  readonly tools: boolean;
  readonly structuredOutput: boolean;
  readonly streaming: boolean;
}

export interface ModelRoute {
  readonly routeId: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly region: string;
  readonly allowedClassifications: readonly Exclude<
    AgentDataClassification,
    'credential'
  >[];
  readonly retention: ProviderRetentionPolicy;
  readonly capabilities: ModelRouteCapabilities;
}

export interface ModelRouteRequirements {
  readonly classification: AgentDataClassification;
  readonly allowedRegions?: readonly string[];
  readonly requireNoProviderRetention?: boolean;
  readonly requiresTools?: boolean;
  readonly requiresStructuredOutput?: boolean;
  readonly requiresStreaming?: boolean;
}

export interface ModelFallbackPolicy {
  readonly primaryRouteId: string;
  readonly fallbackRouteIds: readonly string[];
  readonly fallbackOn: readonly ModelFallbackFailureCode[];
  readonly maxFallbacks: number;
}

export type ModelFallbackResult =
  | { readonly outcome: 'selected'; readonly route: ModelRoute }
  | { readonly outcome: 'blocked'; readonly reasonCode: string }
  | { readonly outcome: 'exhausted'; readonly reasonCode: string };

interface GovernanceAuditBase extends GovernanceContext {
  readonly schemaVersion: 1;
}

export interface ContentGovernanceAuditEvent extends GovernanceAuditBase {
  readonly type: 'content_policy';
  readonly stage: 'input' | 'output';
  readonly providerId: string;
  readonly modelId: string;
  readonly outcome: 'allowed' | 'redacted' | 'denied';
  readonly classificationBefore: AgentDataClassification;
  readonly classificationAfter?: AgentDataClassification;
  readonly reasonCode?: string;
}

export interface ToolGovernanceAuditEvent extends GovernanceAuditBase {
  readonly type: 'tool_policy';
  readonly providerId: string;
  readonly modelId: string;
  readonly toolId: string;
  readonly toolCallId: string;
  readonly outcome: 'allowed' | 'approval_required' | 'denied';
  readonly reasonCode?: string;
}

export interface ApprovalGovernanceAuditEvent extends GovernanceAuditBase {
  readonly type: 'approval_policy';
  readonly runId: string;
  readonly approvalId: string;
  readonly decidedBy: string;
  readonly decision: 'approved' | 'rejected';
  readonly outcome: 'allowed' | 'denied';
  readonly reasonCode?: string;
}

export interface ModelRouteGovernanceAuditEvent extends GovernanceAuditBase {
  readonly type: 'model_route';
  readonly action: 'primary' | 'fallback';
  readonly outcome: 'selected' | 'blocked' | 'exhausted';
  readonly routeId?: string;
  readonly providerId?: string;
  readonly modelId?: string;
  readonly failureCode?: ModelFailureCode;
  readonly reasonCode?: string;
}

export type GovernanceAuditEvent =
  | ContentGovernanceAuditEvent
  | ToolGovernanceAuditEvent
  | ApprovalGovernanceAuditEvent
  | ModelRouteGovernanceAuditEvent;

export interface GovernanceAuditSink {
  emit(event: GovernanceAuditEvent): void | Promise<void>;
}

export type GovernanceErrorCode =
  | 'invalid_input'
  | 'policy_failed'
  | 'policy_denied'
  | 'audit_failed'
  | 'route_blocked';

export class GovernanceError extends Error {
  public readonly code: GovernanceErrorCode;
  public readonly reasonCode?: string;

  public constructor(
    message: string,
    code: GovernanceErrorCode,
    reasonCode?: string,
  ) {
    super(message);
    this.name = 'GovernanceError';
    this.code = code;
    if (reasonCode !== undefined) this.reasonCode = reasonCode;
  }
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new GovernanceError(`${label} must be an object.`, 'invalid_input');
  }
  return value as Record<string, unknown>;
}

function requireIdentifier(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SAFE_IDENTIFIER.test(value)) {
    throw new GovernanceError(
      `${label} must be a payload-safe identifier up to 128 characters.`,
      'invalid_input',
    );
  }
  return value;
}

function requireCode(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SAFE_CODE.test(value)) {
    throw new GovernanceError(
      `${label} must be a lowercase snake-case identifier up to 64 characters.`,
      'invalid_input',
    );
  }
  return value;
}

function requireClassification(value: unknown): AgentDataClassification {
  if (!DATA_CLASSIFICATIONS.includes(value as AgentDataClassification)) {
    throw new GovernanceError(
      'classification is not supported.',
      'invalid_input',
    );
  }
  return value as AgentDataClassification;
}

function requireContext<T extends GovernanceContext>(context: T): T {
  requireIdentifier(context.traceId, 'traceId');
  requireIdentifier(context.actorId, 'actorId');
  requireIdentifier(context.conversationId, 'conversationId');
  return context;
}

function requireModelContext<T extends ModelGovernanceContext>(context: T): T {
  requireContext(context);
  requireIdentifier(context.providerId, 'providerId');
  requireIdentifier(context.modelId, 'modelId');
  return context;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  const keys = Object.keys(value);
  if (keys.length !== allowed.length) return false;
  const allowedSet = new Set(allowed);
  return (
    keys.every((key) => allowedSet.has(key)) &&
    allowed.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function requireStringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new GovernanceError(`${label} must be an array.`, 'invalid_input');
  }
  for (const item of value) {
    requireIdentifier(item, label);
  }
  return value as readonly string[];
}

function requireOptionalBoolean(value: unknown, label: string): void {
  if (value !== undefined && typeof value !== 'boolean') {
    throw new GovernanceError(`${label} must be a boolean.`, 'invalid_input');
  }
}

function parseContentPolicyDecision<T>(
  value: unknown,
): ContentPolicyDecision<T> {
  const decision = requireObject(value, 'policy decision');
  if (decision.action === 'allow' && exactKeys(decision, ['action'])) {
    return { action: 'allow' };
  }
  if (
    decision.action === 'deny' &&
    exactKeys(decision, ['action', 'reasonCode']) &&
    typeof decision.reasonCode === 'string'
  ) {
    return {
      action: 'deny',
      reasonCode: requireCode(decision.reasonCode, 'reasonCode'),
    };
  }
  if (
    decision.action === 'redact' &&
    exactKeys(decision, ['action', 'value', 'classification', 'reasonCode']) &&
    typeof decision.reasonCode === 'string'
  ) {
    const classification = requireClassification(decision.classification);
    if (classification === 'credential') {
      throw new GovernanceError(
        'redacted content cannot remain credential-classified.',
        'invalid_input',
      );
    }
    return {
      action: 'redact',
      value: decision.value as T,
      classification,
      reasonCode: requireCode(decision.reasonCode, 'reasonCode'),
    };
  }
  throw new GovernanceError('policy decision was malformed.', 'invalid_input');
}

function parseApprovalAuthorizationDecision(
  value: unknown,
): ApprovalAuthorizationDecision {
  const decision = requireObject(value, 'approval authorization decision');
  if (decision.allowed === true && exactKeys(decision, ['allowed'])) {
    return { allowed: true };
  }
  if (
    decision.allowed === false &&
    exactKeys(decision, ['allowed', 'reasonCode']) &&
    typeof decision.reasonCode === 'string'
  ) {
    return {
      allowed: false,
      reasonCode: requireCode(decision.reasonCode, 'reasonCode'),
    };
  }
  throw new GovernanceError(
    'approval authorization decision was malformed.',
    'invalid_input',
  );
}

async function emitAudit(
  audit: GovernanceAuditSink,
  event: GovernanceAuditEvent,
): Promise<void> {
  try {
    await audit.emit(event);
  } catch {
    throw new GovernanceError(
      'Governance audit emission failed.',
      'audit_failed',
    );
  }
}

function contentAuditBase(
  context: ContentPolicyContext,
  classificationBefore: AgentDataClassification,
): Omit<
  ContentGovernanceAuditEvent,
  'outcome' | 'classificationAfter' | 'reasonCode'
> {
  return {
    schemaVersion: 1,
    type: 'content_policy',
    stage: context.stage,
    traceId: context.traceId,
    actorId: context.actorId,
    conversationId: context.conversationId,
    providerId: context.providerId,
    modelId: context.modelId,
    classificationBefore,
  };
}

async function applyContentPolicy<T>(
  contextValue: ContentPolicyContext,
  content: ContentEnvelope<T>,
  policy: InputPolicy<T> | OutputPolicy<T>,
  audit: GovernanceAuditSink,
): Promise<ContentEnvelope<T>> {
  const context = requireModelContext(contextValue);
  const classification = requireClassification(content.classification);
  const auditBase = contentAuditBase(context, classification);

  let decision: ContentPolicyDecision<T>;
  try {
    decision = parseContentPolicyDecision<T>(
      await policy.evaluate(context, content),
    );
  } catch (error) {
    await emitAudit(audit, {
      ...auditBase,
      outcome: 'denied',
      reasonCode: 'policy_evaluation_failed',
    });
    if (error instanceof GovernanceError && error.code === 'audit_failed') {
      throw error;
    }
    throw new GovernanceError(
      'Content policy evaluation failed closed.',
      'policy_failed',
      'policy_evaluation_failed',
    );
  }

  if (decision.action === 'allow') {
    if (classification === 'credential') {
      await emitAudit(audit, {
        ...auditBase,
        outcome: 'denied',
        reasonCode: 'credential_data_prohibited',
      });
      throw new GovernanceError(
        'Credential-classified content cannot be allowed unchanged.',
        'policy_denied',
        'credential_data_prohibited',
      );
    }
    await emitAudit(audit, {
      ...auditBase,
      outcome: 'allowed',
      classificationAfter: classification,
    });
    return content;
  }

  if (decision.action === 'deny') {
    await emitAudit(audit, {
      ...auditBase,
      outcome: 'denied',
      reasonCode: decision.reasonCode,
    });
    throw new GovernanceError(
      'Content policy denied the operation.',
      'policy_denied',
      decision.reasonCode,
    );
  }

  await emitAudit(audit, {
    ...auditBase,
    outcome: 'redacted',
    classificationAfter: decision.classification,
    reasonCode: decision.reasonCode,
  });
  return {
    value: decision.value,
    classification: decision.classification,
  };
}

export async function applyInputPolicy<T>(
  context: Omit<ContentPolicyContext, 'stage'>,
  content: ContentEnvelope<T>,
  policy: InputPolicy<T>,
  audit: GovernanceAuditSink,
): Promise<ContentEnvelope<T>> {
  return applyContentPolicy(
    { ...context, stage: 'input' },
    content,
    policy,
    audit,
  );
}

export async function applyOutputPolicy<T>(
  context: Omit<ContentPolicyContext, 'stage'>,
  content: ContentEnvelope<T>,
  policy: OutputPolicy<T>,
  audit: GovernanceAuditSink,
): Promise<ContentEnvelope<T>> {
  return applyContentPolicy(
    { ...context, stage: 'output' },
    content,
    policy,
    audit,
  );
}

function validatedToolPolicy(policy: ToolAllowlistPolicy): {
  allowed: Set<string>;
  approval: Set<string>;
} {
  const allowedToolIds = requireStringArray(
    policy.allowedToolIds,
    'allowedToolIds',
  );
  const humanApprovalToolIds =
    policy.humanApprovalToolIds === undefined
      ? []
      : requireStringArray(policy.humanApprovalToolIds, 'humanApprovalToolIds');
  const allowed = new Set<string>();
  for (const toolId of allowedToolIds) {
    requireIdentifier(toolId, 'allowedToolId');
    if (allowed.has(toolId)) {
      throw new GovernanceError(
        'allowedToolIds must not contain duplicates.',
        'invalid_input',
      );
    }
    allowed.add(toolId);
  }
  const approval = new Set<string>();
  for (const toolId of humanApprovalToolIds) {
    requireIdentifier(toolId, 'humanApprovalToolId');
    if (approval.has(toolId)) {
      throw new GovernanceError(
        'humanApprovalToolIds must not contain duplicates.',
        'invalid_input',
      );
    }
    if (!allowed.has(toolId)) {
      throw new GovernanceError(
        'humanApprovalToolIds must be a subset of allowedToolIds.',
        'invalid_input',
      );
    }
    approval.add(toolId);
  }
  return { allowed, approval };
}

export async function evaluateToolAllowlist(
  contextValue: ToolGovernanceContext,
  policy: ToolAllowlistPolicy,
  audit: GovernanceAuditSink,
): Promise<ToolGovernanceDecision> {
  const context = requireModelContext(contextValue);
  requireIdentifier(context.toolId, 'toolId');
  requireIdentifier(context.toolCallId, 'toolCallId');
  const validated = validatedToolPolicy(policy);
  const auditBase = {
    schemaVersion: 1 as const,
    type: 'tool_policy' as const,
    traceId: context.traceId,
    actorId: context.actorId,
    conversationId: context.conversationId,
    providerId: context.providerId,
    modelId: context.modelId,
    toolId: context.toolId,
    toolCallId: context.toolCallId,
  };

  if (!validated.allowed.has(context.toolId)) {
    await emitAudit(audit, {
      ...auditBase,
      outcome: 'denied',
      reasonCode: 'tool_not_allowlisted',
    });
    return { outcome: 'denied', reasonCode: 'tool_not_allowlisted' };
  }
  if (validated.approval.has(context.toolId)) {
    await emitAudit(audit, {
      ...auditBase,
      outcome: 'approval_required',
      reasonCode: 'human_approval_required',
    });
    return {
      outcome: 'approval_required',
      reasonCode: 'human_approval_required',
    };
  }

  await emitAudit(audit, { ...auditBase, outcome: 'allowed' });
  return { outcome: 'allowed' };
}

export async function authorizeApprovalDecision(
  contextValue: ApprovalAuthorizationContext,
  policy: ApprovalAuthorizationPolicy,
  audit: GovernanceAuditSink,
): Promise<void> {
  const context = requireContext(contextValue);
  requireIdentifier(context.runId, 'runId');
  requireIdentifier(context.approvalId, 'approvalId');
  requireIdentifier(context.decidedBy, 'decidedBy');
  if (context.decision !== 'approved' && context.decision !== 'rejected') {
    throw new GovernanceError('decision is not supported.', 'invalid_input');
  }

  const auditBase = {
    schemaVersion: 1 as const,
    type: 'approval_policy' as const,
    traceId: context.traceId,
    actorId: context.actorId,
    conversationId: context.conversationId,
    runId: context.runId,
    approvalId: context.approvalId,
    decidedBy: context.decidedBy,
    decision: context.decision,
  };

  let decision: ApprovalAuthorizationDecision;
  try {
    decision = parseApprovalAuthorizationDecision(
      await policy.authorize(context),
    );
  } catch (error) {
    await emitAudit(audit, {
      ...auditBase,
      outcome: 'denied',
      reasonCode: 'approval_policy_failed',
    });
    if (error instanceof GovernanceError && error.code === 'audit_failed') {
      throw error;
    }
    throw new GovernanceError(
      'Approval authorization failed closed.',
      'policy_failed',
      'approval_policy_failed',
    );
  }

  if (decision.allowed === false) {
    await emitAudit(audit, {
      ...auditBase,
      outcome: 'denied',
      reasonCode: decision.reasonCode,
    });
    throw new GovernanceError(
      'Approval decision was not authorized.',
      'policy_denied',
      decision.reasonCode,
    );
  }

  await emitAudit(audit, { ...auditBase, outcome: 'allowed' });
}

function validatedRoute(route: ModelRoute): ModelRoute {
  const routeValue = requireObject(route, 'model route');
  if (
    !exactKeys(routeValue, [
      'routeId',
      'providerId',
      'modelId',
      'region',
      'allowedClassifications',
      'retention',
      'capabilities',
    ])
  ) {
    throw new GovernanceError('model route was malformed.', 'invalid_input');
  }
  requireIdentifier(route.routeId, 'routeId');
  requireIdentifier(route.providerId, 'providerId');
  requireIdentifier(route.modelId, 'modelId');
  requireIdentifier(route.region, 'region');
  if (!Array.isArray(route.allowedClassifications)) {
    throw new GovernanceError(
      'allowedClassifications must be an array.',
      'invalid_input',
    );
  }
  if (route.allowedClassifications.length === 0) {
    throw new GovernanceError(
      'allowedClassifications must not be empty.',
      'invalid_input',
    );
  }
  const classifications = new Set<AgentDataClassification>();
  for (const classification of route.allowedClassifications) {
    const parsed = requireClassification(classification);
    if (parsed === 'credential') {
      throw new GovernanceError(
        'Model routes cannot allow credential-classified data.',
        'invalid_input',
      );
    }
    if (classifications.has(parsed)) {
      throw new GovernanceError(
        'allowedClassifications must not contain duplicates.',
        'invalid_input',
      );
    }
    classifications.add(parsed);
  }
  if (route.retention !== 'none' && route.retention !== 'approved') {
    throw new GovernanceError(
      'retention policy is not supported.',
      'invalid_input',
    );
  }
  const capabilities = requireObject(route.capabilities, 'route capabilities');
  if (
    !exactKeys(capabilities, ['tools', 'structuredOutput', 'streaming']) ||
    typeof capabilities.tools !== 'boolean' ||
    typeof capabilities.structuredOutput !== 'boolean' ||
    typeof capabilities.streaming !== 'boolean'
  ) {
    throw new GovernanceError(
      'route capabilities must contain boolean tools, structuredOutput, and streaming fields.',
      'invalid_input',
    );
  }
  return route;
}

function validatedRoutes(
  routes: readonly ModelRoute[],
): Map<string, ModelRoute> {
  if (!Array.isArray(routes)) {
    throw new GovernanceError('routes must be an array.', 'invalid_input');
  }
  if (routes.length === 0) {
    throw new GovernanceError(
      'At least one model route is required.',
      'invalid_input',
    );
  }
  const byId = new Map<string, ModelRoute>();
  for (const route of routes) {
    validatedRoute(route);
    if (byId.has(route.routeId)) {
      throw new GovernanceError(
        'Model route identifiers must be unique.',
        'invalid_input',
      );
    }
    byId.set(route.routeId, route);
  }
  return byId;
}

function validatedFallbackPolicy(
  policy: ModelFallbackPolicy,
  routes: Map<string, ModelRoute>,
): void {
  if (!Array.isArray(policy.fallbackRouteIds)) {
    throw new GovernanceError(
      'fallbackRouteIds must be an array.',
      'invalid_input',
    );
  }
  if (!Array.isArray(policy.fallbackOn)) {
    throw new GovernanceError('fallbackOn must be an array.', 'invalid_input');
  }
  requireIdentifier(policy.primaryRouteId, 'primaryRouteId');
  if (!routes.has(policy.primaryRouteId)) {
    throw new GovernanceError(
      'primaryRouteId must reference a configured route.',
      'invalid_input',
    );
  }
  if (!Number.isSafeInteger(policy.maxFallbacks) || policy.maxFallbacks < 0) {
    throw new GovernanceError(
      'maxFallbacks must be a non-negative safe integer.',
      'invalid_input',
    );
  }
  if (policy.maxFallbacks > policy.fallbackRouteIds.length) {
    throw new GovernanceError(
      'maxFallbacks cannot exceed the configured fallback route count.',
      'invalid_input',
    );
  }
  const fallbackIds = new Set<string>();
  for (const routeId of policy.fallbackRouteIds) {
    requireIdentifier(routeId, 'fallbackRouteId');
    if (routeId === policy.primaryRouteId || fallbackIds.has(routeId)) {
      throw new GovernanceError(
        'fallbackRouteIds must be unique and exclude the primary route.',
        'invalid_input',
      );
    }
    if (!routes.has(routeId)) {
      throw new GovernanceError(
        'fallbackRouteIds must reference configured routes.',
        'invalid_input',
      );
    }
    fallbackIds.add(routeId);
  }
  const fallbackCodes = new Set<ModelFallbackFailureCode>();
  for (const code of policy.fallbackOn) {
    if (!FALLBACK_FAILURE_CODES.includes(code)) {
      throw new GovernanceError(
        'fallbackOn contains a non-transient model failure.',
        'invalid_input',
      );
    }
    if (fallbackCodes.has(code)) {
      throw new GovernanceError(
        'fallbackOn must not contain duplicates.',
        'invalid_input',
      );
    }
    fallbackCodes.add(code);
  }
}

function validatedRequirements(
  requirements: ModelRouteRequirements,
): ModelRouteRequirements {
  requireClassification(requirements.classification);
  requireOptionalBoolean(
    requirements.requireNoProviderRetention,
    'requireNoProviderRetention',
  );
  requireOptionalBoolean(requirements.requiresTools, 'requiresTools');
  requireOptionalBoolean(
    requirements.requiresStructuredOutput,
    'requiresStructuredOutput',
  );
  requireOptionalBoolean(requirements.requiresStreaming, 'requiresStreaming');
  if (requirements.allowedRegions !== undefined) {
    if (!Array.isArray(requirements.allowedRegions)) {
      throw new GovernanceError(
        'allowedRegions must be an array when supplied.',
        'invalid_input',
      );
    }
    if (requirements.allowedRegions.length === 0) {
      throw new GovernanceError(
        'allowedRegions must not be empty when supplied.',
        'invalid_input',
      );
    }
    const regions = new Set<string>();
    for (const region of requirements.allowedRegions) {
      requireIdentifier(region, 'allowedRegion');
      if (regions.has(region)) {
        throw new GovernanceError(
          'allowedRegions must not contain duplicates.',
          'invalid_input',
        );
      }
      regions.add(region);
    }
  }
  return requirements;
}

function routeCompatibilityReason(
  route: ModelRoute,
  requirements: ModelRouteRequirements,
): string | null {
  if (requirements.classification === 'credential') {
    return 'route_classification_blocked';
  }
  if (!route.allowedClassifications.includes(requirements.classification)) {
    return 'route_classification_blocked';
  }
  if (
    requirements.allowedRegions !== undefined &&
    !requirements.allowedRegions.includes(route.region)
  ) {
    return 'route_region_blocked';
  }
  if (requirements.requireNoProviderRetention && route.retention !== 'none') {
    return 'route_retention_blocked';
  }
  if (requirements.requiresTools && !route.capabilities.tools) {
    return 'route_tool_capability_blocked';
  }
  if (
    requirements.requiresStructuredOutput &&
    !route.capabilities.structuredOutput
  ) {
    return 'route_structured_output_blocked';
  }
  if (requirements.requiresStreaming && !route.capabilities.streaming) {
    return 'route_streaming_blocked';
  }
  return null;
}

function routeAuditBase(context: GovernanceContext) {
  requireContext(context);
  return {
    schemaVersion: 1 as const,
    type: 'model_route' as const,
    traceId: context.traceId,
    actorId: context.actorId,
    conversationId: context.conversationId,
  };
}

export async function selectPrimaryModelRoute(
  routes: readonly ModelRoute[],
  policy: ModelFallbackPolicy,
  requirementsValue: ModelRouteRequirements,
  context: GovernanceContext,
  audit: GovernanceAuditSink,
): Promise<ModelRoute> {
  const byId = validatedRoutes(routes);
  validatedFallbackPolicy(policy, byId);
  const requirements = validatedRequirements(requirementsValue);
  const route = byId.get(policy.primaryRouteId);
  if (!route) {
    throw new GovernanceError(
      'Primary model route was missing.',
      'invalid_input',
    );
  }
  const reasonCode = routeCompatibilityReason(route, requirements);
  const auditBase = routeAuditBase(context);
  if (reasonCode !== null) {
    await emitAudit(audit, {
      ...auditBase,
      action: 'primary',
      outcome: 'blocked',
      routeId: route.routeId,
      providerId: route.providerId,
      modelId: route.modelId,
      reasonCode,
    });
    throw new GovernanceError(
      'Primary model route is incompatible with request requirements.',
      'route_blocked',
      reasonCode,
    );
  }
  await emitAudit(audit, {
    ...auditBase,
    action: 'primary',
    outcome: 'selected',
    routeId: route.routeId,
    providerId: route.providerId,
    modelId: route.modelId,
  });
  return route;
}

function modelFailureCode(value: unknown): ModelFailureCode {
  const all: readonly ModelFailureCode[] = [
    'aborted',
    'timeout',
    'rate_limited',
    'authentication',
    'permission',
    'invalid_request',
    'invalid_response',
    'unavailable',
    'provider_error',
  ];
  if (typeof value !== 'string' || !all.includes(value as ModelFailureCode)) {
    throw new GovernanceError('failureCode is not supported.', 'invalid_input');
  }
  return value as ModelFailureCode;
}

export async function selectFallbackModelRoute(input: {
  readonly routes: readonly ModelRoute[];
  readonly policy: ModelFallbackPolicy;
  readonly requirements: ModelRouteRequirements;
  readonly currentRouteId: string;
  readonly failureCode: ModelFailureCode;
  readonly usedRouteIds: readonly string[];
  readonly context: GovernanceContext;
  readonly audit: GovernanceAuditSink;
}): Promise<ModelFallbackResult> {
  const byId = validatedRoutes(input.routes);
  validatedFallbackPolicy(input.policy, byId);
  const requirements = validatedRequirements(input.requirements);
  const currentRouteId = requireIdentifier(
    input.currentRouteId,
    'currentRouteId',
  );
  const failureCode = modelFailureCode(input.failureCode);
  const chain = [input.policy.primaryRouteId, ...input.policy.fallbackRouteIds];
  const currentIndex = chain.indexOf(currentRouteId);
  if (currentIndex < 0) {
    throw new GovernanceError(
      'currentRouteId is not in the configured route chain.',
      'invalid_input',
    );
  }
  const used = new Set<string>();
  for (const routeId of input.usedRouteIds) {
    requireIdentifier(routeId, 'usedRouteId');
    if (!chain.includes(routeId) || used.has(routeId)) {
      throw new GovernanceError(
        'usedRouteIds must be unique configured route identifiers.',
        'invalid_input',
      );
    }
    used.add(routeId);
  }
  if (!used.has(currentRouteId)) {
    throw new GovernanceError(
      'usedRouteIds must include currentRouteId.',
      'invalid_input',
    );
  }

  const auditBase = routeAuditBase(input.context);
  if (
    !FALLBACK_FAILURE_CODES.includes(failureCode as ModelFallbackFailureCode) ||
    !input.policy.fallbackOn.includes(failureCode as ModelFallbackFailureCode)
  ) {
    await emitAudit(input.audit, {
      ...auditBase,
      action: 'fallback',
      outcome: 'blocked',
      failureCode,
      reasonCode: 'fallback_failure_not_allowed',
    });
    return { outcome: 'blocked', reasonCode: 'fallback_failure_not_allowed' };
  }

  const usedFallbackCount = [...used].filter(
    (routeId) => routeId !== input.policy.primaryRouteId,
  ).length;
  if (usedFallbackCount >= input.policy.maxFallbacks) {
    await emitAudit(input.audit, {
      ...auditBase,
      action: 'fallback',
      outcome: 'exhausted',
      failureCode,
      reasonCode: 'fallback_limit_reached',
    });
    return { outcome: 'exhausted', reasonCode: 'fallback_limit_reached' };
  }

  for (const routeId of chain.slice(currentIndex + 1)) {
    if (used.has(routeId)) continue;
    const route = byId.get(routeId);
    if (!route) continue;
    if (routeCompatibilityReason(route, requirements) !== null) continue;
    await emitAudit(input.audit, {
      ...auditBase,
      action: 'fallback',
      outcome: 'selected',
      routeId: route.routeId,
      providerId: route.providerId,
      modelId: route.modelId,
      failureCode,
    });
    return { outcome: 'selected', route };
  }

  await emitAudit(input.audit, {
    ...auditBase,
    action: 'fallback',
    outcome: 'blocked',
    failureCode,
    reasonCode: 'no_compatible_fallback',
  });
  return { outcome: 'blocked', reasonCode: 'no_compatible_fallback' };
}
