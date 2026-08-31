export default {
  id: '0.2.0-to-0.3.0',
  from: '0.2.0',
  to: '0.3.0',
  summary:
    'Advance template provenance while preserving downstream-owned application content.',
  operations: [
    {
      type: 'merge-json',
      path: 'workspace.template.json',
      description: 'Advance provenance to the SteadyStack 0.3.0 release.',
      patch: {
        upstream: {
          version: '0.3.0',
        },
        upgrade: {
          ownershipPolicyVersion: 1,
          lastAppliedMigration: '0.2.0-to-0.3.0',
        },
      },
    },
  ],
};
