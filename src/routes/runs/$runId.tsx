import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { Markdown } from '@/components/prompt-kit/markdown'

type BacktestMetrics = {
  final_value?: number
  total_return?: number
  annual_return?: number
  max_drawdown?: number
  sharpe?: number
  win_rate?: number
  trade_count?: number
  [key: string]: number | undefined
}

type RunData = {
  run_id: string
  status: string
  elapsed_seconds: number
  prompt?: string
  metrics?: BacktestMetrics
  report_markdown?: string
  run_directory?: string
  reason?: string
}

async function fetchRun(runId: string): Promise<RunData> {
  const res = await fetch(`/api/semantier-proxy/runs/${runId}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to load run (${res.status})${text ? `: ${text}` : ''}`)
  }
  return res.json() as Promise<RunData>
}

function formatPct(value: number | undefined): string {
  if (value == null) return '—'
  return `${(value * 100).toFixed(2)}%`
}

function formatNum(value: number | undefined, decimals = 2): string {
  if (value == null) return '—'
  return value.toFixed(decimals)
}

function MetricsTable({ metrics }: { metrics: BacktestMetrics }) {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Total Return', value: formatPct(metrics.total_return) },
    { label: 'Annual Return', value: formatPct(metrics.annual_return) },
    { label: 'Max Drawdown', value: formatPct(metrics.max_drawdown) },
    { label: 'Sharpe Ratio', value: formatNum(metrics.sharpe) },
    { label: 'Win Rate', value: formatPct(metrics.win_rate) },
    { label: 'Trade Count', value: metrics.trade_count != null ? String(metrics.trade_count) : '—' },
    { label: 'Final Value', value: metrics.final_value != null ? `$${metrics.final_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—' },
  ]

  return (
    <div className="overflow-hidden rounded-lg border border-primary-200 dark:border-neutral-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-primary-200 bg-primary-50 dark:border-neutral-800 dark:bg-neutral-900">
            <th className="px-4 py-2 text-left font-medium text-primary-700 dark:text-neutral-300">Metric</th>
            <th className="px-4 py-2 text-right font-medium text-primary-700 dark:text-neutral-300">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-primary-100 last:border-0 dark:border-neutral-800/50">
              <td className="px-4 py-2 text-primary-600 dark:text-neutral-400">{row.label}</td>
              <td className="px-4 py-2 text-right font-mono text-primary-900 dark:text-neutral-100">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    success: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
    failed: 'bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-300',
    aborted: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300',
  }
  const cls = colors[status.toLowerCase()] ?? 'bg-primary-100 text-primary-700 border-primary-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700'
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {status}
    </span>
  )
}

function RunDetailPage() {
  const { runId } = Route.useParams()
  const [run, setRun] = useState<RunData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  usePageTitle(runId ? `Run ${runId}` : 'Run Report')

  useEffect(() => {
    if (!runId) return
    setLoading(true)
    setError(null)
    fetchRun(runId)
      .then(setRun)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
  }, [runId])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 md:px-6 md:py-8">
        {/* Back nav */}
        <Link
          to="/chat"
          className="inline-flex items-center gap-1.5 text-sm text-primary-500 hover:text-primary-700 dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          ← Back to chat
        </Link>

        {loading && (
          <div className="space-y-4">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-primary-100 dark:bg-neutral-800" />
            <div className="h-4 w-full animate-pulse rounded bg-primary-100 dark:bg-neutral-800" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-primary-100 dark:bg-neutral-800" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        {run && (
          <>
            {/* Header */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-semibold text-primary-900 dark:text-neutral-100">
                  Run Report
                </h1>
                <StatusBadge status={run.status} />
              </div>
              <p className="font-mono text-xs text-primary-400 dark:text-neutral-500">{run.run_id}</p>
              {run.prompt && (
                <p className="text-sm text-primary-600 dark:text-neutral-400">{run.prompt}</p>
              )}
              {run.reason && (
                <p className="text-sm text-red-600 dark:text-red-400">Reason: {run.reason}</p>
              )}
            </div>

            {/* Metrics */}
            {run.metrics && Object.keys(run.metrics).length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-primary-700 dark:text-neutral-300">Metrics</h2>
                <MetricsTable metrics={run.metrics} />
              </div>
            )}

            {/* Narrative report */}
            {run.report_markdown && (
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-primary-700 dark:text-neutral-300">Report</h2>
                <div className="prose prose-sm max-w-none rounded-lg border border-primary-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                  <Markdown>{run.report_markdown}</Markdown>
                </div>
              </div>
            )}

            {!run.metrics && !run.report_markdown && (
              <p className="text-sm text-primary-500 dark:text-neutral-500">
                No report content available for this run.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export const Route = createFileRoute('/runs/$runId')({
  ssr: false,
  component: RunDetailPage,
})
