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
  readonly projectRoot: string;
  readonly projectReference: string;
  readonly lockfileLink: string;
  readonly materializePackage: boolean;
}

const aiCapabilities: readonly AiCapability[] = [
  {
    packageSuffix: 'backend-agent-durable',
    projectRoot: 'packages/backend/agent-durable',
    projectReference: '../../packages/backend/agent-durable/tsconfig.lib.json',
    lockfileLink: '../../packages/backend/agent-durable',
    materializePackage: false,
  },
  {
    packageSuffix: 'backend-agent-eval',
    projectRoot: 'packages/backend/agent-eval',
    projectReference: '../../packages/backend/agent-eval/tsconfig.lib.json',
    lockfileLink: '../../packages/backend/agent-eval',
    materializePackage: true,
  },
  {
    packageSuffix: 'backend-agent-governance',
    projectRoot: 'packages/backend/agent-governance',
    projectReference:
      '../../packages/backend/agent-governance/tsconfig.lib.json',
    lockfileLink: '../../packages/backend/agent-governance',
    materializePackage: true,
  },
  {
    packageSuffix: 'backend-agent-tool',
    projectRoot: 'packages/backend/agent-tool',
    projectReference: '../../packages/backend/agent-tool/tsconfig.lib.json',
    lockfileLink: '../../packages/backend/agent-tool',
    materializePackage: true,
  },
  {
    packageSuffix: 'backend-model',
    projectRoot: 'packages/backend/model',
    projectReference: '../../packages/backend/model/tsconfig.lib.json',
    lockfileLink: '../../packages/backend/model',
    materializePackage: true,
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

function configureCapabilityPackages(
  tree: Tree,
  options: AiProfileOptions,
): void {
  for (const capability of aiCapabilities) {
    if (!capability.materializePackage) continue;
    const path = `${capability.projectRoot}/package.json`;
    if (!options.ai) {
      if (tree.exists(path)) tree.delete(path);
      continue;
    }
    writeJson(tree, path, {
      name: packageName(options.packageScope, capability.packageSuffix),
      version: '0.1.0',
      private: true,
      main: './src/index.ts',
      types: './src/index.ts',
      exports: {
        '.': {
          types: './src/index.ts',
          import: './src/index.ts',
          default: './src/index.ts',
        },
      },
    });
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

function configureLockfile(tree: Tree, options: AiProfileOptions): void {
  const path = 'pnpm-lock.yaml';
  if (!tree.exists(path)) return;

  let content = tree.read(path, 'utf-8') ?? '';
  const importerStart = content.indexOf('\n  apps/api:\n');
  const importerEnd = content.indexOf('\n  apps/web:\n', importerStart + 1);
  if (importerStart < 0 || importerEnd < 0) {
    throw new Error(
      'pnpm-lock.yaml must contain apps/api and apps/web importers.',
    );
  }

  let apiImporter = content.slice(importerStart, importerEnd);
  for (const capability of aiCapabilities) {
    const dependency = packageName(
      options.packageScope,
      capability.packageSuffix,
    );
    const block = new RegExp(
      `\\n      '${escapeRegExp(dependency)}':\\n        specifier: workspace:\\*\\n        version: link:${escapeRegExp(capability.lockfileLink)}\\n`,
      'g',
    );
    apiImporter = apiImporter.replace(block, '\n');
  }
  apiImporter = apiImporter.replace(/\n{3,}$/g, '\n\n');

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
    apiImporter = `${apiImporter.replace(/\n+$/g, '\n')}${blocks}\n`;
  }
  content = `${content.slice(0, importerStart)}${apiImporter}${content.slice(importerEnd)}`;

  for (const capability of aiCapabilities) {
    if (!capability.materializePackage) continue;
    content = content.replace(`\n  ${capability.projectRoot}: {}\n`, '\n');
  }
  content = content.replace(/\n{3,}/g, '\n\n');

  if (options.ai) {
    const marker = '\n  packages/backend/agent-task:\n';
    const markerIndex = content.indexOf(marker);
    if (markerIndex < 0) {
      throw new Error('pnpm-lock.yaml must contain the agent-task importer.');
    }
    const capabilityImporters = aiCapabilities
      .filter((capability) => capability.materializePackage)
      .map((capability) => `\n  ${capability.projectRoot}: {}\n`)
      .join('');
    content = `${content.slice(0, markerIndex)}${capabilityImporters}${content.slice(markerIndex)}`;
  }

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

export function configureAiProfile(
  tree: Tree,
  options: AiProfileOptions,
): void {
  configureCapabilityPackages(tree, options);
  configureApiDependencies(tree, options);
  configureApiReferences(tree, options);
  configureLockfile(tree, options);
  writeReferenceFiles(tree, options);
}

export const aiCapabilityPackageSuffixes = aiCapabilities.map(
  (capability) => capability.packageSuffix,
);
