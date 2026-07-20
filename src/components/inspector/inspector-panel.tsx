import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { create } from 'zustand'
import { useActivityStore } from './activity-store'
import type { ActivityEvent } from './activity-store'
import { getUnavailableReason } from '@/lib/feature-gates'
import { useFeatureAvailable } from '@/hooks/use-feature-available'
import { useSettingsStore } from '@/hooks/use-settings'
import { cn } from '@/lib/utils'

// ── Tab types ─────────────────────────────────────────────────────────────────

type TabId = 'activity' | 'artifacts' | 'memory' | 'skills' | 'logs'

type InspectorStore = {
  isOpen: boolean
  activeTab: TabId
  highlightedArtifact: string | null
  clearHighlightedArtifact: () => void
  openArtifact: (artifactRef: string) => void
  setActiveTab: (tab: TabId) => void
  setOpen: (open: boolean) => void
  toggle: () => void
}

export const useInspectorStore = create<InspectorStore>((set) => ({
  isOpen: false,
  activeTab: 'activity',
  highlightedArtifact: null,
  clearHighlightedArtifact: () => set({ highlightedArtifact: null }),
  openArtifact: (artifactRef) =>
    set({
      activeTab: 'artifacts',
      highlightedArtifact: artifactRef,
      isOpen: true,
    }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setOpen: (open) => set({ isOpen: open }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}))

const TABS: Array<{
  id: TabId
  feature?: 'memory' | 'skills'
}> = [
  { id: 'activity' },
  { id: 'artifacts' },
  { id: 'memory', feature: 'memory' },
  { id: 'skills', feature: 'skills' },
  { id: 'logs' },
]

function useInspectorCopy() {
  const locale = useSettingsStore((state) => state.settings.locale)
  return getInspectorCopy(locale)
}

export function getInspectorCopy(locale: string) {
  const isChinese = locale === 'zh'

  return {
    isChinese,
    title: isChinese ? '检查器' : 'Inspector',
    open: isChinese ? '打开检查器' : 'Open inspector',
    close: isChinese ? '关闭检查器' : 'Close inspector',
    gate: isChinese ? '门禁' : 'Gate',
    tabs: {
      activity: isChinese ? '活动' : 'Activity',
      artifacts: isChinese ? '制品' : 'Artifacts',
      memory: isChinese ? '记忆' : 'Memory',
      skills: isChinese ? '技能' : 'Skills',
      logs: isChinese ? '日志' : 'Logs',
    },
      loading: {
        artifacts: isChinese ? '正在加载制品…' : 'Loading artifacts…',
        activity: isChinese ? '正在加载活动…' : 'Loading activity...',
        memory: isChinese ? '正在加载记忆…' : 'Loading memory…',
        skills: isChinese ? '正在加载技能…' : 'Loading skills…',
        sessionLog: isChinese ? '正在加载会话日志…' : 'Loading session log…',
      },
      empty: {
        openSessionToSeeArtifacts: isChinese
          ? '打开一个会话以查看制品'
          : 'Open a session to see artifacts',
        noArtifactsRecorded: isChinese
          ? '此会话没有记录制品'
          : 'No artifacts recorded for this session',
        openSessionToSeeActivity: isChinese
          ? '打开一个会话以查看活动'
          : 'Open a session to see activity',
        noEventsMatchFilter: isChinese
          ? '此会话没有匹配此筛选条件的事件'
          : 'No events match this filter for this session',
        noMemorySnapshotInjected: isChinese
          ? '此会话没有注入记忆快照'
          : 'No memory snapshot was injected for this session',
        noSessionSelected: isChinese ? '未选择会话' : 'No session selected',
        openSessionToSeeSessionAttached: isChinese
          ? '打开一个会话以查看附加的技能、插件和工具'
          : 'Open a session to see session-attached skills, plugins, and tools',
        noSessionAttached: isChinese
          ? '未找到附加到会话的技能、插件或工具'
          : 'No session-attached skills, plugins, or tools found',
        noSessionLogAvailable: isChinese
          ? '没有可用的会话日志'
          : 'No session log available',
        startConversationToSeeSessionLogs: isChinese
          ? '开始对话以查看会话日志'
          : 'Start a conversation to see session logs',
        noMessagesRecordedInThisSessionLog: isChinese
          ? '此会话日志中未记录消息'
          : 'No messages recorded in this session log',
      },
      errors: {
        artifacts: isChinese ? '制品' : 'Artifacts',
        activity: isChinese ? '活动' : 'Activity',
        memory: isChinese ? '记忆' : 'Memory',
        skills: isChinese ? '技能' : 'Skills',
        sessionLog: isChinese ? '会话日志' : 'Session log',
      },
      buttons: {
        friendly: isChinese ? '友好视图' : 'Friendly View',
        raw: isChinese ? '原始视图' : 'Raw View',
        refresh: isChinese ? '↺ 刷新' : '↺ Refresh',
        openReview: isChinese ? '打开会话事件审阅' : 'Open Session Event Review',
        rawData: isChinese ? '原始' : 'Raw',
      },
      sections: {
        session: isChinese ? '会话' : 'Session',
        fullMessages: isChinese ? '完整消息' : 'Full Messages',
        loadedSkills: isChinese ? '已加载技能' : 'Loaded Skills',
        plugins: isChinese ? '插件' : 'Plugins',
        tools: isChinese ? '工具' : 'Tools',
        memorySnapshot: isChinese ? '记忆快照' : 'memory snapshot',
      },
      labels: {
        key: isChinese ? '键：' : 'Key: ',
        model: isChinese ? '模型：' : 'Model: ',
        messages: isChinese ? '消息：' : 'Messages: ',
        tools: isChinese ? '工具：' : 'Tools: ',
        started: isChinese ? '开始：' : 'Started: ',
        updated: isChinese ? '更新：' : 'Updated: ',
        tool: isChinese ? '工具' : 'tool',
        phase: isChinese ? '阶段' : 'phase',
        callId: isChinese ? '调用 ID' : 'call id',
        runId: isChinese ? '运行 ID' : 'run id',
        path: isChinese ? '路径' : 'path',
        preview: isChinese ? '预览' : 'preview',
        args: isChinese ? '参数' : 'args',
        result: isChinese ? '结果' : 'result',
        status: isChinese ? '状态' : 'status',
        session: isChinese ? '会话' : 'session',
        artifact: isChinese ? '制品' : 'artifact',
        kind: isChinese ? '类型' : 'kind',
        error: isChinese ? '错误' : 'error',
        agent: isChinese ? '代理' : 'agent',
        action: isChinese ? '动作' : 'action',
        approvalId: isChinese ? '审批 ID' : 'approval id',
        context: isChinese ? '上下文' : 'context',
        type: isChinese ? '类型' : 'type',
        text: isChinese ? '文本' : 'text',
        time: isChinese ? '时间' : 'time',
        raw: isChinese ? '原始' : 'raw',
        event: isChinese ? '事件' : 'event',
        sessionTools: isChinese ? '会话工具' : 'Session tools',
        toolsets: isChinese ? '工具集' : 'Toolsets',
      },
      filters: {
        allActivity: isChinese ? '全部活动' : 'All Activity',
        allDecisions: isChinese ? '全部决策' : 'All Decisions',
        agentDecisions: isChinese ? '代理决策' : 'Agent Decisions',
        userDecisions: isChinese ? '用户决策' : 'User Decisions',
      },
      states: {
        disabled: isChinese ? '已禁用' : 'disabled',
        unavailable: isChinese ? '当前环境不可用' : 'Unavailable in current environment',
        notConfigured: isChinese ? '未配置' : 'Not configured',
        uncategorized: isChinese ? '未分类' : 'Uncategorized',
        registered: isChinese ? '已注册' : 'registered',
        started: isChinese ? '已开始' : 'started',
        requested: isChinese ? '已请求' : 'requested',
        complete: isChinese ? '已完成' : 'complete',
        friendly: isChinese ? '友好' : 'Friendly',
        raw: isChinese ? '原始' : 'Raw',
      },
      counts: {
        artifactsEmitted: (count: number) =>
          isChinese
            ? `代理输出的制品 ${count} 项`
            : `${count} artifacts emitted by the agent`,
        memorySnapshotsUsed: (count: number) =>
          isChinese
            ? `本会话使用了 ${count} 个记忆快照`
            : `${count} memory snapshot${count === 1 ? '' : 's'} used in this session`,
        loadedSkills: (count: number) =>
          isChinese ? `已加载技能（${count}）` : `Loaded Skills (${count})`,
        plugins: (count: number) =>
          isChinese ? `插件（${count}）` : `Plugins (${count})`,
        tools: (sessionTools: number, toolsets: number) =>
          isChinese
            ? `工具（${sessionTools > 0 ? `${sessionTools} 个会话内` : `${toolsets} 个工具集`}）`
            : `Tools (${sessionTools > 0 ? `${sessionTools} in session` : `${toolsets} toolsets`})`,
        fullMessages: (count: number) =>
          isChinese ? `完整消息（${count}）` : `Full Messages (${count})`,
    },
  }
}

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

function getActivityEventSessionKey(event: ActivityEvent): string | null {
  const value = event.details?.sessionKey
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

type SessionActivityPayload = {
  events?: Array<Record<string, unknown>>
}

function activityEventKey(event: ActivityEvent): string {
  const details = event.details ?? {}
  const toolCallId =
    typeof details.toolCallId === 'string' ? details.toolCallId : ''
  const phase = typeof details.phase === 'string' ? details.phase : ''
  return [
    event.type,
    event.time,
    event.text,
    event.path ?? '',
    toolCallId,
    phase,
  ].join('|')
}

function normalizeSessionActivityPayload(
  payload: SessionActivityPayload | null,
): Array<ActivityEvent> {
  const events = Array.isArray(payload?.events) ? payload.events : []
  return events
    .map((entry) => {
      const record = readRecord(entry)
      const details = readRecord(record.details)
      return {
        type: readString(record.type) || 'event',
        time: readString(record.time),
        text: readString(record.text),
        path: readString(record.path) || undefined,
        details,
      }
    })
    .filter((event) => event.type && event.text)
}

type PersistedArtifact = {
  artifactId: string
  filename: string
  kind: string
  mediaType: string
  path: string
  rawUrl: string
  relativePath: string
  sha256: string
  sizeBytes: number | null
  timestamp: number | string | null
}

type SessionTrajectoryPayload = {
  session_id?: string
  sessionKey?: string
  trajectory?: {
    artifacts?: Array<Record<string, unknown>>
    lifecycleEvents?: Array<Record<string, unknown>>
  }
}

type ArtifactEntry =
  | { kind: 'persisted'; artifact: PersistedArtifact }
  | { kind: 'activity'; artifact: ActivityEvent }

const ARTIFACT_REFRESH_INTERVAL_MS = 2500

export function persistedArtifactDisplayTitle(
  artifact: Pick<PersistedArtifact, 'relativePath' | 'filename' | 'path'>,
): string {
  return artifact.relativePath || artifact.filename || artifact.path
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function formatArtifactTime(value: number | string | null): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toLocaleTimeString()
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? value : new Date(parsed).toLocaleTimeString()
  }
  return ''
}

function artifactKeys(artifact: PersistedArtifact): Array<string> {
  return [
    artifact.artifactId,
    artifact.path,
    artifact.relativePath,
    artifact.filename,
    artifact.rawUrl,
  ].filter(Boolean)
}

function normalizeArtifactRef(value: string): string {
  let normalized = value.trim().replace(/\\/g, '/')
  if (normalized.startsWith('#artifact=')) {
    normalized = normalized.slice('#artifact='.length)
  }
  try {
    normalized = decodeURIComponent(normalized)
  } catch {
    // Keep the original value when it is not URI encoded.
  }
  normalized = normalized.replace(/\/raw$/, '')
  const marker = '/artifacts/'
  const markerIndex = normalized.indexOf(marker)
  if (markerIndex >= 0) {
    normalized = normalized.slice(markerIndex + marker.length)
  }
  return normalized.replace(/^\/+/, '')
}

export function artifactMatchesHighlight(
  artifact: PersistedArtifact,
  highlight: string | null,
): boolean {
  if (!highlight) return false
  const target = normalizeArtifactRef(highlight)
  if (!target) return false
  return artifactKeys(artifact).some((key) => {
    const normalizedKey = normalizeArtifactRef(key)
    return normalizedKey === target || normalizedKey.endsWith(`/${target}`)
  })
}

function artifactRawHref(rawUrl: string): string {
  return rawUrl.startsWith('/api/semantier-proxy/')
    ? rawUrl
    : `/api/semantier-proxy${rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`}`
}

function artifactRelativePath(artifact: Record<string, unknown>): string {
  const relativePath = readString(artifact.relative_path)
  if (relativePath) return relativePath
  const path = readString(artifact.path)
  const marker = '/artifacts/'
  const markerIndex = path.indexOf(marker)
  return markerIndex >= 0 ? path.slice(markerIndex + marker.length) : ''
}

function fallbackArtifactRawUrl(
  artifact: Record<string, unknown>,
  sessionId: string,
): string {
  const relativePath = artifactRelativePath(artifact)
  if (!sessionId || !relativePath) return ''
  return `/sessions/${encodeURIComponent(sessionId)}/artifacts/${relativePath
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}/raw`
}

function normalizePersistedArtifacts(
  payload: SessionTrajectoryPayload | null,
): Array<PersistedArtifact> {
  const trajectory = payload?.trajectory
  const sessionId = readString(payload?.session_id) || readString(payload?.sessionKey)
  const artifacts = Array.isArray(trajectory?.artifacts)
    ? trajectory.artifacts
    : []
  const lifecycleEvents = Array.isArray(trajectory?.lifecycleEvents)
    ? trajectory.lifecycleEvents
    : []
  const timestampByKey = new Map<string, number | string>()
  for (const event of lifecycleEvents) {
    const artifact =
      event.artifact && typeof event.artifact === 'object'
        ? (event.artifact as Record<string, unknown>)
        : null
    if (!artifact) continue
    const key =
      readString(artifact.artifact_id) ||
      readString(artifact.path) ||
      readString(artifact.filename)
    if (!key) continue
    const timestamp = event.timestamp
    if (typeof timestamp === 'number' || typeof timestamp === 'string') {
      timestampByKey.set(key, timestamp)
    }
  }

  const normalized = artifacts
    .map((artifact) => {
      const key =
        readString(artifact.artifact_id) ||
        readString(artifact.path) ||
        readString(artifact.filename)
      return {
        artifactId: readString(artifact.artifact_id),
        filename: readString(artifact.filename),
        kind: readString(artifact.kind),
        mediaType: readString(artifact.media_type),
        path: readString(artifact.path),
        rawUrl:
          readString(artifact.raw_url) ||
          fallbackArtifactRawUrl(artifact, sessionId),
        relativePath: artifactRelativePath(artifact),
        sha256: readString(artifact.sha256),
        sizeBytes: readNumber(artifact.size_bytes),
        timestamp: key ? (timestampByKey.get(key) ?? null) : null,
      }
    })
    .filter((artifact) => artifact.filename || artifact.path)
  const seen = new Set<string>()
  return normalized.filter((artifact) => {
    const keys = artifactKeys(artifact)
    if (keys.some((key) => seen.has(key))) return false
    for (const key of keys) seen.add(key)
    return true
  })
}

function ArtifactsTab({ sessionKey }: { sessionKey: string | null }) {
  const copy = useInspectorCopy()
  const events = useActivityStore((s) => s.events)
  const highlightedArtifact = useInspectorStore((s) => s.highlightedArtifact)
  const highlightedArtifactRef = useRef<HTMLDivElement | null>(null)
  const [persistedArtifacts, setPersistedArtifacts] = useState<
    Array<PersistedArtifact>
  >([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activityArtifacts = useMemo(
    () =>
      events.filter(
        (event) =>
          event.type === 'artifact' &&
          sessionKey &&
          getActivityEventSessionKey(event) === sessionKey,
      ),
    [events, sessionKey],
  )

  useEffect(() => {
    if (!sessionKey) {
      setPersistedArtifacts([])
      setError(null)
      setLoading(false)
      return
    }
    const currentSessionKey = sessionKey
    let cancelled = false
    async function loadArtifacts(showLoading: boolean) {
      if (showLoading) setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/semantier-proxy/sessions/${encodeURIComponent(currentSessionKey)}/trajectory`,
        )
        if (res.status === 404) {
          if (!cancelled) {
            setPersistedArtifacts([])
            setLoading(false)
          }
          return null
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as SessionTrajectoryPayload
        if (!cancelled) {
          setPersistedArtifacts(normalizePersistedArtifacts(json))
          setLoading(false)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load artifacts',
          )
          setPersistedArtifacts([])
          setLoading(false)
        }
      }
      return null
    }
    void loadArtifacts(true)
    const interval = window.setInterval(() => {
      void loadArtifacts(false)
    }, ARTIFACT_REFRESH_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [sessionKey])

  const artifacts = useMemo<Array<ArtifactEntry>>(() => {
    const seen = new Set<string>()
    const persisted: Array<ArtifactEntry> = persistedArtifacts.map(
      (artifact) => {
        for (const key of artifactKeys(artifact)) seen.add(key)
        return { kind: 'persisted' as const, artifact }
      },
    )
    const activity = activityArtifacts
      .filter((artifact) => {
        const path =
          typeof artifact.details?.path === 'string'
            ? artifact.details.path
            : ''
        const key = path || artifact.text
        if (key && seen.has(key)) return false
        if (key) seen.add(key)
        return true
      })
      .map((artifact): ArtifactEntry => ({ kind: 'activity', artifact }))
    return [...persisted, ...activity]
  }, [activityArtifacts, persistedArtifacts])

  useEffect(() => {
    if (!highlightedArtifact || !highlightedArtifactRef.current) return
    highlightedArtifactRef.current.scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    })
  }, [artifacts, highlightedArtifact])

  if (!sessionKey) {
    return <EmptyState text={copy.empty.openSessionToSeeArtifacts} />
  }

  if (loading && artifacts.length === 0) {
    return <LoadingState text={copy.loading.artifacts} />
  }

  if (error && artifacts.length === 0) {
    return <ErrorState text={`${copy.errors.artifacts}: ${error}`} />
  }

  if (!loading && artifacts.length === 0) {
    return <EmptyState text={copy.empty.noArtifactsRecorded} />
  }

  return (
    <div className="space-y-2 p-3 overflow-auto max-h-[calc(100vh-140px)]">
      <p className="text-xs" style={{ color: 'var(--theme-muted)' }}>
        {copy.counts.artifactsEmitted(artifacts.length)}
      </p>
      {error ? <ErrorState text={`${copy.errors.artifacts}: ${error}`} /> : null}
      {artifacts.map((entry, index) => {
        const isPersisted = entry.kind === 'persisted'
        const title = isPersisted
          ? persistedArtifactDisplayTitle(entry.artifact)
          : entry.artifact.text
        const time = isPersisted
          ? formatArtifactTime(entry.artifact.timestamp)
          : entry.artifact.time
        const subtitle = isPersisted
          ? entry.artifact.kind ||
            entry.artifact.mediaType ||
            entry.artifact.sha256
          : typeof entry.artifact.details?.path === 'string'
            ? entry.artifact.details.path
            : ''
        const size =
          isPersisted && entry.artifact.sizeBytes !== null
            ? `${entry.artifact.sizeBytes.toLocaleString()} bytes`
            : ''
        const persistedMeta = isPersisted
          ? [entry.artifact.path, size, time].filter(Boolean).join(' · ')
          : ''
        const isHighlighted =
          isPersisted &&
          artifactMatchesHighlight(entry.artifact, highlightedArtifact)
        return (
          <div
            key={`${entry.kind}-${title}-${index}`}
            ref={isHighlighted ? highlightedArtifactRef : undefined}
            className={cn(
              'rounded-lg px-3 py-2 text-xs leading-relaxed transition-colors',
              isHighlighted && 'ring-2',
            )}
            style={{
              backgroundColor: 'var(--theme-card)',
              border: `1px solid ${
                isHighlighted ? 'var(--theme-accent)' : 'var(--theme-border)'
              }`,
              boxShadow: isHighlighted
                ? '0 0 0 2px color-mix(in srgb, var(--theme-accent) 18%, transparent)'
                : undefined,
              color: 'var(--theme-text)',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium break-all">{title}</span>
              <div className="flex shrink-0 items-center gap-2">
                {isPersisted && entry.artifact.rawUrl ? (
                  <a
                    href={artifactRawHref(entry.artifact.rawUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded border px-2 py-0.5 font-medium transition-opacity hover:opacity-80"
                    style={{
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-accent)',
                    }}
                  >
                    {copy.buttons.rawData}
                  </a>
                ) : null}
                {entry.kind === 'activity' && time ? (
                  <span style={{ color: 'var(--theme-accent)' }}>{time}</span>
                ) : null}
              </div>
            </div>
            {subtitle ? (
              <div
                className="mt-1 break-all"
                style={{ color: 'var(--theme-muted)' }}
              >
                {subtitle}
              </div>
            ) : null}
            {entry.kind === 'persisted' && persistedMeta ? (
              <div
                className="mt-1 break-all"
                style={{ color: 'var(--theme-muted)' }}
              >
                {persistedMeta}
              </div>
            ) : null}
          </div>
        )
      })}
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

function JsonDetailBlock({ label, value }: { label: string; value: unknown }) {
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
  const copy = useInspectorCopy()
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
        <DetailRow label={copy.labels.tool} value={toolName} />
        <DetailRow label={copy.labels.phase} value={phase} />
        <DetailRow label={copy.labels.callId} value={toolCallId} />
        <DetailRow label={copy.labels.runId} value={runId} />
        <DetailRow label={copy.labels.path} value={event.path ?? null} />
        <DetailRow label={copy.labels.preview} value={preview} />
        <JsonDetailBlock label={copy.labels.args} value={details.args} />
        <JsonDetailBlock label={copy.labels.result} value={details.result} />
      </div>
    )
  }

  if (eventType === 'started') {
    const sessionKey =
      typeof details.sessionKey === 'string' ? details.sessionKey : null
    const runId = typeof details.runId === 'string' ? details.runId : null
    return (
      <div className="space-y-2">
        <DetailRow label={copy.labels.status} value={copy.states.started} />
        <DetailRow label={copy.labels.session} value={sessionKey} />
        <DetailRow label={copy.labels.runId} value={runId} />
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
        <DetailRow label={copy.labels.artifact} value={title} />
        <DetailRow label={copy.labels.kind} value={kind} />
        <DetailRow label={copy.labels.path} value={path} />
        <DetailRow label={copy.labels.runId} value={runId} />
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
        <DetailRow label={copy.labels.status} value={state || copy.states.complete} />
        <DetailRow label={copy.labels.runId} value={runId} />
        <DetailRow label={copy.labels.error} value={errorMessage} />
      </div>
    )
  }

  if (eventType === 'approval') {
    const phase = typeof details.phase === 'string' ? details.phase : null
    const agentName =
      typeof details.agentName === 'string' ? details.agentName : null
    const action = typeof details.action === 'string' ? details.action : event.text
    const approvalId =
      typeof details.approvalId === 'string' ? details.approvalId : null
    const sessionKey =
      typeof details.sessionKey === 'string' ? details.sessionKey : null
    return (
      <div className="space-y-2">
        <DetailRow label={copy.labels.status} value={phase || copy.states.requested} />
        <DetailRow label={copy.labels.agent} value={agentName} />
        <DetailRow label={copy.labels.action} value={action} />
        <DetailRow label={copy.labels.approvalId} value={approvalId} />
        <DetailRow label={copy.labels.session} value={sessionKey} />
        <JsonDetailBlock label={copy.labels.context} value={details.context} />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <DetailRow label={copy.labels.type} value={event.type} />
      <DetailRow label={copy.labels.text} value={event.text} />
      <DetailRow label={copy.labels.path} value={event.path ?? null} />
      <DetailRow label={copy.labels.time} value={event.time} />
      {hasStructuredDetails ? (
        <JsonDetailBlock label={copy.labels.raw} value={details} />
      ) : null}
    </div>
  )
}

function ActivityExpandedPanel({ event }: { event: ActivityEvent }) {
  const copy = useInspectorCopy()
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
          {showRaw ? copy.states.friendly : copy.states.raw}
        </button>
      </div>
      {showRaw ? (
        <JsonDetailBlock label={copy.labels.event} value={event.details ?? fallbackPayload} />
      ) : (
        <ActivityExpandedDetails event={event} />
      )}
    </div>
  )
}

// ── Activity Tab ──────────────────────────────────────────────────────────────

function ActivityTab({ sessionKey }: { sessionKey: string | null }) {
  const copy = useInspectorCopy()
  const events = useActivityStore((s) => s.events)
  const [persistedEvents, setPersistedEvents] = useState<Array<ActivityEvent>>(
    [],
  )
  const [activityFilter, setActivityFilter] = useState<
    'all_activity' | 'all_decisions' | 'agent_decisions' | 'user_decisions'
  >('all_activity')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const filteredEvents = useMemo(() => {
    if (!sessionKey) return []
    const merged: Array<ActivityEvent> = []
    const seen = new Set<string>()
    for (const event of [
      ...persistedEvents,
      ...events.filter(
        (item) => getActivityEventSessionKey(item) === sessionKey,
      ),
    ]) {
      const key = activityEventKey(event)
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(event)
    }
    return merged
  }, [events, persistedEvents, sessionKey])

  const visibleEvents = useMemo(() => {
    function isAgentDecision(event: ActivityEvent): boolean {
      const details = event.details ?? {}
      const detailsEvent =
        typeof details.event === 'string' ? details.event : undefined
      const phase = typeof details.phase === 'string' ? details.phase : undefined
      return (
        (detailsEvent === 'tool' && phase === 'complete') ||
        detailsEvent === 'done' ||
        event.type === 'assistant_complete'
      )
    }

    function isUserDecision(event: ActivityEvent): boolean {
      const details = event.details ?? {}
      const detailsEvent =
        typeof details.event === 'string' ? details.event : undefined
      return detailsEvent === 'approval' || event.type === 'user_decision'
    }

    if (activityFilter === 'all_activity') return filteredEvents
    if (activityFilter === 'agent_decisions') {
      return filteredEvents.filter((event) => isAgentDecision(event))
    }
    if (activityFilter === 'user_decisions') {
      return filteredEvents.filter((event) => isUserDecision(event))
    }
    return filteredEvents.filter(
      (event) => isAgentDecision(event) || isUserDecision(event),
    )
  }, [activityFilter, filteredEvents])

  const scrollRef = useRef<HTMLDivElement>(null)
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false
    setPersistedEvents([])
    setError(null)
    if (!sessionKey) {
      setLoading(false)
      return () => {
        cancelled = true
      }
    }
    setLoading(true)
    fetch(
      `/api/semantier-proxy/api/sessions/${encodeURIComponent(sessionKey)}/activity`,
    )
      .then((res) => {
        if (!res.ok) throw new Error(`activity: HTTP ${res.status}`)
        return res.json()
      })
      .then((payload: SessionActivityPayload) => {
        if (cancelled) return
        setPersistedEvents(normalizeSessionActivityPayload(payload))
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load activity')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionKey])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [visibleEvents.length])

  if (!sessionKey) {
    return <EmptyState text={copy.empty.openSessionToSeeActivity} />
  }

  if (loading && visibleEvents.length === 0) {
    return <LoadingState text={copy.loading.activity} />
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
      <div className="mb-2 flex flex-wrap items-center gap-1">
        {(
          [
            { value: 'all_activity', label: copy.filters.allActivity },
            { value: 'all_decisions', label: copy.filters.allDecisions },
            { value: 'agent_decisions', label: copy.filters.agentDecisions },
            { value: 'user_decisions', label: copy.filters.userDecisions },
          ] as Array<{
            value:
              | 'all_activity'
              | 'all_decisions'
              | 'agent_decisions'
              | 'user_decisions'
            label: string
          }>
        ).map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setActivityFilter(item.value)}
            className="rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
            style={{
              borderColor:
                activityFilter === item.value
                  ? 'var(--theme-accent)'
                  : 'var(--theme-border)',
              color:
                activityFilter === item.value
                  ? 'var(--theme-accent)'
                  : 'var(--theme-muted)',
              background:
                activityFilter === item.value
                  ? 'var(--theme-card)'
                  : 'var(--theme-card2)',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {error ? (
        <div
          className="rounded-md px-2 py-1.5 text-xs"
          style={{
            color: 'var(--theme-danger)',
            background: 'var(--theme-card2)',
          }}
        >
          {error}
        </div>
      ) : null}
      {visibleEvents.length === 0 ? (
        <EmptyState text={copy.empty.noEventsMatchFilter} />
      ) : null}
      {visibleEvents.map((event: ActivityEvent, i: number) => (
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

// ── Memory Tab ────────────────────────────────────────────────────────────────

type MemorySnapshot = {
  kind: string
  title: string
  content: string
  source?: string
}

export async function loadInspectorMemorySnapshots(
  sessionKey: string | null = null,
  fetchImpl: typeof fetch = fetch,
): Promise<Array<MemorySnapshot>> {
  if (sessionKey) {
    const sessionResponse = await fetchImpl(
      `/api/semantier-proxy/api/sessions/${encodeURIComponent(sessionKey)}/memory-snapshot`,
    )
    if (sessionResponse.ok) {
      const json = (await sessionResponse.json().catch(() => ({}))) as Record<string, unknown>
      const list = Array.isArray(json.snapshots) ? json.snapshots : []
      const snapshots = list.map((entry: Record<string, unknown>) => ({
        kind: String(entry.kind || ''),
        title: String(entry.title || entry.kind || 'Memory snapshot'),
        content: String(entry.content || ''),
        source: typeof entry.source === 'string' ? entry.source : undefined,
      }))
      if (snapshots.length > 0) return snapshots
    } else if (sessionResponse.status !== 404) {
      throw new Error(`HTTP ${sessionResponse.status}`)
    }
  }

  const response = await fetchImpl(
    '/api/semantier-proxy/api/memory/read?path=MEMORY.md',
  )
  if (!response.ok) {
    if (response.status === 404) return []
    throw new Error(`HTTP ${response.status}`)
  }
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>
  const content = String(json.content || '')
  if (!content) return []
  return [
    {
      kind: 'memory-file',
      title: String(json.path || 'MEMORY.md'),
      content,
      source: 'live.memory.MEMORY.md',
    },
  ]
}

function MemoryRawPanel({ snapshot }: { snapshot: MemorySnapshot }) {
  const copy = useInspectorCopy()
  const [showRaw, setShowRaw] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium break-all">{snapshot.title}</div>
          <div className="break-all" style={{ color: 'var(--theme-muted)' }}>
            {snapshot.source || 'session_db.system_prompt'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowRaw((prev) => !prev)}
          className="shrink-0 rounded border px-2 py-0.5 font-medium transition-opacity hover:opacity-80"
          style={{
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-accent)',
          }}
        >
          {showRaw ? copy.states.friendly : copy.states.raw}
        </button>
      </div>
      {showRaw ? (
        <JsonDetailBlock label={copy.sections.memorySnapshot} value={snapshot} />
      ) : (
        <pre
          className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded px-2 py-1 text-[11px]"
          style={{
            background: 'var(--theme-card)',
            border: '1px solid var(--theme-border)',
            color: 'var(--theme-text)',
          }}
        >
          {snapshot.content}
        </pre>
      )}
    </div>
  )
}

function MemoryTab({ sessionKey }: { sessionKey: string | null }) {
  const copy = useInspectorCopy()
  const [snapshots, setSnapshots] = useState<Array<MemorySnapshot> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    loadInspectorMemorySnapshots(sessionKey)
      .then((list) => {
        if (!cancelled) {
          setSnapshots(list)
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
  }, [sessionKey])

  if (loading) return <LoadingState text={copy.loading.memory} />
  if (error) return <ErrorState text={`${copy.errors.memory}: ${error}`} />
  if (!snapshots || snapshots.length === 0)
    return (
      <EmptyState text={copy.empty.noMemorySnapshotInjected} />
    )

  return (
    <div className="space-y-2 p-3 overflow-auto max-h-[calc(100vh-140px)]">
      <p className="mb-1 text-xs" style={{ color: 'var(--theme-muted)' }}>
        {copy.counts.memorySnapshotsUsed(snapshots.length)}
      </p>
      {snapshots.map((snapshot, index) => (
        <div
          key={`${snapshot.kind}-${index}`}
          className="rounded-lg px-3 py-2 text-xs leading-relaxed"
          style={{
            backgroundColor: 'var(--theme-card)',
            border: '1px solid var(--theme-border)',
            color: 'var(--theme-text)',
          }}
        >
          <MemoryRawPanel snapshot={snapshot} />
        </div>
      ))}
    </div>
  )
}

// ── Skills Tab ────────────────────────────────────────────────────────────────

export type SkillItem = {
  id?: string
  name: string
  category?: string
  description?: string
  enabled?: boolean
  builtin?: boolean
  sourceLabel?: string
  sourcePath?: string
  hubIdentifier?: string
  hubSource?: string
  packagePath?: string
  packageType?: string
}

type PluginItem = {
  id: string
  name: string
  description?: string
  enabled?: boolean
  toolsets?: Array<string>
  tools?: Array<string>
}

type ToolsetItem = {
  id: string
  name: string
  description?: string
  enabled?: boolean
  available?: boolean
  configured?: boolean
  tools?: Array<string>
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readStringArray(value: unknown): Array<string> {
  if (!Array.isArray(value)) return []
  return value.map((entry) => readString(entry)).filter(Boolean)
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  return undefined
}

function normalizeMatchKey(value: string): string {
  return value.trim().toLowerCase()
}

function hasMatch(set: Set<string>, value: string | undefined): boolean {
  if (!value) return false
  return set.has(normalizeMatchKey(value))
}

function addSkillMatchKeys(keys: Set<string>, value: string | undefined) {
  const raw = readString(value)
  if (!raw) return

  keys.add(normalizeMatchKey(raw))

  const normalizedPath = raw.replace(/\\/g, '/')
  keys.add(normalizeMatchKey(normalizedPath))

  const withoutSkillFile = normalizedPath.replace(/\/SKILL\.md$/i, '')
  keys.add(normalizeMatchKey(withoutSkillFile))

  const hermesPrefix = 'hermes-agent/skills/'
  const prefixIndex = withoutSkillFile.indexOf(hermesPrefix)
  if (prefixIndex >= 0) {
    const relative = withoutSkillFile.slice(prefixIndex + hermesPrefix.length)
    if (relative) {
      keys.add(normalizeMatchKey(relative))
      const leaf = relative.split('/').filter(Boolean).at(-1)
      if (leaf) keys.add(normalizeMatchKey(leaf))
    }
  }

  const leaf = withoutSkillFile.split('/').filter(Boolean).at(-1)
  if (leaf) keys.add(normalizeMatchKey(leaf))
}

function skillMatchKeys(skill: SkillItem): Set<string> {
  const keys = new Set<string>()
  addSkillMatchKeys(keys, skill.id)
  addSkillMatchKeys(keys, skill.name)
  addSkillMatchKeys(keys, skill.sourcePath)
  addSkillMatchKeys(keys, skill.hubIdentifier)
  addSkillMatchKeys(keys, skill.packagePath)
  return keys
}

export function skillMatchesSessionAttachment(
  skill: SkillItem,
  attachedSkills: Set<string>,
  attachedNames: Set<string>,
): boolean {
  const keys = skillMatchKeys(skill)
  for (const key of keys) {
    if (hasMatch(attachedSkills, key) || hasMatch(attachedNames, key)) {
      return true
    }
  }
  return false
}

function normalizeSkillsPayload(payload: unknown): Array<SkillItem> {
  const record = readRecord(payload)
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(record.skills)
      ? record.skills
      : Array.isArray(record.data)
        ? record.data
        : []

  const result: Array<SkillItem> = []
  for (const entry of list) {
    const item = readRecord(entry)
    const name = readString(item.name) || readString(item.id)
    if (!name) continue
    result.push({
      id: readString(item.id) || undefined,
      name,
      category: readString(item.category) || undefined,
      description: readString(item.description) || undefined,
      enabled: readBoolean(item.enabled),
      builtin: readBoolean(item.builtin),
      sourceLabel: readString(item.sourceLabel) || undefined,
      sourcePath: readString(item.sourcePath) || undefined,
      hubIdentifier: readString(item.hubIdentifier) || undefined,
      hubSource: readString(item.hubSource) || undefined,
      packagePath: readString(item.packagePath) || undefined,
      packageType: readString(item.packageType) || undefined,
    })
  }
  return result
}

function normalizePluginsPayload(payload: unknown): Array<PluginItem> {
  const record = readRecord(payload)
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(record.plugins)
      ? record.plugins
      : []

  const result: Array<PluginItem> = []
  for (const entry of list) {
    const item = readRecord(entry)
    const id = readString(item.id) || readString(item.name)
    if (!id) continue
    result.push({
      id,
      name:
        readString(item.label) || readString(item.name) || readString(item.id),
      description: readString(item.description) || undefined,
      enabled: readBoolean(item.enabled),
      toolsets: readStringArray(item.toolsets),
      tools: readStringArray(item.tools),
    })
  }
  return result
}

function normalizeToolsetsPayload(payload: unknown): Array<ToolsetItem> {
  const record = readRecord(payload)
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(record.tools)
      ? record.tools
      : []

  const result: Array<ToolsetItem> = []
  for (const entry of list) {
    const item = readRecord(entry)
    const id = readString(item.id) || readString(item.name)
    if (!id) continue
    result.push({
      id,
      name:
        readString(item.label) || readString(item.name) || readString(item.id),
      description: readString(item.description) || undefined,
      enabled: readBoolean(item.enabled),
      available: readBoolean(item.available),
      configured: readBoolean(item.configured),
      tools: readStringArray(item.tools),
    })
  }
  return result
}

function extractSessionAttachments(value: unknown): {
  skills: Set<string>
  plugins: Set<string>
  toolsets: Set<string>
  tools: Set<string>
  names: Set<string>
} {
  const skills = new Set<string>()
  const plugins = new Set<string>()
  const toolsets = new Set<string>()
  const tools = new Set<string>()
  const names = new Set<string>()

  const add = (set: Set<string>, input: unknown) => {
    const value = readString(input)
    if (!value) return
    set.add(normalizeMatchKey(value))
  }

  const addArray = (set: Set<string>, input: unknown) => {
    for (const value of readStringArray(input)) {
      set.add(normalizeMatchKey(value))
    }
  }

  if (!Array.isArray(value)) {
    return { skills, plugins, toolsets, tools, names }
  }

  for (const entry of value) {
    if (typeof entry === 'string') {
      add(tools, entry)
      add(names, entry)
      continue
    }

    const item = readRecord(entry)
    add(names, item.name)
    add(names, item.id)
    add(names, item.label)

    add(skills, item.skill)
    add(skills, item.skillName)
    add(skills, item.skill_id)
    add(plugins, item.plugin)
    add(plugins, item.pluginName)
    add(plugins, item.plugin_id)
    add(toolsets, item.toolset)
    add(toolsets, item.toolsetName)
    add(toolsets, item.toolset_id)
    add(tools, item.tool)
    add(tools, item.toolName)

    addArray(skills, item.skills)
    addArray(plugins, item.plugins)
    addArray(toolsets, item.toolsets)
    addArray(tools, item.tools)

    const kind = normalizeMatchKey(
      readString(item.type) || readString(item.kind),
    )
    const canonicalName =
      readString(item.name) || readString(item.id) || readString(item.label)
    if (canonicalName) {
      if (kind === 'skill') add(skills, canonicalName)
      if (kind === 'plugin') add(plugins, canonicalName)
      if (kind === 'toolset') add(toolsets, canonicalName)
      if (kind === 'tool') add(tools, canonicalName)
    }
  }

  return { skills, plugins, toolsets, tools, names }
}

function SkillsTab({ sessionKey }: { sessionKey: string | null }) {
  const copy = useInspectorCopy()
  const [skills, setSkills] = useState<Array<SkillItem>>([])
  const [plugins, setPlugins] = useState<Array<PluginItem>>([])
  const [toolsets, setToolsets] = useState<Array<ToolsetItem>>([])
  const [sessionTools, setSessionTools] = useState<Array<string>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    if (!sessionKey) {
      setSkills([])
      setPlugins([])
      setToolsets([])
      setSessionTools([])
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    Promise.all([
      fetch('/api/skills').then((res) => {
        if (!res.ok) throw new Error(`skills: HTTP ${res.status}`)
        return res.json()
      }),
      fetch('/api/plugins').then((res) => {
        if (!res.ok) throw new Error(`plugins: HTTP ${res.status}`)
        return res.json()
      }),
      fetch('/api/tools/toolsets').then((res) => {
        if (!res.ok) throw new Error(`tools: HTTP ${res.status}`)
        return res.json()
      }),
      sessionKey
        ? fetch(
            `/api/semantier-proxy/api/sessions/${encodeURIComponent(sessionKey)}/log`,
          )
            .then((res) => {
              if (!res.ok) throw new Error(`session log: HTTP ${res.status}`)
              return res.json()
            })
            .catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([skillsPayload, pluginsPayload, toolsPayload, logPayload]) => {
        if (cancelled) return

        const normalizedSkills = normalizeSkillsPayload(skillsPayload)
        const normalizedPlugins = normalizePluginsPayload(pluginsPayload)
        const normalizedToolsets = normalizeToolsetsPayload(toolsPayload)
        const logRecord = readRecord(logPayload)
        const attachmentRecords = Array.isArray(logRecord.attachments)
          ? [
              ...logRecord.attachments,
              ...(Array.isArray(logRecord.tools) ? logRecord.tools : []),
            ]
          : logRecord.tools
        const attached = extractSessionAttachments(attachmentRecords)

        const attachedSkills = normalizedSkills.filter((skill) =>
          skillMatchesSessionAttachment(skill, attached.skills, attached.names),
        )

        const attachedPlugins = normalizedPlugins.filter((plugin) => {
          if (
            hasMatch(attached.plugins, plugin.id) ||
            hasMatch(attached.plugins, plugin.name) ||
            hasMatch(attached.names, plugin.id) ||
            hasMatch(attached.names, plugin.name)
          ) {
            return true
          }
          const tools = Array.isArray(plugin.tools) ? plugin.tools : []
          return tools.some((tool) => hasMatch(attached.tools, tool))
        })

        const attachedToolsets = normalizedToolsets.filter((toolset) => {
          if (
            hasMatch(attached.toolsets, toolset.id) ||
            hasMatch(attached.toolsets, toolset.name) ||
            hasMatch(attached.names, toolset.id) ||
            hasMatch(attached.names, toolset.name)
          ) {
            return true
          }
          const tools = Array.isArray(toolset.tools) ? toolset.tools : []
          return tools.some((tool) => hasMatch(attached.tools, tool))
        })

        const attachedTools = Array.from(attached.tools)

        setSkills(attachedSkills)
        setPlugins(attachedPlugins)
        setToolsets(attachedToolsets)
        setSessionTools(attachedTools)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(
          err instanceof Error ? err.message : 'Failed to load skills tab',
        )
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [sessionKey])

  if (loading) return <LoadingState text={copy.loading.skills} />
  if (error) return <ErrorState text={`${copy.errors.skills}: ${error}`} />
  if (!sessionKey) {
    return <EmptyState text={copy.empty.openSessionToSeeSessionAttached} />
  }
  if (
    skills.length === 0 &&
    plugins.length === 0 &&
    toolsets.length === 0 &&
    sessionTools.length === 0
  ) {
    return <EmptyState text={copy.empty.noSessionAttached} />
  }

  // Group by category
  const grouped: Partial<Record<string, Array<SkillItem>>> = {}
  for (const skill of skills) {
    const cat = skill.category || copy.states.uncategorized
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(skill)
  }

  return (
    <div className="space-y-3 p-3 overflow-auto max-h-[calc(100vh-140px)]">
      <p className="text-xs" style={{ color: 'var(--theme-muted)' }}>
        {`${copy.sections.session}: ${sessionKey}`}
      </p>
      <div className="space-y-1">
        <p
          className="text-[10px] uppercase tracking-wider mb-1 font-semibold"
          style={{ color: 'var(--theme-accent)' }}
        >
          {copy.counts.loadedSkills(skills.length)}
        </p>
        {Object.entries(grouped).map(([category, items = []]) => (
          <div key={category}>
            <p
              className="text-[10px] mb-1"
              style={{ color: 'var(--theme-muted)' }}
            >
              {category}
            </p>
            {items.map((skill) => {
              const itemKey = `skill:${skill.id || skill.name}`
              return (
                <button
                  key={itemKey}
                  type="button"
                  onClick={() =>
                    setExpanded(expanded === itemKey ? null : itemKey)
                  }
                  className="w-full text-left rounded px-2 py-1.5 text-xs mb-0.5 transition-colors"
                  style={{
                    background:
                      expanded === itemKey
                        ? 'var(--theme-card2)'
                        : 'transparent',
                    color: 'var(--theme-text)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ color: 'var(--theme-accent)' }}>⚡</span>
                    <span>{skill.name}</span>
                    {skill.enabled === false ? (
                      <span
                        className="ml-auto text-[10px]"
                        style={{ color: 'var(--theme-muted)' }}
                      >
                        {copy.states.disabled}
                      </span>
                    ) : null}
                  </div>
                  {expanded === itemKey && skill.description ? (
                    <p
                      className="mt-1 pl-5 text-[11px]"
                      style={{ color: 'var(--theme-muted)' }}
                    >
                      {skill.description}
                    </p>
                  ) : null}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <p
          className="text-[10px] uppercase tracking-wider mb-1 font-semibold"
          style={{ color: 'var(--theme-accent)' }}
        >
          {copy.counts.plugins(plugins.length)}
        </p>
        {plugins.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--theme-muted)' }}>
            {copy.isChinese ? '未加载插件' : 'No plugins loaded'}
          </p>
        ) : (
          plugins.map((plugin) => {
            const itemKey = `plugin:${plugin.id}`
            return (
              <button
                key={plugin.id}
                type="button"
                onClick={() =>
                  setExpanded(expanded === itemKey ? null : itemKey)
                }
                className="w-full text-left rounded px-2 py-1.5 text-xs mb-0.5 transition-colors"
                style={{
                  background:
                    expanded === itemKey ? 'var(--theme-card2)' : 'transparent',
                  color: 'var(--theme-text)',
                }}
              >
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--theme-accent)' }}>◆</span>
                  <span>{plugin.name}</span>
                  {plugin.enabled === false ? (
                    <span
                      className="ml-auto text-[10px]"
                      style={{ color: 'var(--theme-muted)' }}
                    >
                      {copy.states.disabled}
                    </span>
                  ) : null}
                </div>
                {expanded === itemKey ? (
                  <div
                    className="mt-1 pl-5 space-y-0.5 text-[11px]"
                    style={{ color: 'var(--theme-muted)' }}
                  >
                    {plugin.description ? <p>{plugin.description}</p> : null}
                    {plugin.toolsets && plugin.toolsets.length > 0 ? (
                      <p>
                        {copy.labels.toolsets}: {plugin.toolsets.join(', ')}
                      </p>
                    ) : null}
                    {plugin.tools && plugin.tools.length > 0 ? (
                      <p>
                        {copy.labels.tools}: {plugin.tools.join(', ')}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </button>
            )
          })
        )}
      </div>

      <div className="space-y-1">
        <p
          className="text-[10px] uppercase tracking-wider mb-1 font-semibold"
          style={{ color: 'var(--theme-accent)' }}
        >
          {copy.counts.tools(sessionTools.length, toolsets.length)}
        </p>
        {sessionTools.length > 0 ? (
          <div
            className="rounded px-2 py-2 text-xs"
            style={{ background: 'var(--theme-card2)' }}
          >
            <p style={{ color: 'var(--theme-muted)' }}>
              {copy.labels.sessionTools}: {sessionTools.join(', ')}
            </p>
          </div>
        ) : null}
        {toolsets.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--theme-muted)' }}>
            {copy.isChinese ? '未加载工具集' : 'No toolsets loaded'}
          </p>
        ) : (
          toolsets.map((toolset) => {
            const itemKey = `toolset:${toolset.id}`
            return (
              <button
                key={toolset.id}
                type="button"
                onClick={() =>
                  setExpanded(expanded === itemKey ? null : itemKey)
                }
                className="w-full text-left rounded px-2 py-1.5 text-xs mb-0.5 transition-colors"
                style={{
                  background:
                    expanded === itemKey ? 'var(--theme-card2)' : 'transparent',
                  color: 'var(--theme-text)',
                }}
              >
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--theme-accent)' }}>◦</span>
                  <span>{toolset.name}</span>
                  {toolset.enabled === false ? (
                    <span
                      className="ml-auto text-[10px]"
                      style={{ color: 'var(--theme-muted)' }}
                    >
                      {copy.states.disabled}
                    </span>
                  ) : null}
                </div>
                {expanded === itemKey ? (
                  <div
                    className="mt-1 pl-5 space-y-0.5 text-[11px]"
                    style={{ color: 'var(--theme-muted)' }}
                  >
                    {toolset.description ? <p>{toolset.description}</p> : null}
                    {toolset.available === false ? (
                      <p>{copy.states.unavailable}</p>
                    ) : null}
                    {toolset.configured === false ? (
                      <p>{copy.states.notConfigured}</p>
                    ) : null}
                    {toolset.tools && toolset.tools.length > 0 ? (
                      <p>
                        {copy.labels.tools}: {toolset.tools.join(', ')}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </button>
            )
          })
        )}
      </div>
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

function LogsTab({ sessionKey }: { sessionKey: string | null }) {
  const copy = useInspectorCopy()
  const [log, setLog] = useState<SessionLogPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showRaw, setShowRaw] = useState(false)

  useEffect(() => {
    if (!sessionKey) {
      setLog(null)
      setError(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setLog(null)
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
      {loading && <LoadingState text={copy.loading.sessionLog} />}
      {!loading && error && (
        <ErrorState text={`${copy.errors.sessionLog}: ${error}`} />
      )}
      {!loading && !error && !log && !sessionKey && (
        <EmptyState text={copy.empty.startConversationToSeeSessionLogs} />
      )}
      {!loading && !error && !log && sessionKey && (
        <EmptyState text={copy.empty.noSessionLogAvailable} />
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
          {showRaw ? copy.buttons.friendly : copy.buttons.raw}
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
          {copy.buttons.refresh}
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
          {copy.buttons.openReview}
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
          {copy.buttons.openReview}
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
                  {copy.sections.session}
                </p>
                <div>
                  <span style={{ color: 'var(--theme-muted)' }}>{copy.labels.key}</span>
                  <span className="font-mono break-all">{sessionKeyLabel}</span>
                </div>
                {log.model && (
                  <div>
                    <span style={{ color: 'var(--theme-muted)' }}>{copy.labels.model}</span>
                    {log.model}
                  </div>
                )}
                <div>
                  <span style={{ color: 'var(--theme-muted)' }}>{copy.labels.messages}</span>
                  {messages.length}
                </div>
                {Array.isArray(log.tools) && log.tools.length > 0 && (
                  <div>
                    <span style={{ color: 'var(--theme-muted)' }}>{copy.labels.tools}</span>
                    {log.tools.length} {copy.states.registered}
                  </div>
                )}
                {log.session_start && (
                  <div>
                    <span style={{ color: 'var(--theme-muted)' }}>{copy.labels.started}</span>
                    {log.session_start}
                  </div>
                )}
                {log.last_updated && (
                  <div>
                    <span style={{ color: 'var(--theme-muted)' }}>{copy.labels.updated}</span>
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
                    {copy.counts.fullMessages(messages.length)}
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
                <EmptyState text={copy.empty.noMessagesRecordedInThisSessionLog} />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function InspectorPanel({
  sessionKey = null,
}: {
  sessionKey?: string | null
}) {
  const copy = useInspectorCopy()
  const isOpen = useInspectorStore((s) => s.isOpen)
  const activeTab = useInspectorStore((s) => s.activeTab)
  const setActiveTab = useInspectorStore((s) => s.setActiveTab)
  const memoryAvailable = useFeatureAvailable('memory')
  const skillsAvailable = useFeatureAvailable('skills')

  useEffect(() => {
    if (activeTab === 'memory' && !memoryAvailable) {
      setActiveTab('activity')
    }
    if (activeTab === 'skills' && !skillsAvailable) {
      setActiveTab('activity')
    }
  }, [activeTab, memoryAvailable, skillsAvailable])

  useEffect(() => {
    function openArtifactFromHash() {
      const hash = window.location.hash
      if (!hash.startsWith('#artifact=')) return
      useInspectorStore
        .getState()
        .openArtifact(hash.slice('#artifact='.length))
    }
    openArtifactFromHash()
    window.addEventListener('hashchange', openArtifactFromHash)
    return () => window.removeEventListener('hashchange', openArtifactFromHash)
  }, [])

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
              {copy.title}
            </span>
            <button
              type="button"
              onClick={() => useInspectorStore.getState().setOpen(false)}
              className="rounded p-1 text-xs hover:opacity-70 transition-opacity"
              style={{ color: 'var(--theme-muted)' }}
              aria-label={copy.close}
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
                    <span>{copy.tabs[tab.id]}</span>
                    {!available ? (
                      <span className="ml-1 rounded-full border border-amber-300 bg-amber-100 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                        {copy.gate}
                      </span>
                    ) : null}
                  </button>
                )
              })(),
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto">
            {activeTab === 'activity' && (
              <ActivityTab sessionKey={sessionKey} />
            )}
            {activeTab === 'artifacts' && (
              <ArtifactsTab sessionKey={sessionKey} />
            )}
            {activeTab === 'memory' && <MemoryTab sessionKey={sessionKey} />}
            {activeTab === 'skills' && <SkillsTab sessionKey={sessionKey} />}
            {activeTab === 'logs' && <LogsTab sessionKey={sessionKey} />}
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
