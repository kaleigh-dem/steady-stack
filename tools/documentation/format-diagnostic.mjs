import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { format, resolveConfig } from 'prettier';

const root = fileURLToPath(new URL('../..', import.meta.url));
const targets = [
  'tools/documentation/task-management-control-plane.mjs',
  'tools/documentation/task-management-control-plane.spec.mjs',
];

for (const relativePath of targets) {
  const file = path.join(root, relativePath);
  const source = await readFile(file, 'utf8');
  const options = (await resolveConfig(file)) ?? {};
  const formatted = await format(source, { ...options, filepath: file });
  process.stdout.write(`\n--- PRETTIER:${relativePath} ---\n${formatted}`);
  process.stdout.write(`--- END PRETTIER:${relativePath} ---\n`);
}
