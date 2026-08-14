import { readJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { describe, expect, it } from 'vitest';

import { templateVersion } from '../../template-version';
import { upstreamTemplateRepository } from '../../upstream-template';
import presetGenerator from './generator';

describe('preset generator', () => {
  it('records template provenance, preserves portable skills, and removes maintainer-only tooling', async () => {
    const tree = createTreeWithEmptyWorkspace();
    writeJson(tree, 'package.json', {
      name: '@steadystack/source',
      scripts: {
        'initialize:workspace': 'nx g @steadystack/workspace-plugin:preset',
        'template:release:prepare': 'node tools/template/release.mjs prepare',
        'template:release:verify': 'node tools/template/release.mjs verify',
        'template:release:pack': 'node tools/template/release.mjs pack',
        'template:release:notes': 'node tools/template/release.mjs notes',
        'template:release:smoke':
          'node tools/template/smoke-release-artifact.mjs',
        'template:workspace:e2e':
          'node tools/template/generated-workspace-e2e.mjs',
        'template:upgrade': 'node tools/template/upgrade.mjs',
      },
    });
    writeJson(tree, 'tools/workspace-plugin/package.json', {
      name: '@steadystack/workspace-plugin',
      private: false,
      publishConfig: { access: 'public' },
    });
    const skillContent = '# Skill\nSteadyStack kaleigh-dem/steady-stack\n';
    const provenanceContent = `${JSON.stringify(
      {
        schemaVersion: 1,
        skills: [
          {
            name: 'architecture-discovery',
            source: 'kaleigh-dem/steady-stack',
          },
        ],
      },
      null,
      2,
    )}\n`;
    const validatorContent =
      'export const source = "kaleigh-dem/steady-stack";\n';
    tree.write(
      '.agents/skills/architecture-discovery/SKILL.md',
      skillContent,
    );
    tree.write('.agents/skills/provenance.json', provenanceContent);
    tree.write('tools/agent-skills/validate-agent-skills.mjs', validatorContent);
    tree.write('.github/workflows/generated-workspace.yml', 'name: e2e\n');
    tree.write('.github/workflows/template-release.yml', 'name: release\n');
    tree.write('CHANGELOG.md', '# Changelog\n');
    tree.write('docs/agent-skills.md', '# Portable skill contract\n');
    tree.write(
      'docs/adr/0026-portable-agent-skills.md',
      '# ADR\nSteadyStack kaleigh-dem/steady-stack\n',
    );
    tree.write('docs/getting-started.md', '# Generated workspace onboarding\n');
    tree.write(
      'docs/generated-project-checklist.md',
      '# Generated project checklist\n',
    );
    tree.write('docs/template-releases.md', '# Releases\n');
    tree.write('docs/template-validation.md', '# Validation\n');
    tree.write('docs/template-upgrades.md', '# Upgrades\n');
    tree.write('tools/template/fixtures/upgrade-0.1.0/package.json', '{}\n');
    tree.write('tools/template/ai-profile-isolation-check.mjs', 'export {};\n');
    tree.write('tools/template/generated-ai-profile-e2e.mjs', 'export {};\n');
    tree.write('tools/template/generated-workspace-e2e.mjs', 'export {};\n');
    tree.write('tools/template/release.mjs', 'export {};\n');
    tree.write('tools/template/smoke-release-artifact.mjs', 'export {};\n');
    tree.write('tools/template/upgrade.mjs', 'export {};\n');
    tree.write('tools/template/ownership.json', '{}\n');
    tree.write(
      'tools/template/migrations/0.1.0-to-0.2.0.mjs',
      'export default {};\n',
    );

    await presetGenerator(tree, {
      applicationSlug: 'smoke-app',
      displayName: 'Smoke App',
      packageScope: '@smoke',
      repositoryOwner: 'smoke-owner',
      applications: 'web',
      authentication: 'none',
      workerTransport: 'none',
      deploymentProfile: 'local',
      skipFormat: true,
    });

    const manifest = readJson<{
      schemaVersion: number;
      upstream: { repository: string; version: string };
      upgrade: { ownershipPolicyVersion: number };
    }>(tree, 'workspace.template.json');
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.upstream).toEqual({
      repository: upstreamTemplateRepository,
      version: templateVersion,
    });
    expect(manifest.upgrade).toEqual({ ownershipPolicyVersion: 1 });

    const packageJson = readJson<{
      scripts: Record<string, string>;
    }>(tree, 'package.json');
    expect(packageJson.scripts['initialize:workspace']).toBe(
      'nx g @smoke/workspace-plugin:preset',
    );
    expect(packageJson.scripts['template:upgrade']).toBe(
      'node tools/template/upgrade.mjs',
    );
    expect(
      Object.keys(packageJson.scripts).filter((script) =>
        script.startsWith('template:release:'),
      ),
    ).toEqual([]);
    expect(packageJson.scripts['template:workspace:e2e']).toBeUndefined();

    expect(tree.exists('.agents/skills')).toBe(true);
    expect(
      tree.read('.agents/skills/architecture-discovery/SKILL.md', 'utf-8'),
    ).toBe(skillContent);
    expect(tree.read('.agents/skills/provenance.json', 'utf-8')).toBe(
      provenanceContent,
    );
    expect(
      tree.read('tools/agent-skills/validate-agent-skills.mjs', 'utf-8'),
    ).toBe(validatorContent);
    expect(tree.exists('docs/agent-skills.md')).toBe(true);
    expect(
      tree.read('docs/adr/0026-portable-agent-skills.md', 'utf-8'),
    ).toBe('# ADR\nSteadyStack kaleigh-dem/steady-stack\n');
    expect(tree.exists('.github/workflows/generated-workspace.yml')).toBe(
      false,
    );
    expect(tree.exists('.github/workflows/template-release.yml')).toBe(false);
    expect(tree.exists('CHANGELOG.md')).toBe(false);
    expect(tree.exists('docs/template-releases.md')).toBe(false);
    expect(tree.exists('docs/template-validation.md')).toBe(false);
    expect(tree.exists('tools/template/fixtures')).toBe(false);
    expect(tree.exists('tools/template/ai-profile-isolation-check.mjs')).toBe(
      false,
    );
    expect(tree.exists('tools/template/generated-ai-profile-e2e.mjs')).toBe(
      false,
    );
    expect(tree.exists('tools/template/generated-workspace-e2e.mjs')).toBe(
      false,
    );
    expect(tree.exists('tools/template/release.mjs')).toBe(false);
    expect(tree.exists('tools/template/smoke-release-artifact.mjs')).toBe(
      false,
    );

    expect(tree.exists('docs/getting-started.md')).toBe(true);
    expect(tree.exists('docs/generated-project-checklist.md')).toBe(true);
    expect(tree.exists('docs/template-upgrades.md')).toBe(true);
    expect(tree.exists('tools/template/upgrade.mjs')).toBe(true);
    expect(tree.exists('tools/template/ownership.json')).toBe(true);
    expect(tree.exists('tools/template/migrations/0.1.0-to-0.2.0.mjs')).toBe(
      true,
    );

    expect(
      readJson<{
        private: boolean;
        publishConfig?: unknown;
      }>(tree, 'tools/workspace-plugin/package.json'),
    ).toMatchObject({ private: true });
    expect(
      readJson<{ publishConfig?: unknown }>(
        tree,
        'tools/workspace-plugin/package.json',
      ).publishConfig,
    ).toBeUndefined();
  });
});
