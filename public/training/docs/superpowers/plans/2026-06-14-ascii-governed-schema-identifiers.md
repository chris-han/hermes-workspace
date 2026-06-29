# ASCII Governed Schema Identifiers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Semantier-controlled governed analytics and lakehouse schema identifiers from Chinese-suffixed machine names such as `amount_万`, `debit_万`, `credit_万`, and `net_万` to ASCII-stable names while preserving a compatibility window.

**Architecture:** Keep Chinese business meaning as display metadata, not canonical SQL/parquet/API identifiers. Add ASCII aliases first, update query generation and tests to prefer them, attach localized labels through a common governed-query response component, then deprecate non-ASCII aliases behind explicit compatibility behavior.

**Tech Stack:** Python, DuckDB, Parquet lakehouse materialization, pytest, Semantier governed-query Hermes skill.

---

## Impact Radius

Direct runtime schema surfaces:

- `bootstrap/bootstrap_materialize_lakehouse.py`
  - Persists `amount_万` into `governed_rea_claims`.
  - Persists `revenue_万`, `cost_万`, and `amount_万` into analytics cube parquet schemas.
- `src/plugins/business_analytics/__init__.py`
  - Exposes `amount_万` from `analytics_rea_claims` and `org_rea_claims`.
  - Builds `analytics_expense_audit_matrix` with `amount_2024_万`, `amount_2025_万`, `amount_2026_万`.
  - Builds `org_general_ledger_balance_lines` with `debit_万`, `credit_万`, and `net_万`.
  - Returns `columns` from DuckDB directly to the model/user, so column names are part of the governed query contract.
- `src/skills/semantier/governed-query/SKILL.md`
  - Teaches and exemplifies the current non-ASCII query identifiers.
- `src/plugins/business_analytics/governed_schema_labels.json`
  - New repo-owned display metadata catalog for Chinese labels, units, and legacy alias mappings.
- Common governed-query response component
  - The backend must enrich governed-query results once with `column_metadata` and user-facing display headers. Web UI, Weixin, and Feishu must consume this normalized response instead of duplicating label mapping per channel.

Presentation surfaces:

- `hermes-workspace/src/screens/chat/components/message-item.tsx`
  - Primary Web UI chat message/tool-result render path. It should render labels already supplied by the common response component while preserving ASCII machine keys in data payloads.
- `src/agents/webapi_gateway.py`
  - Web/API gateway surface for session messages and embedded chat. Gateway payloads should carry the normalized governed-query response produced by the common component.
- `src/agents/hermes_embedded_gateway.py`
  - Shared embedded gateway runtime for Weixin delivery. Weixin outbound summaries should use the common response component output for user-facing table/header text.
- Feishu gateway integration paths
  - Confirm exact runtime path during execution. Candidate source-owned Semantier files include `src/agents/feishu_ingress_identity.py` for identity resolution and shared embedded gateway/web API paths for message delivery. Do not assume Weixin-only formatting.

Direct tests that will fail if aliases are renamed without compatibility:

- `tests/test_smb_analytics_tool.py`
  - Asserts current parquet/view columns such as `amount_万`, `revenue_万`, `cost_万`, `debit_万`.
  - Contains the malformed full-width punctuation regressions added for the immediate guardrail fix.

Adjacent data-generation surfaces:

- `bootstrap/industry_simulator/construction_3_year/simulator.py`
  - Uses `_万` fields in Python dataclasses and dict output for demo simulator payloads.
  - These are not SQL schema identifiers, but they feed bootstrap seeders and generated JSON.
- `bootstrap/bootstrap_seed_v85.py`
  - Reads simulator `_万` keys and converts to CNY before persisting EOS facts.
- `bootstrap/industry_simulator/apparel_trade_3_year/sim.json`
  - Contains `_万` keys as generated simulator JSON fixture data.
- `tests/test_3year_smb_simulator.py`
  - Locks simulator DTO and fixture behavior around `_万` fields.

Risk assessment:

- Runtime governed-query and lakehouse schema migration risk is **medium/high** because it affects public query contracts and persisted parquet manifests.
- Simulator DTO migration risk is **medium** but should be separate from the SQL/lakehouse migration because `_万` is currently domain fixture shape, not canonical governed DB schema.
- Immediate safe path is additive aliases plus prompt preference. Removing non-ASCII aliases should be a later explicit compatibility-breaking step.

## Scope Decisions

- Add ASCII aliases everywhere a runtime-owned SQL SELECT or lakehouse parquet schema currently emits `_万`: `analytics_rea_claims`, `governed_rea_claims`, both `org_rea_claims` branches in `_create_governed_org_views`, `analytics_expense_audit_matrix`, `analytics_cost_revenue_yearly`, `analytics_event_type_yearly`, and `org_general_ledger_balance_lines`.
- Add yearly expense aliases `amount_2024_wan`, `amount_2025_wan`, and `amount_2026_wan` next to the existing compatibility aliases.
- Add Chinese display metadata in `src/plugins/business_analytics/governed_schema_labels.json`. A common governed-query response component must use this metadata for user-facing labels instead of deriving labels from SQL identifiers.
- Keep simulator DTOs, simulator JSON fixtures, seed readers, and `tests/test_3year_smb_simulator.py` unchanged in this migration. They are domain fixture shapes, not the governed DB/query schema. Migrate them later only if product/API consumers need ASCII-only simulator payloads.
- For every additive alias pair, emit the ASCII alias before the legacy `_万` alias. Column-order tests should treat this as the canonical ordering.
- `tests/test_schema_identifier_law.py` scans runtime source files only, not docs, plans, or presentation examples. Docs/examples are updated separately through `SKILL.md` and later cleanup.
- Bump the lakehouse manifest version for the additive schema change because persisted parquet schema changes even though legacy aliases remain.
- Web UI, Weixin, and Feishu migrations are in scope for presentation labels only. Channel-specific code must not implement independent label mapping; it should render the common normalized governed-query response. Channel code must not reintroduce non-ASCII machine identifiers into DB/API/query contracts.
- Use separate commits per task as written in this plan.

## File Structure

- Modify `bootstrap/bootstrap_materialize_lakehouse.py`: add ASCII fields to persisted parquet/lakehouse datasets while retaining legacy fields during compatibility.
- Modify `src/plugins/business_analytics/__init__.py`: expose ASCII fields in governed views and prefer them in hints/prompt-facing examples.
- Create/modify `src/plugins/business_analytics/governed_schema_labels.json`: store localized display labels, units, and legacy alias mappings for governed analytics columns.
- Modify `src/skills/semantier/governed-query/SKILL.md`: replace generated SQL examples with ASCII identifiers and document legacy aliases as compatibility-only.
- Modify `tests/test_smb_analytics_tool.py`: add failing schema-contract tests first, then update existing query tests to use ASCII identifiers.
- Create `tests/test_schema_identifier_law.py`: enforce Law 4 for governed/lakehouse query surfaces without scanning presentation fixtures.
- Create or modify a common governed-query response helper in Semantier-owned code, colocated with `src/plugins/business_analytics/__init__.py` unless an existing shared response formatter is found.
- Modify Web UI/gateway files only to consume the common normalized response after verifying exact render paths:
  - `hermes-workspace/src/screens/chat/components/message-item.tsx`
  - `src/agents/webapi_gateway.py`
  - `src/agents/hermes_embedded_gateway.py`
  - Feishu delivery/formatting path found by `rg -n "feishu|governed_query|tool result|message" src hermes-agent hermes-workspace -S`

### Task 1: Add Failing Governed Query ASCII Alias Contract Tests

**Files:**
- Modify: `tests/test_smb_analytics_tool.py`

- [x] **Step 1: Write the failing balance-line alias test**

Add this test in `TestHandlerBehavior` after `test_governed_query_exposes_balance_line_columns_for_schema_discovery`:

```python
    def test_governed_query_exposes_ascii_balance_line_aliases(
        self,
        lakehouse_env: Path,
        monkeypatch: pytest.MonkeyPatch,
    ):
        _bind_workspace_auth_context(
            lakehouse_env,
            monkeypatch,
            organization_id="org_construction_3_year_cn",
        )

        result = _governed_query(
            "SELECT period_id, account_code, debit_wan, credit_wan, net_wan FROM org_general_ledger_balance_lines ORDER BY period_id, account_code LIMIT 1",
            reload=True,
        )

        assert result["columns"] == [
            "period_id",
            "account_code",
            "debit_wan",
            "credit_wan",
            "net_wan",
        ]
        assert result["count"] == 1
```

- [x] **Step 2: Write the failing org claims alias test**

Add this test in `TestHandlerBehavior` after the balance-line alias test:

```python
    def test_governed_query_exposes_ascii_org_claim_amount_alias(
        self,
        lakehouse_env: Path,
        monkeypatch: pytest.MonkeyPatch,
    ):
        _bind_workspace_auth_context(
            lakehouse_env,
            monkeypatch,
            organization_id="org_construction_3_year_cn",
        )

        result = _governed_query(
            "SELECT event_type, amount_wan, amount_万 FROM org_rea_claims WHERE amount_wan IS NOT NULL ORDER BY event_type LIMIT 1",
            reload=True,
        )

        assert result["columns"] == ["event_type", "amount_wan", "amount_万"]
        assert result["count"] == 1
        assert result["rows"][0]["amount_wan"] == result["rows"][0]["amount_万"]
```

- [x] **Step 3: Write the failing expense-matrix yearly alias test**

Add this test in `TestHandlerBehavior` after the org claims alias test:

```python
    def test_governed_query_exposes_ascii_expense_matrix_yearly_aliases(
        self,
        lakehouse_env: Path,
        monkeypatch: pytest.MonkeyPatch,
    ):
        _bind_workspace_auth_context(
            lakehouse_env,
            monkeypatch,
            organization_id="org_construction_3_year_cn",
        )

        result = _governed_query(
            """
            SELECT
                amount_2024_wan,
                amount_2025_wan,
                amount_2026_wan,
                amount_2024_万,
                amount_2025_万,
                amount_2026_万
            FROM analytics_expense_audit_matrix, org_rea_claims
            WHERE analytics_expense_audit_matrix.event_type = org_rea_claims.event_type
            LIMIT 1
            """,
            reload=True,
        )

        assert result["columns"] == [
            "amount_2024_wan",
            "amount_2025_wan",
            "amount_2026_wan",
            "amount_2024_万",
            "amount_2025_万",
            "amount_2026_万",
        ]
        assert result["count"] <= 1
```

- [x] **Step 4: Run tests to verify they fail**

Run:

```bash
pytest -q \
  tests/test_smb_analytics_tool.py::TestHandlerBehavior::test_governed_query_exposes_ascii_balance_line_aliases \
  tests/test_smb_analytics_tool.py::TestHandlerBehavior::test_governed_query_exposes_ascii_org_claim_amount_alias \
  tests/test_smb_analytics_tool.py::TestHandlerBehavior::test_governed_query_exposes_ascii_expense_matrix_yearly_aliases
```

Expected: fail with DuckDB binder errors because the ASCII aliases do not exist yet.

- [x] **Step 5: Implement governed view aliases**

In `src/plugins/business_analytics/__init__.py`, update `analytics_rea_claims` so `amount_wan` appears immediately before `amount_万`:

```sql
TRY_CAST(json_extract(claim_json, '$.amount') AS DOUBLE) / 10000.0 AS amount_wan,
TRY_CAST(json_extract(claim_json, '$.amount') AS DOUBLE) / 10000.0 AS amount_万,
```

Update `analytics_expense_audit_matrix` to use `amount_wan` internally and emit ASCII aliases before compatibility aliases:

```sql
ROUND(SUM(CASE WHEN year = '2024' THEN amount_wan ELSE 0 END), 2) AS amount_2024_wan,
ROUND(SUM(CASE WHEN year = '2024' THEN amount_wan ELSE 0 END), 2) AS amount_2024_万,
ROUND(SUM(CASE WHEN year = '2025' THEN amount_wan ELSE 0 END), 2) AS amount_2025_wan,
ROUND(SUM(CASE WHEN year = '2025' THEN amount_wan ELSE 0 END), 2) AS amount_2025_万,
ROUND(SUM(CASE WHEN year = '2026' THEN amount_wan ELSE 0 END), 2) AS amount_2026_wan,
ROUND(SUM(CASE WHEN year = '2026' THEN amount_wan ELSE 0 END), 2) AS amount_2026_万,
```

Inside that matrix subquery, project both names with ASCII first:

```sql
amount_wan,
amount_万,
```

Update both `org_rea_claims` branches in `_create_governed_org_views`:

```sql
amount_wan,
amount_万,
```

For the fallback EOS branch, compute both aliases:

```sql
TRY_CAST(json_extract(claim_json, '$.amount') AS DOUBLE) / 10000.0 AS amount_wan,
TRY_CAST(json_extract(claim_json, '$.amount') AS DOUBLE) / 10000.0 AS amount_万,
```

Update `org_general_ledger_balance_lines` creation so ASCII aliases are emitted before existing compatibility aliases:

```sql
TRY_CAST(json_extract(je.value, '$.debit') AS DOUBLE) / 10000.0 AS debit_wan,
TRY_CAST(json_extract(je.value, '$.credit') AS DOUBLE) / 10000.0 AS credit_wan,
TRY_CAST(json_extract(je.value, '$.net') AS DOUBLE) / 10000.0 AS net_wan,
TRY_CAST(json_extract(je.value, '$.debit') AS DOUBLE) / 10000.0 AS debit_万,
TRY_CAST(json_extract(je.value, '$.credit') AS DOUBLE) / 10000.0 AS credit_万,
TRY_CAST(json_extract(je.value, '$.net') AS DOUBLE) / 10000.0 AS net_万,
```

- [x] **Step 6: Run tests to verify they pass**

Run:

```bash
pytest -q \
  tests/test_smb_analytics_tool.py::TestHandlerBehavior::test_governed_query_exposes_ascii_balance_line_aliases \
  tests/test_smb_analytics_tool.py::TestHandlerBehavior::test_governed_query_exposes_ascii_org_claim_amount_alias \
  tests/test_smb_analytics_tool.py::TestHandlerBehavior::test_governed_query_exposes_ascii_expense_matrix_yearly_aliases
```

Expected: pass.

- [x] **Step 7: Commit**

```bash
git add src/plugins/business_analytics/__init__.py tests/test_smb_analytics_tool.py
git commit -m "feat: add ascii governed analytics aliases"
```

### Task 2: Add Failing Lakehouse ASCII Schema Contract Tests

**Files:**
- Modify: `tests/test_smb_analytics_tool.py`
- Modify: `bootstrap/bootstrap_materialize_lakehouse.py`

- [x] **Step 1: Write the failing test**

Add this test in `TestDuckDBAttachedSQLite` after `test_event_type_yearly_cube_exists`:

```python
    def test_lakehouse_amount_columns_have_ascii_aliases(self, lakehouse_env: Path):
        rows = _raw_rows(
            """
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = 'main'
              AND table_name IN (
                  'governed_rea_claims',
                  'analytics_cost_revenue_yearly',
                  'analytics_event_type_yearly'
              )
              AND column_name IN ('amount_wan', 'revenue_wan', 'cost_wan')
            ORDER BY table_name, column_name
            """
        )

        pairs = {(row["table_name"], row["column_name"]) for row in rows}
        assert pairs == {
            ("analytics_cost_revenue_yearly", "cost_wan"),
            ("analytics_cost_revenue_yearly", "revenue_wan"),
            ("analytics_event_type_yearly", "amount_wan"),
            ("governed_rea_claims", "amount_wan"),
        }
```

- [x] **Step 2: Write the failing manifest version test**

Add this test in `TestDuckDBAttachedSQLite` after `test_lakehouse_amount_columns_have_ascii_aliases`:

```python
    def test_lakehouse_manifest_version_bumps_for_ascii_schema_aliases(self, lakehouse_env: Path):
        manifest_path = lakehouse_env / "lakehouse" / "lakehouse_manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        assert manifest["manifest_version"] == "1.1"
```

- [x] **Step 3: Run tests to verify they fail**

Run:

```bash
pytest -q \
  tests/test_smb_analytics_tool.py::TestDuckDBAttachedSQLite::test_lakehouse_amount_columns_have_ascii_aliases \
  tests/test_smb_analytics_tool.py::TestDuckDBAttachedSQLite::test_lakehouse_manifest_version_bumps_for_ascii_schema_aliases
```

Expected: fail because parquet schemas do not yet include `amount_wan`, `revenue_wan`, or `cost_wan`, and the manifest version is still `1.0`.

- [x] **Step 4: Implement additive lakehouse aliases and manifest bump**

In `bootstrap/bootstrap_materialize_lakehouse.py`, bump:

```python
_LAKEHOUSE_MANIFEST_VERSION = "1.1"
```

In `bootstrap/bootstrap_materialize_lakehouse.py`, add ASCII aliases while retaining legacy `_万` fields:

```sql
TRY_CAST(json_extract(claim_json, '$.amount') AS DOUBLE) / 10000.0 AS amount_wan,
TRY_CAST(json_extract(claim_json, '$.amount') AS DOUBLE) / 10000.0 AS amount_万,
```

In `cube_cost_revenue_yearly.parquet`, compute the base as `amount_wan`:

```sql
TRY_CAST(json_extract(claim_json, '$.amount') AS DOUBLE) / 10000.0 AS amount_wan,
TRY_CAST(json_extract(claim_json, '$.amount') AS DOUBLE) / 10000.0 AS amount_万,
```

Replace the revenue projection with:

```sql
ROUND(SUM(CASE WHEN event_type = 'invoice_issued' AND blocked = FALSE THEN amount_wan ELSE 0 END), 2) AS revenue_wan,
ROUND(SUM(CASE WHEN event_type = 'invoice_issued' AND blocked = FALSE THEN amount_wan ELSE 0 END), 2) AS revenue_万,
```

Replace the cost projection with:

```sql
ROUND(SUM(CASE WHEN event_type IN (
    'material_purchased', 'material_consumed', 'wages_paid', 'subcontract_settled',
    'temp_labor', 'site_misc_cost', 'social_insurance', 'bonus_payout', 'depreciation',
    'insurance_premium', 'license_fee', 'license_renewal', 'fire_inspection',
    'fire_penalty', 'admin_penalty', 'tax_audit_penalty', 'annual_tax_settle',
    'vat_filing', 'cit_prepay', 'work_injury_fatal', 'warranty_repair', 'complaint_rework'
) AND blocked = FALSE THEN amount_wan ELSE 0 END), 2) AS cost_wan,
ROUND(SUM(CASE WHEN event_type IN (
    'material_purchased', 'material_consumed', 'wages_paid', 'subcontract_settled',
    'temp_labor', 'site_misc_cost', 'social_insurance', 'bonus_payout', 'depreciation',
    'insurance_premium', 'license_fee', 'license_renewal', 'fire_inspection',
    'fire_penalty', 'admin_penalty', 'tax_audit_penalty', 'annual_tax_settle',
    'vat_filing', 'cit_prepay', 'work_injury_fatal', 'warranty_repair', 'complaint_rework'
) AND blocked = FALSE THEN amount_wan ELSE 0 END), 2) AS cost_万,
```

Replace the ratio expression with:

```sql
CASE
    WHEN SUM(CASE WHEN event_type = 'invoice_issued' AND blocked = FALSE THEN amount_wan ELSE 0 END) = 0
    THEN NULL
    ELSE SUM(CASE WHEN event_type IN (
        'material_purchased', 'material_consumed', 'wages_paid', 'subcontract_settled',
        'temp_labor', 'site_misc_cost', 'social_insurance', 'bonus_payout', 'depreciation',
        'insurance_premium', 'license_fee', 'license_renewal', 'fire_inspection',
        'fire_penalty', 'admin_penalty', 'tax_audit_penalty', 'annual_tax_settle',
        'vat_filing', 'cit_prepay', 'work_injury_fatal', 'warranty_repair', 'complaint_rework'
    ) AND blocked = FALSE THEN amount_wan ELSE 0 END)
    / SUM(CASE WHEN event_type = 'invoice_issued' AND blocked = FALSE THEN amount_wan ELSE 0 END)
END
```

In `cube_event_type_yearly.parquet`, compute and emit:

```sql
TRY_CAST(json_extract(claim_json, '$.amount') AS DOUBLE) / 10000.0 AS amount_wan,
TRY_CAST(json_extract(claim_json, '$.amount') AS DOUBLE) / 10000.0 AS amount_万,
ROUND(SUM(amount_wan), 2) AS amount_wan,
ROUND(SUM(amount_wan), 2) AS amount_万,
```

- [x] **Step 5: Run tests to verify they pass**

Run:

```bash
pytest -q \
  tests/test_smb_analytics_tool.py::TestDuckDBAttachedSQLite::test_lakehouse_amount_columns_have_ascii_aliases \
  tests/test_smb_analytics_tool.py::TestDuckDBAttachedSQLite::test_lakehouse_manifest_version_bumps_for_ascii_schema_aliases
```

Expected: pass.

- [x] **Step 6: Commit**

```bash
git add bootstrap/bootstrap_materialize_lakehouse.py tests/test_smb_analytics_tool.py
git commit -m "feat: add ascii lakehouse amount aliases"
```

### Task 3: Add Chinese Label Metadata Catalog

**Files:**
- Create: `src/plugins/business_analytics/governed_schema_labels.json`
- Modify: `tests/test_smb_analytics_tool.py`

- [x] **Step 1: Write the failing metadata catalog test**

Add this test in `TestHandlerBehavior` after the governed-query ASCII alias tests:

```python
    def test_governed_schema_label_catalog_covers_ascii_amount_aliases(self):
        labels_path = (
            Path(__file__).resolve().parent.parent
            / "src"
            / "plugins"
            / "business_analytics"
            / "governed_schema_labels.json"
        )
        catalog = json.loads(labels_path.read_text(encoding="utf-8"))

        assert catalog["schema_version"] == "governed-analytics-labels.v1"
        expected = {
            ("org_rea_claims", "amount_wan", "金额（万元）", "amount_万"),
            ("analytics_rea_claims", "amount_wan", "金额（万元）", "amount_万"),
            ("governed_rea_claims", "amount_wan", "金额（万元）", "amount_万"),
            ("analytics_cost_revenue_yearly", "revenue_wan", "收入（万元）", "revenue_万"),
            ("analytics_cost_revenue_yearly", "cost_wan", "成本（万元）", "cost_万"),
            ("analytics_event_type_yearly", "amount_wan", "金额（万元）", "amount_万"),
            ("analytics_expense_audit_matrix", "amount_2024_wan", "2024年金额（万元）", "amount_2024_万"),
            ("analytics_expense_audit_matrix", "amount_2025_wan", "2025年金额（万元）", "amount_2025_万"),
            ("analytics_expense_audit_matrix", "amount_2026_wan", "2026年金额（万元）", "amount_2026_万"),
            ("org_general_ledger_balance_lines", "debit_wan", "借方金额（万元）", "debit_万"),
            ("org_general_ledger_balance_lines", "credit_wan", "贷方金额（万元）", "credit_万"),
            ("org_general_ledger_balance_lines", "net_wan", "净额（万元）", "net_万"),
        }

        for view_name, column_name, display_name_zh, legacy_alias in expected:
            metadata = catalog["views"][view_name]["columns"][column_name]
            assert metadata["display_name_zh"] == display_name_zh
            assert metadata["unit"] == "CNY_10K"
            assert metadata["legacy_alias"] == legacy_alias
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
pytest -q tests/test_smb_analytics_tool.py::TestHandlerBehavior::test_governed_schema_label_catalog_covers_ascii_amount_aliases
```

Expected: fail because `src/plugins/business_analytics/governed_schema_labels.json` does not exist yet.

- [x] **Step 3: Create the metadata catalog**

Create `src/plugins/business_analytics/governed_schema_labels.json`:

```json
{
  "schema_version": "governed-analytics-labels.v1",
  "description": "Display metadata for governed analytics machine schema identifiers. Machine identifiers stay ASCII; localized labels and units live here.",
  "views": {
    "analytics_rea_claims": {
      "columns": {
        "amount_wan": {
          "display_name_zh": "金额（万元）",
          "unit": "CNY_10K",
          "legacy_alias": "amount_万"
        }
      }
    },
    "analytics_cost_revenue_yearly": {
      "columns": {
        "revenue_wan": {
          "display_name_zh": "收入（万元）",
          "unit": "CNY_10K",
          "legacy_alias": "revenue_万"
        },
        "cost_wan": {
          "display_name_zh": "成本（万元）",
          "unit": "CNY_10K",
          "legacy_alias": "cost_万"
        }
      }
    },
    "analytics_event_type_yearly": {
      "columns": {
        "amount_wan": {
          "display_name_zh": "金额（万元）",
          "unit": "CNY_10K",
          "legacy_alias": "amount_万"
        }
      }
    },
    "analytics_expense_audit_matrix": {
      "columns": {
        "amount_2024_wan": {
          "display_name_zh": "2024年金额（万元）",
          "unit": "CNY_10K",
          "legacy_alias": "amount_2024_万"
        },
        "amount_2025_wan": {
          "display_name_zh": "2025年金额（万元）",
          "unit": "CNY_10K",
          "legacy_alias": "amount_2025_万"
        },
        "amount_2026_wan": {
          "display_name_zh": "2026年金额（万元）",
          "unit": "CNY_10K",
          "legacy_alias": "amount_2026_万"
        }
      }
    },
    "governed_rea_claims": {
      "columns": {
        "amount_wan": {
          "display_name_zh": "金额（万元）",
          "unit": "CNY_10K",
          "legacy_alias": "amount_万"
        }
      }
    },
    "org_rea_claims": {
      "columns": {
        "amount_wan": {
          "display_name_zh": "金额（万元）",
          "unit": "CNY_10K",
          "legacy_alias": "amount_万"
        }
      }
    },
    "org_general_ledger_balance_lines": {
      "columns": {
        "debit_wan": {
          "display_name_zh": "借方金额（万元）",
          "unit": "CNY_10K",
          "legacy_alias": "debit_万"
        },
        "credit_wan": {
          "display_name_zh": "贷方金额（万元）",
          "unit": "CNY_10K",
          "legacy_alias": "credit_万"
        },
        "net_wan": {
          "display_name_zh": "净额（万元）",
          "unit": "CNY_10K",
          "legacy_alias": "net_万"
        }
      }
    }
  }
}
```

- [x] **Step 4: Validate JSON and run test**

Run:

```bash
python -m json.tool src/plugins/business_analytics/governed_schema_labels.json >/tmp/governed_schema_labels.formatted.json
pytest -q tests/test_smb_analytics_tool.py::TestHandlerBehavior::test_governed_schema_label_catalog_covers_ascii_amount_aliases
```

Expected: both commands pass.

- [x] **Step 5: Commit**

```bash
git add src/plugins/business_analytics/governed_schema_labels.json tests/test_smb_analytics_tool.py
git commit -m "feat: add governed analytics display label catalog"
```

### Task 4: Add A Law 4 Identifier Test For Runtime Query Surfaces

**Files:**
- Create: `tests/test_schema_identifier_law.py`

- [x] **Step 1: Write the failing test**

Create `tests/test_schema_identifier_law.py`:

```python
from __future__ import annotations

import re
from pathlib import Path


_REPO_ROOT = Path(__file__).resolve().parent.parent
_NON_ASCII_ALIAS_RE = re.compile(r"\bAS\s+[A-Za-z0-9_]*[^\x00-\x7F][^\s,)]*", re.IGNORECASE)
_RUNTIME_SQL_SOURCES = (
    _REPO_ROOT / "src" / "plugins" / "business_analytics" / "__init__.py",
    _REPO_ROOT / "bootstrap" / "bootstrap_materialize_lakehouse.py",
)


def test_runtime_sql_aliases_are_ascii_stable_except_legacy_compatibility_aliases():
    allowed_legacy = {
        "AS amount_万",
        "AS amount_2024_万",
        "AS amount_2025_万",
        "AS amount_2026_万",
        "AS revenue_万",
        "AS cost_万",
        "AS debit_万",
        "AS credit_万",
        "AS net_万",
    }

    offenders: list[str] = []
    for path in _RUNTIME_SQL_SOURCES:
        source = path.read_text(encoding="utf-8")
        for offender in sorted(set(_NON_ASCII_ALIAS_RE.findall(source))):
            if offender not in allowed_legacy:
                offenders.append(f"{path.relative_to(_REPO_ROOT)}: {offender}")

    unexpected = sorted(offenders)
    assert unexpected == []
```

- [x] **Step 2: Run test to verify it passes with current allowlist**

Run:

```bash
pytest -q tests/test_schema_identifier_law.py
```

Expected: pass because current non-ASCII aliases are explicitly recorded as legacy compatibility aliases.

- [x] **Step 3: Confirm scan scope**

Do not add docs, `src/skills/`, `bootstrap/industry_simulator/`, simulator JSON fixtures, or `tests/test_3year_smb_simulator.py` to `_RUNTIME_SQL_SOURCES`. Those are either prompt/presentation surfaces or simulator fixture contracts, not runtime SQL schema emitters for this migration.

- [x] **Step 4: Commit**

```bash
git add tests/test_schema_identifier_law.py
git commit -m "test: lock ascii schema identifier law"
```

### Task 5: Prefer ASCII Identifiers In Governed Query Generation

**Files:**
- Modify: `src/skills/semantier/governed-query/SKILL.md`
- Modify: `src/plugins/business_analytics/__init__.py`
- Modify: `tests/test_smb_analytics_tool.py`

- [x] **Step 1: Update prompt-facing documentation**

In `src/skills/semantier/governed-query/SKILL.md`, replace references to `amount_万`, `debit_万`, `credit_万`, and `net_万` in examples with `amount_wan`, `debit_wan`, `credit_wan`, and `net_wan`.

Add this compatibility note:

```md
- **Machine identifiers**: Prefer ASCII column identifiers such as
  `amount_wan`, `debit_wan`, `credit_wan`, and `net_wan`. Chinese labels and
  units belong in display metadata, not SQL identifiers. Legacy `_万` aliases
  may exist temporarily for compatibility, but do not generate new queries
  against them.
```

- [x] **Step 2: Update guardrail hints**

In `src/plugins/business_analytics/__init__.py`, change the repair hints to prefer ASCII:

```python
"QUERY_SQL_IDENTIFIER_VIOLATION": (
    "Use ASCII identifiers such as debit_wan, credit_wan, net_wan; "
    'if quoting is required, quote each identifier separately.'
),
"QUERY_SQL_SYNTAX_VIOLATION": (
    "Use ASCII SQL punctuation and ASCII identifiers, for example: debit_wan, credit_wan, net_wan."
),
```

- [x] **Step 3: Update existing governed-query tests to prefer ASCII**

In `tests/test_smb_analytics_tool.py`, update runtime governed-query and lakehouse tests to prefer ASCII aliases. Do not update simulator DTO tests in `tests/test_3year_smb_simulator.py`.

Change the yearly cost/revenue cube test from:

```sql
SELECT year, revenue_万, cost_万, cost_to_revenue_ratio FROM analytics_cost_revenue_yearly ORDER BY year
```

to:

```sql
SELECT year, revenue_wan, cost_wan, cost_to_revenue_ratio FROM analytics_cost_revenue_yearly ORDER BY year
```

Update expected row keys to `revenue_wan` and `cost_wan`.

Change the event-type cube test from:

```sql
SELECT year, event_type, amount_万, event_count FROM analytics_event_type_yearly WHERE year = '2024' ORDER BY event_type
```

to:

```sql
SELECT year, event_type, amount_wan, event_count FROM analytics_event_type_yearly WHERE year = '2024' ORDER BY event_type
```

Change successful ledger query examples from:

```sql
SELECT account_code, ROUND(SUM(debit_万), 2) AS debit_万
```

to:

```sql
SELECT account_code, ROUND(SUM(debit_wan), 2) AS debit_wan
```

Update expected rows accordingly:

```python
assert result["rows"] == [
    {"account_code": "5002.01.01", "debit_wan": 12.0},
    {"account_code": "5003.01.01", "debit_wan": 8.0},
    {"account_code": "5502.01.01", "debit_wan": 1.5},
]
```

Change schema-discovery success queries from:

```sql
SELECT period_id, account_code, debit, debit_万, account_prefix FROM org_general_ledger_balance_lines ORDER BY period_id, account_code LIMIT 1
```

to:

```sql
SELECT period_id, account_code, debit, debit_wan, account_prefix FROM org_general_ledger_balance_lines ORDER BY period_id, account_code LIMIT 1
```

Update expected columns to `debit_wan`.

- [x] **Step 4: Keep malformed legacy tests during compatibility**

Keep tests that reject:

```sql
SELECT debit_万，credit_万，net_万 FROM org_general_ledger_balance_lines LIMIT 1
SELECT "debit_万，credit_万，net_万" FROM org_general_ledger_balance_lines LIMIT 1
```

They continue to protect against full-width punctuation even while legacy aliases exist.

- [x] **Step 5: Catalog external saved query surfaces**

Before legacy alias removal, search this repository for query examples that still use `_万` in governed SQL contexts:

```bash
rg -n "amount_万|revenue_万|cost_万|debit_万|credit_万|net_万" src tests docs bootstrap -S
```

Expected for this additive migration: remaining matches are either legacy compatibility tests, simulator DTO/fixture contracts, docs explaining old aliases, or generated fixture data. Do not migrate external repositories in this task; record any known out-of-repo dashboards/notebooks in the follow-up removal plan.

- [x] **Step 6: Run analytics tests**

Run:

```bash
pytest -q tests/test_smb_analytics_tool.py tests/test_schema_identifier_law.py
```

Expected: pass.

- [x] **Step 7: Commit**

```bash
git add src/skills/semantier/governed-query/SKILL.md src/plugins/business_analytics/__init__.py tests/test_smb_analytics_tool.py tests/test_schema_identifier_law.py
git commit -m "refactor: prefer ascii governed query identifiers"
```

### Task 6: Add Common Response Labels For Web UI, Weixin, And Feishu

**Files:**
- Modify: `src/plugins/business_analytics/__init__.py`
- Modify: `tests/test_smb_analytics_tool.py`
- Modify after path verification: `hermes-workspace/src/screens/chat/components/message-item.tsx`
- Modify after path verification: `src/agents/webapi_gateway.py`
- Modify after path verification: `src/agents/hermes_embedded_gateway.py`
- Modify after path verification: Feishu delivery/formatting path found through repository search

- [x] **Step 1: Write common response enrichment test**

Add this test in `TestHandlerBehavior` after `test_governed_schema_label_catalog_covers_ascii_amount_aliases`:

```python
    def test_governed_query_response_includes_common_display_columns(
        self,
        lakehouse_env: Path,
        monkeypatch: pytest.MonkeyPatch,
    ):
        _bind_workspace_auth_context(
            lakehouse_env,
            monkeypatch,
            organization_id="org_construction_3_year_cn",
        )

        result = _governed_query(
            "SELECT amount_wan FROM org_rea_claims WHERE amount_wan IS NOT NULL LIMIT 1",
            reload=True,
        )

        assert result["columns"] == ["amount_wan"]
        assert result["display_columns"] == ["金额（万元）"]
        assert result["column_metadata"]["amount_wan"] == {
            "display_name_zh": "金额（万元）",
            "unit": "CNY_10K",
            "legacy_alias": "amount_万",
        }
```

- [x] **Step 2: Run common response enrichment test to verify it fails**

Run:

```bash
pytest -q tests/test_smb_analytics_tool.py::TestHandlerBehavior::test_governed_query_response_includes_common_display_columns
```

Expected: fail because governed-query responses do not yet include `column_metadata` or `display_columns`.

- [x] **Step 3: Implement common response enrichment**

In `src/plugins/business_analytics/__init__.py`, load `governed_schema_labels.json` deterministically from the plugin directory, then create one common enriched result shape for every governed-query response:

```python
_GOVERNED_SCHEMA_LABELS_PATH = Path(__file__).with_name("governed_schema_labels.json")


def _load_governed_schema_labels() -> dict[str, Any]:
    with _GOVERNED_SCHEMA_LABELS_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


def _column_metadata_for_result(columns: list[str]) -> dict[str, dict[str, Any]]:
    catalog = _load_governed_schema_labels()
    metadata: dict[str, dict[str, Any]] = {}
    for view in (catalog.get("views") or {}).values():
        for column, column_metadata in (view.get("columns") or {}).items():
            if column in columns and isinstance(column_metadata, dict):
                metadata[column] = dict(column_metadata)
    return metadata


def _display_columns_for_result(columns: list[str]) -> list[str]:
    metadata = _column_metadata_for_result(columns)
    return [
        str(metadata.get(column, {}).get("display_name_zh") or column)
        for column in columns
    ]
```

In the governed-query JSON payload, include:

```python
"columns": columns,
"display_columns": _display_columns_for_result(columns),
"column_metadata": _column_metadata_for_result(columns),
```

Required common response contract:

```json
{
  "columns": ["amount_wan"],
  "display_columns": ["金额（万元）"],
  "rows": [{"amount_wan": 12.5}],
  "column_metadata": {
    "amount_wan": {
      "display_name_zh": "金额（万元）",
      "unit": "CNY_10K",
      "legacy_alias": "amount_万"
    }
  }
}
```

Channel code must consume `display_columns`; it must not recompute labels from `column_metadata`.

- [x] **Step 4: Run backend metadata tests**

Run:

```bash
pytest -q \
  tests/test_smb_analytics_tool.py::TestHandlerBehavior::test_governed_schema_label_catalog_covers_ascii_amount_aliases \
  tests/test_smb_analytics_tool.py::TestHandlerBehavior::test_governed_query_response_includes_common_display_columns
```

Expected: pass.

- [x] **Step 5: Locate exact common response consumers**

Run:

```bash
rg -n "governed_query|display_columns|column_metadata|tool result|toolCall|columns|rows|table" hermes-workspace/src src hermes-agent -S
```

Expected: identify the exact component/formatter that renders governed-query tool results. Current likely Web UI entry point is `hermes-workspace/src/screens/chat/components/message-item.tsx`, but verify before editing. For Weixin/Feishu, prefer the shared response formatter or gateway message formatter if one exists.

- [x] **Step 6: Add Web UI common-response rendering test**

In the verified Web UI test file, add a test that renders a governed-query result with the common response shape:

```json
{
  "columns": ["amount_wan"],
  "display_columns": ["金额（万元）"],
  "rows": [{"amount_wan": 12.5}],
  "column_metadata": {
    "amount_wan": {
      "display_name_zh": "金额（万元）",
      "unit": "CNY_10K",
      "legacy_alias": "amount_万"
    }
  }
}
```

Expected assertion: the rendered table/header shows `金额（万元）` from `display_columns` and does not require `amount_万` as the machine key.

- [x] **Step 7: Implement Web UI common-response consumption**

In the verified Web UI render component, render table headers from `display_columns[index]` while preserving `columns[index]` as the row lookup key.

Required behavior:

```text
visible header: display_columns[index] or columns[index]
row lookup key: columns[index]
fallback header when display_columns is missing: amount_wan
```

- [x] **Step 8: Locate Weixin and Feishu outbound formatting paths**

Run:

```bash
rg -n "weixin|feishu|send_message|tool result|governed_query|column_metadata|markdown|table" src hermes-agent -S
```

Expected: identify the shared or platform-specific place where outbound assistant/tool summaries are converted for Weixin and Feishu.

- [x] **Step 9: Add gateway formatting tests**

Add tests for Weixin and Feishu formatting in the matching test file(s). Each test should feed a governed-query result with `columns`, `display_columns`, `rows`, and `column_metadata`, and assert user-facing output uses `display_columns`.

Minimum assertions:

```python
assert "金额（万元）" in rendered_text
assert "amount_万" not in rendered_text
```

Do not assert that `amount_wan` is absent from machine payload logs or debug metadata; the point is user-facing message text.

- [x] **Step 10: Implement shared gateway common-response consumption**

Apply the same consumption rule in the shared formatter used by Web/API, Weixin, and Feishu:

```text
visible header = display_columns[index] if present else columns[index]
machine key = columns[index]
```

If Weixin and Feishu use different formatters, implement a tiny shared helper in Semantier-owned code that consumes the common response shape and call it from both paths. Do not duplicate metadata lookup or label derivation in channel-specific code.

- [x] **Step 11: Run UI and gateway tests**

Run the targeted tests identified in Steps 6 and 9. Also run:

```bash
pytest -q tests/test_smb_analytics_tool.py
```

Expected: all targeted presentation tests and governed analytics tests pass.

- [x] **Step 12: Commit**

```bash
git add src/plugins/business_analytics/__init__.py tests/test_smb_analytics_tool.py hermes-workspace/src src/agents hermes-agent
git commit -m "feat: render governed analytics labels from metadata"
```

### Task 7: Record The Compatibility-Breaking Removal Gate

**Files:**
- Modify: `docs/superpowers/plans/2026-06-14-ascii-governed-schema-identifiers.md`

- [x] **Step 1: Verify this removal criteria section is present**

Confirm this section exists in this plan:

```md
## Legacy Alias Removal Criteria

Remove `_万` SQL/parquet aliases only after:

- governed-query skill examples have preferred ASCII aliases for at least one release,
- tests and bootstrap materialization pass with ASCII aliases only,
- saved/demo query fixtures have been migrated or marked legacy,
- lakehouse manifest version has been bumped,
- release notes document the compatibility break.
```

- [x] **Step 2: Create the follow-up removal plan**

Create a separate follow-up plan named:

```text
docs/superpowers/plans/2026-06-21-remove-legacy-non-ascii-governed-aliases.md
```

The follow-up plan must start with a failing test that removes the allowlist from `tests/test_schema_identifier_law.py`:

```python
    assert offenders == []
```

- [x] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-06-14-ascii-governed-schema-identifiers.md docs/superpowers/plans/2026-06-21-remove-legacy-non-ascii-governed-aliases.md
git commit -m "docs: plan legacy non-ascii schema alias removal"
```

## Legacy Alias Removal Criteria

Remove `_万` SQL/parquet aliases only after:

- governed-query skill examples have preferred ASCII aliases for at least one release,
- tests and bootstrap materialization pass with ASCII aliases only,
- saved/demo query fixtures have been migrated or marked legacy,
- lakehouse manifest version has been bumped,
- release notes document the compatibility break.

## Self-Review

Spec coverage:

- Impact radius is covered in the `Impact Radius` section.
- Test-first migration is covered by Tasks 1, 2, and 3.
- Guarded compatibility is covered by additive aliases and a legacy allowlist.
- SQL generation phase is covered by Task 5.
- Common Web UI, Weixin, and Feishu presentation labeling is covered by Task 6.
- Full removal is intentionally deferred to Task 7 and a follow-up compatibility-breaking plan.

Placeholder scan:

- No deferred-marker or unspecified implementation steps remain.
- Every code-changing task includes exact files, code snippets, test commands, expected results, and commit commands.

Type consistency:

- ASCII alias names are consistently `amount_wan`, `revenue_wan`, `cost_wan`, `debit_wan`, `credit_wan`, and `net_wan`.
