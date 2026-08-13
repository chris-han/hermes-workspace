import { z } from 'zod'

import { GraphInteractionCommandSchema } from './graph-interaction'
import { SourceAnchorSchema } from './source-anchor'

export const GovernanceStateSchema = z.enum([
  'candidate',
  'validated',
  'approved',
  'active',
  'deprecated',
  'rejected',
])

export const KnowledgeWorkbenchContextSchema = z.object({
  candidateGraphId: z.string().nullable(),
  acceptedReleaseId: z.string().nullable(),
  acceptedReleaseVersion: z.string().nullable(),
  selectedNodeIds: z.array(z.string()),
  selectedEdgeIds: z.array(z.string()),
  selectedRuleIds: z.array(z.string()),
  sourceAnchors: z.array(SourceAnchorSchema),
  governanceState: GovernanceStateSchema,
  hasAcceptedRelease: z.boolean(),
  extractionRunId: z.string().nullable(),
  providerRef: z.string().nullable(),
  providerCommit: z.string().nullable(),
})

export const KnowledgeWorkbenchResultSchema = z.object({
  message: z.string(),
  focus: z.object({
    nodeIds: z.array(z.string()),
    edgeIds: z.array(z.string()),
    ruleIds: z.array(z.string()),
    sourceAnchors: z.array(SourceAnchorSchema),
  }),
  candidateGraphId: z.string().nullable(),
  acceptedReleaseId: z.string().nullable(),
  proposedAction: z.enum([
    'none',
    'inspect',
    'review_merge',
    'review_relation',
    'compare_release',
  ]),
  interaction: GraphInteractionCommandSchema.nullable(),
})

export type GovernanceState = z.infer<typeof GovernanceStateSchema>
export type KnowledgeWorkbenchContext = z.infer<
  typeof KnowledgeWorkbenchContextSchema
>
export type KnowledgeWorkbenchResult = z.infer<
  typeof KnowledgeWorkbenchResultSchema
>
