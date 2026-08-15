import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  auditTaskControlPlane,
  checkTaskControlPlane,
  shouldAuditTaskControlPlane,
} from './task-management-control-plane.mjs';

function files(overrides = {}) {
  return new Map(
    Object.entries({
      'AGENTS.md': [
        '# Agent rules',
        'Work from one explicitly assigned or explicitly selected open GitHub Issue.',
        'If no Issue is selected, the agent must stop rather than invent work.',
      ].join('\n'),
      'docs/AUTOMATION_WORKFLOW.md': [
        '# Automation',
        'Use exact-head review and fail closed on invalid state.',
        '```text',
        'TASK: #88',
        '```',
      ].join('\n'),
      ...overrides,
    }).map(([file, content]) => [file, { content }]),
  );
}

test('rejects recreation of the retired roadmap', () => {
  const failures = auditTaskControlPlane(
    files({ 'docs/TODO.md': '# TODO\n- [ ] new work\n' }),
  );
  assert(
    failures.some((failure) =>
      failure.includes('retired Markdown task control plane must not exist'),
    ),
  );
});

test('rejects active code that reads the retired roadmap path', () => {
  const failures = auditTaskControlPlane(
    files({
      'tools/automation/scheduler.mjs':
        "export const roadmap = 'docs/TODO.md';\n",
    }),
  );
  assert(
    failures.some((failure) =>
      failure.includes('references the retired Markdown roadmap'),
    ),
  );
});

test('rejects agent instructions that select the next unchecked task', () => {
  const failures = auditTaskControlPlane(
    files({
      'AGENTS.md':
        'Pick the first unchecked task, then begin implementation.\nOpen GitHub Issue.\n',
    }),
  );
  assert(
    failures.some((failure) => failure.includes('unchecked Markdown task list')),
  );
});

test('rejects automation that discovers the next eligible TODO', () => {
  const failures = auditTaskControlPlane(
    files({
      'tools/automation/scheduler.mjs':
        "export const action = 'start the next eligible TODO';\n",
    }),
  );
  assert(
    failures.some((failure) =>
      failure.includes('discovers the next task from the retired TODO model'),
    ),
  );
});

test('allows explicit prohibitions against roadmap discovery', () => {
  const result = auditTaskControlPlane(
    files({
      'docs/AUTOMATION_WORKFLOW.md': [
        '# Automation',
        'Use exact-head review and fail closed on invalid state.',
        'Do not scan a Markdown roadmap to select work.',
        'Never inspect a TODO roadmap to discover a task.',
        '```text',
        'TASK: #88',
        '```',
      ].join('\n'),
    }),
  );
  assert.deepEqual(result, []);
});

test('allows only the inert generated CODEOWNERS template reference', () => {
  const generatedPath =
    'tools/workspace-plugin/src/generators/init/generator.ts';
  const result = auditTaskControlPlane(
    files({
      [generatedPath]: [
        'const lines = [',
        '  `/docs/TODO.md ${owners}`,',
        '];',
      ].join('\n'),
    }),
  );
  assert.deepEqual(result, []);

  const failures = auditTaskControlPlane(
    files({
      [generatedPath]: [
        'const lines = [',
        '  `/docs/TODO.md ${owners}`,',
        '];',
        "export const roadmap = 'docs/TODO.md';",
      ].join('\n'),
    }),
  );
  assert(
    failures.some((failure) =>
      failure.includes('references the retired Markdown roadmap'),
    ),
  );
});

test('rejects roadmap task IDs as active reviewer identity', () => {
  const failures = auditTaskControlPlane(
    files({
      'docs/reviewer.md': 'TASK: P14-07\n',
    }),
  );
  assert(
    failures.some((failure) =>
      failure.includes('historical roadmap ID as reviewer task identity'),
    ),
  );
});

test('allows historical roadmap references and task IDs', () => {
  const result = auditTaskControlPlane(
    files({
      'CHANGELOG.md': 'P14-07 completed under the former docs/TODO.md process.\n',
      'docs/adr/0099-history.md':
        'Historical decision record: P14-07 was selected from docs/TODO.md.\n',
    }),
  );
  assert.deepEqual(result, []);
});

test(
  'requires explicit open-Issue guidance and Issue-backed reviewer examples',
  () => {
    assert.deepEqual(auditTaskControlPlane(files()), []);
  },
);

test('runs only in the upstream source repository', () => {
  assert.equal(
    shouldAuditTaskControlPlane({ name: '@steadystack/source' }),
    true,
  );
  assert.equal(
    shouldAuditTaskControlPlane({ name: '@product/example' }),
    false,
  );
});

test('enforces the tracked upstream repository', async () => {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  assert.deepEqual(await checkTaskControlPlane(root), []);
});
