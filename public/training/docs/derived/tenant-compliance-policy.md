# Tenant Compliance and Residency Policy (P2.4)

Date: 2026-06-01

## Policy Artifact

Canonical policy file:

- `policies/tenant_compliance_policy.v1.json`

Schema version:

- `tenant-compliance-policy.v1`

## Coverage

The policy defines:

1. retention classes by artifact/data type
2. residency constraints by tenant region
3. tenant-admin audit evidence surfaces

## Enforcement Surfaces

- Loader/validator: `src/agents/tenant_compliance_policy.py`
- Regression tests: `tests/test_tenant_compliance_policy.py`

## Required Audit Surfaces

- `tenant-export-bundle.v1`
- `cleanup-report.v1`
- `tenant-backup-bundle.v1`

## Residency Rule Contract

`tenant_region` allows writes only to listed `storage_region` values in policy.
Global tenants may target any policy-allowed region.
