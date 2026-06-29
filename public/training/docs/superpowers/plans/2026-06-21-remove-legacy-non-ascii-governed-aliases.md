# Remove Legacy Non-ASCII Governed Schema Aliases

**Goal:** Remove compatibility `_万` SQL/parquet aliases after the ASCII governed schema migration has shipped for one release and downstream consumers have moved to ASCII machine identifiers plus display metadata.

## Preconditions

- Governed-query skill examples have preferred ASCII aliases for at least one release.
- Web UI, Weixin, and Feishu presentation renderers consume `display_columns` for user-facing labels.
- Saved/demo query fixtures are migrated or explicitly marked legacy.
- Bootstrap materialization and governed analytics tests pass with ASCII aliases only.
- Lakehouse manifest version is bumped for the compatibility-breaking schema change.
- Release notes document the break and the replacement mapping.

## Task 1: Start With A Failing Law Test

- [ ] Remove the legacy allowlist from `tests/test_schema_identifier_law.py`.
- [ ] Change the assertion to require no non-ASCII runtime aliases:

```python
assert offenders == []
```

- [ ] Run `pytest -q tests/test_schema_identifier_law.py` and confirm it fails on current legacy aliases.

## Task 2: Remove Runtime Compatibility Aliases

- [ ] Remove `amount_万`, `amount_2024_万`, `amount_2025_万`, `amount_2026_万`, `revenue_万`, `cost_万`, `debit_万`, `credit_万`, and `net_万` from governed SQL views.
- [ ] Remove the same legacy aliases from lakehouse parquet materialization.
- [ ] Bump the lakehouse manifest version.
- [ ] Keep Chinese display names only in `governed_schema_labels.json` and presentation metadata.

## Task 3: Update Tests And Fixtures

- [ ] Update governed analytics tests to assert ASCII-only schemas.
- [ ] Remove compatibility tests that query legacy `_万` aliases.
- [ ] Keep simulator DTO/fixture `_万` fields unchanged unless that separate simulator API migration is explicitly in scope.

## Task 4: Verify

- [ ] Run `pytest -q tests/test_smb_analytics_tool.py tests/test_schema_identifier_law.py`.
- [ ] Run bootstrap materialization smoke tests or equivalent lakehouse regeneration validation.
- [ ] Verify release notes include the compatibility break and mapping from legacy aliases to ASCII identifiers.
