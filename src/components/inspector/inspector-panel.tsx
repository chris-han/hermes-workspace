import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { create } from 'zustand'
import { useActivityStore } from './activity-store'
import type { ActivityEvent } from './activity-store'
import { getUnavailableReason } from '@/lib/feature-gates'
import { useFeatureAvailable } from '@/hooks/use-feature-available'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/stores/workspace-store'

// ── Store ─────────────────────────────────────────────────────────────────────

type InspectorStore = {
  isOpen: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

export const useInspectorStore = create<InspectorStore>((set) => ({
  isOpen: false,
  setOpen: (open) => set({ isOpen: open }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}))

// ── Tab types ─────────────────────────────────────────────────────────────────

type TabId = 'activity' | 'artifacts' | 'files' | 'memory' | 'skills' | 'logs'

const TABS: Array<{
  id: TabId
  label: string
  feature?: 'memory' | 'skills'
}> = [
  { id: 'activity', label: 'Activity' },
  { id: 'artifacts', label: 'Artifacts' },
  { id: 'files', label: 'Files' },
  { id: 'memory', label: 'Memory', feature: 'memory' },
  { id: 'skills', label: 'Skills', feature: 'skills' },
  { id: 'logs', label: 'Logs' },
]

// ── Shared loading / error ────────────────────────────────────────────────────

function LoadingState({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 p-4">
      <div
        className="h-3 w-3 animate-spin rounded-full border-2 border-t-transparent"
        style={{
          borderColor: 'var(--theme-accent)',
          borderTopColor: 'transparent',
        }}
      />
      <span className="text-xs" style={{ color: 'var(--theme-muted)' }}>
        {text}
      </span>
    </div>
  )
}

function ArtifactsTab() {
  const events = useActivityStore((s) => s.events)
  const artifacts = events.filter((e) => e.type === 'artifact')

  if (artifacts.length === 0) {
    return <EmptyState text="No agent-authored artifacts yet" />
  }

  return (
    <div className="space-y-2 p-3 overflow-auto max-h-[calc(100vh-140px)]">
      <p className="text-xs" style={{ color: 'var(--theme-muted)' }}>
        {artifacts.length} artifacts emitted by the agent
      </p>
      {artifacts.map((artifact, index) => (
        <div
          key={`${artifact.time}-${index}`}
          className="rounded-lg px-3 py-2 text-xs leading-relaxed"
          style={{
            backgroundColor: 'var(--theme-card)',
            border: '1px solid var(--theme-border)',
            color: 'var(--theme-text)',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{artifact.text}</span>
            <span style={{ color: 'var(--theme-accent)' }}>
              {artifact.time}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function ErrorState({ text }: { text: string }) {
  return (
    <div className="p-4">
      <span className="text-xs" style={{ color: 'var(--theme-danger)' }}>
        {text}
      </span>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="p-4">
      <span className="text-xs" style={{ color: 'var(--theme-muted)' }}>
        {text}
      </span>
    </div>
  )
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2 text-[11px]">
      <span
        className="min-w-[72px] shrink-0 uppercase tracking-wide"
        style={{ color: 'var(--theme-muted)' }}
      >
        {label}
      </span>
      <span className="break-all" style={{ color: 'var(--theme-text)' }}>
        {value}
      </span>
    </div>
  )
}

function JsonDetailBlock({
  label,
  value,
}: {
  label: string
  value: unknown
}) {
  if (value === null || value === undefined) return null
  const text =
    typeof value === 'string' ? value : JSON.stringify(value, null, 2) || ''
  if (!text.trim()) return null
  return (
    <div className="space-y-1">
      <div
        className="text-[10px] uppercase tracking-wide"
        style={{ color: 'var(--theme-muted)' }}
      >
        {label}
      </div>
      <pre
        className="max-h-48 overflow-auto rounded px-2 py-1.5 text-[11px]"
        style={{
          background: 'var(--theme-card)',
          color: 'var(--theme-text)',
          border: '1px solid var(--theme-border)',
        }}
      >
        {text}
      </pre>
    </div>
  )
}

function ActivityExpandedDetails({ event }: { event: ActivityEvent }) {
  const details = event.details ?? {}
  const eventType =
    typeof details.event === 'string' && details.event.trim().length > 0
      ? details.event.trim()
      : event.type
  const hasStructuredDetails = Object.keys(details).length > 0

  if (eventType === 'tool') {
    const toolName =
      typeof details.toolName === 'string' ? details.toolName : event.text
    const phase = typeof details.phase === 'string' ? details.phase : null
    const toolCallId =
      typeof details.toolCallId === 'string' ? details.toolCallId : null
    const runId = typeof details.runId === 'string' ? details.runId : null
    const preview = typeof details.preview === 'string' ? details.preview : null
    return (
      <div className="space-y-2">
        <DetailRow label="tool" value={toolName} />
        <DetailRow label="phase" value={phase} />
        <DetailRow label="call id" value={toolCallId} />
        <DetailRow label="run id" value={runId} />
        <DetailRow label="path" value={event.path ?? null} />
        <DetailRow label="preview" value={preview} />
        <JsonDetailBlock label="args" value={details.args} />
        <JsonDetailBlock label="result" value={details.result} />
      </div>
    )
  }

  if (eventType === 'started') {
    const sessionKey =
      typeof details.sessionKey === 'string' ? details.sessionKey : null
    const runId = typeof details.runId === 'string' ? details.runId : null
    return (
      <div className="space-y-2">
        <DetailRow label="status" value="started" />
        <DetailRow label="session" value={sessionKey} />
        <DetailRow label="run id" value={runId} />
      </div>
    )
  }

  if (eventType === 'artifact') {
    const kind = typeof details.kind === 'string' ? details.kind : null
    const title = typeof details.title === 'string' ? details.title : event.text
    const path =
      typeof details.path === 'string' ? details.path : (event.path ?? null)
    const runId = typeof details.runId === 'string' ? details.runId : null
    return (
      <div className="space-y-2">
        <DetailRow label="artifact" value={title} />
        <DetailRow label="kind" value={kind} />
        <DetailRow label="path" value={path} />
        <DetailRow label="run id" value={runId} />
      </div>
    )
  }

  if (eventType === 'done') {
    const state = typeof details.state === 'string' ? details.state : null
    const errorMessage =
      typeof details.errorMessage === 'string' ? details.errorMessage : null
    const runId = typeof details.runId === 'string' ? details.runId : null
    return (
      <div className="space-y-2">
        <DetailRow label="status" value={state || 'complete'} />
        <DetailRow label="run id" value={runId} />
        <DetailRow label="error" value={errorMessage} />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <DetailRow label="type" value={event.type} />
      <DetailRow label="text" value={event.text} />
      <DetailRow label="path" value={event.path ?? null} />
      <DetailRow label="time" value={event.time} />
      {hasStructuredDetails ? (
        <JsonDetailBlock label="raw" value={details} />
      ) : null}
    </div>
  )
}

function ActivityExpandedPanel({ event }: { event: ActivityEvent }) {
  const [showRaw, setShowRaw] = useState(false)
  const fallbackPayload = {
    type: event.type,
    text: event.text,
    path: event.path ?? null,
    time: event.time,
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setShowRaw((prev) => !prev)}
          className="rounded px-2 py-0.5 text-[10px]"
          style={{
            color: 'var(--theme-muted)',
            border: '1px solid var(--theme-border)',
            background: 'var(--theme-card2)',
          }}
        >
          {showRaw ? 'Friendly' : 'Raw'}
        </button>
      </div>
      {showRaw ? (
        <JsonDetailBlock
          label="event"
          value={event.details ?? fallbackPayload}
        />
      ) : (
        <ActivityExpandedDetails event={event} />
      )}
    </div>
  )
}

// ── Activity Tab ──────────────────────────────────────────────────────────────

function ActivityTab() {
  const events = useActivityStore((s) => s.events)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({})

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [events.length])

  if (events.length === 0) {
    return <EmptyState text="No activity yet — start a conversation" />
  }

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  return (
    <div
      ref={scrollRef}
      className="space-y-1 p-3 overflow-auto max-h-[calc(100vh-140px)]"
    >
      {events.map((event: ActivityEvent, i: number) => (
        <div
          key={i}
          className="rounded-md text-xs"
          style={{ background: 'var(--theme-card2)' }}
        >
          <button
            type="button"
            onClick={() => toggleExpanded(`${event.time}-${i}`)}
            className="w-full flex items-start gap-2 px-2 py-1.5 text-left"
          >
            <span
              style={{ color: 'var(--theme-accent)', fontFamily: 'monospace' }}
            >
              {event.time}
            </span>
            <span style={{ color: 'var(--theme-muted)' }}>{event.type}</span>
            <span
              className="ml-auto truncate"
              style={{ color: 'var(--theme-text)' }}
            >
              {event.path ?? event.text}
            </span>
            <span
              className="ml-1 shrink-0"
              style={{ color: 'var(--theme-muted)' }}
            >
              {expandedKeys[`${event.time}-${i}`] ? '▾' : '▸'}
            </span>
          </button>
          {expandedKeys[`${event.time}-${i}`] ? (
            <div
              className="mx-2 mb-2 rounded px-2 py-2"
              style={{
                background: 'var(--theme-card)',
                border: '1px solid var(--theme-border)',
              }}
            >
              <ActivityExpandedPanel event={event} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

// ── Files Tab ─────────────────────────────────────────────────────────────────

function FilesTab() {
  const events = useActivityStore((s) => s.events)

  // Extract file paths from activity events — prefer the explicit path field
  // recorded during streaming; fall back to event.text only for legacy events.
  const files = Array.from(
    new Set(
      events
        .filter(
          (e: ActivityEvent) =>
            e.type === 'file_read' || e.type === 'file_write',
        )
        .map((e: ActivityEvent) => e.path ?? null)
        .filter((p): p is string => Boolean(p)),
    ),
  )

  if (files.length === 0) {
    return (
      <EmptyState text="No files touched yet — activity will appear during chat" />
    )
  }

  return (
    <div className="space-y-1 p-3">
      <p className="mb-2 text-xs" style={{ color: 'var(--theme-muted)' }}>
        Files touched in session ({files.length})
      </p>
      {files.map((file: string, i: number) => (
        <div
          key={i}
          className="rounded px-2 py-1 text-xs font-mono truncate"
          style={{
            color: 'var(--theme-text)',
            background: 'var(--theme-card2)',
          }}
        >
          {file}
        </div>
      ))}
    </div>
  )
}

// ── Memory Tab ────────────────────────────────────────────────────────────────

function MemoryTab() {
  const [files, setFiles] = useState<Array<{
    path: string
    name: string
  }> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/memory/list')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        if (!cancelled) {
          const list = Array.isArray(json?.files) ? json.files : []
          setFiles(
            list.map((entry: Record<string, unknown>) => ({
              path: String(entry?.path || ''),
              name: String(entry?.name || entry?.path || ''),
            })),
          )
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load memory')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <LoadingState text="Loading memory…" />
  if (error) return <ErrorState text={`Memory: ${error}`} />
  if (!files || files.length === 0)
    return <EmptyState text="No memory files available" />

  return (
    <div className="space-y-2 p-3 overflow-auto max-h-[calc(100vh-140px)]">
      <p className="mb-1 text-xs" style={{ color: 'var(--theme-muted)' }}>
        {files.length} memory files available
      </p>
      {files.map((file, index) => (
        <div
          key={`${file.path}-${index}`}
          className="rounded-lg px-3 py-2 text-xs leading-relaxed"
          style={{
            backgroundColor: 'var(--theme-card)',
            border: '1px solid var(--theme-border)',
            color: 'var(--theme-text)',
          }}
        >
          <div className="font-medium">{file.name}</div>
          <div style={{ color: 'var(--theme-muted)' }}>{file.path}</div>
        </div>
      ))}
    </div>
  )
}

// ── Skills Tab ────────────────────────────────────────────────────────────────

type SkillItem = {
  name: string
  category?: string
  description?: string
}

function SkillsTab() {
  const [skills, setSkills] = useState<Array<SkillItem>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/skills')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        if (!cancelled) {
          // Handle array of skills or object with skills property
          const list = Array.isArray(json)
            ? json
            : json.skills || json.data || []
          setSkills(list)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load skills')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <LoadingState text="Loading skills…" />
  if (error) return <ErrorState text={`Skills: ${error}`} />
  if (skills.length === 0) return <EmptyState text="No skills found" />

  // Group by category
  const grouped: Record<string, Array<SkillItem>> = {}
  for (const skill of skills) {
    const cat = skill.category || 'Uncategorized'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(skill)
  }

  return (
    <div className="space-y-3 p-3 overflow-auto max-h-[calc(100vh-140px)]">
      <p className="text-xs" style={{ color: 'var(--theme-muted)' }}>
        {skills.length} skills loaded
      </p>
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <p
            className="text-[10px] uppercase tracking-wider mb-1 font-semibold"
            style={{ color: 'var(--theme-accent)' }}
          >
            {category}
          </p>
          {items.map((skill) => (
            <button
              key={skill.name}
              type="button"
              onClick={() =>
                setExpanded(expanded === skill.name ? null : skill.name)
              }
              className="w-full text-left rounded px-2 py-1.5 text-xs mb-0.5 transition-colors"
              style={{
                background:
                  expanded === skill.name
                    ? 'var(--theme-card2)'
                    : 'transparent',
                color: 'var(--theme-text)',
              }}
            >
              <div className="flex items-center gap-2">
                <span style={{ color: 'var(--theme-accent)' }}>⚡</span>
                <span>{skill.name}</span>
              </div>
              {expanded === skill.name && skill.description && (
                <p
                  className="mt-1 pl-5 text-[11px]"
                  style={{ color: 'var(--theme-muted)' }}
                >
                  {skill.description}
                </p>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Logs Tab ──────────────────────────────────────────────────────────────────

type SessionLogPayload = {
  session_id?: string
  session_key?: string
  model?: string
  message_count?: number
  session_start?: string
  last_updated?: string
  tools?: Array<unknown>
  messages?: Array<Record<string, unknown>>
}

function extractFriendlyMessageText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) {
    if (content && typeof content === 'object') {
      const text = (content as Record<string, unknown>).text
      if (typeof text === 'string') return text
    }
    return ''
  }

  const lines: Array<string> = []
  for (const part of content as Array<Record<string, unknown>>) {
    const type = typeof part.type === 'string' ? part.type : ''
    if (type === 'text' && typeof part.text === 'string') {
      lines.push(part.text)
      continue
    }
    if (type === 'thinking' && typeof part.thinking === 'string') {
      lines.push(`[thinking] ${part.thinking}`)
      continue
    }
    if (type === 'toolCall') {
      const name = typeof part.name === 'string' ? part.name : 'tool'
      const args =
        part.arguments && typeof part.arguments === 'object'
          ? JSON.stringify(part.arguments)
          : ''
      lines.push(`[tool:${name}]${args ? ` ${args}` : ''}`)
      continue
    }
    if (typeof part.text === 'string') {
      lines.push(part.text)
    }
  }
  return lines.join('\n').trim()
}

function extractMessageTimestamp(msg: Record<string, unknown>): string {
  const value = msg.timestamp ?? msg.createdAt ?? msg.time ?? msg.ts
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value < 1_000_000_000_000 ? value * 1000 : value
    return new Date(ms).toISOString()
  }
  return ''
}

function LogsTab() {
  const resolvedSessionKey = useActivityStore((s) => s.resolvedSessionKey)
  const workspaceSessionKey = useWorkspaceStore((s) => s.chatPanelSessionKey)
  // Prefer the key resolved from streaming (guaranteed real); fall back to the
  // workspace store only if it doesn't look like a bootstrap sentinel.
  const BOOTSTRAP_KEYS = new Set(['main', 'new', ''])
  const sessionKey = resolvedSessionKey
    ?? (!BOOTSTRAP_KEYS.has(workspaceSessionKey) ? workspaceSessionKey : null)
  const [log, setLog] = useState<SessionLogPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showRaw, setShowRaw] = useState(false)

  useEffect(() => {
    if (!sessionKey) {
      setLoading(false)
      return
    }    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(
      `/api/semantier-proxy/api/sessions/${encodeURIComponent(sessionKey)}/log`,
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<SessionLogPayload>
      })
      .then((json) => {
        if (!cancelled) {
          setLog(json)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load session log',
          )
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [sessionKey, refreshKey])

  const messages = Array.isArray(log?.messages) ? log.messages : []
  const sessionKeyLabel = String(
    log?.session_key ?? log?.session_id ?? sessionKey ?? '',
  )

  return (
    <div className="space-y-2 p-3 overflow-auto max-h-[calc(100vh-140px)]">
      {loading && <LoadingState text="Loading session log…" />}
      {!loading && error && <ErrorState text={`Session log: ${error}`} />}
      {!loading && !error && !log && !sessionKey && (
        <EmptyState text="Start a conversation to see session logs" />
      )}
      {!loading && !error && !log && sessionKey && (
        <EmptyState text="No session log available" />
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowRaw((prev) => !prev)}
          className="flex-1 rounded px-2 py-1 text-xs hover:opacity-80 transition-opacity"
          style={{
            background: 'var(--theme-card2)',
            color: 'var(--theme-muted)',
            border: '1px solid var(--theme-border)',
          }}
          disabled={loading || !log}
        >
          {showRaw ? 'Friendly View' : 'Raw View'}
        </button>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="flex-1 rounded px-2 py-1 text-xs hover:opacity-80 transition-opacity"
          style={{
            background: 'var(--theme-card2)',
            color: 'var(--theme-muted)',
            border: '1px solid var(--theme-border)',
          }}
          disabled={loading}
        >
          ↺ Refresh
        </button>
      </div>

      {sessionKeyLabel ? (
        <Link
          to="/session-events"
          search={{
            session: sessionKeyLabel,
            friendlyId: sessionKeyLabel,
          }}
          className="block rounded px-2 py-1 text-xs text-center hover:opacity-80 transition-opacity"
          style={{
            background: 'var(--theme-card2)',
            color: 'var(--theme-accent)',
            border: '1px solid var(--theme-border)',
          }}
        >
          Open Session Event Review
        </Link>
      ) : (
        <div
          className="block rounded px-2 py-1 text-xs text-center"
          style={{
            background: 'var(--theme-card2)',
            color: 'var(--theme-muted)',
            border: '1px solid var(--theme-border)',
            opacity: 0.6,
          }}
          aria-disabled="true"
        >
          Open Session Event Review
        </div>
      )}

      {!loading && log && (
        <>
          {showRaw ? (
            <pre
              className="max-h-[calc(100vh-230px)] overflow-auto rounded px-2 py-2 text-[11px]"
              style={{
                background: 'var(--theme-card)',
                color: 'var(--theme-text)',
                border: '1px solid var(--theme-border)',
              }}
            >
              {JSON.stringify(log, null, 2)}
            </pre>
          ) : (
            <>
              <div
                className="rounded-lg px-3 py-2 text-xs leading-relaxed"
                style={{
                  backgroundColor: 'var(--theme-card)',
                  border: '1px solid var(--theme-border)',
                  color: 'var(--theme-text)',
                }}
              >
                <p
                  className="text-[10px] uppercase tracking-wider font-semibold mb-1"
                  style={{ color: 'var(--theme-accent)' }}
                >
                  Session
                </p>
                <div>
                  <span style={{ color: 'var(--theme-muted)' }}>Key: </span>
                  <span className="font-mono break-all">{sessionKeyLabel}</span>
                </div>
                {log.model && (
                  <div>
                    <span style={{ color: 'var(--theme-muted)' }}>Model: </span>
                    {log.model}
                  </div>
                )}
                <div>
                  <span style={{ color: 'var(--theme-muted)' }}>Messages: </span>
                  {messages.length}
                </div>
                {Array.isArray(log.tools) && log.tools.length > 0 && (
                  <div>
                    <span style={{ color: 'var(--theme-muted)' }}>Tools: </span>
                    {log.tools.length} registered
                  </div>
                )}
                {log.session_start && (
                  <div>
                    <span style={{ color: 'var(--theme-muted)' }}>Started: </span>
                    {log.session_start}
                  </div>
                )}
                {log.last_updated && (
                  <div>
                    <span style={{ color: 'var(--theme-muted)' }}>Updated: </span>
                    {log.last_updated}
                  </div>
                )}
              </div>

              {messages.length > 0 ? (
                <div className="space-y-1.5">
                  <p
                    className="text-[10px] uppercase tracking-wider font-semibold"
                    style={{ color: 'var(--theme-accent)' }}
                  >
                    Full Messages ({messages.length})
                  </p>
                  {messages.map((msg, i) => {
                    const role = String(msg.role ?? 'unknown')
                    const timestamp = extractMessageTimestamp(msg)
                    const text = extractFriendlyMessageText(msg.content)
                    const fallbackJson = JSON.stringify(msg, null, 2)

                    return (
                      <div
                        key={i}
                        className="rounded px-2 py-1.5 text-xs"
                        style={{ background: 'var(--theme-card2)' }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="font-semibold uppercase"
                            style={{
                              color:
                                role === 'user'
                                  ? 'var(--theme-accent)'
                                  : 'var(--theme-text)',
                            }}
                          >
                            {role}
                          </span>
                          <span
                            className="text-[10px] ml-auto"
                            style={{ color: 'var(--theme-muted)' }}
                          >
                            #{i + 1}
                          </span>
                        </div>
                        {timestamp ? (
                          <div
                            className="text-[10px] mt-0.5"
                            style={{ color: 'var(--theme-muted)' }}
                          >
                            {timestamp}
                          </div>
                        ) : null}
                        <pre
                          className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded px-2 py-1 text-[11px]"
                          style={{
                            background: 'var(--theme-card)',
                            border: '1px solid var(--theme-border)',
                            color: 'var(--theme-text)',
                          }}
                        >
                          {text || fallbackJson}
                        </pre>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyState text="No messages recorded in this session log" />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function InspectorPanel() {
  const isOpen = useInspectorStore((s) => s.isOpen)
  const memoryAvailable = useFeatureAvailable('memory')
  const skillsAvailable = useFeatureAvailable('skills')
  const [activeTab, setActiveTab] = useState<TabId>('activity')

  useEffect(() => {
    if (activeTab === 'memory' && !memoryAvailable) {
      setActiveTab('activity')
    }
    if (activeTab === 'skills' && !skillsAvailable) {
      setActiveTab('activity')
    }
  }, [activeTab, memoryAvailable, skillsAvailable])

  return (
    <div
      className={cn(
        'fixed right-0 top-0 h-full z-40 flex flex-col overflow-hidden transition-[width] duration-200',
        isOpen ? 'w-[350px]' : 'w-0',
      )}
      style={{
        background: 'var(--theme-panel)',
        borderLeft: '2px solid var(--theme-border)',
        boxShadow: '-4px 0 16px rgba(0, 0, 0, 0.2)',
      }}
    >
      {isOpen && (
        <>
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ borderBottom: '1px solid var(--theme-border)' }}
          >
            <span
              className="text-sm font-semibold"
              style={{ color: 'var(--theme-text)' }}
            >
              Inspector
            </span>
            <button
              type="button"
              onClick={() => useInspectorStore.getState().setOpen(false)}
              className="rounded p-1 text-xs hover:opacity-70 transition-opacity"
              style={{ color: 'var(--theme-muted)' }}
              aria-label="Close inspector"
            >
              ✕
            </button>
          </div>

          {/* Tab bar */}
          <div
            className="flex shrink-0 overflow-x-auto"
            style={{ borderBottom: '1px solid var(--theme-border)' }}
          >
            {TABS.map((tab) =>
              (() => {
                const available =
                  tab.feature === 'memory'
                    ? memoryAvailable
                    : tab.feature === 'skills'
                      ? skillsAvailable
                      : true

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      if (available) setActiveTab(tab.id)
                    }}
                    disabled={!available}
                    className={cn(
                      'px-3 py-2 text-xs font-medium shrink-0 transition-colors',
                      activeTab === tab.id ? 'border-b-2' : 'hover:opacity-80',
                      !available && 'cursor-not-allowed opacity-50',
                    )}
                    style={{
                      color:
                        activeTab === tab.id
                          ? 'var(--theme-accent)'
                          : 'var(--theme-muted)',
                      borderBottomColor:
                        activeTab === tab.id
                          ? 'var(--theme-accent)'
                          : 'transparent',
                    }}
                    title={
                      !available && tab.feature
                        ? getUnavailableReason(tab.feature)
                        : undefined
                    }
                  >
                    <span>{tab.label}</span>
                    {!available ? (
                      <span className="ml-1 rounded-full border border-amber-300 bg-amber-100 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                        Gate
                      </span>
                    ) : null}
                  </button>
                )
              })(),
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto">
            {activeTab === 'activity' && <ActivityTab />}
            {activeTab === 'artifacts' && <ArtifactsTab />}
            {activeTab === 'files' && <FilesTab />}
            {activeTab === 'memory' && <MemoryTab />}
            {activeTab === 'skills' && <SkillsTab />}
            {activeTab === 'logs' && <LogsTab />}
          </div>
        </>
      )}
    </div>
  )
}

// ── Toggle Button ─────────────────────────────────────────────────────────────

export function InspectorToggleButton({ className }: { className?: string }) {
  const toggle = useInspectorStore((s) => s.toggle)
  const isOpen = useInspectorStore((s) => s.isOpen)

  return (
    <button
      type="button"
      onClick={toggle}
      title={isOpen ? 'Close inspector' : 'Open inspector'}
      className={cn(
        'flex items-center justify-center rounded-lg px-2 py-1.5 text-xs transition-colors',
        isOpen ? 'opacity-100' : 'opacity-60 hover:opacity-90',
        className,
      )}
      style={{
        background: isOpen ? 'var(--theme-card2)' : undefined,
        color: 'var(--theme-text)',
        border: '1px solid var(--theme-border)',
      }}
      aria-label="Toggle inspector panel"
    >
      <span className="font-mono text-[11px]">{'{ }'}</span>
    </button>
  )
}
