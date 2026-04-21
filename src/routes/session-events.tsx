import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  ArrowUpDownIcon,
  Delete01Icon,
  Download01Icon,
  File01Icon,
  RefreshIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { toast } from '@/components/ui/toast'
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

type SessionSummary = {
  session_id: string
  title?: string
  status?: string
  channel?: string
  created_at?: string
  updated_at?: string
  last_attempt_id?: string
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
  const contentType = response.headers.get('content-type') || ''
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

  if (!contentType.toLowerCase().includes('application/json')) {
    const bodyPreview = (await response.text()).slice(0, 120)
    if (bodyPreview.startsWith('<!DOCTYPE') || bodyPreview.startsWith('<html')) {
      throw new Error(
        'Session Events API returned HTML instead of JSON. Restart the Hermes Workspace dev server so the new /api/semantier-proxy route is loaded.',
      )
    }
    throw new Error(`Expected JSON from ${path}, received ${contentType || 'unknown content type'}`)
  }

  return (await response.json()) as T
}

async function requestJson<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })
  const contentType = response.headers.get('content-type') || ''

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

  if (!contentType.toLowerCase().includes('application/json')) {
    const bodyPreview = (await response.text()).slice(0, 120)
    if (bodyPreview.startsWith('<!DOCTYPE') || bodyPreview.startsWith('<html')) {
      throw new Error(
        'Session Events API returned HTML instead of JSON. Restart the Hermes Workspace dev server so the new /api/semantier-proxy route is loaded.',
      )
    }
    throw new Error(`Expected JSON from ${path}, received ${contentType || 'unknown content type'}`)
  }

  const text = await response.text()
  return text ? (JSON.parse(text) as T) : ({} as T)
}

function downloadJsonl(filename: string, lines: Array<unknown>) {
  const body = `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`
  const blob = new Blob([body], {
    type: 'application/x-ndjson;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
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

  const navigate = useNavigate()
  const search = Route.useSearch()
  const sessionId = search.session || ''

  const [sessions, setSessions] = useState<Array<SessionSummary>>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [events, setEvents] = useState<Array<SessionEventItem>>([])
  const [trajectory, setTrajectory] =
    useState<SessionTrajectoryExport | null>(null)
  const [selectedSessionIds, setSelectedSessionIds] = useState<Array<string>>(
    [],
  )
  const [showSchema, setShowSchema] = useState(false)
  const [timestampSort, setTimestampSort] = useState<'desc' | 'asc'>('desc')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const canonicalSchema = useMemo(
    () => ({
      event_id: 'string',
      session_id: 'string',
      attempt_id: 'string | null',
      event_type: [
        'message.created',
        'assistant.delta',
        'assistant.reasoning',
        'tool.call',
        'tool.result',
        'tool.progress',
        'attempt.created',
        'attempt.started',
        'attempt.completed',
        'attempt.failed',
      ],
      timestamp: 'ISO-8601 string',
      role: '"user" | "assistant" | "tool" | "system" | null',
      content: 'string | null',
      reasoning: 'string | null',
      tool: 'string | null',
      tool_call_id: 'string | null',
      args: 'Record<string, unknown> | null',
      status: 'string | null',
      metadata: 'Record<string, unknown>',
    }),
    [],
  )

  useEffect(() => {
    const controller = new AbortController()
    setSessionsLoading(true)

    fetchJson<Array<SessionSummary>>('/api/semantier-proxy/sessions', controller.signal)
      .then((items) => {
        setSessions(items)
      })
      .catch((nextError: unknown) => {
        if (
          nextError instanceof Error &&
          nextError.name === 'AbortError'
        ) {
          return
        }
        setSessions([])
        toast(
          nextError instanceof Error
            ? nextError.message
            : 'Failed to load sessions',
          { type: 'error' },
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setSessionsLoading(false)
        }
      })

    return () => {
      controller.abort()
    }
  }, [refreshKey])

  useEffect(() => {
    setSelectedSessionIds((previous) =>
      previous.filter((id) =>
        sessions.some((session) => session.session_id === id),
      ),
    )
  }, [sessions])

  useEffect(() => {
    if (!sessionId || sessionsLoading) return
    if (sessions.some((session) => session.session_id === sessionId)) return
    void navigate({ to: '/session-events', search: {} })
    setEvents([])
    setTrajectory(null)
  }, [navigate, sessionId, sessions, sessionsLoading])

  useEffect(() => {
    if (!sessionId) return
    setSelectedSessionIds((previous) =>
      previous.includes(sessionId) ? previous : [sessionId, ...previous],
    )
  }, [sessionId])

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
        `/api/semantier-proxy/sessions/${encodeURIComponent(sessionId)}/event-log?limit=5000`,
        controller.signal,
      ),
      fetchJson<SessionTrajectoryExport>(
        `/api/semantier-proxy/sessions/${encodeURIComponent(sessionId)}/trajectory`,
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

  const counts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const event of events) {
      counts[event.event_type] = (counts[event.event_type] || 0) + 1
    }
    return counts
  }, [events])

  const selectedSessions = useMemo(
    () =>
      sessions.filter((session) =>
        selectedSessionIds.includes(session.session_id),
      ),
    [selectedSessionIds, sessions],
  )

  const sortedSessions = useMemo(() => {
    const copy = [...sessions]
    copy.sort((left, right) => {
      const leftTs = Date.parse(left.updated_at || left.created_at || '') || 0
      const rightTs =
        Date.parse(right.updated_at || right.created_at || '') || 0
      return timestampSort === 'desc' ? rightTs - leftTs : leftTs - rightTs
    })
    return copy
  }, [sessions, timestampSort])

  function setRouteSession(nextSessionId?: string) {
    void navigate({
      to: '/session-events',
      search: nextSessionId
        ? {
            session: nextSessionId,
            friendlyId: nextSessionId,
          }
        : {},
    })
  }

  function toggleSession(nextSessionId: string) {
    setSelectedSessionIds((previous) =>
      previous.includes(nextSessionId)
        ? previous.filter((id) => id !== nextSessionId)
        : [...previous, nextSessionId],
    )
  }

  function toggleAllSessions() {
    setSelectedSessionIds((previous) =>
      previous.length === sessions.length
        ? []
        : sessions.map((session) => session.session_id),
    )
  }

  function toggleTimestampSort() {
    setTimestampSort((previous) => (previous === 'desc' ? 'asc' : 'desc'))
  }

  async function exportTrajectory() {
    if (selectedSessionIds.length === 0) return
    try {
      const exports = await Promise.all(
        selectedSessionIds.map((id) =>
          requestJson<SessionTrajectoryExport>(
            `/api/semantier-proxy/sessions/${encodeURIComponent(id)}/trajectory`,
          ),
        ),
      )
      const fileName =
        selectedSessionIds.length === 1
          ? `${selectedSessionIds[0]}_atropos_trajectory.jsonl`
          : 'selected_sessions_atropos_trajectory.jsonl'
      downloadJsonl(
        fileName,
        exports.map((item) => item.trajectory),
      )
      toast('Atropos JSONL exported', { type: 'success' })
    } catch (nextError) {
      toast(
        nextError instanceof Error
          ? nextError.message
          : 'Trajectory export failed',
        { type: 'error' },
      )
    }
  }

  async function exportEvents() {
    if (selectedSessionIds.length === 0) return
    try {
      const groups = await Promise.all(
        selectedSessionIds.map((id) =>
          requestJson<Array<SessionEventItem>>(
            `/api/semantier-proxy/sessions/${encodeURIComponent(id)}/event-log?limit=5000`,
          ),
        ),
      )
      const lines = groups.flat()
      const fileName =
        selectedSessionIds.length === 1
          ? `${selectedSessionIds[0]}_events.jsonl`
          : 'selected_sessions_events.jsonl'
      downloadJsonl(fileName, lines)
      toast('Event log exported', { type: 'success' })
    } catch (nextError) {
      toast(
        nextError instanceof Error ? nextError.message : 'Event export failed',
        { type: 'error' },
      )
    }
  }

  function requestDeleteSelectedSessions() {
    if (selectedSessionIds.length === 0) return
    setShowDeleteModal(true)
  }

  async function deleteSelectedSessions() {
    if (selectedSessionIds.length === 0) return
    setDeleting(true)
    const deletingIds = [...selectedSessionIds]
    try {
      const result = await requestJson<{
        status: string
        deleted: Array<string>
        missing: Array<string>
      }>('/api/semantier-proxy/sessions/batch-delete', {
        method: 'POST',
        body: JSON.stringify({ session_ids: deletingIds }),
      })
      const deletedIds = result.deleted || []
      setSessions((previous) =>
        previous.filter((session) => !deletedIds.includes(session.session_id)),
      )
      setSelectedSessionIds([])
      if (sessionId && deletedIds.includes(sessionId)) {
        setRouteSession()
        setEvents([])
        setTrajectory(null)
      }
      toast(
        deletedIds.length > 0
          ? `Deleted ${deletedIds.length} session${deletedIds.length === 1 ? '' : 's'}`
          : 'No sessions were deleted',
        { type: deletedIds.length > 0 ? 'success' : 'warning' },
      )
    } catch (nextError) {
      toast(
        nextError instanceof Error
          ? nextError.message
          : 'Failed to delete sessions',
        { type: 'error' },
      )
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

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
                Canonical events.jsonl
              </h1>
              <p className="max-w-3xl text-sm text-primary-700 dark:text-neutral-300">
                Review the canonical session event log and export the projected
                Atropos trajectory dataset entry.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSchema((previous) => !previous)}
                className="inline-flex items-center gap-2 rounded-lg border border-primary-200 px-3 py-2 text-sm font-medium text-primary-800 transition-colors hover:bg-primary-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
              >
                <HugeiconsIcon icon={File01Icon} size={18} strokeWidth={1.5} />
                {showSchema ? 'Hide schema' : 'View schema'}
              </button>
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
                {sessionId || 'No session selected'}
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

        {showSchema ? (
          <section className="rounded-2xl border border-primary-200 bg-white/95 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/90">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-primary-950 dark:text-neutral-100">
                  Canonical schema
                </h2>
                <p className="text-xs text-primary-500 dark:text-neutral-500">
                  SessionEvent append-only record shape.
                </p>
              </div>
            </div>
            <pre className="overflow-auto whitespace-pre-wrap break-words rounded-lg bg-primary-50/80 p-3 text-[11px] text-primary-900 dark:bg-neutral-950/70 dark:text-neutral-100">
              {JSON.stringify(canonicalSchema, null, 2)}
            </pre>
          </section>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <section className="rounded-2xl border border-primary-200 bg-white/95 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/90">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-primary-950 dark:text-neutral-100">
                  Sessions
                </h2>
                <span className="text-xs text-primary-500 dark:text-neutral-500">
                  {sessions.length}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={requestDeleteSelectedSessions}
                  disabled={selectedSessionIds.length === 0}
                  title="Delete selected"
                  aria-label="Delete selected"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  <HugeiconsIcon icon={Delete01Icon} size={18} strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void exportEvents()
                  }}
                  disabled={selectedSessionIds.length === 0}
                  title="Export events"
                  aria-label="Export events"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-primary-200 bg-primary-50/70 text-primary-800 transition-colors hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
                >
                  <HugeiconsIcon icon={File01Icon} size={18} strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void exportTrajectory()
                  }}
                  disabled={selectedSessionIds.length === 0}
                  title="Export Atropos JSONL"
                  aria-label="Export Atropos JSONL"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-primary-200 bg-primary-50/70 text-primary-800 transition-colors hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
                >
                  <HugeiconsIcon icon={Download01Icon} size={18} strokeWidth={1.5} />
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-primary-200 dark:border-neutral-800">
              <table className="w-full table-fixed border-collapse text-left text-sm">
                <thead className="bg-primary-50/70 text-xs uppercase tracking-wide text-primary-500 dark:bg-neutral-800 dark:text-neutral-400">
                  <tr>
                    <th className="w-10 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={
                          sessions.length > 0 &&
                          selectedSessionIds.length === sessions.length
                        }
                        onChange={toggleAllSessions}
                        className="h-4 w-4 rounded border-primary-300 dark:border-neutral-700"
                        aria-label="Select all sessions"
                      />
                    </th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Session ID</th>
                    <th className="px-3 py-2">
                      <button
                        type="button"
                        onClick={toggleTimestampSort}
                        className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-primary-500 hover:text-primary-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                      >
                        Timestamp
                        <HugeiconsIcon
                          icon={ArrowUpDownIcon}
                          size={14}
                          strokeWidth={1.5}
                        />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSessions.map((session) => {
                    const active = session.session_id === sessionId
                    const selected = selectedSessionIds.includes(
                      session.session_id,
                    )
                    const timestamp =
                      session.updated_at || session.created_at || ''

                    return (
                      <tr
                        key={session.session_id}
                        onClick={() => setRouteSession(session.session_id)}
                        className={
                          active
                            ? 'cursor-pointer border-t border-primary-200 bg-primary-100/70 transition-colors dark:border-neutral-800 dark:bg-neutral-800/80'
                            : 'cursor-pointer border-t border-primary-200 transition-colors hover:bg-primary-50/80 dark:border-neutral-800 dark:hover:bg-neutral-800/50'
                        }
                      >
                        <td
                          className="px-3 py-3"
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleSession(session.session_id)
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            readOnly
                            className="h-4 w-4 rounded border-primary-300 dark:border-neutral-700"
                            aria-label={`Select ${session.title || session.session_id}`}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div
                            className={
                              active
                                ? 'truncate font-medium text-primary-900 dark:text-neutral-100'
                                : 'truncate font-medium text-primary-950 dark:text-neutral-100'
                            }
                          >
                            {session.title || session.session_id}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs text-primary-500 dark:text-neutral-500">
                          <div className="truncate">{session.session_id}</div>
                        </td>
                        <td className="px-3 py-3 text-xs text-primary-500 dark:text-neutral-500">
                          <div className="truncate">
                            {timestamp
                              ? new Date(timestamp).toLocaleString()
                              : '—'}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {sessionsLoading ? (
                <p className="p-3 text-sm text-primary-500 dark:text-neutral-500">
                  Loading sessions…
                </p>
              ) : null}
              {!sessionsLoading && sessions.length === 0 ? (
                <p className="p-3 text-sm text-primary-500 dark:text-neutral-500">
                  No sessions found.
                </p>
              ) : null}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-2xl border border-primary-200 bg-white/95 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/90">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-primary-950 dark:text-neutral-100">
                    Summary
                  </h2>
                  <p className="text-xs text-primary-500 dark:text-neutral-500">
                    {sessionId || 'Select a session'}
                    {selectedSessions.length > 0
                      ? ` · ${selectedSessions.length} selected`
                      : ''}
                  </p>
                </div>
                {trajectory ? (
                  <Link
                    to="/chat/$sessionKey"
                    params={{ sessionKey: trajectory.session_id }}
                    className="text-sm text-primary-700 hover:underline dark:text-neutral-200"
                  >
                    Open chat
                  </Link>
                ) : null}
              </div>

              {loading ? (
                <p className="text-sm text-primary-500 dark:text-neutral-500">
                  Loading canonical events…
                </p>
              ) : !sessionId ? (
                <p className="text-sm text-primary-500 dark:text-neutral-500">
                  Select a session to inspect its event log.
                </p>
              ) : error ? (
                <p className="text-sm text-red-700 dark:text-red-300">
                  {error}
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-primary-200 p-3 dark:border-neutral-800">
                    <div className="text-xs uppercase tracking-wide text-primary-500 dark:text-neutral-500">
                      Events
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-primary-950 dark:text-neutral-100">
                      {events.length}
                    </div>
                  </div>
                  <div className="rounded-lg border border-primary-200 p-3 md:col-span-2 dark:border-neutral-800">
                    <div className="text-xs uppercase tracking-wide text-primary-500 dark:text-neutral-500">
                      Event types
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(counts).map(([type, count]) => (
                        <span
                          key={type}
                          className="rounded-full bg-primary-50 px-2.5 py-1 text-xs text-primary-800 dark:bg-neutral-800 dark:text-neutral-100"
                        >
                          {type} {count}
                        </span>
                      ))}
                      {Object.keys(counts).length === 0 ? (
                        <span className="text-sm text-primary-500 dark:text-neutral-500">
                          No events recorded.
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
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
                        className="rounded-lg border border-primary-200 p-3 dark:border-neutral-800"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-medium text-primary-950 dark:text-neutral-100">
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
                  {!loading && sessionId && events.length === 0 ? (
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
                      : 'No trajectory available.'}
                  </pre>
                </div>
              </div>
            </section>
          </div>
        </div>

        {showDeleteModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl border border-primary-200 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-primary-950 dark:text-neutral-100">
                  Delete selected sessions
                </h2>
                <p className="text-sm text-primary-500 dark:text-neutral-500">
                  Delete {selectedSessionIds.length} selected session
                  {selectedSessionIds.length === 1 ? '' : 's'}? This removes
                  the session records and canonical events.jsonl data.
                </p>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="rounded-lg border border-primary-200 px-3 py-2 text-sm text-primary-950 transition-colors hover:bg-primary-50 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void deleteSelectedSessions()
                  }}
                  disabled={deleting}
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}