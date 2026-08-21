# Live-Data Bridge Readiness — Semantica Showcase

Status: design notes captured for future live-mode work.
This document is **non-normative for the showcase milestone**: the showcase
remains fully offline and read-only. The mapping sketches below exist so the
follow-on live-data bridge can be built without touching renderer code.

## 1. From `SensitiveTermCandidateGraph` to the readonly graph view

`SensitiveTermCandidateGraph` (Hermes workspace, candidate-graph schema) wraps
nodes/edges with explicit lineage, anchors, confidence, and proposal IDs.
For the showcase to render that data through the existing adapters without
losing information, the live bridge adapter must:

| Candidate field | Showcase field | Notes |
|---|---|---|
| `nodes[].id` | `entity.id` | Preserve byte-for-byte. |
| `nodes[].label` | `entity.name` | Fallback to `id` if absent. |
| `nodes[].type` | `entity.type` | Preserve; candidate graphs use domain-specific types. |
| `edges[].id` | `relationship.id` | Preserve when present. |
| `edges[].source` / `target` | `relationship.source` / `target` | Preserve. |
| `edges[].relation` | `relationship.type` | Map proposal type to Semantica-style predicate. |
| `edges[].confidence` | not shown in v1 | Available in `properties` once we widen the adapter contract. |
| `candidate_graph_id`, `extraction_run_id`, `source_document_hash` | `properties` | Preserve in case the inspector widens later. |

The bridge MUST run inside the live adapter layer, not inside the showcase
subtree. The showcase adapters continue to consume only
`SemanticaShowcaseDataset`.

## 2. From `GovernedGraphProjection` to the readonly graph view

`GovernedGraphProjection` is the production authority projection. To render it
through the same renderers we must:

- extract the active scene's `nodeIds` and `edgeIds`,
- convert each `GraphNode` to `SigmaGraphReadonlyNode`,
- convert each `GraphEdge` to `SigmaGraphReadonlyEdge` mapping
  `predicateLabel` to `label`,
- keep `governanceState`, `authorityRole`, `semanticTier` accessible via
  `properties` so the inspector can render them in a future live mode.

This is **not** part of the showcase milestone. The current
`SigmaGraph` component already renders from `GovernedGraphProjection` directly.

## 3. From Semantica Explorer `ApiNode` / `ApiEdge` to the readonly graph view

Explorer uses a paged API shape that adds `familyId`, `valid_from`,
`valid_until`, and a `properties` object. To map it into the showcase
renderer:

- `ApiNode.id` → `node.id`
- `ApiNode.type` → `node.group`
- `ApiNode.content` (or `label`) → `node.label`
- `ApiNode.valid_from` / `valid_until` → `node.properties.timeRange`
- `ApiEdge.familyId` → `edge.properties.familyId`
- `ApiEdge.type` → `edge.label`
- `ApiEdge.weight` → `edge.size` (clamped)

The exploration store (`graphStore.ts`) and the loader (`useLoadGraph.ts`)
must remain outside the showcase subtree.

## 4. Future live-mode swap

A future live mode can replace the dataset source by swapping
`semantica-showcase-dataset.ts`'s loader:

```ts
// Future (not in this milestone):
const liveBundle = await loadLiveDatasetBundle(activeGraphId)
```

The renderer architecture (`SigmaGraphReadonly`, the four adapter
signatures, the `ShowcaseViewMeta` contract, and the shell) does not change.

## 5. Acceptance gate boundary

This showcase does **not** satisfy B7/B8 of the
`2026-08-19-semantica-memory-provider-acceptance-gates-v1.md` plan. The
acceptance gate remains separate and must continue to be exercised against
the real Semantica backend. The live-data bridge documented above is what
the acceptance gate will eventually exercise; until it does, the showcase is
strictly a static reference surface.
