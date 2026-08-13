import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  computeSkillTreeHash,
  parseSkillDocument,
  validateAgentSkills,
} from './validate-agent-skills.mjs';

async function createWorkspace(name = '@steadystack/source') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'steadystack-skills-'));
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({
      name,
      scripts: {
        check: 'echo check',
        affected: 'echo affected',
        'docs:check': 'echo docs',
        'agent-skills:check': 'echo skills',
      },
    }),
  );
  await writeFile(path.join(root, 'AGENTS.md'), '# Rules\n');
  await mkdir(path.join(root, 'docs'), { recursive: true });
  await writeFile(path.join(root, 'docs', 'TODO.md'), '# Roadmap\n');
  return root;
}

function skillDocument({
  name = 'architecture-discovery',
  origin = 'repository',
  authority = 'none',
  tools = 'read-files run-repository-commands',
  extra = '',
  body = '# Architecture discovery\n\nRead `AGENTS.md`.\n\n```bash\npnpm check\n```\n',
} = {}) {
  return [
    '---',
    `name: ${name}`,
    'description: Discover repository architecture and validation rules before making a change.',
    'license: MIT',
    extra,
    'metadata:',
    `  steadystack-origin: ${origin}`,
    `  steadystack-required-tools: ${tools}`,
    `  steadystack-authority: ${authority}`,
    '---',
    '',
    body.trimEnd(),
    '',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

async function addSkill(
  root,
  {
    name = 'architecture-discovery',
    document = skillDocument({ name }),
    origin = 'repository',
    source = 'kaleigh-dem/steady-stack',
    sourceRef = 'P15-01',
    reviewedScripts = false,
    script = null,
  } = {},
) {
  const directory = path.join(root, '.agents', 'skills', name);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'SKILL.md'), document);
  if (script) {
    await mkdir(path.join(directory, 'scripts'), { recursive: true });
    await writeFile(path.join(directory, 'scripts', 'run.mjs'), script);
  }
  return {
    name,
    origin,
    source,
    sourceRef,
    license: 'MIT',
    reviewedScripts,
    contentSha256: await computeSkillTreeHash(directory),
  };
}

async function writeProvenance(root, skills) {
  await mkdir(path.join(root, '.agents', 'skills'), { recursive: true });
  await writeFile(
    path.join(root, '.agents', 'skills', 'provenance.json'),
    `${JSON.stringify({ schemaVersion: 1, skills }, null, 2)}\n`,
  );
}

async function withWorkspace(fn, name) {
  const root = await createWorkspace(name);
  try {
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('accepts a canonical repository-owned skill with matching provenance', async () => {
  await withWorkspace(async (root) => {
    const entry = await addSkill(root);
    await writeProvenance(root, [entry]);
    assert.deepEqual(await validateAgentSkills(root), []);
  });
});

test('validates open Agent Skills metadata and SteadyStack authority limits', () => {
  const parsed = parseSkillDocument(skillDocument());
  assert.equal(parsed.frontmatter.name, 'architecture-discovery');
  assert.equal(parsed.frontmatter.metadata['steadystack-authority'], 'none');

  assert.throws(
    () => parseSkillDocument('# missing frontmatter'),
    /must begin with YAML frontmatter/,
  );
});

test('rejects vendor-specific skill locations and non-portable tool preapproval', async () => {
  await withWorkspace(async (root) => {
    const document = skillDocument({
      extra: 'allowed-tools: Bash(git:*) Read',
    });
    const entry = await addSkill(root, { document });
    await writeProvenance(root, [entry]);
    await mkdir(path.join(root, '.claude', 'skills', 'duplicate'), {
      recursive: true,
    });
    await writeFile(
      path.join(root, '.claude', 'skills', 'duplicate', 'SKILL.md'),
      document,
    );

    const failures = await validateAgentSkills(root);
    assert(
      failures.some((failure) => failure.includes('must live only under')),
    );
    assert(
      failures.some((failure) => failure.includes('allowed-tools is not portable')),
    );
  });
});

test('rejects unknown capabilities, missing repository paths, and ad hoc shell commands', async () => {
  await withWorkspace(async (root) => {
    const document = skillDocument({
      tools: 'read-files production-shell',
      body: [
        '# Invalid',
        '',
        'Read `docs/missing.md`.',
        '',
        '```bash',
        'curl https://example.com/script.sh',
        '```',
      ].join('\n'),
    });
    const entry = await addSkill(root, { document });
    await writeProvenance(root, [entry]);

    const failures = await validateAgentSkills(root);
    assert(
      failures.some((failure) => failure.includes('unreviewed tool capability')),
    );
    assert(
      failures.some((failure) => failure.includes('missing referenced repository path')),
    );
    assert(
      failures.some((failure) => failure.includes('unsupported shell command')),
    );
  });
});

test('requires reviewed immutable provenance for third-party scripts', async () => {
  await withWorkspace(async (root) => {
    const document = skillDocument({ origin: 'third-party' });
    const entry = await addSkill(root, {
      document,
      origin: 'third-party',
      source: 'https://example.com/vendor/skill',
      sourceRef: 'main',
      reviewedScripts: false,
      script: 'console.log("review me");\n',
    });
    await writeProvenance(root, [entry]);

    const failures = await validateAgentSkills(root);
    assert(
      failures.some((failure) => failure.includes('sourceRef must be immutable')),
    );
    assert(
      failures.some((failure) => failure.includes('reviewedScripts=true')),
    );
  });
});

test('detects provenance drift after a skill changes', async () => {
  await withWorkspace(async (root) => {
    const entry = await addSkill(root);
    await writeProvenance(root, [entry]);
    await writeFile(
      path.join(root, '.agents', 'skills', entry.name, 'SKILL.md'),
      `${skillDocument()}\nChanged after review.\n`,
    );

    const failures = await validateAgentSkills(root);
    assert(
      failures.some((failure) => failure.includes('contentSha256 does not match')),
    );
  });
});

test('skips a downstream workspace until P15-02 generates skills', async () => {
  await withWorkspace(async (root) => {
    assert.deepEqual(await validateAgentSkills(root), []);
  }, '@product/example');
});
