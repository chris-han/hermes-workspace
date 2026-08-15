import { z } from 'zod'

import { SourceAnchorSchema } from './source-anchor'
import { EvidenceRefSchema } from './evidence-location'

export const GraphViewModelSchema = z.object({
  schemaVersion: z.literal('semantier.graph_view_model.v2').default('semantier.graph_view_model.v2'),
  graphRef: z.string().min(1).default(''),
  graphVersion: z.string().min(1).default(''),
  graphHash: z.string().min(1).default(''),
  authorityState: z.enum(['candidate', 'authoritative']).default('candidate'),
  candidateGraphId: z.string().nullable(),
  acceptedReleaseId: z.string().nullable(),
  nodes: z.array(z.object({ id: z.string().min(1), semanticType: z.string().default('unknown'), label: z.string().default(''), properties: z.record(z.unknown()).default({}), evidenceRefs: z.array(EvidenceRefSchema.shape.evidenceRef).default([]), groundingState: z.enum(['pending', 'accepted', 'edited', 'rejected']).default('pending') }).passthrough()),
  edges: z.array(z.object({ id: z.string().min(1), sourceId: z.string().default(''), targetId: z.string().default(''), relationshipType: z.string().default('related_to'), weight: z.number().default(1), properties: z.record(z.unknown()).default({}), evidenceRefs: z.array(EvidenceRefSchema.shape.evidenceRef).default([]), groundingState: z.enum(['pending', 'accepted', 'edited', 'rejected']).default('pending') }).passthrough()),
  sourceAnchors: z.array(SourceAnchorSchema),
  sourceEvidenceRefs: z.array(EvidenceRefSchema.shape.evidenceRef).default([]),
})

// Input remains migration-compatible with the v1 graph payload; consumers
// that need a complete v2 object should parse through the schema first.
export type GraphViewModel = z.input<typeof GraphViewModelSchema>
