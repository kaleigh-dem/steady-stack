import { readJson, type Tree, writeJson } from '@nx/devkit';

import {
  referenceReadme,
  referenceWorkflowSource,
  referenceWorkflowSpecSource,
} from './ai-reference-template';

interface AiProfileOptions {
  readonly ai: boolean;
  readonly packageScope: string;
}

interface ApiPackageJson {
  readonly [key: string]: unknown;
  readonly dependencies?: Record<string, string>;
}

interface ApiTsconfig {
  readonly [key: string]: unknown;
  readonly references?: Array<{ readonly path: string }>;
}

interface AiCapability {
  readonly packageSuffix: string;
  readonly projectReference: string;
  readonly lockfileLink: string;
}

const aiCapabilities: readonly AiCapability[] = [
  {
    packageSuffix: 'backend-agent-durable',
    projectReference: '../../packages/backend/agent-durable/tsconfig.lib.json',
    lockfileLink: '../../packages/backend/agent-durable',
  },
  {
    packageSuffix: 'backend-agent-eval',
    projectReference: '../../packages/backend/agent-eval/tsconfig.lib.json',
    lockfileLink: '../../packages/backend/agent-eval',
  },
  {
    packageSuffix: 'backend-agent-governance',
    projectReference: '../../packages/backend/agent-governance/tsconfig.lib.json',
    lockfileLink: '../../packages/backend/agent-governance',
  },
  {
    packageSuffix: 'backend-agent-tool',
    projectReference: '../../packages/backend/agent-tool/tsconfig.lib.json',
    lockfileLink: '../../packages/backend/agent-tool',
  },
  {
    packageSuffix: 'backend-model',
    projectReference: '../../packages/backend/model/tsconfig.lib.json',
    lockfileLink: '../../packages/backend/model',
  },
] as const;

const aiReferenceRoot = 'apps/api/src/app/ai';

function packageName(packageScope: string, suffix: string): string {
  return `${packageScope}/${suffix}`;
}

function removeTreePath(tree: Tree, path: string): void {
  if (tree.read(path) !== null) {
    tree.delete(path);
    return;
  }
  for (const child of tree.children(path)) {
    removeTreePath(tree, `${path}/${child}`);
  }
}

function configureApiDependencies(tree: Tree, options: AiProfileOptions): void {
  const path = 'apps/api/package.json';
  if (!tree.exists(path)) return;

  const packageJson = readJson<ApiPackageJson>(tree, path);
  const dependencies = { ...(packageJson.dependencies ?? {}) };
  for (const capability of aiCapabilities) {
    const dependency = packageName(
      options.packageScope,
      capability.packageSuffix,
    );
    if (options.ai) dependencies[dependency] = 'workspace:*';
    else delete dependencies[dependency];
  }

  writeJson(tree, path, {
    ...packageJson,
    dependencies: Object.fromEntries(
      Object.entries(dependencies).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  });
}

function configureApiReferences(tree: Tree, options: AiProfileOptions): void {
  const path = 'apps/api/tsconfig.app.json';
  if (!tree.exists(path)) return;

  const tsconfig = readJson<ApiTsconfig>(tree, path);
  const aiReferences = new Set(
    aiCapabilities.map((capability) => capability.projectReference),
  );
  const references = (tsconfig.references ?? []).filter(
    (reference) => !aiReferences.has(reference.path),
  );
  if (options.ai) {
    references.push(
      ...aiCapabilities.map((capability) => ({
        path: capability.projectReference,
      })),
    );
  }
  writeJson(tree, path, { ...tsconfig, references });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function configureApiLockfile(tree: Tree, options: AiProfileOptions): void {
  const path = 'pnpm-lock.yaml';
  if (!tree.exists(path)) return;

  let content = tree.read(path, 'utf-8') ?? '';
  const importerStart = content.indexOf('\n  apps/api:\n');
  const importerEnd = content.indexOf('\n  apps/web:\n', importerStart + 1);
  if (importerStart < 0 || importerEnd < 0) {
    throw new Error('pnpm-lock.yaml must contain apps/api and apps/web importers.');
  }

  let importer = content.slice(importerStart, importerEnd);
  for (const capability of aiCapabilities) {
    const dependency = packageName(
      options.packageScope,
      capability.packageSuffix,
    );
    const block = new RegExp(
      `\\n      '${escapeRegExp(dependency)}':\\n        specifier: workspace:\\*\\n        version: link:${escapeRegExp(capability.lockfileLink)}\\n`,
      'g',
    );
    importer = importer.replace(block, '\n');
  }
  importer = importer.replace(/\n{3,}$/g, '\n\n');

  if (options.ai) {
    const blocks = aiCapabilities
      .map((capability) => {
        const dependency = packageName(
          options.packageScope,
          capability.packageSuffix,
        );
        return `      '${dependency}':\n        specifier: workspace:*\n        version: link:${capability.lockfileLink}\n`;
      })
      .join('');
    importer = `${importer.replace(/\n+$/g, '\n')}${blocks}\n`;
  }

  content = `${content.slice(0, importerStart)}${importer}${content.slice(importerEnd)}`;
  tree.write(path, content);
}

function writeReferenceFiles(tree: Tree, options: AiProfileOptions): void {
  if (!options.ai) {
    removeTreePath(tree, aiReferenceRoot);
    return;
  }
  tree.write(
    `${aiReferenceRoot}/reference-workflow.ts`,
    referenceWorkflowSource(options.packageScope),
  );
  tree.write(
    `${aiReferenceRoot}/reference-workflow.spec.ts`,
    referenceWorkflowSpecSource(options.packageScope),
  );
  tree.write(`${aiReferenceRoot}/README.md`, referenceReadme());
}

export function configureAiProfile(tree: Tree, options: AiProfileOptions): void {
  configureApiDependencies(tree, options);
  configureApiReferences(tree, options);
  configureApiLockfile(tree, options);
  writeReferenceFiles(tree, options);
}

export const aiCapabilityPackageSuffixes = aiCapabilities.map(
  (capability) => capability.packageSuffix,
);
