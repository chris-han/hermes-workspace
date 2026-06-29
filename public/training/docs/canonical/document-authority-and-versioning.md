# Document Authority And Versioning

**Status:** Canonical documentation-governance reference for this repository.

**Purpose:** Define which documents are authoritative, how doctrinal and runtime versions relate, and where completed or superseded interim plans should live.

## 1. Authority Hierarchy

The repository uses four documentation authority levels and one distinct decision-record class:

1. **Doctrine layer**
   - `white-paper/semantier_eos_v2_1.md`
   - `white-paper/semantier-agentic-system-methodology-12345.md`
   - Purpose: conceptual law, doctrine, and methodology.

2. **Runtime contract layer**
   - [architecture.md](architecture.md)
   - Purpose: canonical repository contract for runtime architecture, boundaries, state models, replay, trust, and governance semantics.
   - Rule: if another repo doc conflicts with `architecture.md`, preserve `architecture.md` unless and until the contract is intentionally revised.

3. **Derived contract layer**
   - Examples: `knowledge_tier_implementation_spec.md`, `gateway-unified-multitenant-design.md`, `prd_weixin_semantic_completion.md`, `t6_materialization_pipeline_modes.md`
   - Purpose: implement, specialize, or operationalize a subset of the runtime contract.
   - Rule: these documents must cite their upstream contract and must not redefine global terms already defined in `architecture.md`.

4. **Operational / design / historical layer**
   - Examples: `DESIGN.md`, runbooks, roadmaps, implementation notes
   - Purpose: UI guidance, deployment instructions, status tracking, or implementation context.
   - Rule: these documents are not global semantic authority sources unless they explicitly say so.

## 1.1 ADRs

Architecture Decision Records under `docs/adr/` are a separate document type.

- Purpose: record why an important architectural or operational decision was made.
- Authority: decision record, not runtime contract.
- Rule:
  - an ADR may justify or constrain later work,
  - but the active source of truth for current runtime behavior remains `docs/canonical/architecture.md` and other active contract docs,
  - if implementation evolves after an ADR, the runtime contract should describe current truth and the ADR should remain as historical decision context unless superseded by a later ADR.

Short form:

- `canonical/` = what is true now
- `derived/` = specialized active contracts
- `operational/` = runbooks, plans, roadmaps, style guides
- `adr/` = why key decisions were made
- `archive_doc/` = superseded or historical material

## 2. Version Semantics

The repository intentionally uses two version tracks:

- **`v2.1`** refers to doctrinal white-paper law.
- **`v8.x`** refers to the repository runtime contract lineage and implementation-era contract extensions.

Interpretation rule:

- `v2.1` defines doctrine.
- `v8.x` realizes that doctrine for this codebase and may add implementation-structure, extension rules, or phased runtime contracts.
- `v8.x` must not silently contradict doctrinal invariants from `v2.1`.
- When `v8.x` adds structure, the document should say whether it is:
  - a strict extension,
  - a repository-specific realization, or
  - a temporary implementation note pending contract merge.

## 3. Scope Labels Required In Docs

Docs that define behavior should state all of the following near the top:

- `Status`
- `Authority`
- `Scope`
- `Upstream sources`
- `Supersedes` or `Superseded by` when relevant

Recommended authority labels:

- `Canonical runtime contract`
- `Derived implementation contract`
- `Product / channel PRD`
- `UI style guideline`
- `Operational runbook`
- `Architecture decision record`
- `Historical plan`

## 4. Anti-Duplication Rules

- Global definitions belong in `architecture.md`.
- Tier-specific governance mechanics belong in `knowledge_tier_implementation_spec.md`.
- Channel behavior belongs in PRDs and should cite the runtime contract instead of re-defining it.
- UI guidance belongs in `DESIGN.md` and should not try to be an architecture document.
- Completed, superseded, or one-off implementation plans should move to `archive_doc/`.

## 5. Archive Policy

Move a doc to `archive_doc/` when any of the following is true:

- it is a completed implementation plan,
- it is an interim note superseded by a canonical contract doc,
- it documents a one-time migration or stabilization pass already landed,
- keeping it in `docs/` would create duplicate normative language.

Archived docs remain useful historical context, but they are not active contract surfaces.
