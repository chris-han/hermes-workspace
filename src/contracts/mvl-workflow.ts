import { z } from 'zod'

export const MvlStageSchema = z.enum([
  'BUILD',
  'GROUNDING_FROZEN',
  'HELDOUT_FROZEN',
  'V0_V1_COMPARISON_COMPLETE',
  'PHASE1_001_GO',
])

export const MvlWorkflowContextSchema = z.object({
  workflowId: z.string(),
  phasePlanId: z.literal('phase1-001'),
  stage: MvlStageSchema,
  stageState: z.string(),
  activeProfileId: z.literal('tender-runtime-expert'),
  graphRef: z.string().nullable(),
  graphVersion: z.string().nullable(),
  graphHash: z.string().nullable(),
  authorityState: z.enum(['candidate', 'authoritative']),
  runMode: z.enum(['evaluation_baseline', 'authoritative']),
  groundingManifestRef: z.string().nullable(),
  heldoutManifestRef: z.string().nullable(),
  v0RunRef: z.string().nullable(),
  v1RunRef: z.string().nullable(),
  learningDecision: z.enum(['GO', 'STOP_REVISE', 'SPLIT_FIX']).nullable(),
  graphConstructionCertification: z.literal('not_certified'),
  reasoningCertification: z.literal('not_certified'),
  governanceStatus: z.enum(['not_applicable', 'not_admitted']),
})

export type MvlStage = z.infer<typeof MvlStageSchema>
export type MvlWorkflowContext = z.infer<typeof MvlWorkflowContextSchema>

export const UnifiedWorkbenchContextSchema = z.object({
  knowledge: z.record(z.unknown()),
  workflow: MvlWorkflowContextSchema,
})

export type UnifiedWorkbenchContext = z.infer<
  typeof UnifiedWorkbenchContextSchema
>

export type GuidanceItem = {
  code: MvlStage
  title: string
  body: string
  tone: 'info' | 'attention'
}

export function guidanceForWorkflow(
  workflow: MvlWorkflowContext,
  locale: 'en' | 'zh' = 'en',
): GuidanceItem {
  const zh = locale === 'zh'
  const copy: Record<MvlStage, GuidanceItem> = {
    BUILD: {
      code: 'BUILD',
      title: zh ? '构建' : 'Build',
      body: zh
        ? '正在从固定 DOCX 构建 V0 候选图。'
        : 'Build V0 from the fixed DOCX fixture.',
      tone: 'info',
    },
    GROUNDING_FROZEN: {
      code: 'GROUNDING_FROZEN',
      title: zh ? 'Grounding 已冻结' : 'Grounding frozen',
      body: zh
        ? '现在只能依据 grounding 证据进行一次修正；held-out 集合必须保持 blind。'
        : 'One correction may now use grounding evidence only; the held-out set must remain blind.',
      tone: 'attention',
    },
    HELDOUT_FROZEN: {
      code: 'HELDOUT_FROZEN',
      title: zh ? 'Held-out 已冻结' : 'Held-out frozen',
      body: zh
        ? '本 MVL 评估 finding、证据锚点与图关联交互；可解析的 graph link 不等于图构建认证，路径连续性不等于确定性推理认证。'
        : 'This MVL evaluates findings, evidence anchors, and graph-linked interaction. Link resolvability is not graph-construction certification, and path continuity is not deterministic reasoning certification.',
      tone: 'info',
    },
    V0_V1_COMPARISON_COMPLETE: {
      code: 'V0_V1_COMPARISON_COMPLETE',
      title: zh ? 'V0/V1 对比完成' : 'V0/V1 comparison complete',
      body: zh
        ? '请审阅技术差异、UX 差异并记录 GO、STOP/REVISE 或 SPLIT/FIX。'
        : 'Review the technical and UX deltas, then record GO, STOP/REVISE, or SPLIT/FIX.',
      tone: 'attention',
    },
    PHASE1_001_GO: {
      code: 'PHASE1_001_GO',
      title: zh ? 'Phase1-001：GO' : 'Phase1-001: GO',
      body: zh
        ? 'GO 只是继续产品投资的信号，不是图构建、推理或治理认证。Phase1-004 仍只是 governed draft，002/003/004 都需单独批准和实施。'
        : 'GO is only a product-investment signal, not graph, reasoning, or governance certification. Phase1-004 is still only a governed draft; 002/003/004 require separate approval and implementation.',
      tone: 'info',
    },
  }
  return copy[workflow.stage]
}
