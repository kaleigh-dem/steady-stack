import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  auditDocumentationSurfaces,
  auditReadmeLanding,
  checkDocumentationSurfaces,
  classifyDocumentationSurface,
  shouldAuditDocumentationSurfaces,
} from './documentation-surfaces.mjs';

function files(overrides = {}) {
  return new Map(
    Object.entries({
      'README.md': [
        '# SteadyStack',
        '',
        'Human documentation: https://github.com/kaleigh-dem/steady-stack/wiki',
        '',
        '## Start here',
        '',
        'Use the Wiki.',
        '',
        '## Repository control surfaces',
        '',
        '- `AGENTS.md`',
        '- `.agents/skills`',
        '- GitHub Issues',
        '- `docs/adr/`',
        '- `docs/documentation-integrity.md`',
      ].join('\n'),
      'AGENTS.md': '# Agent rules\n',
      'CHANGELOG.md': '# Changelog\n',
      'CONTRIBUTING.md': '# Contributing\n',
      'SECURITY.md': '# Security\n',
      'docs/adr/0027-documentation-surface-ownership.md': '# ADR\n',
      'wiki/Home.md':
        '# Home\n\nThis Wiki is the primary human-facing documentation surface.\n',
      'wiki/Quick-Start.md': '# Quick Start\n',
      'wiki/_Sidebar.md': '[Home](Home)\n',
      ...overrides,
    }).map(([file, content]) => [file, { content }]),
  );
}

test('classifies documentation surfaces', () => {
  assert.deepEqual(classifyDocumentationSurface('wiki/Quick-Start.md'), {
    audience: 'human',
    authority: 'primary-human',
    reason: 'published-wiki-source',
  });
  assert.equal(
    classifyDocumentationSurface('README.md')?.authority,
    'landing-exception',
  );
  assert.equal(
    classifyDocumentationSurface('docs/adr/0027-example.md')?.authority,
    'repository-control',
  );
  assert.equal(classifyDocumentationSurface('docs/getting-started.md'), null);
  assert.equal(classifyDocumentationSurface('docs/TODO.md'), null);
});

test('rejects duplicate and unclassified prose', () => {
  const failures = auditDocumentationSurfaces(
    files({
      'docs/getting-started.md': '# Duplicate onboarding\n',
      'docs/new-explainer.md': '# New explainer\n',
    }),
  );

  assert(
    failures.some((failure) => failure.includes('docs/getting-started.md')),
  );
  assert(failures.some((failure) => failure.includes('docs/new-explainer.md')));
});

test('keeps README as a routing surface', () => {
  const failures = auditReadmeLanding(
    [
      '# SteadyStack',
      'https://github.com/kaleigh-dem/steady-stack/wiki',
      '`AGENTS.md` `.agents/skills` GitHub Issues `docs/adr/` `docs/documentation-integrity.md`',
      '## Local development',
    ].join('\n'),
  );

  assert(failures.some((failure) => failure.includes('Local development')));
});

test('accepts a classified inventory without a Markdown roadmap exception', () => {
  assert.deepEqual(auditDocumentationSurfaces(files()), []);
});

test('runs only in the upstream source repository', () => {
  assert.equal(
    shouldAuditDocumentationSurfaces({ name: '@steadystack/source' }),
    true,
  );
  assert.equal(
    shouldAuditDocumentationSurfaces({ name: '@product/example' }),
    false,
  );
});

test('enforces the tracked repository inventory', async () => {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  assert.deepEqual(await checkDocumentationSurfaces(root), []);
});
