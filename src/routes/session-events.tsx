import { Link, createFileRoute } from '@tanstack/react-router'
import { RefreshIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { usePageTitle } from '@/hooks/use-page-title'

type SessionEventItem = {
  event_id: string
  session_id: string
  attempt_id?: string | null
  event_type: string
  timestamp: string
  role?: string | null
  content?: string | null
  reasoning?: string | null
  tool?: string | null
  tool_call_id?: string | null
  args?: Record<string, unknown> | null
  status?: string | null
  metadata?: Record<string, unknown> | null
}

type SessionTrajectoryExport = {
  session_id: string
  title: string
  source_file: string
  trajectory: {
    conversations: Array<{ from: string; value: string }>
    timestamp: string
    model: string
    completed: boolean
    metadata?: Record<string, unknown>
  }
}

const searchSchema = z.object({
  session: z.string().trim().min(1).optional(),
  friendlyId: z.string().trim().min(1).optional(),
})

export const Route = createFileRoute('/session-events')({
  ssr: false,
  validateSearch: searchSchema,
  component: SessionEventsRoute,
})

async function fetchJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal })
  if (!response.ok) {
    let detail = `HTTP ${response.status}`
    try {
      const body = (await response.json()) as {
        detail?: string
        error?: string
        message?: string
      }
      detail = body.detail || body.error || body.message || detail
    } catch {}
    throw new Error(detail)
  }
  return (await response.json()) as T
}

function formatEventBody(event: SessionEventItem): string {
  if (event.reasoning) return event.reasoning
  if (event.content) return event.content
  if (event.args) return JSON.stringify(event.args, null, 2)
  if (event.metadata) return JSON.stringify(event.metadata, null, 2)
  return ''
}

function SessionEventsRoute() {
  usePageTitle('Session Events')

  const search = Route.useSearch()
  const sessionId = search.session || ''
  const chatSessionId = search.friendlyId || sessionId

  const [events, setEvents] = useState<Array<SessionEventItem>>([])
  const [trajectory, setTrajectory] =
    useState<SessionTrajectoryExport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!sessionId) {
      setEvents([])
      setTrajectory(null)
      setError(null)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    Promise.all([
      fetchJson<Array<SessionEventItem>>(
        `/api/hermes-proxy/sessions/${encodeURIComponent(sessionId)}/event-log?limit=5000`,
        controller.signal,
      ),
      fetchJson<SessionTrajectoryExport>(
        `/api/hermes-proxy/sessions/${encodeURIComponent(sessionId)}/trajectory`,
        controller.signal,
      ),
    ])
      .then(([eventItems, exportData]) => {
        setEvents(eventItems)
        setTrajectory(exportData)
      })
      .catch((nextError: unknown) => {
        if (
          nextError instanceof Error &&
          nextError.name === 'AbortError'
        ) {
          return
        }
        setEvents([])
        setTrajectory(null)
        setError(
          nextError instanceof Error
            ? nextError.message
            : 'Failed to load session events',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => {
      controller.abort()
    }
  }, [refreshKey, sessionId])

  const eventTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const event of events) {
      counts[event.event_type] = (counts[event.event_type] || 0) + 1
    }
    return counts
  }, [events])

  return (
    <div className="min-h-full bg-primary-50/35 px-4 py-4 md:px-6 md:py-6 dark:bg-neutral-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-2xl border border-primary-200 bg-white/95 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/90">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-500 dark:text-neutral-400">
                Session Event Review
              </p>
              <h1 className="text-2xl font-semibold text-primary-950 dark:text-neutral-100 md:text-3xl">
                Canonical event log
              </h1>
              <p className="max-w-3xl text-sm text-primary-700 dark:text-neutral-300">
                Inspect the session event stream and the projected trajectory for
                a single chat session.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {chatSessionId ? (
                <Link
                  to="/chat/$sessionKey"
                  params={{ sessionKey: chatSessionId }}
                  className="inline-flex items-center rounded-lg border border-primary-200 px-3 py-2 text-sm font-medium text-primary-800 transition-colors hover:bg-primary-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
                >
                  Open chat
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => setRefreshKey((value) => value + 1)}
                disabled={!sessionId || loading}
                className="inline-flex items-center gap-2 rounded-lg border border-primary-200 px-3 py-2 text-sm font-medium text-primary-800 transition-colors hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
              >
                <HugeiconsIcon
                  icon={RefreshIcon}
                  size={18}
                  strokeWidth={1.5}
                />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-primary-200/80 bg-primary-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-950/60">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-500 dark:text-neutral-500">
                Session
              </div>
              <div className="mt-1 truncate text-sm font-medium text-primary-950 dark:text-neutral-100">
                {chatSessionId || 'No session selected'}
              </div>
            </div>
            <div className="rounded-xl border border-primary-200/80 bg-primary-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-950/60">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-500 dark:text-neutral-500">
                Events
              </div>
              <div className="mt-1 text-2xl font-semibold text-primary-950 dark:text-neutral-100">
                {events.length}
              </div>
            </div>
            <div className="rounded-xl border border-primary-200/80 bg-primary-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-950/60">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-500 dark:text-neutral-500">
                Trajectory
              </div>
              <div className="mt-1 text-sm font-medium text-primary-950 dark:text-neutral-100">
                {trajectory?.trajectory.completed
                  ? 'Completed export'
                  : trajectory
                    ? 'Incomplete export'
                    : 'Unavailable'}
              </div>
            </div>
          </div>
        </section>

        {!sessionId ? (
          <section className="rounded-2xl border border-dashed border-primary-300 bg-white/80 p-8 text-sm text-primary-700 dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-300">
            Select a session from the chat sidebar menu and choose Session
            events.
          </section>
        ) : error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-primary-200 bg-white/95 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/90">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-primary-950 dark:text-neutral-100">
                    Event types
                  </h2>
                  <p className="text-xs text-primary-500 dark:text-neutral-500">
                    Grouped counts from the canonical event log.
                  </p>
                </div>
                {loading ? (
                  <span className="text-xs text-primary-500 dark:text-neutral-500">
                    Loading…
                  </span>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(eventTypeCounts).map(([type, count]) => (
                  <span
                    key={type}
                    className="rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs text-primary-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                  >
                    {type} {count}
                  </span>
                ))}
                {!loading && Object.keys(eventTypeCounts).length === 0 ? (
                  <span className="text-sm text-primary-500 dark:text-neutral-500">
                    No events recorded.
                  </span>
                ) : null}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-2xl border border-primary-200 bg-white/95 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/90">
                <h2 className="mb-3 text-sm font-semibold text-primary-950 dark:text-neutral-100">
                  Event log
                </h2>
                <div className="max-h-[70vh] space-y-3 overflow-auto pr-1">
                  {events.map((event) => {
                    const body = formatEventBody(event)
                    return (
                      <div
                        key={event.event_id}
                        className="rounded-xl border border-primary-200/80 p-3 dark:border-neutral-800"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-semibold text-primary-950 dark:text-neutral-100">
                            {event.event_type}
                          </div>
                          <div className="text-[11px] text-primary-500 dark:text-neutral-500">
                            {new Date(event.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <div className="mt-1 text-[11px] text-primary-500 dark:text-neutral-500">
                          {event.attempt_id
                            ? `attempt ${event.attempt_id}`
                            : 'session event'}
                          {event.tool ? ` · tool ${event.tool}` : ''}
                          {event.status ? ` · ${event.status}` : ''}
                        </div>
                        {body ? (
                          <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-primary-50/80 p-2 text-[11px] text-primary-900 dark:bg-neutral-950/70 dark:text-neutral-100">
                            {body}
                          </pre>
                        ) : null}
                      </div>
                    )
                  })}
                  {!loading && events.length === 0 ? (
                    <p className="text-sm text-primary-500 dark:text-neutral-500">
                      No events for this session.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-primary-200 bg-white/95 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/90">
                <h2 className="mb-3 text-sm font-semibold text-primary-950 dark:text-neutral-100">
                  Atropos projection
                </h2>
                <div className="max-h-[70vh] overflow-auto">
                  <pre className="overflow-auto whitespace-pre-wrap break-words rounded-lg bg-primary-50/80 p-3 text-[11px] text-primary-900 dark:bg-neutral-950/70 dark:text-neutral-100">
                    {trajectory
                      ? JSON.stringify(trajectory.trajectory, null, 2)
                      : loading
                        ? 'Loading trajectory…'
                        : 'No trajectory available.'}
                  </pre>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}