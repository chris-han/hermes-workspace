# Knowledge Entitlement Contract Schema

Status: Draft schema for Phase-1 implementation

References:
- [data-knowledge-authorization-management-draft.md](../operational/data-knowledge-authorization-management-draft.md)
- [knowledge_tier_implementation_spec.md](knowledge_tier_implementation_spec.md)
- [gateway-unified-multitenant-design.md](gateway-unified-multitenant-design.md)
- [architecture.md](../canonical/architecture.md)
- [../refactoring_plan_8.6.7_phase1_sprint2.md](../refactoring_plan_8.6.7_phase1_sprint2.md)

## 1. Purpose

This document defines the fixed backend contract for the Phase-1 `Knowledge Access`
surface. It is the implementation-time schema target for:

- backend entitlement contract endpoints
- frontend `Knowledge Access` settings page
- bundle preview rendering
- future migration away from legacy role-matrix-only payloads

This schema is production-shaped even though Phase-1 implements only a narrow
capability slice.

## 2. Scope

This contract covers:

- principal summary
- active organization context
- effective capability grants
- per-tier UI projection
- bundle preview projection
- contract metadata for compatibility and debugging

This contract does not cover:

- grant mutation endpoints
- approval workflow payloads
- full audit event payloads
- full promotion workflow payloads

## 3. Canonical Semantics

### 3.1 Core rule

The source of truth is:

```text
principal + organization binding + effective capability grants + scope + governance conditions
```

The following are not the source of truth:

- `owner/admin/member` labels by themselves
- frontend-local policy inference
- workspace-local state

### 3.2 Bundle semantics

`owner/admin/member` are operator-facing bundle labels only.

Rules:

- bundle labels may be assigned to principals
- bundle labels expand into capability grants
- bundle labels may be previewed in UI
- final entitlement decisions must use effective grants, not labels

### 3.3 UI action semantics

Phase-1 UI projection uses:

- `view`
- `propose`
- `review`

Richer backend semantics may still exist:

- `activate`
- `execute`
- `validate`

`allow_with_review` means:

- the principal may initiate the path,
- but cannot complete the path alone,
- and one or more governance conditions remain unsatisfied by that principal alone.

## 4. Contract Envelope

Top-level response shape:

```yaml
knowledge_entitlement_contract:
  schema_version: "phase1.v1"
  generated_at: "2026-05-12T12:34:56Z"
  principal: {...}
  organization_context: {...}
  effective_capabilities: [...]
  ui_projection: {...}
  bundle_preview: {...}
  evaluation_metadata: {...}
```

Top-level required fields:

- `schema_version`
- `generated_at`
- `principal`
- `organization_context`
- `effective_capabilities`
- `ui_projection`
- `bundle_preview`

## 5. Field Definitions

### 5.1 `principal`

```yaml
principal:
  user_id: string
  organization_id: string
  assigned_bundles:
    - owner
    - admin
    - member
  membership_status: active | pending | revoked
```

Rules:

- `assigned_bundles` may be empty
- multiple bundle labels are allowed in the contract shape even if Phase-1 uses one
- `organization_id` must match the active request context

### 5.2 `organization_context`

```yaml
organization_context:
  organization_id: string
  official_display_name: string
  display_name_source: t4_policy | seed_default
  workspace_id: string | null
```

Rules:

- this field describes currently effective org context, not historical rename lineage
- `display_name_source=seed_default` is acceptable in Phase-1
- future runtime rename governance may later emit `t4_policy`

### 5.3 `effective_capabilities`

```yaml
effective_capabilities:
  - capability: context.read
    decision: allow | allow_with_review | deny
    scope:
      organization_id: string
      team_ids: [string]
      authority_domains: [string]
      workflow_set: [string]
      semantic_tier_ceiling: T1 | T2 | T3 | T4 | T5 | T6
      resource_classes: [string]
    governance_conditions:
      review_required: boolean
      approver_roles: [string]
      validator_required: boolean
      replay_pin_required: boolean
      activation_required: boolean
    source:
      bundle_labels: [string]
      direct_grant_ids: [string]
```

Required per entry:

- `capability`
- `decision`
- `scope`

Optional per entry:

- `governance_conditions`
- `source`

Decision rules:

- `allow` means the principal may complete that action within the stated scope, subject to normal runtime preconditions
- `allow_with_review` means the principal may initiate but not complete alone
- `deny` means no eligible path exists from this contract alone

Phase-1 capability whitelist:

- `context.read`
- `knowledge.propose`
- `knowledge.activate_t5_user`
- `knowledge.activate_t5_org`
- `knowledge.review_t4`
- `execution.run_scoped`
- `validation.attest`

### 5.4 `ui_projection`

```yaml
ui_projection:
  tiers:
    T1:
      view: allow | allow_with_review | deny
      propose: allow | allow_with_review | deny
      review: allow | allow_with_review | deny
    T2: {...}
    T3: {...}
    T4: {...}
    T5: {...}
    T6: {...}
  action_mapping:
    view: can_read_context
    propose: can_initiate_path
    review: can_participate_in_required_gate
  decision_legend:
    allow: principal may complete within current contract scope
    allow_with_review: principal may initiate but cannot complete alone
    deny: no eligible path from current contract
```

Rules:

- all tiers `T1..T6` must be present
- all actions `view/propose/review` must be present per tier
- `ui_projection` is a rendering projection, not an execution-time decision engine

### 5.5 `bundle_preview`

```yaml
bundle_preview:
  owner:
    tiers:
      T1: {view: allow, propose: deny, review: deny}
      T2: {view: allow, propose: deny, review: deny}
      T3: {view: allow, propose: allow_with_review, review: allow}
      T4: {view: allow, propose: allow_with_review, review: allow}
      T5: {view: allow, propose: allow, review: allow}
      T6: {view: allow, propose: allow, review: deny}
  admin: {...}
  member: {...}
```

Rules:

- preview entries are educational defaults, not live authority by themselves
- preview values may differ from current principal effective values
- Phase-1 may compute bundle preview from static preset expansion

### 5.6 `evaluation_metadata`

```yaml
evaluation_metadata:
  resolver_version: string
  policy_mode: static_phase1_bundle_projection
  derived_from:
    assigned_bundle_labels: [string]
    direct_grants_present: boolean
  warnings:
    - string
```

Purpose:

- aid debugging
- surface whether the response came purely from bundle presets
- support future migration to persisted grants

## 6. Phase-1 Derivation Rules

### 6.1 Effective capability derivation

Phase-1 derivation order:

1. resolve principal and `organization_id`
2. load assigned bundle labels if any
3. expand bundle labels to default grants
4. merge direct grants if implemented
5. compute effective capability decisions
6. project effective decisions into `ui_projection`
7. compute educational `bundle_preview`

### 6.2 Merge rules

If Phase-1 supports both bundle grants and direct grants:

- direct deny is not modeled as a separate override primitive in Phase-1
- effective union may widen capability coverage
- scope intersection or conflict policy must be deterministic and documented

If direct grants are not yet implemented:

- `direct_grant_ids` should be empty
- `direct_grants_present` should be `false`

### 6.3 Tier projection rules

Recommended Phase-1 projection logic:

- `view` derives primarily from `context.read`
- `propose` derives from `knowledge.propose` and scoped activation capabilities where relevant
- `review` derives from `knowledge.review_t4` and similar governance-participation capabilities

The projection is intentionally lossy:

- richer backend capabilities collapse into a simpler UI summary
- no UI-only permission should exist that is absent from backend effective grants

## 7. Current Implementation Status

Current implementation surface:

- [src/agents/knowledge_access_model.py](/home/chris/repo/semantier-runtime/src/agents/knowledge_access_model.py:1)
- [src/agents/webapi_gateway.py](/home/chris/repo/semantier-runtime/src/agents/webapi_gateway.py:824)

Current status:

- the new schema is the live contract for `GET /organizations/knowledge-access`
- the current resolver is intentionally narrow and Phase-1 scoped
- entitlement evaluation is currently derived from static bundle presets
- first-class persisted grants and direct-grant merge logic are still future backlog items

Implementation rule:

- new work should extend this live schema, not revive `configure`-style role matrices
- if compatibility with any old payload is temporarily required, it should live in an adapter layer rather than redefining the canonical contract

## 8. Example Contract

```yaml
knowledge_entitlement_contract:
  schema_version: phase1.v1
  generated_at: 2026-05-12T12:34:56Z
  principal:
    user_id: user_123
    organization_id: org_construction_3_year_cn
    assigned_bundles: [admin]
    membership_status: active
  organization_context:
    organization_id: org_construction_3_year_cn
    official_display_name: 北京索阳科技有限公司
    display_name_source: seed_default
    workspace_id: ws_456
  effective_capabilities:
    - capability: context.read
      decision: allow
      scope:
        organization_id: org_construction_3_year_cn
        team_ids: []
        authority_domains: [management, accounting, internal_control]
        workflow_set: []
        semantic_tier_ceiling: T6
        resource_classes: [fact_record, contextual_memory, active_knowledge_artifact]
      governance_conditions:
        review_required: false
        approver_roles: []
        validator_required: false
        replay_pin_required: false
        activation_required: false
      source:
        bundle_labels: [admin]
        direct_grant_ids: []
    - capability: knowledge.propose
      decision: allow_with_review
      scope:
        organization_id: org_construction_3_year_cn
        team_ids: []
        authority_domains: [management]
        workflow_set: []
        semantic_tier_ceiling: T4
        resource_classes: [policy_candidate, interpretation_candidate]
      governance_conditions:
        review_required: true
        approver_roles: [policy_owner, governance_chair]
        validator_required: false
        replay_pin_required: false
        activation_required: true
      source:
        bundle_labels: [admin]
        direct_grant_ids: []
  ui_projection:
    tiers:
      T1: {view: allow, propose: deny, review: deny}
      T2: {view: allow, propose: deny, review: deny}
      T3: {view: allow, propose: allow_with_review, review: deny}
      T4: {view: allow, propose: allow_with_review, review: allow}
      T5: {view: allow, propose: allow, review: allow}
      T6: {view: allow, propose: allow, review: deny}
    action_mapping:
      view: can_read_context
      propose: can_initiate_path
      review: can_participate_in_required_gate
    decision_legend:
      allow: principal may complete within current contract scope
      allow_with_review: principal may initiate but cannot complete alone
      deny: no eligible path from current contract
  bundle_preview:
    owner:
      tiers:
        T1: {view: allow, propose: deny, review: deny}
        T2: {view: allow, propose: deny, review: deny}
        T3: {view: allow, propose: allow_with_review, review: allow}
        T4: {view: allow, propose: allow_with_review, review: allow}
        T5: {view: allow, propose: allow, review: allow}
        T6: {view: allow, propose: allow, review: deny}
    admin:
      tiers:
        T1: {view: allow, propose: deny, review: deny}
        T2: {view: allow, propose: deny, review: deny}
        T3: {view: allow, propose: allow_with_review, review: deny}
        T4: {view: allow, propose: allow_with_review, review: allow}
        T5: {view: allow, propose: allow, review: allow}
        T6: {view: allow, propose: allow, review: deny}
    member:
      tiers:
        T1: {view: allow, propose: deny, review: deny}
        T2: {view: allow, propose: deny, review: deny}
        T3: {view: allow, propose: deny, review: deny}
        T4: {view: allow, propose: deny, review: deny}
        T5: {view: allow, propose: allow, review: deny}
        T6: {view: allow, propose: allow, review: deny}
  evaluation_metadata:
    resolver_version: phase1.v1
    policy_mode: static_phase1_bundle_projection
    derived_from:
      assigned_bundle_labels: [admin]
      direct_grants_present: false
    warnings:
      - direct grants not yet enabled in this environment
```

## 9. Acceptance Criteria

Before backend implementation starts, the contract is acceptable only if:

1. backend and frontend agree on this schema as the only live contract shape
2. no new implementation depends on `configure`
3. no new implementation treats raw role labels as authority truth
4. `allow_with_review` is rendered and interpreted consistently
5. contract generation remains deterministic for the same principal and input state
