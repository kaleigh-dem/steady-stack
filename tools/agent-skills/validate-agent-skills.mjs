import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UPSTREAM_PACKAGE_NAME = '@steadystack/source';
const SKILLS_ROOT = '.agents/skills';
const PROVENANCE_PATH = `${SKILLS_ROOT}/provenance.json`;
const SKILL_NAME_PATTERN = /^(?!-)(?!.*--)[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTENT_HASH_PATTERN = /^[a-f0-9]{64}$/;
const SPEC_FIELDS = new Set([
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
]);
const REQUIRED_METADATA = [
  'steadystack-origin',
  'steadystack-required-tools',
  'steadystack-authority',
];
const ALLOWED_TOOL_CAPABILITIES = new Set([
  'read-files',
  'write-files',
  'run-repository-commands',
  'read-git-history',
  'read-github',
  'write-github-review-artifacts',
  'local-containers',
]);
const MOVING_SOURCE_REFS = new Set([
  'head',
  'latest',
  'main',
  'master',
  'trunk',
]);
const SKIP_SCAN_DIRECTORIES = new Set([
  '.git',
  '.next',
  '.nx',
  '.cache',
  'coverage',
  'dist',
  'node_modules',
  'test-output',
]);
const NX_BUILT_INS = new Set([
  'affected',
  'daemon',
  'exec',
  'format',
  'format:check',
  'format:write',
  'g',
  'generate',
  'graph',
  'mcp',
  'repair',
  'reset',
  'run',
  'run-many',
  'show',
  'sync',
  'sync:check',
]);
const SHELL_CONTROL_TOKENS = ['&&', '||', '$(', '|', ';', '&', '`'];
const REPOSITORY_PATH_PREFIXES = [
  '.agents/',
  '.github/',
  'apps/',
  'docs/',
  'infra/',
  'packages/',
  'performance/',
  'tools/',
  'wiki/',
];
const REPOSITORY_ROOT_FILES = new Set([
  '.env.example',
  '.mcp.json',
  '.node-version',
  'AGENTS.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'README.md',
  'SECURITY.md',
  'compose.yaml',
  'eslint.config.mjs',
  'nx.json',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.base.json',
  'tsconfig.json',
  'vitest.config.ts',
]);

function normalizePath(value) {
  return value.replaceAll('\\', '/').replace(/^\.\//, '');
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseSkillDocument(content, location = 'SKILL.md') {
  const lines = content.replaceAll('\r\n', '\n').split('\n');
  if (lines[0] !== '---') {
    throw new Error(`${location}: SKILL.md must begin with YAML frontmatter`);
  }
  const closing = lines.indexOf('---', 1);
  if (closing < 0) {
    throw new Error(`${location}: SKILL.md frontmatter is not closed`);
  }

  const frontmatter = { metadata: {} };
  let section = null;
  for (let index = 1; index < closing; index += 1) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith('#')) continue;

    const nested = line.match(/^  ([a-zA-Z0-9_.-]+):\s*(.*)$/);
    if (nested) {
      if (section !== 'metadata') {
        throw new Error(
          `${location}: nested frontmatter is only supported under metadata`,
        );
      }
      const [, key, rawValue] = nested;
      if (!rawValue.trim()) {
        throw new Error(`${location}: metadata.${key} must be a scalar value`);
      }
      if (Object.hasOwn(frontmatter.metadata, key)) {
        throw new Error(`${location}: duplicate metadata key ${key}`);
      }
      frontmatter.metadata[key] = parseScalar(rawValue);
      continue;
    }

    if (/^\s/.test(line)) {
      throw new Error(`${location}: unsupported YAML indentation`);
    }

    const field = line.match(/^([a-zA-Z0-9-]+):\s*(.*)$/);
    if (!field) {
      throw new Error(`${location}: unsupported YAML frontmatter line`);
    }
    const [, key, rawValue] = field;
    if (Object.hasOwn(frontmatter, key) && key !== 'metadata') {
      throw new Error(`${location}: duplicate frontmatter field ${key}`);
    }
    if (key === 'metadata') {
      if (rawValue.trim()) {
        throw new Error(`${location}: metadata must be a YAML mapping`);
      }
      section = 'metadata';
      continue;
    }
    if (!rawValue.trim()) {
      throw new Error(`${location}: ${key} must be a scalar value`);
    }
    frontmatter[key] = parseScalar(rawValue);
    section = null;
  }

  return {
    frontmatter,
    body: lines
      .slice(closing + 1)
      .join('\n')
      .trim(),
  };
}

function validateFrontmatter(skillName, document, location) {
  const failures = [];
  const { frontmatter, body } = document;

  for (const key of Object.keys(frontmatter)) {
    if (key === 'metadata') continue;
    if (!SPEC_FIELDS.has(key)) {
      failures.push(`${location}: unknown Agent Skills field: ${key}`);
    }
  }

  if (!frontmatter.name) failures.push(`${location}: missing required name`);
  if (!frontmatter.description) {
    failures.push(`${location}: missing required description`);
  }
  if (!frontmatter.license) {
    failures.push(
      `${location}: license is required by the SteadyStack skill contract`,
    );
  }

  if (frontmatter.name) {
    if (frontmatter.name !== skillName) {
      failures.push(
        `${location}: name must match parent directory ${skillName}`,
      );
    }
    if (
      frontmatter.name.length > 64 ||
      !SKILL_NAME_PATTERN.test(frontmatter.name)
    ) {
      failures.push(`${location}: invalid Agent Skills name`);
    }
  }
  if (
    frontmatter.description &&
    (frontmatter.description.length < 1 ||
      frontmatter.description.length > 1024)
  ) {
    failures.push(`${location}: description must be 1-1024 characters`);
  }
  if (
    frontmatter.compatibility &&
    (frontmatter.compatibility.length < 1 ||
      frontmatter.compatibility.length > 500)
  ) {
    failures.push(`${location}: compatibility must be 1-500 characters`);
  }

  if (frontmatter['allowed-tools']) {
    failures.push(
      `${location}: experimental allowed-tools is not portable enough for the SteadyStack contract; declare conceptual capabilities in metadata.steadystack-required-tools`,
    );
  }

  for (const key of REQUIRED_METADATA) {
    if (!frontmatter.metadata?.[key]) {
      failures.push(`${location}: missing metadata.${key}`);
    }
  }

  const origin = frontmatter.metadata?.['steadystack-origin'];
  if (origin && !['repository', 'third-party'].includes(origin)) {
    failures.push(
      `${location}: metadata.steadystack-origin must be repository or third-party`,
    );
  }

  const authority = frontmatter.metadata?.['steadystack-authority'];
  if (authority && authority !== 'none') {
    failures.push(`${location}: metadata.steadystack-authority must be none`);
  }

  const tools = frontmatter.metadata?.['steadystack-required-tools'];
  if (tools) {
    const capabilities = tools.split(/\s+/).filter(Boolean);
    if (new Set(capabilities).size !== capabilities.length) {
      failures.push(
        `${location}: metadata.steadystack-required-tools contains duplicates`,
      );
    }
    for (const capability of capabilities) {
      if (!ALLOWED_TOOL_CAPABILITIES.has(capability)) {
        failures.push(`${location}: unreviewed tool capability: ${capability}`);
      }
    }
  }

  if (!body) failures.push(`${location}: skill instructions must not be empty`);
  if (body.split('\n').length > 500) {
    failures.push(
      `${location}: skill body exceeds the 500-line progressive-disclosure limit`,
    );
  }

  return failures;
}

function stripMarkdownDestination(value) {
  let destination = value.trim();
  if (destination.startsWith('<') && destination.endsWith('>')) {
    destination = destination.slice(1, -1);
  }
  const titleMatch = destination.match(/^(\S+)(?:\s+["'(].*)$/);
  return titleMatch ? titleMatch[1] : destination;
}

function isExternalDestination(destination) {
  return (
    destination.startsWith('#') ||
    destination.startsWith('//') ||
    /^[a-z][a-z0-9+.-]*:/i.test(destination)
  );
}

function extractMarkdownLinks(markdown) {
  return [...markdown.matchAll(/(?<!!)\[[^\]]*\]\(([^)]+)\)/g)].map(
    (match) => match[1],
  );
}

function extractFencedBlocks(markdown) {
  const blocks = [];
  for (const match of markdown.matchAll(/^```([^\n]*)\n([\s\S]*?)^```\s*$/gm)) {
    blocks.push({
      language: match[1].trim().toLowerCase(),
      content: match[2],
    });
  }
  return blocks;
}

function commandLines(content) {
  const commands = [];
  let current = '';
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    current = current ? `${current} ${line}` : line;
    if (current.endsWith('\\')) {
      current = current.slice(0, -1).trimEnd();
    } else {
      commands.push(current.replace(/^\$\s*/, ''));
      current = '';
    }
  }
  if (current) commands.push(current);
  return commands;
}

function shellWords(command) {
  return command.split(/\s+/).map((word) => word.replace(/^['"]|['";,]$/g, ''));
}

function validateShellCommandShape(command) {
  for (const token of SHELL_CONTROL_TOKENS) {
    if (command.includes(token)) {
      return [`shell control token is not allowed: ${token}`];
    }
  }
  return [];
}

function validatePnpmCommand(command, packageJson) {
  const words = shellWords(command);
  let index = 1;
  while (words[index]?.startsWith('-')) index += 1;
  if (words[index] === 'run') index += 1;
  const action = words[index];
  if (!action) return ['pnpm command is missing an action'];

  if (action === 'nx') {
    const nxAction = words[index + 1];
    if (!nxAction || !NX_BUILT_INS.has(nxAction)) {
      return [`unknown Nx command: ${nxAction ?? '(missing)'}`];
    }
    return [];
  }

  if (!packageJson.scripts?.[action] && !/[<$[{]/.test(action)) {
    return [`unknown root package script: ${action}`];
  }
  if (!packageJson.scripts?.[action]) {
    return [`root package script must be a literal reviewed name: ${action}`];
  }
  return [];
}

function validateNodeCommand(command, root) {
  const words = shellWords(command);
  const script = words.slice(1).find((word) => !word.startsWith('-'));
  if (!script || script === '-' || script === '-e') {
    return ['node command must use a tracked script entry point'];
  }
  if (/[<$[{]/.test(script)) {
    return [`node script must be a literal tracked path: ${script}`];
  }
  const normalized = normalizePath(script.replace(/["';]$/g, ''));
  if (!/\.(?:c?js|mjs|ts)$/.test(normalized)) {
    return [`unsupported Node entry point: ${normalized}`];
  }
  return existsSync(path.join(root, normalized))
    ? []
    : [`missing Node script: ${normalized}`];
}

function looksLikeRepositoryPath(value) {
  const candidate = value
    .split('#', 1)[0]
    .split('?', 1)[0]
    .replace(/[.,;:]$/, '');
  if (candidate.includes('://')) return false;
  if (/[<>{}*]/.test(candidate) || /\s/.test(candidate)) return false;
  if (REPOSITORY_ROOT_FILES.has(candidate)) return true;
  return REPOSITORY_PATH_PREFIXES.some((prefix) =>
    candidate.startsWith(prefix),
  );
}

function validateSkillReferences({
  root,
  skillDirectory,
  body,
  location,
  packageJson,
}) {
  const failures = [];
  const resolvedSkillRoot = path.resolve(skillDirectory);

  for (const rawDestination of extractMarkdownLinks(body)) {
    const destination = stripMarkdownDestination(rawDestination);
    if (!destination || isExternalDestination(destination)) continue;
    const resolved = path.resolve(skillDirectory, destination);
    if (
      resolved !== resolvedSkillRoot &&
      !resolved.startsWith(`${resolvedSkillRoot}${path.sep}`)
    ) {
      failures.push(
        `${location}: skill resource link escapes the skill directory: ${destination}`,
      );
      continue;
    }
    if (!existsSync(resolved)) {
      failures.push(`${location}: missing skill resource: ${destination}`);
    }
  }

  for (const match of body.matchAll(/`([^`\n]+)`/g)) {
    const candidate = match[1].trim().replace(/[.,;:]$/, '');
    if (!looksLikeRepositoryPath(candidate)) continue;
    if (!existsSync(path.join(root, candidate))) {
      failures.push(
        `${location}: missing referenced repository path: ${candidate}`,
      );
    }
  }

  for (const block of extractFencedBlocks(body)) {
    if (
      !['', 'bash', 'console', 'sh', 'shell', 'zsh'].includes(block.language)
    ) {
      continue;
    }
    for (const command of commandLines(block.content)) {
      const shapeFailures = validateShellCommandShape(command);
      if (shapeFailures.length > 0) {
        for (const failure of shapeFailures) {
          failures.push(`${location}: ${failure} in \`${command}\``);
        }
        continue;
      }
      const first = shellWords(command)[0];
      const commandFailures =
        first === 'pnpm'
          ? validatePnpmCommand(command, packageJson)
          : first === 'node'
            ? validateNodeCommand(command, root)
            : [`unsupported shell command: ${first}`];
      for (const failure of commandFailures) {
        failures.push(`${location}: ${failure} in \`${command}\``);
      }
    }
  }

  return failures;
}

async function listFilesRecursively(directory, root = directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = normalizePath(path.relative(root, absolute));
    const stats = await lstat(absolute);
    if (stats.isSymbolicLink()) {
      files.push({ path: relative, absolute, symlink: true });
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursively(absolute, root)));
      continue;
    }
    if (entry.isFile())
      files.push({ path: relative, absolute, symlink: false });
  }
  return files;
}

export async function computeSkillTreeHash(skillDirectory) {
  const files = await listFilesRecursively(skillDirectory);
  const hash = createHash('sha256');
  for (const entry of files.sort((left, right) =>
    left.path.localeCompare(right.path),
  )) {
    if (entry.symlink) {
      throw new Error(`skill tree contains a symbolic link: ${entry.path}`);
    }
    const contentHash = createHash('sha256')
      .update(await readFile(entry.absolute))
      .digest('hex');
    hash.update(`${entry.path}\0${contentHash}\n`);
  }
  return hash.digest('hex');
}

async function scanForSkillDocuments(root, directory = root) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_SCAN_DIRECTORIES.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await scanForSkillDocuments(root, absolute)));
      continue;
    }
    if (entry.isFile() && entry.name === 'SKILL.md') {
      found.push(normalizePath(path.relative(root, absolute)));
    }
  }
  return found;
}

function validateProvenanceEntry(entry, skillName, frontmatter, hasScripts) {
  const failures = [];
  const prefix = `${PROVENANCE_PATH}: ${skillName}`;

  if (!entry || typeof entry !== 'object') {
    return [`${prefix}: missing provenance entry`];
  }
  if (entry.origin !== frontmatter.metadata?.['steadystack-origin']) {
    failures.push(`${prefix}: origin does not match SKILL.md metadata`);
  }
  if (!['repository', 'third-party'].includes(entry.origin)) {
    failures.push(`${prefix}: origin must be repository or third-party`);
  }
  if (typeof entry.source !== 'string' || !entry.source.trim()) {
    failures.push(`${prefix}: source is required`);
  }
  if (typeof entry.sourceRef !== 'string' || !entry.sourceRef.trim()) {
    failures.push(`${prefix}: sourceRef is required`);
  }
  if (entry.license !== frontmatter.license) {
    failures.push(`${prefix}: license does not match SKILL.md`);
  }
  if (typeof entry.reviewedScripts !== 'boolean') {
    failures.push(`${prefix}: reviewedScripts must be boolean`);
  }
  if (!CONTENT_HASH_PATTERN.test(entry.contentSha256 ?? '')) {
    failures.push(`${prefix}: contentSha256 must be a lowercase SHA-256`);
  }
  if (hasScripts && entry.reviewedScripts !== true) {
    failures.push(
      `${prefix}: scripts are present without explicit reviewedScripts=true`,
    );
  }

  if (entry.origin === 'repository') {
    if (entry.source !== 'kaleigh-dem/steady-stack') {
      failures.push(
        `${prefix}: repository-owned skills must source kaleigh-dem/steady-stack`,
      );
    }
    if (!/^P\d{2}-\d{2}$/.test(entry.sourceRef ?? '')) {
      failures.push(
        `${prefix}: repository-owned sourceRef must be a stable roadmap task ID`,
      );
    }
  }

  if (entry.origin === 'third-party') {
    if (!/^https:\/\//.test(entry.source ?? '')) {
      failures.push(`${prefix}: third-party source must be an HTTPS URL`);
    }
    if (MOVING_SOURCE_REFS.has(String(entry.sourceRef ?? '').toLowerCase())) {
      failures.push(`${prefix}: third-party sourceRef must be immutable`);
    }
  }

  return failures;
}

export async function validateAgentSkills(root) {
  const failures = [];
  const packageJson = JSON.parse(
    await readFile(path.join(root, 'package.json'), 'utf8'),
  );
  const provenanceFile = path.join(root, PROVENANCE_PATH);

  if (!existsSync(provenanceFile)) {
    if (packageJson.name === UPSTREAM_PACKAGE_NAME) {
      return [`${PROVENANCE_PATH}: required in the upstream template`];
    }
    return [];
  }

  const canonicalDocuments = new Set();
  for (const document of await scanForSkillDocuments(root)) {
    if (!/^\.agents\/skills\/[^/]+\/SKILL\.md$/.test(document)) {
      failures.push(
        `${document}: SKILL.md must live only under .agents/skills/<name>/`,
      );
    } else {
      canonicalDocuments.add(document);
    }
  }

  let provenance;
  try {
    provenance = JSON.parse(await readFile(provenanceFile, 'utf8'));
  } catch {
    return [...failures, `${PROVENANCE_PATH}: invalid JSON`].sort();
  }
  if (provenance.schemaVersion !== 1) {
    failures.push(`${PROVENANCE_PATH}: schemaVersion must be 1`);
  }
  if (!Array.isArray(provenance.skills)) {
    failures.push(`${PROVENANCE_PATH}: skills must be an array`);
    return [...new Set(failures)].sort();
  }

  const provenanceByName = new Map();
  for (const entry of provenance.skills) {
    if (!entry?.name || typeof entry.name !== 'string') {
      failures.push(`${PROVENANCE_PATH}: every entry requires a name`);
      continue;
    }
    if (provenanceByName.has(entry.name)) {
      failures.push(`${PROVENANCE_PATH}: duplicate skill ${entry.name}`);
      continue;
    }
    provenanceByName.set(entry.name, entry);
  }

  const skillNames = [];
  for (const entry of await readdir(path.join(root, SKILLS_ROOT), {
    withFileTypes: true,
  })) {
    if (entry.isDirectory()) skillNames.push(entry.name);
    else if (entry.name !== 'provenance.json') {
      failures.push(
        `${SKILLS_ROOT}/${entry.name}: only provenance.json is allowed at the skills root`,
      );
    }
  }

  for (const skillName of skillNames.sort()) {
    const skillDirectory = path.join(root, SKILLS_ROOT, skillName);
    const skillPath = path.join(skillDirectory, 'SKILL.md');
    const location = normalizePath(path.relative(root, skillPath));
    if (!existsSync(skillPath)) {
      failures.push(`${SKILLS_ROOT}/${skillName}: missing SKILL.md`);
      continue;
    }

    let document;
    try {
      document = parseSkillDocument(
        await readFile(skillPath, 'utf8'),
        location,
      );
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
      continue;
    }

    failures.push(...validateFrontmatter(skillName, document, location));
    failures.push(
      ...validateSkillReferences({
        root,
        skillDirectory,
        body: document.body,
        location,
        packageJson,
      }),
    );

    const treeFiles = await listFilesRecursively(skillDirectory);
    for (const entry of treeFiles) {
      if (entry.symlink) {
        failures.push(`${location}: symbolic links are not allowed in skills`);
      }
    }
    const hasScripts = treeFiles.some((entry) =>
      entry.path.startsWith('scripts/'),
    );
    const provenanceEntry = provenanceByName.get(skillName);
    failures.push(
      ...validateProvenanceEntry(
        provenanceEntry,
        skillName,
        document.frontmatter,
        hasScripts,
      ),
    );
    if (provenanceEntry?.contentSha256) {
      try {
        const actual = await computeSkillTreeHash(skillDirectory);
        if (actual !== provenanceEntry.contentSha256) {
          failures.push(
            `${PROVENANCE_PATH}: ${skillName}: contentSha256 does not match the committed skill tree`,
          );
        }
      } catch (error) {
        failures.push(
          `${PROVENANCE_PATH}: ${skillName}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  for (const skillName of provenanceByName.keys()) {
    if (!skillNames.includes(skillName)) {
      failures.push(
        `${PROVENANCE_PATH}: ${skillName}: provenance entry has no skill directory`,
      );
    }
  }

  if (canonicalDocuments.size !== skillNames.length) {
    failures.push(
      `${SKILLS_ROOT}: every skill directory must expose exactly one canonical SKILL.md`,
    );
  }

  return [...new Set(failures)].sort();
}

async function main() {
  const root = path.resolve(process.argv[2] ?? '.');
  const failures = await validateAgentSkills(root);
  if (failures.length === 0) {
    const packageJson = JSON.parse(
      await readFile(path.join(root, 'package.json'), 'utf8'),
    );
    if (
      packageJson.name !== UPSTREAM_PACKAGE_NAME &&
      !existsSync(path.join(root, PROVENANCE_PATH))
    ) {
      process.stdout.write(
        'Skipping portable Agent Skills validation until the downstream workspace contains a generated skill set.\n',
      );
      return;
    }
    process.stdout.write('Portable Agent Skills validation passed.\n');
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
