import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { describe, expect, it } from 'vitest';

import { formatGeneratorFiles } from './shared';

describe('shared generator finalization', () => {
  it('removes retired task-control ownership before optional formatting', async () => {
    const tree: Tree = createTreeWithEmptyWorkspace();
    const retiredPath = ['docs', 'TODO.md'].join('/');
    tree.write(
      '.github/CODEOWNERS',
      [`/${retiredPath} @owners`, '/AGENTS.md @owners', ''].join('\n'),
    );

    await formatGeneratorFiles(tree, true);

    const codeowners = tree.read('.github/CODEOWNERS', 'utf-8') ?? '';
    expect(codeowners).not.toContain(retiredPath);
    expect(codeowners).toContain('/AGENTS.md @owners');
  });
});
