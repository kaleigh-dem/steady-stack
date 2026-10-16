import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const auditScript = fileURLToPath(
  new URL('./check-audit.mjs', import.meta.url),
);
const baseline = { expiresOn: '2099-12-31', advisories: [] };

function runAudit(report, baselineOverride = baseline) {
  const fixtureDir = mkdtempSync(join(tmpdir(), 'steadystack-audit-'));
  const payload = JSON.stringify(report);
  const baselinePath = join(fixtureDir, 'audit-baseline.json');
  writeFileSync(baselinePath, `${JSON.stringify(baselineOverride, null, 2)}\n`);

  if (process.platform === 'win32') {
    const payloadPath = join(fixtureDir, 'pnpm-fixture.mjs');
    writeFileSync(
      payloadPath,
      `process.stdout.write(${JSON.stringify(payload)});\n`,
    );
    writeFileSync(
      join(fixtureDir, 'pnpm.cmd'),
      `@echo off\r\n"${process.execPath}" "${payloadPath}" %*\r\n`,
    );
  } else {
    const executable = join(fixtureDir, 'pnpm');
    writeFileSync(
      executable,
      `#!/usr/bin/env node\nprocess.stdout.write(${JSON.stringify(payload)});\n`,
    );
    chmodSync(executable, 0o755);
  }

  try {
    return spawnSync(process.execPath, [auditScript], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${fixtureDir}${delimiter}${process.env.PATH ?? ''}`,
        STEADYSTACK_AUDIT_BASELINE: baselinePath,
      },
    });
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
}

test('rejects unexpected nested GHSA advisories', () => {
  const advisoryId = 'GHSA-zzzz-yyyy-xxxx';
  const result = runAudit({
    vulnerabilities: {
      'demo-package': {
        name: 'demo-package',
        severity: 'high',
        via: [{ url: `https://github.com/advisories/${advisoryId}` }],
      },
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Unexpected high or critical dependency advisories:/,
  );
  assert.match(result.stderr, new RegExp(advisoryId));
});

test('accepts nested GHSA advisories present in the expiring baseline', () => {
  const advisoryId = 'GHSA-aaaa-bbbb-cccc';
  const result = runAudit(
    {
      vulnerabilities: {
        'baseline-package': {
          name: 'baseline-package',
          severity: 'high',
          via: [{ url: `https://github.com/advisories/${advisoryId}` }],
        },
      },
    },
    {
      expiresOn: '2099-12-31',
      advisories: [
        {
          id: advisoryId,
          package: 'baseline-package',
          reason: 'test fixture',
        },
      ],
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, new RegExp(advisoryId));
  assert.match(
    result.stdout,
    /Dependency audit passed with 1 documented high\/critical advisories/,
  );
});

test('rejects duplicate audit baseline entries', () => {
  const advisory = {
    id: 'GHSA-dddd-eeee-ffff',
    package: 'duplicate-package',
    reason: 'test fixture',
  };
  const result = runAudit(
    { vulnerabilities: {} },
    {
      expiresOn: '2099-12-31',
      advisories: [advisory, { ...advisory, reason: 'duplicate fixture' }],
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Duplicate security audit baseline entry: GHSA-dddd-eeee-ffff \(duplicate-package\)/,
  );
});

test('rejects an expired baseline before invoking the audit', () => {
  const result = runAudit(
    { vulnerabilities: {} },
    { expiresOn: '2026-09-01', advisories: [] },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /audit baseline expired on 2026-09-01/);
});

test('does not accept an advisory for a different package', () => {
  const advisoryId = 'GHSA-aaaa-bbbb-cccc';
  const result = runAudit(
    {
      vulnerabilities: {
        'new-package': {
          name: 'new-package',
          severity: 'high',
          via: [{ url: `https://github.com/advisories/${advisoryId}` }],
        },
      },
    },
    {
      expiresOn: '2099-12-31',
      advisories: [
        { id: advisoryId, package: 'old-package', reason: 'test fixture' },
      ],
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Unexpected high or critical dependency advisories:/,
  );
  assert.match(result.stderr, /new-package, high/);
});

test('rejects obsolete accepted advisories', () => {
  const result = runAudit(
    { vulnerabilities: {} },
    {
      expiresOn: '2099-12-31',
      advisories: [
        {
          id: 'GHSA-aaaa-bbbb-cccc',
          package: 'fixed-package',
          reason: 'test fixture',
        },
      ],
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Obsolete security audit baseline entries:/);
});

test('rejects unidentified nested high or critical findings', () => {
  const result = runAudit({
    vulnerabilities: {
      'demo-package': {
        name: 'demo-package',
        severity: 'critical',
        findings: [{ title: 'missing advisory identifier' }],
      },
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unidentified \(demo-package, critical\)/);
});

test('rejects an audit service error instead of treating it as no findings', () => {
  const result = runAudit({ error: { code: 'ERR_PNPM_AUDIT_BAD_RESPONSE' } });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid findings report/);
});
