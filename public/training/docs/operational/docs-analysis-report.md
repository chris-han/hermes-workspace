# Documentation Authority Alignment Report

**Date:** 2026-06-03
**Status:** Active remediation report replacing the earlier v2.1-only staleness analysis.
**Authority:** Architect review and cleanup plan. This file is not itself a runtime contract.
**Upstream sources:**
- [AGENTS.md](AGENTS.md)
- [docs/canonical/document-authority-and-versioning.md](docs/canonical/document-authority-and-versioning.md)
- [docs/canonical/architecture.md](docs/canonical/architecture.md)
- `white-paper/semantier_eos_v2_1.md`
- `white-paper/semantier-agentic-system-methodology-12345.md`

## Executive Summary

The earlier documentation review correctly detected real duplication and version-label ambiguity, but it used the wrong authority hierarchy for this repository. The repo contract is:

1. doctrine in the white paper and methodology;
2. runtime realization in `docs/canonical/architecture.md`;
3. derived implementation and product docs under that runtime contract;
4. operational, design, and archived historical notes outside the normative chain.

The current cleanup therefore focuses on:

- making the authority hierarchy explicit;
- preserving `docs/canonical/architecture.md` as canonical runtime contract;
- reducing duplicate normative definitions in derived docs;
- moving completed or superseded interim plans out of active `docs/`.

## Corrected Architectural Position

### Canonical hierarchy

- `white-paper/semantier_eos_v2_1.md` and the 12345 methodology are doctrinal law.
- `docs/canonical/architecture.md` is the canonical runtime contract for this repository.
- Derived docs must cite `architecture.md` instead of competing with it.

This follows [AGENTS.md](AGENTS.md), which explicitly treats `docs/canonical/architecture.md` as canonical runtime contract.

### Version interpretation

- `v2.1` is doctrinal.
- `v8.x` is repository runtime-contract lineage.
- `v8.x` may extend or structure implementation details, but must not weaken doctrinal invariants.

This means `v8.1` is not automatically “wrong”; it must instead be explained in relation to `v2.1`.

## Findings That Still Stand

These concerns remain valid and should continue driving cleanup:

- version labels across `v2.1`, `v7.x`, `v8.x`, and `v9` need explicit interpretation;
- many docs need top-of-file scope and authority labels;
- several active docs duplicate definitions that belong only in `architecture.md`;
- completed implementation plans in `docs/operational/plans/` create noise and conflict risk when left in active docs;
- `DESIGN.md` needed to be explicitly framed as UI-only, not architecture.

## Findings From The Earlier Report That Are Rejected

The prior report should not be used as an authority source for the following claims:

- that `docs/canonical/architecture.md` is stale merely because it uses `v8.1`;
- that `architecture.md` lacks KGL, Projection Domain, or the Three-Gate model;
- that `knowledge_tier_implementation_spec.md` omits T0 or retrieval-boundary discussion;
- that all candidate/materialization state should be collapsed into projection trust states;
- that T6 is the highest authority tier.

Those conclusions conflict with the repo’s current architecture and code-backed contract.

## Remediation Actions Applied

### Added

- `docs/canonical/document-authority-and-versioning.md`
  - defines authority hierarchy, version semantics, archive policy, and anti-duplication rules.

### Updated

- `docs/canonical/architecture.md`
  - now states its authority level, upstream sources, and the intended `v2.1` -> `v8.x` relationship.
- `docs/derived/knowledge_tier_implementation_spec.md`
  - now explicitly declares itself a derived implementation contract.
- `docs/derived/prd_weixin_semantic_completion.md`
  - now declares itself a channel/product PRD under the shared runtime contract.
- `docs/operational/DESIGN.md`
  - now explicitly states it is a UI style guideline rather than an architecture spec.

### Archival cleanup

Completed or superseded interim plan docs should live under `archive_doc/` instead of active `docs/` once they no longer act as active work orders.

## Remaining Cleanup Backlog

### High priority

1. Add the same authority/scope metadata to the remaining active derived docs.
2. Reduce duplicated normative definitions in:
   - `gateway-unified-multitenant-design.md`
   - `t6_materialization_pipeline_modes.md`
   - `user_journey_and_user_story.md`
3. Clarify `v9` scope in `v9_insurance_feature_vision.md`.

### Medium priority

1. Rewrite or archive older draft docs that still mix proposal language with active contract language.
2. Replace outdated references to old refactoring plans where the canonical contract has already absorbed the behavior.
3. Add “superseded by” notes to archived plan docs where appropriate.

## Working Rule Going Forward

When a doc needs a global definition, it should link to `architecture.md` instead of re-defining it. When a doc is historical or operational, it should say so plainly near the top. That is the main control needed to keep the docs coherent as the runtime evolves.
