from pathlib import Path

source_path = Path('packages/backend/agent-governance/src/lib/governance.ts')
source = source_path.read_text()
old = """  if (!all.includes(value)) {\n    throw new GovernanceError('failureCode is not supported.', 'invalid_input');\n  }\n  return value;\n"""
new = """  if (\n    typeof value !== 'string' ||\n    !all.includes(value as ModelFailureCode)\n  ) {\n    throw new GovernanceError('failureCode is not supported.', 'invalid_input');\n  }\n  return value as ModelFailureCode;\n"""
if old not in source:
    raise SystemExit('Expected modelFailureCode fragment not found')
source_path.write_text(source.replace(old, new, 1))

spec_path = Path('packages/backend/agent-governance/src/lib/review-regressions.spec.ts')
spec = spec_path.read_text()
old = "return { emit: (event) => events.push(event) };"
new = """return {\n    emit: (event) => {\n      events.push(event);\n    },\n  };"""
if old not in spec:
    raise SystemExit('Expected recordingAudit fragment not found')
spec_path.write_text(spec.replace(old, new, 1))
