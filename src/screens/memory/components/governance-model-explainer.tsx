import { useEffect, useState } from 'react'
import { BookOpen01Icon, ShieldKeyIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useSettingsStore } from '@/hooks/use-settings'

export const GOVERNANCE_EXPLAINER_TITLE = 'Governance Model'
export const GOVERNANCE_EXPLAINER_POINTS = [
  'T6 suggestions are conversational and non-authoritative until they are materialized into governed artifacts.',
  'T5 scoped preferences may optimize local behavior but cannot weaken T4, T3, or T2 obligations.',
  'T4, T3, T2, and T1 require governed approval and activation in Semantier core.',
  'Knowledge-source connections and retrieval hints do not, by themselves, create semantic authority.',
]
export const AUTHORITY_LEVELS = [
  {
    label: 'curation_only',
    description:
      'Research or imported wiki material. It can support review, but it cannot be cited as law, policy, doctrine, or runtime authority.',
  },
  {
    label: 'T6 Suggestion',
    description:
      'Agent or conversational output. It becomes durable only after a governed artifact is created from it.',
  },
  {
    label: 'T5 Scoped Preference',
    description:
      'User or workspace preference that may shape local behavior without overriding organization policy or external obligations.',
  },
  {
    label: 'T4 Org Policy',
    description:
      'Organization-approved operating policy, control, procedure, or local interpretation.',
  },
  {
    label: 'T3 Doctrine',
    description:
      'Repo-owned Semantier doctrine or canonical implementation contract promoted through governed source registration.',
  },
  {
    label: 'T2 Regulation',
    description:
      'Official legal, regulatory, or accounting source text with verified source registration and precedence review.',
  },
  {
    label: 'T1 Ontology',
    description:
      'Core semantic vocabulary and schema authority used by Semantier runtime contracts.',
  },
]
export const GOVERNED_PROMOTION_STEPS = [
  'Register the source with URI, jurisdiction, effective dates, source version, anchors, extraction method, curator, and known ambiguities.',
  'Create a normalized artifact with extracted claims, constraints, or projection rules, and keep the source hash pinned.',
  'Run schema validation, authority-origin compatibility checks, and precedence review against higher-tier sources.',
  'Approve and activate the artifact in Semantier core so future answers can cite the active knowledge version.',
]

const GOVERNANCE_COPY = {
  en: {
    title: GOVERNANCE_EXPLAINER_TITLE,
    intro:
      'Governance activation lives in Semantier core. This workspace surface explains the model and can show demo approval evidence chains without enforcing production role gates.',
    authorityLevels: 'Authority Levels',
    authorityBoundaries: 'Authority Boundaries',
    promotionPath: 'Governed Promotion Path',
    latestEvidence: 'Latest Demo Promotion Evidence Chain',
    noDemoEvidence:
      'No demo approval evidence has been recorded in this browser yet.',
    page: 'Page',
    artifact: 'Artifact',
    authorityTier: 'Authority tier',
    status: 'Status',
    refNotRecorded: 'ref not recorded',
    hashNotRecorded: 'hash not recorded',
    notRecorded: 'not recorded',
    points: GOVERNANCE_EXPLAINER_POINTS,
    levels: AUTHORITY_LEVELS,
    steps: GOVERNED_PROMOTION_STEPS,
  },
  zh: {
    title: '治理模型',
    intro:
      '治理激活由 Semantier core 负责。当前工作区页面用于解释模型，也可以展示 demo approval evidence chain，但不会执行生产角色门禁。',
    authorityLevels: '权威等级',
    authorityBoundaries: '权威边界',
    promotionPath: '治理提升路径',
    latestEvidence: '最新 Demo Promotion Evidence Chain',
    noDemoEvidence: '此浏览器中还没有记录 demo approval evidence。',
    page: '页面',
    artifact: 'Artifact',
    authorityTier: 'Authority tier',
    status: '状态',
    refNotRecorded: 'ref 未记录',
    hashNotRecorded: 'hash 未记录',
    notRecorded: '未记录',
    points: [
      'T6 suggestions 属于对话建议，在被物化为 governed artifacts 之前不具备权威性。',
      'T5 scoped preferences 可以优化本地行为，但不能削弱 T4、T3 或 T2 义务。',
      'T4、T3、T2 和 T1 需要在 Semantier core 中完成治理审批和激活。',
      'Knowledge-source 连接和 retrieval hints 本身不会生成语义权威。',
    ],
    levels: [
      {
        label: 'curation_only',
        description:
          '研究或导入的 wiki 材料。它可以支持审核，但不能作为法律、政策、doctrine 或 runtime authority 引用。',
      },
      {
        label: 'T6 Suggestion',
        description:
          'Agent 或对话输出。只有创建为 governed artifact 后才会成为持久材料。',
      },
      {
        label: 'T5 Scoped Preference',
        description:
          '用户或工作区偏好，可影响本地行为，但不能覆盖组织政策或外部义务。',
      },
      {
        label: 'T4 Org Policy',
        description: '组织批准的运营政策、控制、流程或本地解释。',
      },
      {
        label: 'T3 Doctrine',
        description:
          'repo-owned Semantier doctrine 或 canonical implementation contract，经治理源注册后提升。',
      },
      {
        label: 'T2 Regulation',
        description:
          '官方法律、监管或会计来源文本，带有已验证的 source registration 和 precedence review。',
      },
      {
        label: 'T1 Ontology',
        description:
          'Semantier runtime contracts 使用的核心语义词汇和 schema authority。',
      },
    ],
    steps: [
      '注册 source URI、jurisdiction、effective dates、source version、anchors、extraction method、curator 和已知 ambiguities。',
      '创建 normalized artifact，抽取 claims、constraints 或 projection rules，并固定 source hash。',
      '运行 schema validation、authority-origin compatibility checks，并对照更高层来源完成 precedence review。',
      '在 Semantier core 中审批并激活 artifact，使后续回答可引用 active knowledge version。',
    ],
  },
} as const

type DemoPromotionEvidence = {
  pagePath?: string
  recordedAt?: string
  artifact?: {
    artifact_id?: string
    source_ref?: string
    semantic_tier?: string
    authority_domain?: string
    ingestion_status?: string
    evidence_chain?: Array<{
      stage?: string
      ref?: string | null
      hash?: string | null
    }>
  }
}

export function GovernanceModelExplainer() {
  const locale = useSettingsStore((state) => state.settings.locale)
  const copy = locale === 'zh' ? GOVERNANCE_COPY.zh : GOVERNANCE_COPY.en
  const [demoEvidence, setDemoEvidence] =
    useState<DemoPromotionEvidence | null>(null)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(
        'knowledge-latest-demo-approved-artifact',
      )
      const parsed = raw ? (JSON.parse(raw) as DemoPromotionEvidence) : null
      setDemoEvidence(parsed?.artifact ? parsed : null)
    } catch {
      setDemoEvidence(null)
    }
  }, [])

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '')
    if (!hash) return
    window.requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ block: 'start' })
    })
  }, [demoEvidence])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-primary-200 bg-primary-50/80 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-2xl border border-primary-200 bg-primary-100/70 dark:border-neutral-800 dark:bg-neutral-900">
            <HugeiconsIcon icon={ShieldKeyIcon} size={20} strokeWidth={1.5} />
          </span>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-primary-900 dark:text-neutral-100">
              {copy.title}
            </h2>
            <p className="text-sm text-primary-600 dark:text-neutral-400">
              {copy.intro}
            </p>
          </div>
        </div>
      </section>

      <section id="authority-levels" className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-primary-200 bg-primary-50/80 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
          <div className="mb-3 flex items-center gap-2 text-primary-900 dark:text-neutral-100">
            <HugeiconsIcon icon={BookOpen01Icon} size={18} strokeWidth={1.5} />
            <h3 className="text-sm font-semibold">{copy.authorityLevels}</h3>
          </div>
          <div className="space-y-2">
            {copy.levels.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-primary-200 bg-white/80 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900/70"
              >
                <div className="text-xs font-semibold text-primary-900 dark:text-neutral-100">
                  {item.label}
                </div>
                <div className="mt-1 text-xs text-primary-600 dark:text-neutral-300">
                  {item.description}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-primary-200 bg-primary-50/80 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
          <div className="mb-3 text-sm font-semibold text-primary-900 dark:text-neutral-100">
            {copy.authorityBoundaries}
          </div>
          <ul className="space-y-2 text-sm text-primary-700 dark:text-neutral-300">
            {copy.points.map((point) => (
              <li
                key={point}
                className="rounded-2xl border border-primary-200 bg-white/80 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900/70"
              >
                {point}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section
        id="promotion-path"
        className="rounded-3xl border border-primary-200 bg-primary-50/80 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60"
      >
        <div className="mb-3 text-sm font-semibold text-primary-900 dark:text-neutral-100">
          {copy.promotionPath}
        </div>
        <ol className="space-y-2 text-sm text-primary-700 dark:text-neutral-300">
          {copy.steps.map((step, index) => (
            <li
              key={step}
              className="flex gap-3 rounded-2xl border border-primary-200 bg-white/80 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900/70"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700 dark:bg-neutral-800 dark:text-neutral-200">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section
        id="promotion-evidence-chain"
        className="rounded-3xl border border-primary-200 bg-primary-50/80 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60"
      >
        <div className="mb-3 text-sm font-semibold text-primary-900 dark:text-neutral-100">
          {copy.latestEvidence}
        </div>
        {demoEvidence?.artifact ? (
          <div className="space-y-3">
            <div className="grid gap-2 text-xs text-primary-700 dark:text-neutral-300 sm:grid-cols-2">
              <EvidenceSummary
                label={copy.page}
                value={demoEvidence.pagePath}
              />
              <EvidenceSummary
                label={copy.artifact}
                value={demoEvidence.artifact.artifact_id}
              />
              <EvidenceSummary
                label={copy.authorityTier}
                value={demoEvidence.artifact.semantic_tier}
              />
              <EvidenceSummary
                label={copy.status}
                value={demoEvidence.artifact.ingestion_status}
              />
            </div>
            <ol className="space-y-2">
              {(demoEvidence.artifact.evidence_chain || []).map(
                (step, index) => (
                  <li
                    key={`${step.stage || 'evidence'}:${index}`}
                    className="rounded-2xl border border-primary-200 bg-white/80 px-3 py-2 text-xs dark:border-neutral-800 dark:bg-neutral-900/70"
                  >
                    <div className="font-semibold text-primary-900 dark:text-neutral-100">
                      {index + 1}. {step.stage || 'evidence'}
                    </div>
                    <div className="mt-1 break-all text-primary-600 dark:text-neutral-300">
                      {step.ref || copy.refNotRecorded}
                    </div>
                    <div className="mt-1 break-all font-mono text-[10px] text-primary-500 dark:text-neutral-400">
                      {step.hash || copy.hashNotRecorded}
                    </div>
                  </li>
                ),
              )}
            </ol>
          </div>
        ) : (
          <div className="rounded-2xl border border-primary-200 bg-white/80 px-3 py-2 text-sm text-primary-600 dark:border-neutral-800 dark:bg-neutral-900/70 dark:text-neutral-300">
            {copy.noDemoEvidence}
          </div>
        )}
      </section>
    </div>
  )
}

function EvidenceSummary({
  label,
  value,
}: {
  label: string
  value?: string | null
}) {
  const locale = useSettingsStore((state) => state.settings.locale)
  return (
    <div className="rounded-2xl border border-primary-200 bg-white/80 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900/70">
      <div className="font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400">
        {label}
      </div>
      <div className="mt-1 break-all text-primary-900 dark:text-neutral-100">
        {value || (locale === 'zh' ? '未记录' : 'not recorded')}
      </div>
    </div>
  )
}
