import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { validateHostDiscovery } from './verify-host-discovery.mjs';

const canonicalRoot = '.agents/skills';

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'steadystack-hosts-'));
  await mkdir(path.join(root, canonicalRoot), { recursive: true });
  for (const name of ['architecture-discovery', 'validation-debugging']) {
    const directory = path.join(root, canonicalRoot, name);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'SKILL.md'), `# ${name}\n`);
  }
  await writeFile(
    path.join(root, canonicalRoot, 'provenance.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        skills: [
          { name: 'architecture-discovery' },
          { name: 'validation-debugging' },
        ],
      },
      null,
      2,
    )}\n`,
  );
  await mkdir(path.join(root, 'tools', 'agent-skills'), { recursive: true });
  await writeContract(root, [
    host('github-copilot', 'GitHub', 'a'.repeat(40)),
    host('openai-codex', 'OpenAI', 'b'.repeat(40)),
  ]);
  return root;
}

function host(id, maintainer, ref, projectSkillRoot = canonicalRoot) {
  return {
    id,
    maintainer,
    projectSkillRoot,
    evidence: {
      repository: `${maintainer.toLowerCase()}/docs`,
      ref,
      path: 'docs/skills.md',
    },
  };
}

async function writeContract(root, hosts) {
  await writeFile(
    path.join(root, 'tools', 'agent-skills', 'host-discovery.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        canonicalProjectRoot: canonicalRoot,
        hosts,
      },
      null,
      2,
    )}\n`,
  );
}

async function withFixture(fn) {
  const root = await createFixture();
  try {
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('accepts the same canonical skill set for two maintained hosts', async () => {
  await withFixture(async (root) => {
    assert.deepEqual(await validateHostDiscovery(root), []);
  });
});

test('requires at least two maintained hosts', async () => {
  await withFixture(async (root) => {
    await writeContract(root, [host('openai-codex', 'OpenAI', 'a'.repeat(40))]);
    const failures = await validateHostDiscovery(root);
    assert(
      failures.some((failure) =>
        failure.includes('at least two maintained hosts are required'),
      ),
    );
  });
});

test('rejects vendor-specific project skill roots', async () => {
  await withFixture(async (root) => {
    await writeContract(root, [
      host('github-copilot', 'GitHub', 'a'.repeat(40)),
      host('openai-codex', 'OpenAI', 'b'.repeat(40), '.codex/skills'),
    ]);
    const failures = await validateHostDiscovery(root);
    assert(
      failures.some(
        (failure) =>
          failure.includes('openai-codex') &&
          failure.includes('projectSkillRoot must use the canonical'),
      ),
    );
  });
});

test('detects canonical skill and provenance drift', async () => {
  await withFixture(async (root) => {
    await mkdir(path.join(root, canonicalRoot, 'release-evidence'), {
      recursive: true,
    });
    await writeFile(
      path.join(root, canonicalRoot, 'release-evidence', 'SKILL.md'),
      '# release-evidence\n',
    );
    const failures = await validateHostDiscovery(root);
    assert(
      failures.some((failure) =>
        failure.includes('must exactly match provenance'),
      ),
    );
  });
});
