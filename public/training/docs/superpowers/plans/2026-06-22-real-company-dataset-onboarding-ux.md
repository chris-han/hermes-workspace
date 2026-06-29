# Real Company Dataset Onboarding UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user start with one governed bootstrap demo dataset, switch to a real company, and load that company's spreadsheet dataset through the `automate_excel` procedural tool path without weakening Semantier authority boundaries.

**Architecture:** Organization selection remains the governed authority step. Excel processing is a procedural staging operation that can normalize and validate files, but cannot establish identity, membership, organization authority, or governed facts by itself. Promotion from staged rows into EOS must go through explicit Semantier runtime ingestion/projection stores, with SQLite-backed import metadata and monotonic state transitions as the authoritative source of truth. Files are blob artifacts only and are referenced from governed rows by hash.

**Tech Stack:** FastAPI gateway routes in `src/agents/webapi_gateway.py`, governed identity helpers in `src/agents/gateway_identity.py`, React/TanStack Query settings UI under `hermes-workspace/src/`, Semantier plugin inventory for `automate_excel`, EOS SQLite plus derived lakehouse artifacts.

---

## Current Design Review

The current design already has the core authority primitive needed for this UX:

- `src/agents/gateway_identity.py` supports multiple organization memberships, a default active organization, seeded demo profiles, dataset metadata, and audited membership events.
- `src/agents/webapi_gateway.py` exposes `/organizations/me`, `/organizations/demo-profiles`, `/organizations/demo-onboarding`, `/organizations/join`, and `/organizations/switch`.
- `hermes-workspace/src/lib/organization-membership.ts` exposes `upsertOrganizationAssociation`, `ensureDefaultSmbOrganization`, demo profile fetches, and query keys for refreshing organization context.
- `hermes-workspace/src/screens/settings/organization-settings-screen.tsx` already renders a searchable organization context page and can activate a known organization.
- `hermes-workspace/src/screens/settings/data-connections-screen.tsx` already explains governed data surfaces and has the right home for dataset loading UX.
- `semantier-skills/plugins/automate_excel/SKILL.md` states the plugin is procedural-only and must not infer authority or replace registered tools with raw Python, shell, pandas, or openpyxl.

The current gaps are:

- The UI still frames the default organization as an SMB analytics default instead of a temporary bootstrap/demo company that can be replaced by a real company.
- Creating a real company does not collect enough dataset-import intent: company display name, real-vs-demo marker, source period, file type, selected sheets, and import mode.
- There is no first-class "staged import" object scoped to the active organization.
- Data Connections can show EOS/lakehouse readiness, but cannot yet upload or attach an Excel/CSV dataset to the active organization.
- There is no backend route that checks the active organization and then invokes registered `automate_excel` tools for validation/conversion.
- There is no deterministic SQLite import metadata contract connecting uploaded files, transformed CSVs, hashes, selected organization, actor, timestamps, and promotion status.
- There is no idempotency contract for upload, validation, or promotion retries.
- There is no backend-computed authority-state enum shared by UI and prompt assembly.
- There is no visible user handoff from "I am in demo data" to "I switched to a real company and this import is staged or promoted."

## UX Contract

The UX should present one continuous flow:

1. User signs up or enters the app with access to exactly one bootstrap demo organization.
2. Chat and analytics clearly show the active organization and whether it is `DEMO` or `REAL`.
3. User opens Organization Context and selects `Create real company`.
4. The app creates a governed real organization membership through existing organization endpoints or a focused real-company endpoint.
5. The app switches the user's active organization to the real company only after membership is active.
6. The user lands on Data Connections with the real company context pinned at the top.
7. The user uploads Excel/CSV files, chooses sheets and header rows, and runs validation through registered `automate_excel` tools.
8. The system writes a staged import record to SQLite with hashes, idempotency keys, monotonic status, and UTC timestamps.
9. The user reviews validation results and starts a governed import/promotion action.
10. Chat answers for the real company use org-scoped governed data only after the import is promoted. Before promotion, chat may mention that files are staged but must not treat staged spreadsheet rows as authoritative facts.

## Architecture Decisions

- Keep demo access as an organization membership with `dataset_type: "DEMO"`.
- Model real company access as a separate organization membership with `dataset_type: "REAL"`.
- Do not overwrite a demo organization to become real. Switching from demo to real changes the active organization ID.
- Treat `(organization_id, dataset_version_id)` as the promoted real-data boundary. `organization_id` decides company ownership; `dataset_version_id` decides the active promoted dataset snapshot for that company.
- Never fall back to the bootstrap demo dataset when the active organization has `dataset_type: "REAL"`. A real organization with no active promoted dataset must return a clear no-promoted-real-dataset state.
- Add staged import metadata and status under SQLite-backed Semantier runtime storage, not prompt memory, unmanaged workspace files, or file-only manifests.
- Store uploaded and normalized files as blob artifacts only; authoritative metadata must reference them by SHA-256 hash from SQLite rows.
- Require a client-provided `request_id` or `idempotency_key` for upload, validation, and promotion write routes.
- Enforce monotonic import status transitions with compare-and-swap semantics.
- Use `automate_excel` only for file validation and deterministic transformations such as Excel-to-CSV, sheet selection, dedupe, merge, and column selection.
- Put semantic mapping, projection, promotion, replay pins, and audit evidence in Semantier core, not in the automate-excel plugin.
- Use timezone-aware UTC ISO-8601 timestamps for every staged import, file artifact, validation run, and promotion event.
- Use ASCII-stable field names for any import metadata, route payload, database table, JSON schema, and tool-facing identifiers.
- Expose a single backend-computed authority state enum to UI and prompt assembly: `DEMO_ACTIVE`, `REAL_EMPTY`, `REAL_STAGED_ONLY`, `REAL_PROMOTING`, `REAL_PROMOTED`, `REAL_PROMOTION_FAILED`.

## Authorization Policy

- Create new real organization: `SELF_ONLY`, creates an owner membership for the actor and sets `dataset_type: "REAL"`.
- Join existing real organization: invitation-token or admin-approval gated. The v1 route may be `SELF_ONLY` only for submitting a request; activation requires an existing org admin or a valid signed invite.
- Switch organization: `SELF_ONLY`, but only for an existing active membership resolved from governed records.
- Upload and validate dataset import: `TENANT_MEMBER`, scoped to the active organization.
- Promote staged import: `TENANT_ADMIN` or capability-based authorization because promotion affects organization-wide query authority.
- Read import status: `TENANT_MEMBER`, scoped to the active organization.

## Import Lifecycle

Import rows use a monotonic state machine. Invalid transitions must fail without mutating state.

```text
uploaded -> validating -> validation_failed
uploaded -> validating -> staged
staged -> promoting -> promoted
staged -> promoting -> promotion_failed
validation_failed -> validating
promotion_failed -> promoting
promoted -> superseded
```

Status semantics:

- `uploaded`: file blobs are stored and hashed; no parsing result is authoritative.
- `validating`: a validation worker or request is running under a deterministic parsing profile.
- `validation_failed`: validation completed with blocking errors; user may update mapping/options and retry with the same import.
- `staged`: normalized artifacts and validation summaries exist; still not query authority.
- `promoting`: governed ingestion/projection is running; UI shows progress and disables duplicate promotion.
- `promotion_failed`: promotion failed after staging; retry is allowed with the same `idempotency_key` or a new request after operator review.
- `promoted`: dataset version is active or available for activation according to governed dataset metadata.
- `superseded`: a later promoted dataset version replaced this version; historical rows remain append-only.
- Artifact blobs for non-promoted imports are retained for 30 days for audit and debugging, then may be garbage-collected if no governed row references them as active evidence. `promoted`, `promotion_failed`, and `superseded` artifact hashes remain in SQLite even if aged blob files are later removed.

## Intake Safety And Deterministic Parsing

- Accepted file extensions: `.xlsx`, `.xls`, `.csv`.
- Enforce MIME and magic-byte verification in addition to extension checks.
- Reject files larger than the configured v1 limit, default `50 MiB` per file and `250 MiB` per import batch.
- Default parser locale: `zh-CN` for seeded China accounting templates unless the user selects another supported locale.
- Default parser timezone: UTC for persisted timestamps; local date-only spreadsheet values are normalized using an explicit import profile timezone before persistence.
- CSV defaults: UTF-8, comma separator, quote-aware parsing, newline normalization to LF.
- Excel defaults: selected sheet names, explicit header row, no formula execution, formula cells read as cached values only.
- Every validation run records `parser_profile_schema_version`, `parser_profile_hash`, selected sheets, header rows, locale, timezone, encoding, and required-column profile.
- Bump `parser_profile_schema_version` whenever automate-excel tool behavior, parser defaults, locale handling, date normalization, encoding defaults, or required-column profiles change in a way that affects replay or audit interpretation.

## Dataset Versioning And Authority State

- Every successful promotion creates a `dataset_version_id`.
- Active organization dataset metadata records `active_dataset_version_id`, `activated_at`, and `activated_by`.
- Promoted real-data rows and derived governed views must carry both `organization_id` and `dataset_version_id`.
- Query/runtime access must resolve both values from governed runtime state and filter by both. For `dataset_type: "REAL"`, missing `active_dataset_version_id` is a denial/no-data condition, not a reason to query demo data.
- Superseded versions record `superseded_by` and remain readable for audit and rollback review.
- Superseded versions are not available through normal analytics query paths. Access is limited to tenant-admin audit/version APIs and governed rollback flows that explicitly request a historical `dataset_version_id`.
- Rollback is modeled as a governed activation of a previous `dataset_version_id`, not deletion or in-place mutation.
- The backend computes one authority-state enum from organization dataset metadata and import status; UI and prompt assembly consume that enum instead of deriving state independently.

## Switch And Promote UI Design

UI page/route map:

| Flow Surface | UI Page / Route | Purpose |
| --- | --- | --- |
| Login | Auth/Login screen | Sign-in precondition before organization context exists |
| Chat | `/chat/new` or active chat session | Demo query, real query, no-fallback verification, authority-state messaging |
| Organization Context | `/settings/organization` | Active company header, demo-to-real switch, membership status, switch back to demo |
| Real-company dialog | `/settings/organization` modal/dialog | Create or select real organization such as `organization_id = soyon` |
| Data Connections import panel | `/settings/data-connections?import=company-dataset` | Upload, validate, stage, promote, promotion progress, promotion failure |
| Organization member/admin controls | `/settings/organization` member management section | Membership approval, role management, revocation/suspension during async promotion |
| Audit/version review | Tenant-admin audit/version API or audit drawer linked from `/settings/data-connections` | Promotion audit events, superseded-version access, governed rollback evidence |
| Backend metadata checks | API response, network inspector, or exported evidence bundle | Idempotency, SQLite metadata, UTC timestamps, file hashes, authority enum |

Organization Context UI:

- Show the active company as a compact header with company name, `dataset_type`, active authority state, and whether an active promoted `dataset_version_id` exists.
- For demo organizations, show a primary `Switch to real company` action.
- The real-company switch dialog collects company display name, organization slug preview, industry code, fiscal year start month, and local currency.
- Creating a new real company activates it immediately for the actor as owner. Joining an existing real company shows pending/invite status and keeps the current active organization unchanged until membership is active.
- After a successful real-company switch, route to `/settings/data-connections?import=company-dataset`.

Data Connections Import UI:

- Pin the active organization at the top of the import panel with `organization_id`, `dataset_type`, authority state, and active `dataset_version_id` when present.
- If active `dataset_type` is `REAL` and no `active_dataset_version_id` exists, show `No promoted real dataset yet` and keep analytics readiness disabled.
- Upload controls appear only for active real-company members; promotion controls require tenant-admin or equivalent capability.
- Validation view shows lifecycle state, uploaded files, selected sheets, parser profile, row counts, blocking errors, and generated normalized artifacts.
- Promotion view shows `Promote to governed dataset`, then displays `promoting` progress, final `dataset_version_id`, activation time, and stale-lakehouse/materialization status.
- Promotion failure view shows typed `error_category`, retry/operator guidance, and keeps retry actions routed through idempotent promotion/status APIs.
- The import panel treats `promoting` as stale after 15 minutes without `updated_at` movement and routes users to operator review.
- Tenant-admin audit/version review must expose promotion audit evidence, superseded-version readback for audit, and governed rollback actions outside normal analytics query paths.
- Switching back to a demo organization must visibly change the active company header and must not carry real-company staged or promoted import state into the demo context.

## Proposed User Flow

### Entry: Bootstrap Demo

- The first authenticated user receives one seeded demo organization via the existing demo onboarding flow.
- The chat empty state and settings header show:
  - active company name
  - dataset badge: `Demo data`
  - action: `Switch to real company`
- Demo analytics continue to use org-scoped governed views and existing prompt assets such as `DEMO_DATASET_CONTEXT.md`.

### Step 1: Create Or Select Real Company

- User opens `/settings/organization` and clicks `Switch to real company`.
- UI displays real-company dialog on `/settings/organization` modal/dialog:
  - company display name
  - optional organization ID slug preview
  - industry code
  - fiscal year start month
  - local currency
- Submit creates or joins a `REAL` organization, then calls `/organizations/switch`.
- If approval is required, the `/settings/organization` stays on the demo org and shows pending/invite status in the organization member/admin controls section.
- After successful activation, UI navigates to `/settings/data-connections?import=company-dataset`.

### Step 2: Load Dataset

- After successful switch, route to `/settings/data-connections?import=company-dataset`.
- `/settings/data-connections?import=company-dataset` shows active organization context above the import panel.
- User uploads one or more `.xlsx`, `.xls`, or `.csv` files.
- UI shows uploaded file list, sheet names, header-row selectors, and validation controls.
- Validation calls backend import routes, which invoke registered `automate_excel` tools.

### Step 3: Stage And Review

- Backend creates a staged import record in SQLite with:
  - `import_id`
  - `organization_id`
  - `actor_user_id`
  - `idempotency_key`
  - `source_files`
  - `normalized_files`
  - `content_hashes`
  - `validation_results`
  - `created_at`
  - `updated_at`
  - `status`
- UI renders validation errors, warnings, row counts, and detected columns.
- The staged import is not query authority.

### Step 4: Promote

- User clicks `Promote to governed dataset`.
- Backend checks active organization membership and import status.
- Backend performs a compare-and-swap transition from `staged` or `promotion_failed` to `promoting` before any promotion write.
- Promotion is asynchronous in v1: the POST returns after the transition to `promoting`, and a background worker or controlled runtime job maps staged CSVs into governed ingestion/projection flows.
- Successful promotion creates a new `dataset_version_id`, updates active organization dataset binding metadata through governed state, and emits an audit event.
- Promoted rows are addressable only through the `(organization_id, dataset_version_id)` pair.
- Import status polling reports `promoting` until the worker transitions the row to `promoted` or `promotion_failed`.
- `/settings/data-connections?import=company-dataset` displays `promoting`, `promoted`, or `promotion_failed` status and links tenant admins to audit/version review when promotion needs operator action.
- The lakehouse mirror is regenerated or marked stale with a clear action depending on current runtime capabilities.

## Files To Create Or Modify

- Modify `src/agents/gateway_identity.py`: add real-company creation metadata normalization if current `join_organization` cannot persist required `REAL` dataset fields.
- Modify `src/agents/webapi_gateway.py`: add real-company onboarding and staged dataset import routes.
- Modify `src/agents/route_policy.py`: register route authorization classes for new tenant-facing routes.
- Modify `docs/derived/gateway-unified-multitenant-design.md`: update section `8.1.1` for any new method/path matrix entries.
- Create `src/eos/company_dataset_import_store.py`: own SQLite schema, idempotency keys, monotonic import state transitions, dataset version metadata, and artifact hash references.
- Create `src/agents/company_dataset_imports.py`: own gateway-facing import orchestration, file artifact staging, registered automate-excel invocation boundaries, and store calls.
- Create `tests/test_company_dataset_imports.py`: unit tests for DB row creation, active-org enforcement, idempotency, UTC timestamps, ASCII keys, cross-org denial, state transitions, and validation result shape.
- Modify `tests/test_organization_membership_api.py`: cover demo-to-real company switch behavior.
- Modify `tests/test_route_policy_matrix.py` fixtures indirectly by updating the docs matrix and `route_policy.py`.
- Modify `hermes-workspace/src/lib/organization-membership.ts`: add typed helper for real-company create/switch if the route is not represented by existing `upsertOrganizationAssociation`.
- Create `hermes-workspace/src/lib/company-dataset-imports.ts`: typed API client for upload, validation, staging status, and promotion.
- Modify `hermes-workspace/src/screens/settings/organization-settings-screen.tsx`: add the visible `Switch to real company` entry point and replace SMB-default copy.
- Modify `hermes-workspace/src/screens/settings/data-connections-screen.tsx`: add the company dataset import panel.
- Create `hermes-workspace/src/screens/settings/components/company-dataset-import-panel.tsx`: upload, sheet selection, validation status, and promotion controls.
- Add frontend tests near existing settings tests for organization switching and import panel states.

## Implementation Tasks

### Task 1: Define The Real-Company Organization Contract

**Files:**
- Modify: `src/agents/gateway_identity.py`
- Modify: `src/agents/webapi_gateway.py`
- Modify: `tests/test_organization_membership_api.py`

- [ ] Add a regression test proving a demo user can create a separate `REAL` organization and switch to it while the demo membership remains unchanged.
- [ ] Persist `dataset_type: "REAL"` and optional `industry_code` for newly created real companies.
- [ ] Ensure `switch_user_organization` rejects pending memberships and only activates known governed memberships.
- [ ] Verify `/auth/context` returns the real company after switching and still includes the original demo membership in `/organizations/me`.
- [ ] Run: `pytest tests/test_organization_membership_api.py -v`.

### Task 2: Add Route Policy And Docs Matrix Coverage

**Files:**
- Modify: `src/agents/route_policy.py`
- Modify: `docs/derived/gateway-unified-multitenant-design.md`
- Test: `tests/test_route_policy_matrix.py`

- [ ] Add any new real-company or import route to `ROUTE_POLICY_MAP`.
- [ ] Use `SELF_ONLY` for new-organization creation and active-org switching only when the target membership is already active.
- [ ] Use invitation-token or admin-approval logic for joining an existing real organization; do not make existing-org activation self-service.
- [ ] Use `TENANT_MEMBER` for staged import validation and readback.
- [ ] Use `TENANT_ADMIN` or a specific governed capability before promotion if promotion affects organization-wide query authority.
- [ ] Update the executable method/path matrix in docs.
- [ ] Run: `pytest tests/test_route_policy_matrix.py -v`.

### Task 3: Implement SQLite-Backed Import Metadata And State

**Files:**
- Create: `src/eos/company_dataset_import_store.py`
- Create: `src/agents/company_dataset_imports.py`
- Create: `tests/test_company_dataset_imports.py`

- [ ] Define SQLite tables for `company_dataset_imports`, `company_dataset_import_files`, `company_dataset_import_validation_runs`, and `organization_dataset_versions`.
- [ ] Add unique constraints for `(organization_id, idempotency_key)` on write operations that create or mutate import state.
- [ ] Define ASCII keys in API payloads and DB columns: `import_id`, `organization_id`, `actor_user_id`, `idempotency_key`, `status`, `source_file_hash`, `normalized_file_hash`, `validation_result_json`, `dataset_version_id`, `created_at`, `updated_at`.
- [ ] Store file blobs under a Semantier-controlled artifact path, but never use files as source-of-truth for status, ownership, or promotion eligibility.
- [ ] Record artifact retention metadata: default `retention_until` is 30 days for `uploaded`, `validation_failed`, and unpromoted `staged` imports; `promoted`, `promotion_failed`, and `superseded` rows keep hash metadata append-only even if blob cleanup later removes aged non-active files.
- [ ] Hash every source and normalized file with SHA-256 and store the hash in SQLite before returning success.
- [ ] Generate all timestamps with timezone-aware UTC ISO-8601 strings.
- [ ] Add compare-and-swap state transition helpers that only allow the lifecycle transitions documented above.
- [ ] Add tests that reject missing active organization context, reject mismatched organization IDs, reject cross-org `import_id` access, verify deterministic row serialization, verify duplicate idempotency keys return the original result, and verify invalid status transitions fail without mutation.
- [ ] Run: `pytest tests/test_company_dataset_imports.py -v`.

### Task 4: Bridge Backend Validation To `automate_excel`

**Files:**
- Modify: `src/agents/webapi_gateway.py`
- Modify: `src/agents/company_dataset_imports.py`
- Test: `tests/test_company_dataset_imports.py`
- Test: `tests/test_automate_excel_package.py`

- [ ] Add upload/stage route for Excel/CSV files scoped to the active organization.
- [ ] Require `idempotency_key` on upload and validation write requests.
- [ ] Enforce file extension, MIME, magic-byte, and size limits before storing artifacts.
- [ ] Persist the deterministic parser profile: `parser_profile_schema_version`, locale, timezone, encoding, selected sheets, header rows, required-column profile, and `parser_profile_hash`.
- [ ] Bump `parser_profile_schema_version` whenever parser defaults or automate-excel behavior changes in a way that affects replay or audit interpretation.
- [ ] Add validation route that calls registered automate-excel tool names rather than direct scripts or generated Python.
- [ ] Return a structured validation result with row counts, sheet names, required-column failures, and generated normalized file paths.
- [ ] Fail clearly if the automate-excel tool surface is not installed or enabled.
- [ ] Keep spreadsheet contents out of authority decisions.
- [ ] Run: `pytest tests/test_company_dataset_imports.py tests/test_automate_excel_package.py -v`.

### Task 5: Add Promotion Boundary

**Files:**
- Create or modify Semantier core ingestion module selected during implementation.
- Modify: `src/agents/company_dataset_imports.py`
- Modify: `src/agents/webapi_gateway.py`
- Test: add focused tests in the ingestion module's nearest test file.

- [ ] Add a promotion route that accepts an `import_id`.
- [ ] Require `idempotency_key` on promotion.
- [ ] Check the actor is still an active member of the import's organization.
- [ ] Check the SQLite import record status is valid for promotion.
- [ ] Use compare-and-swap to transition `staged` or `promotion_failed` to `promoting`; duplicate retries with the same `idempotency_key` must read the existing SQLite row state and return the same response envelope as a fresh status read, not a cached in-memory response.
- [ ] Implement promotion asynchronously in v1: initial POST returns `import_status: "promoting"` after the compare-and-swap transition; a background worker or controlled runtime job transitions `promoting` to `promoted` or `promotion_failed` after ingestion completes.
- [ ] Make the background worker use the same compare-and-swap pattern for completion: only transition `promoting` to `promoted` or `promotion_failed`; never mutate promoted dataset metadata unless the current row status is still `promoting`.
- [ ] Add stuck-`promoting` recovery: if a worker crashes mid-ingestion, an operator or retry task can re-query the import row; if deterministic resume is possible, continue ingestion from pinned artifacts and hashes, otherwise transition `promoting` to `promotion_failed` with an error note and no active dataset-version change.
- [ ] Re-read governed membership state before each promotion phase: before normalized CSV parse, before projection/materialization writes, and before final dataset-version activation. If the actor's membership is revoked or suspended mid-ingestion, transition `promoting` to `promotion_failed` with `error_category: "authorization_revoked"` and do not activate a dataset version.
- [ ] Store typed `promotion_failed` error metadata with `error_category` values: `transient_retry_safe`, `permanent_operator_action`, `data_quality_remap_required`, `authorization_revoked`, and `internal_invariant_violation`.
- [ ] Call Semantier core ingestion/projection code rather than writing analytics tables directly in gateway code.
- [ ] Create `dataset_version_id`, `activated_at`, `activated_by`, and `superseded_by` metadata through governed state.
- [ ] Ensure promoted real-data rows and governed query views include and enforce both `organization_id` and `dataset_version_id`.
- [ ] Expose superseded dataset versions only through tenant-admin audit/version APIs and governed rollback flows, not normal analytics query tools.
- [ ] For `dataset_type: "REAL"` with no active promoted `dataset_version_id`, return no promoted real dataset instead of querying demo/bootstrap data.
- [ ] Emit an organization audit event with the import hash, dataset version, idempotency key, and status transition.
- [ ] Mark lakehouse artifacts stale or trigger deterministic materialization through an existing controlled path.
- [ ] Add recovery tests for interrupted promotion and replay-safe retries.
- [ ] Run the focused ingestion tests plus `pytest tests/test_multitenant_isolation.py -v`.

### Task 6: Update Organization Settings UX (`/settings/organization`)

**Files:**
- Modify: `hermes-workspace/src/screens/settings/organization-settings-screen.tsx`
- Modify: `hermes-workspace/src/lib/organization-membership.ts`
- Modify: `hermes-workspace/src/screens/settings/organization-settings-screen.test.ts`

- [ ] Replace SMB-default framing with bootstrap/demo framing.
- [ ] On the `/settings/organization` page, add `Switch to real company` as a primary action when active `dataset_type` is `DEMO`.
- [ ] Add a `/settings/organization` modal/dialog real-company form that creates/switches to a `REAL` organization with fields for company display name, organization slug preview, industry code, fiscal year start month, and local currency.
- [ ] Show active company name, `dataset_type`, authority state, and active `dataset_version_id` when present at the top of the page.
- [ ] Show membership pending/invite state on the page; keep the current active organization unchanged on `/settings/organization` until membership is active.
- [ ] Keep organization member/admin controls on the page for membership approval, role management, and revocation/suspension during async promotion.
- [ ] Preserve existing search and membership activation behavior.
- [ ] After successful real-company switch, navigate to `/settings/data-connections?import=company-dataset`.
- [ ] Run: `cd hermes-workspace && npm test -- organization-settings-screen`.

### Task 7: Add Data Connections Import Panel (`/settings/data-connections?import=company-dataset`)

**Files:**
- Create: `hermes-workspace/src/lib/company-dataset-imports.ts`
- Create: `hermes-workspace/src/screens/settings/components/company-dataset-import-panel.tsx`
- Modify: `hermes-workspace/src/screens/settings/data-connections-screen.tsx`
- Modify: `hermes-workspace/src/screens/settings/data-connections-screen.test.ts`

- [ ] On `/settings/data-connections?import=company-dataset`, display active organization name, ID, and dataset type at the top of the import panel.
- [ ] Show active `dataset_version_id` and analytics readiness; for real organizations without a promoted version, show `No promoted real dataset yet` state.
- [ ] Disable import when no active organization exists or membership is not active.
- [ ] Support file upload, staged file list, sheet/header controls, validation button, and promotion button on the page.
- [ ] Render lifecycle states explicitly: `uploaded`, `validating`, `validation_failed`, `staged`, `promoting`, `promoted`, `promotion_failed`, and `superseded`.
- [ ] In the `promoting` state, treat it as stale after 15 minutes without `updated_at` movement; show operator-review guidance on the page and keep retry actions routed through the idempotent promotion/status APIs.
- [ ] In the `promotion_failed` state, show typed `error_category` and route the user accordingly:
  - `transient_retry_safe`: display retry button and guidance
  - `permanent_operator_action`: display operator-review link
  - `data_quality_remap_required`: display mapping/remediation guidance
  - `authorization_revoked`: display authorization failure message
  - `internal_invariant_violation`: display engineering-review message
- [ ] Link tenant-admin users from the page to audit/version review surface (audit/version API or audit drawer) for promotion audit events, superseded-version access, and governed rollback.
- [ ] Persist and reuse client-side `idempotency_key` values for retry buttons so network retries do not create duplicate writes.
- [ ] Show validation results without implying staged rows are authoritative.
- [ ] Use TanStack Query invalidation after validation and promotion.
- [ ] Run: `cd hermes-workspace && npm test -- data-connections-screen`.

### Task 8: Prompt And Chat Context Adjustments

**Files:**
- Modify prompt assets under `src/prompts/agents/` only if wording changes are needed.
- Modify prompt assembly tests nearest to current organization-context tests.

- [ ] Keep runtime code responsible for selecting prompt assets, not defining new prompt prose inline.
- [ ] Add or expose the backend authority-state enum: `DEMO_ACTIVE`, `REAL_EMPTY`, `REAL_STAGED_ONLY`, `REAL_PROMOTING`, `REAL_PROMOTED`, `REAL_PROMOTION_FAILED`.
- [ ] Gate UI badges and prompt assembly from that backend enum only.
- [ ] Ensure active `REAL` organizations do not receive demo-data wording.
- [ ] Ensure staged-but-unpromoted imports do not become chat evidence.
- [ ] Ensure promoted real-company datasets route through governed query tools scoped by both `organization_id` and `dataset_version_id`.
- [ ] Ensure real-company requests never fall back to the bootstrap demo dataset.
- [ ] Run the focused prompt/context tests in `tests/test_hermes_api_compat.py` around active organization context.

### Task 9: End-To-End Verification

**Files:**
- Add or update Playwright or integration coverage in the nearest existing frontend test harness.
- Update `how-to-run.md` with a concise operator flow if implementation changes user-visible setup.

- [ ] Verify signup/demo onboarding lands the user in one bootstrap demo organization.
- [ ] Verify `Switch to real company` creates and activates a separate real organization.
- [ ] Verify uploaded Excel validation uses backend routes and registered plugin tools.
- [ ] Verify promotion changes query readiness only after governed ingestion succeeds.
- [ ] Verify promoted real-company queries filter by both `organization_id` and `dataset_version_id`.
- [ ] Verify a real organization without active `dataset_version_id` never receives demo/bootstrap query results.
- [ ] Verify demo data remains accessible by switching back to the demo org.
- [ ] Verify cross-org `import_id` access is denied.
- [ ] Verify duplicate uploads with the same file hash and same `idempotency_key` do not create duplicate imports.
- [ ] Verify duplicate promotion retries do not create duplicate dataset versions or audit events.
- [ ] Verify stale membership during promotion blocks the operation before state mutation.
- [ ] Verify interrupted promotion can resume or fail deterministically without partial activation.
- [ ] Run backend focused tests, frontend focused tests, and `./scripts/run_tests.sh` if the changed surface is broad enough.

## Open Questions For Review

- Should every user start with exactly one demo organization, or can admins seed multiple demo choices during profile completion?
- Should joining existing real organizations be invite-only in v1, or self-service request with pending admin approval? This plan forbids direct self-service activation for existing organizations either way.
- Should first release support promotion into full EOS projection flows, or stop at staged validation plus a clear "not yet authoritative" state?
- Async promotion is the v1 implementation default. Do operators need a later synchronous admin-only promotion mode for small imports?
- Should lakehouse materialization be synchronous after promotion or an explicit operator action?
- Which spreadsheet templates are in scope for the first release: trial balance only, ledger exports, invoices, bank statements, or a smaller import set?

## Review Checklist

- Architecture Law 1 preserved: company identity and active authority context come only from governed organization membership.
- Architecture Law 2 preserved: import metadata and route payload timestamps are UTC-aware ISO-8601.
- Architecture Law 3 preserved: prompt wording lives under `src/prompts/`.
- Architecture Law 4 preserved: import metadata and API field names are ASCII-stable.
- `automate_excel` remains procedural-only.
- Import status, promotion eligibility, and dataset versioning are SQLite-backed from day one; file artifacts are blob references only.
- Write routes are idempotent and state transitions are monotonic.
- Existing-organization joins are invite-gated or approval-gated.
- Intake validates extension, MIME, magic bytes, file size, parser profile, and deterministic normalization options.
- UI and prompt assembly share a backend-computed authority-state enum.
- Replay/audit paths do not introduce live LLM, OCR, parser, or retrieval dependencies.
- Tests cover organization switching, route policy, import metadata determinism, idempotency, cross-tenant tampering, interrupted promotion recovery, stale membership, and staged-vs-promoted authority behavior.
