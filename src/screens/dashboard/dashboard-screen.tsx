import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Moon02Icon,
  Sun02Icon,
  Chat01Icon,
  BinaryCodeIcon,
  AccountSetting01Icon,
  Book01Icon,
  Mail01Icon,
  Briefcase01Icon,
  FlashIcon,
} from '@hugeicons/core-free-icons'
import type { ReactNode } from 'react'
import type { HermesSession } from '@/server/hermes-api'
import { getUnavailableReason } from '@/lib/feature-gates'
import { useFeatureAvailable } from '@/hooks/use-feature-available'
import { cn } from '@/lib/utils'
import { openHamburgerMenu } from '@/components/mobile-hamburger-menu'
import { applyTheme, useSettingsStore } from '@/hooks/use-settings'

// ── Helpers ──────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() / 1000 - ts
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

// ── Dashboard Card ───────────────────────────────────────────────────

function DashboardCard({
  title,
  titleRight,
  noPadding,
  className,
  children,
}: {
  title?: string
  titleRight?: ReactNode
  noPadding?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden rounded-card border border-border bg-card transition-colors',
        className,
      )}
    >
      {title && (
        <div className="flex items-center justify-between px-5 pt-4 pb-0">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {title}
          </h3>
          {titleRight}
        </div>
      )}
      <div className={cn('flex-1', noPadding ? '' : 'px-5 pb-4 pt-3')}>
        {children}
      </div>
    </div>
  )
}

function EnhancedBadge({ label = 'Enhanced API' }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
      {label}
    </span>
  )
}

function UnavailableWidget({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <DashboardCard title={title} titleRight={<EnhancedBadge />} className="h-full">
      <div className="flex h-full min-h-[180px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/50 px-4 text-center">
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </DashboardCard>
  )
}

// ── System Glance (status bar) ───────────────────

function SystemGlance({
  sessions,
  connected,
  model,
  provider,
  tokens,
  cost,
}: {
  sessions: number
  connected: boolean
  model: string
  provider: string
  tokens: string
  cost: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-card px-5 py-2.5 backdrop-blur-sm">
      <span
        className={cn(
          'size-2 shrink-0 rounded-full',
          connected ? 'bg-success animate-pulse' : 'bg-danger',
        )}
      />
      <div className="flex flex-1 items-center gap-x-4 overflow-x-auto">
        <span className="text-xs font-medium text-foreground">{model}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">{provider}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">{sessions} sessions</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-xs font-bold tabular-nums text-foreground">
          {tokens} tokens
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">{cost}</span>
      </div>
    </div>
  )
}

// ── Metric Tile ──────────────────────────────────────────────────

function MetricTile({
  label,
  value,
  sub,
  icon,
  iconClass,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  iconClass: string
}) {
  return (
    <DashboardCard>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {label}
          </div>
          <div className="text-2xl font-bold tabular-nums text-foreground">
            {value}
          </div>
          {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
        </div>
        <div
          className={cn(
            'flex size-8 items-center justify-center rounded-lg text-base',
            iconClass,
          )}
        >
          <HugeiconsIcon icon={icon} size={16} />
        </div>
      </div>
    </DashboardCard>
  )
}

// ── Activity Chart ───────────────────────────────────────────────

function ActivityChart({ sessions }: { sessions: Array<HermesSession> }) {
  const chartData = useMemo(() => {
    const dayMap = new Map<string, { sessions: number; messages: number }>()
    const now = Date.now() / 1000
    for (let i = 13; i >= 0; i--) {
      const d = new Date((now - i * 86400) * 1000)
      const key = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
      dayMap.set(key, { sessions: 0, messages: 0 })
    }
    for (const s of sessions) {
      if (!s.started_at) continue
      const d = new Date(s.started_at * 1000)
      const key = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
      const entry = dayMap.get(key)
      if (entry) {
        entry.sessions += 1
        entry.messages += s.message_count ?? 0
      }
    }
    const all = Array.from(dayMap.entries()).map(([date, data]) => ({
      date,
      ...data,
    }))
    let firstActive = all.findIndex((d) => d.sessions > 0 || d.messages > 0)
    if (firstActive > 0) firstActive = Math.max(0, firstActive - 1)
    return firstActive > 0 ? all.slice(firstActive) : all
  }, [sessions])

  return (
    <DashboardCard
      title="Activity"
      titleRight={<span className="text-[10px] text-muted-foreground">14 days</span>}
      className="h-full"
    >
      <div className="h-[200px] w-full -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 32, left: -16, bottom: 0 }}
          >
            <defs>
              <linearGradient id="g-sessions" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity={0.3}
                />
                <stop
                  offset="100%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity={0}
                />
              </linearGradient>
              <linearGradient id="g-messages" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="hsl(var(--success))"
                  stopOpacity={0.2}
                />
                <stop
                  offset="100%"
                  stopColor="hsl(var(--success))"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.45}
            />
            <XAxis
              dataKey="date"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: 'hsl(var(--success))', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={28}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: 'hsl(var(--primary))', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={28}
            />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: `1px solid hsl(var(--border))`,
                borderRadius: '12px',
                fontSize: '11px',
              }}
              labelStyle={{
                color: 'hsl(var(--muted-foreground))',
                fontSize: '10px',
              }}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="messages"
              stroke="hsl(var(--success))"
              fill="url(#g-messages)"
              strokeWidth={1.5}
              dot={false}
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="sessions"
              stroke="hsl(var(--primary))"
              fill="url(#g-sessions)"
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center gap-5 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" />
          Sessions
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-success" />
          Messages
        </span>
      </div>
    </DashboardCard>
  )
}

// ── Model Card ───────────────────────────────────────────────────

function ModelCard() {
  const sessionsAvailable = useFeatureAvailable('sessions')
  const configAvailable = useFeatureAvailable('config')
  const configQuery = useQuery({
    queryKey: ['hermes-config'],
    queryFn: async () => {
      const res = await fetch('/api/hermes-config')
      if (!res.ok) return null
      return res.json() as Promise<Record<string, unknown>>
    },
    staleTime: 30_000,
    enabled: configAvailable,
  })
  const config = configQuery.data as Record<string, unknown> | undefined
  const modelName = (config?.activeModel ?? '—') as string
  const provider = (config?.activeProvider ?? '—') as string
  const configBlock = config?.config as Record<string, unknown> | undefined
  const modelBlock = configBlock?.model as Record<string, unknown> | undefined
  const baseUrl = (modelBlock?.base_url ??
    configBlock?.base_url ??
    '') as string
  const connected = sessionsAvailable
  const fallbackBlock = config?.fallback_model as
    | Record<string, unknown>
    | undefined
  const fallbackModel = fallbackBlock?.model as string | undefined

  if (!configAvailable) {
    return (
      <UnavailableWidget
        title="Model"
        description={getUnavailableReason('config')}
      />
    )
  }

  return (
    <DashboardCard
      title="Model"
      titleRight={
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full',
            connected ? 'text-success bg-success/10' : 'text-danger bg-danger/10',
          )}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              connected ? 'bg-success' : 'bg-danger',
            )}
          />
          {connected ? 'Online' : 'Offline'}
        </span>
      }
      className="h-full"
    >
      <div className="space-y-2">
        <div className="flex items-center gap-3 rounded-lg p-2.5 bg-muted/50 border border-border">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary text-sm">
            🤖
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[13px] font-bold text-foreground truncate">
              {typeof modelName === 'string' ? modelName : '—'}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono truncate">
              {provider}
              {baseUrl ? ` · ${baseUrl}` : ''}
            </div>
          </div>
        </div>
        {fallbackModel && (
          <div className="flex items-center gap-3 rounded-lg p-2.5 bg-muted/50 border border-border">
            <div className="flex size-7 items-center justify-center rounded-md bg-warning/10 text-sm">
              🔄
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[13px] text-foreground truncate">
                {fallbackModel}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono truncate">
                {(fallbackBlock?.provider as string) ?? ''}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardCard>
  )
}

// ── Skills Widget ────────────────────────────────────────────────

function SkillsWidget() {
  const skillsAvailable = useFeatureAvailable('skills')
  const skillsQuery = useQuery({
    queryKey: ['hermes-skills'],
    queryFn: async () => {
      const res = await fetch(
        '/api/skills?tab=installed&limit=8&summary=search',
      )
      if (!res.ok) return []
      const data = await res.json()
      return (data?.skills ?? []) as Array<Record<string, unknown>>
    },
    staleTime: 30_000,
    enabled: skillsAvailable,
  })

  const skills = skillsQuery.data ?? []

  if (!skillsAvailable) {
    return (
      <UnavailableWidget
        title="Skills"
        description={getUnavailableReason('skills')}
      />
    )
  }

  return (
    <DashboardCard
      title="Skills"
      titleRight={
        <span className="text-[10px] text-muted-foreground">
          {skills.length} installed
        </span>
      }
    >
      {skills.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">
          No skills installed
        </div>
      ) : (
        <div className="space-y-1.5">
          {skills.slice(0, 6).map((skill, i) => (
            <div
              key={String(skill.name ?? i)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-muted/50 transition-colors"
            >
              <HugeiconsIcon icon={Book01Icon} size={14} className="text-muted-foreground" />
              <span className="text-xs font-medium text-foreground truncate flex-1">
                {String(skill.name ?? 'Unnamed')}
              </span>
              {skill.enabled !== false && (
                <span className="size-1.5 rounded-full bg-success/60" />
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  )
}

// ── Quick Action ─────────────────────────────────────────────────

function QuickAction({
  label,
  icon,
  iconClass,
  onClick,
  disabled,
  badge,
}: {
  label: string
  icon: React.ElementType
  iconClass: string
  onClick: () => void
  disabled?: boolean
  badge?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative overflow-hidden flex min-h-12 w-full items-center gap-3 rounded-button border px-4 py-3 text-sm font-medium transition-all',
        'border-border bg-card text-left',
        disabled
          ? 'cursor-not-allowed opacity-60'
          : 'hover:border-primary/20 hover:bg-muted hover:scale-[1.02] active:scale-[0.98]',
      )}
    >
      <div
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-md text-sm',
          iconClass,
        )}
      >
        <HugeiconsIcon icon={icon} size={16} />
      </div>
      <span className="min-w-0 flex-1 text-xs font-semibold text-foreground">
        {label}
      </span>
      {badge ? (
        <span className="ml-auto shrink-0 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-primary">
          {badge}
        </span>
      ) : null}
    </button>
  )
}

// ── Session Row (minimal) ────────────────────────────────────────

function SessionRow({
  session,
  maxTokens,
  onClick,
}: {
  session: HermesSession
  maxTokens: number
  onClick: () => void
}) {
  const tokens = (session.input_tokens ?? 0) + (session.output_tokens ?? 0)
  const msgs = session.message_count ?? 0
  const tools = session.tool_call_count ?? 0
  const barWidth = maxTokens > 0 ? Math.max(1, (tokens / maxTokens) * 100) : 0

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-muted transition-colors group"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[13px] font-medium text-foreground truncate flex-1 group-hover:text-primary">
          {session.title || session.id}
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
          {session.started_at ? timeAgo(session.started_at) : ''}
        </span>
      </div>
      <div className="mb-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
        {session.model && (
          <span className="rounded-md px-1.5 py-0.5 font-mono text-[9px] font-medium bg-primary/10 text-primary">
            {session.model}
          </span>
        )}
        <span>{msgs} msgs</span>
        {tools > 0 && <span>{tools} tools</span>}
        {tokens > 0 && <span>{formatNumber(tokens)} tok</span>}
      </div>
      <div className="h-[3px] rounded-full w-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-primary to-primary/50"
          style={{
            width: `${barWidth}%`,
          }}
        />
      </div>
    </button>
  )
}

// ── Main Dashboard ───────────────────────────────────────────────

export function DashboardScreen() {
  const navigate = useNavigate()
  const sessionsAvailable = useFeatureAvailable('sessions')
  const skillsAvailable = useFeatureAvailable('skills')
  const sessionsQuery = useQuery({
    // Use a dedicated query key — NOT chatQueryKeys.sessions — to avoid
    // cache collisions with the chat sidebar which fetches fewer sessions
    // and overwrites the dashboard's larger dataset.
    // Also use the workspace proxy (/api/sessions) rather than the server-side
    // listSessions() — the latter calls the gateway via HERMES_API which is
    // only available server-side and returns nothing when called from the client.
    queryKey: ['dashboard', 'sessions'],
    queryFn: async () => {
      const res = await fetch('/api/sessions?limit=200&offset=0')
      if (!res.ok) return []
      const data = (await res.json()) as {
        sessions?: Array<Record<string, unknown>>
      }
      return (data.sessions ?? []).map((s) => ({
        id: (s.key ?? s.id) as string,
        started_at: s.startedAt ? (s.startedAt as number) / 1000 : undefined,
        message_count: (s.message_count as number | undefined) ?? 0,
        tool_call_count: (s.tool_call_count as number | undefined) ?? 0,
        input_tokens: (s.tokenCount as number | undefined) ?? 0,
        output_tokens: 0,
      })) as Array<HermesSession>
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
    enabled: sessionsAvailable,
  })

  const sessions = sessionsQuery.data ?? []

  const stats = useMemo(() => {
    let totalMessages = 0,
      totalToolCalls = 0,
      totalTokens = 0
    for (const s of sessions) {
      totalMessages += s.message_count ?? 0
      totalToolCalls += s.tool_call_count ?? 0
      totalTokens += (s.input_tokens ?? 0) + (s.output_tokens ?? 0)
    }
    return {
      totalSessions: sessions.length,
      totalMessages,
      totalToolCalls,
      totalTokens,
    }
  }, [sessions])

  const recentSessions = useMemo(
    () =>
      [...sessions]
        .sort((a, b) => (b.started_at ?? 0) - (a.started_at ?? 0))
        .slice(0, 6),
    [sessions],
  )

  const maxTokens = useMemo(() => {
    let max = 0
    for (const s of recentSessions) {
      const t = (s.input_tokens ?? 0) + (s.output_tokens ?? 0)
      if (t > max) max = t
    }
    return max
  }, [recentSessions])

  const costEstimate = `~${((stats.totalTokens / 1_000_000) * 5).toFixed(2)}`

  const updateSettings = useSettingsStore((state) => state.updateSettings)
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === 'undefined') return true
    const dt = document.documentElement.getAttribute('data-theme') || ''
    return !dt.endsWith('-light')
  })

  return (
    <div className="min-h-full">
      {/* Floating mobile nav: hamburger left, theme toggle right */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-2 h-12"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <button
          type="button"
          aria-label="Open navigation menu"
          onClick={openHamburgerMenu}
          className="flex items-center justify-center w-11 h-11 rounded-xl active:bg-muted/50 transition-colors touch-manipulation"
        >
          <svg
            width="20"
            height="16"
            viewBox="0 0 20 16"
            fill="none"
            className="opacity-70 text-foreground"
          >
            <path
              d="M1 1.5H19M1 8H19M1 14.5H13"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Toggle theme"
          onClick={() => {
            const LIGHT_DARK_PAIRS: Record<string, string> = {
              'hermes-nous': 'hermes-nous-light',
              'hermes-nous-light': 'hermes-nous',
              'hermes-official': 'hermes-official-light',
              'hermes-official-light': 'hermes-official',
              'hermes-classic': 'hermes-classic-light',
              'hermes-classic-light': 'hermes-classic',
              'hermes-slate': 'hermes-slate-light',
              'hermes-slate-light': 'hermes-slate',
              semantier: 'semantier-light',
              'semantier-light': 'semantier',
            }
            const cur =
              document.documentElement.getAttribute('data-theme') ||
              'semantier'
            const nextDataTheme =
              LIGHT_DARK_PAIRS[cur] ||
              (isDark ? 'semantier-light' : 'semantier')
            import('@/lib/theme').then(({ setTheme }) => {
              setTheme(nextDataTheme as any)
            })
            const nextMode = nextDataTheme.endsWith('-light') ? 'light' : 'dark'
            applyTheme(nextMode)
            updateSettings({ theme: nextMode })
            setIsDark(nextMode === 'dark')
          }}
          className="flex items-center justify-center w-11 h-11 rounded-xl active:bg-muted/50 transition-colors touch-manipulation text-muted-foreground"
        >
          <HugeiconsIcon
            icon={isDark ? Sun02Icon : Moon02Icon}
            size={20}
            strokeWidth={1.5}
          />
        </button>
      </div>
      <div className="px-4 pt-14 md:pt-4 py-4 md:px-8 md:py-6 lg:px-10 space-y-5 pb-28">
        {/* ── Header: Hermes Logo + Quick Actions ── */}
        <div className="flex flex-col items-center gap-3 py-3">
          <img
            src="/logo.svg"
            alt="semantier logo"
            className="relative size-20 rounded-card bg-card p-1"
          />
          <p className="brand-wordmark text-[11px] font-semibold text-muted-foreground">
            semantier
          </p>
          <div className="mt-1 grid w-full max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4">
            <QuickAction
              label="New Chat"
              icon={Chat01Icon}
              iconClass="bg-primary/10 text-primary"
              onClick={() =>
                navigate({
                  to: '/chat/$sessionKey',
                  params: { sessionKey: 'new' },
                })
              }
            />
            <QuickAction
              label="Terminal"
              icon={BinaryCodeIcon}
              iconClass="bg-success/10 text-success"
              onClick={() => navigate({ to: '/terminal' })}
            />
            <QuickAction
              label="Skills"
              icon={Book01Icon}
              iconClass="bg-warning/10 text-warning"
              onClick={() => navigate({ to: '/skills' })}
              disabled={!skillsAvailable}
              badge={!skillsAvailable ? 'Enhanced' : undefined}
            />
            <QuickAction
              label="Settings"
              icon={AccountSetting01Icon}
              iconClass="bg-info/10 text-info"
              onClick={() => navigate({ to: '/settings' })}
            />
          </div>
        </div>

        {/* ── Metrics Row ── */}
        {sessionsAvailable ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricTile
              label="Sessions"
              value={formatNumber(stats.totalSessions)}
              icon={Chat01Icon}
              iconClass="bg-primary/10 text-primary"
            />
            <MetricTile
              label="Messages"
              value={formatNumber(stats.totalMessages)}
              icon={Mail01Icon}
              iconClass="bg-success/10 text-success"
            />
            <MetricTile
              label="Tool Calls"
              value={formatNumber(stats.totalToolCalls)}
              icon={Briefcase01Icon}
              iconClass="bg-warning/10 text-warning"
            />
            <MetricTile
              label="Tokens"
              value={formatNumber(stats.totalTokens)}
              sub={costEstimate}
              icon={FlashIcon}
              iconClass="bg-info/10 text-info"
            />
          </div>
        ) : (
          <UnavailableWidget
            title="Workspace Analytics"
            description={getUnavailableReason('sessions')}
          />
        )}

        {/* ── Charts + Model + Skills ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-5">
            {sessionsAvailable ? (
              <ActivityChart sessions={sessions} />
            ) : (
              <UnavailableWidget
                title="Activity"
                description={getUnavailableReason('sessions')}
              />
            )}
          </div>
          <div className="lg:col-span-4">
            <ModelCard />
          </div>
          <div className="lg:col-span-3">
            <SkillsWidget />
          </div>
        </div>

        {/* ── Recent Sessions (minimal) ── */}
        {sessionsAvailable ? (
          <DashboardCard
            title="Recent Sessions"
            titleRight={
              <button
                type="button"
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                onClick={() =>
                  navigate({
                    to: '/chat/$sessionKey',
                    params: { sessionKey: 'main' },
                  })
                }
              >
                View all →
              </button>
            }
            noPadding
          >
            <div className="py-1">
              {recentSessions.length === 0 ? (
                <div className="text-xs text-muted-foreground py-8 text-center">
                  No sessions yet — start a chat!
                </div>
              ) : (
                recentSessions.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    maxTokens={maxTokens}
                    onClick={() =>
                      navigate({
                        to: '/chat/$sessionKey',
                        params: { sessionKey: s.id },
                      })
                    }
                  />
                ))
              )}
            </div>
          </DashboardCard>
        ) : (
          <UnavailableWidget
            title="Recent Sessions"
            description={getUnavailableReason('sessions')}
          />
        )}
      </div>
    </div>
  )
}

