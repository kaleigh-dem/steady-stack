import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UPSTREAM_PACKAGE_NAME = '@steadystack/source';
const RETIRED_ROADMAP_PATH = 'docs/TODO.md';
const INERT_GENERATED_REFERENCE_PATH =
  'tools/workspace-plugin/src/generators/init/generator.ts';

const HISTORICAL_PATHS = new Set([
  'CHANGELOG.md',
  'docs/steadystack-migration.md',
]);

const HISTORICAL_PREFIXES = ['docs/adr/', 'docs/evaluations/evidence/'];

const SELF_REFERENCE_PATHS = new Set([
  'docs/documentation-integrity.md',
  'tools/documentation/documentation-surfaces.spec.mjs',
  'tools/documentation/task-management-control-plane.mjs',
  'tools/documentation/task-management-control-plane.spec.mjs',
  'tools/template/generated-workspace-e2e.mjs',
]);

const ACTIVE_TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);

const FORBIDDEN_DISCOVERY_PATTERNS = [
  {
    pattern: /\b(?:first|next)\s+(?:eligible\s+)?unchecked\s+(?:todo|task)\b/i,
    message: 'selects work from an unchecked Markdown task list',
  },
  {
    pattern: /\bnext\s+eligible\s+todo\b/i,
    message: 'discovers the next task from the retired TODO model',
  },
  {
    pattern: /(?<!not )(?<!never )\b(?:read|scan|inspect|walk)\b[^\n.]{0,120}\b(?:markdown|todo|roadmap)\b[^\n.]{0,120}\b(?:choose|discover|find|select|start)\b[^\n.]{0,80}\b(?:task|work)\b/i,
    message: 'discovers actionable work from a Markdown roadmap',
  },
  {
    pattern: /\bTASK:\s*P\d{2}-\d{2}\b/,
    message: 'requires a historical roadmap ID as reviewer task identity',
  },
  {
    pattern: /\bstable\s+TODO\s+task\s+ID\b/i,
    message: 'requires the retired TODO task-ID model',
  },
];

function normalizePath(value) {
  return value.replaceAll('\\', '/').replace(/^\.\//, '');
}

function isHistoricalPath(file) {
  return (
    HISTORICAL_PATHS.has(file) ||
    HISTORICAL_PREFIXES.some((prefix) => file.startsWith(prefix))
  );
}

function shouldScanActiveText(file) {
  return ACTIVE_TEXT_EXTENSIONS.has(path.posix.extname(file));
}

function stripKnownInertGeneratedReference(file, content) {
  if (file !== INERT_GENERATED_REFERENCE_PATH) return content;

  return content.replace(/^\s*`\/docs\/TODO\.md \$\{owners\}`,\s*$/gm, '');
}

export function shouldAuditTaskControlPlane(packageJson) {
  return packageJson.name === UPSTREAM_PACKAGE_NAME;
}

export function auditTaskControlPlane(files) {
  const failures = [];

  if (files.has(RETIRED_ROADMAP_PATH)) {
    failures.push(
      `${RETIRED_ROADMAP_PATH}: retired Markdown task control plane must not exist`,
    );
  }

  for (const [rawFile, entry] of files) {
    const file = normalizePath(rawFile);
    if (
      isHistoricalPath(file) ||
      SELF_REFERENCE_PATHS.has(file) ||
      !shouldScanActiveText(file)
    ) {
      continue;
    }

    const content = stripKnownInertGeneratedReference(
      file,
      entry.content ?? '',
    );
    if (content.includes(RETIRED_ROADMAP_PATH)) {
      failures.push(
        `${file}: active control/documentation surface references the retired Markdown roadmap`,
      );
    }

    for (const { pattern, message } of FORBIDDEN_DISCOVERY_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        failures.push(`${file}: ${message}`);
      }
    }
  }

  const agents = files.get('AGENTS.md')?.content ?? '';
  if (agents) {
    if (!/open GitHub Issue/i.test(agents)) {
      failures.push(
        'AGENTS.md: must identify an open GitHub Issue as the actionable-work source',
      );
    }
    if (!/explicitly assigned or explicitly selected/i.test(agents)) {
      failures.push(
        'AGENTS.md: must require explicit Issue assignment or selection before agent work',
      );
    }
    if (!/must (?:stop|remain idle)/i.test(agents)) {
      failures.push(
        'AGENTS.md: must forbid autonomous work discovery when no Issue is selected',
      );
    }
  }

  const automation = files.get('docs/AUTOMATION_WORKFLOW.md')?.content ?? '';
  if (automation) {
    if (!/TASK:\s*#\d+/i.test(automation)) {
      failures.push(
        'docs/AUTOMATION_WORKFLOW.md: reviewer handoff examples must use GitHub Issue task identity',
      );
    }
    if (
      !/exact[- ]head/i.test(automation) ||
      !/fail(?:s|ed)? closed/i.test(automation)
    ) {
      failures.push(
        'docs/AUTOMATION_WORKFLOW.md: exact-head and fail-closed reviewer semantics must remain explicit',
      );
    }
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

async function loadTrackedText(root) {
  const tracked = git(root, ['ls-files', '-z'])
    .split('\0')
    .filter(Boolean)
    .map(normalizePath);

  const files = new Map();
  for (const file of tracked) {
    try {
      const content = await readFile(path.join(root, file), 'utf8');
      if (!content.includes('\0')) files.set(file, { content });
    } catch {
      // Binary and unreadable tracked files do not participate in this audit.
    }
  }
  return files;
}

export async function checkTaskControlPlane(root) {
  const packageJson = JSON.parse(
    await readFile(path.join(root, 'package.json'), 'utf8'),
  );
  if (!shouldAuditTaskControlPlane(packageJson)) {
    process.stdout.write(
      'Skipping upstream task-control-plane audit in an initialized downstream workspace.\n',
    );
    return [];
  }

  return auditTaskControlPlane(await loadTrackedText(root));
}

async function main() {
  const root = path.resolve(process.argv[2] ?? '.');
  const failures = await checkTaskControlPlane(root);
  if (failures.length === 0) {
    process.stdout.write('Task management control-plane checks passed.\n');
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
