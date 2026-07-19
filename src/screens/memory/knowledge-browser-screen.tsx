import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  BrainIcon,
  CodeIcon,
  File01Icon,
  Folder01Icon,
  Link01Icon,
  Message01Icon,
  Search01Icon,
  Settings01Icon,
  Upload01Icon,
} from '@hugeicons/core-free-icons'
import { Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import type {
  KnowledgeSourceDraft,
  KnowledgeSourceModalViewModel,
} from '@/screens/settings/components/knowledge-source-form'
import { Markdown } from '@/components/prompt-kit/markdown'
import {
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  KnowledgeSourceForm,
  createDefaultKnowledgeSourceDraft,
} from '@/screens/settings/components/knowledge-source-form'
import { cn } from '@/lib/utils'

type WikiPageMeta = {
  path: string
  name: string
  title: string
  type?: string
  domain?: string
  status?: string
  tags: Array<string>
  summary?: string
  created?: string
  updated?: string
  size: number
  modified: string
  wikilinks: Array<string>
}

type KnowledgeListResponse = {
  pages?: Array<WikiPageMeta>
  knowledgeRoot?: string
  exists?: boolean
  source?: KnowledgeSourceDraft
}

type KnowledgeResolvedConfig = {
  configuredPath?: string
  effectiveRoot?: string
  effectiveRootLabel?: string
  usesWorkspaceDefault?: boolean
  upstreamWikiPath?: string
}

type KnowledgeConfigResponse = {
  config?: { source?: KnowledgeSourceDraft }
  resolved?: KnowledgeResolvedConfig
}

type KnowledgeFilesResponse = {
  configuredPath: string
  effectiveRoot: string
  effectiveRootLabel: string
  path: string
  breadcrumb: Array<{ label: string; path: string }>
  fileCount: number
  directoryCount: number
  entries: Array<KnowledgeTreeEntry>
}

type KnowledgeFilesTreeResponse = {
  configuredPath: string
  effectiveRoot: string
  effectiveRootLabel: string
  root: KnowledgeTreeEntry
}

type KnowledgeReviewRow = {
  originalName: string
  storedName: string
  size: number
  retryUploadRef: string
  targetWikiPath?: string
  ingestKind: 'document_extraction' | 'table_ingestion'
  canonicalArtifactKind: 'canonical_document' | 'canonical_table'
}

type KnowledgeFileViewMode = 'source' | 'wiki'

const KNOWLEDGE_UPLOAD_EXTENSIONS = [
  '.md',
  '.markdown',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
  '.pdf',
  '.docx',
  '.png',
  '.jpg',
  '.jpeg',
  '.html',
  '.htm',
  '.xml',
  '.csv',
  '.xlsx',
]

type KnowledgeUploadResult =
  | {
      ok: true
      kind: 'direct_write'
      originalName: string
      storedName: string
      path: string
      renamed: boolean
    }
  | {
      ok: true
      kind: 'staged_for_ingest'
      originalName: string
      storedName: string
      size: number
      retryUploadRef: string
      requiresIngest: true
      ingestKind: 'document_extraction' | 'table_ingestion'
      canonicalArtifactKind: 'canonical_document' | 'canonical_table'
      targetWikiPath?: string
    }
  | {
      ok: false
      kind: 'file_failure'
      originalName: string
      message: string
    }

type KnowledgeIngestResult =
  | {
      ok: true
      originalName: string
      storedMarkdownPath: string
      parserMethod: string
      normalizedDocumentArtifactRef: string
    }
  | {
      ok: false
      originalName?: string
      message: string
      retryUploadRef?: string
    }

type ModalStatus = KnowledgeSourceModalViewModel['status']

type KnowledgeActivityStatus = 'running' | 'waiting' | 'done' | 'failed'

type KnowledgeActivityRow = {
  id: string
  status: KnowledgeActivityStatus
  label: string
  detail: string
  uploadRef?: string
}

type KnowledgeStatusEvent = {
  id?: string
  status?: KnowledgeActivityStatus
  label?: string
  detail?: string
  filename?: string
  targetPath?: string
  uploadRef?: string
}

const EMPTY_MODAL_STATUS: ModalStatus = {
  kind: 'idle',
  message: '',
  failures: [],
  renamed: [],
  ingested: [],
}

type KnowledgeReadResponse = {
  page?: WikiPageMeta
  content?: string
  backlinks?: Array<string>
}

type KnowledgeSearchResult = {
  path: string
  title: string
  line: number
  text: string
}

type KnowledgeSearchResponse = {
  results?: Array<KnowledgeSearchResult>
}

type KnowledgeGraphNode = {
  id: string
  title: string
  type?: string
  tags?: Array<string>
}

type KnowledgeGraphEdge = {
  source: string
  target: string
}

type KnowledgeGraphResponse = {
  nodes?: Array<KnowledgeGraphNode>
  edges?: Array<KnowledgeGraphEdge>
}

type TreeNode = {
  name: string
  path: string
  folders: Array<TreeNode>
  pages: Array<WikiPageMeta>
}

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Request failed (${response.status})`)
  }
  return (await response.json()) as T
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value?: string): string | null {
  if (!value) return null
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return value
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed)
}

function highlightMatch(
  text: string,
  query: string,
): Array<{ text: string; hit: boolean }> {
  const needle = query.trim()
  if (!needle) return [{ text, hit: false }]
  const lower = text.toLowerCase()
  const matchLower = needle.toLowerCase()
  const parts: Array<{ text: string; hit: boolean }> = []
  let cursor = 0
  while (cursor < text.length) {
    const index = lower.indexOf(matchLower, cursor)
    if (index < 0) {
      parts.push({ text: text.slice(cursor), hit: false })
      break
    }
    if (index > cursor) {
      parts.push({ text: text.slice(cursor, index), hit: false })
    }
    parts.push({ text: text.slice(index, index + needle.length), hit: true })
    cursor = index + needle.length
  }
  return parts.length > 0 ? parts : [{ text, hit: false }]
}

function normalizeWikiToken(value: string): string {
  return value.trim().toLowerCase().replace(/\\/g, '/').replace(/\.md$/i, '')
}

function isMarkdownKnowledgeFile(entry: KnowledgeTreeEntry): boolean {
  const lower = entry.name.toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.markdown')
}

function filterKnowledgeFileTree(
  entry: KnowledgeTreeEntry,
  mode: KnowledgeFileViewMode,
  isRoot = true,
): KnowledgeTreeEntry | null {
  if (entry.kind === 'file') {
    const markdown = isMarkdownKnowledgeFile(entry)
    if (mode === 'wiki' ? markdown : !markdown) return entry
    return null
  }

  const children = (entry.children ?? [])
    .map((child) => filterKnowledgeFileTree(child, mode, false))
    .filter((child): child is KnowledgeTreeEntry => Boolean(child))
  if (!isRoot && children.length === 0) return null
  return { ...entry, children }
}

function filterKnowledgeDirectoryEntries(
  entries: Array<KnowledgeTreeEntry>,
  mode: KnowledgeFileViewMode,
): Array<KnowledgeTreeEntry> {
  return entries.filter((entry) => {
    if (entry.kind === 'directory') return true
    const markdown = isMarkdownKnowledgeFile(entry)
    return mode === 'wiki' ? markdown : !markdown
  })
}

function preprocessWikiMarkdown(content: string): string {
  return content.replace(/\[\[([^\]]+)\]\]/g, (_match, rawLink) => {
    const parts = String(rawLink).split('|')
    const target = parts[0]?.trim() ?? ''
    const label = parts[1]?.trim() || target
    return `[${label}](wiki:${encodeURIComponent(target)})`
  })
}

function buildKnowledgeTree(pages: Array<WikiPageMeta>): TreeNode {
  const root: TreeNode = { name: 'root', path: '', folders: [], pages: [] }

  for (const page of pages) {
    const parts = page.path.split('/').filter(Boolean)
    const folderParts = parts.slice(0, -1)
    let cursor = root

    for (const folder of folderParts) {
      let child = cursor.folders.find((entry) => entry.name === folder)
      if (!child) {
        child = {
          name: folder,
          path: cursor.path ? `${cursor.path}/${folder}` : folder,
          folders: [],
          pages: [],
        }
        cursor.folders.push(child)
      }
      cursor = child
    }

    cursor.pages.push(page)
  }

  function sortNode(node: TreeNode) {
    node.folders.sort((a, b) => a.name.localeCompare(b.name))
    node.pages.sort((a, b) => a.title.localeCompare(b.title))
    node.folders.forEach(sortNode)
  }

  sortNode(root)
  return root
}

function GraphCanvas({
  nodes,
  edges,
  onSelect,
}: {
  nodes: Array<KnowledgeGraphNode>
  edges: Array<KnowledgeGraphEdge>
  onSelect: (path: string) => void
}) {
  const layout = useMemo(() => {
    if (nodes.length === 0) return []
    const width = 900
    const height = 520
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.max(140, Math.min(width, height) / 2 - 72)

    return nodes.map((node, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(nodes.length, 1)
      return {
        ...node,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      }
    })
  }, [nodes])

  const byId = useMemo(
    () => new Map(layout.map((node) => [node.id, node])),
    [layout],
  )

  return (
    <div className="overflow-hidden rounded-2xl border border-primary-200 bg-primary-50 dark:border-neutral-800 dark:bg-neutral-950">
      <svg viewBox="0 0 900 520" className="h-[520px] w-full">
        {edges.map((edge, index) => {
          const source = byId.get(edge.source)
          const target = byId.get(edge.target)
          if (!source || !target) return null
          return (
            <line
              key={`${edge.source}:${edge.target}:${index}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="rgba(148, 163, 184, 0.45)"
              strokeWidth="1.25"
            />
          )
        })}

        {layout.map((node) => (
          <g
            key={node.id}
            onClick={() => onSelect(node.id)}
            className="cursor-pointer"
          >
            <circle
              cx={node.x}
              cy={node.y}
              r="16"
              fill="rgba(59, 130, 246, 0.16)"
              stroke="rgba(59, 130, 246, 0.65)"
              strokeWidth="1.5"
            />
            <text
              x={node.x}
              y={node.y + 34}
              textAnchor="middle"
              fontSize="11"
              fill="currentColor"
            >
              {node.title}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

export function KnowledgeBrowserScreen() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [focusLine, setFocusLine] = useState<number | null>(null)
  const [focusedResult, setFocusedResult] =
    useState<KnowledgeSearchResult | null>(null)
  const [mobileTreeOpen, setMobileTreeOpen] = useState(true)
  const [graphOpen, setGraphOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSource, setSettingsSource] = useState<KnowledgeSourceDraft>(
    createDefaultKnowledgeSourceDraft(),
  )
  const [savedSettingsSource, setSavedSettingsSource] =
    useState<KnowledgeSourceDraft | null>(null)
  const [savePending, setSavePending] = useState(false)
  const [uploadPending, setUploadPending] = useState(false)
  const [ingestPending, setIngestPending] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [modalStatus, setModalStatus] =
    useState<ModalStatus>(EMPTY_MODAL_STATUS)
  const [browserPath, setBrowserPath] = useState('')
  const [queuedUploadFiles, setQueuedUploadFiles] = useState<Array<File>>([])
  const [reviewRows, setReviewRows] = useState<Array<KnowledgeReviewRow>>([])
  const [fileViewMode, setFileViewMode] =
    useState<KnowledgeFileViewMode>('source')
  const [newFolderName, setNewFolderName] = useState('')
  const [expandedFilePaths, setExpandedFilePaths] = useState<Set<string>>(
    () => new Set(['']),
  )
  const [knowledgeActivity, setKnowledgeActivity] = useState<
    Array<KnowledgeActivityRow>
  >([])
  const [resolvedConfig, setResolvedConfig] =
    useState<KnowledgeResolvedConfig | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    const events = new EventSource('/api/knowledge/events')
    const handleStatus = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as KnowledgeStatusEvent
        if (
          !payload.status ||
          !['running', 'waiting', 'done', 'failed'].includes(payload.status)
        ) {
          return
        }
        upsertKnowledgeActivity({
          id: payload.uploadRef
            ? `knowledge-event:${payload.uploadRef}`
            : `knowledge-event:${payload.id || Date.now()}`,
          status: payload.status,
          label: payload.label || 'Knowledge import status',
          detail:
            payload.detail || payload.targetPath || payload.filename || '',
          uploadRef: payload.uploadRef,
        })
        if (payload.status === 'done') {
          void queryClient.invalidateQueries({
            queryKey: ['knowledge', 'list'],
          })
          void queryClient.invalidateQueries({
            queryKey: ['knowledge', 'files'],
          })
        }
      } catch {
        /* ignore malformed event payloads */
      }
    }
    events.addEventListener('knowledge_status', handleStatus)
    return () => {
      events.removeEventListener('knowledge_status', handleStatus)
      events.close()
    }
  }, [queryClient])

  useEffect(() => {
    if (!settingsOpen) {
      setModalStatus(EMPTY_MODAL_STATUS)
      setReviewRows([])
      setBrowserPath('')
      setQueuedUploadFiles([])
      return
    }
    fetch('/api/knowledge/config')
      .then((r) => r.json())
      .then((data: KnowledgeConfigResponse) => {
        if (data.config?.source) {
          setSettingsSource(data.config.source)
          setSavedSettingsSource(data.config.source)
        }
        if (data.resolved) {
          setResolvedConfig(data.resolved)
        }
      })
      .catch(() => {})
  }, [settingsOpen])

  useEffect(() => {
    if (!settingsOpen || modalStatus.kind !== 'saved') return
    const timeout = window.setTimeout(() => {
      setModalStatus((current) =>
        current.kind === 'saved' ? EMPTY_MODAL_STATUS : current,
      )
    }, 6000)
    return () => window.clearTimeout(timeout)
  }, [modalStatus.kind, settingsOpen])

  useEffect(() => {
    if (
      !settingsOpen ||
      (modalStatus.kind !== 'uploaded' && modalStatus.kind !== 'review')
    ) {
      return
    }
    const timeout = window.setTimeout(() => {
      setModalStatus((current) =>
        current.kind === 'uploaded' || current.kind === 'review'
          ? EMPTY_MODAL_STATUS
          : current,
      )
    }, 6000)
    return () => window.clearTimeout(timeout)
  }, [modalStatus.kind, settingsOpen])

  const deferredSearch = useDeferredValue(searchInput)
  const searchTerm = deferredSearch.trim()

  const listQuery = useQuery({
    queryKey: ['knowledge', 'list'],
    queryFn: () => readJson<KnowledgeListResponse>('/api/knowledge/list'),
  })

  const pages = listQuery.data?.pages ?? []
  const knowledgeRoot = listQuery.data?.knowledgeRoot ?? '~/.hermes/knowledge/'
  const knowledgeExists = listQuery.data?.exists ?? false

  const pageLookup = useMemo(() => {
    const map = new Map<string, string>()
    for (const page of pages) {
      map.set(normalizeWikiToken(page.path), page.path)
      map.set(normalizeWikiToken(page.name), page.path)
      map.set(normalizeWikiToken(page.title), page.path)
      map.set(normalizeWikiToken(page.name.replace(/\.md$/i, '')), page.path)
      const basename = page.path.split('/').pop() || page.name
      map.set(normalizeWikiToken(basename), page.path)
      map.set(normalizeWikiToken(basename.replace(/\.md$/i, '')), page.path)
    }
    return map
  }, [pages])

  const filteredPages = useMemo(() => {
    if (!selectedTag) return pages
    return pages.filter((page) => page.tags.includes(selectedTag))
  }, [pages, selectedTag])

  const tree = useMemo(() => buildKnowledgeTree(filteredPages), [filteredPages])
  const popularTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const page of pages) {
      for (const tag of page.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 16)
  }, [pages])

  useEffect(() => {
    if (!pages.length) return
    if (selectedPath && pages.some((page) => page.path === selectedPath)) return
    setSelectedPath(pages[0]?.path ?? null)
  }, [pages, selectedPath])

  const readQuery = useQuery({
    queryKey: ['knowledge', 'read', selectedPath],
    queryFn: () =>
      readJson<KnowledgeReadResponse>(
        `/api/knowledge/read?path=${encodeURIComponent(selectedPath || '')}`,
      ),
    enabled: Boolean(selectedPath),
  })

  const searchQuery = useQuery({
    queryKey: ['knowledge', 'search', searchTerm],
    queryFn: () =>
      readJson<KnowledgeSearchResponse>(
        `/api/knowledge/search?q=${encodeURIComponent(searchTerm)}`,
      ),
    enabled: searchTerm.length > 0,
  })

  const graphQuery = useQuery({
    queryKey: ['knowledge', 'graph'],
    queryFn: () => readJson<KnowledgeGraphResponse>('/api/knowledge/graph'),
    enabled: graphOpen,
  })

  const knowledgeFilesQuery = useQuery({
    queryKey: ['knowledge', 'files', browserPath],
    queryFn: () =>
      readJson<KnowledgeFilesResponse>(
        `/api/knowledge/files?path=${encodeURIComponent(browserPath)}`,
      ),
    enabled: settingsOpen && settingsSource.type === 'local',
  })

  const knowledgeFilesTreeQuery = useQuery({
    queryKey: ['knowledge', 'files', 'tree'],
    queryFn: () =>
      readJson<KnowledgeFilesTreeResponse>('/api/knowledge/files?tree=1'),
    enabled: settingsOpen && settingsSource.type === 'local',
  })

  const page = readQuery.data?.page ?? null
  const content = readQuery.data?.content ?? ''
  const backlinks = readQuery.data?.backlinks ?? []
  const processedContent = useMemo(
    () => preprocessWikiMarkdown(content),
    [content],
  )
  const askUrl = `/chat?message=${encodeURIComponent(
    `Tell me about: ${page?.title || selectedPath || 'this page'}\n\nContext:\n${content.slice(0, 500)}`,
  )}`
  const searchResults = searchQuery.data?.results ?? []

  const settingsDirty = useMemo(() => {
    return (
      JSON.stringify(settingsSource) !== JSON.stringify(savedSettingsSource)
    )
  }, [savedSettingsSource, settingsSource])

  const effectiveModalStatus = useMemo<ModalStatus>(() => {
    if (savePending)
      return { ...EMPTY_MODAL_STATUS, kind: 'saving', message: 'Saving...' }
    if (syncing)
      return { ...EMPTY_MODAL_STATUS, kind: 'syncing', message: 'Syncing...' }
    if (uploadPending)
      return { ...EMPTY_MODAL_STATUS, kind: 'syncing', message: 'Uploading...' }
    if (ingestPending)
      return {
        ...EMPTY_MODAL_STATUS,
        kind: 'ingesting',
        message: 'Importing...',
      }
    if (syncError) {
      return {
        kind: 'failed',
        message: syncError,
        failures: [{ filename: 'knowledge', error: syncError }],
        renamed: [],
        ingested: [],
      }
    }
    if (modalStatus.kind !== 'idle') return modalStatus
    if (settingsDirty)
      return {
        ...EMPTY_MODAL_STATUS,
        kind: 'dirty',
        message: 'Unsaved changes',
      }
    return EMPTY_MODAL_STATUS
  }, [
    ingestPending,
    modalStatus,
    savePending,
    settingsDirty,
    syncError,
    syncing,
    uploadPending,
  ])

  const modalViewModel = useMemo<KnowledgeSourceModalViewModel>(() => {
    return {
      source: settingsSource,
      savedSource: savedSettingsSource,
      configuredPath: resolvedConfig?.configuredPath || '',
      savedConfiguredPath: resolvedConfig?.configuredPath || '',
      effectiveRootLabel:
        knowledgeFilesQuery.data?.effectiveRootLabel ||
        resolvedConfig?.effectiveRootLabel ||
        resolvedConfig?.effectiveRoot ||
        knowledgeRoot,
      upstreamWikiPathLabel: resolvedConfig?.upstreamWikiPath || 'wiki',
      usesWorkspaceDefault: resolvedConfig?.usesWorkspaceDefault ?? true,
      dirty: settingsDirty,
      status: effectiveModalStatus,
      contextEngineering: {
        authorityLabel:
          reviewRows.length > 0
            ? 'canonical_artifact_derivative'
            : 'curation_context',
        candidateOnly: true,
        governedPromotionRequired: true,
      },
    }
  }, [
    browserPath,
    effectiveModalStatus,
    knowledgeFilesQuery.data,
    knowledgeRoot,
    resolvedConfig,
    reviewRows,
    savedSettingsSource,
    settingsDirty,
    settingsSource,
  ])

  const knowledgeFileTreeRoot = useMemo<KnowledgeTreeEntry>(() => {
    const root = knowledgeFilesTreeQuery.data?.root || {
      name: 'wiki',
      path: '',
      kind: 'directory' as const,
      children: [],
    }
    return (
      filterKnowledgeFileTree(root, fileViewMode) || {
        ...root,
        children: [],
      }
    )
  }, [fileViewMode, knowledgeFilesTreeQuery.data])

  const currentDirectoryEntries = useMemo(
    () =>
      filterKnowledgeDirectoryEntries(
        knowledgeFilesQuery.data?.entries || [],
        fileViewMode,
      ),
    [fileViewMode, knowledgeFilesQuery.data],
  )

  const currentFileCount = currentDirectoryEntries.filter(
    (entry) => entry.kind === 'file',
  ).length
  const currentDirectoryCount = currentDirectoryEntries.filter(
    (entry) => entry.kind === 'directory',
  ).length
  const filesError =
    knowledgeFilesQuery.error instanceof Error
      ? knowledgeFilesQuery.error.message
      : knowledgeFilesTreeQuery.error instanceof Error
        ? knowledgeFilesTreeQuery.error.message
        : null
  const filesLoading =
    knowledgeFilesQuery.isLoading || knowledgeFilesTreeQuery.isLoading
  const queuedUploadView = queuedUploadFiles.map((file) => ({
    name: file.name,
    size: file.size,
  }))

  function resolveWikiPath(rawValue: string): string | null {
    const decoded = decodeURIComponent(rawValue)
    return pageLookup.get(normalizeWikiToken(decoded)) ?? null
  }

  function handleSelectPath(
    pathValue: string,
    nextLine?: number,
    result?: KnowledgeSearchResult,
  ) {
    setSelectedPath(pathValue)
    setFocusLine(nextLine ?? null)
    setFocusedResult(result ?? null)
    setMobileTreeOpen(false)
  }

  function handleBrowseKnowledgeFolder(pathValue: string) {
    setBrowserPath(pathValue)
    setModalStatus((current) =>
      current.kind === 'failed' || current.kind === 'dirty'
        ? current
        : EMPTY_MODAL_STATUS,
    )
  }

  function handleQueueUploadFiles(files: Array<File>) {
    setQueuedUploadFiles(files)
    setModalStatus({
      ...EMPTY_MODAL_STATUS,
      kind: 'idle',
      message: `${files.length} ${files.length === 1 ? 'file' : 'files'} ready to upload`,
    })
  }

  function upsertKnowledgeActivity(row: KnowledgeActivityRow) {
    setKnowledgeActivity((current) => {
      const next = current.filter((item) => item.id !== row.id)
      return [row, ...next].slice(0, 8)
    })
  }

  function toggleFileTreePath(pathValue: string) {
    setExpandedFilePaths((current) => {
      const next = new Set(current)
      if (next.has(pathValue)) {
        if (pathValue) next.delete(pathValue)
      } else {
        next.add(pathValue)
      }
      return next
    })
  }

  async function handleCreateKnowledgeFolder(folderName: string) {
    setSyncError(null)
    setModalStatus({
      ...EMPTY_MODAL_STATUS,
      kind: 'syncing',
      message: 'Creating folder...',
    })
    try {
      const response = await fetch('/api/knowledge/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentPath: browserPath,
          folderName,
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        path?: string
      }
      if (!response.ok) {
        const message =
          payload.error || `Create folder failed (${response.status})`
        setModalStatus({
          kind: 'failed',
          message,
          failures: [{ filename: folderName, error: message }],
          renamed: [],
          ingested: [],
        })
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['knowledge', 'files'] })
      setModalStatus({
        ...EMPTY_MODAL_STATUS,
        kind: 'saved',
        message: `Created ${payload.path || folderName}`,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Create folder failed'
      setModalStatus({
        kind: 'failed',
        message,
        failures: [{ filename: folderName, error: message }],
        renamed: [],
        ingested: [],
      })
    }
  }

  async function refreshKnowledgeConfig() {
    const refreshed = await readJson<KnowledgeConfigResponse>(
      '/api/knowledge/config',
    )
    setResolvedConfig(refreshed.resolved ?? null)
    if (refreshed.config?.source) {
      setSettingsSource(refreshed.config.source)
      setSavedSettingsSource(refreshed.config.source)
    }
  }

  async function handleUploadQueuedKnowledgeFiles() {
    const files = queuedUploadFiles
    if (files.length === 0) return
    setUploadPending(true)
    setSyncError(null)
    const uploadTargetPath = browserPath || '(wiki root)'
    upsertKnowledgeActivity({
      id: 'knowledge-upload-current',
      status: 'running',
      label: `Uploading ${files.length} ${files.length === 1 ? 'file' : 'files'}`,
      detail: `Target: wiki/${uploadTargetPath === '(wiki root)' ? '' : uploadTargetPath}`,
    })
    setModalStatus({
      ...EMPTY_MODAL_STATUS,
      kind: 'syncing',
      message: 'Uploading...',
    })
    try {
      const form = new FormData()
      for (const uploadFile of files) form.append('files', uploadFile)
      form.append('path', browserPath)
      const response = await fetch('/api/knowledge/upload', {
        method: 'POST',
        body: form,
      })
      const payload = (await response.json().catch(() => null)) as
        | Array<KnowledgeUploadResult>
        | { message?: string; error?: string }
        | null
      if (!response.ok) {
        const message =
          payload && !Array.isArray(payload)
            ? payload.message ||
              payload.error ||
              `Upload failed (${response.status})`
            : `Upload failed (${response.status})`
        setModalStatus({
          kind: 'failed',
          message,
          failures: [{ filename: 'upload', error: message }],
          renamed: [],
          ingested: [],
        })
        return
      }
      const results = Array.isArray(payload) ? payload : []
      const failures = results
        .filter(
          (result): result is Extract<KnowledgeUploadResult, { ok: false }> =>
            !result.ok,
        )
        .map((result) => ({
          filename: result.originalName,
          error: result.message,
        }))
      const directWrites = results.filter(
        (
          result,
        ): result is Extract<KnowledgeUploadResult, { kind: 'direct_write' }> =>
          result.ok && result.kind === 'direct_write',
      )
      const staged = results.filter(
        (
          result,
        ): result is Extract<
          KnowledgeUploadResult,
          { kind: 'staged_for_ingest' }
        > => result.ok && result.kind === 'staged_for_ingest',
      )
      for (const result of directWrites) {
        upsertKnowledgeActivity({
          id: `knowledge-upload:${result.path}`,
          status: 'done',
          label: `Uploaded ${result.storedName}`,
          detail: `Source file is in wiki/${result.path}`,
        })
      }
      for (const result of staged) {
        upsertKnowledgeActivity({
          id: `knowledge-upload:${result.retryUploadRef}`,
          status: 'waiting',
          label: `Uploaded ${result.storedName}`,
          detail: `Source file is in wiki/${uploadTargetPath === '(wiki root)' ? result.storedName : `${uploadTargetPath}/${result.storedName}`}; waiting for import to build ${result.targetWikiPath || 'wiki markdown'}`,
          uploadRef: result.retryUploadRef,
        })
      }
      for (const failure of failures) {
        upsertKnowledgeActivity({
          id: `knowledge-upload-failed:${failure.filename}:${Date.now()}`,
          status: 'failed',
          label: `Upload failed: ${failure.filename}`,
          detail: failure.error,
        })
      }
      setReviewRows((current) => [
        ...current,
        ...staged.map((result) => ({
          originalName: result.originalName,
          storedName: result.storedName,
          size: result.size,
          retryUploadRef: result.retryUploadRef,
          targetWikiPath: result.targetWikiPath,
          ingestKind: result.ingestKind,
          canonicalArtifactKind: result.canonicalArtifactKind,
        })),
      ])
      const renamed = directWrites
        .filter((result) => result.renamed)
        .map((result) => ({
          originalName: result.originalName,
          storedName: result.storedName,
        }))
      if (directWrites.length > 0 || staged.length > 0) {
        await queryClient.invalidateQueries({ queryKey: ['knowledge', 'list'] })
        await queryClient.invalidateQueries({
          queryKey: ['knowledge', 'files'],
        })
      }
      if (directWrites.length > 0 || staged.length > 0) {
        setQueuedUploadFiles([])
      }
      setModalStatus({
        kind:
          failures.length > 0
            ? 'failed'
            : staged.length > 0
              ? 'review'
              : 'uploaded',
        message:
          failures.length > 0
            ? 'Some files failed'
            : staged.length > 0
              ? 'Files are staged for review'
              : 'Uploaded',
        failures,
        renamed,
        ingested: [],
      })
      if (failures.length === 0) {
        upsertKnowledgeActivity({
          id: 'knowledge-upload-current',
          status: staged.length > 0 ? 'waiting' : 'done',
          label: staged.length > 0 ? 'Upload complete' : 'Upload complete',
          detail:
            staged.length > 0
              ? `${staged.length} ${staged.length === 1 ? 'file needs' : 'files need'} import before wiki pages are built`
              : 'File tree refreshed',
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      upsertKnowledgeActivity({
        id: `knowledge-upload-error:${Date.now()}`,
        status: 'failed',
        label: 'Upload failed',
        detail: message,
      })
      setModalStatus({
        kind: 'failed',
        message,
        failures: [{ filename: 'upload', error: message }],
        renamed: [],
        ingested: [],
      })
    } finally {
      setUploadPending(false)
    }
  }

  async function handleIngestKnowledgeUpload(uploadRef: string) {
    const reviewRow = reviewRows.find((row) => row.retryUploadRef === uploadRef)
    setIngestPending(true)
    setSyncError(null)
    upsertKnowledgeActivity({
      id: `knowledge-import:${uploadRef}`,
      status: 'running',
      label: `Building wiki page${reviewRow ? ` from ${reviewRow.originalName}` : ''}`,
      detail: `Target: ${reviewRow?.targetWikiPath || browserPath || 'wiki markdown'}`,
      uploadRef,
    })
    setModalStatus({
      ...EMPTY_MODAL_STATUS,
      kind: 'ingesting',
      message: 'Importing...',
    })
    try {
      const response = await fetch('/api/knowledge/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadRef,
          confirmed: true,
          targetDir: browserPath || 'raw',
        }),
      })
      const result = (await response.json()) as KnowledgeIngestResult
      if (!response.ok || !result.ok) {
        const message =
          'message' in result
            ? result.message
            : `Import failed (${response.status})`
        setModalStatus({
          kind: 'failed',
          message,
          failures: [
            { filename: result.originalName || 'import', error: message },
          ],
          renamed: [],
          ingested: [],
        })
        return
      }
      setReviewRows((current) =>
        current.filter((row) => row.retryUploadRef !== uploadRef),
      )
      await queryClient.invalidateQueries({ queryKey: ['knowledge', 'list'] })
      await queryClient.invalidateQueries({ queryKey: ['knowledge', 'files'] })
      upsertKnowledgeActivity({
        id: `knowledge-import:${uploadRef}`,
        status: 'done',
        label: `Built wiki page for ${result.originalName}`,
        detail: `Markdown: wiki/${result.storedMarkdownPath}`,
        uploadRef,
      })
      setModalStatus({
        kind: 'uploaded',
        message: 'Imported',
        failures: [],
        renamed: [],
        ingested: [
          {
            originalName: result.originalName,
            storedMarkdownPath: result.storedMarkdownPath,
            parserMethod: result.parserMethod,
            normalizedDocumentArtifactRef: result.normalizedDocumentArtifactRef,
          },
        ],
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed'
      upsertKnowledgeActivity({
        id: `knowledge-import:${uploadRef}`,
        status: 'failed',
        label: `Wiki build failed${reviewRow ? `: ${reviewRow.originalName}` : ''}`,
        detail: message,
        uploadRef,
      })
      setModalStatus({
        kind: 'failed',
        message,
        failures: [{ filename: 'import', error: message }],
        renamed: [],
        ingested: [],
      })
    } finally {
      setIngestPending(false)
    }
  }

  async function handleSyncSource() {
    if (settingsSource.type !== 'github') return
    setSyncing(true)
    setSyncError(null)
    setModalStatus({
      ...EMPTY_MODAL_STATUS,
      kind: 'syncing',
      message: 'Syncing...',
    })
    try {
      const res = await fetch('/api/knowledge/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: settingsSource,
        }),
      })
      const data = (await res.json()) as {
        error?: string
      }
      if (data.error) {
        setSyncError(data.error)
      } else {
        await queryClient.invalidateQueries({
          queryKey: ['knowledge', 'list'],
        })
        setModalStatus({
          ...EMPTY_MODAL_STATUS,
          kind: 'saved',
          message: 'Synced',
        })
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  async function handleSaveSource() {
    setSavePending(true)
    setSyncError(null)
    setModalStatus({
      ...EMPTY_MODAL_STATUS,
      kind: 'saving',
      message: 'Saving...',
    })
    try {
      const source =
        settingsSource.type === 'local'
          ? {
              type: 'local' as const,
              path: settingsSource.path,
            }
          : {
              type: 'github' as const,
              repo: settingsSource.repo,
              branch: settingsSource.branch || 'main',
              path: settingsSource.path || '',
            }
      const response = await fetch('/api/knowledge/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string
          message?: string
        } | null
        throw new Error(
          payload?.error ||
            payload?.message ||
            `Save failed (${response.status})`,
        )
      }
      await queryClient.invalidateQueries({
        queryKey: ['knowledge', 'list'],
      })
      await refreshKnowledgeConfig()
      await queryClient.invalidateQueries({
        queryKey: ['knowledge', 'files'],
      })
      if (reviewRows.length > 0) {
        setModalStatus({
          ...EMPTY_MODAL_STATUS,
          kind: 'review',
          message: 'Review and import staged files before closing',
        })
        return
      }
      setModalStatus({ ...EMPTY_MODAL_STATUS, kind: 'saved', message: 'Saved' })
      setSettingsOpen(false)
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSavePending(false)
    }
  }

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto flex w-full max-w-[1200px] min-h-0 flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div
          className="px-3 py-3 md:px-4 theme-border-b-1"
          style={{
            backgroundColor: 'var(--theme-bg)',
          }}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div
                className="inline-flex size-9 items-center justify-center rounded-xl theme-border-1"
                style={{
                  backgroundColor: 'var(--theme-card)',
                  color: 'var(--theme-text)',
                }}
              >
                <HugeiconsIcon icon={BrainIcon} size={18} strokeWidth={1.6} />
              </div>
              <div className="relative min-w-0 flex-1">
                <HugeiconsIcon
                  icon={Search01Icon}
                  size={16}
                  strokeWidth={1.7}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--theme-muted)' }}
                />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search knowledge"
                  className="w-full rounded-xl theme-border-1 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-accent-500"
                  style={{
                    backgroundColor: 'var(--theme-card)',
                    color: 'var(--theme-text)',
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setGraphOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:bg-primary-100 dark:hover:bg-neutral-900 theme-border-1"
              style={{
                backgroundColor: 'var(--theme-card)',
                color: 'var(--theme-text)',
              }}
            >
              <HugeiconsIcon icon={Link01Icon} size={16} strokeWidth={1.7} />
              Graph view
            </button>

            <Link
              to="/settings/data-connections"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:bg-primary-100 dark:hover:bg-neutral-900 theme-border-1"
              style={{
                backgroundColor: 'var(--theme-card)',
                color: 'var(--theme-text)',
              }}
            >
              <HugeiconsIcon
                icon={Settings01Icon}
                size={16}
                strokeWidth={1.7}
              />
              <span className="hidden sm:inline">Data Connections</span>
            </Link>

            <DialogRoot open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger
                render={
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:bg-primary-100 dark:hover:bg-neutral-900 theme-border-1"
                    style={{
                      backgroundColor: 'var(--theme-card)',
                      color: 'var(--theme-text)',
                    }}
                    title="Knowledge base settings"
                  >
                    <HugeiconsIcon
                      icon={Settings01Icon}
                      size={16}
                      strokeWidth={1.7}
                    />
                    <span className="hidden sm:inline">Settings</span>
                  </button>
                }
              />
              <DialogContent
                className="w-[min(920px,94vw)] max-w-none theme-border-1"
                popupStyle={{
                  backgroundColor: 'var(--theme-bg)',
                  color: 'var(--theme-text)',
                }}
              >
                <div className="max-h-[calc(90vh-2rem)] space-y-5 overflow-y-auto p-4 sm:p-6">
                  <div>
                    <DialogTitle className="text-base font-semibold">
                      Knowledge Base Settings
                    </DialogTitle>
                    <DialogDescription
                      className="mt-1 text-sm"
                      style={{ color: 'var(--theme-muted)' }}
                    >
                      Choose where your knowledge base is located. Changes take
                      effect immediately.
                    </DialogDescription>
                  </div>

                  <KnowledgeSourceForm
                    viewModel={modalViewModel}
                    onChange={setSettingsSource}
                    onUseWorkspaceDefault={() =>
                      setSettingsSource({ type: 'local', path: 'wiki' })
                    }
                    onSave={handleSaveSource}
                    onSync={
                      settingsSource.type === 'github'
                        ? handleSyncSource
                        : undefined
                    }
                    onDismissStatus={() => {
                      setSyncError(null)
                      setModalStatus(EMPTY_MODAL_STATUS)
                    }}
                  />
                </div>
              </DialogContent>
            </DialogRoot>
          </div>
        </div>

        {knowledgeActivity.length > 0 ? (
          <div className="px-3 pt-3 md:px-4">
            <section className="space-y-2 rounded-xl border border-primary-200 bg-primary-50/80 p-3 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400">
                  Knowledge import status
                </h2>
                <button
                  type="button"
                  onClick={() => setKnowledgeActivity([])}
                  className="rounded-md border border-primary-200 px-2 py-1 text-xs font-medium text-primary-500 hover:bg-primary-100 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900"
                >
                  Clear
                </button>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {knowledgeActivity.map((item) => (
                  <div
                    key={item.id}
                    className="flex min-w-0 items-start justify-between gap-3 rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900/60"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <span
                        className={cn(
                          'mt-1 size-2 shrink-0 rounded-full',
                          item.status === 'running' &&
                            'animate-pulse bg-amber-500',
                          item.status === 'waiting' && 'bg-sky-500',
                          item.status === 'done' && 'bg-emerald-500',
                          item.status === 'failed' && 'bg-red-500',
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-primary-900 dark:text-neutral-100">
                          {item.label}
                        </span>
                        <span className="block truncate text-xs text-primary-500 dark:text-neutral-400">
                          {item.detail}
                        </span>
                      </span>
                    </div>
                    {item.uploadRef &&
                    (item.status === 'waiting' || item.status === 'failed') ? (
                      <button
                        type="button"
                        disabled={ingestPending}
                        onClick={() =>
                          void handleIngestKnowledgeUpload(item.uploadRef!)
                        }
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-accent-600 bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <HugeiconsIcon
                          icon={Upload01Icon}
                          size={14}
                          strokeWidth={1.7}
                        />
                        Build wiki page
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 px-3 pt-3 md:px-4">
          <div className="inline-flex rounded-lg border border-primary-200 bg-primary-50 p-1 dark:border-neutral-800 dark:bg-neutral-950">
            {(['source', 'wiki'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFileViewMode(mode)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
                  fileViewMode === mode
                    ? 'bg-accent-500 text-white shadow-sm'
                    : 'text-primary-600 hover:bg-primary-100 dark:text-neutral-300 dark:hover:bg-neutral-900',
                )}
              >
                {mode === 'source' ? 'Source files' : 'Wiki pages'}
              </button>
            ))}
          </div>
          <div className="text-xs text-primary-500 dark:text-neutral-400">
            Target folder: wiki/{browserPath || ''}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 md:grid-cols-[320px_minmax(0,1fr)] md:p-4">
          <aside className="flex min-h-0 flex-col rounded-2xl border border-primary-200 bg-primary-50 dark:border-neutral-800 dark:bg-neutral-950">
            <button
              type="button"
              className="flex items-center justify-between px-3 py-2 text-left md:cursor-default"
              onClick={() => setMobileTreeOpen((value) => !value)}
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400">
                {fileViewMode === 'source'
                  ? `Source Files (${currentFileCount})`
                  : `Knowledge Pages (${filteredPages.length})`}
              </span>
              <span className="text-primary-500 dark:text-neutral-400 md:hidden">
                <HugeiconsIcon
                  icon={mobileTreeOpen ? ArrowUp01Icon : ArrowDown01Icon}
                  size={16}
                  strokeWidth={1.7}
                />
              </span>
            </button>

            {fileViewMode === 'source' ? (
              <div
                className={cn(
                  'min-h-0 flex-1 px-2 pb-2',
                  !mobileTreeOpen && 'hidden md:block',
                )}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 px-1 text-xs">
                  {(
                    knowledgeFilesQuery.data?.breadcrumb || [
                      { label: 'wiki', path: '' },
                    ]
                  ).map((crumb, index) => (
                    <button
                      key={`${crumb.path}:${index}`}
                      type="button"
                      onClick={() => handleBrowseKnowledgeFolder(crumb.path)}
                      className="rounded-md border border-primary-200 px-2 py-1 font-medium hover:bg-primary-100 dark:border-neutral-800 dark:hover:bg-neutral-900"
                    >
                      {crumb.label}
                    </button>
                  ))}
                </div>
                <section className="rounded-xl border border-primary-200 bg-primary-50/80 p-1 dark:border-neutral-800 dark:bg-neutral-900/60">
                  {filesLoading ? (
                    <StateBox label="Loading source files..." />
                  ) : filesError ? (
                    <StateBox label={filesError} error />
                  ) : knowledgeFileTreeRoot.children?.length ? (
                    <KnowledgeFileTree
                      entry={knowledgeFileTreeRoot}
                      expanded={expandedFilePaths}
                      selectedPath={browserPath}
                      onToggle={toggleFileTreePath}
                      onSelectFolder={handleBrowseKnowledgeFolder}
                    />
                  ) : (
                    <StateBox label="No source files found" />
                  )}
                </section>
              </div>
            ) : !knowledgeExists && !listQuery.isLoading ? (
              <div className="px-3 pb-3">
                <EmptyKnowledgeState knowledgeRoot={knowledgeRoot} />
              </div>
            ) : searchTerm ? (
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-primary-400 dark:text-neutral-500">
                  Search Results
                </div>
                <div className="space-y-1">
                  {searchQuery.isLoading ? (
                    <StateBox label="Searching knowledge..." />
                  ) : searchResults.length === 0 ? (
                    <StateBox label="No matches found" />
                  ) : (
                    searchResults.map((result, index) => (
                      <button
                        key={`${result.path}:${result.line}:${index}`}
                        type="button"
                        onClick={() =>
                          handleSelectPath(result.path, result.line, result)
                        }
                        className="w-full rounded-lg border border-primary-200 bg-primary-50/80 px-2.5 py-2 text-left hover:border-primary-300 hover:bg-primary-100 dark:border-neutral-800 dark:bg-neutral-900/60 dark:hover:border-neutral-700 dark:hover:bg-neutral-900"
                      >
                        <div className="truncate text-[11px] text-primary-500 dark:text-neutral-400">
                          {result.title || result.path}:{result.line}
                        </div>
                        <div className="mt-0.5 line-clamp-3 text-xs text-primary-700 dark:text-neutral-200">
                          {highlightMatch(result.text, searchTerm).map(
                            (part, partIndex) => (
                              <span
                                key={partIndex}
                                className={
                                  part.hit
                                    ? 'rounded bg-yellow-300/30 px-0.5 text-yellow-200'
                                    : undefined
                                }
                              >
                                {part.text || ' '}
                              </span>
                            ),
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  'min-h-0 flex-1 px-2 pb-2',
                  !mobileTreeOpen && 'hidden md:block',
                )}
              >
                <div className="space-y-3 overflow-y-auto pr-1 md:h-full">
                  <section className="rounded-xl border border-primary-200 bg-primary-50/80 p-2 dark:border-neutral-800 dark:bg-neutral-900/60">
                    <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-primary-400 dark:text-neutral-500">
                      Tags
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <TagPill
                        label="All"
                        count={pages.length}
                        active={selectedTag == null}
                        onClick={() => setSelectedTag(null)}
                      />
                      {popularTags.map(([tag, count]) => (
                        <TagPill
                          key={tag}
                          label={tag}
                          count={count}
                          active={selectedTag === tag}
                          onClick={() => setSelectedTag(tag)}
                        />
                      ))}
                    </div>
                  </section>

                  <section className="rounded-xl border border-primary-200 bg-primary-50/80 p-1 dark:border-neutral-800 dark:bg-neutral-900/60">
                    {listQuery.isLoading ? (
                      <StateBox label="Loading knowledge pages..." />
                    ) : listQuery.error instanceof Error ? (
                      <StateBox label={listQuery.error.message} error />
                    ) : filteredPages.length === 0 ? (
                      <StateBox
                        label={
                          selectedTag
                            ? 'No pages match this tag'
                            : 'No markdown pages found'
                        }
                      />
                    ) : (
                      <TreeSection
                        node={tree}
                        selectedPath={selectedPath}
                        onSelectPath={(pathValue) =>
                          handleSelectPath(pathValue)
                        }
                      />
                    )}
                  </section>
                </div>
              </div>
            )}
          </aside>

          <section className="min-h-0 rounded-2xl border border-primary-200 bg-primary-50 dark:border-neutral-800 dark:bg-neutral-950">
            {fileViewMode === 'source' ? (
              <div className="flex h-full min-h-0 flex-col">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary-200 px-3 py-2 dark:border-neutral-800">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-primary-900 dark:text-neutral-100">
                      Source files in wiki/{browserPath || ''}
                    </div>
                    <div className="text-xs text-primary-400 dark:text-neutral-500">
                      {currentDirectoryCount} folders · {currentFileCount} files
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary-200 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-primary-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800">
                      <HugeiconsIcon
                        icon={Upload01Icon}
                        size={14}
                        strokeWidth={1.7}
                      />
                      Choose files
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        accept={KNOWLEDGE_UPLOAD_EXTENSIONS.join(',')}
                        disabled={uploadPending}
                        onChange={(event) => {
                          const files = Array.from(event.target.files ?? [])
                          event.target.value = ''
                          if (files.length > 0) handleQueueUploadFiles(files)
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleUploadQueuedKnowledgeFiles()}
                      disabled={uploadPending || queuedUploadFiles.length === 0}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-accent-600 bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <HugeiconsIcon
                        icon={Upload01Icon}
                        size={14}
                        strokeWidth={1.7}
                      />
                      {uploadPending ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto p-3">
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
                    <div className="space-y-3">
                      <section className="rounded-xl border border-primary-200 bg-primary-50/80 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400">
                          Current folder
                        </div>
                        {filesLoading ? (
                          <StateBox label="Loading folder..." />
                        ) : filesError ? (
                          <StateBox label={filesError} error />
                        ) : currentDirectoryEntries.length === 0 ? (
                          <StateBox
                            label={
                              fileViewMode === 'source'
                                ? 'No source files in this folder'
                                : 'No wiki files in this folder'
                            }
                          />
                        ) : (
                          <div className="divide-y divide-primary-200 overflow-hidden rounded-lg border border-primary-200 dark:divide-neutral-800 dark:border-neutral-800">
                            {currentDirectoryEntries.map((entry) => (
                              <button
                                key={entry.path}
                                type="button"
                                onClick={() => {
                                  if (entry.kind === 'directory') {
                                    handleBrowseKnowledgeFolder(entry.path)
                                    setExpandedFilePaths((current) => {
                                      const next = new Set(current)
                                      next.add(entry.path)
                                      return next
                                    })
                                  }
                                }}
                                className={cn(
                                  'flex w-full items-center justify-between gap-3 bg-primary-50 px-3 py-2 text-left text-sm transition-colors dark:bg-neutral-950',
                                  entry.kind === 'directory' &&
                                    'hover:bg-primary-100 dark:hover:bg-neutral-900',
                                )}
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <HugeiconsIcon
                                    icon={
                                      entry.kind === 'directory'
                                        ? Folder01Icon
                                        : File01Icon
                                    }
                                    size={16}
                                    strokeWidth={1.7}
                                    className="shrink-0"
                                  />
                                  <span className="min-w-0 truncate">
                                    {entry.name}
                                  </span>
                                </span>
                                <span className="shrink-0 text-xs text-primary-400 dark:text-neutral-500">
                                  {entry.kind === 'file'
                                    ? formatBytes(entry.size)
                                    : 'Folder'}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </section>

                      {reviewRows.length > 0 ? (
                        <section className="space-y-2 rounded-xl border border-primary-200 bg-primary-50/80 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                          <div className="text-xs font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400">
                            Ready to build
                          </div>
                          {reviewRows.map((row) => (
                            <div
                              key={row.retryUploadRef}
                              className="flex items-start justify-between gap-3 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950"
                            >
                              <div className="min-w-0">
                                <div className="truncate font-medium text-primary-900 dark:text-neutral-100">
                                  {row.originalName}
                                </div>
                                <div className="text-xs text-primary-500 dark:text-neutral-400">
                                  {row.ingestKind} · {formatBytes(row.size)}
                                </div>
                                {row.targetWikiPath ? (
                                  <div className="mt-1 truncate text-xs text-primary-500 dark:text-neutral-400">
                                    {row.targetWikiPath}
                                  </div>
                                ) : null}
                              </div>
                              <div className="flex shrink-0 gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleIngestKnowledgeUpload(
                                      row.retryUploadRef,
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-accent-600 bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent-600"
                                >
                                  <HugeiconsIcon
                                    icon={Upload01Icon}
                                    size={14}
                                    strokeWidth={1.7}
                                  />
                                  Build wiki page
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReviewRows((current) =>
                                      current.filter(
                                        (item) =>
                                          item.retryUploadRef !==
                                          row.retryUploadRef,
                                      ),
                                    )
                                  }
                                  className="rounded-lg border border-primary-200 px-2 py-1.5 text-xs font-medium hover:bg-primary-100 dark:border-neutral-800 dark:hover:bg-neutral-900"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </section>
                      ) : null}
                    </div>

                    <aside className="space-y-3">
                      <section className="space-y-2 rounded-xl border border-primary-200 bg-primary-50/80 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                        <div className="text-xs font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400">
                          Create folder
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newFolderName}
                            onChange={(event) =>
                              setNewFolderName(event.target.value)
                            }
                            placeholder="Folder name"
                            className="min-w-0 flex-1 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
                          />
                          <button
                            type="button"
                            disabled={!newFolderName.trim()}
                            onClick={async () => {
                              const nextName = newFolderName.trim()
                              if (!nextName) return
                              await handleCreateKnowledgeFolder(nextName)
                              setNewFolderName('')
                            }}
                            className="rounded-lg border border-primary-200 px-3 py-2 text-sm font-semibold hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                          >
                            Create
                          </button>
                        </div>
                      </section>

                      <section className="space-y-2 rounded-xl border border-primary-200 bg-primary-50/80 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400">
                            Upload queue
                          </div>
                          {queuedUploadFiles.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setQueuedUploadFiles([])}
                              className="text-xs font-semibold text-primary-600 hover:text-primary-900 dark:text-neutral-300 dark:hover:text-neutral-100"
                            >
                              Clear
                            </button>
                          ) : null}
                        </div>
                        {queuedUploadView.length === 0 ? (
                          <div className="text-sm text-primary-500 dark:text-neutral-400">
                            No files queued.
                          </div>
                        ) : (
                          <div className="max-h-44 space-y-1 overflow-y-auto">
                            {queuedUploadView.map((file) => (
                              <div
                                key={`${file.name}:${file.size}`}
                                className="flex items-center justify-between gap-3 rounded-md border border-primary-200 px-2 py-1.5 text-xs dark:border-neutral-800"
                              >
                                <span className="min-w-0 truncate">
                                  {file.name}
                                </span>
                                <span className="shrink-0 text-primary-400 dark:text-neutral-500">
                                  {formatBytes(file.size)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    </aside>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-primary-200 px-3 py-2 dark:border-neutral-800">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-primary-900 dark:text-neutral-100">
                      {page?.title || selectedPath || 'Select a page'}
                    </div>
                    {page ? (
                      <div className="text-xs text-primary-400 dark:text-neutral-500">
                        {page.path} · {formatBytes(page.size)} ·{' '}
                        {formatDate(page.updated || page.modified)}
                      </div>
                    ) : null}
                  </div>
                  {page ? (
                    <a
                      href={askUrl}
                      className="inline-flex items-center gap-1.5 rounded-md border border-primary-200 px-3 py-1.5 text-xs font-semibold transition-colors hover:border-primary-300 hover:bg-primary-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
                    >
                      <HugeiconsIcon
                        icon={Message01Icon}
                        size={14}
                        strokeWidth={1.7}
                      />
                      Ask agent about this
                    </a>
                  ) : null}
                </div>

                <div className="h-full overflow-auto p-2 md:p-3">
                  {listQuery.isLoading ? (
                    <StateBox label="Loading knowledge base..." />
                  ) : listQuery.error instanceof Error ? (
                    <StateBox label={listQuery.error.message} error />
                  ) : !knowledgeExists ? (
                    <EmptyKnowledgeState knowledgeRoot={knowledgeRoot} />
                  ) : !selectedPath ? (
                    <StateBox label="Select a page to start browsing" />
                  ) : readQuery.isLoading ? (
                    <StateBox label="Loading page..." />
                  ) : readQuery.error instanceof Error ? (
                    <StateBox label={readQuery.error.message} error />
                  ) : !page ? (
                    <StateBox label="Page not found" error />
                  ) : (
                    <div
                      className="rounded-xl theme-border-1"
                      style={{
                        backgroundColor: 'var(--theme-card)',
                      }}
                    >
                      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_260px]">
                        <div className="min-w-0 space-y-4">
                          {focusedResult && focusedResult.path === page.path ? (
                            <div className="rounded-xl border border-yellow-300/40 bg-yellow-300/10 px-3 py-2 text-sm text-primary-900 dark:text-yellow-50">
                              <div className="font-medium">
                                Search hit at line {focusLine}
                              </div>
                              <div className="mt-1 text-xs opacity-80">
                                {focusedResult.text}
                              </div>
                            </div>
                          ) : null}

                          {page.summary ? (
                            <div className="rounded-xl border border-primary-200 bg-primary-50/70 px-3 py-2 text-sm text-primary-700 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300">
                              {page.summary}
                            </div>
                          ) : null}

                          <Markdown
                            className="gap-3"
                            components={{
                              a: function KnowledgeLink({ children, href }) {
                                if (href?.startsWith('wiki:')) {
                                  const resolvedPath = resolveWikiPath(
                                    href.slice('wiki:'.length),
                                  )
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (resolvedPath)
                                          handleSelectPath(resolvedPath)
                                      }}
                                      className="inline-flex items-center gap-1 text-primary-950 underline decoration-primary-300 underline-offset-4 transition-colors hover:text-primary-950 hover:decoration-primary-500 dark:text-neutral-100"
                                    >
                                      <HugeiconsIcon
                                        icon={Link01Icon}
                                        size={14}
                                        strokeWidth={1.7}
                                      />
                                      <span>{children}</span>
                                    </button>
                                  )
                                }

                                return (
                                  <a
                                    href={href}
                                    className="text-primary-950 underline decoration-primary-300 underline-offset-4 transition-colors hover:text-primary-950 hover:decoration-primary-500"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {children}
                                  </a>
                                )
                              },
                            }}
                          >
                            {processedContent}
                          </Markdown>

                          <section className="rounded-xl border border-primary-200 bg-primary-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary-900 dark:text-neutral-100">
                              <HugeiconsIcon
                                icon={Link01Icon}
                                size={16}
                                strokeWidth={1.7}
                              />
                              Backlinks
                            </div>
                            {backlinks.length === 0 ? (
                              <div className="text-sm text-primary-500 dark:text-neutral-400">
                                No pages link here yet.
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {backlinks.map((backlink) => {
                                  const backlinkPath =
                                    resolveWikiPath(backlink) || backlink
                                  return (
                                    <button
                                      key={backlink}
                                      type="button"
                                      onClick={() =>
                                        handleSelectPath(backlinkPath)
                                      }
                                      className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 transition-colors hover:border-primary-300 hover:bg-primary-100 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
                                    >
                                      {backlink}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </section>
                        </div>

                        <aside className="space-y-3">
                          <MetadataCard label="Type" value={page.type} />
                          <MetadataCard label="Domain" value={page.domain} />
                          <MetadataCard label="Status" value={page.status} />
                          <MetadataCard
                            label="Created"
                            value={formatDate(page.created)}
                          />
                          <MetadataCard
                            label="Updated"
                            value={formatDate(page.updated || page.modified)}
                          />
                          <MetadataCard
                            label="Size"
                            value={formatBytes(page.size)}
                          />
                          <div className="rounded-xl border border-primary-200 bg-primary-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                            <div className="text-xs font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400">
                              Tags
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {page.tags.length === 0 ? (
                                <span className="text-sm text-primary-500 dark:text-neutral-400">
                                  No tags
                                </span>
                              ) : (
                                page.tags.map((tag) => (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={() => setSelectedTag(tag)}
                                    className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 transition-colors hover:border-primary-300 hover:bg-primary-100 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
                                  >
                                    #{tag}
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                          <div className="rounded-xl border border-primary-200 bg-primary-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400">
                              <HugeiconsIcon
                                icon={CodeIcon}
                                size={14}
                                strokeWidth={1.7}
                              />
                              Wikilinks
                            </div>
                            {page.wikilinks.length === 0 ? (
                              <div className="text-sm text-primary-500 dark:text-neutral-400">
                                No outbound links
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {page.wikilinks.map((link) => {
                                  const linkPath = resolveWikiPath(link) || link
                                  return (
                                    <button
                                      key={link}
                                      type="button"
                                      onClick={() => handleSelectPath(linkPath)}
                                      className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 transition-colors hover:border-primary-300 hover:bg-primary-100 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
                                    >
                                      {link}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </aside>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>

        <DialogRoot open={graphOpen} onOpenChange={setGraphOpen}>
          <DialogContent className="w-[min(980px,94vw)] max-w-none p-0">
            <div className="border-b border-primary-200 px-5 py-4 dark:border-neutral-800">
              <DialogTitle>Knowledge graph</DialogTitle>
              <DialogDescription>
                Page relationships from wiki links. Click any node to open that
                page.
              </DialogDescription>
            </div>
            <div className="p-5">
              {graphQuery.isLoading ? (
                <StateBox label="Loading graph..." />
              ) : graphQuery.error instanceof Error ? (
                <StateBox label={graphQuery.error.message} error />
              ) : (graphQuery.data?.nodes?.length ?? 0) === 0 ? (
                <StateBox label="No graph data yet" />
              ) : (
                <GraphCanvas
                  nodes={graphQuery.data?.nodes ?? []}
                  edges={graphQuery.data?.edges ?? []}
                  onSelect={(pathValue) => {
                    setGraphOpen(false)
                    handleSelectPath(pathValue)
                  }}
                />
              )}
            </div>
          </DialogContent>
        </DialogRoot>
      </div>
    </div>
  )
}

function TreeSection({
  node,
  selectedPath,
  onSelectPath,
  depth = 0,
}: {
  node: TreeNode
  selectedPath: string | null
  onSelectPath: (path: string) => void
  depth?: number
}) {
  return (
    <div className={cn('space-y-1', depth > 0 && 'mt-1')}>
      {node.path ? (
        <div
          className="flex items-center gap-2 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <HugeiconsIcon icon={Folder01Icon} size={14} strokeWidth={1.7} />
          <span className="truncate">{node.name}</span>
        </div>
      ) : null}

      {node.pages.map((page) => (
        <button
          key={page.path}
          type="button"
          onClick={() => onSelectPath(page.path)}
          className={cn(
            'block w-full rounded-lg border px-2.5 py-2 text-left transition-colors',
            selectedPath === page.path
              ? 'border-accent-500/70 bg-accent-500/10'
              : 'border-primary-200 bg-primary-50/80 hover:border-primary-300 hover:bg-primary-100 dark:border-neutral-800 dark:bg-neutral-900/60 dark:hover:border-neutral-700 dark:hover:bg-neutral-900',
          )}
          style={{ marginLeft: depth > 0 ? depth * 12 : 0 }}
        >
          <div className="flex items-start gap-2">
            <HugeiconsIcon
              icon={File01Icon}
              size={16}
              strokeWidth={1.7}
              className="mt-0.5 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-primary-900 dark:text-neutral-100">
                {page.title}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {page.type ? <InlineBadge label={page.type} /> : null}
                {page.status ? <InlineBadge label={page.status} /> : null}
              </div>
            </div>
          </div>
        </button>
      ))}

      {node.folders.map((child) => (
        <TreeSection
          key={child.path}
          node={child}
          selectedPath={selectedPath}
          onSelectPath={onSelectPath}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}

function KnowledgeFileTree({
  entry,
  depth = 0,
  expanded,
  selectedPath,
  onToggle,
  onSelectFolder,
}: {
  entry: KnowledgeTreeEntry
  depth?: number
  expanded: Set<string>
  selectedPath: string
  onToggle: (path: string) => void
  onSelectFolder: (path: string) => void
}) {
  const isDirectory = entry.kind === 'directory'
  const isExpanded = expanded.has(entry.path)
  const isSelected = selectedPath === entry.path
  const paddingLeft = 12 + depth * 14

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (isDirectory) {
            onSelectFolder(entry.path)
            onToggle(entry.path)
          }
        }}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm transition-colors',
          isSelected
            ? 'bg-accent-500/15 text-accent-600 dark:text-accent-400'
            : 'text-primary-900 hover:bg-primary-100 dark:text-neutral-200 dark:hover:bg-neutral-900',
          !isDirectory && 'cursor-default opacity-80',
        )}
        style={{ paddingLeft }}
        aria-current={isSelected ? 'true' : undefined}
      >
        {isDirectory ? (
          <span
            className={cn(
              'w-3 shrink-0 text-[10px] transition-transform',
              isExpanded && 'rotate-90',
            )}
          >
            ▶
          </span>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <HugeiconsIcon
          icon={isDirectory ? Folder01Icon : File01Icon}
          size={15}
          strokeWidth={1.7}
          className="shrink-0"
        />
        <span className="min-w-0 flex-1 truncate">{entry.name}</span>
      </button>

      {isDirectory && isExpanded && entry.children?.length ? (
        <div>
          {entry.children.map((child) => (
            <KnowledgeFileTree
              key={child.path || 'wiki'}
              entry={child}
              depth={depth + 1}
              expanded={expanded}
              selectedPath={selectedPath}
              onToggle={onToggle}
              onSelectFolder={onSelectFolder}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function InlineBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-primary-200 bg-primary-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
      {label}
    </span>
  )
}

function TagPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-accent-500/70 bg-accent-500/10 text-primary-900 dark:text-neutral-100'
          : 'border-primary-200 bg-primary-50 text-primary-600 hover:border-primary-300 hover:bg-primary-100 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-900',
      )}
    >
      {label} <span className="opacity-70">{count}</span>
    </button>
  )
}

function MetadataCard({
  label,
  value,
}: {
  label: string
  value?: string | null
}) {
  if (!value) return null
  return (
    <div className="rounded-xl border border-primary-200 bg-primary-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="text-xs font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400">
        {label}
      </div>
      <div className="mt-1 text-sm text-primary-900 dark:text-neutral-100">
        {value}
      </div>
    </div>
  )
}

function EmptyKnowledgeState({ knowledgeRoot }: { knowledgeRoot: string }) {
  return (
    <div className="flex min-h-32 flex-col justify-center rounded-xl border border-primary-200 bg-primary-50 px-4 py-5 text-sm text-primary-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
      <div className="text-base font-semibold text-primary-900 dark:text-neutral-100">
        No wiki pages found
      </div>
      <p className="mt-2 text-pretty">
        Markdown pages can live anywhere under <code>{knowledgeRoot}</code>,
        including subfolders. Uploaded PDF and DOCX files appear after you build
        them into Markdown pages.
      </p>
      <a
        href="https://karpathy.ai/"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary-900 underline decoration-primary-300 underline-offset-4 hover:decoration-primary-500 dark:text-neutral-100"
      >
        <HugeiconsIcon icon={Link01Icon} size={14} strokeWidth={1.7} />
        See the Karpathy LLM wiki pattern
      </a>
    </div>
  )
}

function StateBox({ label, error }: { label: string; error?: boolean }) {
  return (
    <div
      className={cn(
        'flex min-h-32 items-center justify-center rounded-xl border px-4 text-sm',
        error
          ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300'
          : 'border-primary-200 bg-primary-50 text-primary-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400',
      )}
    >
      {label}
    </div>
  )
}
