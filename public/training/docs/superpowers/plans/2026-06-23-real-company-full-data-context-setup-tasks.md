# Real Company Full Data Context Setup Task List

Source plan: [2026-06-23-real-company-full-data-context-setup.md](2026-06-23-real-company-full-data-context-setup.md)

> **For agentic workers:** Execute this checklist task-by-task. Use `superpowers:subagent-driven-development` for independent implementation slices or `superpowers:executing-plans` for inline execution with review checkpoints. Keep checkboxes updated as work lands.

**Goal:** Implement and test the deterministic real-company setup workflow from promoted source files to governed REA, COA/projection, lifecycle, lakehouse, and governed-query readiness.

**Architecture guardrails:**

- Semantier core owns authority, setup state, persisted setup events, admission, COA/projection, materialization, lakehouse readiness, replay, and audit pins.
- The `real_company_onboarding` plugin is workflow glue only; it must call core services and must not become an authority-bearing implementation.
- Runtime-owned schema identifiers and API fields must be ASCII-stable.
- New persisted runtime timestamps must be timezone-aware UTC ISO-8601.
- Replay/audit paths must remain deterministic and must not add live LLM/OCR/parser dependencies.

---

## Preflight

- [x] Read [docs/canonical/architecture.md](../../canonical/architecture.md) and confirm the implementation preserves Laws 1-4.
- [x] Read [docs/derived/knowledge_tier_implementation_spec.md](../../derived/knowledge_tier_implementation_spec.md) before touching knowledge artifacts, policy candidates, replay bindings, or governance transitions.
- [x] Inspect the current relevant code paths:
  - [x] `src/agents/company_dataset_imports.py`
  - [x] `src/agents/webapi_gateway.py`
  - [x] `src/agents/route_policy.py`
  - [x] `src/plugins/business_analytics/__init__.py`
  - [x] existing COA/projection/materialization modules under `src/eos/`
  - [x] plugin inventory and marketplace code under `semantier-skills/`
- [x] Capture baseline state with `git status --short`.
- [x] Run the current focused tests before edits:

```bash
pytest -v tests/test_agents_launcher.py
pytest -v tests/test_smb_analytics_tool.py
```

---

## Task 1: Core Setup Status Contract And API

**Files:**

- Create: `src/eos/real_company_setup_state.py`
- Modify: `src/agents/company_dataset_imports.py`
- Modify: `src/agents/webapi_gateway.py`
- Modify: `src/agents/route_policy.py`
- Modify: `docs/derived/gateway-unified-multitenant-design.md`
- Test: focused tests under `tests/`

**Implementation checklist:**

- [x] Add immutable or dataclass-style snapshot/status models for real-company setup state.
- [x] Implement `evaluate_real_company_setup_state(snapshot)` as the only source of primary `setup_status` precedence.
- [x] Return all observed blockers in `blocking_reasons`, even when only the highest-priority blocker becomes `setup_status`.
- [x] Add a core snapshot collector that reads governed/authenticated state from active organization, active dataset version, imports, REA claims, COA/projection tables, lifecycle artifacts, and lakehouse readiness markers.
- [x] Add `GET /company-data-context/setup-status`.
- [x] Update `_organization_payload_for_context()` so the organization switch payload exposes the same core setup-state contract used by the new setup-status route.
- [x] Replace or formally deprecate the legacy organization-level `authority_state` emitted from `company_dataset_imports.authority_state_for()` for REAL organizations; it must not remain an overlapping source of truth for readiness.
- [x] If `authority_state` must remain temporarily for backwards compatibility, emit it only as a derived alias of `setup_status`, add `authority_state_deprecated: true`, and add `authority_state_remove_after: "2026-07-31"` to the organization payload contract.
- [x] Add a removal follow-up in the task file or issue tracker for deleting REAL `authority_state` handling from `_organization_payload_for_context()`, `company_dataset_imports.authority_state_for()`, and frontend consumers before or on `2026-07-31`.
- [x] Add the route to `ROUTE_POLICY_MAP` as `AUTHENTICATED`.
- [x] Add the route to `ROUTE_AUTHZ_CLASS_MAP` as `TENANT_MEMBER`.
- [x] Update gateway route matrix docs section `8.1.1`.
- [x] Add parity coverage so route policy, authz class, and docs matrix cannot drift.

Follow-up: delete REAL `authority_state` compatibility handling from `_organization_payload_for_context()`, restrict `company_dataset_imports.authority_state_for()` to import-row legacy display only, and remove frontend consumers before or on `2026-07-31`.

**Required tests:**

- [x] `REAL_EMPTY`: real organization with no active dataset version and no promoted import.
- [x] `REAL_IMPORTED`: active dataset version exists but no normalized/classified source snapshot exists.
- [x] `REAL_REA_ADMISSION_REQUIRED`: classified source rows exist but no admitted claims exist for the active version.
- [x] `REAL_READY`: active version has admitted claims, active COA/projection readiness, lifecycle artifacts, and current lakehouse marker.
- [x] Determinism: same snapshot returns the same `setup_status`, blocker ordering, counts, and next actions.
- [x] Route authz: unauthenticated access is rejected; tenant member access is accepted.
- [x] Organization switch payload and setup-status route return the same `setup_status` and `blocking_reasons` for the same request context.
- [x] REAL organization payload no longer reports `REAL_PROMOTED` as if it were analytics-ready when REA admission, COA/projection, lifecycle, or lakehouse readiness is incomplete.
- [x] Frontend and backend tests fail if any REAL-company readiness branch uses `authority_state` instead of `setup_status`.
- [x] Static or focused regression coverage proves `authority_state_for()` is used only for import-row legacy display or temporary derived compatibility, not for primary organization readiness.

**Verification:**

```bash
pytest -v tests -k "real_company_setup_state or setup_status or route_policy"
```

**Done when:**

- [x] No route, plugin, prompt, or UI code independently derives the primary setup status.
- [x] UI-facing organization context has one readiness source: the core setup evaluator.
- [x] The compatibility `authority_state` field has a dated removal milestone and cannot drive readiness decisions in tests.
- [x] Setup status payload uses ASCII-stable machine keys.

---

## Task 2: `real_company_onboarding` Plugin Scaffold

**Files:**

- Create: `src/plugins/real_company_onboarding/plugin.yaml`
- Create: `src/plugins/real_company_onboarding/SKILL.md`
- Create: `src/plugins/real_company_onboarding/__init__.py`
- Create: `src/plugins/real_company_onboarding/tools.py`
- Create: `src/plugins/real_company_onboarding/dashboard/plugin_api.py`
- Modify: launcher shared runtime plugin defaults
- Modify: `semantier-skills/README.md`
- Test: plugin inventory and marketplace tests under `tests/`

**Implementation checklist:**

- [x] Create the shared built-in plugin package using ASCII snake_case identifiers.
- [x] Register toolset id `real_company_onboarding`.
- [x] Implement read-only `real_company_setup_status` by calling the core service from Task 1.
- [x] Return a stable JSON envelope with `ok`, `setup_status`, `blocking_reasons`, `result`, and `next_actions`.
- [x] Write `SKILL.md` to direct agents to plugin tools and forbid raw DB/file fallback workarounds.
- [x] Add shared built-in launcher/runtime inventory metadata.
- [x] Add runtime inventory coverage for `list_plugins_inventory()` and `list_toolsets_inventory()`.

**Required tests:**

- [x] Plugin package contains manifest, tool module, dashboard adapter, and bundled skill.
- [x] Marketplace index does not expose `real_company_onboarding`; launcher installs it as a shared built-in plugin.
- [x] Runtime inventory exposes the plugin and the `real_company_setup_status` tool.
- [x] Plugin status tool delegates to core setup status and does not compute status precedence locally.

**Verification:**

```bash
pytest -v tests -k "plugin_inventory or marketplace or real_company_onboarding"
```

**Done when:**

- [x] Plugin is installable/callable but backend setup status remains available without the plugin.

---

## Task 3: Setup Run/Event Store And Reconciliation Contract

**Files:**

- Create: `src/eos/real_company_setup_store.py`
- Modify: `src/agents/company_dataset_imports.py`
- Modify: `src/plugins/real_company_onboarding/tools.py`
- Test: focused setup-store and reconciliation tests under `tests/`

**Implementation checklist:**

- [x] Add `real_company_setup_runs`.
- [x] Add `real_company_setup_events`.
- [x] Persist run fields listed in the source plan, including `setup_run_id`, `organization_id`, `dataset_version_id`, `requested_by`, `idempotency_key`, status fields, lock fields, timestamps, and `content_hash`.
- [x] Persist event fields listed in the source plan, including `event_id`, `setup_run_id`, `stage`, `event_type`, `event_status`, `details_json`, `created_at`, and `content_hash`.
- [x] Use timezone-aware UTC ISO-8601 timestamps for all setup run/event writes.
- [x] Implement idempotent run helpers keyed by `(organization_id, dataset_version_id, idempotency_key)`.
- [x] Implement a SQLite transaction or compare-and-swap persisted lock keyed by `(organization_id, dataset_version_id)`.
- [x] Return typed retry-safe `SETUP_RUN_LOCKED` blockers for competing write attempts with different idempotency keys.
- [x] Keep setup events append-only.
- [x] Add persisted markers for retry-safe blockers, terminal failures, and lakehouse staleness.
- [x] Add core reconciliation service for already-promoted imports and active dataset versions.
- [x] Add plugin wrapper `real_company_reconcile_promoted_imports`.
- [x] Add read-only core diagnostic and plugin wrapper `real_company_legacy_claims_report`.
- [x] Ensure read-only status and legacy-claims reporting do not acquire the write lock.

**Required tests:**

- [x] Same idempotency key returns the existing run state.
- [x] Different idempotency key while a write lock is active returns `SETUP_RUN_LOCKED` with active `setup_run_id` and `current_stage`.
- [x] Blocked or failed runs release write ownership only through persisted status transitions.
- [x] Reconciliation for a `Soyon_Real`-shaped promoted import creates one setup run.
- [x] Repeated reconciliation does not duplicate setup runs, events, snapshots, or claims.
- [x] Terminal failure selection comes from persisted failed run/event state, not wall-clock age.

**Verification:**

```bash
pytest -v tests -k "real_company_setup_store or reconcile_promoted_imports or legacy_claims"
```

**Done when:**

- [x] Setup failure versus lakehouse staleness is represented by governed persisted state.

---

## Task 4: Source Row Normalization And Classification

**Files:**

- Create or modify: focused Semantier core module under `src/eos/`
- Modify: `src/agents/company_dataset_imports.py`
- Modify: `src/plugins/real_company_onboarding/tools.py`
- Test: focused source-row tests under `tests/`

**Implementation checklist:**

- [x] Read active dataset version artifact manifests by hash.
- [x] Normalize CSV/XLS/XLSX rows through deterministic parser profiles.
- [x] Store normalized source row records.
- [x] Store source row hashes.
- [x] Store field mapping profile hash and parser profile hash.
- [x] Store deterministic row classification.
- [x] Store blocking data quality issues.
- [x] Use ASCII machine keys for candidate row types and metadata fields.
- [x] Put Chinese source labels only in metadata such as `display_name_zh`, `source_column_label`, or `localized_label`.
- [x] Ensure this task does not write `rea_claims`.
- [x] Expose `real_company_preview_source_rows` as a plugin wrapper over the core service.
- [x] Make reconciliation create missing normalized/classified snapshots for already-promoted imports.

**Required tests:**

- [x] Promoted source artifacts produce stable row hashes across repeated runs.
- [x] Classification is deterministic for the same artifact manifest and parser profile.
- [x] Unsupported rows are retained as explicit classified/blocked rows, not dropped.
- [x] No `rea_claims` rows are created by normalization/classification.
- [x] Preview tool returns source row metadata without bypassing governed context.

**Verification:**

```bash
pytest -v tests -k "source_row or classification or preview_source_rows"
```

**Done when:**

- [x] Setup status can advance from `REAL_IMPORTED` to `REAL_REA_ADMISSION_REQUIRED` after snapshots exist.

---

## Task 5: Governed REA Admission

**Files:**

- Create or modify: Semantier core admission module under `src/eos/`
- Modify: `src/agents/company_dataset_imports.py`
- Modify: `src/plugins/real_company_onboarding/tools.py`
- Test: focused admission and analytics visibility tests under `tests/`

**Implementation checklist:**

- [x] Convert supported normalized rows into governed `rea_claims`.
- [x] Require active real-company member/admin capability before admission.
- [x] Set `org_id` on each admitted claim.
- [x] Set `dataset_version_id` on each admitted claim.
- [x] Include source provenance: `import_id`, `file_id`, `source_row_hash`, `source_file_hash`, parser profile hash, and admission profile hash.
- [x] Make writes idempotent by `(organization_id, dataset_version_id, source_row_hash, admission_profile_hash)`.
- [x] Create admission exception rows for unsupported inputs.
- [x] Keep admitted claims append-only.
- [x] Expose `real_company_admit_rea_claims` as a plugin wrapper over the core service.

**Required tests:**

- [x] Uploaded source rows do not appear in `org_rea_claims` before admission.
- [x] Admitted rows are visible only for the active organization and active dataset version.
- [x] Cross-org query leakage is denied.
- [x] Duplicate admission with the same idempotency key does not duplicate claims.
- [x] New admission timestamps are UTC-aware ISO-8601.
- [x] REAL orgs with unversioned legacy claims fail closed with `LEGACY_REAL_CLAIMS_UNVERSIONED`.

**Verification:**

```bash
pytest -v tests -k "rea_admission or org_rea_claims or legacy_real_claims"
```

**Done when:**

- [x] Source artifacts become facts only through governed admission.

---

## Task 6: Real-Company COA Bootstrap

**Files:**

- Create or modify: COA onboarding modules under `src/eos/`
- Modify: prompt assets under `src/prompts/` only if prompt wording changes
- Modify: `src/plugins/real_company_onboarding/tools.py`
- Test: focused COA/projection readiness tests under `tests/`

**Implementation checklist:**

- [x] Create or activate a default org-scoped China accounting COA when no uploaded COA exists.
- [x] Ingest uploaded COA candidates when present.
- [x] Store account codes as ASCII-stable machine identifiers.
- [x] Store Chinese account names as display metadata, not machine identifiers.
- [x] Persist active COA/projection bundle activation.
- [x] Persist replay binding from active COA/projection bundle to dataset version.
- [x] Block projection with `REAL_COA_REQUIRED` when no active COA/projection bundle exists.
- [x] Expose `real_company_bootstrap_coa` as a plugin wrapper over the core service.

**Required tests:**

- [x] Real company with admitted REA and no active COA returns `REAL_COA_REQUIRED`.
- [x] Default COA bootstrap creates org-scoped COA records and active projection bundle.
- [x] Uploaded COA candidate is not used at runtime before activation.
- [x] Replay binding includes the active dataset version.
- [x] COA bootstrap is idempotent for the same idempotency key.

**Verification:**

```bash
pytest -v tests -k "coa_bootstrap or real_company_coa or projection_bundle"
```

**Done when:**

- [x] Projection readiness is org-scoped and deterministic.

---

## Task 7: Projection And Full-Cycle Materialization

**Files:**

- Modify: existing projection/materialization modules under `src/eos/`
- Modify: `src/agents/company_dataset_imports.py`
- Modify: `src/plugins/real_company_onboarding/tools.py`
- Test: focused projection and lifecycle tests under `tests/`

**Implementation checklist:**

- [x] Project admitted claims into journal voucher projections.
- [x] Create source document review artifacts where source evidence fields exist.
- [x] Create projection exceptions for valid facts that cannot map to the active projection bundle.
- [x] Preserve REA persistence independently from projection trust state.
- [x] Materialize ledger, cash journal, financial statement, tax filing, and archive packages where supported by data.
- [x] Persist deterministic hashes and replay pins.
- [x] Persist relevant `knowledge_artifacts`, `policy_candidates`, `kgl_approval_records`, `policy_candidate_events`, and `replay_bindings`.
- [x] Emit typed setup warnings when uploaded facts are insufficient for lifecycle artifacts.
- [x] Expose `real_company_materialize_lifecycle` as a plugin wrapper over the core service.

**Required tests:**

- [x] Projection exceptions do not mutate or hide admitted REA claims.
- [x] Current projection result advances setup state past `REAL_PROJECTION_REQUIRED`.
- [x] Missing required lifecycle artifacts produce `REAL_LIFECYCLE_MATERIALIZATION_REQUIRED`.
- [x] Materialized lifecycle artifacts are scoped to active organization and active dataset version.
- [x] Historical artifacts are append-only.
- [x] Replay/audit materialization does not call live retrieval, LLM, OCR, or parser dependencies.

**Verification:**

```bash
pytest -v tests -k "projection_exception or lifecycle_materialization or replay_binding"
```

**Done when:**

- [x] Full-cycle accounting outputs are materialized only from admitted and projected governed facts.

---

## Task 8: Lakehouse Refresh And Governed Query Readiness

**Files:**

- Modify: `bootstrap/bootstrap_materialize_lakehouse.py`
- Modify: `src/eos/db.py`
- Modify: existing `rea_claims` writers, including `src/semantic_completion.py`, `src/eos/t6_materialization_store.py`, and the real-company admission module from Task 5
- Modify: `src/plugins/business_analytics/__init__.py`
- Modify: `src/plugins/real_company_onboarding/tools.py`
- Test: `tests/test_smb_analytics_tool.py` or focused new tests

**Implementation checklist:**

- [x] Add an EOS schema migration in `src/eos/db.py` for the version-qualified analytics contract. The migration must either add a `dataset_version_id` column to `rea_claims` with compatible legacy handling, or document and test the explicit claim-json-only contract used by every writer and reader.
- [x] Update every `rea_claims` producer so REAL claims write `dataset_version_id` at admission time and legacy/demo claims remain compatible.
- [x] Update `bootstrap/bootstrap_materialize_lakehouse.py` so the `governed_rea_claims` parquet producer emits `dataset_version_id` and includes it in the manifest schema.
- [x] Bump the lakehouse manifest version or schema hash contract for the additive `governed_rea_claims.dataset_version_id` field.
- [x] Refresh lakehouse after real-company setup writes when synchronous materialization is available.
- [x] Persist lakehouse freshness/staleness markers through the setup event store.
- [x] Record compared hashes or version identifiers in marker `details_json`.
- [x] Expose `real_company_refresh_lakehouse` as a plugin wrapper over the core service.
- [x] Add `dataset_version_id` to `governed_rea_claims`.
- [x] Parse `dataset_version_id` from `eos.rea_claims.claim_json` in fallback SQL.
- [x] Ensure `org_rea_claims` always filters by active organization.
- [x] Ensure `org_rea_claims` additionally filters by active dataset version for REAL datasets.
- [x] Ensure demo/sample org reads are not version-filtered unless those datasets adopt the same contract.
- [x] Improve `governed_query` diagnostics for no active dataset version, no admitted REA claims, no active COA, projection exceptions, stale lakehouse, and ready state.

**Required tests:**

- [x] Repeated real-company imports/promotions expose only active dataset version rows through normal analytics.
- [x] EOS schema migration preserves existing `rea_claims` rows and makes REAL unversioned rows detectable as legacy/migration-required.
- [x] Existing `rea_claims` writers cannot create a REAL claim without `dataset_version_id`.
- [x] Lakehouse materialization writes `governed_rea_claims.dataset_version_id` and the manifest records the new schema.
- [x] Superseded dataset versions are hidden from normal `org_*` views.
- [x] REAL org with unversioned legacy claims fails closed with `LEGACY_REAL_CLAIMS_UNVERSIONED`.
- [x] Legacy claims diagnostic reports count and fingerprints without mutating claims.
- [x] Stale lakehouse returns `REAL_LAKEHOUSE_STALE`, not `REAL_SETUP_FAILED`.
- [x] Refreshed lakehouse updates manifest/readiness hash for the active dataset version.

**Verification:**

```bash
pytest -v tests/test_smb_analytics_tool.py
pytest -v tests -k "lakehouse or governed_query or dataset_version"
```

**Done when:**

- [x] Governed analytics for REAL data scopes by active organization and active dataset version.
- [x] Reads, writes, EOS migration, lakehouse parquet, and lakehouse manifest all share the same `dataset_version_id` contract.

---

## Task 9: One-Shot Setup Orchestration

**Files:**

- Create or modify: setup orchestration service under `src/eos/`
- Modify: `src/plugins/real_company_onboarding/tools.py`
- Test: focused orchestration tests under `tests/`

**Implementation checklist:**

- [x] Implement deterministic `real_company_run_setup` orchestration in core.
- [x] Run reconciliation/backfill first when promoted imports or active dataset versions already exist.
- [x] Execute only stages that are needed for the current governed snapshot.
- [x] Require idempotency keys for write stages.
- [x] Stop after the first blocker that requires user/operator action.
- [x] Return exact `setup_status`, `blocking_reasons`, and `next_actions` from the core evaluator.
- [x] Preserve typed projection exceptions and lifecycle insufficiency warnings.
- [x] Expose plugin wrapper `real_company_run_setup`.

**Required tests:**

- [x] Empty real org returns `REAL_EMPTY` without writes.
- [x] Promoted import with no snapshots runs reconciliation and then returns `REAL_REA_ADMISSION_REQUIRED`.
- [x] Already admitted claims with missing COA returns `REAL_COA_REQUIRED`.
- [x] Complete path reaches `REAL_READY` after COA/projection/materialization/lakehouse refresh.
- [x] Re-running with the same idempotency key does not duplicate writes.
- [x] Competing one-shot setup attempts serialize through the persisted setup run lock.

**Verification:**

```bash
pytest -v tests -k "real_company_run_setup or setup_orchestration"
```

**Done when:**

- [x] One-shot setup is a thin orchestrator over deterministic core stages, not an alternate authority path.

---

## Task 10: UI And Prompt Integration

**Files:**

- Modify: `hermes-workspace/src/screens/settings/data-connections-screen.tsx`
- Modify: company dataset import panel files
- Modify: `src/prompts/agents/ACTIVE_ORGANIZATION_CONTEXT.md` or create a new prompt asset only if prompt wording changes
- Test: frontend/backend integration tests where available

**Implementation checklist:**

- [x] Show setup status after switching to a REAL company.
- [x] Distinguish promoted source artifacts from admitted REA/projected analytics readiness.
- [x] Avoid user-facing states that say no data is bound when files are promoted but admission is pending.
- [x] Surface `blocking_reasons` and `next_actions` from the backend without recomputing primary setup status in UI code.
- [x] If prompt guidance changes, edit prompt assets under `src/prompts/`, not inline runtime code.
- [x] Keep UI display labels localized in presentation metadata, not runtime machine identifiers.

**Required tests:**

- [x] UI renders `REAL_IMPORTED` as promoted source artifacts awaiting setup.
- [x] UI renders `REAL_REA_ADMISSION_REQUIRED` as admission needed.
- [x] UI renders `REAL_COA_REQUIRED` and `REAL_PROJECTION_REQUIRED` as setup blockers, not empty data.
- [x] Prompt assembly test verifies any new active-organization setup guidance is loaded from prompt assets.

**Verification:**

```bash
pytest -v tests -k "active_organization_context or company_data_context"
```

If frontend tests exist for this workspace, run the focused package command documented in the frontend package.

**Done when:**

- [x] User-facing status matches the core setup evaluator and does not duplicate setup-state precedence.

---

## End-To-End Regression Scenario

Use the current `Soyon_Real` shape as the fixture target.

- [x] Active org is `Soyon_Real`.
- [x] Active dataset version exists.
- [x] Promoted imports include the known history detail CSV artifacts.
- [x] `rea_claims` initially has zero rows for `Soyon_Real`.
- [x] Setup status initially returns `REAL_IMPORTED` when no normalized/classified snapshot exists.
- [x] Running reconciliation creates one setup run and normalized/classified snapshots without duplicating import records.
- [x] Setup status advances to `REAL_REA_ADMISSION_REQUIRED`.
- [x] Running admission creates deterministic, version-qualified `rea_claims` for supported rows.
- [x] Setup advances to `REAL_COA_REQUIRED` or `REAL_PROJECTION_REQUIRED`, depending on COA availability.
- [x] COA/projection/materialization/lakehouse refresh advances setup to `REAL_READY`.
- [x] Governed query returns only admitted facts for the active `dataset_version_id`.
- [x] Demo/sample data is never returned for `Soyon_Real`.

**Verification:**

```bash
pytest -v tests -k "Soyon_Real or real_company"
pytest -v
```

---

## Final Quality Gate

- [x] Architecture alignment checked against [docs/canonical/architecture.md](../../canonical/architecture.md).
- [x] Regression tests added or updated for validation, projection, replay, trust-state transitions, governance, and evidence/export paths touched by the implementation.
- [x] No live dependency introduced in replay or audit flows.
- [x] Deterministic behavior preserved for setup state, admission, projection, lifecycle materialization, replay, and audit pins.
- [x] No unmanaged filesystem, prompt-memory, or inferred-context fallback added for authoritative runtime continuity.
- [x] REAL analytics fail closed for unversioned legacy claims.
- [x] All new persisted timestamps are timezone-aware UTC ISO-8601.
- [x] All new runtime-owned schema/API/query identifiers are ASCII-stable.
- [x] Route policy, authz class, and docs matrix are synchronized.
- [x] Plugin wrappers call core services and do not own semantic authority.
- [x] `./scripts/run_tests.sh` passes, or any remaining failure is documented with exact failing tests and reason.

Full-suite note: `./scripts/run_tests.sh` completed with `2017 passed, 26 failed` on 2026-06-23. Failing tests were outside the real-company setup path: Feishu temporal/session monitor tests, Hermes API workspace/session/kanban binding tests, Hermes routing guard workspace binding, sandbox workspace-scope tests, the existing order-sensitive `test_governed_query_requires_auth_context`, and `test_refactoring_plan_8_6_exists_at_repo_root` missing `refactoring_plan_8.6.0.md`. Focused real-company, lakehouse, governed-query, prompt, and frontend tests passed.
