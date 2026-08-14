import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UPSTREAM_PACKAGE_NAME = '@steadystack/source';

const ROOT_REPOSITORY_MARKDOWN = new Map([
  ['AGENTS.md', 'agent-control'],
  ['CHANGELOG.md', 'release-evidence'],
  ['CONTRIBUTING.md', 'governance'],
  ['SECURITY.md', 'governance'],
  ['THIRD_PARTY_NOTICES.md', 'legal-notices'],
]);

const TOP_LEVEL_DOCS = new Map([
  ['docs/AUTOMATION_WORKFLOW.md', 'automation-control'],
  ['docs/TODO.md', 'roadmap-control'],
  ['docs/agent-safety-and-governance.md', 'governance-contract'],
  ['docs/agent-skills.md', 'agent-contract'],
  ['docs/agentic-development.md', 'agent-workflow'],
  ['docs/api-contracts.md', 'implementation-contract'],
  ['docs/browser-authentication.md', 'implementation-contract'],
  ['docs/database-operations.md', 'executable-runbook'],
  ['docs/documentation-integrity.md', 'validation-contract'],
  ['docs/durable-agent-execution.md', 'implementation-contract'],
  ['docs/generated-project-checklist.md', 'governance-checklist'],
  ['docs/model-interfaces.md', 'implementation-contract'],
  ['docs/oidc-authentication.md', 'implementation-contract'],
  ['docs/production-readiness.md', 'validation-contract'],
  ['docs/prompt-evaluation-lifecycle.md', 'governance-contract'],
  ['docs/rate-limiting.md', 'implementation-contract'],
  ['docs/reference-feature-agent-tasks.md', 'implementation-contract'],
  ['docs/runtime-support.md', 'compatibility-contract'],
  ['docs/steadystack-migration.md', 'historical-maintainer-record'],
  ['docs/template-initialization.md', 'generator-contract'],
  ['docs/template-releases.md', 'release-contract'],
  ['docs/template-upgrades.md', 'upgrade-contract'],
  ['docs/template-validation.md', 'validation-contract'],
  ['docs/typed-tools-and-streaming.md', 'implementation-contract'],
  ['docs/wiki-publication.md', 'publication-runbook'],
  ['docs/worker-operations.md', 'executable-runbook'],
  ['docs/worker-retry-and-dead-letter.md', 'implementation-contract'],
]);

const REPOSITORY_DOC_PREFIXES = new Map([
  ['docs/adr/', 'architecture-decision'],
  ['docs/architecture/', 'generated-evidence'],
  ['docs/ci/', 'ci-evidence'],
  ['docs/delivery/', 'release-control'],
  ['docs/evaluations/', 'evaluation-evidence'],
  ['docs/operations/', 'executable-runbook'],
  ['docs/runbooks/', 'executable-runbook'],
  ['docs/security/', 'security-control'],
]);

const HUMAN_MIGRATIONS = new Map([
  ['docs/getting-started.md', 'wiki/Quick-Start.md'],
]);

const REQUIRED_WIKI_PAGES = [
  'wiki/Home.md',
  'wiki/Quick-Start.md',
  'wiki/_Sidebar.md',
];

const README_ALLOWED_HEADINGS = new Set([
  'Start here',
  'Repository control surfaces',
  'Create a workspace',
  'Repository status',
]);

const README_REQUIRED_SNIPPETS = [
  'https://github.com/kaleigh-dem/steady-stack/wiki',
  '`AGENTS.md`',
  '`.agents/skills`',
  '`docs/TODO.md`',
  '`docs/adr/`',
  '`docs/documentation-integrity.md`',
];

function normalizePath(value) {
  return value.replaceAll('\\', '/').replace(/^\.\//, '');
}

function isRootMarkdown(file) {
  return /^[^/]+\.md$/.test(file);
}

export function shouldAuditDocumentationSurfaces(packageJson) {
  return packageJson.name === UPSTREAM_PACKAGE_NAME;
}

export function classifyDocumentationSurface(rawFile) {
  const file = normalizePath(rawFile);
  if (!file.endsWith('.md')) return null;

  if (file.startsWith('wiki/')) {
    return {
      audience: 'human',
      authority: 'primary-human',
      reason: 'published-wiki-source',
    };
  }

  if (file === 'README.md') {
    return {
      audience: 'human',
      authority: 'landing-exception',
      reason: 'repository-site-routing',
    };
  }

  const rootReason = ROOT_REPOSITORY_MARKDOWN.get(file);
  if (rootReason) {
    return {
      audience: 'agent-machine-review',
      authority: 'repository-control',
      reason: rootReason,
    };
  }

  const topLevelReason = TOP_LEVEL_DOCS.get(file);
  if (topLevelReason) {
    return {
      audience: 'agent-machine-review',
      authority: 'repository-control',
      reason: topLevelReason,
    };
  }

  for (const [prefix, reason] of REPOSITORY_DOC_PREFIXES) {
    if (file.startsWith(prefix)) {
      return {
        audience: 'agent-machine-review',
        authority: 'repository-control',
        reason,
      };
    }
  }

  return null;
}

export function auditReadmeLanding(markdown) {
  const failures = [];
  for (const match of markdown.matchAll(/^##\s+(.+)$/gm)) {
    const heading = match[1].trim();
    if (!README_ALLOWED_HEADINGS.has(heading)) {
      failures.push(
        `README.md: non-landing section must move to the Wiki: ${heading}`,
      );
    }
  }

  for (const snippet of README_REQUIRED_SNIPPETS) {
    if (!markdown.includes(snippet)) {
      failures.push(
        `README.md: missing landing-page route/control reference: ${snippet}`,
      );
    }
  }
  return failures;
}

export function auditDocumentationSurfaces(files) {
  const failures = [];
  const markdownFiles = [...files.keys()]
    .map(normalizePath)
    .filter((file) => file.endsWith('.md'))
    .filter(
      (file) =>
        isRootMarkdown(file) ||
        file.startsWith('docs/') ||
        file.startsWith('wiki/'),
    );

  for (const file of markdownFiles) {
    const migratedTo = HUMAN_MIGRATIONS.get(file);
    if (migratedTo) {
      failures.push(
        `${file}: human-facing duplicate must remain migrated to ${migratedTo}`,
      );
      continue;
    }

    if (!classifyDocumentationSurface(file)) {
      failures.push(
        `${file}: documentation surface is unclassified; declare a repository-control reason or publish it under wiki/`,
      );
    }
  }

  for (const required of REQUIRED_WIKI_PAGES) {
    if (!files.has(required)) {
      failures.push(
        `${required}: required primary human-facing Wiki source is missing`,
      );
    }
  }

  const readme = files.get('README.md')?.content;
  if (!readme) {
    failures.push('README.md: required human landing page is missing');
  } else {
    failures.push(...auditReadmeLanding(readme));
  }

  const wikiHome = files.get('wiki/Home.md')?.content;
  if (wikiHome && !wikiHome.includes('primary human-facing documentation')) {
    failures.push(
      'wiki/Home.md: must identify the Wiki as the primary human-facing documentation surface',
    );
  }

  return [...new Set(failures)].sort();
}

function git(root, args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

async function loadTrackedMarkdown(root) {
  const tracked = git(root, ['ls-files', '-z'])
    .split('\0')
    .filter(Boolean)
    .map(normalizePath)
    .filter((file) => file.endsWith('.md'))
    .filter(
      (file) =>
        isRootMarkdown(file) ||
        file.startsWith('docs/') ||
        file.startsWith('wiki/'),
    );

  const files = new Map();
  for (const file of tracked) {
    files.set(file, { content: await readFile(path.join(root, file), 'utf8') });
  }
  return files;
}

export async function checkDocumentationSurfaces(root) {
  const packageJson = JSON.parse(
    await readFile(path.join(root, 'package.json'), 'utf8'),
  );
  if (!shouldAuditDocumentationSurfaces(packageJson)) {
    process.stdout.write(
      'Skipping upstream documentation-surface ownership audit in an initialized downstream workspace.\n',
    );
    return [];
  }

  return auditDocumentationSurfaces(await loadTrackedMarkdown(root));
}

async function main() {
  const root = path.resolve(process.argv[2] ?? '.');
  const failures = await checkDocumentationSurfaces(root);
  if (failures.length === 0) {
    process.stdout.write('Documentation surface ownership checks passed.\n');
    return;
  }

  for (const failure of failures) process.stderr.write(`- ${failure}\n`);
  process.exitCode = 1;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
