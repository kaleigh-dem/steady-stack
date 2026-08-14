import { readFile } from 'node:fs/promises';

import prettier from 'prettier';

const target = 'tools/workspace-plugin/src/generators/preset/generator.spec.ts';
const input = await readFile(target, 'utf8');
const config = (await prettier.resolveConfig(target)) ?? {};
const output = await prettier.format(input, { ...config, filepath: target });
const encoded = Buffer.from(output, 'utf8').toString('base64');
process.stdout.write(`FORMAT_DIAGNOSTIC_BEGIN\n${encoded}\nFORMAT_DIAGNOSTIC_END\n`);
