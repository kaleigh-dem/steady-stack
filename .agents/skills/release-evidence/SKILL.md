---
name: release-evidence
description: Prepare and verify SteadyStack release evidence without granting deployment authority. Use when inspecting immutable release identities, validating a finalized release-record bundle, or preparing production evidence for accountable human review.
license: MIT
metadata:
  steadystack-origin: repository
  steadystack-required-tools: read-files run-repository-commands read-github
  steadystack-authority: none
---

# Release evidence

Use this procedure to inspect and validate release evidence. It does not authorize a deployment, promotion, rollback, protected-environment approval, or credential use.

## Procedure

1. Read `docs/delivery/release-records.md`, the applicable release/rollback runbooks under `docs/runbooks/`, and `workspace.template.json` when working in a generated product.
2. Bind every conclusion to exact release identities: version, source commit, successful release-images run, successful promotion run, immutable image digests, and the finalized release-record run. Do not substitute evidence from another run or commit.
3. Before production evidence is finalized, use the reviewed repository checks that apply to the release inputs:

```bash
pnpm release:manifest:check
pnpm release:plan
```

Run the production readiness contract only with the documented production-safe configuration and human authorization for that environment:

```bash
pnpm production:check
```

4. For a downloaded finalized evidence bundle, validate its record, immutable manifest, and attachment hashes from the bundle directory:

```bash
node tools/delivery/release-record.mjs validate --record release-record.json --manifest release-manifest.json --base-directory .
```

5. Confirm the record includes a deployment-specific backup identifier, rollback window, schema-compatibility decision and rationale, deployed smoke evidence, and the supporting SBOM/scan/attestation files required by `docs/delivery/release-records.md`.
6. Treat GitHub artifact retention as a handoff window, not a durable compliance archive. Preserve the complete validated bundle in the adopting service's approved system of record when longer retention is required.

## Failure rules

- Do not dispatch, approve, deploy, promote, or roll back merely because this skill was loaded.
- Do not invent a backup identifier, schema decision, run ID, digest, smoke result, or missing attachment.
- Do not rebuild or retag an image to repair an evidence mismatch; identify the first mismatched identity and follow the reviewed release process.
- Do not weaken production checks or protected-environment controls to obtain a green record.

## Authority boundary

This skill prepares and verifies evidence only. Production deployment, promotion, rollback, secret access, protected-environment approval, and risk acceptance remain human-controlled decisions under repository and platform policy.
