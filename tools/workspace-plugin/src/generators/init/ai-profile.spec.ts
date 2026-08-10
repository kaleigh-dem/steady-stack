import { readJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { describe, expect, it } from 'vitest';

import {
  aiCapabilityPackageSuffixes,
  configureAiProfile,
} from './ai-profile';

function createProfileTree() {
  const tree = createTreeWithEmptyWorkspace();
  writeJson(tree, 'apps/api/package.json', {
    name: '@acme/api',
    dependencies: {
      '@acme/contracts': 'workspace:*',
      '@acme/observability': 'workspace:*',
    },
  });
  writeJson(tree, 'apps/api/tsconfig.app.json', {
    references: [
      { path: '../../packages/contracts/tsconfig.lib.json' },
      { path: '../../packages/observability/tsconfig.lib.json' },
    ],
  });
  tree.write(
    'pnpm-lock.yaml',
    [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '',
      '  apps/api:',
      '    dependencies:',
      "      '@acme/contracts':",
      '        specifier: workspace:*',
      '        version: link:../../packages/contracts',
      "      '@acme/observability':",
      '        specifier: workspace:*',
      '        version: link:../../packages/observability',
      '',
      '  apps/web:',
      '    dependencies: {}',
      '',
    ].join('\n'),
  );
  return tree;
}

function generatedSnapshot(tree: ReturnType<typeof createProfileTree>) {
  return [
    tree.read('apps/api/package.json', 'utf-8'),
    tree.read('apps/api/tsconfig.app.json', 'utf-8'),
    tree.read('pnpm-lock.yaml', 'utf-8'),
    tree.read('apps/api/src/app/ai/reference-workflow.ts', 'utf-8'),
    tree.read('apps/api/src/app/ai/reference-workflow.spec.ts', 'utf-8'),
    tree.read('apps/api/src/app/ai/README.md', 'utf-8'),
  ];
}

describe('AI profile generation', () => {
  it('installs only the Phase 14 capabilities when explicitly enabled', () => {
    const tree = createProfileTree();
    configureAiProfile(tree, { ai: true, packageScope: '@acme' });

    const packageJson = readJson<{ dependencies: Record<string, string> }>(
      tree,
      'apps/api/package.json',
    );
    for (const suffix of aiCapabilityPackageSuffixes) {
      expect(packageJson.dependencies[`@acme/${suffix}`]).toBe('workspace:*');
    }
    expect(Object.keys(packageJson.dependencies)).toHaveLength(
      aiCapabilityPackageSuffixes.length + 2,
    );

    const tsconfig = readJson<{ references: Array<{ path: string }> }>(
      tree,
      'apps/api/tsconfig.app.json',
    );
    expect(tsconfig.references.map((reference) => reference.path)).toEqual(
      expect.arrayContaining([
        '../../packages/backend/agent-durable/tsconfig.lib.json',
        '../../packages/backend/agent-eval/tsconfig.lib.json',
        '../../packages/backend/agent-governance/tsconfig.lib.json',
        '../../packages/backend/agent-tool/tsconfig.lib.json',
        '../../packages/backend/model/tsconfig.lib.json',
      ]),
    );
    expect(tree.exists('apps/api/src/app/ai/reference-workflow.ts')).toBe(true);
    expect(tree.exists('apps/api/src/app/ai/reference-workflow.spec.ts')).toBe(
      true,
    );
    expect(tree.read('pnpm-lock.yaml', 'utf-8')).toContain(
      "'@acme/backend-model':\n        specifier: workspace:*\n        version: link:../../packages/backend/model",
    );
  });

  it('is deterministic and removes AI runtime composition when disabled', () => {
    const tree = createProfileTree();
    configureAiProfile(tree, { ai: true, packageScope: '@acme' });
    const first = generatedSnapshot(tree);
    configureAiProfile(tree, { ai: true, packageScope: '@acme' });
    expect(generatedSnapshot(tree)).toEqual(first);

    configureAiProfile(tree, { ai: false, packageScope: '@acme' });
    const packageJson = readJson<{ dependencies: Record<string, string> }>(
      tree,
      'apps/api/package.json',
    );
    expect(packageJson.dependencies).toEqual({
      '@acme/contracts': 'workspace:*',
      '@acme/observability': 'workspace:*',
    });
    expect(
      readJson<{ references: Array<{ path: string }> }>(
        tree,
        'apps/api/tsconfig.app.json',
      ).references,
    ).toEqual([
      { path: '../../packages/contracts/tsconfig.lib.json' },
      { path: '../../packages/observability/tsconfig.lib.json' },
    ]);
    expect(tree.exists('apps/api/src/app/ai')).toBe(false);
    for (const suffix of aiCapabilityPackageSuffixes) {
      expect(tree.read('pnpm-lock.yaml', 'utf-8')).not.toContain(
        `@acme/${suffix}`,
      );
    }
  });
});
