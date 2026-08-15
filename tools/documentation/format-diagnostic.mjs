import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { format, resolveConfig } from 'prettier';

const root = fileURLToPath(new URL('../..', import.meta.url));
const targets = [
  'tools/documentation/task-management-control-plane.mjs',
  'tools/documentation/task-management-control-plane.spec.mjs',
];
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'prettier-diff-'));

try {
  for (const relativePath of targets) {
    const file = path.join(root, relativePath);
    const source = await readFile(file, 'utf8');
    const options = (await resolveConfig(file)) ?? {};
    const formatted = await format(source, { ...options, filepath: file });
    const formattedFile = path.join(temporaryDirectory, path.basename(relativePath));
    await writeFile(formattedFile, formatted, 'utf8');

    const result = spawnSync(
      'git',
      [
        'diff',
        '--no-index',
        '--no-color',
        '--',
        file,
        formattedFile,
      ],
      { encoding: 'utf8' },
    );
    if (result.status !== 0 && result.status !== 1) {
      throw new Error(result.stderr || `git diff exited ${result.status}`);
    }
    process.stdout.write(`\n--- PRETTIER_DIFF:${relativePath} ---\n`);
    process.stdout.write(result.stdout || '(already formatted)\n');
    process.stdout.write(`--- END_PRETTIER_DIFF:${relativePath} ---\n`);
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
