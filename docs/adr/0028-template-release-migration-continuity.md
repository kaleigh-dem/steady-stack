# ADR 0028: Require ordered template release migration continuity

- Status: accepted
- Date: 2026-08-15

## Context

SteadyStack release artifacts validate both new workspace generation and the downstream upgrade path retained by the repository's historical compatibility fixture. Preparing template `0.3.0` exposed a gap: the upgrade runner had an ordered `0.1.0` to `0.2.0` migration but no edge from `0.2.0` to `0.3.0`, so the packaged-artifact smoke test correctly failed closed with `No migration path exists from 0.2.0 to 0.3.0`.

The repository has no prior published GitHub Release, but the versioned `0.1.0` and `0.2.0` fixtures are still part of the deterministic release contract. Silently weakening that contract for the first public SteadyStack release would make later release validation less trustworthy.

## Decision

Every template release that advances beyond a retained prior-version fixture must provide one unambiguous ordered migration edge to the new release, even when the edge only advances provenance and release-owned upgrade infrastructure.

Template `0.3.0` therefore includes `tools/template/migrations/0.2.0-to-0.3.0.mjs`. The migration updates `workspace.template.json` to record `0.3.0`, records the applied migration identifier, and leaves application-owned files untouched. The upgrade runner continues to synchronize its template-managed runner, ownership policy, and migration assets from the verified release artifact.

A migration edge must not pretend to own downstream application code. New or changed capabilities that require downstream application-owned edits need a separately reviewed migration or explicit manual guidance under the ownership policy.

## Consequences

Release-artifact smoke validation can traverse `0.1.0` to `0.2.0` to `0.3.0`, test the deprecated compatibility alias once, apply through `steadystack-upgrade`, preserve application-owned fixture content, and prove the resulting upgrade is idempotent. Future releases fail closed when an ordered migration edge is missing instead of publishing an artifact with an untested provenance gap.
