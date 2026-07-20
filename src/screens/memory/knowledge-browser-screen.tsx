import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  BrainIcon,
  CodeIcon,
  Delete01Icon,
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
  KnowledgeTreeEntry,
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
import { useSettingsStore } from '@/hooks/use-settings'

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
  sourceWikiPath?: string
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
      sourceFilePath?: string
      parserMethod: string
      normalizedDocumentArtifactRef: string
    }
  | {
      ok: false
      originalName?: string
      code?: string
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

type GovernedKnowledgeEvidenceStep = {
  stage?: string
  ref?: string | null
  hash?: string | null
}

type GovernedKnowledgeArtifact = {
  artifact_id?: string
  source_ref?: string
  semantic_tier?: string
  authority_domain?: string
  tag_authority_level?: string
  source_type?: string
  authority_origin?: string
  ingestion_status?: string
  effective_from?: string
  source_version?: string
  extraction_method?: string
  curator?: string
  claim_count?: number
  anchors?: Array<Record<string, unknown>>
  ambiguities?: Array<string>
  evidence_chain?: Array<GovernedKnowledgeEvidenceStep>
}

type KnowledgeAccessLineageResponse = {
  active_knowledge_artifacts?: {
    items?: Array<GovernedKnowledgeArtifact>
  }
}

type PromotionTargetAuthorityLevel = 'T2' | 'T3' | 'T4' | 'T5'

type KnowledgePromotionRequestResult = {
  ok?: boolean
  requestId?: string
  approvalId?: string
  status?: 'PENDING_REVIEW' | 'NEEDS_SOURCE_REGISTRATION' | 'APPROVED'
  requestPath?: string
  approvalPath?: string
  approvedArtifact?: GovernedKnowledgeArtifact
  blockers?: Array<string>
  error?: string
}

type PromotionGateOverride = {
  reason: string
  recordedAt: string
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

const KNOWLEDGE_COPY = {
  en: {
    searchPlaceholder: 'Search knowledge',
    graphView: 'Graph view',
    dataConnections: 'Data Connections',
    settings: 'Settings',
    knowledgeSettingsTitle: 'Knowledge Base Settings',
    knowledgeSettingsDescription:
      'Choose where your knowledge base is located. Changes take effect immediately.',
    sourceFiles: 'Source files',
    wikiPages: 'Wiki pages',
    targetFolder: 'Target folder: wiki/',
    sourceFilesCount: (count: number) => `Source Files (${count})`,
    knowledgePagesCount: (count: number) => `Knowledge Pages (${count})`,
    newFolder: 'New folder',
    loadingSourceFiles: 'Loading source files...',
    noSourceFiles: 'No source files found',
    searchResults: 'Search Results',
    searchingKnowledge: 'Searching knowledge...',
    noMatchesFound: 'No matches found',
    tags: 'Tags',
    all: 'All',
    loadingKnowledgePages: 'Loading knowledge pages...',
    noPagesMatchTag: 'No pages match this tag',
    noMarkdownPages: 'No markdown pages found',
    sourceFilesIn: 'Source files in wiki/',
    folderSummary: (folders: number, files: number, pending: number) =>
      `${folders} folders · ${files} files${pending > 0 ? ` · ${pending} pending` : ''}`,
    chooseFiles: 'Choose files',
    uploading: 'Uploading...',
    upload: 'Upload',
    currentFolder: 'Current folder',
    loadingFolder: 'Loading folder...',
    noSourceFilesInFolder: 'No source files in this folder',
    queued: 'Queued',
    remove: 'Remove',
    builds: 'Builds',
    building: 'Building',
    failed: 'Failed',
    needsBuild: 'Needs build',
    build: 'Build',
    deleting: 'Deleting',
    delete: 'Delete',
    selectPage: 'Select a page',
    askAgent: 'Ask agent about this',
    loadingKnowledgeBase: 'Loading knowledge base...',
    selectPageToStart: 'Select a page to start browsing',
    loadingPage: 'Loading page...',
    pageNotFound: 'Page not found',
    searchHitAtLine: (line: number | null) => `Search hit at line ${line}`,
    backlinks: 'Backlinks',
    noBacklinks: 'No pages link here yet.',
    noTags: 'No tags',
    wikilinks: 'Wikilinks',
    noOutboundLinks: 'No outbound links',
    newFolderTitle: 'New Folder',
    createFolderInside: 'Create a folder inside wiki/',
    cancel: 'Cancel',
    save: 'Save',
    graphTitle: 'Knowledge graph',
    graphDescription:
      'Page relationships from wiki links. Click any node to open that page.',
    loadingGraph: 'Loading graph...',
    noGraphData: 'No graph data yet',
  },
  zh: {
    searchPlaceholder: '搜索知识',
    graphView: '图谱视图',
    dataConnections: '数据连接',
    settings: '设置',
    knowledgeSettingsTitle: '知识库设置',
    knowledgeSettingsDescription:
      '选择 knowledge base 的位置。更改会立即生效。',
    sourceFiles: '源文件',
    wikiPages: 'wiki 页面',
    targetFolder: '目标文件夹：wiki/',
    sourceFilesCount: (count: number) => `源文件（${count}）`,
    knowledgePagesCount: (count: number) => `知识页面（${count}）`,
    newFolder: '新建文件夹',
    loadingSourceFiles: '正在加载源文件...',
    noSourceFiles: '未找到源文件',
    searchResults: '搜索结果',
    searchingKnowledge: '正在搜索知识...',
    noMatchesFound: '没有匹配结果',
    tags: '标签',
    all: '全部',
    loadingKnowledgePages: '正在加载知识页面...',
    noPagesMatchTag: '没有页面匹配此标签',
    noMarkdownPages: '未找到 Markdown 页面',
    sourceFilesIn: 'wiki/ 中的源文件',
    folderSummary: (folders: number, files: number, pending: number) =>
      `${folders} 个文件夹 · ${files} 个文件${pending > 0 ? ` · ${pending} 个待处理` : ''}`,
    chooseFiles: '选择文件',
    uploading: '上传中...',
    upload: '上传',
    currentFolder: '当前文件夹',
    loadingFolder: '正在加载文件夹...',
    noSourceFilesInFolder: '此文件夹中没有源文件',
    queued: '已排队',
    remove: '移除',
    builds: '生成',
    building: '构建中',
    failed: '失败',
    needsBuild: '需要构建',
    build: '构建',
    deleting: '删除中',
    delete: '删除',
    selectPage: '选择页面',
    askAgent: '询问 agent',
    loadingKnowledgeBase: '正在加载知识库...',
    selectPageToStart: '选择一个页面开始浏览',
    loadingPage: '正在加载页面...',
    pageNotFound: '页面未找到',
    searchHitAtLine: (line: number | null) => `搜索命中第 ${line} 行`,
    backlinks: '反向链接',
    noBacklinks: '还没有页面链接到这里。',
    noTags: '没有标签',
    wikilinks: 'Wikilinks',
    noOutboundLinks: '没有出站链接',
    newFolderTitle: '新建文件夹',
    createFolderInside: '在 wiki/ 中创建文件夹：',
    cancel: '取消',
    save: '保存',
    graphTitle: '知识图谱',
    graphDescription: '来自 wiki links 的页面关系。点击节点打开对应页面。',
    loadingGraph: '正在加载图谱...',
    noGraphData: '还没有图谱数据',
  },
} as const

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

function getParentWikiPath(value?: string): string {
  if (!value) return ''
  const normalized = value
    .split('\\')
    .join('/')
    .replace(/^\/+|\/+$/g, '')
  const index = normalized.lastIndexOf('/')
  return index >= 0 ? normalized.slice(0, index) : ''
}

function isMarkdownKnowledgeFile(entry: KnowledgeTreeEntry): boolean {
  const lower = entry.name.toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.markdown')
}

function filterKnowledgeFolderTree(
  entry: KnowledgeTreeEntry,
): KnowledgeTreeEntry | null {
  if (entry.kind === 'file') {
    return null
  }

  const children = (entry.children ?? [])
    .map((child) => filterKnowledgeFolderTree(child))
    .filter((child): child is KnowledgeTreeEntry => Boolean(child))
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

function shortEvidenceValue(value?: string | null): string {
  if (!value) return 'not recorded'
  if (value.length <= 54) return value
  return `${value.slice(0, 26)}...${value.slice(-18)}`
}

function normalizeLineageToken(value?: string | null): string {
  return (value || '').toLowerCase().replace(/\\/g, '/')
}

function pageMatchesPromotedArtifact(
  artifact: GovernedKnowledgeArtifact,
  pagePath: string,
  content: string,
): boolean {
  const pageNeedles = [
    pagePath,
    pagePath.replace(/\.md$/i, '.pdf'),
    pagePath.replace(/\.md$/i, ''),
  ].map(normalizeLineageToken)
  const haystacks = [
    artifact.source_ref,
    artifact.source_version,
    artifact.artifact_id,
    ...(artifact.evidence_chain || []).flatMap((step) => [step.ref, step.hash]),
    ...(artifact.anchors || []).flatMap((anchor) =>
      Object.values(anchor).map((value) => String(value)),
    ),
    content,
  ].map(normalizeLineageToken)

  return haystacks.some((haystack) =>
    pageNeedles.some((needle) => needle && haystack.includes(needle)),
  )
}

function gateLabel(stage?: string): string {
  return (stage || 'evidence')
    .split('_')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')
}

function displayAuthorityLevel(value?: string | null): string {
  if (!value) return 'Unlabeled'
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')
}

function extractAuthorityLevel(content: string): string | null {
  const match = content.match(/^>\s*Authority level:\s*(.+)$/im)
  return match?.[1]?.trim() || null
}

function extractQuotedMetadata(content: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = content.match(new RegExp(`^>\\s*${escaped}:\\s*(.+)$`, 'im'))
  return match?.[1]?.trim() || null
}

function defaultPromotionJustification(content: string): string {
  return extractQuotedMetadata(content, 'Human curation justification') || ''
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
  const locale = useSettingsStore((state) => state.settings.locale)
  const copy = locale === 'zh' ? KNOWLEDGE_COPY.zh : KNOWLEDGE_COPY.en
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
  const [manualCurationJustifications, setManualCurationJustifications] =
    useState<Record<string, string>>({})
  const [fileViewMode, setFileViewMode] =
    useState<KnowledgeFileViewMode>('source')
  const [folderPromptOpen, setFolderPromptOpen] = useState(false)
  const [folderPromptValue, setFolderPromptValue] = useState('')
  const [deletingFilePaths, setDeletingFilePaths] = useState<Set<string>>(
    () => new Set(),
  )
  const [expandedFilePaths, setExpandedFilePaths] = useState<Set<string>>(
    () => new Set(['']),
  )
  const [knowledgeActivity, setKnowledgeActivity] = useState<
    Array<KnowledgeActivityRow>
  >([])
  const [resolvedConfig, setResolvedConfig] =
    useState<KnowledgeResolvedConfig | null>(null)
  const [selectedPromotionGate, setSelectedPromotionGate] = useState(0)
  const [overrideDraft, setOverrideDraft] = useState('')
  const [promotionGateOverrides, setPromotionGateOverrides] = useState<
    Record<string, PromotionGateOverride>
  >(() => {
    if (typeof window === 'undefined') return {}
    try {
      const raw = window.localStorage.getItem('knowledge-promotion-overrides')
      const parsed = raw ? JSON.parse(raw) : {}
      return parsed && typeof parsed === 'object'
        ? (parsed as Record<string, PromotionGateOverride>)
        : {}
    } catch {
      return {}
    }
  })
  const [demoApprovedArtifacts, setDemoApprovedArtifacts] = useState<
    Record<string, GovernedKnowledgeArtifact>
  >(() => {
    if (typeof window === 'undefined') return {}
    try {
      const raw = window.localStorage.getItem(
        'knowledge-latest-demo-approved-artifact',
      )
      const parsed = raw
        ? (JSON.parse(raw) as {
            pagePath?: string
            artifact?: GovernedKnowledgeArtifact
          })
        : null
      return parsed?.pagePath && parsed.artifact
        ? { [parsed.pagePath]: parsed.artifact }
        : {}
    } catch {
      return {}
    }
  })
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

  const knowledgeLineageQuery = useQuery({
    queryKey: ['knowledge', 'promoted-lineage'],
    queryFn: () =>
      readJson<KnowledgeAccessLineageResponse>(
        '/api/semantier-proxy/organizations/knowledge-access',
      ),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
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
    enabled: settingsSource.type === 'local',
  })

  const knowledgeFilesTreeQuery = useQuery({
    queryKey: ['knowledge', 'files', 'tree'],
    queryFn: () =>
      readJson<KnowledgeFilesTreeResponse>('/api/knowledge/files?tree=1'),
    enabled: settingsSource.type === 'local',
  })

  const page = readQuery.data?.page ?? null
  const content = readQuery.data?.content ?? ''
  const backlinks = readQuery.data?.backlinks ?? []
  const processedContent = useMemo(
    () => preprocessWikiMarkdown(content),
    [content],
  )
  const demoApprovedArtifact = selectedPath
    ? demoApprovedArtifacts[selectedPath]
    : null
  const promotedArtifact = useMemo(() => {
    if (!selectedPath || !content) return null
    if (demoApprovedArtifact) return demoApprovedArtifact
    const artifacts =
      knowledgeLineageQuery.data?.active_knowledge_artifacts?.items || []
    return (
      artifacts.find((artifact) =>
        pageMatchesPromotedArtifact(artifact, selectedPath, content),
      ) || null
    )
  }, [content, demoApprovedArtifact, knowledgeLineageQuery.data, selectedPath])
  const authorityLevel = useMemo(() => {
    if (
      promotedArtifact?.ingestion_status === 'DEMO_APPROVED' &&
      promotedArtifact.semantic_tier
    ) {
      return promotedArtifact.semantic_tier
    }
    if (promotedArtifact?.tag_authority_level) {
      return promotedArtifact.tag_authority_level
    }
    if (promotedArtifact?.semantic_tier) {
      return promotedArtifact.semantic_tier
    }
    return extractAuthorityLevel(content)
  }, [content, promotedArtifact])
  const authorityBadgeLabel = authorityLevel
    ? `Authority: ${displayAuthorityLevel(authorityLevel)}`
    : null
  const promotionGates = promotedArtifact?.evidence_chain || []
  const selectedGate =
    promotionGates[
      Math.min(selectedPromotionGate, Math.max(0, promotionGates.length - 1))
    ] || null
  const selectedGateKey =
    promotedArtifact && selectedGate
      ? `${promotedArtifact.artifact_id || promotedArtifact.source_ref}:${selectedGate.stage || selectedPromotionGate}`
      : ''
  const selectedGateOverride = selectedGateKey
    ? promotionGateOverrides[selectedGateKey]
    : undefined
  const askQuestion = `Tell me about ${page?.title || selectedPath || 'this wiki page'}`
  const askMessage = selectedPath
    ? `/llm-wiki Use wiki page ${JSON.stringify(selectedPath)} as the primary page. Read relevant related pages and answer: ${askQuestion}`
    : `/llm-wiki ${askQuestion}`
  const askUrl = `/chat/new?message=${encodeURIComponent(askMessage)}`
  const searchResults = searchQuery.data?.results ?? []

  useEffect(() => {
    setSelectedPromotionGate(0)
    setOverrideDraft('')
  }, [promotedArtifact?.artifact_id, selectedPath])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(
      'knowledge-promotion-overrides',
      JSON.stringify(promotionGateOverrides),
    )
  }, [promotionGateOverrides])

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
    if (syncError) {
      return {
        kind: 'failed',
        message: syncError,
        failures: [{ filename: 'knowledge', error: syncError }],
        renamed: [],
        ingested: [],
      }
    }
    if (settingsDirty)
      return {
        ...EMPTY_MODAL_STATUS,
        kind: 'dirty',
        message: 'Unsaved changes',
      }
    return EMPTY_MODAL_STATUS
  }, [savePending, settingsDirty, syncError, syncing])

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
      filterKnowledgeFolderTree(root) || {
        ...root,
        children: [],
      }
    )
  }, [knowledgeFilesTreeQuery.data])

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
  const queuedUploadView = queuedUploadFiles.map((file, index) => ({
    index,
    name: file.name,
    size: file.size,
  }))
  const currentReviewRows = reviewRows.filter((row) => {
    const sourceParent = getParentWikiPath(row.sourceWikiPath)
    const targetParent = getParentWikiPath(row.targetWikiPath)
    return sourceParent === browserPath || targetParent === browserPath
  })
  const currentEntryPathSet = new Set(
    currentDirectoryEntries.map((entry) => entry.path),
  )
  const currentReviewBySourcePath = new Map(
    currentReviewRows
      .filter(
        (row) =>
          row.sourceWikiPath && currentEntryPathSet.has(row.sourceWikiPath),
      )
      .map((row) => [row.sourceWikiPath!, row]),
  )
  const currentUnmatchedReviewRows = currentReviewRows.filter(
    (row) =>
      !row.sourceWikiPath || !currentEntryPathSet.has(row.sourceWikiPath),
  )
  const activityByUploadRef = new Map(
    knowledgeActivity
      .filter((item) => item.uploadRef)
      .map((item) => [item.uploadRef, item]),
  )
  const currentFolderActivityRows = knowledgeActivity.filter((item) => {
    if (item.uploadRef) return false
    return (
      item.id.startsWith(`folder:${browserPath}:`) ||
      item.id.startsWith('knowledge-upload-failed:') ||
      item.id.startsWith('knowledge-upload-error:')
    )
  })
  const currentFolderStatusRowCount =
    queuedUploadView.length +
    currentReviewRows.length +
    currentFolderActivityRows.length

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

  function recordPromotionGateOverride() {
    const reason = overrideDraft.trim()
    if (!selectedGateKey || !reason) return
    setPromotionGateOverrides((current) => ({
      ...current,
      [selectedGateKey]: {
        reason,
        recordedAt: new Date().toISOString(),
      },
    }))
    setOverrideDraft('')
    if (selectedPromotionGate < promotionGates.length - 1) {
      setSelectedPromotionGate((current) => current + 1)
    }
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

  async function handleCreateFolderPromptSubmit() {
    const nextName = folderPromptValue.trim()
    if (!nextName) return
    const created = await handleCreateKnowledgeFolder(nextName)
    if (created) {
      setFolderPromptValue('')
      setFolderPromptOpen(false)
    }
  }

  async function handleCreateKnowledgeFolder(
    folderName: string,
  ): Promise<boolean> {
    setSyncError(null)
    const activityId = `folder:${browserPath}:${folderName}`
    upsertKnowledgeActivity({
      id: activityId,
      status: 'running',
      label: folderName,
      detail: `Creating folder in wiki/${browserPath || ''}`,
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
        upsertKnowledgeActivity({
          id: activityId,
          status: 'failed',
          label: folderName,
          detail: message,
        })
        return false
      }
      await queryClient.invalidateQueries({ queryKey: ['knowledge', 'files'] })
      if (payload.path) {
        setBrowserPath(payload.path)
        setExpandedFilePaths((current) => {
          const next = new Set(current)
          next.add('')
          next.add(payload.path!)
          return next
        })
      }
      upsertKnowledgeActivity({
        id: activityId,
        status: 'done',
        label: folderName,
        detail: `Folder ready at wiki/${payload.path || folderName}`,
      })
      return true
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Create folder failed'
      upsertKnowledgeActivity({
        id: activityId,
        status: 'failed',
        label: folderName,
        detail: message,
      })
      return false
    }
  }

  async function handleDeleteKnowledgeFile(pathValue: string) {
    if (!window.confirm(`Delete ${pathValue}?`)) return
    setDeletingFilePaths((current) => {
      const next = new Set(current)
      next.add(pathValue)
      return next
    })
    upsertKnowledgeActivity({
      id: `knowledge-delete:${pathValue}`,
      status: 'running',
      label: pathValue,
      detail: 'Deleting source file...',
    })
    try {
      const response = await fetch('/api/knowledge/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathValue }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        path?: string
      }
      if (!response.ok) {
        throw new Error(payload.error || `Delete failed (${response.status})`)
      }
      setReviewRows((current) =>
        current.filter(
          (row) =>
            row.sourceWikiPath !== pathValue &&
            row.targetWikiPath !== pathValue,
        ),
      )
      if (selectedPath === pathValue) {
        setSelectedPath(null)
        setFocusLine(null)
        setFocusedResult(null)
      }
      await queryClient.invalidateQueries({ queryKey: ['knowledge', 'files'] })
      await queryClient.invalidateQueries({ queryKey: ['knowledge', 'list'] })
      await queryClient.invalidateQueries({ queryKey: ['knowledge', 'read'] })
      await queryClient.invalidateQueries({ queryKey: ['knowledge', 'graph'] })
      upsertKnowledgeActivity({
        id: `knowledge-delete:${pathValue}`,
        status: 'done',
        label: pathValue,
        detail: `Deleted wiki/${payload.path || pathValue}`,
      })
    } catch (err) {
      upsertKnowledgeActivity({
        id: `knowledge-delete:${pathValue}`,
        status: 'failed',
        label: pathValue,
        detail: err instanceof Error ? err.message : 'Delete failed',
      })
    } finally {
      setDeletingFilePaths((current) => {
        const next = new Set(current)
        next.delete(pathValue)
        return next
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
          sourceWikiPath: browserPath
            ? `${browserPath}/${result.storedName}`
            : result.storedName,
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
          manualCurationJustification:
            manualCurationJustifications[uploadRef]?.trim() || null,
        }),
      })
      const result = (await response.json()) as KnowledgeIngestResult
      if (!response.ok || !result.ok) {
        const message =
          'message' in result
            ? result.message
            : `Import failed (${response.status})`
        const manualCurationRequired =
          'code' in result && result.code === 'empty_artifact'
        upsertKnowledgeActivity({
          id: `knowledge-import:${uploadRef}`,
          status: 'failed',
          label: manualCurationRequired
            ? `Manual curation required${reviewRow ? `: ${reviewRow.originalName}` : ''}`
            : `Wiki build failed${reviewRow ? `: ${reviewRow.originalName}` : ''}`,
          detail: message,
          uploadRef,
        })
        setModalStatus({
          kind: 'failed',
          message: manualCurationRequired
            ? 'Manual curation required'
            : message,
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
      setManualCurationJustifications((current) => {
        const next = { ...current }
        delete next[uploadRef]
        return next
      })
      await queryClient.invalidateQueries({ queryKey: ['knowledge', 'list'] })
      await queryClient.invalidateQueries({ queryKey: ['knowledge', 'files'] })
      upsertKnowledgeActivity({
        id: `knowledge-import:${uploadRef}`,
        status: 'done',
        label: `Built wiki page for ${result.originalName}`,
        detail: result.sourceFilePath
          ? `Source: wiki/${result.sourceFilePath}; Markdown: wiki/${result.storedMarkdownPath}`
          : `Markdown: wiki/${result.storedMarkdownPath}`,
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
                  placeholder={copy.searchPlaceholder}
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
              {copy.graphView}
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
              <span className="hidden sm:inline">{copy.dataConnections}</span>
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
                    title={copy.knowledgeSettingsTitle}
                  >
                    <HugeiconsIcon
                      icon={Settings01Icon}
                      size={16}
                      strokeWidth={1.7}
                    />
                    <span className="hidden sm:inline">{copy.settings}</span>
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
                      {copy.knowledgeSettingsTitle}
                    </DialogTitle>
                    <DialogDescription
                      className="mt-1 text-sm"
                      style={{ color: 'var(--theme-muted)' }}
                    >
                      {copy.knowledgeSettingsDescription}
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

        <div className="flex flex-wrap items-center justify-between gap-3 px-3 pt-3 md:px-4">
          <div className="inline-flex rounded-lg border border-primary-200 bg-primary-50 p-1 dark:border-neutral-800 dark:bg-neutral-950">
            {(['source', 'wiki'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFileViewMode(mode)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors',
                  fileViewMode === mode
                    ? 'border-primary-200 bg-white text-primary-900 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50'
                    : 'border-transparent bg-transparent text-primary-600 hover:bg-primary-100 dark:text-neutral-300 dark:hover:bg-neutral-900',
                )}
              >
                {mode === 'source' ? copy.sourceFiles : copy.wikiPages}
              </button>
            ))}
          </div>
          <div className="text-xs text-primary-500 dark:text-neutral-400">
            {copy.targetFolder}
            {browserPath || ''}
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
                  ? copy.sourceFilesCount(currentFileCount)
                  : copy.knowledgePagesCount(filteredPages.length)}
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
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
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
                  <button
                    type="button"
                    onClick={() => {
                      setFolderPromptValue('')
                      setFolderPromptOpen(true)
                    }}
                    title={copy.newFolder}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-primary-200 px-2 py-1 font-semibold hover:bg-primary-100 dark:border-neutral-800 dark:hover:bg-neutral-900"
                  >
                    <HugeiconsIcon
                      icon={Folder01Icon}
                      size={14}
                      strokeWidth={1.7}
                    />
                    {copy.newFolder}
                  </button>
                </div>
                <section className="rounded-xl border border-primary-200 bg-primary-50/80 p-1 dark:border-neutral-800 dark:bg-neutral-900/60">
                  {filesLoading ? (
                    <StateBox label={copy.loadingSourceFiles} />
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
                    <StateBox label={copy.noSourceFiles} />
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
                  {copy.searchResults}
                </div>
                <div className="space-y-1">
                  {searchQuery.isLoading ? (
                    <StateBox label={copy.searchingKnowledge} />
                  ) : searchResults.length === 0 ? (
                    <StateBox label={copy.noMatchesFound} />
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
                  <section className="rounded-lg border border-primary-200 bg-primary-50/80 p-2 dark:border-neutral-800 dark:bg-neutral-900/60">
                    <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-primary-400 dark:text-neutral-500">
                      {copy.tags}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <TagPill
                        label={copy.all}
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

                  <section className="rounded-lg border border-primary-200 bg-primary-50/80 p-1 dark:border-neutral-800 dark:bg-neutral-900/60">
                    {listQuery.isLoading ? (
                      <StateBox label={copy.loadingKnowledgePages} />
                    ) : listQuery.error instanceof Error ? (
                      <StateBox label={listQuery.error.message} error />
                    ) : filteredPages.length === 0 ? (
                      <StateBox
                        label={
                          selectedTag
                            ? copy.noPagesMatchTag
                            : copy.noMarkdownPages
                        }
                      />
                    ) : (
                      <TreeSection
                        node={tree}
                        selectedPath={selectedPath}
                        onSelectPath={(pathValue) =>
                          handleSelectPath(pathValue)
                        }
                        deletingPaths={deletingFilePaths}
                        onDeletePath={(pathValue) =>
                          void handleDeleteKnowledgeFile(pathValue)
                        }
                        deleteLabel={copy.delete}
                        deletingLabel={copy.deleting}
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
                      {copy.sourceFilesIn}
                      {browserPath || ''}
                    </div>
                    <div className="text-xs text-primary-400 dark:text-neutral-500">
                      {copy.folderSummary(
                        currentDirectoryCount,
                        currentFileCount,
                        currentFolderStatusRowCount,
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary-200 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-primary-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800">
                      <HugeiconsIcon
                        icon={Upload01Icon}
                        size={14}
                        strokeWidth={1.7}
                      />
                      {copy.chooseFiles}
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
                      {uploadPending ? copy.uploading : copy.upload}
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto p-3">
                  <div className="grid gap-3">
                    <div className="space-y-3">
                      <section className="rounded-xl border border-primary-200 bg-primary-50/80 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400">
                          {copy.currentFolder}
                        </div>
                        {filesLoading ? (
                          <StateBox label={copy.loadingFolder} />
                        ) : filesError ? (
                          <StateBox label={filesError} error />
                        ) : currentDirectoryEntries.length === 0 &&
                          currentFolderStatusRowCount === 0 ? (
                          <StateBox label={copy.noSourceFilesInFolder} />
                        ) : (
                          <div className="divide-y divide-primary-200 overflow-hidden rounded-lg border border-primary-200 dark:divide-neutral-800 dark:border-neutral-800">
                            {queuedUploadView.map((file) => (
                              <div
                                key={`queued:${file.index}:${file.name}:${file.size}`}
                                className="flex w-full items-center justify-between gap-3 bg-primary-50 px-3 py-2 text-left text-sm dark:bg-neutral-950"
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <HugeiconsIcon
                                    icon={File01Icon}
                                    size={16}
                                    strokeWidth={1.7}
                                    className="shrink-0"
                                  />
                                  <span className="min-w-0 truncate">
                                    {file.name}
                                  </span>
                                </span>
                                <span className="flex shrink-0 items-center gap-2">
                                  <StatusPill
                                    status="waiting"
                                    label={copy.queued}
                                  />
                                  <button
                                    type="button"
                                    disabled={uploadPending}
                                    onClick={() =>
                                      void handleUploadQueuedKnowledgeFiles()
                                    }
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-accent-600 bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <HugeiconsIcon
                                      icon={Upload01Icon}
                                      size={14}
                                      strokeWidth={1.7}
                                    />
                                    {uploadPending
                                      ? copy.uploading.replace('...', '')
                                      : copy.upload}
                                  </button>
                                  <span className="text-xs text-primary-400 dark:text-neutral-500">
                                    {formatBytes(file.size)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setQueuedUploadFiles((current) =>
                                        current.filter(
                                          (_item, index) =>
                                            index !== file.index,
                                        ),
                                      )
                                    }
                                    className="rounded-lg border border-primary-200 px-2 py-1.5 text-xs font-medium hover:bg-primary-100 dark:border-neutral-800 dark:hover:bg-neutral-900"
                                  >
                                    {copy.remove}
                                  </button>
                                </span>
                              </div>
                            ))}
                            {currentUnmatchedReviewRows.map((row) => (
                              <div
                                key={row.retryUploadRef}
                                className="w-full space-y-2 bg-primary-50 px-3 py-2 text-left text-sm dark:bg-neutral-950"
                              >
                                <div className="flex w-full items-center justify-between gap-3">
                                  <span className="flex min-w-0 items-center gap-2">
                                    <HugeiconsIcon
                                      icon={File01Icon}
                                      size={16}
                                      strokeWidth={1.7}
                                      className="shrink-0"
                                    />
                                    <span className="min-w-0">
                                      <span className="block truncate font-medium">
                                        {row.storedName}
                                      </span>
                                      <span className="block truncate text-xs text-primary-500 dark:text-neutral-400">
                                        {copy.builds}{' '}
                                        {row.targetWikiPath || 'wiki page'}
                                      </span>
                                    </span>
                                  </span>
                                  <span className="flex shrink-0 items-center gap-2">
                                    <StatusPill
                                      status={
                                        activityByUploadRef.get(
                                          row.retryUploadRef,
                                        )?.status || 'waiting'
                                      }
                                      label={
                                        activityByUploadRef.get(
                                          row.retryUploadRef,
                                        )?.status === 'running'
                                          ? copy.building
                                          : activityByUploadRef.get(
                                                row.retryUploadRef,
                                              )?.status === 'failed'
                                            ? copy.failed
                                            : copy.needsBuild
                                      }
                                    />
                                    <button
                                      type="button"
                                      disabled={ingestPending}
                                      onClick={() =>
                                        void handleIngestKnowledgeUpload(
                                          row.retryUploadRef,
                                        )
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-accent-600 bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      <HugeiconsIcon
                                        icon={Upload01Icon}
                                        size={14}
                                        strokeWidth={1.7}
                                      />
                                      {copy.build}
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
                                      {copy.remove}
                                    </button>
                                  </span>
                                </div>
                                <textarea
                                  value={
                                    manualCurationJustifications[
                                      row.retryUploadRef
                                    ] || ''
                                  }
                                  onChange={(event) =>
                                    setManualCurationJustifications(
                                      (current) => ({
                                        ...current,
                                        [row.retryUploadRef]:
                                          event.target.value,
                                      }),
                                    )
                                  }
                                  rows={2}
                                  placeholder={
                                    locale === 'zh'
                                      ? '当 extraction 为空时填写人工 curation justification'
                                      : 'Human justification for manual curation when extraction is empty'
                                  }
                                  className="w-full resize-none rounded-lg border border-primary-200 bg-white px-2.5 py-2 text-xs text-primary-900 outline-none focus:ring-2 focus:ring-primary-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                                />
                              </div>
                            ))}
                            {currentFolderActivityRows.map((item) => (
                              <div
                                key={item.id}
                                className="flex w-full items-center justify-between gap-3 bg-primary-50 px-3 py-2 text-left text-sm dark:bg-neutral-950"
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <HugeiconsIcon
                                    icon={File01Icon}
                                    size={16}
                                    strokeWidth={1.7}
                                    className="shrink-0"
                                  />
                                  <span className="min-w-0">
                                    <span className="block truncate font-medium">
                                      {item.label}
                                    </span>
                                    <span className="block truncate text-xs text-primary-500 dark:text-neutral-400">
                                      {item.detail}
                                    </span>
                                  </span>
                                </span>
                                <StatusPill status={item.status} />
                              </div>
                            ))}
                            {currentDirectoryEntries.map((entry) => {
                              const reviewRow =
                                entry.kind === 'file'
                                  ? currentReviewBySourcePath.get(entry.path)
                                  : undefined
                              const activity = reviewRow
                                ? activityByUploadRef.get(
                                    reviewRow.retryUploadRef,
                                  )
                                : undefined
                              const deleting = deletingFilePaths.has(entry.path)
                              const status = activity?.status || 'waiting'
                              const statusLabel =
                                activity?.status === 'running'
                                  ? copy.building
                                  : activity?.status === 'failed'
                                    ? copy.failed
                                    : copy.needsBuild

                              if (entry.kind === 'directory') {
                                return (
                                  <button
                                    key={entry.path}
                                    type="button"
                                    onClick={() => {
                                      handleBrowseKnowledgeFolder(entry.path)
                                      setExpandedFilePaths((current) => {
                                        const next = new Set(current)
                                        next.add(entry.path)
                                        return next
                                      })
                                    }}
                                    className="flex w-full items-center justify-between gap-3 bg-primary-50 px-3 py-2 text-left text-sm transition-colors hover:bg-primary-100 dark:bg-neutral-950 dark:hover:bg-neutral-900"
                                  >
                                    <span className="flex min-w-0 items-center gap-2">
                                      <HugeiconsIcon
                                        icon={Folder01Icon}
                                        size={16}
                                        strokeWidth={1.7}
                                        className="shrink-0"
                                      />
                                      <span className="min-w-0 truncate">
                                        {entry.name}
                                      </span>
                                    </span>
                                    <span className="shrink-0 text-xs text-primary-400 dark:text-neutral-500">
                                      {locale === 'zh' ? '文件夹' : 'Folder'}
                                    </span>
                                  </button>
                                )
                              }

                              return (
                                <div
                                  key={entry.path}
                                  className="flex w-full items-center justify-between gap-3 bg-primary-50 px-3 py-2 text-left text-sm dark:bg-neutral-950"
                                >
                                  <span className="flex min-w-0 items-center gap-2">
                                    <HugeiconsIcon
                                      icon={File01Icon}
                                      size={16}
                                      strokeWidth={1.7}
                                      className="shrink-0"
                                    />
                                    <span className="min-w-0">
                                      <span className="block truncate">
                                        {entry.name}
                                      </span>
                                      {reviewRow?.targetWikiPath ? (
                                        <span className="block truncate text-xs text-primary-500 dark:text-neutral-400">
                                          {copy.builds}{' '}
                                          {reviewRow.targetWikiPath}
                                        </span>
                                      ) : null}
                                      {reviewRow ? (
                                        <textarea
                                          value={
                                            manualCurationJustifications[
                                              reviewRow.retryUploadRef
                                            ] || ''
                                          }
                                          onChange={(event) =>
                                            setManualCurationJustifications(
                                              (current) => ({
                                                ...current,
                                                [reviewRow.retryUploadRef]:
                                                  event.target.value,
                                              }),
                                            )
                                          }
                                          rows={2}
                                          placeholder={
                                            locale === 'zh'
                                              ? '人工 curation justification'
                                              : 'Human justification for manual curation'
                                          }
                                          className="mt-2 block w-full min-w-80 resize-none rounded-lg border border-primary-200 bg-white px-2.5 py-2 text-xs text-primary-900 outline-none focus:ring-2 focus:ring-primary-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                                        />
                                      ) : null}
                                    </span>
                                  </span>
                                  <span className="flex shrink-0 items-center gap-2">
                                    {reviewRow ? (
                                      <>
                                        <StatusPill
                                          status={status}
                                          label={statusLabel}
                                        />
                                        <button
                                          type="button"
                                          disabled={
                                            ingestPending ||
                                            activity?.status === 'running'
                                          }
                                          onClick={() =>
                                            void handleIngestKnowledgeUpload(
                                              reviewRow.retryUploadRef,
                                            )
                                          }
                                          className="inline-flex items-center gap-1.5 rounded-lg border border-accent-600 bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          <HugeiconsIcon
                                            icon={Upload01Icon}
                                            size={14}
                                            strokeWidth={1.7}
                                          />
                                          {copy.build}
                                        </button>
                                      </>
                                    ) : null}
                                    <span className="text-xs text-primary-400 dark:text-neutral-500">
                                      {formatBytes(entry.size ?? 0)}
                                    </span>
                                    <button
                                      type="button"
                                      disabled={deleting}
                                      onClick={() =>
                                        void handleDeleteKnowledgeFile(
                                          entry.path,
                                        )
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 px-2 py-1.5 text-xs font-medium transition-colors hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:hover:bg-neutral-900"
                                    >
                                      <HugeiconsIcon
                                        icon={Delete01Icon}
                                        size={14}
                                        strokeWidth={1.7}
                                      />
                                      {deleting ? copy.deleting : copy.delete}
                                    </button>
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </section>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-primary-200 px-3 py-2 dark:border-neutral-800">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <div className="truncate text-sm font-semibold text-primary-900 dark:text-neutral-100">
                        {page?.title || selectedPath || copy.selectPage}
                      </div>
                      {authorityBadgeLabel ? (
                        <AuthorityBadgeLink label={authorityBadgeLabel} />
                      ) : null}
                    </div>
                    {page ? (
                      <div className="text-xs text-primary-400 dark:text-neutral-500">
                        {page.path} · {formatBytes(page.size)} ·{' '}
                        {formatDate(page.updated || page.modified)}
                      </div>
                    ) : null}
                  </div>
                  {page ? (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={deletingFilePaths.has(page.path)}
                        onClick={() =>
                          void handleDeleteKnowledgeFile(page.path)
                        }
                        className="inline-flex items-center gap-1.5 rounded-md border border-primary-200 px-3 py-1.5 text-xs font-semibold transition-colors hover:border-primary-300 hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
                      >
                        <HugeiconsIcon
                          icon={Delete01Icon}
                          size={14}
                          strokeWidth={1.7}
                        />
                        {deletingFilePaths.has(page.path)
                          ? copy.deleting
                          : copy.delete}
                      </button>
                      <a
                        href={askUrl}
                        className="inline-flex items-center gap-1.5 rounded-md border border-primary-200 px-3 py-1.5 text-xs font-semibold transition-colors hover:border-primary-300 hover:bg-primary-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
                      >
                        <HugeiconsIcon
                          icon={Message01Icon}
                          size={14}
                          strokeWidth={1.7}
                        />
                        {copy.askAgent}
                      </a>
                    </div>
                  ) : null}
                </div>

                <div className="h-full overflow-auto p-2 md:p-3">
                  {listQuery.isLoading ? (
                    <StateBox label={copy.loadingKnowledgeBase} />
                  ) : listQuery.error instanceof Error ? (
                    <StateBox label={listQuery.error.message} error />
                  ) : !knowledgeExists ? (
                    <EmptyKnowledgeState knowledgeRoot={knowledgeRoot} />
                  ) : !selectedPath ? (
                    <StateBox label={copy.selectPageToStart} />
                  ) : readQuery.isLoading ? (
                    <StateBox label={copy.loadingPage} />
                  ) : readQuery.error instanceof Error ? (
                    <StateBox label={readQuery.error.message} error />
                  ) : !page ? (
                    <StateBox label={copy.pageNotFound} error />
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
                                {copy.searchHitAtLine(focusLine)}
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
                              {copy.backlinks}
                            </div>
                            {backlinks.length === 0 ? (
                              <div className="text-sm text-primary-500 dark:text-neutral-400">
                                {copy.noBacklinks}
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
                          <MetadataCard
                            label={locale === 'zh' ? '类型' : 'Type'}
                            value={page.type}
                          />
                          <MetadataCard
                            label={locale === 'zh' ? '领域' : 'Domain'}
                            value={page.domain}
                          />
                          <MetadataCard
                            label={locale === 'zh' ? '状态' : 'Status'}
                            value={page.status}
                          />
                          <MetadataCard
                            label={locale === 'zh' ? '创建时间' : 'Created'}
                            value={formatDate(page.created)}
                          />
                          <MetadataCard
                            label={locale === 'zh' ? '更新时间' : 'Updated'}
                            value={formatDate(page.updated || page.modified)}
                          />
                          <MetadataCard
                            label={locale === 'zh' ? '大小' : 'Size'}
                            value={formatBytes(page.size)}
                          />
                          <AuthorityMetadataCard
                            value={
                              authorityLevel
                                ? displayAuthorityLevel(authorityLevel)
                                : 'Unlabeled'
                            }
                          />
                          <PromotionLineageCard
                            artifact={promotedArtifact}
                            pagePath={selectedPath}
                            content={content}
                            gates={promotionGates}
                            selectedIndex={selectedPromotionGate}
                            selectedGate={selectedGate}
                            selectedOverride={selectedGateOverride}
                            overrideDraft={overrideDraft}
                            onSelectGate={(index) => {
                              setSelectedPromotionGate(index)
                              setOverrideDraft('')
                            }}
                            onOverrideDraftChange={setOverrideDraft}
                            onRecordOverride={recordPromotionGateOverride}
                            onDemoApproved={(artifact) => {
                              if (!selectedPath) return
                              setDemoApprovedArtifacts((current) => ({
                                ...current,
                                [selectedPath]: artifact,
                              }))
                              try {
                                window.localStorage.setItem(
                                  'knowledge-latest-demo-approved-artifact',
                                  JSON.stringify({
                                    pagePath: selectedPath,
                                    artifact,
                                    recordedAt: new Date().toISOString(),
                                  }),
                                )
                              } catch {
                                // The badge still updates even if browser storage is unavailable.
                              }
                            }}
                          />
                          <div className="rounded-xl border border-primary-200 bg-primary-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                            <div className="text-xs font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400">
                              {copy.tags}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {page.tags.length === 0 ? (
                                <span className="text-sm text-primary-500 dark:text-neutral-400">
                                  {copy.noTags}
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
                              {copy.wikilinks}
                            </div>
                            {page.wikilinks.length === 0 ? (
                              <div className="text-sm text-primary-500 dark:text-neutral-400">
                                {copy.noOutboundLinks}
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

        <DialogRoot
          open={folderPromptOpen}
          onOpenChange={(open) => {
            setFolderPromptOpen(open)
            if (!open) setFolderPromptValue('')
          }}
        >
          <DialogContent>
            <div className="space-y-3 p-5">
              <DialogTitle>{copy.newFolderTitle}</DialogTitle>
              <DialogDescription>
                {copy.createFolderInside}
                {browserPath || ''}
              </DialogDescription>
              <input
                value={folderPromptValue}
                onChange={(event) => setFolderPromptValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleCreateFolderPromptSubmit()
                  }
                }}
                className="w-full rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 outline-none focus:ring-2 focus:ring-primary-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                autoFocus
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setFolderPromptOpen(false)
                    setFolderPromptValue('')
                  }}
                  className="rounded-lg border border-primary-200 px-3 py-2 text-sm font-semibold hover:bg-primary-100 dark:border-neutral-800 dark:hover:bg-neutral-900"
                >
                  {copy.cancel}
                </button>
                <button
                  type="button"
                  disabled={!folderPromptValue.trim()}
                  onClick={() => void handleCreateFolderPromptSubmit()}
                  className="rounded-lg border border-accent-600 bg-accent-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {copy.save}
                </button>
              </div>
            </div>
          </DialogContent>
        </DialogRoot>

        <DialogRoot open={graphOpen} onOpenChange={setGraphOpen}>
          <DialogContent className="w-[min(980px,94vw)] max-w-none p-0">
            <div className="border-b border-primary-200 px-5 py-4 dark:border-neutral-800">
              <DialogTitle>{copy.graphTitle}</DialogTitle>
              <DialogDescription>
                {copy.graphDescription}
              </DialogDescription>
            </div>
            <div className="p-5">
              {graphQuery.isLoading ? (
                <StateBox label={copy.loadingGraph} />
              ) : graphQuery.error instanceof Error ? (
                <StateBox label={graphQuery.error.message} error />
              ) : (graphQuery.data?.nodes?.length ?? 0) === 0 ? (
                <StateBox label={copy.noGraphData} />
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
  deletingPaths,
  onDeletePath,
  deleteLabel,
  deletingLabel,
  depth = 0,
}: {
  node: TreeNode
  selectedPath: string | null
  onSelectPath: (path: string) => void
  deletingPaths: Set<string>
  onDeletePath: (path: string) => void
  deleteLabel: string
  deletingLabel: string
  depth?: number
}) {
  return (
    <div className={cn('space-y-0.5', depth > 0 && 'mt-0.5')}>
      {node.path ? (
        <div
          className="flex h-7 items-center gap-2 rounded-md px-2 text-xs font-semibold text-primary-500 dark:text-neutral-400"
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          <HugeiconsIcon icon={Folder01Icon} size={14} strokeWidth={1.7} />
          <span className="truncate">{node.name}</span>
        </div>
      ) : null}

      {node.pages.map((page) => {
        const active = selectedPath === page.path
        const deleting = deletingPaths.has(page.path)
        return (
          <div
            key={page.path}
            className={cn(
              'flex min-h-9 w-full items-center gap-2 rounded-md border py-1.5 pl-2.5 pr-1.5 text-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]',
              active
                ? 'border-[var(--theme-accent-secondary)] bg-[var(--theme-accent)] text-[var(--theme-accent-foreground)] shadow-sm'
                : 'border-transparent text-primary-900 hover:border-primary-200 hover:bg-primary-100 dark:text-neutral-200 dark:hover:border-neutral-800 dark:hover:bg-neutral-900',
            )}
            style={{ marginLeft: depth > 0 ? depth * 14 : 0 }}
            aria-current={active ? 'page' : undefined}
          >
            <button
              type="button"
              onClick={() => onSelectPath(page.path)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <HugeiconsIcon
                icon={File01Icon}
                size={16}
                strokeWidth={1.8}
                className={cn(
                  'shrink-0',
                  active
                    ? 'text-[var(--theme-accent-foreground)]'
                    : 'text-primary-500 dark:text-neutral-400',
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{page.title}</div>
                {(page.type || page.status) && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {page.type ? (
                      <InlineBadge label={page.type} active={active} />
                    ) : null}
                    {page.status ? (
                      <InlineBadge label={page.status} active={active} />
                    ) : null}
                  </div>
                )}
              </div>
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => onDeletePath(page.path)}
              title={deleting ? deletingLabel : deleteLabel}
              className={cn(
                'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                active
                  ? 'border-[color-mix(in_srgb,var(--theme-accent-foreground)_35%,transparent)] text-[var(--theme-accent-foreground)] hover:bg-[color-mix(in_srgb,var(--theme-accent-foreground)_12%,transparent)]'
                  : 'border-primary-200 text-primary-500 hover:bg-primary-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900',
              )}
            >
              <HugeiconsIcon
                icon={Delete01Icon}
                size={14}
                strokeWidth={1.7}
              />
            </button>
          </div>
        )
      })}

      {node.folders.map((child) => (
        <TreeSection
          key={child.path}
          node={child}
          selectedPath={selectedPath}
          onSelectPath={onSelectPath}
          deletingPaths={deletingPaths}
          onDeletePath={onDeletePath}
          deleteLabel={deleteLabel}
          deletingLabel={deletingLabel}
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

function InlineBadge({
  label,
  active = false,
}: {
  label: string
  active?: boolean
}) {
  return (
    <span
      className={cn(
        'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        active
          ? 'border-[color-mix(in_srgb,var(--theme-accent-foreground)_35%,transparent)] bg-[color-mix(in_srgb,var(--theme-accent)_72%,white)] text-[var(--theme-accent-foreground)]'
          : 'border-primary-200 bg-primary-100 text-primary-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300',
      )}
    >
      {label}
    </span>
  )
}

function AuthorityBadgeLink({ label }: { label: string }) {
  const locale = useSettingsStore((state) => state.settings.locale)
  return (
    <Link
      to="/memory"
      search={{ tab: 'governance' }}
      hash="authority-levels"
      className="rounded-md border border-[color-mix(in_srgb,var(--theme-accent-foreground)_35%,transparent)] bg-[color-mix(in_srgb,var(--theme-accent)_72%,white)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-accent-foreground)] underline-offset-2 transition-colors hover:underline"
      title={
        locale === 'zh'
          ? '解释 Semantier authority levels 和 governed promotion'
          : 'Explain Semantier authority levels and governed promotion'
      }
    >
      {label}
    </Link>
  )
}

function StatusPill({
  status,
  label,
}: {
  status: KnowledgeActivityStatus
  label?: string
}) {
  const locale = useSettingsStore((state) => state.settings.locale)
  const defaults =
    locale === 'zh'
      ? {
          running: '运行中',
          waiting: '等待中',
          done: '完成',
          failed: '失败',
        }
      : {
          running: 'Running',
          waiting: 'Waiting',
          done: 'Done',
          failed: 'Failed',
        }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
      <span
        className={cn(
          'size-1.5 rounded-full',
          status === 'running' && 'bg-primary-500 dark:bg-neutral-300',
          status === 'waiting' && 'bg-primary-400 dark:bg-neutral-500',
          status === 'done' && 'bg-primary-600 dark:bg-neutral-200',
          status === 'failed' && 'bg-red-600 dark:bg-red-300',
        )}
      />
      {label ||
        defaults[status]}
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

function PromotionLineageCard({
  artifact,
  pagePath,
  content,
  gates,
  selectedIndex,
  selectedGate,
  selectedOverride,
  overrideDraft,
  onSelectGate,
  onOverrideDraftChange,
  onRecordOverride,
  onDemoApproved,
}: {
  artifact: GovernedKnowledgeArtifact | null
  pagePath: string | null
  content: string
  gates: Array<GovernedKnowledgeEvidenceStep>
  selectedIndex: number
  selectedGate: GovernedKnowledgeEvidenceStep | null
  selectedOverride?: PromotionGateOverride
  overrideDraft: string
  onSelectGate: (index: number) => void
  onOverrideDraftChange: (value: string) => void
  onRecordOverride: () => void
  onDemoApproved: (artifact: GovernedKnowledgeArtifact) => void
}) {
  const locale = useSettingsStore((state) => state.settings.locale)
  const copy =
    locale === 'zh'
      ? {
          promoteLineage: 'Promote lineage',
          noPromotion: '此页面还没有关联 governed promotion。',
          promotionHelp:
            '如果要让这份材料作为法律或政策使用，需要注册官方 source、固定 normalized artifact hash、通过 schema 和 precedence checks，然后在 Semantier core 中审批并激活。',
          targetAuthority: 'Target authority',
          justification: 'Justification',
          justificationPlaceholder:
            '为什么这份 curation material 应进入 governed review？',
          officialSourceUri: 'Official source URI',
          sourceUriPlaceholder: 'T2 activation 前必填',
          jurisdiction: 'Jurisdiction',
          effectiveFrom: 'Effective from',
          sourceVersion: 'Source version',
          requestRecorded: 'Request',
          recordedAs: '记录为',
          missing: '缺少',
          approveForDemo: 'Demo 审批',
          demoApprovalRecorded: 'Demo approval 已记录',
          viewPromotionPath: '查看 governed promotion path',
          submitting: '提交中...',
          requestPromotion: '提交 governed promotion',
          claims: 'claims',
          evidence: 'Evidence',
          hash: 'Hash',
          gateJustification: 'Justification',
          notRecorded: '未记录',
          overrideRecorded: 'Override 已记录',
          overridePlaceholder: '原因或 justification',
          overrideContinue: 'Override 并继续',
          gateReasons: {
            curation:
              'Curation material 已在权威使用前完成注册。',
            normalized: 'Extraction output 已链接并固定 hash。',
            governed: 'Promotion 已进入 governed KGL artifact store。',
            active: 'Artifact 在当前 knowledge lifecycle 下处于 active 状态。',
          },
        }
      : {
          promoteLineage: 'Promote lineage',
          noPromotion: 'No governed promotion is linked to this page.',
          promotionHelp:
            'To make this material usable as law or policy, register the official source, pin the normalized artifact hash, pass schema and precedence checks, then approve and activate it in Semantier core.',
          targetAuthority: 'Target authority',
          justification: 'Justification',
          justificationPlaceholder:
            'Why should this curation material enter governed review?',
          officialSourceUri: 'Official source URI',
          sourceUriPlaceholder: 'Required before T2 activation',
          jurisdiction: 'Jurisdiction',
          effectiveFrom: 'Effective from',
          sourceVersion: 'Source version',
          requestRecorded: 'Request',
          recordedAs: 'recorded as',
          missing: 'Missing',
          approveForDemo: 'Approve for demo',
          demoApprovalRecorded: 'Demo approval recorded',
          viewPromotionPath: 'View governed promotion path',
          submitting: 'Submitting...',
          requestPromotion: 'Request governed promotion',
          claims: 'claims',
          evidence: 'Evidence',
          hash: 'Hash',
          gateJustification: 'Justification',
          notRecorded: 'not recorded',
          overrideRecorded: 'Override recorded',
          overridePlaceholder: 'Reason or justification',
          overrideContinue: 'Override and continue',
          gateReasons: {
            curation:
              'Curation material was registered before authority use.',
            normalized: 'Extraction output is linked and hash-pinned.',
            governed: 'Promotion entered the governed KGL artifact store.',
            active:
              'Artifact is active under the current knowledge lifecycle.',
          },
        }
  const [targetAuthorityLevel, setTargetAuthorityLevel] =
    useState<PromotionTargetAuthorityLevel>('T2')
  const [promotionJustification, setPromotionJustification] = useState(() =>
    defaultPromotionJustification(content),
  )
  const [sourceUri, setSourceUri] = useState('')
  const [jurisdiction, setJurisdiction] = useState('CN')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [sourceVersion, setSourceVersion] = useState('')
  const [submitState, setSubmitState] = useState<
    | { kind: 'idle' }
    | { kind: 'submitting' }
    | { kind: 'done'; result: KnowledgePromotionRequestResult }
    | { kind: 'failed'; message: string }
  >({ kind: 'idle' })

  useEffect(() => {
    setPromotionJustification(defaultPromotionJustification(content))
    setSubmitState({ kind: 'idle' })
  }, [content, pagePath])

  async function submitPromotionRequest() {
    if (!pagePath || !promotionJustification.trim()) return
    setSubmitState({ kind: 'submitting' })
    try {
      const response = await fetch('/api/knowledge/promotion-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pagePath,
          targetAuthorityLevel,
          justification: promotionJustification.trim(),
          sourceUri: sourceUri.trim() || null,
          jurisdiction: jurisdiction.trim() || null,
          effectiveFrom: effectiveFrom.trim() || null,
          sourceVersion: sourceVersion.trim() || null,
        }),
      })
      const result = (await response
        .json()
        .catch(() => ({}))) as KnowledgePromotionRequestResult
      if (!response.ok || !result.ok) {
        throw new Error(
          result.error || `Promotion request failed (${response.status})`,
        )
      }
      setSubmitState({ kind: 'done', result })
    } catch (error) {
      setSubmitState({
        kind: 'failed',
        message:
          error instanceof Error ? error.message : 'Promotion request failed',
      })
    }
  }

  async function approvePromotionRequest(requestId?: string) {
    if (!requestId) return
    setSubmitState({ kind: 'submitting' })
    try {
      const response = await fetch('/api/knowledge/promotion-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          justification:
            promotionJustification.trim() || 'Demo approval from knowledge UI',
        }),
      })
      const result = (await response
        .json()
        .catch(() => ({}))) as KnowledgePromotionRequestResult
      if (!response.ok || !result.ok) {
        throw new Error(
          result.error || `Promotion approval failed (${response.status})`,
        )
      }
      if (result.approvedArtifact) {
        onDemoApproved(result.approvedArtifact)
      }
      setSubmitState({ kind: 'done', result })
    } catch (error) {
      setSubmitState({
        kind: 'failed',
        message:
          error instanceof Error ? error.message : 'Promotion approval failed',
      })
    }
  }

  return (
    <div className="rounded-xl border border-primary-200 bg-primary-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="text-xs font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400">
        {copy.promoteLineage}
      </div>
      {!artifact ? (
        <div className="mt-3 space-y-3">
          <div className="text-sm text-primary-500 dark:text-neutral-400">
            {copy.noPromotion}
          </div>
          <div className="rounded-lg border border-primary-200 bg-primary-50 p-2.5 text-xs text-primary-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
            {copy.promotionHelp}
          </div>
          <div className="space-y-2 rounded-lg border border-primary-200 bg-white p-2.5 dark:border-neutral-800 dark:bg-neutral-950">
            <label className="block text-xs font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400">
              {copy.targetAuthority}
              <select
                value={targetAuthorityLevel}
                onChange={(event) =>
                  setTargetAuthorityLevel(
                    event.target.value as PromotionTargetAuthorityLevel,
                  )
                }
                className="mt-1 w-full rounded-lg border border-primary-200 bg-white px-2.5 py-2 text-xs normal-case tracking-normal text-primary-900 outline-none focus:ring-2 focus:ring-primary-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              >
                <option value="T2">T2 Law / Regulation</option>
                <option value="T3">T3 Doctrine / Standard</option>
                <option value="T4">T4 Org Policy</option>
                <option value="T5">T5 Scoped Preference</option>
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400">
              {copy.justification}
              <textarea
                value={promotionJustification}
                onChange={(event) =>
                  setPromotionJustification(event.target.value)
                }
                rows={3}
                placeholder={copy.justificationPlaceholder}
                className="mt-1 w-full resize-none rounded-lg border border-primary-200 bg-white px-2.5 py-2 text-xs normal-case tracking-normal text-primary-900 outline-none focus:ring-2 focus:ring-primary-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400">
              {copy.officialSourceUri}
              <input
                value={sourceUri}
                onChange={(event) => setSourceUri(event.target.value)}
                placeholder={copy.sourceUriPlaceholder}
                className="mt-1 w-full rounded-lg border border-primary-200 bg-white px-2.5 py-2 text-xs normal-case tracking-normal text-primary-900 outline-none focus:ring-2 focus:ring-primary-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="block text-xs font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400">
                {copy.jurisdiction}
                <input
                  value={jurisdiction}
                  onChange={(event) => setJurisdiction(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-primary-200 bg-white px-2.5 py-2 text-xs normal-case tracking-normal text-primary-900 outline-none focus:ring-2 focus:ring-primary-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400">
                {copy.effectiveFrom}
                <input
                  value={effectiveFrom}
                  onChange={(event) => setEffectiveFrom(event.target.value)}
                  placeholder="YYYY-MM-DD"
                  className="mt-1 w-full rounded-lg border border-primary-200 bg-white px-2.5 py-2 text-xs normal-case tracking-normal text-primary-900 outline-none focus:ring-2 focus:ring-primary-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400">
                {copy.sourceVersion}
                <input
                  value={sourceVersion}
                  onChange={(event) => setSourceVersion(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-primary-200 bg-white px-2.5 py-2 text-xs normal-case tracking-normal text-primary-900 outline-none focus:ring-2 focus:ring-primary-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                />
              </label>
            </div>
            {submitState.kind === 'done' ? (
              <div className="rounded-lg border border-accent-500/30 bg-accent-500/10 p-2 text-xs text-primary-900 dark:text-neutral-100">
                {copy.requestRecorded} {submitState.result.requestId}{' '}
                {copy.recordedAs}{' '}
                {submitState.result.status}.
                {submitState.result.blockers?.length ? (
                  <span className="mt-1 block text-primary-600 dark:text-neutral-300">
                    {copy.missing}: {submitState.result.blockers.join(', ')}
                  </span>
                ) : null}
                {submitState.result.status !== 'APPROVED' ? (
                  <button
                    type="button"
                    onClick={() =>
                      void approvePromotionRequest(submitState.result.requestId)
                    }
                    className="mt-2 w-full rounded-lg border border-primary-900 bg-primary-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-800 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-neutral-200"
                  >
                    {copy.approveForDemo}
                  </button>
                ) : (
                  <>
                    <span className="mt-1 block text-primary-600 dark:text-neutral-300">
                      {copy.demoApprovalRecorded}:{' '}
                      {submitState.result.approvalId}
                    </span>
                    <Link
                      to="/memory"
                      search={{ tab: 'governance' }}
                      hash="promotion-evidence-chain"
                      className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-semibold text-primary-700 transition-colors hover:border-primary-300 hover:bg-primary-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
                    >
                      {copy.viewPromotionPath}
                    </Link>
                  </>
                )}
              </div>
            ) : null}
            {submitState.kind === 'failed' ? (
              <div className="rounded-lg border border-red-300 bg-red-50 p-2 text-xs text-red-700">
                {submitState.message}
              </div>
            ) : null}
            <button
              type="button"
              disabled={
                submitState.kind === 'submitting' ||
                !pagePath ||
                !promotionJustification.trim()
              }
              onClick={() => void submitPromotionRequest()}
              className="w-full rounded-lg border border-accent-600 bg-accent-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitState.kind === 'submitting'
                ? copy.submitting
                : copy.requestPromotion}
            </button>
          </div>
          <Link
            to="/memory"
            search={{ tab: 'governance' }}
            hash="promotion-path"
            className="inline-flex w-full items-center justify-center rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-semibold text-primary-700 transition-colors hover:border-primary-300 hover:bg-primary-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
          >
            {copy.viewPromotionPath}
          </Link>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <InlineBadge label={artifact.ingestion_status || 'ACTIVE'} />
            <InlineBadge label={artifact.semantic_tier || 'T3'} />
            <InlineBadge label={artifact.authority_domain || 'compliance'} />
          </div>
          <div className="text-xs text-primary-500 dark:text-neutral-400">
            {artifact.claim_count ?? 0} {copy.claims} · {artifact.source_type} ·{' '}
            {artifact.authority_origin}
          </div>
          <Link
            to="/memory"
            search={{ tab: 'governance' }}
            hash="promotion-evidence-chain"
            className="inline-flex w-full items-center justify-center rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-semibold text-primary-700 transition-colors hover:border-primary-300 hover:bg-primary-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
          >
            {copy.viewPromotionPath}
          </Link>

          <div className="space-y-1.5">
            {gates.map((gate, index) => {
              const selected = index === selectedIndex
              return (
                <button
                  key={`${gate.stage || 'gate'}:${index}`}
                  type="button"
                  onClick={() => onSelectGate(index)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                    selected
                      ? 'border-accent-500/60 bg-accent-500/10'
                      : 'border-primary-200 bg-primary-50 hover:bg-primary-100 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                      selected
                        ? 'bg-accent-500 text-white'
                        : 'bg-primary-100 text-primary-600 dark:bg-neutral-800 dark:text-neutral-300',
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-primary-900 dark:text-neutral-100">
                      {gateLabel(gate.stage)}
                    </span>
                    <span className="block truncate text-[10px] text-primary-500 dark:text-neutral-400">
                      {shortEvidenceValue(gate.hash)}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          {selectedGate ? (
            <div className="rounded-lg border border-primary-200 bg-primary-50 p-2.5 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="text-xs font-semibold text-primary-900 dark:text-neutral-100">
                {gateLabel(selectedGate.stage)}
              </div>
              <dl className="mt-2 space-y-2 text-xs">
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400">
                    {copy.evidence}
                  </dt>
                  <dd className="mt-0.5 break-all text-primary-800 dark:text-neutral-200">
                    {selectedGate.ref || copy.notRecorded}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400">
                    {copy.hash}
                  </dt>
                  <dd className="mt-0.5 break-all font-mono text-primary-800 dark:text-neutral-200">
                    {selectedGate.hash || copy.notRecorded}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400">
                    {copy.gateJustification}
                  </dt>
                  <dd className="mt-0.5 text-primary-800 dark:text-neutral-200">
                    {selectedGate.stage === 'curation_upload'
                      ? copy.gateReasons.curation
                      : selectedGate.stage === 'normalized_artifact'
                        ? copy.gateReasons.normalized
                        : selectedGate.stage === 'governed_kgl_artifact'
                          ? copy.gateReasons.governed
                          : copy.gateReasons.active}
                  </dd>
                </div>
              </dl>

              {selectedOverride ? (
                <div className="mt-3 rounded-lg border border-accent-500/30 bg-accent-500/10 p-2 text-xs text-primary-900 dark:text-neutral-100">
                  <div className="font-semibold">{copy.overrideRecorded}</div>
                  <div className="mt-1 text-primary-600 dark:text-neutral-300">
                    {selectedOverride.reason}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-primary-500 dark:text-neutral-400">
                    {selectedOverride.recordedAt}
                  </div>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={overrideDraft}
                    onChange={(event) =>
                      onOverrideDraftChange(event.target.value)
                    }
                    rows={3}
                    placeholder={copy.overridePlaceholder}
                    className="w-full resize-none rounded-lg border border-primary-200 bg-white px-2.5 py-2 text-xs text-primary-900 outline-none focus:ring-2 focus:ring-primary-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                  />
                  <button
                    type="button"
                    disabled={!overrideDraft.trim()}
                    onClick={onRecordOverride}
                    className="w-full rounded-lg border border-accent-600 bg-accent-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {copy.overrideContinue}
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
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

function AuthorityMetadataCard({ value }: { value: string }) {
  const locale = useSettingsStore((state) => state.settings.locale)
  return (
    <Link
      to="/memory"
      search={{ tab: 'governance' }}
      hash="authority-levels"
      className="block rounded-xl border border-primary-200 bg-primary-50/70 p-3 transition-colors hover:border-primary-300 hover:bg-primary-100 dark:border-neutral-800 dark:bg-neutral-900/60 dark:hover:border-neutral-700 dark:hover:bg-neutral-900"
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400">
        {locale === 'zh' ? 'Authority' : 'Authority'}
      </div>
      <div className="mt-1 text-sm text-primary-900 dark:text-neutral-100">
        {value}
      </div>
      <div className="mt-2 text-xs text-primary-500 dark:text-neutral-400">
        {locale === 'zh'
          ? '解释等级和 promotion'
          : 'Explain levels and promotion'}
      </div>
    </Link>
  )
}

function EmptyKnowledgeState({ knowledgeRoot }: { knowledgeRoot: string }) {
  const locale = useSettingsStore((state) => state.settings.locale)
  return (
    <div className="flex min-h-32 flex-col justify-center rounded-xl border border-primary-200 bg-primary-50 px-4 py-5 text-sm text-primary-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
      <div className="text-base font-semibold text-primary-900 dark:text-neutral-100">
        {locale === 'zh' ? '未找到 wiki 页面' : 'No wiki pages found'}
      </div>
      <p className="mt-2 text-pretty">
        {locale === 'zh' ? (
          <>
            Markdown pages 可以放在 <code>{knowledgeRoot}</code>{' '}
            下的任意位置，包括子文件夹。上传的 PDF 和 DOCX 文件会在构建为
            Markdown pages 后显示。
          </>
        ) : (
          <>
            Markdown pages can live anywhere under <code>{knowledgeRoot}</code>,
            including subfolders. Uploaded PDF and DOCX files appear after you
            build them into Markdown pages.
          </>
        )}
      </p>
      <a
        href="https://karpathy.ai/"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary-900 underline decoration-primary-300 underline-offset-4 hover:decoration-primary-500 dark:text-neutral-100"
      >
        <HugeiconsIcon icon={Link01Icon} size={14} strokeWidth={1.7} />
        {locale === 'zh'
          ? '查看 Karpathy LLM wiki pattern'
          : 'See the Karpathy LLM wiki pattern'}
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
