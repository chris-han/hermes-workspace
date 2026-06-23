# Real Company Full Data Context Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic real-company setup workflow that turns promoted source files into governed REA facts, COA/projection readiness, lifecycle materialization, and governed-query readiness without weakening Semantier authority boundaries.

**Architecture:** Semantier core owns the readiness state machine, authority checks, REA admission, COA activation, projection, lifecycle materialization, lakehouse readiness, replay, and audit pins. The `real_company_onboarding` Semantier Hermes plugin is workflow glue only: it exposes tool wrappers and dashboard adapters that call core services. Uploaded files remain source artifacts until core admission writes governed records.

**Tech Stack:** Python/FastAPI gateway, EOS SQLite stores, DuckDB/lakehouse views, Semantier Hermes marketplace plugin package under `semantier-skills/plugins/`, React settings UI, pytest.

---

## Goal Details

When a user switches to a real company such as display name `真实索阳` (`organization_id = Soyon_Real`) and uploads CSV/XLS/XLSX operating data, Semantier should provide a deterministic setup workflow that creates the full real-company data context:

- active real-company dataset binding
- COA and projection bundle readiness
- admitted REA claims from uploaded source rows
- source document review artifacts where source evidence exists
- journal voucher projections, ledger views, financial statement packages, tax filing packages, and archive packages where the input supports them
- KM lifecycle artifacts needed for the organization's active policy/projection context
- refreshed lakehouse/governed-query readiness
- clear user-facing setup state when any required stage is incomplete

## Debugging Findings From `session_8815180739be`

Session:

- Workspace: `3f40097f9d46422a8a56609334c5fb4a`
- Session path: `workspaces/3f40097f9d46422a8a56609334c5fb4a/sessions/session_8815180739be`
- Active user/org context in auth store:
  - `user_id = 3f40097f9d46422a8a56609334c5fb4a`
  - `organization_id = Soyon_Real`
  - display name `真实索阳`
  - `dataset_type = REAL`
  - `active_dataset_version_id = dsv_0a68ebdcb9cc4d309c8b8853a321b1f5`

Observed facts:

- The exact session directory has no stored files under `uploads/`; it contains logs and one run record.
- Real-company CSV artifacts do exist under `.semantier-home/artifacts/company_dataset_imports/Soyon_Real/...`.
- `company_dataset_imports` has promoted imports for `Soyon_Real`, and `organization_dataset_versions` has active versions.
- The current import promotion flow creates dataset version metadata and artifact manifests, but it does not create `rea_claims` for `Soyon_Real`.
- `rea_claims` currently has zero rows for `Soyon_Real`.
- COA and full-cycle accounting tables have rows for demo/sample orgs, but not for `Soyon_Real`.
- The session transcript hit `LAKEHOUSE_STALE_EOS` from `governed_query`, so even promoted metadata was not enough to produce a queryable real-company analytics context.

Root cause hypothesis:

The system has a real-company dataset upload/promote path, but it is only a file-manifest promotion path. It does not yet run a governed real-company setup workflow that admits uploaded rows as REA claims, initializes org-specific COA/projection/KM lifecycle artifacts, materializes downstream accounting lifecycle outputs, and refreshes the governed query/lakehouse surface.

## Architecture Position

I agree with the product expectation, with one important boundary:

Uploaded CSV rows should not automatically become authority merely because they were uploaded. They should be treated as source artifacts and candidate inputs. A setup workflow should parse and validate them, then explicitly admit supported rows into governed `rea_claims` with deterministic hashes, provenance, org scope, dataset version, and replay/audit pins.

This follows the canonical architecture:

- Law 1: organization authority comes from governed identity, not user self-claim or prompt memory.
- Law 2: persisted timestamps must be timezone-aware UTC ISO-8601.
- Law 3: prompt guidance belongs in `src/prompts/`.
- Law 4: runtime-owned schema identifiers must be ASCII-stable.
- COA onboarding creates the organization-specific projection taxonomy and initial projection bundle.
- Retrieved or uploaded source material is candidate input until admitted through governance.
- Replay, explainability, audit packaging, and external verification must be deterministic and artifact-pinned.

## Plugin Packaging Decision

Create a shared built-in Semantier Hermes plugin named `real_company_onboarding` to facilitate the workflow from promoted files to a ready real-company data context.

Ownership resolution:

- `src/plugins/real_company_onboarding` is both a shared built-in plugin package and the source of its bundled runtime `SKILL.md`.
- The plugin package is not a second source of truth for real-company setup state, governance, admission, projection, replay, or audit behavior.
- The bundled `SKILL.md` describes when agents should use the registered plugin tools; it must not define semantic policy that belongs in core or in `src/prompts/`.
- Backend APIs remain first-class and must work without the plugin installed. The plugin calls the same core services and exposes them to Hermes/tool users.

Plugin purpose:

- expose one coherent toolset for real-company setup operations
- show setup status and next actions in chat/API/dashboard contexts
- route user-triggered actions into Semantier core services
- provide deterministic workflow orchestration for upload/import/admission/materialization readiness

Plugin non-goals:

- no semantic authority decisions in plugin glue
- no direct unmanaged SQLite/file fallback for governed state
- no prompt-memory or user-claim authority
- no live LLM/OCR/parser dependency in replay or audit paths
- no plugin-owned COA, projection, replay, audit, or KM governance source of truth

Boundary:

```text
src/plugins/real_company_onboarding/
  = tool wrappers, dashboard adapter, user-facing setup workflow surface

src/eos/ and src/agents/
  = authoritative admission, COA activation, projection, lifecycle materialization,
    lakehouse readiness, auth/context checks, governed stores, replay/audit pins
```

Proposed toolset id:

```text
real_company_onboarding
```

Proposed plugin tools:

- `real_company_setup_status`
- `real_company_reconcile_promoted_imports`
- `real_company_legacy_claims_report`
- `real_company_preview_source_rows`
- `real_company_admit_rea_claims`
- `real_company_bootstrap_coa`
- `real_company_materialize_lifecycle`
- `real_company_refresh_lakehouse`
- `real_company_run_setup`

Tool behavior:

- Every tool resolves active organization and membership from trusted gateway/runtime context.
- Every tool returns a stable JSON envelope with `ok`, `setup_status`, `blocking_reasons`, `result`, and `next_actions`.
- Write tools require idempotency keys.
- Write tools call Semantier core services; they do not implement authority-bearing logic locally.
- Missing active organization, missing active dataset version, missing admin capability, stale lakehouse, and unsupported data must return explicit typed errors.

Suggested plugin package files:

```text
src/plugins/real_company_onboarding/
├── SKILL.md
├── __init__.py
├── plugin.yaml
├── tools.py
└── dashboard/
    └── plugin_api.py
```

Marketplace/install surfaces:

- add `real_company_onboarding` to launcher shared runtime defaults instead of marketplace install metadata
- add it to `semantier-skills/README.md`
- add plugin package inventory tests
- add runtime inventory tests proving `list_plugins_inventory()` and `list_toolsets_inventory()` expose the tool names

The plugin should be installable and callable, but the setup must also remain reachable through normal backend APIs so UI flows do not depend on agent chat being present.

## Authoritative Setup State Machine

The setup status model must be one deterministic core contract, not scattered route/plugin/UI checks.

Create a single evaluator in Semantier core, for example:

```text
src/eos/real_company_setup_state.py
```

The evaluator should expose a pure function shape equivalent to:

```python
def evaluate_real_company_setup_state(snapshot: RealCompanySetupSnapshot) -> RealCompanySetupStatus:
    ...
```

The snapshot may be collected by gateway/store services, but precedence and status selection must live in the evaluator. Gateway routes, plugin tools, prompt assembly, and UI payloads consume the evaluator output without recomputing status.

Status precedence, first match wins:

1. `REAL_SETUP_FAILED`: any active setup/admission/projection/materialization job has a terminal failure that requires operator or user action.
2. `REAL_EMPTY`: active organization is `REAL` but has no active dataset version and no promoted import.
3. `REAL_IMPORTED`: active dataset version exists, but normalized/classified source-row snapshot has not been created yet.
4. `REAL_REA_ADMISSION_REQUIRED`: classified source rows exist, but active dataset version has no admitted `rea_claims`.
5. `REAL_COA_REQUIRED`: admitted REA claims exist, but no active org-scoped COA/projection bundle is available for the active dataset version.
6. `REAL_PROJECTION_REQUIRED`: active COA/projection bundle exists, but admitted REA claims have no current projection result or have unresolved projection exceptions blocking lifecycle materialization.
7. `REAL_LIFECYCLE_MATERIALIZATION_REQUIRED`: projection is current, but required lifecycle artifacts are missing for periods supported by the input data.
8. `REAL_LAKEHOUSE_STALE`: EOS setup artifacts are current, but lakehouse/governed-query materialization is stale or missing.
9. `REAL_READY`: active dataset version has admitted REA claims, active COA/projection readiness, current lifecycle artifacts for supported periods, and a current governed-query/lakehouse surface.

The evaluator must also return all observed blockers in `blocking_reasons`, even when `setup_status` is the highest-priority blocker. This lets UI show complete context without changing the authoritative state.

Required invariant:

```text
same governed snapshot -> same setup_status, blocking_reasons, counts, next_actions
```

No gateway route, plugin tool, prompt asset, or UI component may independently derive the primary `setup_status`.

## Persisted Setup Run And Readiness Events

Readiness failure and staleness must come from governed persisted state, not ad hoc timestamp comparisons scattered across route, plugin, and UI code.

Create a Semantier-owned setup run/event store in core, for example:

```text
src/eos/real_company_setup_store.py
```

Minimum tables:

```text
real_company_setup_runs
real_company_setup_events
```

Required run fields:

- `setup_run_id`
- `organization_id`
- `dataset_version_id`
- `requested_by`
- `idempotency_key`
- `status`
- `current_stage`
- `started_at`
- `updated_at`
- `completed_at`
- `error_category`
- `error_code`
- `error_message`
- `retry_after`
- `lock_token`
- `lock_owner`
- `lock_acquired_at`
- `content_hash`

Allowed run statuses:

- `queued`
- `running`
- `blocked`
- `succeeded`
- `failed`
- `cancelled`

Required event fields:

- `event_id`
- `setup_run_id`
- `organization_id`
- `dataset_version_id`
- `stage`
- `event_type`
- `event_status`
- `message`
- `details_json`
- `created_at`
- `content_hash`

Failure versus staleness contract:

- `REAL_SETUP_FAILED` is selected only from persisted terminal failure state: a setup run with `status = failed`, or a stage event with `event_status = failed` and an `error_category` that is not retry-safe without operator/user action.
- `REAL_LAKEHOUSE_STALE` is selected when EOS setup artifacts are current but the persisted lakehouse/readiness marker does not match the current EOS/database content hash or the active dataset version.
- A long-running stage is not automatically failed by wall-clock age. It becomes `blocked` or `failed` only through a persisted setup event written by core.
- Staleness markers must record the compared hashes or version identifiers in `details_json`; the evaluator should read those persisted markers rather than recomputing a separate policy.

This store is append-oriented for events. A run row may update status/current pointers, but historical events are append-only.

Setup run lock contract:

- Reconciliation, admission, COA bootstrap, projection, lifecycle materialization, and lakehouse refresh must acquire the same per-`(organization_id, dataset_version_id)` setup run lock before writing.
- Lock acquisition must be a SQLite transaction or compare-and-swap update against `real_company_setup_runs`; it must not be an in-memory mutex.
- At most one run may be in a write-capable state for a given `(organization_id, dataset_version_id)`.
- Concurrent attempts with the same `idempotency_key` must return the existing run state.
- Concurrent attempts with a different `idempotency_key` must fail with a typed retry-safe blocker such as `SETUP_RUN_LOCKED`, including the active `setup_run_id` and `current_stage`.
- A blocked or failed run must release write ownership through a persisted status transition before a retry can acquire the lock.
- Read-only setup status and legacy-claims reporting must not acquire the write lock.

## Real Dataset Analytics Scoping Contract

For `dataset_type = REAL`, governed analytics must scope by both active organization and active dataset version.

Decision:

- Add version-qualified governed views rather than relying on optional compatibility behavior.
- `org_rea_claims` remains the normal user-facing view, but for REAL orgs it must filter to the active `dataset_version_id`.
- Historical/superseded dataset versions are not exposed through normal `org_*` views.
- Historical reads require explicit tenant-admin audit/version APIs or future version-qualified views with an explicit requested `dataset_version_id`.

Required schema/read contract:

- admitted real-company `rea_claims.claim_json` must contain ASCII key `dataset_version_id`
- governed/lakehouse `governed_rea_claims` must expose `dataset_version_id` as a column
- fallback SQL from `eos.rea_claims` must parse `dataset_version_id` from `claim_json`
- `org_rea_claims` must filter:
  - always by `org_id = active_organization_id`
  - additionally by `dataset_version_id = active_dataset_version_id` when `dataset_type = REAL`
  - not by dataset version for demo/sample orgs unless those datasets later adopt the same versioning contract

Compatibility rule:

If a REAL org has an active dataset version but existing claims do not carry `dataset_version_id`, normal analytics must fail closed with:

```text
setup_status = REAL_SETUP_FAILED
error_category = migration_required
error_code = LEGACY_REAL_CLAIMS_UNVERSIONED
```

The setup status response must include a `blocking_reasons[]` entry with `code = LEGACY_REAL_CLAIMS_UNVERSIONED`, the affected `organization_id`, active `dataset_version_id`, and a count of unversioned candidate claims. It must not silently return unversioned real-company claims.

Repair path:

- Add a read-only core diagnostic and plugin wrapper named `real_company_legacy_claims_report`.
- The report may count and fingerprint affected claims, but it must not assign `dataset_version_id` or mutate claims.
- Any future repair tool that assigns versions to legacy claims must be tenant-admin/operator gated, explicit, idempotent, audit-pinned, and out of the normal analytics read path.

This removes the ambiguity around the current org-only `org_rea_claims` filter in `src/plugins/business_analytics/__init__.py` and prevents cross-version exposure after repeated imports/promotions.

## Target Workflow

### Stage 0: Readiness Snapshot

Add a backend-computed setup state for the active organization.

State fields:

- `organization_id`
- `organization_name`
- `dataset_type`
- `active_dataset_version_id`
- `latest_import_id`
- `import_status`
- `setup_status`
- `blocking_reasons`
- `counts`
- `next_actions`

Initial `setup_status` values:

- `REAL_EMPTY`
- `REAL_IMPORTED`
- `REAL_REA_ADMISSION_REQUIRED`
- `REAL_COA_REQUIRED`
- `REAL_PROJECTION_REQUIRED`
- `REAL_LIFECYCLE_MATERIALIZATION_REQUIRED`
- `REAL_LAKEHOUSE_STALE`
- `REAL_READY`
- `REAL_SETUP_FAILED`

### Stage 1: Dataset Import Completion

Keep the existing `company_dataset_imports` flow for file upload, validation, staging, and promotion.

Changes:

- Ensure promoted dataset versions expose row counts per file.
- Ensure active dataset version changes are reflected in the auth organization and active membership.
- Record import artifacts by hash only; do not rely on unmanaged workspace file paths for authority.
- Resolve stale or stuck states such as `promoting` imports that already created active dataset versions.

### Stage 1.5: Idempotent Backfill And Reconciliation

Add a reconciliation stage for real organizations that already have promoted imports or active dataset versions created before this workflow exists.

Backfill must:

- discover active and promoted `company_dataset_imports` for the active real organization
- discover active `organization_dataset_versions`
- acquire the per-`(organization_id, dataset_version_id)` setup run lock before creating snapshots, admission records, or materialization markers
- create missing normalized/classified source-row snapshots for the active dataset version
- create missing setup run/event records for the active dataset version
- admit missing governed REA claims only through the same admission service used for new imports
- never mutate historical import rows in place except for explicit compatibility repair fields that are documented and idempotent
- be safe to run repeatedly with the same idempotency key

Backfill must not:

- treat uploaded files as admitted facts without the admission step
- infer organization context from filenames or prompt memory
- silently change the active dataset version
- regenerate old dataset versions unless explicitly requested by an admin audit flow

For current local state, the target behavior is:

```text
Soyon_Real has active_dataset_version_id and promoted CSV artifacts
-> reconciliation creates normalized/classified source snapshots
-> setup status advances from REAL_IMPORTED to REAL_REA_ADMISSION_REQUIRED
-> admission can create version-qualified rea_claims
```

### Stage 2: Source Row Classification

For each active promoted dataset version, classify source rows into deterministic candidate row types.

Candidate row types:

- bank transaction
- sales invoice or receipt
- purchase invoice or receipt
- expense reimbursement
- payroll/social insurance
- tax payment or filing source
- customer/vendor master row
- COA row
- unknown or unsupported

Outputs:

- normalized source row records
- source row hashes
- field mapping profile hash
- parser profile hash
- classification result
- blocking data quality issues

All machine keys must be ASCII. Chinese labels from source files belong in metadata fields such as `display_name_zh`, `source_column_label`, or `localized_label`.

### Stage 3: Governed REA Admission

Add a real-company admission step that converts supported source rows into governed `rea_claims`.

Rules:

- Only active real-company members/admins may trigger admission.
- Every claim must carry `org_id = Soyon_Real` for this org, not `organization_id` alone.
- Every claim must carry `dataset_version_id`.
- Every claim must carry source provenance: `import_id`, `file_id`, `source_row_hash`, `source_file_hash`, and parser/profile hashes.
- Writes must be idempotent by `(organization_id, dataset_version_id, source_row_hash, admission_profile_hash)`.
- Claims are append-only. Re-imports create new dataset versions or supersede via governed activation, not in-place mutation.
- Unsupported rows become explicit admission exceptions, not silent drops.

Required tests:

- uploaded source rows do not appear in `org_rea_claims` before admission
- admitted rows are visible only for the active org and active dataset version
- cross-org query leakage is denied
- duplicate admission with the same idempotency key does not duplicate claims
- timestamps are UTC-aware ISO-8601

### Stage 4: COA Onboarding

Add or reuse a COA onboarding workflow for real companies.

Inputs:

- uploaded COA files when present
- default China accounting COA template when no uploaded COA is present
- inferred account usage from admitted REA rows
- organization metadata such as industry, currency, and fiscal year start

Outputs:

- `coa_versions`
- `coa_entries`
- projection bundle candidates
- active projection bundle after approval or bootstrap policy
- replay binding from active COA/projection bundle to dataset version

Rules:

- No candidate COA can be used at runtime before activation.
- COA activation must be org-scoped and deterministic.
- COA account codes are ASCII-stable machine identifiers; Chinese names are display metadata.
- If a real company has no approved COA, setup state must block projection with `REAL_COA_REQUIRED`.

### Stage 5: Projection And Exceptions

Project admitted REA claims into accounting outputs.

Outputs:

- source document reviews where evidence fields exist
- journal voucher projections
- projection exceptions for valid facts that cannot map to the active projection bundle
- explainability surfaces and replay pins for projection decisions

Rules:

- REA persistence gate remains independent from projection trust gate.
- A committed REA claim may exist even when projection fails.
- Projection failures must create `projection_exceptions`, not mutate or hide admitted REA claims.

### Stage 6: Full KM And Accounting Lifecycle Materialization

Materialize downstream lifecycle artifacts for the active dataset version.

Target outputs:

- `general_ledger_views`
- `cash_journal_views`
- `financial_statement_packages`
- `tax_filing_packages`
- `accounting_archive_packages`
- relevant `knowledge_artifacts`
- `policy_candidates`
- `kgl_approval_records`
- `policy_candidate_events`
- `replay_bindings`

Rules:

- KM lifecycle artifacts must remain governed Semantier core data, not plugin glue.
- Historical artifacts are append-only.
- If uploaded facts are insufficient for a lifecycle artifact, create a typed setup warning rather than fabricating data.

### Stage 7: Lakehouse And Governed Query Readiness

After EOS writes, refresh or invalidate the lakehouse deterministically.

Required behavior:

- If lakehouse materialization is available, run it after setup writes and update the manifest hash.
- If materialization cannot run synchronously, mark `setup_status = REAL_LAKEHOUSE_STALE` with an explicit operator action.
- `governed_query` should return clear readiness diagnostics for real companies:
  - no active dataset version
  - no admitted REA claims
  - no active COA
  - projection exceptions present
  - stale lakehouse
  - ready

## Implementation Tasks

### Task 1: Add Real-Company Setup Status API

Files:

- `src/agents/company_dataset_imports.py`
- `src/agents/webapi_gateway.py`
- `src/agents/route_policy.py`
- `docs/derived/gateway-unified-multitenant-design.md`
- tests under `tests/`

Work:

- Add a tenant-member route such as `GET /company-data-context/setup-status`.
- Create the core setup-state evaluator and use it as the only source of `setup_status` precedence.
- Compute a governed snapshot from auth context, dataset imports, active dataset version, `rea_claims`, COA tables, projection tables, lifecycle tables, and lakehouse manifest status, then pass that snapshot to the evaluator.
- Keep route output ASCII-stable.
- Add the route to `ROUTE_POLICY_MAP` as `AUTHENTICATED`.
- Add the route to `ROUTE_AUTHZ_CLASS_MAP` as `TENANT_MEMBER`.
- Add the route to `docs/derived/gateway-unified-multitenant-design.md` section `8.1.1`.
- Add parity coverage so route policy, authz class, and docs matrix cannot drift.
- Add regression tests for `REAL_EMPTY`, `REAL_IMPORTED`, `REAL_REA_ADMISSION_REQUIRED`, and `REAL_READY`.

### Task 2: Scaffold `real_company_onboarding` Plugin

Files:

- `src/plugins/real_company_onboarding/plugin.yaml`
- `src/plugins/real_company_onboarding/SKILL.md`
- `src/plugins/real_company_onboarding/__init__.py`
- `src/plugins/real_company_onboarding/tools.py`
- `src/plugins/real_company_onboarding/dashboard/plugin_api.py`
- `semantier-skills/marketplace/index.json`
- `semantier-skills/README.md`
- plugin inventory and marketplace tests

Work:

- Add the marketplace-style plugin package using ASCII snake_case names.
- Register the `real_company_onboarding` toolset.
- Implement initial read-only `real_company_setup_status` by calling the core setup status service from Task 1.
- Add a bundled `SKILL.md` that instructs agents to use registered tools and forbids raw DB/file workarounds.
- Add tests proving plugin package contents, marketplace metadata, and runtime inventory visibility.

### Task 3: Add Setup Run/Event Store And Reconciliation Contract

Files:

- create `src/eos/real_company_setup_store.py`
- modify `src/agents/company_dataset_imports.py`
- modify `src/plugins/real_company_onboarding/tools.py`
- tests under `tests/`

Work:

- Add `real_company_setup_runs` and `real_company_setup_events` with UTC-aware timestamps and content hashes.
- Add idempotent creation/update helpers keyed by `(organization_id, dataset_version_id, idempotency_key)`.
- Add transactional setup run lock helpers keyed by `(organization_id, dataset_version_id)` with `SETUP_RUN_LOCKED` retry-safe responses for competing writes.
- Add append-only setup event recording.
- Add core helpers that mark retry-safe blockers, terminal failures, and lakehouse stale markers.
- Add `real_company_reconcile_promoted_imports` as a public plugin wrapper over the core reconciliation service.
- Add `real_company_legacy_claims_report` as a read-only plugin wrapper over the core legacy-claims diagnostic.
- Make `real_company_run_setup` call the same core reconciliation service as its first stage when promoted imports already exist.
- Add tests proving repeated reconciliation for `Soyon_Real`-shaped promoted imports creates one setup run and no duplicate events/claims.
- Add tests proving concurrent reconciliation/admission attempts for the same org/version serialize through the setup run lock.

### Task 4: Add Source Row Normalization And Classification Store

Files:

- new or existing Semantier core module under `src/eos/`
- `src/agents/company_dataset_imports.py`
- `src/plugins/real_company_onboarding/tools.py`
- tests under `tests/`

Work:

- Read active dataset version artifact manifests.
- Normalize CSV/XLS rows through deterministic parser profiles.
- Store normalized row hashes and classification results.
- Do not write `rea_claims` in this task.
- Expose `real_company_preview_source_rows` as a plugin wrapper over the core service.
- Ensure reconciliation can create missing normalized/classified snapshots for already-promoted imports.

### Task 5: Add Governed REA Admission

Files:

- Semantier core admission module under `src/eos/`
- `src/agents/company_dataset_imports.py`
- `src/plugins/real_company_onboarding/tools.py`
- tests under `tests/`

Work:

- Convert supported normalized rows into `rea_claims`.
- Include `org_id`, `dataset_version_id`, source hashes, parser profile hash, and admission profile hash.
- Add idempotency and duplicate prevention.
- Create admission exception rows for unsupported inputs.
- Expose `real_company_admit_rea_claims` as a plugin wrapper over the core service.
- Add tests proving unversioned REAL claims do not appear through normal analytics.

### Task 6: Add Real-Company COA Bootstrap

Files:

- COA onboarding modules under `src/eos/`
- relevant prompt assets under `src/prompts/` only if user-facing prompt guidance changes
- `src/plugins/real_company_onboarding/tools.py`
- tests under `tests/`

Work:

- Create or activate a default org-scoped COA when no uploaded COA exists.
- Ingest uploaded COA candidates when present.
- Persist COA/projection bundle activation and replay bindings.
- Block projection until active COA/projection bundle exists.
- Expose `real_company_bootstrap_coa` as a plugin wrapper over the core service.

### Task 7: Wire Projection And Full-Cycle Materialization

Files:

- existing projection/materialization modules under `src/eos/`
- `src/agents/company_dataset_imports.py`
- `src/plugins/real_company_onboarding/tools.py`
- tests under `tests/`

Work:

- Project admitted claims into journal vouchers.
- Create projection exceptions where mapping is incomplete.
- Materialize ledger, statement, tax, and archive packages where supported by data.
- Preserve deterministic hashes and replay pins.
- Expose `real_company_materialize_lifecycle` as a plugin wrapper over the core service.

### Task 8: Refresh Lakehouse And Improve Readiness Errors

Files:

- lakehouse materialization code
- `src/plugins/business_analytics/__init__.py`
- `src/plugins/real_company_onboarding/tools.py`
- tests under `tests/test_smb_analytics_tool.py` or focused new tests

Work:

- Refresh lakehouse after real-company setup writes when possible.
- Improve `governed_query` diagnostics for stale or incomplete real-company setup.
- Ensure `org_rea_claims` filters by active organization and, for REAL datasets, active dataset version.
- Add `dataset_version_id` to `governed_rea_claims` and the fallback `eos.rea_claims` path.
- Add tests for repeated imports/promotions proving normal analytics returns only the active dataset version and does not expose superseded versions.
- Add tests proving REAL orgs with unversioned legacy claims fail closed with `LEGACY_REAL_CLAIMS_UNVERSIONED` and do not expose those rows in `org_rea_claims`.
- Expose `real_company_refresh_lakehouse` as a plugin wrapper over the core service.
- Persist lakehouse freshness/staleness markers through the setup event store so the evaluator can distinguish `REAL_LAKEHOUSE_STALE` from `REAL_SETUP_FAILED`.

### Task 9: Add One-Shot Setup Orchestration Tool

Files:

- `src/eos/` setup orchestration service
- `src/plugins/real_company_onboarding/tools.py`
- tests under `tests/`

Work:

- Add `real_company_run_setup` as a deterministic state-machine orchestrator.
- Run reconciliation/backfill first when the active real org already has promoted imports or an active dataset version.
- Execute only stages that are ready and needed.
- Return after the first blocker with exact `setup_status`, `blocking_reasons`, and `next_actions`.
- Keep write operations idempotent.
- Do not hide projection exceptions or fabricate unsupported lifecycle outputs.

### Task 10: UI/Prompt Integration

Files:

- `hermes-workspace/src/screens/settings/data-connections-screen.tsx`
- company dataset import panel files
- `src/prompts/agents/ACTIVE_ORGANIZATION_CONTEXT.md` or a new prompt asset if needed
- tests

Work:

- Show setup status after switching to real company.
- Distinguish file import promoted from REA/admission/projected readiness.
- Avoid saying “no data bound yet” when files are promoted but REA admission is pending.
- Suggested user-facing state: “CSV files are uploaded and promoted as source artifacts, but setup still needs REA admission and COA/projection activation before analytics can answer from real-company facts.”

## Acceptance Criteria

- Switching to `Soyon_Real` never falls back to demo org data.
- One core setup-state evaluator is the only source of primary `setup_status` and precedence.
- Persisted setup run/event rows are the source of truth for terminal failure versus retry-safe blocker versus lakehouse staleness.
- The setup-status route is present in `ROUTE_POLICY_MAP`, `ROUTE_AUTHZ_CLASS_MAP`, and the gateway route matrix docs with parity tests.
- Uploaded CSV files become visible as source artifacts after promotion.
- Already-promoted real-company imports can be reconciled idempotently into normalized/classified snapshots without manual DB edits.
- Reconciliation and other write stages are serialized by a persisted per-org/version setup run lock.
- REAL orgs with unversioned legacy claims fail closed with `LEGACY_REAL_CLAIMS_UNVERSIONED` and expose only a read-only diagnostic/report path until an explicit audited repair exists.
- They do not become `org_rea_claims` until governed REA admission runs.
- After setup completes, `org_rea_claims` for `Soyon_Real` returns only admitted facts for the active `dataset_version_id` through governed query.
- Superseded real-company dataset versions are hidden from normal `org_*` analytics views and are available only through explicit audit/version surfaces.
- COA/projection/lifecycle readiness is visible and org-scoped.
- Stale lakehouse is detected and repaired or surfaced as a clear setup blocker.
- All new persisted timestamps are timezone-aware UTC ISO-8601.
- All new runtime-owned machine identifiers are ASCII-stable.
- Replay/audit paths remain deterministic and do not introduce live LLM/OCR/parser dependencies.

## Suggested First Test Scenario

Use the current local data as the regression fixture shape:

1. Active org is `Soyon_Real` / `真实索阳`.
2. Active dataset version exists.
3. Promoted imports include `historydetail439.csv`, `historydetail441.csv`, and `historydetail443.csv`.
4. `rea_claims` has zero rows for `Soyon_Real`.
5. Initial setup status returns `REAL_IMPORTED` if no normalized/classified snapshot exists yet.
6. Running reconciliation creates one setup run and normalized/classified snapshots without duplicating import records.
7. Setup status advances to `REAL_REA_ADMISSION_REQUIRED`.
8. Running admission creates deterministic `rea_claims` for supported rows.
9. Setup then advances to `REAL_COA_REQUIRED` or `REAL_PROJECTION_REQUIRED`, depending on COA availability.
10. After COA/projection/materialization/lakehouse refresh, setup status returns `REAL_READY`.
