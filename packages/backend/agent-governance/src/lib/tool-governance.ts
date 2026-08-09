import {
  GovernanceError,
  evaluateToolAllowlist,
  type GovernanceAuditSink,
  type ToolAllowlistPolicy,
  type ToolGovernanceContext,
  type ToolGovernanceDecision,
} from './governance';

export interface GovernedToolContext extends ToolGovernanceContext {
  readonly humanApprovalSatisfied: boolean;
}

export async function evaluateToolGovernance(
  context: GovernedToolContext,
  policy: ToolAllowlistPolicy,
  audit: GovernanceAuditSink,
): Promise<ToolGovernanceDecision> {
  if (typeof context.humanApprovalSatisfied !== 'boolean') {
    throw new GovernanceError(
      'humanApprovalSatisfied must be a boolean from trusted application state.',
      'invalid_input',
    );
  }

  const {
    humanApprovalSatisfied,
    traceId,
    actorId,
    conversationId,
    providerId,
    modelId,
    toolId,
    toolCallId,
  } = context;
  const toolContext: ToolGovernanceContext = {
    traceId,
    actorId,
    conversationId,
    providerId,
    modelId,
    toolId,
    toolCallId,
  };

  if (!humanApprovalSatisfied) {
    return evaluateToolAllowlist(toolContext, policy, audit);
  }

  return evaluateToolAllowlist(
    toolContext,
    { allowedToolIds: policy.allowedToolIds },
    audit,
  );
}
