import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ignoredCopySegments = new Set([
  '.git',
  '.next',
  '.nx',
  'coverage',
  'dist',
  'node_modules',
  'test-output',
]);

const aiCapabilities = [
  ['backend-agent-durable', 'packages/backend/agent-durable'],
  ['backend-agent-eval', 'packages/backend/agent-eval'],
  ['backend-agent-governance', 'packages/backend/agent-governance'],
  ['backend-agent-tool', 'packages/backend/agent-tool'],
  ['backend-model', 'packages/backend/model'],
];

const materializedCapabilityRoots = aiCapabilities
  .filter(([suffix]) => suffix !== 'backend-agent-durable')
  .map(([, root]) => root);

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (entry === '--') continue;
    if (!entry.startsWith('--')) throw new Error(`Unexpected argument: ${entry}`);
    const [key, inlineValue] = entry.slice(2).split('=', 2);
    if (inlineValue !== undefined) {
      options[key] = inlineValue;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}.`);
    }
    options[key] = value;
    index += 1;
  }
  return options;
}

function execute(command, args, cwd, options = {}) {
  const capture = options.capture ?? false;
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf-8',
    env: {
      ...process.env,
      CI: 'true',
      NX_DAEMON: 'false',
      ...options.env,
    },
    maxBuffer: 50 * 1024 * 1024,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(' ')} failed with status ${result.status ?? 'unknown'}.`,
        capture ? result.stdout : '',
        capture ? result.stderr : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
  return result.stdout ?? '';
}

function shouldCopy(workspaceRoot, source) {
  const relativePath = path.relative(workspaceRoot, source);
  if (!relativePath) return true;
  if (relativePath === '.env') return false;
  return !relativePath
    .split(path.sep)
    .some((segment) => ignoredCopySegments.has(segment));
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf-8'));
}

async function installReleasedPlugin(workspace, artifact, expectedVersion) {
  const pluginPath = path.join(
    workspace,
    'node_modules/@steadystack/workspace-plugin',
  );
  await rm(pluginPath, { force: true, recursive: true });
  await mkdir(pluginPath, { recursive: true });
  execute(
    'tar',
    ['-xzf', artifact, '-C', pluginPath, '--strip-components=1'],
    workspace,
  );
  const packageJson = await readJson(path.join(pluginPath, 'package.json'));
  assert.equal(packageJson.name, '@steadystack/workspace-plugin');
  assert.equal(packageJson.version, expectedVersion);
}

function generatorArguments() {
  return [
    'exec',
    'nx',
    'g',
    '@steadystack/workspace-plugin:preset',
    'generated-ai-ci',
    '--displayName=Generated AI Workspace CI',
    '--packageScope=@generated-ai',
    '--repositoryOwner=generated-ai',
    '--codeowners=@generated-ai/platform,@generated-ai/security',
    '--applications=web,api,worker',
    '--authentication=development',
    '--workerTransport=postgres',
    '--telemetry=false',
    '--deploymentProfile=containers',
    '--ai=true',
  ];
}

async function generatedFingerprint(workspace) {
  const files = [
    'workspace.template.json',
    'apps/api/package.json',
    'apps/api/tsconfig.app.json',
    'apps/api/src/app/ai/reference-workflow.ts',
    'apps/api/src/app/ai/reference-workflow.spec.ts',
    'apps/api/src/app/ai/README.md',
    'pnpm-lock.yaml',
    ...materializedCapabilityRoots.map((root) => `${root}/package.json`),
  ];
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file);
    hash.update('\0');
    hash.update(await readFile(path.join(workspace, file)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

async function assertAiContract(workspace, expectedVersion) {
  const manifest = await readJson(path.join(workspace, 'workspace.template.json'));
  const apiPackage = await readJson(path.join(workspace, 'apps/api/package.json'));
  const lockfile = await readFile(path.join(workspace, 'pnpm-lock.yaml'), 'utf-8');
  const reference = await readFile(
    path.join(workspace, 'apps/api/src/app/ai/reference-workflow.ts'),
    'utf-8',
  );

  assert.equal(manifest.upstream.version, expectedVersion);
  assert.equal(manifest.profiles.ai, true);
  for (const [suffix, root] of aiCapabilities) {
    assert.equal(apiPackage.dependencies[`@generated-ai/${suffix}`], 'workspace:*');
    assert.match(lockfile, new RegExp(`'@generated-ai/${suffix}':`));
    if (suffix === 'backend-agent-durable') continue;
    const capabilityPackage = await readJson(path.join(workspace, root, 'package.json'));
    assert.equal(capabilityPackage.name, `@generated-ai/${suffix}`);
    assert.equal(capabilityPackage.private, true);
    assert.match(lockfile, new RegExp(`\\n  ${root}: \\{\\}\\n`));
  }

  assert.match(reference, /runReferenceAiWorkflow/);
  assert.match(reference, /selectFallbackModelRoute/);
  assert.match(reference, /evaluateToolAllowlist/);
  assert.match(reference, /authorizeApprovalDecision/);
  assert.match(reference, /runEvaluationCase/);
  assert.match(reference, /runWithCorrelationContext/);
  assert.match(reference, /pauseForApproval/);
  assert.match(reference, /invokeTool/);
}

async function assertProjectGraph(workspace) {
  const outputDirectory = path.join(workspace, 'test-output');
  const output = path.join(outputDirectory, 'ai-project-graph.json');
  await mkdir(outputDirectory, { recursive: true });
  execute('pnpm', ['exec', 'nx', 'graph', `--file=${output}`], workspace);
  const parsed = await readJson(output);
  const graph = parsed.graph?.nodes ? parsed.graph : parsed;
  const dependencies = new Set(
    (graph.dependencies?.api ?? []).map((dependency) => dependency.target),
  );
  for (const project of [
    'backend-agent-durable',
    'backend-agent-eval',
    'backend-agent-governance',
    'backend-agent-tool',
    'backend-model',
  ]) {
    assert.equal(dependencies.has(project), true, `API graph is missing ${project}.`);
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const artifact = options.artifact ? path.resolve(options.artifact) : null;
  const expectedVersion = options['expected-version'];
  const workspace = options.workspace ? path.resolve(options.workspace) : null;
  if (!artifact || !expectedVersion || !workspace) {
    throw new Error('--artifact, --expected-version, and --workspace are required.');
  }
  await stat(artifact);

  const sourceRoot = process.cwd();
  const initialSourceState = execute(
    'git',
    ['status', '--porcelain=v1', '--untracked-files=all'],
    sourceRoot,
    { capture: true },
  );
  await rm(workspace, { force: true, recursive: true });
  await mkdir(workspace, { recursive: true });
  await cp(sourceRoot, workspace, {
    dereference: false,
    filter: (source) => shouldCopy(sourceRoot, source),
    recursive: true,
  });

  execute(
    'pnpm',
    ['install', '--offline', '--frozen-lockfile', '--ignore-scripts'],
    workspace,
  );
  await installReleasedPlugin(workspace, artifact, expectedVersion);
  execute('pnpm', generatorArguments(), workspace);
  const firstFingerprint = await generatedFingerprint(workspace);
  execute('pnpm', generatorArguments(), workspace);
  assert.equal(
    await generatedFingerprint(workspace),
    firstFingerprint,
    'Repeated AI preset generation must be byte-for-byte deterministic.',
  );
  execute(
    'pnpm',
    ['install', '--offline', '--frozen-lockfile', '--ignore-scripts'],
    workspace,
  );
  await assertAiContract(workspace, expectedVersion);

  execute('git', ['init', '-b', 'main'], workspace);
  execute('git', ['config', 'user.email', 'generated-ai-ci@example.invalid'], workspace);
  execute('git', ['config', 'user.name', 'Generated AI Workspace CI'], workspace);
  execute('git', ['add', '--all'], workspace);
  execute('git', ['commit', '-m', 'Generated AI workspace baseline'], workspace);

  execute('pnpm', ['check'], workspace, {
    env: { NEXT_PUBLIC_AUTHENTICATION_PROFILE: 'none' },
  });
  execute('pnpm', ['template:identity:check'], workspace);
  await assertProjectGraph(workspace);
  assert.equal(
    execute(
      'git',
      ['status', '--porcelain=v1', '--untracked-files=all'],
      workspace,
      { capture: true },
    ),
    '',
    'Generated AI workspace validation changed tracked content.',
  );
  assert.equal(
    execute(
      'git',
      ['status', '--porcelain=v1', '--untracked-files=all'],
      sourceRoot,
      { capture: true },
    ),
    initialSourceState,
    'Generated AI workspace validation changed the source checkout.',
  );

  console.log(
    `Generated AI workspace ${workspace} passed deterministic generation, frozen install, repository validation, Nx graph, identity, and cleanliness checks.`,
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
