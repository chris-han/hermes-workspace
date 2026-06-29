import { useEffect, useRef, useState } from 'react'
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

// ── Activity Tab ──────────────────────────────────────────────────────────────

function ActivityTab() {
  const events = useActivityStore((s) => s.events)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [events.length])

  if (events.length === 0) {
    return <EmptyState text="No activity yet — start a conversation" />
  }

  return (
    <div
      ref={scrollRef}
      className="space-y-1 p-3 overflow-auto max-h-[calc(100vh-140px)]"
    >
      {events.map((event: ActivityEvent, i: number) => (
        <div
          key={i}
          className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs"
          style={{ background: 'var(--theme-card2)' }}
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
  const recentMessages = messages.slice(-8)

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

      {!loading && log && (
        <>
          {/* Session metadata */}
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
              <span className="font-mono break-all">
                {String(log.session_key ?? log.session_id ?? sessionKey)}
              </span>
            </div>
            {log.model && (
              <div>
                <span style={{ color: 'var(--theme-muted)' }}>Model: </span>
                {log.model}
              </div>
            )}
            {typeof log.message_count === 'number' && (
              <div>
                <span style={{ color: 'var(--theme-muted)' }}>Messages: </span>
                {log.message_count}
              </div>
            )}
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

          {/* Recent messages */}
          {recentMessages.length > 0 && (
            <div className="space-y-1">
              <p
                className="text-[10px] uppercase tracking-wider font-semibold"
                style={{ color: 'var(--theme-accent)' }}
              >
                Recent Messages ({recentMessages.length} of {messages.length})
              </p>
              {recentMessages.map((msg, i) => {
                const role = String(msg.role ?? 'unknown')
                const content = msg.content
                let preview = ''
                if (typeof content === 'string') {
                  preview = content.slice(0, 150)
                } else if (Array.isArray(content)) {
                  const part = (
                    content as Array<Record<string, unknown>>
                  ).find((p) => p?.type === 'text' || typeof p?.text === 'string')
                  preview =
                    typeof part?.text === 'string' ? part.text.slice(0, 150) : ''
                }
                return (
                  <div
                    key={i}
                    className="rounded px-2 py-1.5 text-xs"
                    style={{ background: 'var(--theme-card2)' }}
                  >
                    <span
                      className="font-semibold"
                      style={{
                        color:
                          role === 'user'
                            ? 'var(--theme-accent)'
                            : 'var(--theme-text)',
                      }}
                    >
                      {role}
                    </span>
                    {preview && (
                      <p
                        className="mt-0.5 truncate"
                        style={{ color: 'var(--theme-muted)' }}
                      >
                        {preview}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      <button
        type="button"
        onClick={() => setRefreshKey((k) => k + 1)}
        className="w-full rounded px-2 py-1 text-xs hover:opacity-80 transition-opacity"
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
