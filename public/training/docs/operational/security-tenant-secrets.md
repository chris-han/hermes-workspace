# Tenant Secret Ownership and Rotation (P2.3)

Date: 2026-06-01

## Scope

This document defines deterministic ownership boundaries and precedence for
tenant-related secrets used by Semantier runtime and gateway surfaces.

## Secret Source Precedence

The runtime must resolve a secret key in this order:

1. workspace `.hermes/.env` value (tenant-scoped override)
2. platform process environment value
3. authoritative auth-cache fallback row

Notes:

- Auth-cache rows are fallback only and may not override workspace or platform
  explicit values.
- Revoked cache rows are non-resolvable.

## Ownership Boundaries

- Workspace `.hermes/.env`: tenant-owned operational secret scope.
- Platform process environment: platform-owned defaults and deployment secrets.
- Auth cache rows: runtime-owned fallback cache for continuity only.

## Rotation Procedure

1. Generate rotation plan from declared inventory and last-rotated timestamps.
2. Mark `due` secrets for immediate update.
3. Mark `warning` secrets for scheduled update before expiry.
4. Apply secret updates at source of truth (workspace env or platform env).
5. Revoke obsolete auth-cache rows.

## Revocation Procedure

- Revocation sets cache row state to `revoked`, clears value, and records
  `revoked_at` in UTC ISO-8601.
- Revoked rows are ignored by secret resolution.

## Testability

- Precedence is tested in `tests/test_tenant_secret_policy.py`.
- Rotation and revocation paths are tested in `tests/test_tenant_secret_policy.py`.
