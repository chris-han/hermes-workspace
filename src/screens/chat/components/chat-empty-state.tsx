import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowUpRight01Icon,
  BrainIcon,
  CodeIcon,
  Globe02Icon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons'
import { motion } from 'motion/react'

import type { KnowledgeWorkbenchContext } from '@/contracts/knowledge-workbench'
import { useSettingsStore } from '@/hooks/use-settings'
import { useSemantierAuthStatus } from '@/lib/semantier-auth'
import { ensureDefaultSmbOrganization } from '@/lib/organization-membership'
import { useKnowledgeWorkbenchStore } from '@/stores/knowledge-workbench-store'

type Example = {
  title: string
  desc: string
  prompt?: string
  action?: 'seed_demo' | 'run_demo_insights'
}

type Category = {
  label: string
  icon: unknown
  accent: string
  examples: Array<Example>
}

type PromptProfile = 'generic' | 'smb_default' | 'apparel_trade'

function hasWorkbenchContext(context: KnowledgeWorkbenchContext): boolean {
  return Boolean(
    context.graphRef ||
      context.candidateGraphId ||
      context.acceptedReleaseId ||
      context.activeSourceIdentityRef ||
      context.selectedCandidateId ||
      context.extractionRunId ||
      context.selectedNodeIds.length > 0 ||
      context.selectedEdgeIds.length > 0 ||
      context.selectedRuleIds.length > 0 ||
      (context.selectedEvidenceRefs?.length ?? 0) > 0 ||
      context.sourceAnchors.length > 0,
  )
}

export function contextAwareCategoriesForWorkbench(
  context: KnowledgeWorkbenchContext,
  zh: boolean,
): Array<Category> | null {
  if (!hasWorkbenchContext(context)) return null

  const examples: Array<Example> = []
  const hasSelection =
    context.selectedNodeIds.length > 0 ||
    context.selectedEdgeIds.length > 0 ||
    context.selectedRuleIds.length > 0
  const hasEvidence =
    (context.selectedEvidenceRefs?.length ?? 0) > 0 || context.sourceAnchors.length > 0

  if (context.runMode === 'evaluation_baseline') {
    examples.push(
      {
        title: zh ? '解释当前评估结果' : 'Explain current evaluation',
        desc: zh
          ? '结合当前图版本、失败 gate 和证据状态，说明结果意味着什么。'
          : 'Explain what the current graph version, failed gates, and evidence state mean.',
        prompt: zh
          ? '基于当前统一 KnowledgeWorkbenchContext，解释当前评估结果、关键通过项、失败或需复核的 gate，以及下一步最值得修正的地方。'
          : 'Using the current unified KnowledgeWorkbenchContext, explain the evaluation result, important passes, failed or review-required gates, and the highest-value next correction.',
      },
      {
        title: zh ? '诊断失败 Gate' : 'Diagnose failed gates',
        desc: zh
          ? '定位失败项对应的图、证据或 grounding 问题。'
          : 'Trace failures back to graph, evidence, or grounding issues.',
        prompt: zh
          ? '检查当前评估上下文中的失败或需复核 gate，按严重度排序，并把每个问题映射到相关图断言、EvidenceRef 或 grounding 动作。'
          : 'Inspect failed or review-required gates in the current evaluation context, rank them by severity, and map each issue to the relevant graph assertion, EvidenceRef, or grounding action.',
      },
    )
  }

  if (context.selectedCandidateId) {
    examples.push({
      title: zh ? '审查当前候选' : 'Review current candidate',
      desc: zh
        ? '解释候选语义、证据充分性和是否需要 edit / reject / reground。'
        : 'Review candidate semantics, evidence sufficiency, and whether it needs edit, reject, or reground.',
      prompt: zh
        ? '审查当前统一上下文中选中的 candidate。说明它表达了什么、证据是否充分、有哪些歧义，以及建议 Accept、Edit、Reject 还是 Reground。'
        : 'Review the candidate selected in the current unified context. Explain what it means, whether the evidence is sufficient, any ambiguity, and whether you recommend Accept, Edit, Reject, or Reground.',
    })
  }

  if (hasSelection) {
    examples.push(
      {
        title: zh ? '解释当前图选择' : 'Explain graph selection',
        desc: zh
          ? '解释选中的节点、边或规则及其在 ContextGraph 中的作用。'
          : 'Explain the selected nodes, edges, or rules and their role in the ContextGraph.',
        prompt: zh
          ? '基于当前统一上下文，解释我选中的图节点、边或规则：它们分别表示什么、彼此是什么关系、为什么重要。'
          : 'Using the current unified context, explain the selected graph nodes, edges, or rules: what they mean, how they relate, and why they matter.',
      },
      {
        title: zh ? '查看相关概念与关系' : 'Show related concepts',
        desc: zh
          ? '从当前选择向外展开最相关的邻居、关系和路径。'
          : 'Expand the most relevant neighbors, relationships, and paths from the current selection.',
        prompt: zh
          ? '从当前选中的图断言出发，找出最相关的概念、关系和路径，并聚焦这些节点/边，不要脱离当前图版本。'
          : 'Starting from the currently selected graph assertions, find the most relevant concepts, relationships, and paths, and focus those nodes/edges without leaving the current graph version.',
      },
    )
  }

  if (hasEvidence) {
    examples.push({
      title: zh ? '追溯支持证据' : 'Trace supporting evidence',
      desc: zh
        ? '回到当前 EvidenceRef / source anchor，解释证据如何支持图断言。'
        : 'Trace the current EvidenceRef/source anchor and explain how it supports the graph assertion.',
      prompt: zh
        ? '追溯当前选中断言对应的 EvidenceRef 和 source anchor，说明原文证据是什么、它支持了哪一部分语义，以及是否存在证据不足或错配。'
        : 'Trace the EvidenceRef and source anchors for the current selection. Explain the original evidence, which part of the semantics it supports, and whether there is any evidence gap or mismatch.',
    })
  }

  if (context.activeSourceIdentityRef && examples.length < 4) {
    examples.push({
      title: zh ? '总结当前来源' : 'Summarize current source',
      desc: zh
        ? '只基于当前打开的来源，提炼关键概念、关系和风险点。'
        : 'Summarize key concepts, relationships, and risks from the active source only.',
      prompt: zh
        ? '只基于当前 KnowledgeWorkbenchContext 中 activeSourceIdentityRef 对应的来源，总结关键概念、关系、约束和需要人工核验的风险点。'
        : 'Using only the source identified by activeSourceIdentityRef in the current KnowledgeWorkbenchContext, summarize the key concepts, relationships, constraints, and points requiring human verification.',
    })
  }

  if (examples.length === 0) return null

  return [
    {
      label: zh ? '当前上下文' : 'Current Context',
      icon: BrainIcon,
      accent: 'var(--theme-accent)',
      examples: examples.slice(0, 5),
    },
  ]
}

const GENERIC_CATEGORIES: Array<Category> = [
  {
    label: 'Multi-Market Backtest',
    icon: CodeIcon,
    accent: 'var(--theme-accent)',
    examples: [
      {
        title: 'Cross-Market Portfolio',
        desc: 'A-shares + crypto + US equities with risk-parity optimizer',
        prompt:
          'Backtest a risk-parity portfolio of MSFT, BTC-USDT, and AAPL for full-year 2025, compare against equal-weight baseline',
      },
      {
        title: 'BTC 5-Min MACD Strategy',
        desc: 'Minute-level crypto backtest with real-time OKX data',
        prompt:
          'Backtest BTC-USDT 5-minute MACD strategy, fast=12 slow=26 signal=9, last 30 days',
      },
      {
        title: 'US Tech Max Diversification',
        desc: 'Portfolio optimizer across FAANG+ via yfinance',
        prompt:
          'Backtest AAPL, MSFT, GOOGL, AMZN, NVDA with max_diversification portfolio optimizer, full-year 2024',
      },
    ],
  },
  {
    label: 'Research & Analysis',
    icon: BrainIcon,
    accent: '#d17b0f',
    examples: [
      {
        title: 'Multi-Factor Alpha Model',
        desc: 'IC-weighted factor synthesis across 300 stocks',
        prompt:
          'Build a multi-factor alpha model using momentum, reversal, volatility, and turnover on CSI 300 constituents with IC-weighted factor synthesis, backtest 2023-2024',
      },
      {
        title: 'Options Greeks Analysis',
        desc: 'Black-Scholes pricing with Delta/Gamma/Theta/Vega',
        prompt:
          'Calculate option Greeks using Black-Scholes: spot=100, strike=105, risk-free rate=3%, vol=25%, expiry=90 days, analyze Delta/Gamma/Theta/Vega',
      },
    ],
  },
  {
    label: 'Swarm Teams',
    icon: UserGroupIcon,
    accent: '#7a5af8',
    examples: [
      {
        title: 'Investment Committee Review',
        desc: 'Multi-agent debate: long vs short, risk review, PM decision',
        prompt:
          '[Swarm Team Mode] Use the investment_committee preset to evaluate whether to go long or short on NVDA given current market conditions. Variables: target=NVDA, market=US',
      },
      {
        title: 'Quant Strategy Desk',
        desc: 'Screening -> factor research -> backtest -> risk audit pipeline',
        prompt:
          '[Swarm Team Mode] Use the quant_strategy_desk preset to find and backtest the best momentum strategy on CSI 300 constituents. Variables: market=A-shares, goal=momentum strategy on CSI 300 constituents',
      },
    ],
  },
  {
    label: 'Document & Web Research',
    icon: Globe02Icon,
    accent: '#1b6fd1',
    examples: [
      {
        title: 'Analyze an Earnings Report',
        desc: 'Upload a document and ask questions about the financials',
        prompt:
          'Summarize the key financial metrics, risks, and outlook from the uploaded earnings report',
      },
      {
        title: 'Web Research: Macro Outlook',
        desc: 'Read live web sources for macro analysis',
        prompt:
          'Read the latest Fed meeting minutes and summarize the key takeaways for equity and crypto markets',
      },
    ],
  },
]

const GENERIC_CAPABILITY_CHIPS = [
  '56 Finance Skills',
  '25 Swarm Presets',
  '19 Agent Tools',
  '3 Markets: A-Share · Crypto · HK/US',
  'Minute to Daily Timeframes',
  '4 Portfolio Optimizers',
  '15+ Risk Metrics',
  'Options & Derivatives',
  'Documents & Web Research',
  'Factor Analysis & ML',
]

const BUSINESS_DEMO_CAPABILITY_CHIPS = [
  'Bootstrap Demo Dataset',
  'Multi-Organization Context',
  'T1-T6 Knowledge Governance',
  'Business Analytics',
  'Expense & Journal Workflows',
  'Tax Report Generation',
  'Compliance Report Generation',
  'Organization-Aware Chat Prompts',
]

const SMB_DEMO_CATEGORIES: Array<Category> = [
  {
    label: 'Demo Dataset Walkthrough',
    icon: BrainIcon,
    accent: 'var(--theme-accent)',
    examples: [
      {
        title: '试用 索阳 示例公司 — 60 秒获得洞察',
        desc: '初始化索阳示例公司并进入演示工作区。',
        action: 'seed_demo',
      },
      {
        title: '营业分析',
        desc: '查看项目回款、毛利结构、现金压力和经营异常点。',
        prompt:
          '基于当前组织的 demo dataset，生成营业分析，重点说明收入结构、项目毛利、回款节奏、现金压力和需要关注的经营异常。',
      },
      {
        title: '日常入账报销',
        desc: '演示费用报销、入账建议和凭证归类。',
        prompt:
          '基于当前组织的 demo dataset，演示日常入账报销流程，给出费用分类、建议会计分录、需要补充的凭证材料和风险提示。',
      },
      {
        title: '报税报告生成',
        desc: '生成适合当前组织情境的报税准备说明。',
        prompt:
          '基于当前组织的 demo dataset，生成报税报告，汇总增值税、企业所得税相关准备事项，并说明本期重点关注项目。',
      },
      {
        title: '合规报告生成',
        desc: '输出当前组织的经营与财税合规风险摘要。',
        prompt:
          '基于当前组织的 demo dataset，生成合规报告，说明发票、合同、报销、资金流和内部控制方面的风险与建议。',
      },
    ],
  },
]

const APPAREL_TRADE_DEMO_CATEGORIES: Array<Category> = [
  {
    label: 'Trade Demo Walkthrough',
    icon: Globe02Icon,
    accent: '#b85b31',
    examples: [
      {
        title: '营业分析',
        desc: '查看平台销售、退货退款、库存周转和毛利变化。',
        prompt:
          '基于北京宝库电子商务有限公司的 demo dataset，生成营业分析，重点说明平台销售、退货退款、库存周转、平台手续费和毛利变化。',
      },
      {
        title: '日常入账报销',
        desc: '演示电商贸易企业的采购、报销和入账处理。',
        prompt:
          '基于北京宝库电子商务有限公司的 demo dataset，演示日常入账报销流程，覆盖采购入账、平台费用、员工报销和需要补充的凭证材料。',
      },
      {
        title: '报税报告生成',
        desc: '聚焦无票采购与进项抵扣风险的报税准备。',
        prompt:
          '基于北京宝库电子商务有限公司的 demo dataset，生成报税报告，重点分析无票采购、进项抵扣风险、平台结算口径和本期税务申报准备事项。',
      },
      {
        title: '合规报告生成',
        desc: '输出贸易型企业的税务与内控风险报告。',
        prompt:
          '基于北京宝库电子商务有限公司的 demo dataset，生成合规报告，重点说明无票采购、库存与销售匹配、退款处理、平台结算和税务合规风险。',
      },
    ],
  },
]

const SHORT_VIEWPORT_HEIGHT = 760

type ChatEmptyStateProps = {
  onSuggestionClick?: (prompt: string) => void
  compact?: boolean
  onStartDemoWalkthrough?: () => void
  emptyChatPrompts?: readonly string[]
}

export function resolveChatEmptyStatePromptProfile(params: {
  organizationId?: string | null
  datasetType?: string | null
  industryCode?: string | null
}): PromptProfile {
  const organizationId = params.organizationId?.trim()
  const datasetType = params.datasetType?.trim().toUpperCase()
  const industryCode = params.industryCode?.trim()
  if (
    organizationId === 'org_demo_apparel_trade_cn' ||
    industryCode === 'apparel_customization_trade'
  ) {
    return 'apparel_trade'
  }
  if (
    organizationId === 'org_construction_3_year_cn' ||
    datasetType === 'DEMO' ||
    datasetType === 'DEFAULT_REALISTIC_SAMPLE'
  ) {
    return 'smb_default'
  }
  if (!organizationId && !datasetType && !industryCode) {
    return 'smb_default'
  }
  return 'smb_default'
}

export function categoriesForPromptProfile(
  promptProfile: PromptProfile,
): Array<Category> {
  if (promptProfile === 'apparel_trade') {
    return APPAREL_TRADE_DEMO_CATEGORIES
  }
  if (promptProfile === 'smb_default') {
    return SMB_DEMO_CATEGORIES
  }
  return GENERIC_CATEGORIES
}

export function capabilityChipsForPromptProfile(
  promptProfile: PromptProfile,
): Array<string> {
  if (promptProfile === 'generic') {
    return GENERIC_CAPABILITY_CHIPS
  }
  return BUSINESS_DEMO_CAPABILITY_CHIPS
}

export function ChatEmptyState({
  onSuggestionClick,
  compact = false,
  onStartDemoWalkthrough,
  emptyChatPrompts,
}: ChatEmptyStateProps) {
  const authQuery = useSemantierAuthStatus()
  const locale = useSettingsStore((state) => state.settings.locale)
  const workbenchContext = useKnowledgeWorkbenchStore((state) => state.context)
  const zh = locale === 'zh'
  const [isShortViewport, setIsShortViewport] = useState(false)
  const [showAllCategories, setShowAllCategories] = useState(false)

  useEffect(() => {
    const syncViewportHeight = () => {
      const shortViewport = window.innerHeight < SHORT_VIEWPORT_HEIGHT
      setIsShortViewport(shortViewport)

      if (!shortViewport) {
        setShowAllCategories(false)
      }
    }

    syncViewportHeight()
    window.addEventListener('resize', syncViewportHeight, { passive: true })

    return () => window.removeEventListener('resize', syncViewportHeight)
  }, [])

  const promptProfile = resolveChatEmptyStatePromptProfile({
    organizationId: authQuery.data?.organization_id,
    datasetType: authQuery.data?.dataset_type,
    industryCode: authQuery.data?.industry_code,
  })
  const [seedingDemo, setSeedingDemo] = useState(false)
  const [seedError, setSeedError] = useState('')
  const contextualCategories = compact
    ? contextAwareCategoriesForWorkbench(workbenchContext, zh)
    : null
  const studioPromptCategories = emptyChatPrompts?.length
    ? [{
        label: zh ? '工作台建议' : 'Workbench suggestions',
        icon: BrainIcon,
        accent: 'var(--theme-accent)',
        examples: emptyChatPrompts.map((prompt) => ({
          title: prompt,
          desc: zh ? '点击以填入对话框' : 'Click to add this prompt to chat',
          prompt,
        })) as Array<Example>,
      }]
    : null
  const categories = studioPromptCategories ?? contextualCategories ?? categoriesForPromptProfile(promptProfile)
  const hasStudioContext = Boolean(studioPromptCategories || contextualCategories)
  const capabilityChips = hasStudioContext
    ? []
    : capabilityChipsForPromptProfile(promptProfile)
  const visibleCategories =
    isShortViewport && !showAllCategories ? categories.slice(0, 2) : categories
  const contextSummary = hasStudioContext && contextualCategories
    ? [
        workbenchContext.activeSourceIdentityRef ? (zh ? '来源' : 'source') : null,
        workbenchContext.selectedCandidateId ? (zh ? '候选' : 'candidate') : null,
        workbenchContext.selectedNodeIds.length > 0
          ? `${workbenchContext.selectedNodeIds.length} ${zh ? '节点' : 'node'}`
          : null,
        workbenchContext.selectedEdgeIds.length > 0
          ? `${workbenchContext.selectedEdgeIds.length} ${zh ? '边' : 'edge'}`
          : null,
        (workbenchContext.selectedEvidenceRefs?.length ?? 0) > 0
          ? `${workbenchContext.selectedEvidenceRefs?.length ?? 0} EvidenceRef`
          : null,
        workbenchContext.runMode === 'evaluation_baseline'
          ? zh
            ? '评估'
            : 'evaluation'
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  async function handleTrySuoYang() {
    setSeedingDemo(true)
    setSeedError('')
    try {
      await ensureDefaultSmbOrganization()
      window.location.href = '/chat/new?demo_walkthrough=1'
    } catch (err) {
      setSeedError(err instanceof Error ? err.message : '演示数据准备失败')
    } finally {
      setSeedingDemo(false)
    }
  }

  function handleExampleSelect(example: Example) {
    if (example.action === 'seed_demo') {
      void handleTrySuoYang()
      return
    }
    if (example.action === 'run_demo_insights') {
      onStartDemoWalkthrough?.()
      return
    }
    if (example.prompt) {
      onSuggestionClick?.(example.prompt)
    }
  }

  function resolveExampleTitle(example: Example) {
    if (example.action === 'seed_demo' && seedingDemo) {
      return '正在准备演示...'
    }
    return example.title
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`flex h-full flex-col items-center px-4 ${hasStudioContext ? 'justify-start py-4' : 'justify-center py-8'}`}
    >
      <div className={`flex w-full max-w-5xl flex-col ${hasStudioContext ? 'items-stretch text-left' : 'items-center text-center'}`}>
        {hasStudioContext ? (
          <div className="w-full">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: 'var(--theme-muted)' }}>
              {zh ? '当前上下文' : 'Current context'}
            </p>
            <h2 className="font-ui mt-1 text-lg font-semibold tracking-tight" style={{ color: 'var(--theme-text)' }}>
              {zh ? '基于正在查看的内容提问' : 'Ask about what you are viewing'}
            </h2>
            {contextSummary ? (
              <p className="mt-1 text-[11px]" style={{ color: 'var(--theme-muted)' }}>
                {contextSummary}
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="relative mb-6">
              <img
                src="/logo.svg"
                alt="semantier logo"
                className="relative size-20 rounded-xl theme-card-surface"
                style={{ padding: '4px' }}
              />
            </div>
            <p className="brand-wordmark mb-2 text-[16px]" style={{ color: 'var(--theme-muted)' }}>
              semantier
            </p>
            <h2 className="font-ui text-3xl font-bold tracking-tight" style={{ color: 'var(--theme-text)' }}>
              Begin a session
            </h2>
          </>
        )}
        {seedError ? (
          <p className="mt-4 text-xs text-red-400">{seedError}</p>
        ) : null}

        {!compact && (
          <>
            <p
              className="font-ui mt-3 text-sm font-medium"
              style={{ color: 'var(--theme-muted)' }}
            >
              {promptProfile === 'generic'
                ? 'Agent chat · live tools · memory · full observability'
                : 'Choose a demo workflow and inspect the active organization context'}
            </p>

            <div className="mt-4 flex max-w-4xl flex-wrap justify-center gap-1.5">
              {capabilityChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full px-2.5 py-0.5 text-[11px] theme-border-1"
                  style={{
                    background:
                      'color-mix(in srgb, var(--theme-card2) 72%, transparent)',
                    color: 'var(--theme-muted)',
                  }}
                >
                  {chip}
                </span>
              ))}
            </div>
          </>
        )}

        <div className={`${hasStudioContext ? 'mt-4' : 'mt-6'} w-full max-w-4xl text-left`}>
          <p
            className="mb-3 px-1 text-xs"
            style={{ color: 'var(--theme-muted)' }}
          >
            {hasStudioContext
              ? zh
                ? '基于统一上下文的建议'
                : 'Suggestions from unified context'
              : 'Demo dataset prompts'}
          </p>

          <div className={`grid grid-cols-1 gap-3 ${hasStudioContext || categories.length === 1 ? '' : 'sm:grid-cols-2'}`}>
            {visibleCategories.map((category) => (
              <div key={category.label} className="space-y-2">
                <div
                  className="flex items-center gap-2 px-1 text-[11px] font-medium"
                  style={{ color: category.accent }}
                >
                  <HugeiconsIcon
                    icon={category.icon as any}
                    size={14}
                    strokeWidth={1.5}
                  />
                  <span>{category.label}</span>
                </div>

                <div className="space-y-2">
                  {category.examples.map((example) => (
                    <button
                      key={example.title}
                      type="button"
                      onClick={() => handleExampleSelect(example)}
                      disabled={example.action === 'seed_demo' && seedingDemo}
                      className="block w-full cursor-pointer rounded-lg px-3 py-2.5 text-left transition-all theme-border-1"
                      style={{
                        background: 'var(--theme-card)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--theme-card2)'
                        e.currentTarget.style.borderColor = category.accent
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--theme-card)'
                        e.currentTarget.style.borderColor =
                          'var(--theme-border)'
                      }}
                    >
                      <span
                        className="flex items-center gap-2 text-[13px] font-medium leading-snug sm:text-sm"
                        style={{ color: 'var(--theme-text)' }}
                      >
                        {resolveExampleTitle(example)}
                        <HugeiconsIcon
                          icon={ArrowUpRight01Icon as any}
                          size={12}
                          strokeWidth={1.5}
                          style={{ color: category.accent }}
                        />
                      </span>
                      <span
                        className="mt-1 block text-[11px] leading-snug sm:text-xs"
                        style={{ color: 'var(--theme-muted)' }}
                      >
                        {example.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {!compact && isShortViewport && !showAllCategories && (
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={() => setShowAllCategories(true)}
                className="rounded-full px-3 py-1 text-xs transition-colors theme-border-1"
                style={{
                  background: 'var(--theme-card)',
                  color: 'var(--theme-muted)',
                }}
              >
                Show more presets
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
