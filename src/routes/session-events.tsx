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
import type { SessionSummary } from '@/screens/chat/types'
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
  sessionKey: string
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

type CanonicalSessionLog = {
  session_id: string
  session_key?: string
  title?: string | null
  display_name?: string | null
  source?: string | null
  model?: string | null
  base_url?: string | null
  platform?: string | null
  session_start?: string | null
  last_updated?: string | null
  system_prompt?: string | null
  tools?: Array<unknown>
  message_count?: number
  messages?: Array<Record<string, unknown>>
}

type SessionEventsSession = SessionSummary & {
  key: string
  friendlyId: string
  createdAt?: number
  updatedAt?: number
}

type RawSessionTrajectoryExport = {
  session_id?: string
  sessionKey?: string
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

function normalizeSessionRecord(
  session: SessionSummary | SessionEventsSession,
): SessionEventsSession {
  const raw = session as Record<string, unknown>
  const key =
    typeof session.key === 'string' && session.key.trim().length > 0
      ? session.key.trim()
      : typeof session.friendlyId === 'string' && session.friendlyId.trim().length > 0
        ? session.friendlyId.trim()
        : 'main'
  const friendlyId =
    typeof session.friendlyId === 'string' && session.friendlyId.trim().length > 0
      ? session.friendlyId.trim()
      : key

  return {
    ...session,
    key,
    friendlyId,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : undefined,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : undefined,
  }
}

function normalizeTrajectoryExport(
  payload: RawSessionTrajectoryExport,
  fallbackSessionKey: string,
): SessionTrajectoryExport {
  const sessionKey =
    typeof payload.sessionKey === 'string' && payload.sessionKey.trim().length > 0
      ? payload.sessionKey.trim()
      : typeof payload.session_id === 'string' && payload.session_id.trim().length > 0
        ? payload.session_id.trim()
        : fallbackSessionKey
  return {
    sessionKey,
    title: payload.title,
    source_file: payload.source_file,
    trajectory: payload.trajectory,
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
    if (
      bodyPreview.startsWith('<!DOCTYPE') ||
      bodyPreview.startsWith('<html')
    ) {
      throw new Error(
        'Session Events API returned HTML instead of JSON. Restart the Hermes Workspace dev server so the new /api/semantier-proxy route is loaded.',
      )
    }
    throw new Error(
      `Expected JSON from ${path}, received ${contentType || 'unknown content type'}`,
    )
  }

  return (await response.json()) as T
}

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
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
    if (
      bodyPreview.startsWith('<!DOCTYPE') ||
      bodyPreview.startsWith('<html')
    ) {
      throw new Error(
        'Session Events API returned HTML instead of JSON. Restart the Hermes Workspace dev server so the new /api/semantier-proxy route is loaded.',
      )
    }
    throw new Error(
      `Expected JSON from ${path}, received ${contentType || 'unknown content type'}`,
    )
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

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: 'application/json;charset=utf-8',
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
  const sessionId = (search.session || search.friendlyId || '').trim()

  const [sessions, setSessions] = useState<Array<SessionEventsSession>>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [events, setEvents] = useState<Array<SessionEventItem>>([])
  const [eventsUnavailable, setEventsUnavailable] = useState(false)
  const [trajectory, setTrajectory] = useState<SessionTrajectoryExport | null>(
    null,
  )
  const [sessionDetail, setSessionDetail] = useState<CanonicalSessionLog | null>(null)
  const [selectedSessionIds, setSelectedSessionIds] = useState<Array<string>>(
    [],
  )
  const [showSchema, setShowSchema] = useState(false)
  const [timestampSort, setTimestampSort] = useState<'desc' | 'asc'>('desc')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [projectionTab, setProjectionTab] = useState<'trajectory' | 'session-json'>('trajectory')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const sessionJsonSchema = useMemo(
    () => ({
      session_id: 'string',
      session_key: 'string | undefined',
      title: 'string | null | undefined',
      display_name: 'string | null | undefined',
      source: 'string | null | undefined',
      model: 'string | null | undefined',
      base_url: 'string | null | undefined',
      platform: 'string | null | undefined',
      session_start: 'string | null | undefined',
      last_updated: 'string | null | undefined',
      system_prompt: 'string | null | undefined',
      tools: 'unknown[] | undefined',
      message_count: 'number',
      messages: 'Record<string, unknown>[]',
    }),
    [],
  )

  useEffect(() => {
    const controller = new AbortController()
    setSessionsLoading(true)

    fetchJson<Array<SessionSummary>>(
      '/api/semantier-proxy/sessions',
      controller.signal,
    )
      .then((items) => {
        setSessions(items.map(normalizeSessionRecord))
      })
      .catch((nextError: unknown) => {
        if (nextError instanceof Error && nextError.name === 'AbortError') {
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
        sessions.some((session) => session.key === id),
      ),
    )
  }, [sessions])

  useEffect(() => {
    if (!sessionId) return
    setSelectedSessionIds((previous) =>
      previous.includes(sessionId) ? previous : [sessionId, ...previous],
    )
  }, [sessionId])

  const sessionsWithCurrent = useMemo(() => {
    if (!sessionId) {
      return sessions
    }
    if (sessions.some((session) => session.key === sessionId)) {
      return sessions
    }
    return [
      normalizeSessionRecord({
        key: sessionId,
        friendlyId: sessionId,
        title: sessionId,
        status: 'unknown',
      }),
      ...sessions,
    ]
  }, [sessionId, sessions])

  useEffect(() => {
    if (!sessionId) {
      setEvents([])
      setEventsUnavailable(false)
      setTrajectory(null)
      setSessionDetail(null)
      setError(null)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const fetchEventLog = fetchJson<Array<SessionEventItem>>(
      `/api/semantier-proxy/sessions/${encodeURIComponent(sessionId)}/event-log?limit=5000`,
      controller.signal,
    ).then((items) => ({ ok: true as const, data: items })).catch(() => ({ ok: false as const, data: [] as Array<SessionEventItem> }))

    const fetchTrajectory = fetchJson<RawSessionTrajectoryExport>(
      `/api/semantier-proxy/sessions/${encodeURIComponent(sessionId)}/trajectory`,
      controller.signal,
    ).then((d) => ({ ok: true as const, data: d })).catch(() => ({ ok: false as const, data: null }))

    const fetchDetail = fetchJson<CanonicalSessionLog>(
      `/api/semantier-proxy/api/sessions/${encodeURIComponent(sessionId)}/log`,
      controller.signal,
    ).then((d) => ({ ok: true as const, data: d, error: null })).catch((err: unknown) => ({
      ok: false as const,
      data: null,
      error: err instanceof Error ? err.message : 'Session detail unavailable',
    }))

    Promise.all([fetchEventLog, fetchTrajectory, fetchDetail])
      .then(([eventResult, trajectoryResult, detailResult]) => {
        if (controller.signal.aborted) return
        setEvents(eventResult.data)
        setEventsUnavailable(!eventResult.ok)
        setTrajectory(
          trajectoryResult.ok
            ? normalizeTrajectoryExport(trajectoryResult.data, sessionId)
            : null,
        )
        setSessionDetail(detailResult.data)
        if (!detailResult.ok && detailResult.error) {
          setError(detailResult.error)
        }
      })
      .catch((nextError: unknown) => {
        if (nextError instanceof Error && nextError.name === 'AbortError') {
          return
        }
        setEvents([])
        setEventsUnavailable(false)
        setTrajectory(null)
        setSessionDetail(null)
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
    const nextCounts: Record<string, number> = {}
    for (const event of events) {
      nextCounts[event.event_type] = (nextCounts[event.event_type] || 0) + 1
    }
    return nextCounts
  }, [events])

  const selectedSessions = useMemo(
    () =>
      sessionsWithCurrent.filter((session) =>
        selectedSessionIds.includes(session.key),
      ),
    [selectedSessionIds, sessionsWithCurrent],
  )

  const sortedSessions = useMemo(() => {
    const copy = [...sessionsWithCurrent]
    copy.sort((left, right) => {
      const leftTs = left.updatedAt ?? left.createdAt ?? 0
      const rightTs = right.updatedAt ?? right.createdAt ?? 0
      return timestampSort === 'desc' ? rightTs - leftTs : leftTs - rightTs
    })
    return copy
  }, [sessionsWithCurrent, timestampSort])

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
      previous.length === sessionsWithCurrent.length
        ? []
        : sessionsWithCurrent.map((session) => session.key),
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
          requestJson<RawSessionTrajectoryExport>(
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
        exports.map((item) => normalizeTrajectoryExport(item, '').trajectory),
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

  async function exportSessionJson() {
    if (selectedSessionIds.length === 0) return
    try {
      const sessionsToExport = await Promise.all(
        selectedSessionIds.map((id) =>
          requestJson<CanonicalSessionLog>(
            `/api/semantier-proxy/api/sessions/${encodeURIComponent(id)}/log`,
          ),
        ),
      )
      const fileName =
        selectedSessionIds.length === 1
          ? `${selectedSessionIds[0]}_session.json`
          : 'selected_sessions_session.json'
      downloadJson(
        fileName,
        selectedSessionIds.length === 1 ? sessionsToExport[0] : sessionsToExport,
      )
      toast('Session JSON exported', { type: 'success' })
    } catch (nextError) {
      toast(
        nextError instanceof Error
          ? nextError.message
          : 'Session JSON export failed',
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
      const deletedIds = result.deleted
      setSessions((previous) =>
        previous.filter((session) => !deletedIds.includes(session.key)),
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
    <div className="min-h-full bg-background px-4 py-4 text-foreground md:px-6 md:py-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-card border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                Session Event Review
              </p>
              <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
                Canonical events.jsonl
              </h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Review the canonical session event log and export the projected
                Atropos trajectory dataset entry.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSchema((previous) => !previous)}
                className="inline-flex items-center gap-2 rounded-button border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-all hover:bg-muted hover:scale-105 active:scale-95"
              >
                <HugeiconsIcon icon={File01Icon} size={18} strokeWidth={1.5} />
                {showSchema ? 'Hide schema' : 'View schema'}
              </button>
              <button
                type="button"
                onClick={() => setRefreshKey((value) => value + 1)}
                disabled={!sessionId || loading}
                className="inline-flex items-center gap-2 rounded-button border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-all hover:bg-muted hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <HugeiconsIcon icon={RefreshIcon} size={18} strokeWidth={1.5} />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Session
              </div>
              <div className="mt-1 truncate text-sm font-medium text-foreground">
                {sessionId || 'No session selected'}
              </div>
            </div>
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Model
              </div>
              <div className="mt-1 truncate text-sm font-medium text-foreground">
                {typeof sessionDetail?.model === 'string' && sessionDetail.model
                  ? sessionDetail.model
                  : '—'}
              </div>
            </div>
            {!eventsUnavailable ? (
              <div className="rounded-md border border-border bg-muted/40 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Events
                </div>
                <div className="mt-1 text-2xl font-semibold text-foreground">
                  {events.length}
                </div>
              </div>
            ) : null}
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Trajectory
              </div>
              <div className="mt-1 text-sm font-medium text-foreground">
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
          <section className="rounded-card border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Session JSON schema
                </h2>
                <p className="text-xs text-muted-foreground">
                  Canonical workspace session log record shape.
                </p>
              </div>
            </div>
            <pre className="min-w-0 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-[11px] text-foreground">
              {JSON.stringify(sessionJsonSchema, null, 2)}
            </pre>
          </section>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <section className="min-w-0 rounded-card border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  Sessions
                </h2>
                <span className="text-xs text-muted-foreground">
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
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-destructive/30 bg-card text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <HugeiconsIcon
                    icon={Delete01Icon}
                    size={18}
                    strokeWidth={1.5}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void exportSessionJson()
                  }}
                  disabled={selectedSessionIds.length === 0}
                  title="Export session JSON"
                  aria-label="Export session JSON"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted/40 text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <HugeiconsIcon
                    icon={File01Icon}
                    size={18}
                    strokeWidth={1.5}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void exportTrajectory()
                  }}
                  disabled={selectedSessionIds.length === 0}
                  title="Export Atropos JSONL"
                  aria-label="Export Atropos JSONL"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted/40 text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <HugeiconsIcon
                    icon={Download01Icon}
                    size={18}
                    strokeWidth={1.5}
                  />
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full table-fixed border-collapse text-left text-sm">
                <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-10 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={
                          sessions.length > 0 &&
                          selectedSessionIds.length === sessions.length
                        }
                        onChange={toggleAllSessions}
                        className="h-4 w-4 rounded border-border"
                        aria-label="Select all sessions"
                      />
                    </th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Session ID</th>
                    <th className="px-3 py-2">
                      <button
                        type="button"
                        onClick={toggleTimestampSort}
                        className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground"
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
                    const active = session.key === sessionId
                    const selected = selectedSessionIds.includes(session.key)
                    const timestamp =
                      typeof session.updatedAt === 'number'
                        ? new Date(session.updatedAt).toLocaleString()
                        : typeof session.createdAt === 'number'
                          ? new Date(session.createdAt).toLocaleString()
                          : ''

                    return (
                      <tr
                        key={session.key}
                        onClick={() => setRouteSession(session.key)}
                        className={
                          active
                            ? 'cursor-pointer border-t border-border bg-muted/70 transition-colors'
                            : 'cursor-pointer border-t border-border transition-colors hover:bg-muted/50'
                        }
                      >
                        <td
                          className="px-3 py-3"
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleSession(session.key)
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            readOnly
                            className="h-4 w-4 rounded border-border"
                            aria-label={`Select ${session.title || session.key}`}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div
                            className={
                              active
                                ? 'truncate font-medium text-foreground'
                                : 'truncate font-medium text-foreground'
                            }
                          >
                            {session.title || session.key}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          <div className="truncate">{session.key}</div>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          <div className="truncate">
                            {timestamp || '—'}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {sessionsLoading ? (
                <p className="p-3 text-sm text-muted-foreground">
                  Loading sessions…
                </p>
              ) : null}
              {!sessionsLoading && sessions.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">
                  No sessions found.
                </p>
              ) : null}
            </div>
          </section>

          <div className="min-w-0 space-y-6">
            <section className="min-w-0 rounded-card border border-border bg-card p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Summary
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {sessionId || 'Select a session'}
                    {selectedSessions.length > 0
                      ? ` · ${selectedSessions.length} selected`
                      : ''}
                  </p>
                </div>
                {trajectory ? (
                  <Link
                    to="/chat/$sessionKey"
                    params={{ sessionKey: trajectory.sessionKey }}
                    className="text-sm text-primary hover:underline"
                  >
                    Open chat
                  </Link>
                ) : null}
              </div>

              {loading ? (
                <p className="text-sm text-muted-foreground">
                  Loading canonical events…
                </p>
              ) : !sessionId ? (
                <p className="text-sm text-muted-foreground">
                  Select a session to inspect its event log.
                </p>
              ) : error ? (
                <p className="text-sm text-destructive">
                  {error}
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-3">
                  {!eventsUnavailable ? (
                    <div className="rounded-md border border-border p-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Events
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-foreground">
                        {events.length}
                      </div>
                    </div>
                  ) : null}
                  {!eventsUnavailable ? (
                    <div className="rounded-md border border-border p-3 md:col-span-2">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Event types
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(counts).map(([type, count]) => (
                          <span
                            key={type}
                            className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs text-foreground"
                          >
                            {type} {count}
                          </span>
                        ))}
                        {Object.keys(counts).length === 0 ? (
                          <span className="text-sm text-muted-foreground">
                            No events recorded.
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  <div className="rounded-md border border-border p-3 md:col-span-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Session info
                      </div>
                      <div className="flex w-fit items-center gap-1 rounded-md border border-border bg-muted p-1">
                        <button
                          type="button"
                          onClick={() => setProjectionTab('trajectory')}
                          className={
                            projectionTab === 'trajectory'
                              ? 'rounded-md bg-card px-3 py-1 text-xs font-medium text-foreground shadow-sm'
                              : 'rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground'
                          }
                        >
                          trajectory.jsonl
                        </button>
                        <button
                          type="button"
                          onClick={() => setProjectionTab('session-json')}
                          className={
                            projectionTab === 'session-json'
                              ? 'rounded-md bg-card px-3 py-1 text-xs font-medium text-foreground shadow-sm'
                              : 'rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground'
                          }
                        >
                          session.json
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {sessionDetail ? (
                        <>
                          {typeof sessionDetail.model === 'string' && sessionDetail.model ? (
                            <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs text-foreground">
                              model: {sessionDetail.model}
                            </span>
                          ) : null}
                          {typeof sessionDetail.platform === 'string' && sessionDetail.platform ? (
                            <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs text-foreground">
                              platform: {sessionDetail.platform}
                            </span>
                          ) : null}
                          {typeof sessionDetail.source === 'string' && sessionDetail.source ? (
                            <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs text-foreground">
                              source: {sessionDetail.source}
                            </span>
                          ) : null}
                          {typeof sessionDetail.message_count === 'number' ? (
                            <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs text-foreground">
                              messages: {sessionDetail.message_count}
                            </span>
                          ) : null}
                          {typeof sessionDetail.last_updated === 'string' && sessionDetail.last_updated ? (
                            <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs text-foreground">
                              updated: {new Date(sessionDetail.last_updated).toLocaleString()}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {sessionId ? 'Session detail unavailable.' : 'No session selected.'}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 max-h-[70vh] min-w-0 overflow-auto">
                      {projectionTab === 'trajectory' ? (
                        <pre className="min-w-0 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-[11px] text-foreground">
                          {trajectory
                            ? JSON.stringify(trajectory.trajectory, null, 2)
                            : 'No trajectory available.'}
                        </pre>
                      ) : (
                        <pre className="min-w-0 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-[11px] text-foreground">
                          {sessionDetail
                            ? JSON.stringify(sessionDetail, null, 2)
                            : sessionId
                              ? 'Session JSON unavailable.'
                              : 'No session selected.'}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className={eventsUnavailable ? 'min-w-0' : 'grid min-w-0 gap-6 xl:grid-cols-2'}>
              {!eventsUnavailable ? (
                <div className="min-w-0 rounded-card border border-border bg-card p-4 shadow-sm">
                  <h2 className="mb-3 text-sm font-semibold text-foreground">
                    Event log
                  </h2>
                  <div className="max-h-[70vh] min-w-0 space-y-3 overflow-auto pr-1">
                    {events.map((event) => {
                      const body = formatEventBody(event)
                      return (
                        <div
                          key={event.event_id}
                          className="rounded-md border border-border bg-card p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs font-medium text-foreground">
                            {event.event_type}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {new Date(event.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {event.attempt_id
                            ? `attempt ${event.attempt_id}`
                            : 'session event'}
                          {event.tool ? ` · tool ${event.tool}` : ''}
                          {event.status ? ` · ${event.status}` : ''}
                        </div>
                        {body ? (
                          <pre className="mt-2 min-w-0 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-2 text-[11px] text-foreground">
                            {body}
                          </pre>
                        ) : null}
                      </div>
                    )
                  })}
                  {!loading && sessionId && events.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No events for this session.
                    </p>
                  ) : null}
                </div>
              </div>
              ) : null}
            </section>
          </div>
        </div>

        {showDeleteModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-card border border-border bg-card p-5 shadow-xl">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-foreground">
                  Delete selected sessions
                </h2>
                <p className="text-sm text-muted-foreground">
                  Delete {selectedSessionIds.length} selected session
                  {selectedSessionIds.length === 1 ? '' : 's'}? This removes the
                  session records and canonical events.jsonl data.
                </p>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="rounded-button border border-border bg-background px-3 py-2 text-sm text-foreground transition-all hover:bg-muted hover:scale-105 active:scale-95 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void deleteSelectedSessions()
                  }}
                  disabled={deleting}
                  className="rounded-button bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-60"
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
