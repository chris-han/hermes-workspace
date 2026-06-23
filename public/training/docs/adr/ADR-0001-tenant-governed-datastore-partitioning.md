# ADR-0001: Tenant-Governed Datastore Partitioning

Date: 2026-06-01
Status: Accepted
Authority: Architecture decision record, not a runtime contract.
Scope: Record the accepted datastore partitioning decision for the current architecture phase and the reasoning behind it.
Upstream sources:
- `docs/canonical/architecture.md`
- `docs/canonical/document-authority-and-versioning.md`
Related roadmap item: P2.1

This ADR explains **why** the current decision was made. It does not replace the active runtime contract. Current runtime truth remains defined by `docs/canonical/architecture.md`.

## Context

Semantier currently persists governed artifacts in a shared `.semantier-home/eos.db`.
This is the canonical architecture contract in `docs/canonical/architecture.md`.

P2 requires an explicit partitioning decision with migration and rollback planning,
without silently violating the current architecture law.

## Decision

Keep shared `eos.db` as the governed system of record for the current architecture
phase, and gate any per-tenant governed datastore split behind a future ADR.

Near-term tenant isolation is delivered by:

1. tenant-scoped route authz and fail-closed boundaries
2. tenant-scoped backup/restore bundles and integrity checks
3. tenant-scoped compliance and residency policy enforcement

## Decision Matrix

| Option | Description | Pros | Cons | Decision |
| --- | --- | --- | --- | --- |
| A | Keep shared `eos.db` and enforce tenant boundaries at authz, query filters, lifecycle tooling | Aligns with current architecture; no disruptive migration; deterministic replay continuity | Requires strict policy/testing discipline | Selected |
| B | Move immediately to per-tenant `eos.db` | Strong physical separation | High migration risk; replay lineage and tooling complexity | Rejected for current phase |
| C | Hybrid governed store split by tenant segment | Potential compliance flexibility | Highest operational complexity and rollback cost | Rejected for current phase |

## Customer Constraint Assessment

- Backup/restore: addressed via tenant-scoped backup bundles (`tenant-backup-bundle.v1`).
- Residency: addressed via explicit residency policy mapping (`tenant-compliance-policy.v1`).
- Legal segregation: addressed via tenant authorization and lifecycle evidence surfaces.
- Replay/audit portability: preserved by keeping governed authority in shared `eos.db`
  while exporting tenant-scoped evidence bundles.

## Migration Plan (If Option B Is Later Approved)

1. Introduce dual-write capability behind feature flag for governed writes.
2. Backfill per-tenant governed stores from pinned `eos.db` snapshots.
3. Run parity verifier across replay and audit surfaces.
4. Flip read path per tenant only after parity verification.
5. Keep shared `eos.db` read-only until rollback window closes.

## Rollback Plan

1. Disable per-tenant reads and writes via feature flag.
2. Revert read path to shared `eos.db`.
3. Reconstruct missing writes from append-only replay bindings.
4. Re-run parity checks and publish incident/audit report.

## Consequences

- Current runtime remains architecture-consistent.
- Tenant portability and compliance operations are improved via tooling and policy,
  without introducing a high-risk storage migration.
- Any future physical partitioning must be explicitly approved by a new ADR.
