from pathlib import Path

source_path = Path('packages/backend/agent-governance/src/lib/governance.ts')
text = source_path.read_text()

replacements = [
    (
        """function requireIdentifier(value: string, label: string): string {\n  if (!SAFE_IDENTIFIER.test(value)) {\n""",
        """function requireIdentifier(value: unknown, label: string): string {\n  if (typeof value !== 'string' || !SAFE_IDENTIFIER.test(value)) {\n""",
    ),
    (
        """function requireCode(value: string, label: string): string {\n  if (!SAFE_CODE.test(value)) {\n""",
        """function requireCode(value: unknown, label: string): string {\n  if (typeof value !== 'string' || !SAFE_CODE.test(value)) {\n""",
    ),
    (
        """function exactKeys(\n  value: Record<string, unknown>,\n  allowed: readonly string[],\n): boolean {\n  const allowedSet = new Set(allowed);\n  return Object.keys(value).every((key) => allowedSet.has(key));\n}\n""",
        """function exactKeys(\n  value: Record<string, unknown>,\n  allowed: readonly string[],\n): boolean {\n  const keys = Object.keys(value);\n  if (keys.length !== allowed.length) return false;\n  const allowedSet = new Set(allowed);\n  return (\n    keys.every((key) => allowedSet.has(key)) &&\n    allowed.every((key) =>\n      Object.prototype.hasOwnProperty.call(value, key),\n    )\n  );\n}\n\nfunction requireStringArray(value: unknown, label: string): readonly string[] {\n  if (!Array.isArray(value)) {\n    throw new GovernanceError(`${label} must be an array.`, 'invalid_input');\n  }\n  for (const item of value) {\n    requireIdentifier(item, label);\n  }\n  return value as readonly string[];\n}\n\nfunction requireOptionalBoolean(value: unknown, label: string): void {\n  if (value !== undefined && typeof value !== 'boolean') {\n    throw new GovernanceError(`${label} must be a boolean.`, 'invalid_input');\n  }\n}\n""",
    ),
    (
        """function validatedToolPolicy(policy: ToolAllowlistPolicy): {\n  allowed: Set<string>;\n  approval: Set<string>;\n} {\n  const allowed = new Set<string>();\n  for (const toolId of policy.allowedToolIds) {\n""",
        """function validatedToolPolicy(policy: ToolAllowlistPolicy): {\n  allowed: Set<string>;\n  approval: Set<string>;\n} {\n  const allowedToolIds = requireStringArray(\n    policy.allowedToolIds,\n    'allowedToolIds',\n  );\n  const humanApprovalToolIds =\n    policy.humanApprovalToolIds === undefined\n      ? []\n      : requireStringArray(\n          policy.humanApprovalToolIds,\n          'humanApprovalToolIds',\n        );\n  const allowed = new Set<string>();\n  for (const toolId of allowedToolIds) {\n""",
    ),
    (
        """  const approval = new Set<string>();\n  for (const toolId of policy.humanApprovalToolIds ?? []) {\n""",
        """  const approval = new Set<string>();\n  for (const toolId of humanApprovalToolIds) {\n""",
    ),
    (
        """function validatedRoute(route: ModelRoute): ModelRoute {\n  requireIdentifier(route.routeId, 'routeId');\n  requireIdentifier(route.providerId, 'providerId');\n  requireIdentifier(route.modelId, 'modelId');\n  requireIdentifier(route.region, 'region');\n  if (route.allowedClassifications.length === 0) {\n""",
        """function validatedRoute(route: ModelRoute): ModelRoute {\n  const routeValue = requireObject(route, 'model route');\n  if (\n    !exactKeys(routeValue, [\n      'routeId',\n      'providerId',\n      'modelId',\n      'region',\n      'allowedClassifications',\n      'retention',\n      'capabilities',\n    ])\n  ) {\n    throw new GovernanceError(\n      'model route was malformed.',\n      'invalid_input',\n    );\n  }\n  requireIdentifier(route.routeId, 'routeId');\n  requireIdentifier(route.providerId, 'providerId');\n  requireIdentifier(route.modelId, 'modelId');\n  requireIdentifier(route.region, 'region');\n  if (!Array.isArray(route.allowedClassifications)) {\n    throw new GovernanceError(\n      'allowedClassifications must be an array.',\n      'invalid_input',\n    );\n  }\n  if (route.allowedClassifications.length === 0) {\n""",
    ),
    (
        """  if (route.retention !== 'none' && route.retention !== 'approved') {\n    throw new GovernanceError(\n      'retention policy is not supported.',\n      'invalid_input',\n    );\n  }\n  return route;\n}\n""",
        """  if (route.retention !== 'none' && route.retention !== 'approved') {\n    throw new GovernanceError(\n      'retention policy is not supported.',\n      'invalid_input',\n    );\n  }\n  const capabilities = requireObject(route.capabilities, 'route capabilities');\n  if (\n    !exactKeys(capabilities, ['tools', 'structuredOutput', 'streaming']) ||\n    typeof capabilities.tools !== 'boolean' ||\n    typeof capabilities.structuredOutput !== 'boolean' ||\n    typeof capabilities.streaming !== 'boolean'\n  ) {\n    throw new GovernanceError(\n      'route capabilities must contain boolean tools, structuredOutput, and streaming fields.',\n      'invalid_input',\n    );\n  }\n  return route;\n}\n""",
    ),
    (
        """function validatedRoutes(\n  routes: readonly ModelRoute[],\n): Map<string, ModelRoute> {\n  if (routes.length === 0) {\n""",
        """function validatedRoutes(\n  routes: readonly ModelRoute[],\n): Map<string, ModelRoute> {\n  if (!Array.isArray(routes)) {\n    throw new GovernanceError('routes must be an array.', 'invalid_input');\n  }\n  if (routes.length === 0) {\n""",
    ),
    (
        """function validatedFallbackPolicy(\n  policy: ModelFallbackPolicy,\n  routes: Map<string, ModelRoute>,\n): void {\n  requireIdentifier(policy.primaryRouteId, 'primaryRouteId');\n""",
        """function validatedFallbackPolicy(\n  policy: ModelFallbackPolicy,\n  routes: Map<string, ModelRoute>,\n): void {\n  if (!Array.isArray(policy.fallbackRouteIds)) {\n    throw new GovernanceError(\n      'fallbackRouteIds must be an array.',\n      'invalid_input',\n    );\n  }\n  if (!Array.isArray(policy.fallbackOn)) {\n    throw new GovernanceError('fallbackOn must be an array.', 'invalid_input');\n  }\n  requireIdentifier(policy.primaryRouteId, 'primaryRouteId');\n""",
    ),
    (
        """function validatedRequirements(\n  requirements: ModelRouteRequirements,\n): ModelRouteRequirements {\n  requireClassification(requirements.classification);\n  if (requirements.allowedRegions !== undefined) {\n    if (requirements.allowedRegions.length === 0) {\n""",
        """function validatedRequirements(\n  requirements: ModelRouteRequirements,\n): ModelRouteRequirements {\n  requireClassification(requirements.classification);\n  requireOptionalBoolean(\n    requirements.requireNoProviderRetention,\n    'requireNoProviderRetention',\n  );\n  requireOptionalBoolean(requirements.requiresTools, 'requiresTools');\n  requireOptionalBoolean(\n    requirements.requiresStructuredOutput,\n    'requiresStructuredOutput',\n  );\n  requireOptionalBoolean(requirements.requiresStreaming, 'requiresStreaming');\n  if (requirements.allowedRegions !== undefined) {\n    if (!Array.isArray(requirements.allowedRegions)) {\n      throw new GovernanceError(\n        'allowedRegions must be an array when supplied.',\n        'invalid_input',\n      );\n    }\n    if (requirements.allowedRegions.length === 0) {\n""",
    ),
    (
        """function modelFailureCode(value: ModelFailureCode): ModelFailureCode {\n""",
        """function modelFailureCode(value: unknown): ModelFailureCode {\n""",
    ),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Expected source fragment not found:\n{old}')
    text = text.replace(old, new, 1)

source_path.write_text(text)

spec_path = Path('packages/backend/agent-governance/src/lib/review-regressions.spec.ts')
spec_path.write_text("""import { describe, expect, it } from 'vitest';\n\nimport {\n  applyInputPolicy,\n  applyOutputPolicy,\n  selectPrimaryModelRoute,\n  type GovernanceAuditEvent,\n  type GovernanceAuditSink,\n  type ModelRoute,\n} from './governance';\n\nconst modelContext = {\n  traceId: 'trace-review',\n  actorId: 'actor-review',\n  conversationId: 'conversation-review',\n  providerId: 'provider-review',\n  modelId: 'model-review',\n} as const;\n\nfunction recordingAudit(events: GovernanceAuditEvent[]): GovernanceAuditSink {\n  return { emit: (event) => events.push(event) };\n}\n\nconst validRoute: ModelRoute = {\n  routeId: 'primary',\n  providerId: 'provider-review',\n  modelId: 'model-review',\n  region: 'us-east',\n  allowedClassifications: ['public'],\n  retention: 'none',\n  capabilities: { tools: true, structuredOutput: true, streaming: true },\n};\n\nconst fallbackPolicy = {\n  primaryRouteId: 'primary',\n  fallbackRouteIds: [],\n  fallbackOn: [],\n  maxFallbacks: 0,\n} as const;\n\ndescribe('P14-06 review regressions', () => {\n  it('rejects policy actions inherited through the prototype chain', async () => {\n    const events: GovernanceAuditEvent[] = [];\n    const inheritedAllow = Object.create({ action: 'allow' }) as object;\n\n    await expect(\n      applyOutputPolicy(\n        modelContext,\n        { value: 'answer', classification: 'public' },\n        { evaluate: () => inheritedAllow },\n        recordingAudit(events),\n      ),\n    ).rejects.toMatchObject({\n      code: 'policy_failed',\n      reasonCode: 'policy_evaluation_failed',\n    });\n    expect(events).toEqual([\n      expect.objectContaining({\n        type: 'content_policy',\n        stage: 'output',\n        outcome: 'denied',\n        reasonCode: 'policy_evaluation_failed',\n      }),\n    ]);\n  });\n\n  it('rejects non-string identifiers before policy evaluation or audit emission', async () => {\n    const events: GovernanceAuditEvent[] = [];\n    let evaluated = false;\n    const malformedContext = {\n      ...modelContext,\n      traceId: {\n        toString: () => 'trace-safe',\n        leaked: 'RAW-PAYLOAD',\n      },\n    };\n\n    await expect(\n      applyInputPolicy(\n        malformedContext as unknown as typeof modelContext,\n        { value: 'input', classification: 'public' },\n        {\n          evaluate: () => {\n            evaluated = true;\n            return { action: 'allow' };\n          },\n        },\n        recordingAudit(events),\n      ),\n    ).rejects.toMatchObject({ code: 'invalid_input' });\n    expect(evaluated).toBe(false);\n    expect(events).toEqual([]);\n  });\n\n  it('rejects non-boolean route capabilities before route selection', async () => {\n    const events: GovernanceAuditEvent[] = [];\n    const malformedRoute = {\n      ...validRoute,\n      capabilities: {\n        ...validRoute.capabilities,\n        tools: 'yes',\n      },\n    } as unknown as ModelRoute;\n\n    await expect(\n      selectPrimaryModelRoute(\n        [malformedRoute],\n        fallbackPolicy,\n        { classification: 'public', requiresTools: true },\n        {\n          traceId: modelContext.traceId,\n          actorId: modelContext.actorId,\n          conversationId: modelContext.conversationId,\n        },\n        recordingAudit(events),\n      ),\n    ).rejects.toMatchObject({ code: 'invalid_input' });\n    expect(events).toEqual([]);\n  });\n\n  it('rejects non-boolean route requirements before compatibility checks', async () => {\n    const events: GovernanceAuditEvent[] = [];\n\n    await expect(\n      selectPrimaryModelRoute(\n        [validRoute],\n        fallbackPolicy,\n        {\n          classification: 'public',\n          requiresTools: 'yes',\n        } as unknown as { classification: 'public'; requiresTools: boolean },\n        {\n          traceId: modelContext.traceId,\n          actorId: modelContext.actorId,\n          conversationId: modelContext.conversationId,\n        },\n        recordingAudit(events),\n      ),\n    ).rejects.toMatchObject({ code: 'invalid_input' });\n    expect(events).toEqual([]);\n  });\n});\n""")
