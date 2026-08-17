import { z } from 'zod'

const RuntimeLineageSchema = z.object({
  sourceIdentityRefs: z.array(z.string()).default([]),
  extractionRunRef: z.string().nullable().default(null),
  candidateGraphId: z.string().nullable().default(null),
  acceptedReleaseId: z.string().nullable().default(null),
  acceptedReleaseVersion: z.string().nullable().default(null),
}).default({})

/**
 * Browser transport shape returned by
 * `GET /api/contextgraph/runtime`. The transport is a compatibility layer
 * over the canonical `GraphViewModel.v2` snapshot; this schema exists so the
 * Studio cannot accidentally consume the raw response without going through
 * the GraphViewModel.v2 adapter (`contextgraph-runtime-adapter.ts`).
 *
 * The plan rule is that the renderer consumes only parsed
 * `GraphViewModel.v2`; this schema only validates the transport boundary.
 */
export const ContextGraphRuntimeProjectionV1Schema = z.object({
  schemaVersion: z.literal('semantier.contextgraph.browser_projection.v1'),
  graphRef: z.string().min(1).default(''),
  graphVersion: z.string().min(1).default(''),
  graphHash: z.string().min(1).default(''),
  authorityState: z.enum(['candidate', 'authoritative']).default('candidate'),
  candidateGraphId: z.string().nullable().default(null),
  acceptedReleaseId: z.string().nullable().default(null),
  acceptedReleaseVersion: z.string().nullable().default(null),
  semanticaCommit: z.string().nullable().default(null),
  providerRef: z.string().default('semantica'),
  providerCommit: z.string().nullable().default(null),
  nodes: z
    .array(
      z.object({
        id: z.string().min(1),
        type: z.string().default('concept'),
        content: z.string().default(''),
        sourceAnchors: z
          .array(
            z.object({
              sourceRef: z.string(),
              sourceHash: z.string(),
              locator: z.string(),
              quote: z.string().nullable(),
            }),
          )
          .default([]),
        evidenceRefs: z.array(z.string().min(1)).default([]),
        evidenceRefDetails: z.array(z.record(z.unknown())).default([]),
        properties: z.record(z.unknown()).default({}),
        groundingState: z.enum(['pending', 'accepted', 'edited', 'rejected']).default('pending'),
        lineage: RuntimeLineageSchema,
      }),
    )
    .default([]),
  edges: z
    .array(
      z.object({
        id: z.string().min(1),
        familyId: z.string().default(''),
        source: z.string().default(''),
        target: z.string().default(''),
        type: z.string().default('related_to'),
        weight: z.number().default(1),
        properties: z.record(z.unknown()).default({}),
        sourceAnchors: z.array(z.object({ sourceRef: z.string(), sourceHash: z.string(), locator: z.string(), quote: z.string().nullable() })).default([]),
        evidenceRefs: z.array(z.string().min(1)).default([]),
        evidenceRefDetails: z.array(z.record(z.unknown())).default([]),
        groundingState: z.enum(['pending', 'accepted', 'edited', 'rejected']).default('pending'),
        lineage: RuntimeLineageSchema,
      }),
    )
    .default([]),
  sourceAnchors: z
    .array(
      z.object({
        sourceRef: z.string(),
        sourceHash: z.string(),
        locator: z.string(),
        quote: z.string().nullable(),
      }),
    )
    .default([]),
  sourceEvidenceRefs: z.array(z.string().min(1)).default([]),
})

export type ContextGraphRuntimeProjectionV1 = z.input<
  typeof ContextGraphRuntimeProjectionV1Schema
>

/**
 * Minimal v0/v1 pair contract for Compare and Evaluate modes. Sourced from
 * the existing `/api/contextgraph/runtime` lineage plus the MVL workflow
 * context the Studio already projects into `KnowledgeWorkbenchContext.v2`.
 */
export const ContextGraphMVLWorkflowSummaryV1Schema = z.object({
  schemaVersion: z.literal('semantier.contextgraph.mvl_workflow_summary.v1'),
  v0RunRef: z.string().nullable().default(null),
  v1RunRef: z.string().nullable().default(null),
  learningDecision: z.enum(['GO', 'STOP_REVISE', 'SPLIT_FIX']).nullable().default(null),
  evaluationRunId: z.string().nullable().default(null),
})

export type ContextGraphMVLWorkflowSummaryV1 = z.input<
  typeof ContextGraphMVLWorkflowSummaryV1Schema
>
