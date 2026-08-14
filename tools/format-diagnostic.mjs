import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import prettier from 'prettier';

const target = 'tools/workspace-plugin/src/generators/preset/generator.spec.ts';
const input = await readFile(target, 'utf8');
const config = (await prettier.resolveConfig(target)) ?? {};
const output = await prettier.format(input, { ...config, filepath: target });
const diagnosticsDirectory = process.env.CI_DIAGNOSTICS_DIR;
if (!diagnosticsDirectory) {
  throw new Error('CI_DIAGNOSTICS_DIR is required for formatter diagnostics.');
}
await mkdir(diagnosticsDirectory, { recursive: true });
await writeFile(path.join(diagnosticsDirectory, 'generator.spec.ts.formatted'), output);
