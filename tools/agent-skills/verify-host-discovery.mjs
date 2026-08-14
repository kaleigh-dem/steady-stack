import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const CANONICAL_ROOT = '.agents/skills';
const PROVENANCE_PATH = `${CANONICAL_ROOT}/provenance.json`;
const CONTRACT_PATH = 'tools/agent-skills/host-discovery.json';
const IMMUTABLE_GIT_REF = /^[a-f0-9]{40}$/;

function normalizePath(value) {
  return value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '');
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function discoverSkillNames(root, skillRoot) {
  const directory = path.join(root, skillRoot);
  if (!existsSync(directory)) return [];
  const names = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (
      entry.isDirectory() &&
      existsSync(path.join(directory, entry.name, 'SKILL.md'))
    ) {
      names.push(entry.name);
    }
  }
  return names.sort();
}

export async function validateHostDiscovery(root) {
  const failures = [];
  const contractPath = path.join(root, CONTRACT_PATH);
  const provenancePath = path.join(root, PROVENANCE_PATH);

  if (!existsSync(contractPath)) return [`${CONTRACT_PATH}: required`];
  if (!existsSync(provenancePath)) {
    return [`${PROVENANCE_PATH}: required for generated portable skills`];
  }

  let contract;
  let provenance;
  try {
    contract = await readJson(contractPath);
  } catch {
    return [`${CONTRACT_PATH}: invalid JSON`];
  }
  try {
    provenance = await readJson(provenancePath);
  } catch {
    return [`${PROVENANCE_PATH}: invalid JSON`];
  }

  if (contract.schemaVersion !== 1) {
    failures.push(`${CONTRACT_PATH}: schemaVersion must be 1`);
  }
  if (normalizePath(contract.canonicalProjectRoot ?? '') !== CANONICAL_ROOT) {
    failures.push(
      `${CONTRACT_PATH}: canonicalProjectRoot must be ${CANONICAL_ROOT}`,
    );
  }
  if (!Array.isArray(contract.hosts) || contract.hosts.length < 2) {
    failures.push(
      `${CONTRACT_PATH}: at least two maintained hosts are required`,
    );
  }
  if (!Array.isArray(provenance.skills)) {
    failures.push(`${PROVENANCE_PATH}: skills must be an array`);
    return [...new Set(failures)].sort();
  }

  const hostIds = new Set();
  for (const host of contract.hosts ?? []) {
    if (typeof host?.id !== 'string' || !host.id.trim()) {
      failures.push(`${CONTRACT_PATH}: every host requires an id`);
      continue;
    }
    if (hostIds.has(host.id)) {
      failures.push(`${CONTRACT_PATH}: duplicate host ${host.id}`);
    }
    hostIds.add(host.id);
    if (typeof host.maintainer !== 'string' || !host.maintainer.trim()) {
      failures.push(`${CONTRACT_PATH}: ${host.id}: maintainer is required`);
    }
    if (normalizePath(host.projectSkillRoot ?? '') !== CANONICAL_ROOT) {
      failures.push(
        `${CONTRACT_PATH}: ${host.id}: projectSkillRoot must use the canonical ${CANONICAL_ROOT} tree`,
      );
    }
    if (
      typeof host.evidence?.repository !== 'string' ||
      !/^[^/\s]+\/[^/\s]+$/.test(host.evidence.repository)
    ) {
      failures.push(
        `${CONTRACT_PATH}: ${host.id}: evidence.repository must be owner/repository`,
      );
    }
    if (!IMMUTABLE_GIT_REF.test(host.evidence?.ref ?? '')) {
      failures.push(
        `${CONTRACT_PATH}: ${host.id}: evidence.ref must be an immutable 40-character commit SHA`,
      );
    }
    if (
      typeof host.evidence?.path !== 'string' ||
      !host.evidence.path.trim() ||
      path.isAbsolute(host.evidence.path) ||
      normalizePath(host.evidence.path).startsWith('../')
    ) {
      failures.push(
        `${CONTRACT_PATH}: ${host.id}: evidence.path must be a repository-relative path`,
      );
    }
  }

  const expectedSkills = provenance.skills
    .map((entry) => entry?.name)
    .filter((name) => typeof name === 'string')
    .sort();
  if (new Set(expectedSkills).size !== expectedSkills.length) {
    failures.push(`${PROVENANCE_PATH}: skill names must be unique`);
  }

  const canonicalSkills = await discoverSkillNames(root, CANONICAL_ROOT);
  if (canonicalSkills.join('\0') !== expectedSkills.join('\0')) {
    failures.push(
      `${CONTRACT_PATH}: canonical discovered skills must exactly match provenance`,
    );
  }

  for (const host of contract.hosts ?? []) {
    if (normalizePath(host?.projectSkillRoot ?? '') !== CANONICAL_ROOT)
      continue;
    const discovered = await discoverSkillNames(root, host.projectSkillRoot);
    if (discovered.join('\0') !== expectedSkills.join('\0')) {
      failures.push(
        `${CONTRACT_PATH}: ${host.id ?? '(unknown host)'} does not discover the complete canonical skill set`,
      );
    }
  }

  return [...new Set(failures)].sort();
}

async function main() {
  const root = path.resolve(process.argv[2] ?? '.');
  const failures = await validateHostDiscovery(root);
  if (failures.length > 0) {
    for (const failure of failures) process.stderr.write(`- ${failure}\n`);
    process.exitCode = 1;
    return;
  }
  const contract = await readJson(path.join(root, CONTRACT_PATH));
  const skills = await discoverSkillNames(root, CANONICAL_ROOT);
  const hostNames = contract.hosts.map((host) => host.id).join(', ');
  process.stdout.write(
    `Portable Agent Skills host discovery passed for ${hostNames} with ${skills.length} canonical skill(s).\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main();
}
