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
        '- `docs/TODO.md`',
        '- `docs/adr/`',
        '- `docs/documentation-integrity.md`',
      ].join('\n'),
      'AGENTS.md': '# Agent rules\n',
      'CHANGELOG.md': '# Changelog\n',
      'CONTRIBUTING.md': '# Contributing\n',
      'SECURITY.md': '# Security\n',
      'docs/TODO.md': '# Roadmap\n',
      'docs/adr/0027-documentation-surface-ownership.md': '# ADR\n',
      'wiki/Home.md':
        '# Home\n\nThis Wiki is the primary human-facing documentation surface.\n',
      'wiki/Quick-Start.md': '# Quick Start\n',
      'wiki/_Sidebar.md': '[Home](Home)\n',
      ...overrides,
    }).map(([file, content]) => [file, { content }]),
  );
}

test(
  'classifies the Wiki, README exception, and repository controls distinctly',
  () => {
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
  },
);

test(
  'rejects human onboarding duplicates and unclassified repository prose',
  () => {
    const failures = auditDocumentationSurfaces(
      files({
        'docs/getting-started.md': '# Duplicate onboarding\n',
        'docs/new-explainer.md': '# New explainer\n',
      }),
    );

    assert(
      failures.some((failure) => failure.includes('docs/getting-started.md')),
    );
    assert(
      failures.some((failure) => failure.includes('docs/new-explainer.md')),
    );
  },
);

test('keeps README as a routing surface instead of a second manual', () => {
  const failures = auditReadmeLanding(
    [
      '# SteadyStack',
      'https://github.com/kaleigh-dem/steady-stack/wiki',
      '`AGENTS.md` `.agents/skills` `docs/TODO.md` `docs/adr/` `docs/documentation-integrity.md`',
      '## Local development',
    ].join('\n'),
  );

  assert(failures.some((failure) => failure.includes('Local development')));
});

test('accepts a fully classified documentation inventory', () => {
  assert.deepEqual(auditDocumentationSurfaces(files()), []);
});

test('runs ownership checks only in the upstream source repository', () => {
  assert.equal(
    shouldAuditDocumentationSurfaces({ name: '@steadystack/source' }),
    true,
  );
  assert.equal(
    shouldAuditDocumentationSurfaces({ name: '@product/example' }),
    false,
  );
});

test(
  'enforces ownership against the tracked repository inventory',
  async () => {
    const root = fileURLToPath(new URL('../..', import.meta.url));
    assert.deepEqual(await checkDocumentationSurfaces(root), []);
  },
);
