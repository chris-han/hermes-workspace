# ADRs

This directory contains Architecture Decision Records.

## What An ADR Is

An ADR is a decision record, not a runtime contract.

It records:

- the context at the time of the decision,
- the decision that was accepted,
- the alternatives considered,
- the consequences and migration/rollback implications.

## What An ADR Is Not

An ADR is not the active source of truth for current runtime behavior.

Use:

- `docs/canonical/architecture.md` for the active runtime contract,
- `docs/canonical/document-authority-and-versioning.md` for documentation authority rules,
- derived docs under `docs/derived/` for specialized active contracts.

## Practical Rule

If an ADR and the live runtime contract appear to differ:

1. treat the ADR as historical decision rationale,
2. treat the canonical runtime contract as current truth,
3. create a new ADR only if a new decision needs to be recorded.
