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

type Example = {
  title: string
  desc: string
  prompt: string
}

type Category = {
  label: string
  icon: unknown
  accent: string
  examples: Array<Example>
}

const CATEGORIES: Array<Category> = [
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

const CAPABILITY_CHIPS = [
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

const SHORT_VIEWPORT_HEIGHT = 760

type ChatEmptyStateProps = {
  onSuggestionClick?: (prompt: string) => void
  compact?: boolean
}

export function ChatEmptyState({
  onSuggestionClick,
  compact = false,
}: ChatEmptyStateProps) {
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

  const visibleCategories =
    isShortViewport && !showAllCategories ? CATEGORIES.slice(0, 2) : CATEGORIES

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

        {!compact && (
          <>
            <p
              className="font-ui mt-3 text-sm font-medium"
              style={{ color: 'var(--theme-muted)' }}
            >
              Agent chat · live tools · memory · full observability
            </p>

            <div className="mt-4 flex max-w-4xl flex-wrap justify-center gap-1.5">
              {CAPABILITY_CHIPS.map((chip) => (
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
            Preset starting points
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
                      onClick={() => onSuggestionClick?.(example.prompt)}
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
                        {example.title}
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
