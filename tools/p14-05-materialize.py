from pathlib import Path

execution = Path('packages/backend/agent-durable/src/lib/durable-execution.ts')
source = execution.read_text()
start = source.index('async function emit(')
end = source.index('\nexport interface DurableCheckpointInput', start)
replacement = '''async function emit(
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
    ...(event.failureCode === undefined ? {} : { failureCode: event.failureCode }),
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
'''
source = source[:start] + replacement + source[end:]
source = source.replace(
    '  private readonly observer?: DurableExecutionObserver;\n',
    '  private readonly observer: DurableExecutionObserver | undefined;\n',
)
execution.write_text(source)

validation = Path('packages/backend/agent-durable/src/lib/validation.ts')
source = validation.read_text()
old = '''  if (Array.isArray(value)) {
    return `[${value.map(canonicalCheckpointValue).join(',')}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalCheckpointValue(value[key]!)}`,
    )
    .join(',')}}`;
'''
new = '''  if (Array.isArray(value)) {
    return `[${value.map(canonicalCheckpointValue).join(',')}]`;
  }
  const objectValue = value as {
    readonly [key: string]: DurableCheckpointValue;
  };
  return `{${Object.keys(objectValue)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalCheckpointValue(objectValue[key]!)}`,
    )
    .join(',')}}`;
'''
if old not in source:
    raise SystemExit('canonical checkpoint block not found')
validation.write_text(source.replace(old, new))

memory = Path('packages/backend/agent-durable/src/lib/memory-adapter.ts')
memory.write_text(memory.read_text().replace('  nonNegativeInteger,\n', ''))
