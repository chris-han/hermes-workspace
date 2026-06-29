# SaaS Multitenancy Roadmap

Date: 2026-06-01

Status: Active roadmap for the currently supported multitenancy scope.
Authority: Operational roadmap and status tracker; not a replacement for the runtime contract.
Scope: Planned and completed work for multitenant hardening in this repository.
Upstream sources:
- [Document Authority And Versioning](../canonical/document-authority-and-versioning.md)
- [architecture.md](../canonical/architecture.md)
- [gateway-unified-multitenant-design.md](../derived/gateway-unified-multitenant-design.md)

Phase status: Completed for the current roadmap scope documented here.

Related docs:

- `docs/derived/gateway-unified-multitenant-design.md`
- `docs/canonical/architecture.md`

## Goal

Move the current workspace-isolated multitenant runtime into a production-hardened
SaaS multitenancy model.

This roadmap is repo-specific. It maps the remaining work to likely code surfaces
in this repository and groups execution into `P0`, `P1`, and `P2`.

## Current State

Already present in meaningful form:

- signed browser session binding via `vt_session`
- workspace-scoped filesystem layout under `workspaces/<workspace_id>/`
- workspace-scoped `HERMES_HOME` / runs directory binding
- gateway owner correlation for Weixin and Feishu
- shared authoritative auth store in `.semantier-home/auth.db`
- workspace-scoped session logs and trajectory files

Completed multitenancy scope for this phase:

- route-policy, proxy allowlist, tenant authz, and scoped quota foundations are in place
- cleanup/export lifecycle is aligned with authoritative state for current auth/membership surfaces
- P2.2 same-tenant backup/restore is implemented and verified, with org remap explicitly fail-closed
- proxy and embedded API surfaces are documented and regression-tested under tenant controls
- org-level multitenancy is defined as shared governance with workspace-owned operational state
- governed artifact lifecycle and compliance-oriented surfaces are implemented and regression-tested for the defined scope

## Verified P0 Gaps Closed In This Phase

This section is a historical snapshot of the P0 gaps that were verified before
implementation and are now closed. Keep it for lineage; use the P0 checklist
and execution task list below as the current status source of truth.

### G1. Wrapper session routes are still not fully auth-gated

Design references:

- `docs/derived/gateway-unified-multitenant-design.md:1258`
- `docs/derived/gateway-unified-multitenant-design.md:1259`
- `docs/derived/gateway-unified-multitenant-design.md:1267`
- `docs/derived/gateway-unified-multitenant-design.md:1269`

Current code references:

- `src/agents/auth_session.py:291`
- `src/agents/webapi_gateway.py:2845`
- `src/agents/webapi_gateway.py:3422`
- `src/agents/webapi_gateway.py:3614`

Observed tests preserving public behavior:

- `tests/test_hermes_api_compat.py:1512`
- `tests/test_hermes_api_compat.py:2961`

Meaning:

- some wrapper-owned session APIs still fall back to `public` instead of failing
  closed with authenticated tenant context

Mapped roadmap items:

- `P0.1 Route classification and fail-closed enforcement`
- `P0.2 Proxy surface hardening`

### G2. Cleanup still targets legacy JSON instead of authoritative auth state

Design references:

- `docs/derived/gateway-unified-multitenant-design.md:1373`
- `docs/derived/gateway-unified-multitenant-design.md:1394`

Current code references:

- `scripts/cleanup_users.py:130`
- `scripts/cleanup_users.py:450`
- `scripts/cleanup_users.py:470`
- `src/agents/auth_db.py:16`
- `src/agents/auth_db.py:81`

Meaning:

- cleanup logic is not yet centered on `.semantier-home/auth.db`, which is the
  authoritative auth store

Mapped roadmap items:

- `P0.3 Authoritative cleanup and deletion`

### G3. Shared session residue lifecycle is still incomplete

Design reference:

- `docs/derived/gateway-unified-multitenant-design.md:1435`

Current code references:

- `src/agents/workspace_session_logs.py:18`
- `src/agents/workspace_session_logs.py:32`
- `src/agents/workspace_session_logs.py:40`

Meaning:

- canonical session authority is already workspace-scoped under
  `workspaces/<workspace_id>/.hermes/sessions/`
- legacy compatibility exists for session artifact naming inside workspace-owned
  session directories
- but no reviewed implementation defines a deterministic relocate/quarantine/delete
  policy for shared authenticated session residue from legacy runtime paths

Mapped roadmap items:

- `P0.4 Legacy session residue migration/cleanup`

### G4. Cross-tenant security proof is not yet packaged as a dedicated suite

Design reference:

- `docs/derived/gateway-unified-multitenant-design.md:1464`

Meaning:

- the repo has many relevant tests, but it still needs a more explicit
  multitenant regression layer proving no cross-tenant reads, writes, or route
  leaks

Mapped roadmap items:

- `P0.5 Cross-tenant security regression suite`

### G5. Parts of the gateway design doc are stale

Design references:

- `docs/derived/gateway-unified-multitenant-design.md:1428`
- `docs/derived/gateway-unified-multitenant-design.md:1490`

Meaning:

- some file references and compatibility notes no longer match the current code
  layout and runtime flow

Mapped roadmap items:

- doc updates should be done alongside `P0` implementation work so future work
  follows the actual runtime boundary

### G6. Some session/proxy handlers need signature changes before auth closure

Current code references:

- `src/agents/webapi_gateway.py` route `/api/sessions/search`
- `src/agents/webapi_gateway.py` route `/api/sessions/{session_id}/latest-descendant`

Meaning:

- these handlers do not currently take `Request`, so they cannot participate in
  wrapper auth enforcement without signature changes

Mapped roadmap items:

- `P0.1 Route classification and fail-closed enforcement`

## P0

`P0` means required before calling the runtime a real tenant-safe SaaS surface.

### P0.1 Route classification and fail-closed enforcement

Note:

- The items below describe closure criteria that were executed for P0. The
  completion status is tracked in the P0 checklist and task tables.

Outcome:

- every wrapper and proxy route is classified as `public`, `authenticated tenant`,
  or `internal-only`
- every tenant-facing route fails closed without valid tenant auth
- no browser/API route silently falls back to `public`

Primary files:

- `src/agents/webapi_gateway.py`
- `src/agents/auth_session.py`
- `tests/test_hermes_api_compat.py`

Work:

- define and document a route-policy matrix before changing handlers
- replace direct `request_context_from_request()` usage with `_require_authenticated_context()` for:
  - `/sessions*`
  - `/api/sessions*`
  - any tenant-facing embedded API proxy path that should not be public
- keep unauthenticated behavior only for explicitly public routes:
  - `/auth/*`
  - `/health*`
  - provider ingress endpoints that authenticate by provider signature/service auth
- explicitly review `/v1/{upstream_path}` and `/api/{upstream_path}` forwarding behavior
- ensure cross-workspace resource access returns `404` where required by design
- add request/auth context support to handlers that currently cannot participate in
  wrapper auth enforcement cleanly:
  - `/api/sessions/search`
  - `/api/sessions/{session_id}/latest-descendant`

Tests:

- unauthenticated `/sessions` returns `401`
- unauthenticated `/api/sessions*` returns `401`
- authenticated access remains workspace-scoped
- invalid `vt_session` never reaches tenant state
- CI check fails if the runtime route-policy map diverges from the documented
  route-policy matrix

### P0.2 Proxy surface hardening

Outcome:

- wrapper proxies cannot become an auth bypass into embedded Hermes APIs

Primary files:

- `src/agents/webapi_gateway.py`
- `src/agents/hermes_embedded_api.py`
- `tests/test_hermes_api_compat.py`

Work:

- implement the route-policy matrix from `P0.1` on forwarded routes
- block or gate forwarding of any route that exposes cross-tenant state or upstream APIs without wrapper auth
- prefer an explicit allowlist of forwarded upstream paths over broad pass-through behavior
- keep the forwarded-route allowlist as a code-owned runtime constant in
  `src/agents/webapi_gateway.py` (with doc references), so policy is
  executable and testable rather than docs-only
- document allowed forwarded paths explicitly

Tests:

- unauthenticated callers cannot use forwarded APIs to inspect tenant session state
- forwarded API calls preserve the authenticated workspace boundary

### P0.3 Authoritative cleanup and deletion

Outcome:

- user and tenant cleanup operate from authoritative runtime state
- deletion/export behavior is deterministic and auditable

Primary files:

- `scripts/cleanup_users.py`
- `src/agents/auth_db.py`
- `src/agents/gateway_identity.py`
- `tests/` new cleanup coverage

Work:

- rework cleanup target discovery to read from `auth.db` as the authoritative
  source, not legacy JSON
- if `auth.db` is unavailable or corrupt:
  - destructive mode must fail hard (no delete path)
  - `--dry-run` may degrade to explicit error reporting and best-effort residue
    visibility only
  - legacy JSON must never be treated as authoritative fallback
- remove user-linked rows from authoritative auth tables
- keep residue cleanup for legacy JSON only as best-effort cleanup
- include `auth.db` in default cleanup scope
- define deletion boundaries for:
  - user-scoped rows
  - org-scoped rows
  - gateway correlation rows
  - runtime credential cache rows

Tests:

- deleting a target user removes the correct `auth.db` rows
- unrelated tenant rows remain untouched
- dry-run output reflects actual authoritative state

### P0.4 Legacy session residue migration/cleanup

Outcome:

- no ambiguous authenticated session authority remains outside workspace roots

Primary files:

- `src/agents/workspace_session_logs.py`
- possibly `src/agents/launcher.py` or a dedicated migration script
- tests under `tests/test_hermes_api_compat.py` or a new migration test module

Work:

- define policy for shared session residue leftovers:
  - ownership confidently inferable: relocate to owning workspace
  - ownership not inferable: quarantine by default
  - delete only via explicit operator policy or reviewed follow-up cleanup
- ensure authenticated session authority exists only under `workspaces/<workspace_id>/.hermes/sessions/`

Tests:

- legacy residue is migrated or cleaned deterministically
- no authenticated workspace session reads from shared residue after migration

### P0.5 Cross-tenant security regression suite

Outcome:

- the repo has executable proof that tenant boundaries hold

Primary files:

- new dedicated test module such as `tests/test_multitenant_isolation.py`
- existing session/auth/gateway tests

Work:

- add fixtures for at least two users / two workspaces / one shared runtime
- verify:
  - session list isolation
  - session detail isolation
  - trajectory isolation
  - run artifact isolation
  - cleanup isolation
  - gateway correlation isolation
  - embedded API forwarding isolation

Exit criterion:

- `P0` is not complete until the dedicated multitenant isolation suite exists and
  passes under shared-runtime conditions

### P0 Implementation Checklist

Use this checklist to track execution readiness and completion signals for each
`P0` item.

Status legend: `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`.

| Item | Status | Exit check |
| --- | --- | --- |
| `P0.1` Route classification and fail-closed enforcement | `DONE` | Route-policy matrix documented, runtime route-policy map enforced, and unauthenticated tenant routes return `401` |
| `P0.2` Proxy surface hardening | `DONE` | Forwarded-route allowlist enforced in runtime and no unauthenticated proxy path can reach tenant session state |
| `P0.3` Authoritative cleanup and deletion | `DONE` | Cleanup discovery reads `auth.db`, destructive mode hard-fails when `auth.db` is unavailable/corrupt, and dry-run reports explicit authority errors |
| `P0.4` Legacy session residue migration/cleanup | `DONE` | Legacy residue policy implemented with relocate-or-quarantine default and no authenticated session authority outside workspace roots |
| `P0.5` Cross-tenant security regression suite | `DONE` | Dedicated multitenant isolation suite exists, runs in CI, and passes under shared-runtime conditions |

### P0 Execution Task List

Granular task breakdown for `P0`, with each implementation task paired to the
test(s) that prove its exit criterion. Status legend: `TODO`, `IN_PROGRESS`,
`DONE`, `BLOCKED`.

#### P0.1 Route classification and fail-closed enforcement

| ID | Task | Status | Test(s) |
| --- | --- | --- | --- |
| `P0.1.a` | Author executable route-policy matrix (public / authenticated-tenant / internal-only) in `docs/derived/gateway-unified-multitenant-design.md` section `8.1.1` | `DONE` | Doc review; referenced by CI check in `P0.1.f` |
| `P0.1.b` | Replace `request_context_from_request()` with `_require_authenticated_context()` on `/sessions*` and `/api/sessions*` handlers in `src/agents/webapi_gateway.py` | `DONE` | `P0.1.d`, `P0.1.e` |
| `P0.1.c` | Add `Request` parameter to `/api/sessions/search` and `/api/sessions/{session_id}/latest-descendant` so they can participate in wrapper auth | `DONE` | `P0.1.d`, `P0.1.e` |
| `P0.1.d` | Tests: unauthenticated `GET /sessions` and `/api/sessions*` return `401`; invalid `vt_session` never reaches tenant state | `DONE` | `tests/test_multitenant_isolation.py::test_unauth_session_routes_return_401` |
| `P0.1.e` | Tests: authenticated access remains workspace-scoped; cross-workspace resource id returns `404` | `DONE` | `tests/test_multitenant_isolation.py::test_session_routes_workspace_scoped`, `::test_cross_workspace_session_detail_returns_404` |
| `P0.1.f` | CI check that runtime route-policy map matches the documented matrix (fails build on drift) | `DONE` | `tests/test_route_policy_matrix.py::test_code_map_matches_documented_method_matrix` |

Contributor change protocol (tenant-facing routes):

- Any add/remove/change of a tenant-facing route must be updated in all three surfaces in the same PR:
  - runtime handler/gating in `src/agents/webapi_gateway.py`
  - route policy declaration in `src/agents/route_policy.py` (`ROUTE_POLICY_MAP` and exemptions as applicable)
  - executable doc matrix in `docs/derived/gateway-unified-multitenant-design.md` section `8.1.1`
- CI enforces code↔doc parity for the method/path matrix; reviewers should reject partial updates.

#### P0.2 Proxy surface hardening

| ID | Task | Status | Test(s) |
| --- | --- | --- | --- |
| `P0.2.a` | Add forwarded-route allowlist as a code-owned runtime constant in `src/agents/route_policy.py` | `DONE` | `P0.2.c` |
| `P0.2.b` | Gate `/v1/{upstream_path}` and `/api/{upstream_path}` forwarding through the allowlist and wrapper auth | `DONE` | `P0.2.c`, `P0.2.d` |
| `P0.2.c` | Tests: unauthenticated callers cannot use forwarded APIs to read tenant session state | `DONE` | `tests/test_multitenant_isolation.py::test_proxy_unauth_blocked` |
| `P0.2.d` | Tests: forwarded API calls preserve the authenticated workspace boundary | `DONE` | `tests/test_multitenant_isolation.py::test_proxy_workspace_boundary` |

#### P0.3 Authoritative cleanup and deletion

| ID | Task | Status | Test(s) |
| --- | --- | --- | --- |
| `P0.3.a` | Rework `scripts/cleanup_users.py` discovery to read `.semantier-home/auth.db` via `src/agents/auth_db.py` as the authority | `DONE` | `P0.3.e`, `P0.3.f` |
| `P0.3.b` | Destructive mode must hard-fail when `auth.db` is unavailable or corrupt; legacy JSON never treated as authoritative fallback | `DONE` | `tests/test_cleanup_users.py::test_destructive_hard_fails_without_authdb` |
| `P0.3.c` | Define deletion boundaries for user-scoped, org-scoped, gateway-correlation, and runtime credential cache rows | `DONE` | `P0.3.e` |
| `P0.3.d` | Include `auth.db` in default cleanup scope; keep legacy JSON cleanup as best-effort residue only | `DONE` | `P0.3.e`, `P0.3.f` |
| `P0.3.e` | Tests: deleting a target user removes only that user's rows from `auth.db`; unrelated tenant rows untouched | `DONE` | `tests/test_cleanup_users.py::test_target_user_rows_removed_only` |
| `P0.3.f` | Tests: `--dry-run` reflects actual authoritative state and reports explicit error when `auth.db` unreadable | `DONE` | `tests/test_cleanup_users.py::test_dry_run_reports_authdb_errors` |

#### P0.4 Legacy session residue migration/cleanup

| ID | Task | Status | Test(s) |
| --- | --- | --- | --- |
| `P0.4.a` | Define shared session residue policy: relocate when owner inferable, quarantine by default, delete only via explicit operator policy | `DONE` | `P0.4.c` |
| `P0.4.b` | Implement migration in dedicated module `src/agents/session_residue_migration.py` so authenticated session authority exists only under `workspaces/<workspace_id>/.hermes/sessions/` | `DONE` | `P0.4.c`, `P0.4.d` |
| `P0.4.c` | Tests: legacy residue is migrated or quarantined deterministically | `DONE` | `tests/test_session_residue_migration.py::test_residue_relocate_or_quarantine` |
| `P0.4.d` | Tests: no authenticated workspace session reads shared residue after migration | `DONE` | `tests/test_session_residue_migration.py::test_no_authenticated_read_from_shared_residue` |

#### P0.5 Cross-tenant security regression suite

| ID | Task | Status | Test(s) |
| --- | --- | --- | --- |
| `P0.5.a` | Create `tests/test_multitenant_isolation.py` with fixtures for ≥2 users / 2 workspaces / 1 shared runtime | `DONE` | Self |
| `P0.5.b` | Tests: session list, session detail, trajectory, and run artifact isolation between tenants | `DONE` | `tests/test_multitenant_isolation.py` session-isolation cases |
| `P0.5.c` | Tests: cleanup isolation and gateway correlation isolation across tenants | `DONE` | `tests/test_multitenant_isolation.py::test_cleanup_and_gateway_correlation_isolation` |
| `P0.5.d` | Tests: embedded API forwarding isolation under shared-runtime conditions | `DONE` | `tests/test_multitenant_isolation.py::test_proxy_workspace_boundary` |
| `P0.5.e` | Wire the multitenant isolation suite into CI (`./scripts/run_tests.sh` and pytest selection) | `DONE` | Green CI run on PR |

## P1

`P1` means required for production operations and serious customer onboarding, but
not necessarily the first blocking layer.

### P1 Implementation Checklist

Status legend: `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`.

| Item | Status | Exit check |
| --- | --- | --- |
| `P1.1` Explicit tenant model beyond one-user-one-workspace | `DONE` | Org/user/workspace semantics are codified (org-shared governance + workspace-owned operational state) and enforced by membership/isolation tests |
| `P1.2` Tenant-aware authorization model | `DONE` | `RouteAuthorizationClass` enum + `ROUTE_AUTHZ_CLASS_MAP` declared; `_require_route_authorization()` gate centralized; all declared routes wired through it; section 8.1.2 matrix committed to docs; member/admin/operator tests pass |
| `P1.3` Tenant-scoped observability | `DONE` | `_log_tenant_authz()` emits structured auth-class log on every tenant route; structured identifiers (user_id, workspace_id, organization_id) included; no other-tenant data in log output |
| `P1.4` Quotas and rate limiting | `DONE` | `_enforce_rate_limit()` with correct bucket scoping: `*_user` keys on user_id only, `*_tenant` keys on org/workspace only; cross-user isolation and cross-user tenant aggregation both regression-tested |
| `P1.5` Export and privacy operations | `DONE` | `scripts/export_tenant_data.py` produces `tenant-export-bundle.v1`; user-scoped export filters to actor/subject events only; org-scoped export returns complete event history (no truncation); `--report-json` on cleanup emits `cleanup-report.v1`; all behaviors regression-tested |

### P1 Execution Task List

#### P1.1 Explicit tenant model beyond one-user-one-workspace

Outcome:

- the runtime can support a real SaaS tenant with multiple users and controlled shared state

Primary files:

- `src/agents/gateway_identity.py`
- `src/agents/auth_session.py`
- organization and membership tests
- related docs under `docs/`

| ID | Task | Status | Test(s) / Evidence |
| --- | --- | --- | --- |
| `P1.1.a` | Formalize tenant vocabulary and invariants (`organization`, `user`, `workspace`, personal vs org-shared assets) | `DONE` | `docs/derived/gateway-unified-multitenant-design.md` sections 1.1/1.2 define org-shared governance vs workspace-owned operational state; `workspace_id` binding invariants are explicit |
| `P1.1.b` | Codify and test cross-user ownership/visibility under existing architecture boundaries (org-shared governance/facts, workspace-owned Hermes operational state, governed artifacts in shared `eos.db`) | `DONE` | `tests/test_multitenant_isolation.py::test_session_routes_workspace_scoped`, `::test_cross_workspace_session_detail_returns_404`, `::test_proxy_workspace_boundary`, `::test_cleanup_and_gateway_correlation_isolation` |
| `P1.1.c` | Implement collaboration semantics for multi-user organizations (shared org governance with workspace-owned operational roots) | `DONE` | `tests/test_organization_membership_api.py::test_join_existing_organization_requires_admin_approval`, `::test_user_can_switch_between_known_organizations`, `::test_member_role_management_enforces_owner_guards`, `::test_auth_context_includes_organization_fields` |
| `P1.1.d` | Add regression coverage for org-admin-only actions | `DONE` | `tests/test_p1_multitenant_controls.py::test_member_role_requires_tenant_admin`, `tests/test_organization_membership_api.py::test_member_role_management_enforces_owner_guards` |

#### P1.2 Tenant-aware authorization model

Outcome:

- access control is explicit, testable, and not just identity-to-workspace lookup

Primary files:

- `src/agents/auth_session.py`
- `src/agents/gateway_identity.py`
- route handlers in `src/agents/webapi_gateway.py`

| ID | Task | Status | Test(s) / Evidence |
| --- | --- | --- | --- |
| `P1.2.a` | Define route authorization classes (`self-only`, `tenant-member`, `tenant-admin`, `system/operator`) | `DONE` | `RouteAuthorizationClass` enum + `ROUTE_AUTHZ_CLASS_MAP` in `src/agents/route_policy.py`; section 8.1.2 matrix in docs |
| `P1.2.b` | Centralize authorization checks in shared helper(s) instead of ad hoc route logic | `DONE` | `_require_route_authorization()` in `src/agents/webapi_gateway.py`; `test_route_authz_classes_declared` |
| `P1.2.c` | Migrate tenant-facing route handlers to centralized checks | `DONE` | All org/system routes + `POST /auth/profile/complete` use `_require_route_authorization()`; `test_member_role_requires_tenant_admin` |
| `P1.2.d` | Add regression tests for member/admin distinction and opt-in admin visibility | `DONE` | `tests/test_p1_multitenant_controls.py`; `test_system_operator_route_requires_operator_allowlist` |

#### P1.3 Tenant-scoped observability

Outcome:

- logs, metrics, and incident debugging can be done per tenant without leakage

Primary files:

- runtime logging surfaces in `src/agents/`
- launcher/runtime startup code

| ID | Task | Status | Test(s) / Evidence |
| --- | --- | --- | --- |
| `P1.3.a` | Add stable tenant/workspace identifiers to structured logs where safe | `DONE` | `_log_tenant_authz()` emits `user_id`, `workspace_id`, `organization_id` on every tenant route |
| `P1.3.b` | Ensure logs and diagnostics avoid leaking other-tenant paths/payloads | `DONE` | Structured log uses governed IDs only; no filesystem paths or session payloads emitted |
| `P1.3.c` | Add tenant-aware health/diagnostic surfaces as needed | `DONE` | `GET /system/auth/state` is `system/operator`-gated diagnostic surface |

#### P1.4 Quotas and rate limiting

Outcome:

- one tenant cannot starve shared platform resources

Primary files:

- `src/agents/webapi_gateway.py`
- ingress/gateway startup code
- auth/org state if quota configuration is persisted

| ID | Task | Status | Test(s) / Evidence |
| --- | --- | --- | --- |
| `P1.4.a` | Implement per-user and per-tenant rate limiting on public routes | `DONE` | `_enforce_rate_limit()` in `src/agents/webapi_gateway.py`; `*_user` keys on `user_id` only; `*_tenant` keys on `organization_id/workspace_id` only |
| `P1.4.b` | Add scoped limits for session creation, run creation, uploads | `DONE` | `session_create_user`, `session_create_tenant`, `chat_user`, `chat_tenant` buckets configured |
| `P1.4.c` | Add scoped limits for gateway reconnect attempts and model/tool execution volume | `DONE` | `weixin_reconnect_user`, `auth_public` buckets configured |
| `P1.4.d` | Verify no cross-tenant quota interference under shared runtime | `DONE` | `test_rate_limit_user_bucket_scoped_to_user_id_only`, `test_rate_limit_tenant_bucket_aggregates_across_users` |

#### P1.5 Export and privacy operations

Outcome:

- the system can produce complete tenant/user exports and scoped deletion reports

Primary files:

- `scripts/cleanup_users.py`
- new export tooling
- `src/agents/auth_db.py`
- storage layers for `eos.db`

| ID | Task | Status | Test(s) / Evidence |
| --- | --- | --- | --- |
| `P1.5.a` | Define export bundle contents and schema for user and tenant scope | `DONE` | `tenant-export-bundle.v1` schema in `scripts/export_tenant_data.py`; snapshot tests in `tests/test_p1_export_and_reports.py` |
| `P1.5.b` | Implement user-scoped and org-scoped export flows | `DONE` | User export filters events to actor/subject only; org export returns complete history via `limit=0`; truncation regression tests |
| `P1.5.c` | Define deletion exceptions for append-only governed/audit artifacts | `DONE` | `cleanup-report.v1` documents scope and boundaries; governed artifacts excluded by deletion boundary logic in `scripts/cleanup_users.py` |
| `P1.5.d` | Emit deterministic deletion reports for cleanup/export actions | `DONE` | `--report-json` on `scripts/cleanup_users.py`; `test_cleanup_writes_deterministic_report_json` |

## P2

`P2` means scaling, compliance, and stronger hard-isolation options.

### P2 Implementation Checklist

Status legend: `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`.

| Item | Status | Exit check |
| --- | --- | --- |
| `P2.1` Stronger datastore partitioning decision | `DONE` | ADR accepted with decision matrix, migration plan, rollback plan, and architecture reference |
| `P2.2` Backup and restore per tenant | `DONE` | `scripts/tenant_backup_restore.py` provides tenant-scoped backup/restore with checksum integrity and boundary validation; regression tests pass |
| `P2.3` Secrets and encryption posture | `DONE` | Deterministic secret-source precedence, rotation planning, and revocation logic implemented and regression-tested |
| `P2.4` Compliance and residency posture | `DONE` | Compliance policy artifact + validator enforce retention, residency, and tenant-admin audit surfaces with regression coverage |

### P2 Execution Task List

#### P2.1 Stronger datastore partitioning decision

Outcome:

- explicit decision whether shared `eos.db` is sufficient for the product and compliance target

Architecture guardrail:

- Canonical architecture currently defines governed artifacts in shared `eos.db`.
  Any move to per-tenant `eos.db` is an architecture-change path and must be
  approved via ADR before implementation.

Primary files:

- storage and runtime data access layers
- architecture docs

| ID | Task | Status | Test(s) / Evidence |
| --- | --- | --- | --- |
| `P2.1.a` | Evaluate partitioning options against the current shared-`eos.db` contract; treat per-tenant DB as ADR-gated architecture change, not default implementation work | `DONE` | `docs/adr/ADR-0001-tenant-governed-datastore-partitioning.md` decision matrix |
| `P2.1.b` | Answer customer constraints (backup/restore, residency, legal segregation, replay/audit portability) | `DONE` | Constraint assessment captured in `docs/adr/ADR-0001-tenant-governed-datastore-partitioning.md` |
| `P2.1.c` | Publish architecture decision record with migration and rollback plan | `DONE` | `docs/adr/ADR-0001-tenant-governed-datastore-partitioning.md`; architecture cross-reference in `docs/canonical/architecture.md` |

#### P2.2 Backup and restore per tenant

Outcome:

- a single tenant can be recovered without platform-wide restore

Primary files:

- storage/export tooling
- workspace artifact management

| ID | Task | Status | Test(s) / Evidence |
| --- | --- | --- | --- |
| `P2.2.a` | Define backup units for workspace filesystem, auth state, governed artifacts | `DONE` | `scripts/tenant_backup_restore.py` bundle schema `tenant-backup-bundle.v1` + `docs/derived/tenant-compliance-policy.md` audit surface |
| `P2.2.b` | Implement tenant-scoped backup and restore workflows | `DONE` | `scripts/tenant_backup_restore.py`; `tests/test_tenant_backup_restore.py::test_tenant_backup_restore_roundtrip` |
| `P2.2.c` | Add restore integrity validation and tenant boundary checks | `DONE` | `tests/test_tenant_backup_restore.py::test_restore_rejects_cross_tenant_rows_even_with_valid_checksums` |

#### P2.3 Secrets and encryption posture

Outcome:

- stronger separation between platform secrets and tenant secrets

Primary files:

- workspace bootstrap/env handling
- messaging/gateway credential persistence paths

| ID | Task | Status | Test(s) / Evidence |
| --- | --- | --- | --- |
| `P2.3.a` | Define tenant-secret storage rules and ownership boundaries | `DONE` | `docs/operational/security-tenant-secrets.md` |
| `P2.3.b` | Remove ambiguity across `.hermes/.env`, auth DB cache rows, platform env vars | `DONE` | `src/agents/tenant_secret_policy.py::resolve_secret`; `tests/test_tenant_secret_policy.py::test_resolve_secret_precedence_workspace_platform_auth_cache` |
| `P2.3.c` | Implement rotation and revocation procedures | `DONE` | `src/agents/tenant_secret_policy.py::build_rotation_plan` and `::revoke_auth_cache_entry`; `tests/test_tenant_secret_policy.py` |

#### P2.4 Compliance and residency posture

Outcome:

- the multitenancy model is supportable under higher compliance requirements

| ID | Task | Status | Test(s) / Evidence |
| --- | --- | --- | --- |
| `P2.4.a` | Define retention classes by artifact/data type | `DONE` | `policies/tenant_compliance_policy.v1.json` + `docs/derived/tenant-compliance-policy.md` |
| `P2.4.b` | Define regional storage/residency constraints where required | `DONE` | `src/agents/tenant_compliance_policy.py::is_storage_region_allowed`; `tests/test_tenant_compliance_policy.py` |
| `P2.4.c` | Define tenant-admin auditability expectations and evidence surfaces | `DONE` | `policies/tenant_compliance_policy.v1.json` `tenant_admin_audit_surfaces`; `tests/test_tenant_compliance_policy.py::test_audit_surfaces_include_backup_export_cleanup_evidence` |

## Suggested File-by-File Ownership

### Auth and request context

- `src/agents/auth_session.py`
  - signed session validation
  - authenticated/public context behavior
  - likely place to tighten browser/API fallback semantics

- `src/agents/gateway_identity.py`
  - user/org/workspace binding
  - gateway identity correlation
  - membership and organization context

- `src/agents/auth_db.py`
  - authoritative auth state in SQLite
  - source of truth for cleanup/export target discovery

### Route and ingress control

- `src/agents/webapi_gateway.py`
  - main P0 surface for auth gating and proxy hardening

- `src/agents/gateway.py`
  - public app composition

- `src/agents/hermes_embedded_api.py`
  - embedded Hermes API hosting contract

- `src/agents/hermes_embedded_gateway.py`
  - gateway runtime embedding and provider adapter runtime behavior

### Workspace and session isolation

- `src/runtime_paths.py`
  - workspace root validation and env binding

- `src/agents/workspace_session_logs.py`
  - canonical session/trajectory store

- `src/agents/session_residue_migration.py`
  - implemented legacy session residue relocate/quarantine migration surface

### Operational tooling

- `scripts/cleanup_users.py`
  - authoritative cleanup tool (implemented in P0)

## Stabilization Notes (Post-P2)

Date: 2026-06-01

After landing P2 implementation surfaces, a full-suite regression run surfaced
compatibility and authorization edge cases. These were fixed in the same phase
to keep roadmap status and runtime behavior aligned.

Fixes applied:

- `tests/test_dokploy_backend_entrypoint.py`
  - prevent concurrent JSON capture races by recording only the foreground
    `semantier run` invocation when the entrypoint also triggers background
    bootstrap
- `tests/test_hermes_api_compat.py` (`/system/auth/state`)
  - align test setup with `system/operator` route contract by setting
    `SEMANTIER_OPERATOR_USER_IDS` for the authenticated test principal
- `src/agents/webapi_gateway.py` (`POST /organizations/member-role`)
  - preserve tenant-admin enforcement by default, while allowing owner recovery
    in the narrow ownerless-org case (active member can promote to owner when
    active owner count is zero)
- `src/plugins/business_analytics/__init__.py`
  - restore governed-query auth-context compatibility code expected by tests:
    `AUTH_CONTEXT_REQUIRED`

Remap status (explicit):

- `scripts/tenant_backup_restore.py` restore remap flags
  (`--target-organization-id`, `--allow-org-remap`) are intentionally disabled
  in the current phase and fail closed.
- Rationale: partial remap support is unsafe and can misreport destination
  tenant state.
- Follow-up: full remap semantics (identifier rewriting across auth/governed/
  workspace payloads plus deterministic audit evidence) require a dedicated
  future implementation phase before those flags can be re-enabled.

Governed backup scope policy (explicit):

- `scripts/tenant_backup_restore.py` now treats workspace-only governed tables
  as deny-by-default for tenant backups.
- Inclusion of workspace-only governed tables requires an explicit policy entry
  in `policies/tenant_backup_governed_scope.v1.json`.
- Even when allowlisted, workspace-only governed rows are included only when a
  workspace predicate is present, preserving tenant/workspace narrowing.
- Future scope expansion must remain policy-driven with paired regression tests
  (no heuristic table discovery).

Verification:

- multitenancy-focused regression sweep on 2026-06-01 passed:
  - `53 passed`
  - `57 warnings`
  - runtime: `~9m56s`

## Milestones

### Milestone A

- close auth gaps on wrapper and proxy routes
- add cross-tenant route isolation tests

Exit criteria:

- no tenant-facing wrapper session route is anonymously callable

### Milestone B

- authoritative cleanup via `auth.db`
- legacy session residue policy implemented

Exit criteria:

- tenant/user deletion and cleanup operate on authoritative state only

### Milestone C

- explicit tenant authorization model
- org-level multitenancy semantics defined

Exit criteria:

- multi-user tenant behavior is defined and tested instead of implied

### Milestone D

- quotas, observability, export, restore design

Exit criteria:

- platform can onboard and operate real tenants safely

## Minimal Definition Of “Real Isolated Multitenant SaaS” For This Repo

This repo now satisfies the following definition:

- all tenant-facing routes are explicitly authenticated and authorized
- cross-tenant regression tests pass
- cleanup/export operate from authoritative stores
- no authenticated tenant state depends on shared residue paths
- proxy and embedded API surfaces cannot bypass tenant controls
- tenant lifecycle operations are defined and tested
