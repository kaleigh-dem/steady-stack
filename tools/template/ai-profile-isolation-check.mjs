import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const aiPackageSuffixes = [
  'backend-agent-durable',
  'backend-agent-eval',
  'backend-agent-governance',
  'backend-agent-tool',
  'backend-model',
];

const materializedAiPackageRoots = [
  'packages/backend/agent-eval/package.json',
  'packages/backend/agent-governance/package.json',
  'packages/backend/agent-tool/package.json',
  'packages/backend/model/package.json',
];

const providerRuntimePackages = new Set([
  'openai',
  '@anthropic-ai/sdk',
  '@google/generative-ai',
  '@google/genai',
  '@aws-sdk/client-bedrock-runtime',
  'cohere-ai',
  '@mistralai/mistralai',
  '@azure/openai',
]);

const ignoredDirectories = new Set([
  '.git',
  '.next',
  '.nx',
  'coverage',
  'dist',
  'node_modules',
  'test-output',
]);

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf-8'));
}

async function packageJsonPaths(root, directory = root) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) continue;
      files.push(
        ...(await packageJsonPaths(root, path.join(directory, entry.name))),
      );
      continue;
    }
    if (entry.name === 'package.json')
      files.push(path.join(directory, entry.name));
  }
  return files;
}

function dependencyNames(packageJson) {
  return [
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.optionalDependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
  ];
}

async function main() {
  const workspace = process.argv[2] ? path.resolve(process.argv[2]) : null;
  if (!workspace) throw new Error('Workspace path is required.');

  const manifest = await readJson(
    path.join(workspace, 'workspace.template.json'),
  );
  const apiPackage = await readJson(
    path.join(workspace, 'apps/api/package.json'),
  );
  const apiTsconfig = await readJson(
    path.join(workspace, 'apps/api/tsconfig.app.json'),
  );
  const lockfile = await readFile(
    path.join(workspace, 'pnpm-lock.yaml'),
    'utf-8',
  );

  assert.equal(manifest.profiles.ai, false);
  assert.equal(
    await stat(path.join(workspace, 'apps/api/src/app/ai')).then(
      () => true,
      (error) => {
        if (error?.code === 'ENOENT') return false;
        throw error;
      },
    ),
    false,
    'The default API must not contain the generated AI reference workflow.',
  );

  for (const suffix of aiPackageSuffixes) {
    assert.equal(
      apiPackage.dependencies?.[`@generated-ci/${suffix}`],
      undefined,
      `Default API leaked @generated-ci/${suffix}.`,
    );
  }
  for (const reference of apiTsconfig.references ?? []) {
    assert.doesNotMatch(
      reference.path,
      /packages\/backend\/(?:agent-durable|agent-eval|agent-governance|agent-tool|model)\/tsconfig\.lib\.json$/,
    );
  }
  for (const relativePath of materializedAiPackageRoots) {
    await assert.rejects(stat(path.join(workspace, relativePath)), {
      code: 'ENOENT',
    });
    assert.doesNotMatch(
      lockfile,
      new RegExp(
        `\\n  ${relativePath.replace('/package.json', '')}: \\{\\}\\n`,
      ),
    );
  }

  for (const filePath of await packageJsonPaths(workspace)) {
    const packageJson = await readJson(filePath);
    for (const dependency of dependencyNames(packageJson)) {
      assert.equal(
        providerRuntimePackages.has(dependency),
        false,
        `${path.relative(workspace, filePath)} leaked model-provider dependency ${dependency}.`,
      );
    }
  }

  console.log(
    'Default generated profile contains no Phase 14 AI application dependencies, materialized AI package entry points, or model-provider runtime packages.',
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
