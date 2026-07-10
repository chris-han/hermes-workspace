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

import { useSemantierAuthStatus } from '@/lib/semantier-auth'
import { ensureDefaultSmbOrganization } from '@/lib/organization-membership'

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
  return 'generic'
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
}: ChatEmptyStateProps) {
  const authQuery = useSemantierAuthStatus()
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
  const categories = categoriesForPromptProfile(promptProfile)
  const capabilityChips = capabilityChipsForPromptProfile(promptProfile)
  const visibleCategories =
    isShortViewport && !showAllCategories ? categories.slice(0, 2) : categories

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
      className="flex h-full flex-col items-center justify-center px-4 py-8"
    >
      <div className="flex w-full max-w-5xl flex-col items-center text-center">
        <div className="relative mb-6">
          <img
            src="/logo.svg"
            alt="semantier logo"
            className="relative size-20 rounded-xl theme-card-surface"
            style={{
              padding: '4px',
            }}
          />
        </div>

        <p
          className="brand-wordmark mb-2 text-[16px]"
          style={{ color: 'var(--theme-muted)' }}
        >
          semantier
        </p>

        <h2
          className="font-ui text-3xl font-bold tracking-tight"
          style={{ color: 'var(--theme-text)' }}
        >
          Begin a session
        </h2>
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

        <div className="mt-6 w-full max-w-4xl text-left">
          <p
            className="mb-3 px-1 text-xs"
            style={{ color: 'var(--theme-muted)' }}
          >
            {promptProfile === 'generic'
              ? 'Preset starting points'
              : 'Demo dataset prompts'}
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
