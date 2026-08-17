import { z } from 'zod'

import { GraphInteractionCommandSchema } from './graph-interaction'
import { SourceAnchorSchema } from './source-anchor'
import { EvidenceRefSchema } from './evidence-location'

export const GovernanceStateSchema = z.enum([
  'candidate',
  'validated',
  'approved',
  'active',
  'deprecated',
  'rejected',
])

export const ActiveFunctionSchema = z.object({
  surface: z.string().min(1),
  function: z.string().min(1),
  tab: z.string().min(1),
})

export const UserIntentSchema = z.object({
  kind: z.string().min(1),
  source: z.enum(['web_ui', 'chat', 'navigation']),
  explicitness: z.enum(['implicit', 'explicit']),
  targetType: z.string().nullable(),
  targetIds: z.array(z.string()),
})

export const KnowledgeWorkbenchContextSchema = z.object({
  schemaVersion: z
    .literal('knowledge_workbench_context.v2')
    .default('knowledge_workbench_context.v2'),
  activeFunction: ActiveFunctionSchema.nullable().default(null),
  userIntent: UserIntentSchema.nullable().default(null),
  graphRef: z.string().nullable().optional(),
  graphVersion: z.string().nullable().optional(),
  graphHash: z.string().nullable().optional(),
  authorityState: z.enum(['candidate', 'authoritative']).nullable().optional(),
  runMode: z
    .enum(['evaluation_baseline', 'authoritative'])
    .nullable()
    .optional(),
  candidateGraphId: z.string().nullable(),
  acceptedReleaseId: z.string().nullable(),
  acceptedReleaseVersion: z.string().nullable(),
  selectedNodeIds: z.array(z.string()),
  selectedEdgeIds: z.array(z.string()),
  selectedRuleIds: z.array(z.string()),
  selectedCandidateId: z.string().nullable().default(null),
  selectedEvidenceRefs: z
    .array(EvidenceRefSchema.shape.evidenceRef)
    .default([]),
  activeSourceIdentityRef: z.string().nullable().default(null),
  sourceAnchors: z.array(SourceAnchorSchema),
  governanceState: GovernanceStateSchema,
  hasAcceptedRelease: z.boolean(),
  extractionRunId: z.string().nullable(),
  providerRef: z.string().nullable(),
  providerCommit: z.string().nullable(),
  targetEvidenceRef: z.string().nullable().default(null),
  activeRuleVersionId: z.string().nullable().default(null),
  graphRuleId: z.string().nullable().default(null),
  originEvidenceRef: z.string().nullable().default(null),
})

export const KnowledgeWorkbenchResultSchema = z.object({
  schemaVersion: z
    .literal('knowledge_workbench_result.v2')
    .default('knowledge_workbench_result.v2'),
  message: z.string(),
  focus: z.object({
    nodeIds: z.array(z.string()),
    edgeIds: z.array(z.string()),
    ruleIds: z.array(z.string()),
    evidenceRefs: z.array(EvidenceRefSchema.shape.evidenceRef).default([]),
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
export type ActiveFunction = z.infer<typeof ActiveFunctionSchema>
export type UserIntent = z.infer<typeof UserIntentSchema>
export type KnowledgeWorkbenchContext = z.input<
  typeof KnowledgeWorkbenchContextSchema
>
export type KnowledgeWorkbenchResult = z.infer<
  typeof KnowledgeWorkbenchResultSchema
>
