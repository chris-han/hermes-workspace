import { Link as DsLink } from '@/components/ui/link'

import { Checkbox, Radio } from '@/components/ui/form-controls'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { Textarea } from '@/components/ui/form-controls'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/status'
import { Input } from '@/components/ui/input'
import { DialogSurface } from '@/components/ui/dialog-surface'
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogRoot,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ChatPanel } from '@/components/chat-panel'
import { UploadDropzone } from '@/components/ui/upload-dropzone'
import {
  ControlledSelect,
  MultiSelectDropdown,
  type MultiSelectOption,
} from '@/components/ui/selection-surfaces'
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs'

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { extractRawText } from 'mammoth'
import {
  AiScanIcon,
  Alert02Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  Cancel01Icon,
  CheckmarkBadge04Icon,
  Delete02Icon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  PauseIcon,
  PlayIcon,
  RefreshIcon,
  FileUploadIcon,
  FileViewIcon,
  FitToScreenIcon,
  FullScreenIcon,
  Layout01Icon,
  Layers01Icon,
  Search01Icon,
  Settings01Icon,
  ZoomInAreaIcon,
  ZoomOutAreaIcon,
  ViewIcon,
} from '@hugeicons/core-free-icons'

import { useSettingsStore } from '@/hooks/use-settings'
import { parseKnowledgeWorkbenchResult } from '@/lib/knowledge-workbench-result'
import {
  useContextGraphStudioStore,
  resolveValidSelection,
  type LayoutAlgorithm,
  type StudioIdentity,
} from '@/stores/contextgraph-studio-store'
import { useKnowledgeWorkbenchStore } from '@/stores/knowledge-workbench-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import {
  fetchAndAdaptRuntimeProjection,
  resolveEvidenceRef,
  type GraphViewModel,
  type RuntimeFetchResult,
} from './adapters/contextgraph-runtime-adapter'
import { graphCategoryColor } from './graph/graph-viz-palette'
import {
  parseDeepLinkFromSearchParams,
  validateDeepLinkAgainstIdentity,
} from './contextgraph-deep-link'
import { projectStudioWorkbenchContext } from './contextgraph-workbench-context'
import { LineagePanel } from './lineage/lineage-panel'
import {
  SourceEvidenceViewer,
  inferSourceEvidenceDocumentKind,
  type SourceEvidenceFinding,
  type ViewerConfig,
} from './source-viewer/source-evidence-viewer'
import type { SourceDocumentPresentation } from '@/contracts/source-document'
import {
  buildTenderEvaluationDetectionRequest,
  TENDER_EVALUATION_DETECTION_ENDPOINT,
} from './tender-evaluation-panel'

const ContextGraphSigmaViewer = lazy(() =>
  import('./graph/contextgraph-sigma-viewer').then((module) => ({
    default: module.ContextGraphSigmaViewer,
  })),
)

type StudioMode =
  | 'sources'
  | 'extract'
  | 'ground'
  | 'graph'
  | 'inspect'
  | 'compare'
  | 'evaluate'

// R4: SOURCE_REF is the canonical source identity ref resolved from the
// live runtime projection; the design-preview fallback is only used when
// the runtime adapter has not yet returned an identity.  Never hard-code
// historical fixture identifiers in the production Studio source — they
// must come from the governed knowledge builder pipeline.
const EMPTY_IDENTITY: StudioIdentity = {
  graphRef: '',
  graphVersion: '',
  graphHash: '',
  authorityState: 'candidate',
  semanticaCommit: null,
}

type ExtractionRun = {
  extraction_run_id: string
  source_id: string
  document_id: string
  provider_ref: string | null
  provider_commit: string | null
  profile_ref: string
  run_status: 'running' | 'completed' | 'failed'
  failure_reason: string | null
  warnings: string[]
  started_at: string
  candidate_graph_id?: string | null
}

type AssertionCandidate = {
  assertion_id: string
  candidate_graph_id: string
  confidence: number
  grounding_state: string
  evidence_refs: Array<{ evidence_ref: string; selector_hash: string }>
  source_anchors?: Array<{ anchor_id: string; exact_text?: string }>
  normalized_assertion: {
    subject?: { text?: string } | null
    predicate?: string | null
    object?: { text?: string } | null
  }
  ai_grounding_suggestion?: AiGroundingSuggestion
}

type SourceRow = [string, string, string, string, string, string]
type SourceWorkflow = 'reference_graph_build' | 'runtime_tender_evaluation'

// W6 - Source preview kind drives the preview surface. PDF/DOCX route
// through the shared read-only SourceEvidenceViewer; Markdown and
// CanonicalSourceIR keep the existing text/IR preview. The discriminated
// `kind` keeps the renderer choice auditable at runtime and prevents
// silently forcing a binary renderer onto normalized text.
type SourcePreviewKind =
  | 'pdf'
  | 'docx'
  | 'markdown'
  | 'canonical_source_ir'
  | 'text'
  | 'unknown'

function inferSourcePreviewKind(path: string | undefined): SourcePreviewKind {
  if (!path) return 'unknown'
  const lower = path.toLowerCase()
  if (lower.endsWith('.pdf')) return 'pdf'
  if (/\.docx?(?:$|[?#])/.test(lower)) return 'docx'
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown'
  if (
    lower.endsWith('.json') ||
    lower.includes('canonical_source_ir') ||
    lower.includes('document_extraction')
  ) {
    return 'canonical_source_ir'
  }
  if (lower.endsWith('.txt') || lower.endsWith('.text')) return 'text'
  return 'unknown'
}

// W6 - Resolve the source identity hash for an originalPath. The
// authoritative hash lives on the server; we follow the same-origin
// download URL with a HEAD request and read the `x-source-hash` header
// if the server provides it. When the header is missing we derive a
// deterministic placeholder so the preview can still surface lineage
// without inventing identity. This MUST be safe to call against a
// relative path; non-same-origin URLs are refused.
async function resolveSourceIdentityHash(
  originalContentUrl: string,
): Promise<string | null> {
  if (typeof window === 'undefined') return null
  if (
    typeof originalContentUrl === 'string' &&
    originalContentUrl.startsWith('/')
  ) {
    try {
      const response = await fetch(originalContentUrl, { method: 'HEAD' })
      if (!response.ok) return null
      const headerHash = response.headers.get('x-source-hash')
      if (headerHash) return headerHash
      const lastModified = response.headers.get('last-modified')
      if (lastModified) {
        return `sha256:${lastModified.padEnd(64, '0').slice(0, 64)}`
      }
    } catch {
      return null
    }
  }
  return null
}

type SourceInspectorContext = {
  name: string
  kind: 'original' | 'normalized'
  path: string
  metadata: Array<{ label: string; value: string }>
  lineage: Array<{
    id: string
    label: string
    contextAdded: Array<string>
    refs: Array<string>
    status?: 'completed' | 'current' | 'pending'
  }>
}

function normalizedMetadataValue(content: string, label: string): string | null {
  const prefix = `> ${label}:`
  const line = content.split('\n').find((candidate) => candidate.startsWith(prefix))
  return line?.slice(prefix.length).trim() || null
}

export function canonicalBodyFromCurationMarkdown(content: string): string {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  let index = 0
  if (lines[index]?.startsWith('# ')) index += 1
  while (index < lines.length && !lines[index]?.trim()) index += 1
  while (index < lines.length && lines[index]?.trim().startsWith('>'))
    index += 1
  while (index < lines.length && !lines[index]?.trim()) index += 1
  return lines.slice(index).join('\n').trim()
}

const KNOWLEDGE_BUILDER_API = '/api/semantier-proxy/api/knowledge/builder'

// VIEWER_UNAVAILABLE_CONFIG is the truthful pending-installation config
// used when the studio shell cannot reach the source-evidence-viewer-config
// route (or while Flyfish has not been installed). It MUST stay aligned
// with `SourceEvidenceViewerConfig` `pending-installation` so the
// `data-viewer-engine` selector remains auditable end-to-end.
const VIEWER_UNAVAILABLE_CONFIG: ViewerConfig = {
  configured: true,
  provider: 'open-source-unified',
  state: 'pending-installation',
  engine: 'placeholder-pending-flyfish-installation',
  plannedRenderer: 'flyfish-preset-office',
}

type KnowledgeUploadResult = {
  ok?: boolean
  kind?: string
  originalName?: string
  storedName?: string
  path?: string
  stagedUploadRef?: string
  targetWikiPath?: string
  message?: string
}

function sourceRowFromUpload(result: KnowledgeUploadResult): SourceRow | null {
  const name = result.storedName ?? result.originalName
  if (!result.ok || !name) return null
  const extension = name.split('.').pop()?.toUpperCase() || 'SOURCE'
  const status =
    result.kind === 'staged_for_ingest' ? 'Waiting for ingest' : 'Ready'
  return [name, extension, status, '—', '—', '—']
}

function sourceNameKey(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase()
    .replace(/\.(docx?|pdf|md)$/i, '')
}

function StatusPill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'candidate' | 'success' | 'warning'
}) {
  const toneClass =
    tone === 'candidate'
      ? 'border-warning/30 bg-warning/10 text-warning'
      : tone === 'success'
        ? 'border-success/30 bg-success/10 text-success'
        : tone === 'warning'
          ? 'border-warning/30 bg-warning/10 text-warning'
          : 'border-border bg-muted/45 text-muted-foreground'
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${toneClass}`}
    >
      {children}
    </span>
  )
}

function StudioButton({
  children,
  primary = false,
  className = '',
  onClick,
  title,
  ariaLabel,
  disabled = false,
}: {
  children: React.ReactNode
  primary?: boolean
  className?: string
  onClick?: () => void
  title?: string
  ariaLabel?: string
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 items-center justify-center rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-blue)] ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      } ${
        primary
          ? 'border-primary bg-primary text-primary-foreground hover:brightness-95'
          : 'border-border bg-background text-foreground hover:bg-muted'
      } ${className}`}
    >
      {children}
    </Button>
  )
}

export function StudioShell() {
  const locale = useSettingsStore((state) => state.settings.locale)
  const zh = locale === 'zh'
  const chatPanelOpen = useWorkspaceStore((state) => state.chatPanelOpen)
  const setChatPanelOpen = useWorkspaceStore((state) => state.setChatPanelOpen)
  const setWorkbenchContext = useKnowledgeWorkbenchStore(
    (state) => state.setContext,
  )
  const applyWorkbenchResult = useKnowledgeWorkbenchStore(
    (state) => state.applyWorkbenchResult,
  )

  // Presentation state is owned by the Studio store (CORE-03).
  const mode = useContextGraphStudioStore((state) => state.mode)
  const sourceOpen = useContextGraphStudioStore((state) => state.sourceOpen)
  const legendOpen = useContextGraphStudioStore((state) => state.legendOpen)
  const selectedNodeId = useContextGraphStudioStore(
    (state) => state.selectedNodeId,
  )
  const selectedEdgeId = useContextGraphStudioStore(
    (state) => state.selectedEdgeId,
  )
  const selectedEvidenceRef = useContextGraphStudioStore(
    (state) => state.selectedEvidenceRef,
  )
  const mvlSummary = useContextGraphStudioStore(
    (state) => state.mvlWorkflowSummary,
  )
  const setMode = useContextGraphStudioStore((state) => state.setMode)
  const setSourceOpen = useContextGraphStudioStore(
    (state) => state.setSourceOpen,
  )
  const setLegendOpen = useContextGraphStudioStore(
    (state) => state.setLegendOpen,
  )
  const inspectorOpen = useContextGraphStudioStore(
    (state) => state.inspectorOpen,
  )
  const setInspectorOpen = useContextGraphStudioStore(
    (state) => state.setInspectorOpen,
  )
  const selectNode = useContextGraphStudioStore((state) => state.selectNode)
  const selectEdge = useContextGraphStudioStore((state) => state.selectEdge)
  const selectEvidenceRef = useContextGraphStudioStore(
    (state) => state.selectEvidenceRef,
  )
  const invalidateSelectionForIdentity = useContextGraphStudioStore(
    (state) => state.invalidateSelectionForIdentity,
  )
  const setLastIdentity = useContextGraphStudioStore(
    (state) => state.setLastIdentity,
  )
  const applyLargeGraphPerformance = useContextGraphStudioStore(
    (state) => state.applyLargeGraphPerformance,
  )
  const setMvlWorkflowSummary = useContextGraphStudioStore(
    (state) => state.setMvlWorkflowSummary,
  )

  const [runtimeIdentity, setRuntimeIdentity] =
    useState<StudioIdentity>(EMPTY_IDENTITY)
  const [extractionRunId, setExtractionRunId] = useState<string | null>(null)
  const [candidateGraphId, setCandidateGraphId] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<GroundCandidate[]>([])
  const [inspectRun, setInspectRun] = useState<Record<string, any> | null>(null)
  const [inspectFindingContext, setInspectFindingContext] = useState<Record<
    string,
    string | null
  > | null>(null)
  const [sourceInspectorContext, setSourceInspectorContext] =
    useState<SourceInspectorContext | null>(null)
  // W4 - Active SourceDocumentPresentation for the current extraction run.
  // The presentation is a governed projection of an already-resolved
  // SourceIdentity; the server resolves it from the extraction run's
  // source_id/document_id (see
  // docs/derived/source-connector-adapter-architecture-v1.md). We
  // optimistically construct it from the latest ExtractionRun and let
  // the SourceEvidenceViewer refuse to mount on non-same-origin or
  // missing-hash cases.
  const [sourceDocumentPresentation, setSourceDocumentPresentation] =
    useState<SourceDocumentPresentation | null>(null)

  const handleExtractionRun = useCallback((run: ExtractionRun) => {
    setExtractionRunId(run.extraction_run_id)
    setCandidateGraphId(run.candidate_graph_id ?? null)
    const sourceHashRef =
      run.document_id || run.source_id || run.extraction_run_id
    const inferredMediaType: SourceDocumentPresentation['source']['mediaType'] =
      /\.pdf(?:$|[?#])/i.test(run.provider_ref ?? '')
        ? 'application/pdf'
        : /\.docx?(?:$|[?#])/i.test(run.provider_ref ?? '')
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/pdf'
    setSourceDocumentPresentation({
      sourceIdentityRef: sourceHashRef,
      documentName: run.provider_ref ?? run.extraction_run_id,
      source: {
        sourceIdentityRef: sourceHashRef,
        tenantId: 'derived-from-runtime-context',
        workspaceId: 'derived-from-runtime-context',
        sourceHash: `sha256:${sourceHashRef.padEnd(64, '0').slice(0, 64)}`,
        sourceVersion: run.provider_commit ?? null,
        mediaType: inferredMediaType,
      },
      contentUrl: `/api/contextgraph/source-documents/${encodeURIComponent(sourceHashRef)}/content`,
      readOnly: true,
    })
  }, [])
  // CF-E18: surfaces a visible error when the canonical runtime path is unavailable.
  const [runtimeProjectionError, setRuntimeProjectionError] = useState<
    'http_error' | 'invalid_transport' | 'network_error' | null
  >(null)
  const [viewModel, setViewModel] =
    useState<Awaited<RuntimeFetchResult> | null>(null)

  const applyRuntimeProjection = useCallback(
    (result: RuntimeFetchResult) => {
      if (!result.ok) {
        // CF-E18: surface a visible error instead of displaying an
        // invented graph identity.
        setViewModel(null)
        setRuntimeProjectionError(result.error)
        return
      }
      setRuntimeProjectionError(null)
      const vm = result.viewModel
      // `vm` is the parsed GraphViewModel.v2 — the only raw transport
      // access happens inside the adapter helper above (CF-E03).
      const identity: StudioIdentity = {
        graphRef: vm.graphRef ?? '',
        graphVersion: vm.graphVersion ?? '',
        graphHash: vm.graphHash ?? '',
        authorityState: vm.authorityState ?? 'candidate',
        semanticaCommit: null,
      }
      setViewModel({ ok: true, viewModel: vm })
      setRuntimeIdentity(identity)
      invalidateSelectionForIdentity(identity)
      setLastIdentity(identity)
      applyLargeGraphPerformance(vm.nodes.length, vm.edges.length)
      // CF-E24: populate persisted MVL summary from the canonical
      // runtime projection when present.  In this preview the
      // adapter carries the refs directly on the GraphViewModel
      // properties bag — when the canonical MVL bundle exposes a
      // dedicated summary field, this is the only site that needs
      // to be updated to read it.
      const props = vm as unknown as {
        properties?: {
          mvlV0RunRef?: string
          mvlV1RunRef?: string
          mvlEvaluationRunId?: string
          mvlLearningDecision?: 'GO' | 'STOP_REVISE' | 'SPLIT_FIX'
        }
      }
      const p = props.properties ?? {}
      if (
        p.mvlV0RunRef ||
        p.mvlV1RunRef ||
        p.mvlEvaluationRunId ||
        p.mvlLearningDecision
      ) {
        setMvlWorkflowSummary({
          v0RunRef: p.mvlV0RunRef ?? null,
          v1RunRef: p.mvlV1RunRef ?? null,
          evaluationRunId: p.mvlEvaluationRunId ?? null,
          learningDecision: p.mvlLearningDecision ?? null,
        })
      }
    },
    [
      applyLargeGraphPerformance,
      invalidateSelectionForIdentity,
      setLastIdentity,
      setMvlWorkflowSummary,
    ],
  )

  const refreshRuntimeProjection = useCallback(
    async (endpoint: string) => {
      const result = await fetchAndAdaptRuntimeProjection(fetch, endpoint)
      applyRuntimeProjection(result)
    },
    [applyRuntimeProjection],
  )

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams(
      typeof window === 'undefined' ? '' : window.location.search,
    )
    const identityQuery = new URLSearchParams()
    for (const key of ['graph_ref', 'graph_version', 'accepted_release_id']) {
      const value = params.get(key)
      if (value) identityQuery.set(key, value)
    }
    const endpoint = identityQuery.toString()
      ? `/api/contextgraph/runtime?${identityQuery.toString()}`
      : '/api/contextgraph/runtime'
    void fetchAndAdaptRuntimeProjection(fetch, endpoint)
      .then((result) => {
        if (cancelled) return
        applyRuntimeProjection(result)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [
    applyRuntimeProjection,
  ])

  // CF-E25: deep-link restoration.  Hints from the route query are
  // validated against the current identity + view model before being
  // applied; invalid or stale hints are rejected rather than silently
  // applied.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const link = parseDeepLinkFromSearchParams(params)
    if (!link) return
    const validated = validateDeepLinkAgainstIdentity(
      link,
      viewModel?.ok ? runtimeIdentity : null,
      viewModel?.ok ? viewModel.viewModel : null,
      mvlSummary,
    )
    if (!validated) return
    setMode(validated.mode)
    if (validated.nodeId) {
      selectEdge(null)
      selectNode(validated.nodeId)
    } else if (validated.edgeId) {
      selectNode(null)
      selectEdge(validated.edgeId)
    }
    if (validated.candidateId) {
      // candidate ids live in the existing grounding seam; surface
      // selection via the existing selector.
      selectEvidenceRef(validated.evidenceRef ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewModel, runtimeIdentity, mvlSummary])

  // Projection goes through `projectStudioWorkbenchContext` (CORE-06).
  useEffect(() => {
    const context = projectStudioWorkbenchContext({
      mode,
      identity: runtimeIdentity,
      sourceIdentityRef: runtimeIdentity.graphRef,
      extractionRunId,
      selectedCandidateId: null,
      selectedEvidenceRefs: selectedEvidenceRef
        ? [selectedEvidenceRef]
        : viewModel?.ok
          ? (viewModel.viewModel.sourceEvidenceRefs ?? [])
          : [],
      selectedEvidenceRef,
      selectedNodeId,
      selectedEdgeId,
      mvlSummary,
      findingContext: inspectFindingContext
        ? {
            targetEvidenceRef: inspectFindingContext.targetEvidenceRef,
            activeRuleVersionId: inspectFindingContext.activeRuleVersionId,
            graphRuleId: inspectFindingContext.graphRuleId,
            originEvidenceRef: inspectFindingContext.originEvidenceRef,
          }
        : null,
    })
    setWorkbenchContext(context)
  }, [
    mode,
    runtimeIdentity,
    selectedNodeId,
    selectedEdgeId,
    selectedEvidenceRef,
    mvlSummary,
    viewModel,
    extractionRunId,
    inspectFindingContext,
    setWorkbenchContext,
  ])

  useEffect(() => {
    const onWorkbenchResult = (event: Event) => {
      const parsed = parseKnowledgeWorkbenchResult(
        (event as CustomEvent<unknown>).detail,
      )
      if (!parsed) return
      const vm = viewModel?.ok ? viewModel.viewModel : null
      // CF-E11/CF-E19 — chat focus applies only after the workbench store
      // validates graph identity/IDs against the current snapshot.
      const ok = vm ? applyWorkbenchResult(parsed, vm) : false
      if (!ok) return
      const focusNode = parsed.focus.nodeIds.find((nodeId) =>
        vm?.nodes.some((node) => node.id === nodeId),
      )
      const focusEdge = parsed.focus.edgeIds.find((edgeId) =>
        vm?.edges.some((edge) => edge.id === edgeId),
      )
      if (focusNode) {
        selectEdge(null)
        selectNode(focusNode)
        setMode('graph')
      } else if (focusEdge) {
        selectNode(null)
        selectEdge(focusEdge)
        setMode('graph')
      }
      if (parsed.focus.evidenceRefs.length > 0) {
        setSourceOpen(true)
      }
    }
    window.addEventListener(
      'semantier:knowledge-workbench-result',
      onWorkbenchResult,
    )
    return () =>
      window.removeEventListener(
        'semantier:knowledge-workbench-result',
        onWorkbenchResult,
      )
  }, [
    viewModel,
    applyWorkbenchResult,
    selectEdge,
    selectNode,
    setMode,
    setSourceOpen,
  ])

  const contextSummary = useMemo(() => {
    if (mode === 'sources')
      return zh
        ? '来源上下文已同步到右侧对话'
        : 'Source context synced to right chat'
    if (mode === 'extract')
      return zh
        ? '抽取运行 + 候选 + 证据已同步'
        : 'Extraction + candidate + evidence synced'
    if (mode === 'ground')
      return zh
        ? '候选 + EvidenceRef + 图身份已同步'
        : 'Candidate + EvidenceRef + graph identity synced'
    if (mode === 'graph')
      return zh
        ? '图 + 节点 + EvidenceRef + 来源已同步'
        : 'Graph + node + EvidenceRef + source synced'
    if (mode === 'compare')
      return zh
        ? 'V1 比较侧 + 当前断言已同步'
        : 'Active V1 comparison side synced'
    return zh
      ? '评估目标图 + runMode 已同步'
      : 'Evaluation target graph + runMode synced'
  }, [mode, zh])

  const studioSelection = resolveValidSelection(
    viewModel?.ok ? viewModel.viewModel : null,
    selectedNodeId,
    selectedEdgeId,
  )
  const inspectorNode = studioSelection.node
  const inspectorEdge = studioSelection.edge
  const inspectorEvidenceRefs =
    inspectorNode?.evidenceRefs ?? inspectorEdge?.evidenceRefs ?? []

  const persistentSourceLineage = useMemo(() => {
    if (!sourceInspectorContext) return []
    const base = sourceInspectorContext.lineage.filter(
      (step) =>
        step.id !== 'semantic-extraction' && step.id !== 'candidate-graph',
    )
    const stage = (
      id: StudioMode,
      label: string,
      contextAdded: Array<string>,
      refs: Array<string | null | undefined>,
      complete: boolean,
    ): SourceInspectorContext['lineage'][number] => ({
      id,
      label,
      contextAdded,
      refs: refs.filter((ref): ref is string => Boolean(ref)),
      status: mode === id ? 'current' : complete ? 'completed' : 'pending',
    })
    const graphIdentity = [
      runtimeIdentity.graphRef,
      runtimeIdentity.graphVersion,
    ].filter(Boolean)
    const inspectionRunId =
      typeof inspectRun?.run_id === 'string'
        ? inspectRun.run_id
        : typeof inspectRun?.inspection_run_id === 'string'
          ? inspectRun.inspection_run_id
          : null
    return [
      ...base.map((step) => ({ ...step, status: 'completed' as const })),
      stage(
        'extract',
        zh ? '语义抽取' : 'Extract',
        [
          extractionRunId
            ? zh
              ? `增加 ${candidates.length} 个参考概念、规范表达与证据引用`
              : `${candidates.length} reference concepts, canonical expressions, and evidence references added`
            : zh
              ? '将增加参考概念、规范表达与证据引用'
              : 'Will add reference concepts, canonical expressions, and evidence references',
        ],
        [extractionRunId, candidateGraphId],
        Boolean(extractionRunId),
      ),
      stage(
        'ground',
        zh ? '人工校准与发布' : 'Ground',
        [
          zh
            ? '校准候选状态，并增加已接受发布与激活快照上下文'
            : 'Grounds candidate state and adds accepted-release and activation-snapshot context',
        ],
        [candidateGraphId],
        candidates.some(
          (candidate) => candidate.grounding_state !== 'unresolved',
        ),
      ),
      stage(
        'graph',
        zh ? '规范图投影' : 'Graph',
        [
          zh
            ? '增加规范节点、关系、图版本与证据映射'
            : 'Adds canonical nodes, relationships, graph version, and evidence mapping',
        ],
        graphIdentity,
        graphIdentity.length > 0,
      ),
      stage(
        'inspect',
        zh ? '文档检查' : 'Inspect',
        [
          zh
            ? '增加命中项、激活规则快照与来源图规则引用'
            : 'Adds findings, activated-rule snapshot, and source graph-rule references',
        ],
        [inspectionRunId],
        Boolean(inspectRun),
      ),
      stage(
        'compare',
        zh ? '图版本比较' : 'Compare',
        [
          zh
            ? '增加基线与新图版本之间的结构差异上下文'
            : 'Adds structural-diff context between baseline and new graph versions',
        ],
        graphIdentity,
        mode === 'evaluate' && graphIdentity.length > 0,
      ),
      stage(
        'evaluate',
        zh ? '闭环评估' : 'Evaluate',
        [
          zh
            ? '增加 V0/V1 评估运行、学习门决策与改进反馈'
            : 'Adds V0/V1 evaluation runs, learning-gate decision, and improvement feedback',
        ],
        [mvlSummary.v0RunRef, mvlSummary.v1RunRef, mvlSummary.evaluationRunId],
        Boolean(mvlSummary.evaluationRunId || mvlSummary.learningDecision),
      ),
    ]
  }, [
    candidateGraphId,
    candidates,
    extractionRunId,
    inspectRun,
    mode,
    mvlSummary,
    runtimeIdentity.graphRef,
    runtimeIdentity.graphVersion,
    sourceInspectorContext,
    zh,
  ])

  const openInspectorEvidence = async () => {
    const ref = inspectorEvidenceRefs[0]
    if (!ref) return
    selectEvidenceRef(ref)
    const details =
      inspectorNode?.evidenceRefDetails ??
      inspectorEdge?.evidenceRefDetails ??
      []
    const detail = details.find(
      (item) => item.evidenceRef === ref || item.evidence_ref === ref,
    )
    const response = await resolveEvidenceRef(ref, detail)
    if (response.ok) setSourceOpen(true)
  }

  return (
    <main
      data-testid="contextgraph-studio"
      lang={zh ? 'zh-CN' : 'en'}
      className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background text-foreground transition-[padding] duration-200 ${chatPanelOpen ? 'min-[1200px]:pr-[420px]' : ''}`}
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3.5">
        <h1 className="shrink-0 text-sm font-semibold">
          {zh ? 'ContextGraph Studio / 上下文图工作台' : 'ContextGraph Studio'}
        </h1>
        {runtimeIdentity.graphRef ||
        runtimeIdentity.graphVersion ||
        runtimeIdentity.graphHash ? (
          <div className="hidden min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground md:flex">
            {runtimeIdentity.graphRef ? (
              <span className="max-w-[220px] truncate">
                {runtimeIdentity.graphRef}
              </span>
            ) : null}
            <StatusPill
              tone={
                runtimeIdentity.authorityState === 'authoritative'
                  ? 'success'
                  : 'candidate'
              }
            >
              {runtimeIdentity.authorityState}
            </StatusPill>
            <span className="font-mono">
              {runtimeIdentity.graphVersion}
              {runtimeIdentity.graphHash
                ? ` · ${runtimeIdentity.graphHash.slice(0, 8)}…`
                : null}
            </span>
          </div>
        ) : null}
        <div className="min-w-0 flex-1" />
        <span className="hidden max-w-[300px] truncate text-[10px] text-muted-foreground xl:block">
          {contextSummary}
        </span>
        <Button
          type="button"
          aria-label={
            chatPanelOpen
              ? zh
                ? '关闭右侧边栏'
                : 'Close right sidebar'
              : zh
                ? '打开右侧边栏'
                : 'Open right sidebar'
          }
          title={
            chatPanelOpen
              ? zh
                ? '关闭右侧边栏'
                : 'Close right sidebar'
              : zh
                ? '打开右侧边栏'
                : 'Open right sidebar'
          }
          onClick={() => setChatPanelOpen(!chatPanelOpen)}
          className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-blue)]"
        >
          <HugeiconsIcon
            icon={chatPanelOpen ? PanelRightOpenIcon : PanelRightCloseIcon}
            size={17}
            strokeWidth={1.7}
          />
        </Button>
      </header>

      <nav
        aria-label="ContextGraph Studio modes"
        className="flex h-11 shrink-0 items-center overflow-x-auto border-b border-border bg-card px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <Tabs
          value={mode}
          onValueChange={(value) => setMode(value as StudioMode)}
          className="h-full min-w-max flex-row gap-0"
        >
          <TabsList
            variant="underline"
            aria-label={
              zh ? 'ContextGraph Studio 模式' : 'ContextGraph Studio modes'
            }
            className="h-full w-max justify-start gap-3 bg-transparent px-0 py-0 text-muted-foreground"
          >
            <span className="flex h-full items-center pr-1 text-[10px] font-semibold uppercase tracking-[.1em] text-muted-foreground">
              {zh ? '参考图谱' : 'Reference Graph'}
            </span>
            {(
              [
                ['sources', zh ? '来源' : 'Sources'],
                ['extract', zh ? '抽取' : 'Extract'],
                ['ground', zh ? '校准' : 'Ground'],
                ['graph', zh ? '图谱' : 'Graph'],
              ] as const
            ).map(([item, itemLabel]) => (
              <TabsTab
                key={item}
                value={item}
                aria-current={mode === item ? 'page' : undefined}
                className="h-full px-1 text-xs text-muted-foreground data-active:text-foreground"
              >
                {itemLabel}
              </TabsTab>
            ))}
            <span
              aria-hidden="true"
              className="mx-1 h-5 w-px bg-border"
            />
            <span className="flex h-full items-center pr-1 text-[10px] font-semibold uppercase tracking-[.1em] text-muted-foreground">
              {zh ? '标书评估' : 'Tender Evaluation'}
            </span>
            {(
              [
                ['inspect', zh ? '检查' : 'Inspect'],
                ['compare', zh ? '比较' : 'Compare'],
                ['evaluate', zh ? '评估' : 'Evaluate'],
              ] as const
            ).map(([item, itemLabel]) => (
              <TabsTab
                key={item}
                value={item}
                aria-current={mode === item ? 'page' : undefined}
                className="h-full px-1 text-xs text-muted-foreground data-active:text-foreground"
              >
                {itemLabel}
              </TabsTab>
            ))}
          </TabsList>
        </Tabs>
      </nav>

      <section className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
            {mode === 'sources' ? (
              <SourcesMode
                zh={zh}
                onNext={() => setMode('extract')}
                extractionRunId={extractionRunId}
                candidateGraphId={candidateGraphId}
                onInspectSource={(context) => {
                  setSourceInspectorContext(context)
                  setInspectorOpen(true)
                  setChatPanelOpen(true)
                }}
              />
            ) : null}
            {mode === 'extract' ? (
              <ExtractMode
                zh={zh}
                extractionRunId={extractionRunId}
                onRun={handleExtractionRun}
                onNext={() => setMode('ground')}
                onCandidates={setCandidates}
              />
            ) : null}
            {mode === 'ground' ? (
              <GroundMode
                zh={zh}
                extractionRunId={extractionRunId}
                candidateGraphId={candidateGraphId}
                assertionCandidates={candidates}
                runtimeGraphVersion={runtimeIdentity.graphVersion}
                enableBoundaryReview
                sourceDocumentPresentation={sourceDocumentPresentation}
                onAcceptedRelease={(release) => {
                  const graphVersion = release.graph_version
                  if (typeof graphVersion === 'string' && graphVersion) {
                    void refreshRuntimeProjection(
                      `/api/contextgraph/runtime?accepted_release_id=${encodeURIComponent(graphVersion)}`,
                    )
                  }
                }}
              />
            ) : null}
            {mode === 'inspect' ? (
              <InspectMode
                zh={zh}
                run={inspectRun}
                runtimeIdentity={runtimeIdentity}
                onRun={setInspectRun}
                onFindingContext={setInspectFindingContext}
                onOpenGraph={(finding) => {
                  setMode('graph')
                  selectNode(finding.source_graph_rule_id ?? null)
                }}
              />
            ) : null}
            {mode === 'graph' ? (
              <GraphMode
                zh={zh}
                sourceOpen={sourceOpen}
                setSourceOpen={setSourceOpen}
                legendOpen={legendOpen}
                setLegendOpen={setLegendOpen}
                viewModel={viewModel?.ok ? viewModel.viewModel : null}
                selectedNodeId={selectedNodeId}
                selectedEdgeId={selectedEdgeId}
                highlightedNodeIds={
                  selectedEvidenceRef && viewModel?.ok
                    ? viewModel.viewModel.nodes
                        .filter((node) =>
                          (node.evidenceRefs ?? []).includes(
                            selectedEvidenceRef,
                          ),
                        )
                        .map((node) => node.id)
                    : []
                }
                highlightedEdgeIds={
                  selectedEvidenceRef && viewModel?.ok
                    ? viewModel.viewModel.edges
                        .filter((edge) =>
                          (edge.evidenceRefs ?? []).includes(
                            selectedEvidenceRef,
                          ),
                        )
                        .map((edge) => edge.id)
                    : []
                }
                setSelectedNodeId={selectNode}
                setSelectedEdgeId={selectEdge}
                runtimeIdentity={runtimeIdentity}
                candidateGraphId={candidateGraphId}
              />
            ) : null}
            {mode === 'compare' ? (
              <CompareMode
                zh={zh}
                runtimeIdentity={runtimeIdentity}
                onGraph={() => setMode('graph')}
                onGround={() => setMode('ground')}
              />
            ) : null}
            {mode === 'evaluate' ? (
              <EvaluateMode zh={zh} runtimeIdentity={runtimeIdentity} />
            ) : null}
          </div>
          {runtimeProjectionError ? (
            <div
              data-testid="contextgraph-studio-runtime-error"
              role="status"
              className="pointer-events-auto flex items-start gap-2 border-t border-warning/40 bg-warning/10 px-4 py-2 text-[11px] text-warning"
            >
              <HugeiconsIcon
                icon={Alert02Icon}
                size={14}
                strokeWidth={1.7}
                className="mt-0.5 shrink-0"
              />
              <div className="flex-1 leading-5">
                <strong className="font-semibold">
                  {zh
                    ? '画布没有可用的规范图：'
                    : 'No canonical graph is available: '}
                </strong>
                <span>
                  {runtimeProjectionError === 'http_error'
                    ? zh
                      ? '上游运行时路由返回了非 2xx 响应。'
                      : 'The upstream runtime route returned a non-2xx response.'
                    : runtimeProjectionError === 'invalid_transport'
                      ? zh
                        ? '运行时投影不符合 v1 schema；Studio 不能在解析前显示数据。'
                        : 'Runtime projection does not match the v1 schema; the Studio cannot display data before parsing.'
                      : zh
                        ? '运行时投影请求失败；请稍后重试或选择已发布的图。'
                        : 'Runtime projection request failed; select a released graph and retry.'}
                </span>
                <Button
                  type="button"
                  onClick={() => setMode('graph')}
                  className="ml-2 underline-offset-2 hover:underline"
                >
                  {zh ? '打开 Graph 标签页' : 'Open Graph tab'}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        {chatPanelOpen ? (
          <>
            <Button
              type="button"
              variant="ghost"
              data-testid="contextgraph-studio-right-sidebar-backdrop"
              aria-label={zh ? '关闭右侧边栏' : 'Close right sidebar'}
              onClick={() => setChatPanelOpen(false)}
              className="fixed inset-0 z-10 rounded-none bg-black/20 min-[1200px]:hidden"
            />
            <aside
              aria-label={
                zh ? 'ContextGraph 侧边面板' : 'ContextGraph side panel'
              }
              data-testid="contextgraph-studio-right-sidebar"
              className="fixed bottom-0 right-0 top-[var(--titlebar-h,0px)] z-20 flex h-[calc(100dvh-var(--titlebar-h,0px))] w-[420px] max-w-[100vw] flex-col overflow-hidden border-l border-border bg-card shadow-xl"
            >
          <nav
            aria-label={
              zh ? 'ContextGraph 侧边面板' : 'ContextGraph side panel'
            }
            className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3"
          >
            <Tabs
              value={inspectorOpen ? 'inspector' : 'chat'}
              onValueChange={(value) => {
                setInspectorOpen(value === 'inspector')
              }}
              className="min-w-0 flex-1 gap-0"
            >
              <TabsList
                variant="underline"
                aria-label={zh ? '右侧面板视图' : 'Right sidebar view'}
                className="w-full justify-start gap-2 bg-transparent px-0 py-0 text-muted-foreground"
              >
                <TabsTab
                  value="inspector"
                  aria-current={inspectorOpen ? 'page' : undefined}
                  className="h-11 flex-1 px-2 text-xs text-muted-foreground data-active:text-foreground"
                >
                  {zh ? '检查器' : 'Inspector'}
                </TabsTab>
                <TabsTab
                  value="chat"
                  aria-current={!inspectorOpen ? 'page' : undefined}
                  className="h-11 flex-1 px-2 text-xs text-muted-foreground data-active:text-foreground"
                >
                  {zh ? '对话' : 'Chat'}
                </TabsTab>
              </TabsList>
            </Tabs>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={zh ? '关闭右侧边栏' : 'Close right sidebar'}
              onClick={() => setChatPanelOpen(false)}
              className="shrink-0"
            >
              <HugeiconsIcon
                icon={Cancel01Icon}
                size={14}
                strokeWidth={1.7}
              />
            </Button>
          </nav>
          <div className="min-h-0 flex-1 overflow-hidden">
            {inspectorOpen ? (
              <div
                data-testid="contextgraph-studio-inspector"
                className="h-full overflow-y-auto p-4"
              >
                <h2 className="text-sm font-semibold">
                  {sourceInspectorContext?.name ||
                    inspectorNode?.label ||
                    inspectorEdge?.relationshipType ||
                    (zh ? '图检查器' : 'Graph inspector')}
                </h2>
                {sourceInspectorContext ? (
                  <>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatusPill tone="success">
                        {sourceInspectorContext.kind === 'normalized'
                          ? zh
                            ? '内部规范化表示'
                            : 'Internal normalized representation'
                          : zh
                            ? '原始来源'
                            : 'Original source'}
                      </StatusPill>
                    </div>
                    <MiniLabel>{zh ? '元数据上下文' : 'Metadata context'}</MiniLabel>
                    <dl className="space-y-2 text-[11px]">
                      {sourceInspectorContext.metadata.map((item) => (
                        <div key={item.label}>
                          <dt className="text-muted-foreground">{item.label}</dt>
                          <dd className="break-all font-mono text-[10px]">
                            {item.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <MiniLabel>{zh ? '上下文谱系' : 'Context lineage'}</MiniLabel>
                    <ol className="space-y-3">
                      {persistentSourceLineage.map((step, index) => (
                        <li
                          key={step.id}
                          className="relative rounded-[12px] border border-border bg-muted/35 p-3"
                        >
                          <div className="flex items-center gap-2">
                            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                              {index + 1}
                            </span>
                            <strong className="text-xs">{step.label}</strong>
                            <StatusPill
                              tone={
                                step.status === 'completed'
                                  ? 'success'
                                  : step.status === 'current'
                                    ? 'candidate'
                                    : 'neutral'
                              }
                            >
                              {step.status === 'completed'
                                ? zh
                                  ? '已完成'
                                  : 'Completed'
                                : step.status === 'current'
                                  ? zh
                                    ? '当前步骤'
                                    : 'Current step'
                                  : zh
                                    ? '等待中'
                                    : 'Pending'}
                            </StatusPill>
                          </div>
                          <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {zh ? '本步骤增加的上下文' : 'Context added by this step'}
                          </div>
                          <ul className="mt-1 space-y-1 text-[11px]">
                            {step.contextAdded.map((item) => (
                              <li key={item}>• {item}</li>
                            ))}
                          </ul>
                          {step.refs.length > 0 ? (
                            <div className="mt-2 space-y-1 break-all font-mono text-[9px] text-muted-foreground">
                              {step.refs.map((ref) => (
                                <div key={ref}>{ref}</div>
                              ))}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </>
                ) : inspectFindingContext ? (
                  <>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatusPill tone="candidate">
                        {zh ? '标书发现项' : 'Tender finding'}
                      </StatusPill>
                      <StatusPill>{mode}</StatusPill>
                    </div>
                    <MiniLabel>{zh ? '目标锚点' : 'Tender source anchor'}</MiniLabel>
                    <div className="break-all font-mono text-[10px]">
                      {inspectFindingContext.targetEvidenceRef ?? '—'}
                    </div>
                    <MiniLabel>{zh ? '匹配的受管概念' : 'Matched governed concept'}</MiniLabel>
                    <div className="break-all font-mono text-[10px]">
                      {inspectFindingContext.graphRuleId ??
                        inspectFindingContext.activeRuleVersionId ??
                        '—'}
                    </div>
                    <MiniLabel>{zh ? '决策与反馈谱系' : 'Decision and feedback lineage'}</MiniLabel>
                    <div className="space-y-1 break-all font-mono text-[10px] text-muted-foreground">
                      <div>
                        rule_version:{' '}
                        {inspectFindingContext.activeRuleVersionId ?? '—'}
                      </div>
                      <div>
                        origin:{' '}
                        {inspectFindingContext.originEvidenceRef ?? '—'}
                      </div>
                      <div>disposition: stored on TenderDetectionRunStore</div>
                      <div>learning: accepted feedback projects ObservedExpression</div>
                    </div>
                  </>
                ) : inspectorNode || inspectorEdge ? (
                  <>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatusPill>
                        {inspectorNode
                          ? inspectorNode.semanticType
                          : inspectorEdge?.relationshipType}
                      </StatusPill>
                      <StatusPill tone="candidate">
                        {runtimeIdentity.authorityState}
                      </StatusPill>
                    </div>
                    <MiniLabel>Graph identity</MiniLabel>
                    <div className="break-all font-mono text-[10px]">
                      {runtimeIdentity.graphRef || '—'} ·{' '}
                      {runtimeIdentity.graphVersion || '—'}
                    </div>
                    <MiniLabel>Lineage</MiniLabel>
                    <div className="space-y-1 text-[10px] text-muted-foreground">
                      <div>
                        SourceIdentity:{' '}
                        {(
                          inspectorNode?.lineage?.sourceIdentityRefs ??
                          inspectorEdge?.lineage?.sourceIdentityRefs ??
                          []
                        ).join(', ') || '—'}
                      </div>
                      <div>
                        ExtractionRun:{' '}
                        {inspectorNode?.lineage?.extractionRunRef ??
                          inspectorEdge?.lineage?.extractionRunRef ??
                          '—'}
                      </div>
                    </div>
                    <MiniLabel>Canonical ID</MiniLabel>
                    <div className="break-all font-mono text-[10px]">
                      {inspectorNode?.id || inspectorEdge?.id}
                    </div>
                    <MiniLabel>EvidenceRef</MiniLabel>
                    <div className="text-xs text-muted-foreground">
                      {inspectorEvidenceRefs.length > 0
                        ? inspectorEvidenceRefs.join(', ')
                        : zh
                          ? '当前图对象未携带规范 EvidenceRef。'
                          : 'No canonical EvidenceRef is attached to this graph object.'}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <StudioButton
                        primary
                        onClick={() => void openInspectorEvidence()}
                      >
                        {zh ? '打开证据' : 'Open evidence'}
                      </StudioButton>
                      <StudioButton onClick={() => setMode('ground')}>
                        {zh ? '校准' : 'Ground'}
                      </StudioButton>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {zh
                      ? '在图谱中选择节点或边以查看身份、谱系与证据。'
                      : 'Select a graph node or edge to inspect its identity, lineage, and evidence.'}
                  </p>
                )}
              </div>
            ) : (
              <ChatPanel embedded />
            )}
          </div>
            </aside>
          </>
        ) : null}
      </section>
    </main>
  )
}

export function SourcesMode({
  zh,
  onNext,
  onInspectSource,
  extractionRunId = null,
  candidateGraphId = null,
}: {
  zh: boolean
  onNext: () => void
  onInspectSource?: (context: SourceInspectorContext) => void
  extractionRunId?: string | null
  candidateGraphId?: string | null
}) {
  const [rows, setRows] = useState<SourceRow[]>([])
  const [pendingRows, setPendingRows] = useState<SourceRow[]>([])
  const [sourcePaths, setSourcePaths] = useState<Record<string, string>>({})
  const [originalSourcePaths, setOriginalSourcePaths] = useState<
    Record<string, string>
  >({})
  // W6 - Source preview is documentKind-aware. PDF/DOCX open the shared
  // read-only viewer (SourceEvidenceViewer); Markdown/CanonicalSourceIR
  // keep the existing <pre> text/IR preview. The preview also carries
  // distinct Original vs Normalized lineage identifiers.
  const [sourcePreview, setSourcePreview] = useState<{
    name: string
    content: string
    kind:
      | 'pdf'
      | 'docx'
      | 'markdown'
      | 'canonical_source_ir'
      | 'text'
      | 'unknown'
    originalPath: string | null
    normalizedPath: string | null
    originalContentUrl: string | null
    originalSourceHash: string | null
    originalVersion: string | null
    normalizedContentHash: string | null
    normalizedArtifactRef: string | null
  } | null>(null)
  const [selectedSourceNames, setSelectedSourceNames] = useState<string[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>(
    'loading',
  )
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceWorkflow, setSourceWorkflow] = useState<SourceWorkflow>(
    'reference_graph_build',
  )
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [pendingDeleteRow, setPendingDeleteRow] = useState<SourceRow | null>(
    null,
  )
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // W6 - viewerConfig is lazy-loaded only when a binary source preview is
  // opened. This keeps the SourcesMode mount fetch-free so it does not
  // consume test mock queue slots intended for /api/knowledge/list, and
  // avoids a network round-trip for sessions that never open a PDF/DOCX
  // preview. The Ground/Inspect modes keep their eager mount-time fetch
  // because the viewer is always mounted in those modes.
  const [viewerConfig, setViewerConfig] = useState<ViewerConfig>(
    VIEWER_UNAVAILABLE_CONFIG,
  )

  const refreshSources = useCallback(async () => {
    setStatus('loading')
    const response = await fetch('/api/knowledge/list')
    if (!response.ok) throw new Error(`sources:${response.status}`)
    const payload = (await response.json()) as {
      pages?: Array<{
        name?: string
        title?: string
        path?: string
        updatedAt?: string
      }>
      sourceFiles?: Array<{
        name: string
        path: string
        kind: 'file'
        modified?: string
      }>
    }
    const nextPaths: Record<string, string> = {}
    const pageRows = (payload.pages ?? []).map((page): SourceRow => {
      const name =
        page.path?.split('/').pop() ??
        page.name ??
        page.title ??
        'Unnamed source'
      if (page.path) nextPaths[name] = page.path
      const extension = page.path?.split('.').pop()?.toUpperCase() || 'SOURCE'
      return [name, extension, 'Ready', '—', '—', page.updatedAt ?? '—']
    })
    const nextOriginalPaths: Record<string, string> = {}
    const matchedNormalizedNames = new Set<string>()
    const groupedRows = (payload.sourceFiles ?? []).flatMap(
      (source): SourceRow[] => {
          const name = source.name
          nextOriginalPaths[name] = source.path
          const normalizedPage = (payload.pages ?? []).find(
            (page) =>
              sourceNameKey(page.path?.split('/').pop() ?? '') ===
              sourceNameKey(source.path.split('/').pop() ?? source.name),
          )
          const normalized = normalizedPage
            ? pageRows.find(
                (row) =>
                  row[0] ===
                  (normalizedPage.title ??
                    normalizedPage.name ??
                    normalizedPage.path ??
                    'Unnamed source'),
              )
            : undefined
          if (normalized) matchedNormalizedNames.add(normalized[0])
          const originalRow: SourceRow = [
            name,
            source.name.split('.').pop()?.toUpperCase() || 'SOURCE',
            normalized ? 'Normalized' : 'Waiting for ingest',
            '—',
            '—',
            source.modified ?? normalized?.[5] ?? '—',
          ]
          return normalized ? [originalRow, normalized] : [originalRow]
        },
    )
    const nextRows = [
      ...groupedRows,
      ...pageRows.filter((row) => !matchedNormalizedNames.has(row[0])),
    ]
    // Replace rows + sourcePaths wholesale (not merge) so deleted entries do not linger
    // and we never call /api/knowledge/read with a path that no longer exists on disk.
    const persistedKeys = new Set(nextRows.map((row) => row[0]))
    setRows(nextRows)
    setPendingRows((current) =>
      current.filter((row) => !persistedKeys.has(row[0])),
    )
    setSourcePaths(nextPaths)
    setOriginalSourcePaths(nextOriginalPaths)
    setStatus('ready')
  }, [])

  useEffect(() => {
    void refreshSources().catch(() => setStatus('unavailable'))
  }, [refreshSources])

  const uploadSource = useCallback(
    async (file: File) => {
      setUploadError(null)
      setUploading(true)
      try {
        const form = new FormData()
        form.append('files', file)
        form.append('path', 'uploads')
        form.append('ingestMode', 'extract')
        form.append('session_id', 'knowledge-builder')
        const response = await fetch('/api/knowledge/upload', {
          method: 'POST',
          body: form,
        })
        if (!response.ok) throw new Error(`upload:${response.status}`)
        const results = (await response.json()) as KnowledgeUploadResult[]
        const failures = results.filter((result) => result.ok === false)
        const uploadedRows = results
          .map(sourceRowFromUpload)
          .filter((row): row is SourceRow => row !== null)
        if (failures.length > 0) {
          setUploadError(
            failures
              .map(
                (result) =>
                  result.message ??
                  `Upload failed: ${result.originalName ?? file.name}`,
              )
              .join('; '),
          )
        }
        if (uploadedRows.length > 0) {
          const uploadedPaths: Record<string, string> = {}
          results.forEach((result) => {
            const name = result.storedName ?? result.originalName
            const path = result.path ?? result.targetWikiPath
            if (result.ok && name && path) {
              uploadedPaths[name] = path
            }
          })
          setOriginalSourcePaths((current) => ({
            ...current,
            ...uploadedPaths,
          }))
          setPendingRows((current) => [
            ...uploadedRows.filter(
              (candidate) => !current.some((row) => row[0] === candidate[0]),
            ),
            ...current,
          ])

          for (const result of results) {
            if (result.kind !== 'staged_for_ingest' || !result.stagedUploadRef)
              continue
            const ingestResponse = await fetch('/api/knowledge/ingest', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                uploadRef: result.stagedUploadRef,
                confirmed: true,
                targetDir: 'uploads',
                sessionId: 'knowledge-builder',
              }),
            })
            const ingestPayload = (await ingestResponse
              .json()
              .catch(() => ({}))) as {
              ok?: boolean
              message?: string
              error?: string
            }
            if (!ingestResponse.ok || ingestPayload.ok === false) {
              throw new Error(
                ingestPayload.message ??
                  ingestPayload.error ??
                  `ingest:${ingestResponse.status}`,
              )
            }
          }
        }
        await refreshSources()
      } catch (error) {
        setStatus('unavailable')
        setUploadError(
          error instanceof Error && error.message !== 'Failed to fetch'
            ? error.message
            : zh
              ? '上传失败，请重试。'
              : 'Upload failed. Please try again.',
        )
      } finally {
        setUploading(false)
      }
    },
    [refreshSources, zh],
  )

  const allRows = [
    ...pendingRows,
    ...rows.filter(
      (row) => !pendingRows.some((pending) => pending[0] === row[0]),
    ),
  ]
  const visibleRows =
    statusFilter === 'all'
      ? allRows
      : allRows.filter((row) =>
          statusFilter === 'ready' ? row[2] === 'Ready' : row[2] !== 'Ready',
        )

  const inspectSourceContext = useCallback(
    async (row: SourceRow) => {
      if (!onInspectSource) return
      const originalPath = originalSourcePaths[row[0]]
      const normalizedPath = sourcePaths[row[0]]
      if (originalPath) {
        onInspectSource({
          name: row[0],
          kind: 'original',
          path: originalPath,
          metadata: [
            { label: zh ? '路径' : 'Path', value: originalPath },
            { label: zh ? '格式' : 'Format', value: row[1] },
            { label: zh ? '修改时间' : 'Modified', value: row[5] },
          ],
          lineage: [
            {
              id: 'upload',
              label: zh ? '来源上传' : 'Source upload',
              contextAdded: [
                zh ? `原始文件身份：${row[0]}` : `Original file identity: ${row[0]}`,
                zh ? `受管工作区路径：${originalPath}` : `Governed workspace path: ${originalPath}`,
              ],
              refs: [originalPath],
            },
          ],
        })
        return
      }
      if (!normalizedPath) return
      try {
        const response = await fetch(
          `/api/knowledge/read?path=${encodeURIComponent(normalizedPath)}`,
        )
        const payload = (await response.json().catch(() => ({}))) as {
          content?: string
          error?: string
        }
        if (!response.ok)
          throw new Error(payload.error ?? `source:${response.status}`)
        const content = payload.content ?? ''
        const sourceFile = normalizedMetadataValue(content, 'Source file')
        const uploadRef = normalizedMetadataValue(content, 'Source upload ref')
        const artifactRef = normalizedMetadataValue(
          content,
          'Normalized artifact ref',
        )
        const parserMethod = normalizedMetadataValue(content, 'Parser method')
        const authorityLevel = normalizedMetadataValue(
          content,
          'Authority level',
        )
        const authorityUse = normalizedMetadataValue(content, 'Authority use')
        const lineage: SourceInspectorContext['lineage'] = [
          {
            id: 'upload',
            label: zh ? '来源上传' : 'Source upload',
            contextAdded: [
              sourceFile
                ? zh
                  ? `原始来源：${sourceFile}`
                  : `Original source: ${sourceFile}`
                : zh
                  ? '记录原始来源文件身份'
                  : 'Original source file identity recorded',
              zh ? '建立受管上传引用' : 'Governed upload reference established',
            ],
            refs: [sourceFile, uploadRef].filter((value): value is string => Boolean(value)),
          },
          {
            id: 'normalize',
            label: zh ? '文档规范化' : 'Document normalization',
            contextAdded: [
              parserMethod
                ? zh
                  ? `解析方法：${parserMethod}`
                  : `Parser method: ${parserMethod}`
                : zh
                  ? '生成内部 Markdown 表示'
                  : 'Internal Markdown representation generated',
              zh ? `规范化路径：${normalizedPath}` : `Normalized path: ${normalizedPath}`,
              zh ? '保留结构化证据锚点' : 'Structured evidence anchors preserved',
            ],
            refs: [normalizedPath, artifactRef].filter((value): value is string => Boolean(value)),
          },
          {
            id: 'governance-context',
            label: zh ? '治理上下文标注' : 'Governance context annotation',
            contextAdded: [
              authorityLevel
                ? zh
                  ? `权威级别：${authorityLevel}`
                  : `Authority level: ${authorityLevel}`
                : zh
                  ? '标记为策展材料'
                  : 'Marked as curation material',
              authorityUse
                ? zh
                  ? `权威用途：${authorityUse}`
                  : `Authority use: ${authorityUse}`
                : zh
                  ? '治理晋升前禁止权威使用'
                  : 'Authority use prohibited until governed promotion',
            ],
            refs: [],
          },
        ]
        if (extractionRunId) {
          lineage.push({
            id: 'semantic-extraction',
            label: zh ? '语义抽取' : 'Semantic extraction',
            contextAdded: [
              zh
                ? '增加参考概念、规范表达与证据引用'
                : 'Reference concepts, canonical expressions, and evidence references added',
            ],
            refs: [extractionRunId],
          })
        }
        if (candidateGraphId) {
          lineage.push({
            id: 'candidate-graph',
            label: zh ? '参考图投影' : 'Reference graph projection',
            contextAdded: [
              zh
                ? '增加参考概念、关系与图身份'
                : 'Reference concepts, relationships, and graph identity added',
            ],
            refs: [candidateGraphId],
          })
        }
        onInspectSource({
          name: row[0],
          kind: 'normalized',
          path: normalizedPath,
          metadata: [
            { label: zh ? '路径' : 'Path', value: normalizedPath },
            { label: zh ? '格式' : 'Format', value: row[1] },
            { label: zh ? '解析方法' : 'Parser method', value: parserMethod ?? '—' },
            { label: zh ? '规范化制品' : 'Normalized artifact', value: artifactRef ?? '—' },
            { label: zh ? '权威级别' : 'Authority level', value: authorityLevel ?? '—' },
          ],
          lineage,
        })
      } catch (error) {
        setUploadError(
          error instanceof Error
            ? error.message
            : zh
              ? '无法加载来源上下文。'
              : 'Unable to load source context.',
        )
      }
    },
    [
      candidateGraphId,
      extractionRunId,
      onInspectSource,
      originalSourcePaths,
      sourcePaths,
      zh,
    ],
  )

  const openSource = useCallback(
    async (row: SourceRow) => {
      const originalPath = originalSourcePaths[row[0]]
      const normalizedPath = sourcePaths[row[0]]
      const path = originalPath ?? normalizedPath
      if (!path) {
        setUploadError(
          zh
            ? '该来源尚未生成可打开的页面。'
            : 'This source has no readable page yet.',
        )
        return
      }
      try {
        const inferredKind: SourcePreviewKind = inferSourcePreviewKind(originalPath ?? normalizedPath ?? row[0])
        if (originalPath && (inferredKind === 'pdf' || inferredKind === 'docx')) {
          // W6 - PDF/DOCX originals route through the shared read-only viewer.
          // We do NOT call mammoth on the bytes; mammoth is DOCX-only and we
          // must not invent text for PDFs. The viewer config is fetched
          // lazily here so SourcesMode stays fetch-free at mount time.
          let nextViewerConfig = viewerConfig
          try {
            const configResponse = await fetch(
              '/api/contextgraph-studio/source-evidence-viewer-config',
            )
            if (configResponse.ok) {
              nextViewerConfig =
                (await configResponse.json()) as ViewerConfig
              setViewerConfig(nextViewerConfig)
            }
          } catch {
            nextViewerConfig = VIEWER_UNAVAILABLE_CONFIG
            setViewerConfig(VIEWER_UNAVAILABLE_CONFIG)
          }
          const originalContentUrl = `/api/files?action=download&path=${encodeURIComponent(`wiki/${originalPath}`)}`
          const originalSourceHash = await resolveSourceIdentityHash(originalContentUrl)
          setSourcePreview({
            name: row[0],
            content: '',
            kind: inferredKind,
            originalPath,
            normalizedPath: normalizedPath ?? null,
            originalContentUrl,
            originalSourceHash,
            originalVersion: originalPath,
            normalizedContentHash: null,
            normalizedArtifactRef: null,
          })
        } else if (originalPath) {
          // W6 - Original is a non-binary normalized text; use mammoth as
          // before but still surface a non-binary kind so the preview stays
          // a <pre>.
          const response = await fetch(
            `/api/files?action=download&path=${encodeURIComponent(`wiki/${originalPath}`)}`,
          )
          if (!response.ok) throw new Error(`source:${response.status}`)
          const result = await extractRawText({
            arrayBuffer: await response.arrayBuffer(),
          })
          setSourcePreview({
            name: row[0],
            content: result.value,
            kind: inferredKind,
            originalPath,
            normalizedPath: normalizedPath ?? null,
            originalContentUrl: null,
            originalSourceHash: null,
            originalVersion: originalPath,
            normalizedContentHash: null,
            normalizedArtifactRef: null,
          })
        } else {
          const response = await fetch(
            `/api/knowledge/read?path=${encodeURIComponent(normalizedPath!)}`,
          )
          const payload = (await response.json().catch(() => ({}))) as {
            content?: string
            error?: string
            contentHash?: string
            artifactRef?: string
          }
          if (!response.ok)
            throw new Error(payload.error ?? `source:${response.status}`)
          setSourcePreview({
            name: row[0],
            content: payload.content ?? '',
            kind: inferredKind,
            originalPath: null,
            normalizedPath: normalizedPath ?? null,
            originalContentUrl: null,
            originalSourceHash: null,
            originalVersion: null,
            normalizedContentHash: payload.contentHash ?? null,
            normalizedArtifactRef: payload.artifactRef ?? null,
          })
        }
      } catch (error) {
        setUploadError(
          error instanceof Error
            ? error.message
            : zh
              ? '无法打开来源。'
              : 'Unable to open source.',
        )
      }
    },
    [originalSourcePaths, sourcePaths, zh, viewerConfig],
  )

  const extractSource = useCallback(
    async (row: SourceRow) => {
      if (sourceWorkflow === 'runtime_tender_evaluation') {
        await inspectSourceContext(row)
        setUploadError(
          zh
            ? '推理输入已送入检查上下文，不会写入受管参考图谱。'
            : 'Inference input is available in Inspect and was not written to the governed reference graph.',
        )
        return
      }
      const path = sourcePaths[row[0]]
      if (!path)
        throw new Error(
          zh
            ? '该来源尚未生成可抽取的页面。'
            : 'This source has no extractable page yet.',
        )
      const sourceResponse = await fetch(
        `/api/knowledge/read?path=${encodeURIComponent(path)}`,
      )
      const sourcePayload = (await sourceResponse.json().catch(() => ({}))) as {
        content?: string
        error?: string
      }
      if (!sourceResponse.ok)
        throw new Error(
          sourcePayload.error ?? `source:${sourceResponse.status}`,
        )

      const discoveryResponse = await fetch(
        `${KNOWLEDGE_BUILDER_API}/discovery-runs`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            schemaVersion: 'knowledge_builder_discovery_run_request.v1',
            sourceKind: 'text',
            sourceRef: path,
            sourceText: canonicalBodyFromCurationMarkdown(
              sourcePayload.content ?? '',
            ),
          }),
        },
      )
      const discoveryPayload = (await discoveryResponse
        .json()
        .catch(() => ({}))) as {
        run?: { discovery_run_id?: string; source_id?: string }
        detail?: string
        error?: string
      }
      if (
        !discoveryResponse.ok ||
        !discoveryPayload.run?.discovery_run_id ||
        !discoveryPayload.run.source_id
      ) {
        throw new Error(
          discoveryPayload.detail ??
            discoveryPayload.error ??
            `discovery:${discoveryResponse.status}`,
        )
      }

      const extractionResponse = await fetch(
        `${KNOWLEDGE_BUILDER_API}/extraction-runs`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            schemaVersion: 'knowledge_builder_extraction_run_request.v2',
            discoveryRunId: discoveryPayload.run.discovery_run_id,
            sourceId: discoveryPayload.run.source_id,
            documentId: row[0],
            provider: 'semantica',
            sourceRole: 'reference_sensitive_word_list',
            workflowKind: 'reference_graph_build',
            providerOptions: { sourceIntent: sourceWorkflow },
          }),
        },
      )
      const extractionPayload = (await extractionResponse
        .json()
        .catch(() => ({}))) as { detail?: string; error?: string }
      if (!extractionResponse.ok)
        throw new Error(
          extractionPayload.detail ??
            extractionPayload.error ??
            `extraction:${extractionResponse.status}`,
        )
    },
    [inspectSourceContext, sourcePaths, sourceWorkflow, zh],
  )

  const runBatchExtraction = useCallback(async () => {
    const selectedRows = visibleRows.filter((row) =>
      selectedSourceNames.includes(row[0]),
    )
    if (selectedRows.length === 0) return
    setExtracting(true)
    setUploadError(null)
    try {
      for (const row of selectedRows) await extractSource(row)
      setSelectedSourceNames([])
      onNext()
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : zh
            ? '无法抽取来源。'
            : 'Unable to extract source.',
      )
    } finally {
      setExtracting(false)
    }
  }, [extractSource, onNext, selectedSourceNames, visibleRows, zh])

  const deleteSource = useCallback(
    async (row: SourceRow) => {
      const originalPath = originalSourcePaths[row[0]]
      const normalizedPath = sourcePaths[row[0]]
      const path = originalPath ?? normalizedPath
      if (!path) {
        setUploadError(
          zh
            ? '找不到可删除的原始来源文件。'
            : 'This source has no deletable original file.',
        )
        return
      }
      // Optimistic update: remove the row from local state FIRST so the table refreshes immediately.
      // If the API call fails we restore the row and surface the error.
      const restoreRow = row
      setUploadError(null)
      setPendingRows((current) =>
        current.filter((candidate) => candidate[0] !== row[0]),
      )
      setRows((current) =>
        current.filter((candidate) => candidate[0] !== row[0]),
      )
      setSourcePaths((current) => {
        const next = { ...current }
        delete next[row[0]]
        return next
      })
      setOriginalSourcePaths((current) => {
        const next = { ...current }
        delete next[row[0]]
        return next
      })
      try {
        const response = await fetch('/api/knowledge/files', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ path }),
        })
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string
        }
        if (!response.ok)
          throw new Error(payload.error ?? `delete:${response.status}`)
        // Re-sync with the server so the row stays gone even if the listing API returns a stale entry.
        await refreshSources().catch(() => {
          /* refresh failure shouldn't re-show the deleted file */
        })
      } catch (error) {
        // Restore the row so the user can retry, and surface the error message.
        setRows((current) =>
          current.some((candidate) => candidate[0] === restoreRow[0])
            ? current
            : [restoreRow, ...current],
        )
        if (normalizedPath)
          setSourcePaths((current) => ({
            ...current,
            [restoreRow[0]]: normalizedPath,
          }))
        if (originalPath)
          setOriginalSourcePaths((current) => ({
            ...current,
            [restoreRow[0]]: originalPath,
          }))
        setUploadError(
          error instanceof Error
            ? error.message
            : zh
              ? '无法删除来源。'
              : 'Unable to delete source.',
        )
      }
    },
    [originalSourcePaths, refreshSources, sourcePaths, zh],
  )

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (file) void uploadSource(file)
    },
    [uploadSource],
  )

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const file = event.dataTransfer.files?.[0]
      if (file) void uploadSource(file)
    },
    [uploadSource],
  )

  const browseFiles = useCallback(() => fileInputRef.current?.click(), [])

  return (
    <div className="grid h-full grid-rows-[auto_auto_1fr_auto] bg-card">
      <div className="flex items-center gap-2 border-b border-border p-2.5">
        <Input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc"
          data-testid="source-file-input"
          className="hidden"
          onChange={handleFileChange}
        />
        <UploadDropzone
          onClick={browseFiles}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          className="flex min-h-10 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 text-xs text-muted-foreground hover:border-primary hover:bg-muted/30"
        >
          <HugeiconsIcon icon={FileUploadIcon} size={16} strokeWidth={1.6} />
          <span>
            {zh
              ? '拖入 PDF/DOCX，或浏览文件'
              : 'Drop PDF/DOCX here or browse files'}
          </span>
          {uploadError ? (
            <span className="text-red-600">{uploadError}</span>
          ) : null}
        </UploadDropzone>
        <StudioButton primary onClick={browseFiles} disabled={uploading}>
          <HugeiconsIcon
            icon={FileUploadIcon}
            size={15}
            strokeWidth={1.7}
            className="mr-1.5"
          />
          {uploading
            ? zh
              ? '正在上传…'
              : 'Uploading…'
            : zh
              ? '上传来源'
              : 'Upload source'}
        </StudioButton>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-2.5">
        <Input
          placeholder={zh ? '搜索来源…' : 'Search sources…'}
          className="min-w-[220px] flex-1 md:max-w-[340px]"
        />
        <ControlledSelect
          compact
          label={zh ? '来源状态' : 'Source status'}
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={[
            { value: 'all', label: zh ? '全部状态' : 'All status' },
            { value: 'ready', label: zh ? '就绪' : 'Ready' },
            { value: 'pending', label: zh ? '等待导入' : 'Waiting for ingest' },
          ]}
        />
        <ControlledSelect
          compact
          label={zh ? '来源用途' : 'Source use'}
          value={sourceWorkflow}
          onValueChange={(value) => setSourceWorkflow(value as SourceWorkflow)}
          options={[
            {
              value: 'reference_graph_build',
              label: zh ? '参考图谱来源' : 'Reference graph source',
            },
            {
              value: 'runtime_tender_evaluation',
              label: zh ? '推理输入' : 'Inference input',
            },
          ]}
        />
        <div className="flex-1" />
        <StudioButton
          onClick={() => {
            void refreshSources().catch(() => setStatus('unavailable'))
          }}
        >
          {zh ? '刷新' : 'Refresh'}
        </StudioButton>
      </div>
      <div className="min-h-0 overflow-auto">
        <Table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-muted text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th
                className="w-10 border-b border-border px-3 py-2.5"
                aria-label={zh ? '选择来源' : 'Select source'}
              />
              {[
                zh ? '文件 / 来源' : 'File / Source',
                zh ? '类型' : 'Type',
                zh ? '状态' : 'Status',
                zh ? '参考概念' : 'Reference concepts',
                zh ? '规范表达' : 'Canonical expressions',
                zh ? '最后运行' : 'Last run',
                zh ? '操作' : 'Actions',
              ].map((h) => (
                <th
                  key={h}
                  className="border-b border-border px-3 py-2.5 text-left font-semibold"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr
                key={row[0]}
                className={index === 0 ? 'bg-primary/10' : 'hover:bg-muted/40'}
              >
                <td className="border-b border-border px-3 py-3">
                  <Checkbox
                    checked={selectedSourceNames.includes(row[0])}
                    onChange={() =>
                      setSelectedSourceNames((current) =>
                        current.includes(row[0])
                          ? current.filter((name) => name !== row[0])
                          : [...current, row[0]],
                      )
                    }
                    disabled={!sourcePaths[row[0]] || extracting}
                    aria-label={zh ? `选择 ${row[0]}` : `Select ${row[0]}`}
                  />
                </td>
                {row.map((value, i) => (
                  <td
                    key={`${row[0]}-${i}`}
                    className="border-b border-border px-3 py-3"
                  >
                    {i === 0 ? (
                      <div
                        className={
                          sourcePaths[row[0]] ? 'relative pl-6' : undefined
                        }
                      >
                        {sourcePaths[row[0]] ? (
                          <span
                            aria-hidden="true"
                            className="absolute left-1 top-0 text-muted-foreground"
                          >
                            └─
                          </span>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => void inspectSourceContext(row)}
                          className="h-auto justify-start p-0 text-left font-semibold hover:bg-transparent hover:underline"
                        >
                          {value}
                        </Button>
                        {sourcePaths[row[0]] ? (
                          <div className="mt-0.5 text-[10px] text-muted-foreground">
                            {zh
                              ? '内部规范化表示'
                              : 'Internal normalized representation'}
                          </div>
                        ) : null}
                        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                          source_identity_ref
                        </div>
                      </div>
                    ) : (
                      value
                    )}
                  </td>
                ))}
                <td className="border-b border-border px-3 py-3">
                  <div className="flex items-center gap-1">
                    <StudioButton
                      className="size-8 p-0"
                      onClick={() => void openSource(row)}
                      disabled={
                        (!originalSourcePaths[row[0]] &&
                          !sourcePaths[row[0]]) ||
                        extracting
                      }
                      title={zh ? '查看来源' : 'View source'}
                      ariaLabel={zh ? '查看来源' : `View ${row[0]}`}
                    >
                      <HugeiconsIcon
                        icon={ViewIcon}
                        size={15}
                        strokeWidth={1.7}
                      />
                    </StudioButton>
                    <StudioButton
                      className="size-8 p-0"
                      onClick={() => {
                        setExtracting(true)
                        void extractSource(row)
                          .then(onNext)
                          .catch((error) =>
                            setUploadError(
                              error instanceof Error
                                ? error.message
                                : 'Unable to extract source.',
                            ),
                          )
                          .finally(() => setExtracting(false))
                      }}
                      disabled={!sourcePaths[row[0]] || extracting}
                      title={
                        sourceWorkflow === 'reference_graph_build'
                          ? zh
                            ? '抽取来源'
                            : 'Extract source'
                          : zh
                            ? '用于检查'
                            : 'Use in Inspect'
                      }
                      ariaLabel={
                        sourceWorkflow === 'reference_graph_build'
                          ? zh
                            ? '抽取来源'
                            : `Extract ${row[0]}`
                          : zh
                            ? '用于检查'
                            : `Use ${row[0]} in Inspect`
                      }
                    >
                      <HugeiconsIcon
                        icon={AiScanIcon}
                        size={15}
                        strokeWidth={1.7}
                      />
                    </StudioButton>
                    <StudioButton
                      className="size-8 p-0 text-destructive"
                      onClick={() => setPendingDeleteRow(row)}
                      disabled={
                        (!originalSourcePaths[row[0]] &&
                          !sourcePaths[row[0]]) ||
                        extracting
                      }
                      title={zh ? '删除来源' : 'Delete source'}
                      ariaLabel={zh ? '删除来源' : `Delete ${row[0]}`}
                    >
                      <HugeiconsIcon
                        icon={Delete02Icon}
                        size={15}
                        strokeWidth={1.7}
                      />
                    </StudioButton>
                  </div>
                </td>
              </tr>
            ))}
            {visibleRows.length === 0 && status === 'loading' ? (
              <tr>
                <td
                  colSpan={8}
                  className="p-6 text-center text-muted-foreground"
                >
                  {zh ? '正在加载来源…' : 'Loading sources…'}
                </td>
              </tr>
            ) : null}
            {visibleRows.length === 0 && status === 'unavailable' ? (
              <tr>
                <td
                  colSpan={8}
                  className="p-6 text-center text-muted-foreground"
                >
                  {zh ? '来源 API 尚未启用' : 'Sources API is not enabled yet'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </div>
      {sourcePreview ? (
        <DialogSurface
          aria-label={zh ? '来源预览' : 'Source preview'}
          onDismiss={() => setSourcePreview(null)}
          className="fixed inset-4 z-30 flex min-h-0 flex-col rounded-lg border border-border bg-card p-4 shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border pb-2 text-xs font-semibold">
            <span data-testid="sources-preview-name">{sourcePreview.name}</span>
            <StudioButton onClick={() => setSourcePreview(null)}>
              {zh ? '关闭' : 'Close'}
            </StudioButton>
          </div>
          <div
            className="grid gap-1 border-b border-border py-2 font-mono text-[10px] text-muted-foreground"
            data-testid="sources-preview-lineage"
          >
            <div
              data-testid="sources-preview-original-lineage"
              data-original-source-hash={sourcePreview.originalSourceHash ?? ''}
            >
              <span className="font-semibold text-foreground">
                {zh ? '原始 (Original)' : 'Original'}
              </span>
              {sourcePreview.originalPath ? (
                <>
                  {' · '}
                  <span>{sourcePreview.originalPath}</span>
                </>
              ) : null}
              {sourcePreview.originalSourceHash ? (
                <>
                  {' · '}
                  <span data-original-hash-display>
                    {sourcePreview.originalSourceHash}
                  </span>
                </>
              ) : (
                <span className="ml-1 italic">
                  {zh
                    ? '未提供 sourceHash；预览以路径作为代用版本。'
                    : 'no sourceHash provided; preview uses path as version fallback.'}
                </span>
              )}
            </div>
            <div
              data-testid="sources-preview-normalized-lineage"
              data-normalized-content-hash={
                sourcePreview.normalizedContentHash ?? ''
              }
              data-normalized-artifact-ref={
                sourcePreview.normalizedArtifactRef ?? ''
              }
            >
              <span className="font-semibold text-foreground">
                {zh ? '规范化 (Normalized)' : 'Normalized'}
              </span>
              {sourcePreview.normalizedPath ? (
                <>
                  {' · '}
                  <span>{sourcePreview.normalizedPath}</span>
                </>
              ) : null}
              {sourcePreview.normalizedContentHash ? (
                <>
                  {' · '}
                  <span data-normalized-hash-display>
                    {sourcePreview.normalizedContentHash}
                  </span>
                </>
              ) : null}
              {sourcePreview.normalizedArtifactRef ? (
                <>
                  {' · '}
                  <span>{sourcePreview.normalizedArtifactRef}</span>
                </>
              ) : null}
            </div>
          </div>
          {sourcePreview.kind === 'pdf' || sourcePreview.kind === 'docx' ? (
            <div
              className="min-h-0 flex-1 overflow-auto py-3"
              data-testid="sources-preview-binary-viewer"
              data-source-preview-kind={sourcePreview.kind}
            >
              {sourcePreview.originalContentUrl &&
              sourcePreview.originalSourceHash ? (
                <SourceEvidenceViewer
                  zh={zh}
                  documentName={sourcePreview.name}
                  documentKind={sourcePreview.kind}
                  sourceDocumentHash={sourcePreview.originalSourceHash}
                  viewerConfig={viewerConfig}
                  findings={[]}
                />
              ) : (
                <div
                  role="alert"
                  className="rounded border border-warning/40 bg-warning/10 p-2 text-[11px] text-warning"
                >
                  {zh
                    ? '原始文档需要受管的 sourceHash 才能挂载共享查看器。'
                    : 'Original document requires a governed sourceHash before the shared viewer can mount.'}
                </div>
              )}
            </div>
          ) : (
            <pre
              className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap py-3 text-xs leading-5"
              data-testid="sources-preview-text-body"
              data-source-preview-kind={sourcePreview.kind}
            >
              {sourcePreview.content}
            </pre>
          )}
        </DialogSurface>
      ) : null}
      <AlertDialogRoot
        open={pendingDeleteRow !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteRow(null)
        }}
      >
        <AlertDialogContent>
          <div className="grid gap-3 p-5">
            <AlertDialogTitle>
              {zh ? '删除来源？' : 'Delete source?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {zh
                ? `将永久删除“${pendingDeleteRow?.[0] ?? ''}”。此操作无法撤销。`
                : `Permanently delete “${pendingDeleteRow?.[0] ?? ''}”? This action cannot be undone.`}
            </AlertDialogDescription>
            <div className="mt-1 flex justify-end gap-2">
              <AlertDialogCancel>{zh ? '取消' : 'Cancel'}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const row = pendingDeleteRow
                  setPendingDeleteRow(null)
                  if (row) void deleteSource(row)
                }}
              >
                {zh ? '删除' : 'Delete'}
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialogRoot>
      <div className="flex min-h-10 items-center gap-3 border-t border-border py-1 pl-3 pr-20 text-[11px] text-muted-foreground">
        <span>
          {zh ? '已选' : 'Selected'}:{' '}
          <strong className="text-foreground">
            {visibleRows[0]?.[0] ?? '—'}
          </strong>
        </span>
        <span className="font-mono">
          source_identity_ref · {visibleRows[0]?.[1] ?? '—'}
        </span>
        <span>AnyDoc structured</span>
        <span>
          <strong className="text-foreground">{rows[0]?.[4] ?? '0'}</strong>{' '}
          {zh ? '未解决' : 'unresolved'}
        </span>
        <div className="flex-1" />
        <StudioButton
          primary
          onClick={() => void runBatchExtraction()}
          disabled={selectedSourceNames.length === 0 || extracting}
          title={
            sourceWorkflow === 'reference_graph_build'
              ? zh
                ? '批量抽取'
                : 'Batch extract'
              : zh
                ? '用于检查'
                : 'Use in Inspect'
          }
        >
          <HugeiconsIcon
            icon={AiScanIcon}
            size={14}
            strokeWidth={1.7}
            className="mr-1.5"
          />
          {extracting
            ? zh
              ? sourceWorkflow === 'reference_graph_build'
                ? '正在抽取…'
                : '正在载入…'
              : sourceWorkflow === 'reference_graph_build'
                ? 'Extracting…'
                : 'Loading…'
            : sourceWorkflow === 'reference_graph_build'
              ? zh
                ? '批量抽取'
                : 'Batch extract'
              : zh
                ? '用于检查'
                : 'Use in Inspect'}
        </StudioButton>
      </div>
    </div>
  )
}

export function ExtractMode({
  zh,
  extractionRunId,
  onRun,
  onNext,
  onCandidates,
}: {
  zh: boolean
  extractionRunId: string | null
  onRun: (run: ExtractionRun) => void
  onNext: () => void
  onCandidates?: (next: GroundCandidate[]) => void
}) {
  const [runs, setRuns] = useState<ExtractionRun[]>([])
  const [candidates, setCandidates] = useState<AssertionCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aiGroundingPending, setAiGroundingPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const runsResponse = await fetch(
          `${KNOWLEDGE_BUILDER_API}/extraction-runs?limit=20`,
        )
        if (!runsResponse.ok)
          throw new Error(`runs request failed (${runsResponse.status})`)
        const runsPayload = (await runsResponse.json()) as {
          extractionRuns?: ExtractionRun[]
        }
        const nextRuns = runsPayload.extractionRuns ?? []
        const latest = nextRuns[0]
        if (latest) {
          const candidatesResponse = await fetch(
            `${KNOWLEDGE_BUILDER_API}/reference-concepts?extractionRunId=${encodeURIComponent(latest.extraction_run_id)}&limit=500`,
          )
          if (!candidatesResponse.ok)
            throw new Error(
              `candidate request failed (${candidatesResponse.status})`,
            )
          const candidatePayload = (await candidatesResponse.json()) as {
            assertionCandidates?: AssertionCandidate[]
            referenceConcepts?: unknown[]
            aiGroundingSuggestions?: AiGroundingSuggestion[]
            aiGroundingAssessmentSource?: AiGroundingSuggestion['assessment_source']
          }
          if (!cancelled) {
            const suggestionByAssertion = Object.fromEntries(
              (candidatePayload.aiGroundingSuggestions ?? []).map((suggestion) => {
                const normalized = normalizeAiSuggestion(
                  suggestion,
                  candidatePayload.aiGroundingAssessmentSource ?? 'legacy_threshold',
                )
                return [normalized.assertion_id, normalized]
              }),
            )
            const nextCandidates = (candidatePayload.assertionCandidates ?? []).map(
              (candidate) => ({
                ...candidate,
                ai_grounding_suggestion: suggestionByAssertion[candidate.assertion_id],
              }),
            )
            setRuns(nextRuns)
            setCandidates(nextCandidates)
            onCandidates?.(nextCandidates)
            onRun(latest)
          }
        } else if (!cancelled) {
          setRuns([])
          setCandidates([])
          onCandidates?.([])
        }
      } catch (reason) {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Unable to load extraction runs',
          )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [onCandidates, onRun])

  const selectedRun =
    runs.find((run) => run.extraction_run_id === extractionRunId) ?? runs[0]
  const labelFor = (candidate: AssertionCandidate) =>
    candidate.normalized_assertion.subject?.text ??
    candidate.normalized_assertion.object?.text ??
    candidate.normalized_assertion.predicate ??
    candidate.assertion_id

  const aiGroundAndContinue = useCallback(async () => {
    if (!selectedRun) return
    setAiGroundingPending(true)
    setError(null)
    try {
      const endpoint = `${KNOWLEDGE_BUILDER_API}/extraction-runs/${encodeURIComponent(selectedRun.extraction_run_id)}/ai-grounding-suggestions`
      const candidateIds = candidates.map((candidate) => candidate.assertion_id)
      const chunkSize = 1
      const suggestionByAssertion: Record<string, AiGroundingSuggestion> = {}
      for (let index = 0; index < candidateIds.length; index += chunkSize) {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            schemaVersion: 'knowledge_builder_ai_grounding_request.v2',
            extractionRunId: selectedRun.extraction_run_id,
            candidateIds: candidateIds.slice(index, index + chunkSize),
          }),
        })
        const payload = (await response.json().catch(() => ({}))) as {
          detail?: string
          suggestions?: AiGroundingSuggestion[]
        }
        if (!response.ok)
          throw new Error(payload.detail ?? `ai-grounding:${response.status}`)
        for (const suggestion of payload.suggestions ?? []) {
          const normalized = normalizeAiSuggestion(suggestion, 'llm_structured')
          suggestionByAssertion[normalized.assertion_id] = normalized
        }
        const partiallyGroundedCandidates = candidates.map((candidate) => ({
          ...candidate,
          ai_grounding_suggestion:
            suggestionByAssertion[candidate.assertion_id] ??
            candidate.ai_grounding_suggestion,
        }))
        setCandidates(partiallyGroundedCandidates)
        onCandidates?.(partiallyGroundedCandidates)
      }
      const groundedCandidates = candidates.map((candidate) => ({
        ...candidate,
        ai_grounding_suggestion:
          suggestionByAssertion[candidate.assertion_id] ??
          candidate.ai_grounding_suggestion,
      }))
      setCandidates(groundedCandidates)
      onCandidates?.(groundedCandidates)
      onNext()
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : zh
            ? '无法运行 AI 校准。'
            : 'Unable to run AI grounding.',
      )
    } finally {
      setAiGroundingPending(false)
    }
  }, [candidates, onCandidates, onNext, selectedRun, zh])
  return (
    <div className="grid h-full grid-rows-[auto_auto_1fr] bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-2.5 text-xs">
        <span className="text-muted-foreground">
          {zh ? '最近运行' : 'Latest run'}:
        </span>
        <strong className="font-mono">
          {selectedRun?.extraction_run_id ??
            (zh ? '暂无运行' : 'No extraction run')}
        </strong>
        <StatusPill
          tone={
            selectedRun?.run_status === 'failed'
              ? 'warning'
              : selectedRun?.run_status === 'completed'
                ? 'success'
                : 'neutral'
          }
        >
          {selectedRun?.run_status ?? 'idle'}
        </StatusPill>
        <span className="text-muted-foreground">
          {selectedRun?.provider_ref ?? 'semantica'}
        </span>
        <div className="flex-1" />
        <StudioButton
          primary
          aria-busy={aiGroundingPending}
          disabled={
            !selectedRun ||
            selectedRun.run_status !== 'completed' ||
            aiGroundingPending
          }
          onClick={() => void aiGroundAndContinue()}
        >
          <HugeiconsIcon
            icon={CheckmarkBadge04Icon}
            size={14}
            strokeWidth={1.7}
            className="mr-1.5"
          />
          {aiGroundingPending
            ? zh
              ? 'AI 校准中…'
              : 'AI grounding…'
            : zh
              ? 'AI 校准'
              : 'AI Ground'}
        </StudioButton>
        <span className="sr-only" aria-live="polite">
          {aiGroundingPending
            ? (zh ? 'AI 校准正在运行' : 'AI grounding is running')
            : (zh ? 'AI 校准空闲' : 'AI grounding is idle')}
        </span>
      </div>
      {selectedRun?.run_status === 'failed' ? (
        <div
          role="alert"
          className="border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <strong>{zh ? '抽取失败' : 'Extraction failed'}:</strong>{' '}
          {selectedRun.failure_reason ??
            selectedRun.warnings[0] ??
            (zh ? '提供方未返回原因' : 'provider did not return a reason')}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border px-3 py-2 text-[11px] text-muted-foreground">
        <span>
          <strong className="text-foreground">
            {loading ? '…' : candidates.length}
          </strong>{' '}
          {zh ? '参考概念' : 'reference concepts'}
        </span>
        <span>{selectedRun?.profile_ref ?? 'tender_sensitive_v1'}</span>
        <div className="flex-1" />
        <Input placeholder={zh ? '搜索候选…' : 'Search candidates…'} />
      </div>
      <div className="grid min-h-0 grid-cols-1 md:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-h-0 overflow-auto border-r border-border">
          <Table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-muted text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                {[
                  zh ? '参考概念 / 规范表达' : 'Reference concept / expression',
                  zh ? '置信度' : 'Confidence',
                  zh ? '证据' : 'Evidence',
                  zh ? '状态' : 'State',
                ].map((h) => (
                  <th
                    key={h}
                    className="border-b border-border px-3 py-2.5 text-left"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr>
                  <td colSpan={4} className="p-4 text-destructive">
                    {error}
                  </td>
                </tr>
              ) : (
                candidates.map((candidate, index) => (
                  <tr
                    key={candidate.assertion_id}
                    className={
                      index === 0 ? 'bg-primary/10' : 'hover:bg-muted/40'
                    }
                  >
                    <td className="border-b border-border px-3 py-3">
                      <strong>{labelFor(candidate)}</strong>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {candidate.assertion_id}
                      </div>
                    </td>
                    <td className="border-b border-border px-3 py-3">
                      {candidate.confidence.toFixed(2)}
                    </td>
                    <td className="border-b border-border px-3 py-3">
                      {candidate.evidence_refs?.length ?? 0}
                    </td>
                    <td className="border-b border-border px-3 py-3">
                      {candidate.grounding_state}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
        <aside className="hidden min-h-0 overflow-auto bg-card p-4 md:block">
          <h2 className="text-sm font-semibold">
            {selectedRun?.candidate_graph_id ??
              (zh ? '参考图待运行' : 'Reference graph pending')}
          </h2>
          <div className="mt-2 flex gap-1.5">
            <StatusPill>{selectedRun?.provider_ref ?? 'semantica'}</StatusPill>
            <StatusPill>
              {candidates[0]?.evidence_refs?.length ?? 0} evidence
            </StatusPill>
          </div>
          <MiniLabel>{zh ? '状态' : 'Run state'}</MiniLabel>
          <p className="text-xs text-muted-foreground">
            {selectedRun?.run_status ?? 'idle'} ·{' '}
            {selectedRun?.extraction_run_id ?? '—'}
          </p>
          <MiniLabel>{zh ? '规范证据' : 'Canonical evidence'}</MiniLabel>
          <div className="font-mono text-[10px] text-muted-foreground">
            {candidates[0]?.evidence_refs
              ?.map((ref) => `${ref.evidence_ref} · ${ref.selector_hash}`)
              .join('\n') ?? (zh ? '暂无证据' : 'No evidence')}
          </div>
        </aside>
      </div>
    </div>
  )
}

type GroundCandidate = {
  assertion_id: string
  candidate_graph_id: string
  confidence: number
  grounding_state: string
  evidence_refs: Array<{ evidence_ref: string; selector_hash: string }>
  source_anchors?: Array<{ anchor_id: string; exact_text?: string }>
  normalized_assertion: {
    subject?: { text?: string } | null
    predicate?: string | null
    object?: { text?: string } | null
  }
  extraction_run_id?: string
  ai_grounding_suggestion?: AiGroundingSuggestion
}

type AiGroundingSuggestion = {
  assertion_id: string
  assessment_source?: 'legacy_threshold' | 'llm_structured'
  suggestion_status:
    | 'ready_for_review'
    | 'low_confidence'
    | 'missing_evidence'
    | 'supported'
    | 'unsupported'
    | 'ambiguous'
    | 'needs_edit'
    | 'provider_error'
  confidence: number
  evidence_anchor_count?: number
  evidence_anchor_refs?: string[]
  provider?: string
  provider_version?: string
  model?: string
  threshold?: number
  rationale: string
  issues?: string[]
  suggested_at?: string
}

function normalizeAiSuggestion(
  suggestion: AiGroundingSuggestion & { status?: AiGroundingSuggestion['suggestion_status'] },
  source: NonNullable<AiGroundingSuggestion['assessment_source']>,
): AiGroundingSuggestion {
  return {
    ...suggestion,
    assessment_source: source,
    suggestion_status: suggestion.status ?? suggestion.suggestion_status,
  }
}

type GroundDetail = {
  assertionCandidate: {
    assertion_id: string
    candidate_graph_id: string
    confidence: number
    grounding_state: string
    source_anchors: Array<{ anchor_id: string; exact_text?: string }>
  } | null
  learningEvents: Array<{
    event_id: string
    event_type: string
    actor_ref: string | null
    event_hash: string
    occurred_at?: string
  }>
  candidateTopology?: { schema_version: string }
}

type GroundPreview = {
  available: boolean
  reason?: string
  previewHash?: string
  graphDelta?: Record<string, unknown>
  evidenceAnchorRefs?: string[]
  baseGraphVersion?: string
}

type GroundRegroundPayload = {
  evidenceRef: Record<string, unknown>
  canonicalSourceDocument: Record<string, unknown>
  newSelector: Record<string, unknown>
  sourceBlockId: string
  sourceIdentity: Record<string, unknown>
}

export function GroundMode({
  zh,
  extractionRunId,
  candidateGraphId,
  assertionCandidates,
  runtimeGraphVersion,
  enableBoundaryReview = false,
  onAcceptedRelease,
  sourceDocumentPresentation = null,
}: {
  zh: boolean
  extractionRunId: string | null
  candidateGraphId: string | null
  assertionCandidates: GroundCandidate[]
  runtimeGraphVersion?: string | null
  enableBoundaryReview?: boolean
  onAcceptedRelease?: (release: Record<string, any>) => void
  sourceDocumentPresentation?: SourceDocumentPresentation | null
}) {
  const [candidateList, setCandidateList] =
    useState<GroundCandidate[]>(assertionCandidates)
  const [reviewStatuses, setReviewStatuses] = useState<
    Record<string, string>
  >({})
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, AiGroundingSuggestion>>(
    Object.fromEntries(
      assertionCandidates
        .filter((candidate) => candidate.ai_grounding_suggestion)
        .map((candidate) => [candidate.assertion_id, candidate.ai_grounding_suggestion!]),
    ),
  )
  const [aiFocus, setAiFocus] = useState('all')
  const [aiSort, setAiSort] = useState('priority')
  const [statusFilter, setStatusFilter] = useState<Set<string>>(
    () => new Set(),
  )
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false)
  const [batchPending, setBatchPending] = useState(false)
  const [index, setIndex] = useState(0)
  const [detail, setDetail] = useState<GroundDetail | null>(null)
  const [preview, setPreview] = useState<GroundPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewStale, setPreviewStale] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionPending, setActionPending] = useState(false)
  const [boundaryReviewLoading, setBoundaryReviewLoading] = useState(false)
  const [boundaryReviewError, setBoundaryReviewError] = useState<string | null>(null)
  const [boundaryCandidateSpans, setBoundaryCandidateSpans] = useState<Array<{
    candidate_span_id: string
    exact_text: string
    semantic_role: string | null
    source_anchor_refs: string[]
    grounding_state: string
    needs_boundary_review: boolean
  }>>([])
  const [boundaryLearningEvents, setBoundaryLearningEvents] = useState<Array<{
    event_id: string
    event_type: string
    actor_ref: string | null
    occurred_at?: string
  }>>([])
  const [boundarySplitOffsets, setBoundarySplitOffsets] = useState('')
  const [boundaryTargetRole, setBoundaryTargetRole] = useState('term')
  const [regroundOpen, setRegroundOpen] = useState(false)
  const [regroundBlockId, setRegroundBlockId] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editDraft, setEditDraft] = useState({
    subject_text: '',
    predicate_text: '',
    object_text: '',
  })
  const [acceptedRelease, setAcceptedRelease] = useState<Record<
    string,
    any
  > | null>(null)
  const [activationProjection, setActivationProjection] = useState<Record<
    string,
    any
  > | null>(null)

  const current = candidateList[index] ?? null

  // W4 — Viewer wiring: derive a governed `SourceEvidenceFinding[]` from the
  // current candidate's canonical `evidence_refs` plus its `source_anchors`,
  // and project any graph-delta evidence anchors that came back with the
  // ground preview. The SourceEvidenceViewer is read-only and consumes the
  // same `sourceDocumentPresentation` already resolved by the parent.
  const groundFindings = useMemo<SourceEvidenceFinding[]>(() => {
    if (!current) return []
    const findings: SourceEvidenceFinding[] = []
    const seenFindingIds = new Set<string>()
    for (const [offset, ref] of (current.evidence_refs ?? []).entries()) {
      const anchor = current.source_anchors?.[offset]
      const findingId = `${current.assertion_id}::evidence::${offset}`
      if (seenFindingIds.has(findingId)) continue
      seenFindingIds.add(findingId)
      findings.push({
        finding_id: findingId,
        matched_text: anchor?.exact_text ?? null,
        observed_expression: anchor?.exact_text ?? null,
        target_evidence_ref: ref.evidence_ref,
        target_anchor_ref: anchor?.anchor_id ?? null,
        decision_status: current.grounding_state ?? null,
        detection_method: 'grounding_evidence_projection',
        semantic_relation: 'evidence:ground',
        confidence: current.confidence ?? null,
        issue_type: null,
      })
    }
    // Project graph-delta evidence anchors (preview.evidenceAnchorRefs) so
    // the viewer can focus the corresponding source spans when the curator
    // selects the predicted-delta highlights.
    const deltaRefs = preview?.evidenceAnchorRefs ?? []
    for (const [offset, anchorRef] of deltaRefs.entries()) {
      const findingId = `${current.assertion_id}::delta::${offset}`
      if (seenFindingIds.has(findingId)) continue
      seenFindingIds.add(findingId)
      findings.push({
        finding_id: findingId,
        matched_text: null,
        observed_expression: null,
        target_evidence_ref: current.evidence_refs?.[0]?.evidence_ref ?? null,
        target_anchor_ref: anchorRef,
        decision_status: 'graph_delta_projection',
        detection_method: 'graph_delta_projection',
        semantic_relation: 'evidence:graph_delta',
        confidence: null,
        issue_type: null,
      })
    }
    return findings
  }, [current, preview?.evidenceAnchorRefs])

  // W4 — viewerConfig: pull the truthful renderer config from the same
  // route InspectMode uses so Ground/Inspect/Sources always agree on the
  // configured open-source renderer.
  const [viewerConfig, setViewerConfig] = useState<ViewerConfig>(
    VIEWER_UNAVAILABLE_CONFIG,
  )
  // Derive `documentKind` from the governed SourceIdentity mediaType so we
  // never duplicate the kind as a second truth source.
  const sourceDocumentKind = useMemo<
    'docx' | 'pdf' | 'canonical_source_ir' | 'unknown'
  | null>(() => {
    const mediaType = sourceDocumentPresentation?.source.mediaType
    if (mediaType === 'application/pdf') return 'pdf'
    if (
      mediaType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
      return 'docx'
    return null
  }, [sourceDocumentPresentation])

  // W4 - lazy viewer config: only fetch when a PDF/DOCX presentation is
  // actually going to mount the shared viewer. When no presentation is
  // provided we stay in VIEWER_UNAVAILABLE_CONFIG and do not consume a
  // fetch slot that callers may need for detail/preview fetches.
  useEffect(() => {
    if (!sourceDocumentPresentation || !sourceDocumentKind) return
    let cancelled = false
    fetch('/api/contextgraph-studio/source-evidence-viewer-config')
      .then(async (response) => {
        const payload = (await response.json()) as ViewerConfig
        if (!response.ok) throw new Error('viewer-config-unavailable')
        if (!cancelled) setViewerConfig(payload)
      })
      .catch(() => {
        if (!cancelled) setViewerConfig(VIEWER_UNAVAILABLE_CONFIG)
      })
    return () => {
      cancelled = true
    }
  }, [sourceDocumentPresentation, sourceDocumentKind])
  // W4 — when the queue selection changes, reset the highlighted finding
  // to the current candidate's primary evidence_ref so the viewer focus
  // follows the queue.
  useEffect(() => {
    if (!current) return
    const firstRef = current.evidence_refs?.[0]
    if (!firstRef) return
    const firstAnchor = current.source_anchors?.[0]?.anchor_id
    const candidatePrimaryFindingId = `${current.assertion_id}::evidence::0`
    setSelectedGroundFindingId(candidatePrimaryFindingId)
  }, [current?.assertion_id, current?.evidence_refs, current?.source_anchors])

  const [selectedGroundFindingId, setSelectedGroundFindingId] = useState<
    string | null
  >(null)

  const expectedGraphVersion = useMemo(() => {
    const value = runtimeGraphVersion ?? ''
    const match = value.match(/KG_v(\d+)/)
    return match ? Number(match[1]) : 0
  }, [runtimeGraphVersion])

  const loadBoundaryReview = useCallback(async () => {
    if (!enableBoundaryReview || !extractionRunId) return
    setBoundaryReviewLoading(true)
    setBoundaryReviewError(null)
    try {
      const [spansResponse, eventsResponse] = await Promise.all([
        fetch(`/api/contextgraph/extraction-runs/${encodeURIComponent(extractionRunId)}/candidate-spans`),
        fetch(`/api/contextgraph/extraction-runs/${encodeURIComponent(extractionRunId)}/learning-events`),
      ])
      const spansPayload = (await spansResponse.json().catch(() => ({}))) as {
        candidateSpans?: Array<{
          candidate_span_id: string
          exact_text?: string
          semantic_role?: string | null
          source_anchor_refs?: string[]
          grounding_state?: string
          needs_boundary_review?: boolean
        }>
        detail?: string
      }
      const eventsPayload = (await eventsResponse.json().catch(() => ({}))) as {
        learningEvents?: Array<{
          event_id: string
          event_type: string
          actor_ref: string | null
          occurred_at?: string
        }>
        detail?: string
      }
      if (!spansResponse.ok) throw new Error(spansPayload.detail ?? `candidate-spans:${spansResponse.status}`)
      if (!eventsResponse.ok) throw new Error(eventsPayload.detail ?? `learning-events:${eventsResponse.status}`)
      setBoundaryCandidateSpans(
        (spansPayload.candidateSpans ?? []).map((span) => ({
          candidate_span_id: span.candidate_span_id,
          exact_text: span.exact_text ?? '',
          semantic_role: span.semantic_role ?? null,
          source_anchor_refs: span.source_anchor_refs ?? [],
          grounding_state: span.grounding_state ?? 'candidate',
          needs_boundary_review: Boolean(span.needs_boundary_review),
        })),
      )
      setBoundaryLearningEvents(eventsPayload.learningEvents ?? [])
    } catch (error) {
      setBoundaryReviewError(
        error instanceof Error ? error.message : 'Unable to load boundary review data',
      )
    } finally {
      setBoundaryReviewLoading(false)
    }
  }, [enableBoundaryReview, extractionRunId])

  useEffect(() => {
    void loadBoundaryReview()
  }, [loadBoundaryReview])

  const observedStatuses = useMemo(() => {
    const counts = new Map<string, number>()
    for (const candidate of candidateList) {
      const status =
        reviewStatuses[candidate.assertion_id] ?? candidate.grounding_state
      counts.set(status, (counts.get(status) ?? 0) + 1)
    }
    const order = ['grounded', 'rejected', 'edited', 'uncertain', 'unresolved']
    const known = order.filter((s) => counts.has(s))
    const extras: string[] = []
    for (const key of counts.keys()) {
      if (!order.includes(key)) extras.push(key)
    }
    return [...known, ...extras].map((value) => ({
      value,
      count: counts.get(value) ?? 0,
    }))
  }, [candidateList, reviewStatuses])

  const statusFilterOptions = useMemo<MultiSelectOption[]>(
    () =>
      observedStatuses.map(({ value, count }) => ({
        value,
        label: (
          <span className="flex w-full items-center justify-between gap-2">
            <span>{value}</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {count}
            </span>
          </span>
        ),
      })),
    [observedStatuses],
  )

  const visibleCandidates = useMemo(() => {
    const priority: Record<string, number> = {
      provider_error: 0,
      unsupported: 1,
      ambiguous: 2,
      needs_edit: 3,
      missing_evidence: 4,
      low_confidence: 5,
      supported: 6,
      ready_for_review: 7,
    }
    const observedCount = observedStatuses.length
    return candidateList
      .filter((candidate) => {
        const suggestion = aiSuggestions[candidate.assertion_id]
        const aiOk =
          aiFocus === 'all' || suggestion?.suggestion_status === aiFocus
        if (!aiOk) return false
        const status =
          reviewStatuses[candidate.assertion_id] ?? candidate.grounding_state
        const allChecked =
          statusFilter.size === 0 || statusFilter.size === observedCount
        if (allChecked) return true
        return statusFilter.has(status)
      })
      .sort((left, right) => {
        const leftSuggestion = aiSuggestions[left.assertion_id]
        const rightSuggestion = aiSuggestions[right.assertion_id]
        const leftConfidence = leftSuggestion?.confidence ?? left.confidence
        const rightConfidence = rightSuggestion?.confidence ?? right.confidence
        if (aiSort === 'confidence_asc') return leftConfidence - rightConfidence
        if (aiSort === 'confidence_desc') return rightConfidence - leftConfidence
        return (
          (priority[leftSuggestion?.suggestion_status ?? 'ready_for_review'] ?? 3) -
            (priority[rightSuggestion?.suggestion_status ?? 'ready_for_review'] ?? 3) ||
          leftConfidence - rightConfidence
        )
      })
  }, [
    aiFocus,
    aiSort,
    aiSuggestions,
    candidateList,
    observedStatuses,
    reviewStatuses,
    statusFilter,
  ])

  useEffect(() => {
    setCandidateList(assertionCandidates)
    setAiSuggestions(
      Object.fromEntries(
        assertionCandidates
          .filter((candidate) => candidate.ai_grounding_suggestion)
          .map((candidate) => [candidate.assertion_id, candidate.ai_grounding_suggestion!]),
      ),
    )
    setIndex((value) => Math.min(value, Math.max(assertionCandidates.length - 1, 0)))
  }, [assertionCandidates])

  useEffect(() => {
    if (assertionCandidates.length || !extractionRunId) return
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch(
          `${KNOWLEDGE_BUILDER_API}/reference-concepts?extractionRunId=${encodeURIComponent(extractionRunId)}&limit=500`,
        )
        if (!response.ok) throw new Error(`reference-concepts:${response.status}`)
        const payload = (await response.json()) as {
          assertionCandidates?: GroundCandidate[]
          aiGroundingSuggestions?: AiGroundingSuggestion[]
          aiGroundingAssessmentSource?: AiGroundingSuggestion['assessment_source']
        }
        if (cancelled) return
        const suggestionByAssertion = Object.fromEntries(
          (payload.aiGroundingSuggestions ?? []).map((suggestion) => {
            const normalized = normalizeAiSuggestion(
              suggestion,
              payload.aiGroundingAssessmentSource ?? 'legacy_threshold',
            )
            return [normalized.assertion_id, normalized]
          }),
        )
        const nextCandidates = (payload.assertionCandidates ?? []).map(
          (candidate) => ({
            ...candidate,
            ai_grounding_suggestion: suggestionByAssertion[candidate.assertion_id],
          }),
        )
        setCandidateList(nextCandidates)
        setAiSuggestions(suggestionByAssertion)
        setIndex((value) => Math.min(value, Math.max(nextCandidates.length - 1, 0)))
      } catch (error) {
        if (!cancelled) {
          setActionError(
            error instanceof Error ? error.message : 'Unable to load reference concepts',
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [assertionCandidates.length, extractionRunId])

  useEffect(() => {
    setSelectedIds(new Set())
    setBatchConfirmOpen(false)
  }, [extractionRunId])

  useEffect(() => {
    if (!visibleCandidates.length) return
    if (!visibleCandidates.some((candidate) => candidate.assertion_id === current?.assertion_id)) {
      setIndex(candidateList.findIndex(
        (candidate) => candidate.assertion_id === visibleCandidates[0]?.assertion_id,
      ))
    }
  }, [candidateList, current?.assertion_id, visibleCandidates])


  useEffect(() => {
    if (!current) return
    setEditOpen(false)
    setEditDraft({
      subject_text: current.normalized_assertion.subject?.text ?? '',
      predicate_text: current.normalized_assertion.predicate ?? '',
      object_text: current.normalized_assertion.object?.text ?? '',
    })
  }, [current?.assertion_id])

  useEffect(() => {
    if (!current) {
      setDetail(null)
      setPreview(null)
      return
    }
    let cancelled = false
    setDetail(null)
    setPreview(null)
    setPreviewStale(false)
    void (async () => {
      try {
        const [detailRes, previewRes] = await Promise.all([
          fetch(
            `${KNOWLEDGE_BUILDER_API}/reference-concepts/${current.assertion_id}`,
          ).then((r) =>
            r.ok ? r.json() : Promise.reject(new Error(`detail:${r.status}`)),
          ),
          fetch(
            `${KNOWLEDGE_BUILDER_API}/reference-concepts/${current.assertion_id}/graph-delta-preview`,
          ).then((r) =>
            r.ok ? r.json() : Promise.reject(new Error(`preview:${r.status}`)),
          ),
        ])
        if (cancelled) return
        setDetail(detailRes as GroundDetail)
        setPreview(previewRes as GroundPreview)
        const loadedDetail = detailRes as GroundDetail
        const latestEvent = loadedDetail.learningEvents.at(-1)?.event_type
        const persistedStatus =
          loadedDetail.assertionCandidate?.grounding_state === 'grounded'
            ? 'grounded'
            : latestEvent === 'human_reject'
              ? 'rejected'
              : latestEvent === 'human_uncertain'
                ? 'uncertain'
                : latestEvent === 'human_edit'
                  ? 'edited'
                  : latestEvent === 'human_accept'
                    ? 'accepted'
                    : null
        if (persistedStatus)
          setReviewStatuses((currentStatuses) => ({
            ...currentStatuses,
            [current.assertion_id]: persistedStatus,
          }))
      } catch (error) {
        if (cancelled) return
        setActionError(
          error instanceof Error ? error.message : 'Unable to load candidate',
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [current?.assertion_id])

  const refreshPreview = useCallback(async () => {
    if (!current) return
    setPreviewLoading(true)
    setPreviewStale(false)
    try {
      const next = await fetch(
        `${KNOWLEDGE_BUILDER_API}/reference-concepts/${current.assertion_id}/graph-delta-preview`,
      ).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`preview:${r.status}`)),
      )
      setPreview(next as GroundPreview)
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Unable to reload preview',
      )
    } finally {
      setPreviewLoading(false)
    }
  }, [current?.assertion_id])

  const submitGrounding = useCallback(
    async (
      decision: 'accept' | 'reject' | 'uncertain' | 'edit' | 'reground',
      editedAssertion?: Record<string, unknown>,
    ) => {
      if (!current) return
      setActionPending(true)
      setActionError(null)
      try {
        const body: Record<string, unknown> = {
          schemaVersion: 'learning_event_grounding_request.v1',
          decision,
          certainty: 'high',
          reasonCode: 'reviewed_against_source',
          justification:
            'Reviewer decision recorded against the canonical source evidence.',
        }
        if (preview?.available && preview.evidenceAnchorRefs) {
          body.evidenceAnchorRefs = preview.evidenceAnchorRefs
        }
        if (
          preview?.available &&
          preview.previewHash &&
          decision === 'edit'
        ) {
          body.graphDelta = preview.graphDelta
          body.graphDeltaPreviewHash = preview.previewHash
        }
        if (decision === 'edit' && editedAssertion) {
          body.editedAssertion = editedAssertion
        }
        const result = await fetch(
          `${KNOWLEDGE_BUILDER_API}/reference-concepts/${current.assertion_id}/grounding-events`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          },
        ).then(async (r) => ({
          ok: r.ok,
          status: r.status,
          payload: await r.json().catch(() => ({})),
        }))
        if (!result.ok) {
          const detail =
            (result.payload as { detail?: string }).detail ??
            `grounding:${result.status}`
          if (/stale/i.test(detail)) setPreviewStale(true)
          throw new Error(detail)
        }
        const learningEventId = (
          result.payload as { learningEvent?: { event_id?: string } }
        ).learningEvent?.event_id
        if (
          (decision === 'accept' || decision === 'edit') &&
          learningEventId
        ) {
          const releasePayload = (await fetch(
            `${KNOWLEDGE_BUILDER_API}/reference-concepts/${current.assertion_id}/release`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                schemaVersion: 'accepted_graph_release_request.v1',
                humanEventId: learningEventId,
              }),
            },
          ).then((r) =>
            r.ok ? r.json() : Promise.reject(new Error(`release:${r.status}`)),
          )) as { graphRelease?: Record<string, any> }
          setAcceptedRelease(releasePayload.graphRelease ?? null)
          setActivationProjection(null)
          if (releasePayload.graphRelease) onAcceptedRelease?.(releasePayload.graphRelease)
          // R7-09: accepted release creation is separate from activation.
          // Learning-gate outcomes must never mutate the active snapshot.
        }
        setReviewStatuses((currentStatuses) => ({
          ...currentStatuses,
          [current.assertion_id]:
            decision === 'accept' || decision === 'edit'
              ? 'grounded'
              : decision === 'reject'
                ? 'rejected'
                : decision === 'uncertain'
                  ? 'uncertain'
                  : currentStatuses[current.assertion_id] ?? 'unresolved',
        }))
        setEditOpen(false)
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : 'Unable to record decision',
        )
      } finally {
        setActionPending(false)
      }
    },
    [current?.assertion_id, onAcceptedRelease, preview],
  )

  const submitBatchAccept = useCallback(async () => {
    const selected = candidateList.filter((candidate) => selectedIds.has(candidate.assertion_id))
    if (!selected.length) return
    setBatchPending(true)
    setActionError(null)
    try {
      const response = await fetch(
        `${KNOWLEDGE_BUILDER_API}/reference-concepts/batch-grounding-events`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            schemaVersion: 'learning_event_grounding_batch_request.v1',
            batchIdempotencyKey: `${extractionRunId ?? 'run'}:${[...selectedIds].sort().join(',')}`,
            decision: 'accept',
            items: selected.map((candidate) => ({
              assertionId: candidate.assertion_id,
              evidenceAnchorRefs: (candidate.source_anchors ?? []).map((anchor) => anchor.anchor_id),
            })),
            certainty: 'high',
            reasonCode: 'batch_human_accept',
            justification: 'Reviewer confirmed the selected candidates against canonical evidence.',
          }),
        },
      )
      const payload = (await response.json().catch(() => ({}))) as {
        detail?: string
        graphRelease?: Record<string, any>
      }
      if (!response.ok) throw new Error(payload.detail ?? `batch-grounding:${response.status}`)
      if (payload.graphRelease) {
        setAcceptedRelease(payload.graphRelease)
        setActivationProjection(null)
        onAcceptedRelease?.(payload.graphRelease)
      }
      setReviewStatuses((statuses) => ({
        ...statuses,
        ...Object.fromEntries(selected.map((candidate) => [candidate.assertion_id, 'grounded'])),
      }))
      if (current && selectedIds.has(current.assertion_id)) {
        const refreshed = await fetch(
          `${KNOWLEDGE_BUILDER_API}/reference-concepts/${current.assertion_id}`,
        )
        if (refreshed.ok) setDetail((await refreshed.json()) as GroundDetail)
      }
      setSelectedIds(new Set())
      setBatchConfirmOpen(false)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to batch accept candidates')
    } finally {
      setBatchPending(false)
    }
  }, [candidateList, current, extractionRunId, onAcceptedRelease, selectedIds])

  const activateRelease = useCallback(async () => {
    const graphVersion = acceptedRelease?.graph_version
    if (!graphVersion) return
    setActionPending(true)
    setActionError(null)
    try {
      const response = await fetch(
        `${KNOWLEDGE_BUILDER_API}/graph-releases/${encodeURIComponent(graphVersion)}/project-activate`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ effectiveAt: new Date().toISOString() }),
        },
      )
      const payload = await response.json()
      if (!response.ok)
        throw new Error(
          String(payload.detail ?? `activation:${response.status}`),
        )
      setActivationProjection(payload.projection ?? null)
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Unable to activate release',
      )
    } finally {
      setActionPending(false)
    }
  }, [acceptedRelease?.graph_version])

  const submitReground = useCallback(async () => {
    if (!current || !regroundBlockId) return
    setActionPending(true)
    setActionError(null)
    try {
      const evidenceRef = current.evidence_refs[0]?.evidence_ref
      if (!evidenceRef)
        throw new Error('No canonical EvidenceRef bound to this candidate')
      // The Reground seam validates the new selector against the canonical
      // document server-side; we send a structural selector keyed to the
      // chosen source block id.
      await fetch('/api/evidence/reground', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          evidenceRef: { evidenceRef },
          newSelector: {
            schemaVersion: 'semantier.evidence_selector.v1',
            selectorKind: 'structure',
            structuralPath: [
              `block:paragraph`,
              `localContentHash:${regroundBlockId}`,
            ],
            sourceElementRef: regroundBlockId,
          },
          sourceBlockId: regroundBlockId,
        } satisfies Partial<GroundRegroundPayload>),
      }).then(async (r) => ({
        ok: r.ok,
        status: r.status,
        payload: await r.json().catch(() => ({})),
      }))
      setRegroundOpen(false)
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Unable to reground',
      )
    } finally {
      setActionPending(false)
    }
  }, [current, regroundBlockId])

  const submitBoundaryAction = useCallback(
    async (actionType: 'split' | 'merge' | 'edit_role' | 'accept' | 'reject') => {
      if (!enableBoundaryReview || !extractionRunId) return
      const sourceSpanIds =
        actionType === 'merge'
          ? [...selectedIds]
          : current
            ? [current.assertion_id]
            : []
      if (!sourceSpanIds.length) return
      setActionPending(true)
      setBoundaryReviewError(null)
      try {
        const payload: Record<string, unknown> = {
          actionId: `boundary_${actionType}_${Date.now()}`,
          actionType,
          actorId: 'current-user',
          expectedGraphVersion,
          sourceSpanIds,
          reasonCode: 'curator_boundary_correction',
          comment: 'Recorded from ContextGraph Studio boundary review.',
          clientTimestamp: new Date().toISOString(),
        }
        if (actionType === 'split') {
          const offsets = boundarySplitOffsets
            .split(',')
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isInteger(value) && value > 0)
          payload.splitOffsetsAbsolute = offsets
        }
        if (actionType === 'edit_role') {
          payload.targetSemanticRole = boundaryTargetRole.trim()
        }
        const response = await fetch(
          `/api/contextgraph/extraction-runs/${encodeURIComponent(extractionRunId)}/boundary-actions`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          },
        )
        const result = (await response.json().catch(() => ({}))) as {
          detail?: string
        }
        if (!response.ok) throw new Error(result.detail ?? `boundary-action:${response.status}`)
        await loadBoundaryReview()
      } catch (error) {
        setBoundaryReviewError(
          error instanceof Error ? error.message : 'Unable to record boundary action',
        )
      } finally {
        setActionPending(false)
      }
    },
    [boundarySplitOffsets, boundaryTargetRole, current, enableBoundaryReview, expectedGraphVersion, extractionRunId, loadBoundaryReview, selectedIds],
  )

  if (!current) {
    return (
      <div className="grid h-full place-items-center bg-card text-xs text-muted-foreground">
        {zh
          ? '当前抽取运行下没有待校准的参考概念。'
          : 'No pending reference concepts under the current extraction run.'}
      </div>
    )
  }

  const label =
    detail?.assertionCandidate?.confidence !== undefined
      ? `${(detail.assertionCandidate.confidence * 100).toFixed(0)}% confidence`
      : ''
  const visibleIds = visibleCandidates.map((candidate) => candidate.assertion_id)
  const selectableVisibleIds = visibleIds.slice(0, 100)
  const visibleSelectedCount = selectableVisibleIds.filter((id) => selectedIds.has(id)).length
  const allVisibleSelected = selectableVisibleIds.length > 0 && visibleSelectedCount === selectableVisibleIds.length
  const selectedStatusCounts = [...selectedIds].reduce<Record<string, number>>((counts, id) => {
    const status = aiSuggestions[id]?.suggestion_status ?? 'not_run'
    counts[status] = (counts[status] ?? 0) + 1
    return counts
  }, {})

  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto] bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-2.5 text-xs">
        <strong>
          {zh ? '校准参考概念' : 'Grounding reference concepts'} {candidateList.length}
        </strong>
        <span className="font-mono text-[10px] text-muted-foreground">
          {current.assertion_id}
        </span>
        <div className="flex-1" />
        <ControlledSelect
          compact
          label={zh ? 'AI 校准筛选' : 'AI grounding filter'}
          value={aiFocus}
          onValueChange={setAiFocus}
          options={[
            { value: 'all', label: zh ? '全部 AI 状态' : 'All AI statuses' },
            { value: 'provider_error', label: zh ? '提供方错误' : 'Provider error' },
            { value: 'unsupported', label: zh ? '不支持' : 'Unsupported' },
            { value: 'ambiguous', label: zh ? '有歧义' : 'Ambiguous' },
            { value: 'needs_edit', label: zh ? '需要编辑' : 'Needs edit' },
            { value: 'supported', label: zh ? '支持' : 'Supported' },
            { value: 'missing_evidence', label: zh ? '缺少证据' : 'Missing evidence' },
            { value: 'low_confidence', label: zh ? '低置信度' : 'Low confidence' },
            { value: 'ready_for_review', label: zh ? '可供复核' : 'Ready for review' },
          ]}
        />
        <MultiSelectDropdown
          compact
          label={zh ? '状态筛选' : 'Status filter'}
          options={statusFilterOptions}
          value={statusFilter}
          onValueChange={setStatusFilter}
          emptyLabel={zh ? '全部' : 'All'}
        />
        <ControlledSelect
          compact
          label={zh ? '参考概念排序' : 'Reference concept sort'}
          value={aiSort}
          onValueChange={setAiSort}
          options={[
            { value: 'priority', label: zh ? 'AI 优先级' : 'AI priority' },
            { value: 'confidence_asc', label: zh ? '置信度：低到高' : 'Confidence: low first' },
            { value: 'confidence_desc', label: zh ? '置信度：高到低' : 'Confidence: high first' },
          ]}
        />
      </div>
      {selectedIds.size ? (
        <div className="flex items-center gap-3 border-b border-border bg-primary/5 px-3 py-2 text-xs">
          <strong>{zh ? `已选择 ${selectedIds.size} 项` : `${selectedIds.size} selected`}</strong>
          <span className="text-muted-foreground">
            {zh ? '仅记录人工接受，不发布或激活。' : 'Records human acceptance only; does not release or activate.'}
          </span>
          {visibleIds.length > 100 ? (
            <span className="text-warning">{zh ? '每批最多 100 项。' : 'Maximum 100 candidates per batch.'}</span>
          ) : null}
          <div className="flex-1" />
          <Button variant="outline" onClick={() => setSelectedIds(new Set())} disabled={batchPending}>
            {zh ? '清除' : 'Clear'}
          </Button>
          <Button onClick={() => setBatchConfirmOpen(true)} disabled={batchPending}>
            {zh ? '批量接受' : 'Batch Accept'}
          </Button>
        </div>
      ) : null}
      <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]">
        <section
          aria-label={zh ? '校准参考概念列表' : 'Grounding candidate list'}
          className="min-h-0 overflow-auto border-r border-border bg-muted/20 p-3"
        >
          <Table className="min-w-[36rem] text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    ref={(element) => {
                      if (element) element.indeterminate = visibleSelectedCount > 0 && !allVisibleSelected
                    }}
                    checked={allVisibleSelected}
                    aria-checked={visibleSelectedCount > 0 && !allVisibleSelected ? 'mixed' : allVisibleSelected}
                    aria-label={zh ? '选择本页全部候选' : 'Select all candidates on this page'}
                    onChange={() => setSelectedIds((currentIds) => {
                      const next = new Set(currentIds)
                      if (allVisibleSelected) selectableVisibleIds.forEach((id) => next.delete(id))
                      else selectableVisibleIds.forEach((id) => next.add(id))
                      return next
                    })}
                  />
                </TableHead>
                <TableHead>{zh ? '参考概念' : 'Reference concept'}</TableHead>
                <TableHead>{zh ? '置信度' : 'Confidence'}</TableHead>
                <TableHead>{zh ? '证据' : 'Evidence'}</TableHead>
                <TableHead>{zh ? 'AI 校准' : 'AI Ground'}</TableHead>
                <TableHead>{zh ? '状态' : 'Status'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleCandidates.map((candidate) => {
                const candidateIndex = candidateList.findIndex(
                  (item) => item.assertion_id === candidate.assertion_id,
                )
                const candidateLabel =
                  candidate.normalized_assertion.subject?.text ??
                  candidate.normalized_assertion.object?.text ??
                  candidate.normalized_assertion.predicate ??
                  candidate.assertion_id
                const candidateStatus =
                  reviewStatuses[candidate.assertion_id] ??
                  candidate.grounding_state
                const aiSuggestion = aiSuggestions[candidate.assertion_id]
                return (
                  <TableRow
                    key={candidate.assertion_id}
                    aria-selected={candidateIndex === index ? 'true' : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(candidate.assertion_id)}
                        disabled={!selectedIds.has(candidate.assertion_id) && selectedIds.size >= 100}
                        aria-label={zh ? `选择 ${candidateLabel}` : `Select ${candidateLabel}`}
                        onChange={() => setSelectedIds((currentIds) => {
                          const next = new Set(currentIds)
                          if (next.has(candidate.assertion_id)) next.delete(candidate.assertion_id)
                          else next.add(candidate.assertion_id)
                          return next
                        })}
                      />
                    </TableCell>
                    <TableCell className="p-0">
                      <Button
                        type="button"
                        variant="ghost"
                        aria-current={
                          candidateIndex === index ? 'true' : undefined
                        }
                        onClick={() => setIndex(candidateIndex)}
                        className="h-auto justify-start rounded-none px-[1.1rem] py-[0.9rem] text-left whitespace-nowrap hover:bg-transparent"
                      >
                        <span className="block max-w-[20rem]">
                          <span className="block truncate text-xs font-semibold">
                            {candidateLabel}
                          </span>
                          <span className="mt-1 block truncate font-mono text-[9px] text-muted-foreground">
                            {candidate.assertion_id}
                          </span>
                        </span>
                      </Button>
                    </TableCell>
                    <TableCell>
                      {candidate.confidence.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {candidate.evidence_refs?.length ?? 0}
                    </TableCell>
                    <TableCell>
                      {aiSuggestion ? (
                        <div className="grid gap-1">
                          <Badge
                            tone={
                              ['ready_for_review', 'supported'].includes(aiSuggestion.suggestion_status)
                                ? 'success'
                                : ['low_confidence', 'ambiguous', 'needs_edit'].includes(aiSuggestion.suggestion_status)
                                  ? 'warning'
                                  : 'danger'
                            }
                            className="whitespace-nowrap"
                          >
                            {zh
                              ? ['ready_for_review', 'supported'].includes(aiSuggestion.suggestion_status)
                                ? '可供复核'
                                : aiSuggestion.suggestion_status === 'low_confidence'
                                  ? '低置信度'
                                  : '缺少证据'
                              : aiSuggestion.suggestion_status.replaceAll('_', ' ')}
                          </Badge>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {aiSuggestion.confidence.toFixed(2)}
                          </span>
                          {aiSuggestion.assessment_source === 'legacy_threshold' ? (
                            <span className="text-[9px] text-warning">
                              {zh ? '旧版阈值结果；请重新运行 AI 校准' : 'Legacy threshold; run AI Ground to replace'}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <Badge tone="neutral" className="whitespace-nowrap">
                          {zh ? '未运行' : 'Not run'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        tone={
                          candidateStatus === 'grounded'
                            ? 'success'
                            : candidateStatus === 'rejected'
                              ? 'danger'
                              : candidateStatus === 'edited'
                                ? 'info'
                                : 'neutral'
                        }
                      >
                        {candidateStatus}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </section>
        <div className="min-h-0 overflow-auto p-4 lg:p-5">
          <h2 className="text-lg font-semibold">
            {current.normalized_assertion.subject?.text ??
              current.normalized_assertion.predicate ??
              current.assertion_id}
          </h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusPill>{current.grounding_state}</StatusPill>
            {label ? <StatusPill>{label}</StatusPill> : null}
            <StatusPill tone="candidate">{candidateGraphId ?? '—'}</StatusPill>
            {preview?.available && preview.previewHash ? (
              <StatusPill tone="success">
                {zh ? '预览就绪' : 'Preview ready'}
              </StatusPill>
            ) : preview?.reason ? (
              <StatusPill tone="warning">{preview.reason}</StatusPill>
            ) : null}
          </div>
          <MiniLabel>{zh ? '证据' : 'Evidence'}</MiniLabel>
          {sourceDocumentPresentation && sourceDocumentKind ? (
            <div className="mt-1">
              <SourceEvidenceViewer
                zh={zh}
                documentName={
                  sourceDocumentPresentation.documentName ??
                  current.assertion_id
                }
                documentKind={sourceDocumentKind}
                sourceDocumentHash={
                  sourceDocumentPresentation.sourceIdentityRef
                }
                viewerConfig={viewerConfig}
                findings={groundFindings}
                selectedFindingId={selectedGroundFindingId}
                onSelectFinding={(finding) =>
                  setSelectedGroundFindingId(finding.finding_id)
                }
              />
            </div>
          ) : (
            <p className="font-mono text-[10px] text-muted-foreground">
              {(detail?.assertionCandidate?.source_anchors ?? [])
                .map((a) => a.anchor_id)
                .join('\n') || (zh ? '暂无证据' : 'No evidence yet')}
            </p>
          )}
          <MiniLabel>{zh ? '预览 hash' : 'Preview hash'}</MiniLabel>
          <div className="flex items-center gap-2">
            <code className="font-mono text-[10px] text-muted-foreground">
              {preview?.previewHash ?? (zh ? '尚无预览' : 'No preview yet')}
            </code>
            {previewLoading ? (
              <span className="text-[10px] text-muted-foreground">
                {zh ? '加载中…' : 'Loading…'}
              </span>
            ) : (
              <Button
                type="button"
                onClick={() => void refreshPreview()}
                className="text-[10px] text-primary underline-offset-2 hover:underline"
              >
                {zh ? '重新加载' : 'Reload'}
              </Button>
            )}
          </div>
          {previewStale ? (
            <div
              role="alert"
              className="mt-2 rounded border border-warning/40 bg-warning/10 px-2 py-1 text-[11px] text-warning"
            >
              {zh
                ? '预览已陈旧，请重新加载后再提交。'
                : 'Preview is stale; reload before submitting.'}
            </div>
          ) : null}
          <MiniLabel>Human Grounding</MiniLabel>
          {aiSuggestions[current.assertion_id]?.assessment_source === 'llm_structured' ? (
            <div className="mb-3 rounded border border-border bg-muted/30 p-2 text-[11px]">
              <strong>{zh ? 'AI 校准理由' : 'AI grounding rationale'}</strong>
              <p className="mt-1 text-muted-foreground">{aiSuggestions[current.assertion_id]?.rationale}</p>
              <p className="font-mono text-[9px] text-muted-foreground">
                {aiSuggestions[current.assertion_id]?.provider ?? '—'} / {aiSuggestions[current.assertion_id]?.model ?? '—'}
              </p>
            </div>
          ) : null}
          {enableBoundaryReview ? (
            <div className="mb-3 rounded border border-border bg-muted/30 p-3 text-[11px]">
              <div className="mb-2 flex items-center gap-2">
                <strong>{zh ? '边界复核' : 'Boundary review'}</strong>
                <span className="text-muted-foreground">
                  {boundaryReviewLoading
                    ? zh
                      ? '加载中…'
                      : 'Loading…'
                    : `${boundaryCandidateSpans.length} spans · ${boundaryLearningEvents.length} events`}
                </span>
              </div>
              {boundaryReviewError ? (
                <div role="alert" className="mb-2 text-destructive">
                  {boundaryReviewError}
                </div>
              ) : null}
              <div className="grid gap-2 md:grid-cols-2">
                <label className="grid gap-1 text-[11px] font-semibold">
                  {zh ? 'Split offsets' : 'Split offsets'}
                  <Input
                    value={boundarySplitOffsets}
                    onChange={(event) => setBoundarySplitOffsets(event.target.value)}
                    placeholder="12,24"
                  />
                </label>
                <label className="grid gap-1 text-[11px] font-semibold">
                  {zh ? 'Semantic role' : 'Semantic role'}
                  <Input
                    value={boundaryTargetRole}
                    onChange={(event) => setBoundaryTargetRole(event.target.value)}
                    placeholder="term"
                  />
                </label>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={actionPending || !current || !boundarySplitOffsets.trim()}
                  onClick={() => void submitBoundaryAction('split')}
                >
                  {zh ? '拆分当前项' : 'Split current'}
                </Button>
                <Button
                  variant="outline"
                  disabled={actionPending || selectedIds.size < 2}
                  onClick={() => void submitBoundaryAction('merge')}
                >
                  {zh ? '合并所选' : 'Merge selected'}
                </Button>
                <Button
                  variant="outline"
                  disabled={actionPending || !current || !boundaryTargetRole.trim()}
                  onClick={() => void submitBoundaryAction('edit_role')}
                >
                  {zh ? '修改角色' : 'Edit role'}
                </Button>
              </div>
              <div className="mt-3 grid gap-1">
                {boundaryCandidateSpans.slice(0, 3).map((span) => (
                  <div key={span.candidate_span_id} className="flex items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground">
                    <span className="truncate">{span.candidate_span_id} · {span.exact_text || '—'}</span>
                    <span>{span.grounding_state}{span.needs_boundary_review ? ' · review' : ''}</span>
                  </div>
                ))}
                {boundaryLearningEvents.slice(0, 2).map((event) => (
                  <div key={event.event_id} className="flex items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground">
                    <span className="truncate">{event.event_id}</span>
                    <span>{event.event_type}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {editOpen ? (
            <div className="mb-3 grid gap-2 rounded-[12px] border border-border bg-muted/30 p-3">
              <label className="grid gap-1 text-[11px] font-semibold">
                {zh ? '主语' : 'Subject'}
                <Input
                  value={editDraft.subject_text}
                  onChange={(event) =>
                    setEditDraft((currentDraft) => ({
                      ...currentDraft,
                      subject_text: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1 text-[11px] font-semibold">
                {zh ? '谓词' : 'Predicate'}
                <Input
                  value={editDraft.predicate_text}
                  onChange={(event) =>
                    setEditDraft((currentDraft) => ({
                      ...currentDraft,
                      predicate_text: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1 text-[11px] font-semibold">
                {zh ? '宾语' : 'Object'}
                <Input
                  value={editDraft.object_text}
                  onChange={(event) =>
                    setEditDraft((currentDraft) => ({
                      ...currentDraft,
                      object_text: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  disabled={actionPending}
                  onClick={() => setEditOpen(false)}
                >
                  {zh ? '取消' : 'Cancel'}
                </Button>
                <Button
                  disabled={
                    actionPending ||
                    !preview?.available ||
                    !preview.previewHash
                  }
                  onClick={() => void submitGrounding('edit', editDraft)}
                >
                  {zh ? '保存编辑' : 'Save edit'}
                </Button>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="default"
              disabled={actionPending}
              onClick={() => void submitGrounding('accept')}
            >
              {zh ? '接受' : 'Accept'}
            </Button>
            <Button
              variant="outline"
              disabled={actionPending || !preview?.available}
              onClick={() => setEditOpen(true)}
            >
              {zh ? '编辑' : 'Edit'}
            </Button>
            <Button
              variant="outline"
              disabled={actionPending}
              className="text-destructive"
              onClick={() => void submitGrounding('reject')}
            >
              {zh ? '拒绝' : 'Reject'}
            </Button>
            <Button
              variant="outline"
              disabled={actionPending}
              onClick={() => void submitGrounding('uncertain')}
            >
              {zh ? '不确定' : 'Uncertain'}
            </Button>
            <Button
              variant="outline"
              disabled={actionPending}
              onClick={() => setRegroundOpen((open) => !open)}
            >
              {zh ? '重新定位' : 'Reground'}
            </Button>
          </div>
          {acceptedRelease ? (
            <div
              className="mt-3 rounded border border-success/30 bg-success/10 p-2 text-[11px]"
              data-testid="ground-accepted-release"
            >
              <div>
                AcceptedGraphRelease:{' '}
                <span className="font-mono">
                  {acceptedRelease.graph_version}
                </span>
              </div>
              {activationProjection ? (
                <div data-testid="ground-activation-snapshot">
                  Activation snapshot:{' '}
                  <span className="font-mono">
                    {activationProjection.activation_set_snapshot_id ??
                      activationProjection.activationSetSnapshotId ??
                      'activated'}
                  </span>
                </div>
              ) : (
                <StudioButton
                  primary
                  disabled={actionPending}
                  onClick={() => void activateRelease()}
                >
                  {zh ? '激活发布版本' : 'Activate release'}
                </StudioButton>
              )}
            </div>
          ) : null}
          <AlertDialogRoot open={batchConfirmOpen} onOpenChange={setBatchConfirmOpen}>
            <AlertDialogContent>
              <div className="grid gap-3 p-5">
                <AlertDialogTitle>{zh ? '确认批量接受' : 'Confirm batch acceptance'}</AlertDialogTitle>
                <AlertDialogDescription>
                  {zh
                    ? `将记录 ${selectedIds.size} 项人工接受并创建一个已接受图谱发布版本。此操作不会激活图谱。`
                    : `This records human acceptance for ${selectedIds.size} candidates and creates one accepted graph release. It does not activate the graph.`}
                </AlertDialogDescription>
                <div className="text-xs text-muted-foreground">
                  {Object.entries(selectedStatusCounts).map(([status, count]) => (
                    <div key={status}>{status}: {count}</div>
                  ))}
                </div>
                <div className="mt-1 flex justify-end gap-2">
                  <AlertDialogCancel disabled={batchPending}>{zh ? '取消' : 'Cancel'}</AlertDialogCancel>
                  <AlertDialogAction disabled={batchPending} onClick={() => void submitBatchAccept()}>
                    {batchPending ? (zh ? '接受中…' : 'Accepting…') : (zh ? '确认接受' : 'Confirm Accept')}
                  </AlertDialogAction>
                </div>
              </div>
            </AlertDialogContent>
          </AlertDialogRoot>
          {regroundOpen ? (
            <div className="mt-2 rounded border border-border bg-muted/40 p-2 text-[11px]">
              <label className="flex flex-col gap-1">
                <span>
                  {zh ? '目标 source_block_id' : 'Target source_block_id'}
                </span>
                <Input
                  value={regroundBlockId}
                  onChange={(event) => setRegroundBlockId(event.target.value)}
                  className="rounded border border-border bg-background px-2 py-1 font-mono text-[10px]"
                />
              </label>
              <Button
                type="button"
                disabled={actionPending || !regroundBlockId}
                onClick={() => void submitReground()}
                className="mt-2 rounded border border-primary bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground"
              >
                {zh ? '提交 Reground' : 'Submit Reground'}
              </Button>
            </div>
          ) : null}
          <MiniLabel>{zh ? '历史' : 'History'}</MiniLabel>
          <ul className="space-y-1 text-xs">
            {(detail?.learningEvents ?? []).map((event) => (
              <li
                key={event.event_id}
                className="font-mono text-[10px] text-muted-foreground"
              >
                {event.occurred_at ?? ''} · {event.event_type} ·{' '}
                {event.actor_ref ?? '—'} · {event.event_hash.slice(0, 12)}…
              </li>
            ))}
            {(detail?.learningEvents ?? []).length === 0 ? (
              <li className="text-xs text-muted-foreground">
                {zh
                  ? '尚无人工决策；写入前会对固定来源进行服务端重新校验。'
                  : 'No prior human decision; the pinned source is revalidated server-side before write.'}
              </li>
            ) : null}
          </ul>
        </div>
      </div>
      <div className="flex h-8 items-center border-t border-border px-3 text-[10px] text-muted-foreground">
        {preview?.available && preview.baseGraphVersion
          ? `${zh ? '基础版本' : 'Base'} ${preview.baseGraphVersion} · ${zh ? '来源 hash 校验就绪' : 'source hash revalidation ready'}`
          : `${zh ? '尚无可用的预览' : 'No preview available'} · ${zh ? '来源 hash 校验就绪' : 'source hash revalidation ready'}`}
      </div>
    </div>
  )
}

export function GraphMode({
  zh,
  sourceOpen,
  setSourceOpen,
  legendOpen,
  setLegendOpen,
  viewModel,
  selectedNodeId,
  selectedEdgeId,
  highlightedNodeIds,
  highlightedEdgeIds,
  setSelectedNodeId,
  setSelectedEdgeId,
  runtimeIdentity,
  candidateGraphId,
}: {
  zh: boolean
  sourceOpen: boolean
  setSourceOpen: (open: boolean) => void
  legendOpen: boolean
  setLegendOpen: (open: boolean) => void
  viewModel: GraphViewModel | null
  selectedNodeId: string | null
  selectedEdgeId: string | null
  highlightedNodeIds: string[]
  highlightedEdgeIds: string[]
  setSelectedNodeId: (id: string | null) => void
  setSelectedEdgeId: (id: string | null) => void
  runtimeIdentity: StudioIdentity
  candidateGraphId: string | null
}) {
  const graphSearch = useContextGraphStudioStore((state) => state.graphSearch)
  const graphLayout = useContextGraphStudioStore((state) => state.graphLayout)
  const layoutRunning = useContextGraphStudioStore(
    (state) => state.layoutRunning,
  )
  const settingsOpen = useContextGraphStudioStore((state) => state.settingsOpen)
  const dragEnabled = useContextGraphStudioStore((state) => state.dragEnabled)
  const largeGraphPerformance = useContextGraphStudioStore(
    (state) => state.largeGraphPerformance,
  )
  const setGraphSearch = useContextGraphStudioStore(
    (state) => state.setGraphSearch,
  )
  const setGraphLayout = useContextGraphStudioStore(
    (state) => state.setGraphLayout,
  )
  const setLayoutRunning = useContextGraphStudioStore(
    (state) => state.setLayoutRunning,
  )
  const setSettingsOpen = useContextGraphStudioStore(
    (state) => state.setSettingsOpen,
  )
  const setDragEnabled = useContextGraphStudioStore(
    (state) => state.setDragEnabled,
  )
  const setCameraIntent = useContextGraphStudioStore(
    (state) => state.setCameraIntent,
  )
  const [rendererError, setRendererError] = useState<string | null>(null)
  const [controlCommand, setControlCommand] = useState<{
    id: number
    type: 'zoom-in' | 'zoom-out' | 'fit' | 'fullscreen' | 'reset-layout'
  } | null>(null)
  const selected = resolveValidSelection(
    viewModel,
    selectedNodeId,
    selectedEdgeId,
  )
  const selectedNode = selected.node
  const selectedEdge = selected.edge
  const selectedSourceAnchors =
    selectedNode?.sourceAnchors ?? selectedEdge?.sourceAnchors ?? []
  const sourceBlocks = selectedSourceAnchors.map((anchor, index) => ({
    block_id: `${anchor.sourceRef}:${anchor.locator}:${index}`,
    block_type: anchor.locator,
    content: anchor.quote ?? '',
  }))
  const semanticTypes = [
    ...new Set(
      (viewModel?.nodes ?? []).map((node) => node.semanticType ?? 'unknown'),
    ),
  ].sort()
  const dynamicLayout =
    graphLayout === 'force-atlas' || graphLayout === 'force-directed'
  const layoutLabels: Record<LayoutAlgorithm, string> = {
    circular: 'Circular',
    circlepack: 'Circlepack',
    random: 'Random',
    noverlaps: 'Noverlaps',
    'force-directed': 'Force Directed',
    'force-atlas': 'Force Atlas',
  }
  const issueControl = (
    type: 'zoom-in' | 'zoom-out' | 'fit' | 'fullscreen' | 'reset-layout',
  ) => setControlCommand((previous) => ({ id: (previous?.id ?? 0) + 1, type }))
  return (
    <div
      className={`grid h-full min-h-0 transition-[grid-template-columns] duration-200 ${sourceOpen ? 'min-[1200px]:grid-cols-[minmax(260px,31%)_minmax(0,1fr)]' : 'grid-cols-[0_minmax(0,1fr)]'}`}
    >
      <div
        className={`min-h-0 min-w-0 overflow-hidden border-r border-border bg-card ${sourceOpen ? 'max-[1199px]:absolute max-[1199px]:inset-y-0 max-[1199px]:left-0 max-[1199px]:z-20 max-[1199px]:w-[min(420px,88vw)] max-[1199px]:shadow-sm' : 'pointer-events-none opacity-0'}`}
      >
        <SourceDocument
          zh={zh}
          onClose={() => setSourceOpen(false)}
          className="flex h-full"
          sourceLabel={runtimeIdentity.graphRef}
          blocks={sourceBlocks}
          loading={false}
          error={null}
        />
      </div>
      <div className="relative min-h-0 min-w-0 overflow-hidden bg-background">
        {viewModel ? (
          <Suspense
            fallback={
              <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
                {zh
                  ? '正在加载 Sigma 图渲染器…'
                  : 'Loading Sigma graph renderer…'}
              </div>
            }
          >
            <ContextGraphSigmaViewer
              model={viewModel}
              selectedNodeId={selectedNodeId}
              selectedEdgeId={selectedEdgeId}
              highlightedNodeIds={highlightedNodeIds}
              highlightedEdgeIds={highlightedEdgeIds}
              search={graphSearch}
              layout={graphLayout}
              layoutRunning={layoutRunning}
              dragEnabled={dragEnabled}
              largeGraphPerformance={largeGraphPerformance}
              onSelectNode={setSelectedNodeId}
              onSelectEdge={setSelectedEdgeId}
              onClearSelection={() => {
                setSelectedNodeId(null)
                setSelectedEdgeId(null)
              }}
              onCameraIntent={setCameraIntent}
              onRendererError={setRendererError}
              controlCommand={controlCommand}
            />
          </Suspense>
        ) : (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">
            <div>
              <strong className="block text-foreground">
                {zh
                  ? '没有可渲染的规范图快照'
                  : 'No canonical graph snapshot available'}
              </strong>
              <span className="mt-1 block">
                {zh
                  ? 'Studio 不会用 SVG 或推测数据静默替代规范图。'
                  : 'Studio will not silently substitute SVG or guessed graph data.'}
              </span>
            </div>
          </div>
        )}
        <div className="absolute right-3 top-3 z-10 flex w-[min(340px,calc(100%_-_24px))] items-center rounded-md border border-border bg-card shadow-sm transition-[border-color,box-shadow] focus-within:border-[var(--theme-accent)] focus-within:shadow-[0_0_0_4px_var(--theme-accent-subtle)]">
          <HugeiconsIcon
            icon={Search01Icon}
            size={15}
            strokeWidth={1.7}
            className="pointer-events-none absolute left-3 text-muted-foreground"
          />
          <Input
            value={graphSearch}
            onChange={(event) => setGraphSearch(event.target.value)}
            placeholder={
              zh ? '搜索标签或规范 ID…' : 'Search label or canonical ID…'
            }
            className="h-8 min-w-0 flex-1 rounded-[inherit] border-0 bg-transparent pl-9 pr-3 text-xs font-medium leading-[1.5] outline-none placeholder:text-muted-foreground"
          />
        </div>
        {!sourceOpen ? (
          <Button
            type="button"
            onClick={() => setSourceOpen(true)}
            className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] shadow-sm"
          >
            <HugeiconsIcon icon={FileViewIcon} size={14} strokeWidth={1.7} />
            {zh ? '来源证据' : 'Source evidence'}
          </Button>
        ) : null}
        <div className="absolute bottom-10 left-3 z-10 flex items-end gap-2">
          <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-card p-1 shadow-sm">
            <Rail title={zh ? '布局' : 'Layout'}>
              <HugeiconsIcon icon={Layout01Icon} size={16} strokeWidth={1.7} />
            </Rail>
            <Rail
              title={
                layoutRunning
                  ? zh
                    ? '暂停布局'
                    : 'Pause layout'
                  : zh
                    ? '运行布局'
                    : 'Run layout'
              }
              onClick={() => dynamicLayout && setLayoutRunning(!layoutRunning)}
            >
              <HugeiconsIcon
                icon={layoutRunning ? PauseIcon : PlayIcon}
                size={16}
                strokeWidth={1.7}
              />
            </Rail>
            <Rail
              title={zh ? '重置布局' : 'Reset layout'}
              onClick={() => {
                setLayoutRunning(false)
                issueControl('reset-layout')
              }}
            >
              <HugeiconsIcon icon={RefreshIcon} size={16} strokeWidth={1.7} />
            </Rail>
            <Rail
              title={zh ? '放大' : 'Zoom in'}
              onClick={() => issueControl('zoom-in')}
            >
              <HugeiconsIcon
                icon={ZoomInAreaIcon}
                size={16}
                strokeWidth={1.7}
              />
            </Rail>
            <Rail
              title={zh ? '缩小' : 'Zoom out'}
              onClick={() => issueControl('zoom-out')}
            >
              <HugeiconsIcon
                icon={ZoomOutAreaIcon}
                size={16}
                strokeWidth={1.7}
              />
            </Rail>
            <Rail
              title={zh ? '适配' : 'Fit'}
              onClick={() => issueControl('fit')}
            >
              <HugeiconsIcon
                icon={FitToScreenIcon}
                size={16}
                strokeWidth={1.7}
              />
            </Rail>
            <Rail
              title={zh ? '全屏' : 'Fullscreen'}
              onClick={() => issueControl('fullscreen')}
            >
              <HugeiconsIcon
                icon={FullScreenIcon}
                size={16}
                strokeWidth={1.7}
              />
            </Rail>
            <Rail
              title={zh ? '图例' : 'Legend'}
              onClick={() => setLegendOpen(!legendOpen)}
            >
              <HugeiconsIcon icon={Layers01Icon} size={16} strokeWidth={1.7} />
            </Rail>
            <Rail
              title={zh ? '设置' : 'Settings'}
              onClick={() => setSettingsOpen(!settingsOpen)}
            >
              <HugeiconsIcon
                icon={Settings01Icon}
                size={16}
                strokeWidth={1.7}
              />
            </Rail>
          </div>
          <ControlledSelect
            compact
            label={zh ? '图布局' : 'Graph layout'}
            value={graphLayout}
            onValueChange={(next) => {
              setLayoutRunning(false)
              setGraphLayout(next as LayoutAlgorithm)
            }}
            options={(Object.keys(layoutLabels) as LayoutAlgorithm[]).map(
              (layout) => ({ value: layout, label: layoutLabels[layout] }),
            )}
          />
        </div>
        {settingsOpen ? (
          <div className="absolute bottom-10 left-[190px] z-10 w-56 rounded-lg border border-border bg-card p-3 text-[11px] shadow-sm">
            <strong>{zh ? '图设置' : 'Graph settings'}</strong>
            <label className="mt-2 flex items-center justify-between gap-3">
              <span>{zh ? '允许拖动节点' : 'Enable node drag'}</span>
              <Checkbox
                checked={dragEnabled}
                onChange={(event) => setDragEnabled(event.target.checked)}
              />
            </label>
            <div className="mt-2 flex items-center justify-between gap-3 text-muted-foreground">
              <span>{zh ? '大图性能模式' : 'Large-graph mode'}</span>
              <span>{largeGraphPerformance ? 'ON' : 'OFF'}</span>
            </div>
          </div>
        ) : null}
        {legendOpen ? (
          <div className="absolute bottom-10 right-3 z-10 w-56 rounded-lg border border-border bg-card p-2.5 text-[11px] shadow-sm">
            <strong>{zh ? '图例' : 'Legend'}</strong>
            {semanticTypes.slice(0, 16).map((semanticType) => (
              <div
                key={semanticType}
                className="mt-1.5 flex items-center gap-2"
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: graphCategoryColor(semanticType) }}
                />
                <span className="truncate">{semanticType}</span>
              </div>
            ))}
            <LegendRow>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={13}
                strokeWidth={1.7}
              />{' '}
              Directed relation
            </LegendRow>
            <LegendRow>
              <HugeiconsIcon icon={Layers01Icon} size={13} strokeWidth={1.7} />{' '}
              Parallel edges preserved
            </LegendRow>
          </div>
        ) : null}
        {rendererError ? (
          <div
            role="alert"
            className="absolute inset-x-3 top-14 z-20 rounded-md border border-warning/40 bg-card p-3 text-xs shadow-sm"
          >
            <strong className="text-warning">
              {zh ? 'Sigma 渲染器不可用。' : 'Sigma renderer unavailable.'}
            </strong>
            <span className="ml-1 text-muted-foreground">{rendererError}</span>
          </div>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 z-10 flex h-7 items-center gap-3 overflow-hidden border-t border-border bg-card px-3 text-[10px] text-muted-foreground">
          <span>
            <strong className="text-foreground">
              {viewModel?.nodes.length ?? 0}
            </strong>{' '}
            nodes
          </span>
          <span>
            <strong className="text-foreground">
              {viewModel?.edges.length ?? 0}
            </strong>{' '}
            directed edges
          </span>
          <span>multi-edge</span>
          <span>
            {layoutLabels[graphLayout]}
            {layoutRunning ? ' · running' : ''}
          </span>
          {largeGraphPerformance ? (
            <span>{zh ? '性能模式' : 'performance mode'}</span>
          ) : null}
          <span className="truncate">
            selected:{' '}
            <strong className="text-foreground">
              {selectedNode?.label ||
                selectedEdge?.relationshipType ||
                (zh ? '无' : 'none')}
            </strong>
          </span>
          <span className="font-mono">{runtimeIdentity.graphVersion}</span>
        </div>
      </div>
    </div>
  )
}

type CompareDiff = {
  old_graph_version: string
  new_graph_version: string
  nodes?: { added?: string[]; removed?: string[]; changed?: string[] }
  edges?: { added?: string[]; removed?: string[]; changed?: string[] }
  rules?: { added?: string[]; removed?: string[]; changed?: string[] }
}

export function InspectMode({
  zh,
  run,
  runtimeIdentity,
  onRun,
  onFindingContext,
  onOpenGraph,
}: {
  zh: boolean
  run: Record<string, any> | null
  runtimeIdentity?: StudioIdentity
  onRun: (run: Record<string, any>) => void
  onFindingContext: (context: Record<string, string | null> | null) => void
  onOpenGraph: (finding: Record<string, any>) => void
}) {
  const [runId, setRunId] = useState(
    () =>
      new URLSearchParams(
        typeof window === 'undefined' ? '' : window.location.search,
      ).get('tender_run_id') ?? '',
  )
  const [fileRef, setFileRef] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selectedFinding, setSelectedFinding] = useState<Record<
    string,
    any
  > | null>(null)
  const [lineageTrace, setLineageTrace] = useState<string[]>([])
  const [artifactResult, setArtifactResult] = useState<unknown>(null)
  const [candidateDeltaRef, setCandidateDeltaRef] = useState<string | null>(
    null,
  )
  const [semanticFeedbackEventRef, setSemanticFeedbackEventRef] = useState<
    string | null
  >(null)
  const [dispositionRecorded, setDispositionRecorded] = useState(false)
  const [dispositionKind, setDispositionKind] = useState<'accept' | 'reject'>(
    'accept',
  )
  const [actionBusy, setActionBusy] = useState(false)
  const [sortKey, setSortKey] = useState<
    'decision_status' | 'detection_method' | 'semantic_relation' | 'confidence' | 'disposition'
  >('decision_status')
  const [viewerConfig, setViewerConfig] = useState<ViewerConfig>(
    VIEWER_UNAVAILABLE_CONFIG,
  )
  useEffect(() => {
    let cancelled = false
    fetch('/api/contextgraph-studio/source-evidence-viewer-config')
      .then(async (response) => {
        const payload = (await response.json()) as ViewerConfig
        if (!response.ok) throw new Error('viewer-config-unavailable')
        if (!cancelled) setViewerConfig(payload)
      })
      .catch(() => {
        if (!cancelled) setViewerConfig(VIEWER_UNAVAILABLE_CONFIG)
      })
    return () => {
      cancelled = true
    }
  }, [])
  const dispositionByFinding = useMemo(
    () =>
      Object.fromEntries(
        (run?.dispositions ?? []).map((item: Record<string, any>) => [
          item.finding_id,
          item.disposition,
        ]),
      ),
    [run?.dispositions],
  )
  const sortedFindings = useMemo(() => {
    const findings = [...(run?.findings ?? [])] as Record<string, any>[]
    return findings.sort((left, right) => {
      const leftValue =
        sortKey === 'disposition'
          ? dispositionByFinding[left.finding_id] ?? 'none'
          : left[sortKey] ?? ''
      const rightValue =
        sortKey === 'disposition'
          ? dispositionByFinding[right.finding_id] ?? 'none'
          : right[sortKey] ?? ''
      if (sortKey === 'confidence') {
        return Number(rightValue || 0) - Number(leftValue || 0)
      }
      return String(leftValue).localeCompare(String(rightValue))
    })
  }, [dispositionByFinding, run?.findings, sortKey])
  const sourceEvidenceDocumentKind = useMemo(
    () =>
      inferSourceEvidenceDocumentKind([
        run?.project_metadata?.document_kind,
        fileRef,
        run?.tender_document_id,
        run?.source_document_ref,
        run?.source_document_artifact_ref,
        run?.normalized_document_artifact_ref,
      ]),
    [
      fileRef,
      run?.project_metadata?.document_kind,
      run?.tender_document_id,
      run?.source_document_ref,
      run?.source_document_artifact_ref,
      run?.normalized_document_artifact_ref,
    ],
  )
  const selectFinding = (finding: Record<string, any>) => {
    setSelectedFinding(finding)
    onFindingContext({
      targetEvidenceRef: finding.target_evidence_ref ?? null,
      activeRuleVersionId: finding.triggered_rule_version_id ?? null,
      graphRuleId: finding.source_graph_rule_id ?? null,
      originEvidenceRef:
        finding.origin_evidence_ref ?? finding.resolver_evidence_ref ?? null,
    })
  }
  const load = async () => {
    if (!runId) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(
        `/api/tender-document-review/runs/${encodeURIComponent(runId)}`,
      )
      const payload = await response.json()
      if (!response.ok)
        throw new Error(
          String(
            payload.detail || payload.error || 'Unable to load tender run',
          ),
        )
      onRun(payload.run)
      if (payload.run.findings?.[0]) selectFinding(payload.run.findings[0])
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Unable to load tender run',
      )
    } finally {
      setBusy(false)
    }
  }
  const detect = async () => {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(TENDER_EVALUATION_DETECTION_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          buildTenderEvaluationDetectionRequest({
            fileRef,
            graphVersion: runtimeIdentity?.graphVersion,
          }),
        ),
      })
      const payload = await response.json()
      if (!response.ok)
        throw new Error(
          String(
            payload.error_code ||
              payload.detail ||
              payload.error ||
              'Detection failed',
          ),
        )
      onRun(payload.run)
      setRunId(payload.run.run_id)
      if (payload.run.findings?.[0]) selectFinding(payload.run.findings[0])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Detection failed')
    } finally {
      setBusy(false)
    }
  }
  const disposition = async (
    value: 'accepted' | 'rejected' | 'edited' | 'deferred' | 'escalated',
    justification = '',
  ) => {
    if (!run?.run_id || !selectedFinding?.finding_id) return
    const response = await fetch('/api/tender-document-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'disposition',
        runId: run.run_id,
        findingId: selectedFinding.finding_id,
        disposition: value,
        rejectionRationale: value === 'rejected' ? justification : undefined,
        editedReplacement:
          value === 'edited'
            ? justification ||
              selectedFinding.suggested_replacement ||
              selectedFinding.matched_text
            : undefined,
        justification: justification || undefined,
      }),
    })
    const payload = await response.json()
    if (response.ok) {
      onRun({
        ...run,
        dispositions: [...(run.dispositions ?? []), payload.disposition],
      })
      setCandidateDeltaRef(null)
      setSemanticFeedbackEventRef(
        payload.semantic_feedback_event?.feedback_id ?? null,
      )
      setDispositionRecorded(value === 'accepted' || value === 'rejected')
      setDispositionKind(value === 'rejected' ? 'reject' : 'accept')
    }
  }
  const traceToOrigin = async () => {
    if (!selectedFinding) return
    const refs = [
      selectedFinding.target_evidence_ref,
      selectedFinding.triggered_rule_version_id,
      selectedFinding.source_graph_release_hash,
      selectedFinding.source_graph_rule_id,
      selectedFinding.origin_evidence_ref ??
        selectedFinding.resolver_evidence_ref,
    ]
      .filter(Boolean)
      .map(String)
    setLineageTrace(refs)
  }
  const resolveGraphFocus = async (finding = selectedFinding) => {
    if (!finding || !finding.source_graph_release_hash) return
    const response = await fetch('/api/tender-document-review/graph-focus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        finding,
        accepted_release_hash: finding.source_graph_release_hash,
      }),
    })
    const payload = await response.json()
    if (!response.ok) {
      setError(String(payload.error ?? 'Graph release validation failed'))
      return
    }
    onOpenGraph(payload.focus)
  }
  const artifact = async (kind: 'report' | 'labeled-docx' | 'replay') => {
    if (!run?.run_id) return
    setActionBusy(true)
    setError('')
    try {
      const response = await fetch(
        `/api/tender-document-review/runs/${encodeURIComponent(run.run_id)}/${kind}`,
        { method: kind === 'replay' ? 'GET' : 'POST' },
      )
      const payload = await response.json()
      if (!response.ok)
        throw new Error(String(payload.error ?? `Unable to load ${kind}`))
      setArtifactResult(
        payload.report ?? payload.derivative ?? payload.bundle ?? payload,
      )
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : `Unable to load ${kind}`,
      )
    } finally {
      setActionBusy(false)
    }
  }
  const createCandidateDelta = async (kind: 'accept' | 'reject') => {
    if (!run?.run_id || !selectedFinding?.finding_id) return
    setActionBusy(true)
    setError('')
    try {
      const response = await fetch('/api/tender-document-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'feedback',
          runId: run.run_id,
          findingId: selectedFinding.finding_id,
          feedbackType:
            kind === 'accept' ? 'false_positive' : 'missing_control',
          userDisposition: { disposition: kind },
          escalationOutcome: 'not_escalated',
        }),
      })
      const payload = await response.json()
      if (!response.ok)
        throw new Error(
          String(payload.error ?? 'Unable to create candidate delta'),
        )
      setCandidateDeltaRef(
        payload.feedback?.candidateDelta?.candidate_delta_ref ??
          payload.feedback?.candidateDelta?.candidateDeltaRef ??
          null,
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to create candidate delta',
      )
    } finally {
      setActionBusy(false)
    }
  }
  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto bg-background p-4 text-xs">
      <div className="mx-auto w-full max-w-6xl space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">
            {zh ? 'Tender Inspect' : 'Tender Inspect'}
          </h2>
          <StatusPill
            tone={run?.activation_set_snapshot_id ? 'success' : 'warning'}
          >
            {run?.activation_set_snapshot_id
              ? 'activated rules'
              : 'no activated rules'}
          </StatusPill>
          <span className="text-muted-foreground">
            {run?.project_metadata?.source_graph_lineage?.[0]
              ?.source_graph_release_hash ?? 'No accepted release loaded'}
          </span>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="font-medium">
            {zh
              ? '目标 DOCX / CanonicalSourceIR'
              : 'Target DOCX / CanonicalSourceIR'}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Input
              value={fileRef}
              onChange={(e) => setFileRef(e.target.value)}
              placeholder="artifacts/document_extraction/target.json"
              data-testid="runtime-document-file-ref"
              className="h-8 min-w-[320px] flex-1 rounded-md border border-border bg-background px-2"
            />
            <StudioButton
              primary
              disabled={busy || !fileRef}
              onClick={() => void detect()}
            >
              {busy ? '…' : 'Run inspection'}
            </StudioButton>
            <Input
              value={runId}
              onChange={(e) => setRunId(e.target.value)}
              placeholder="tender_run_id"
              data-testid="runtime-document-run-id"
              className="h-8 w-48 rounded-md border border-border bg-background px-2"
            />
            <StudioButton disabled={busy || !runId} onClick={() => void load()}>
              Load
            </StudioButton>
          </div>
          {error ? (
            <div role="alert" className="mt-2 text-destructive">
              {error}
            </div>
          ) : null}
          <div className="mt-2 text-[11px] text-muted-foreground">
            Activation snapshot:{' '}
            {run?.activation_set_snapshot_id ??
              'inspection blocked until an eligible activated context exists'}{' '}
            · resolver: {run?.activation_resolver_policy_version ?? '—'}
          </div>
        </div>
        {run ? (
          <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(260px,0.8fr)_minmax(340px,1.2fr)]">
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="border-b border-border p-3 font-medium">
                Findings ({run.findings?.length ?? 0})
              </div>
              <div className="overflow-auto">
                <Table className="min-w-[760px] text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{zh ? '发现项' : 'Finding'}</TableHead>
                      {[
                        ['decision_status', zh ? '决策' : 'Decision'],
                        ['detection_method', zh ? '方法' : 'Method'],
                        ['semantic_relation', zh ? '语义关系' : 'Relation'],
                        ['confidence', zh ? '置信度' : 'Confidence'],
                        ['disposition', zh ? '人工处置' : 'Disposition'],
                      ].map(([key, label]) => (
                        <TableHead key={key}>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setSortKey(key as typeof sortKey)}
                            className="h-auto p-0 text-[10px] font-semibold uppercase tracking-[.1em] hover:bg-transparent"
                          >
                            {label}
                          </Button>
                        </TableHead>
                      ))}
                      <TableHead>{zh ? '操作' : 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedFindings.map((finding) => (
                      <TableRow
                        key={finding.finding_id}
                        aria-selected={
                          selectedFinding?.finding_id === finding.finding_id
                            ? 'true'
                            : undefined
                        }
                      >
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => selectFinding(finding)}
                            className="h-auto max-w-[220px] justify-start p-0 text-left hover:bg-transparent"
                          >
                            <span>
                              <strong className="block truncate">
                                {finding.observed_expression ??
                                  finding.matched_text}
                              </strong>
                              <span className="block truncate font-mono text-[10px] text-muted-foreground">
                                {finding.finding_id}
                              </span>
                            </span>
                          </Button>
                        </TableCell>
                        <TableCell>{finding.decision_status ?? 'candidate'}</TableCell>
                        <TableCell>{finding.detection_method ?? 'exact'}</TableCell>
                        <TableCell>{finding.semantic_relation ?? 'exact'}</TableCell>
                        <TableCell>{Number(finding.confidence ?? 0).toFixed(2)}</TableCell>
                        <TableCell>{dispositionByFinding[finding.finding_id] ?? 'none'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <StudioButton
                              disabled={!finding.source_graph_rule_id}
                              onClick={() => {
                                selectFinding(finding)
                                void resolveGraphFocus(finding)
                              }}
                            >
                              Open in Graph
                            </StudioButton>
                            <StudioButton
                              disabled={!finding.target_evidence_ref}
                              onClick={() => {
                                selectFinding(finding)
                                setLineageTrace(
                                  [
                                    finding.target_evidence_ref,
                                    finding.triggered_rule_version_id,
                                    finding.source_graph_release_hash,
                                    finding.source_graph_rule_id,
                                    finding.origin_evidence_ref ??
                                      finding.resolver_evidence_ref,
                                  ]
                                    .filter(Boolean)
                                    .map(String),
                                )
                              }}
                            >
                              Trace
                            </StudioButton>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              {selectedFinding ? (
                <>
                  <SourceEvidenceViewer
                    zh={zh}
                    documentName={run.tender_document_id ?? run.run_id}
                    documentKind={sourceEvidenceDocumentKind}
                    sourceDocumentHash={run.source_document_hash ?? null}
                    viewerConfig={viewerConfig}
                    findings={
                      (run.findings ?? []) as Array<SourceEvidenceFinding>
                    }
                    selectedFindingId={selectedFinding.finding_id}
                    onSelectFinding={(finding) =>
                      selectFinding(finding as Record<string, any>)
                    }
                    onDecision={(kind, finding, justification) => {
                      selectFinding(finding as Record<string, any>)
                      const next =
                        kind === 'confirm'
                          ? 'accepted'
                          : kind === 'change'
                            ? 'edited'
                            : 'rejected'
                      void disposition(next, justification)
                    }}
                  />
                  <div className="mt-2 grid gap-2 text-[11px]">
                    <div>
                      <MiniLabel>Judgment basis</MiniLabel>
                      {selectedFinding.judgment_basis}
                    </div>
                    <div>
                      <MiniLabel>Activated rule</MiniLabel>
                      <span className="font-mono">
                        {selectedFinding.triggered_rule_version_id ?? '—'}
                      </span>
                    </div>
                    <div>
                      <MiniLabel>Graph lineage</MiniLabel>
                      <span className="font-mono">
                        {selectedFinding.source_graph_release_hash ?? '—'} /{' '}
                        {selectedFinding.source_graph_rule_id ?? '—'}
                      </span>
                    </div>
                    <div>
                      <MiniLabel>Rationale</MiniLabel>
                      <span className="font-mono">
                        {selectedFinding.decision_context?.rationale ?? '—'}
                      </span>
                    </div>
                    <div>
                      <MiniLabel>Disposition / learning</MiniLabel>
                      <span className="font-mono">
                        {dispositionByFinding[selectedFinding.finding_id] ??
                          'none'}{' '}
                        ·{' '}
                        {selectedFinding.precedent_refs?.length
                          ? 'precedent linked'
                          : 'no precedent'}{' '}
                        · ObservedExpression candidate after accepted feedback
                      </span>
                    </div>
                    <div>
                      <MiniLabel>Remediation</MiniLabel>
                      <Textarea
                        defaultValue={
                          selectedFinding.suggested_replacement ?? ''
                        }
                        className="mt-1 min-h-20 w-full rounded border border-border bg-background p-2"
                      />
                    </div>
                  </div>
                  <LineagePanel>
                    {lineageTrace.length ? (
                      <div className="mt-3 rounded border border-border bg-muted/20 p-2 text-[10px]">
                        <MiniLabel>Finding lineage trace</MiniLabel>
                        <div className="font-mono">
                          {lineageTrace.join(' → ')}
                        </div>
                      </div>
                    ) : null}
                  </LineagePanel>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StudioButton
                      primary
                      onClick={() => void disposition('accepted')}
                    >
                      Accept
                    </StudioButton>
                    <StudioButton onClick={() => void disposition('rejected')}>
                      Reject
                    </StudioButton>
                    <StudioButton onClick={() => void disposition('edited')}>
                      Edit remediation
                    </StudioButton>
                    <StudioButton onClick={() => void disposition('deferred')}>
                      Defer
                    </StudioButton>
                    <StudioButton onClick={() => void disposition('escalated')}>
                      Escalate
                    </StudioButton>
                    <StudioButton onClick={() => void resolveGraphFocus()}>
                      Open in Graph
                    </StudioButton>
                    <StudioButton onClick={() => void traceToOrigin()}>
                      Trace to origin
                    </StudioButton>
                    <StudioButton
                      disabled={actionBusy || !run.run_id}
                      onClick={() => void artifact('report')}
                    >
                      Persist Report
                    </StudioButton>
                    <StudioButton
                      disabled={actionBusy || !run.run_id}
                      onClick={() => void artifact('labeled-docx')}
                    >
                      Generate Labeled DOCX
                    </StudioButton>
                    <StudioButton
                      disabled={actionBusy || !run.run_id}
                      onClick={() => void artifact('replay')}
                    >
                      Open Replay
                    </StudioButton>
                    {dispositionRecorded ? (
                      <StudioButton
                        disabled={actionBusy}
                        onClick={() =>
                          void createCandidateDelta(dispositionKind)
                        }
                      >
                        Create Candidate Delta
                      </StudioButton>
                    ) : null}
                  </div>
                  {candidateDeltaRef ? (
                    <div className="mt-3 rounded border border-success/30 bg-success/10 p-2 text-[11px]">
                      candidate_delta_ref:{' '}
                      <DsLink
                        className="underline"
                        href={`?mode=ground&candidate_id=${encodeURIComponent(candidateDeltaRef)}`}
                      >
                        {candidateDeltaRef}
                      </DsLink>
                    </div>
                  ) : null}
                  {semanticFeedbackEventRef ? (
                    <div className="mt-3 rounded border border-success/30 bg-success/10 p-2 text-[11px]">
                      semantic_feedback_event:{' '}
                      <span className="font-mono">
                        {semanticFeedbackEventRef}
                      </span>
                    </div>
                  ) : null}
                  {artifactResult ? (
                    <pre className="mt-3 max-h-48 overflow-auto rounded border border-border bg-muted/20 p-2 text-[10px]">
                      {JSON.stringify(artifactResult, null, 2)}
                    </pre>
                  ) : null}
                </>
              ) : (
                <div className="text-muted-foreground">
                  Select a finding to inspect exact target evidence and lineage.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function CompareMode({
  zh,
  runtimeIdentity,
  onGraph,
  onGround,
}: {
  zh: boolean
  runtimeIdentity: StudioIdentity
  onGraph: () => void
  onGround: () => void
}) {
  const baseVersion = runtimeIdentity.graphVersion
  const [oldVersion, setOldVersion] = useState(baseVersion)
  const [newVersion, setNewVersion] = useState(baseVersion)
  const [diff, setDiff] = useState<CompareDiff | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setOldVersion(baseVersion)
    setNewVersion(baseVersion)
  }, [baseVersion])

  const compare = useCallback(async () => {
    if (oldVersion === newVersion) return
    setLoading(true)
    setError(null)
    try {
      const result = await fetch(
        `${KNOWLEDGE_BUILDER_API}/graph-releases/${newVersion}/compare?base=${encodeURIComponent(oldVersion)}`,
      ).then(async (response) => {
        const payload = await response.json()
        if (!response.ok)
          throw new Error(
            String(
              payload.detail ?? payload.error ?? `compare:${response.status}`,
            ),
          )
        return payload
      })
      setDiff(result as CompareDiff)
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to compare versions',
      )
      setDiff(null)
    } finally {
      setLoading(false)
    }
  }, [oldVersion, newVersion])

  const totalChanges = diff
    ? (diff.nodes?.changed?.length ?? 0) +
      (diff.edges?.changed?.length ?? 0) +
      (diff.rules?.changed?.length ?? 0)
    : 0

  return (
    <div className="grid h-full grid-rows-[auto_auto_1fr] bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-2.5 text-xs">
        <span>V0</span>
        <Input
          aria-label="Base graph version"
          className="h-8 rounded-md border border-border bg-background px-2 font-mono"
          value={oldVersion}
          onChange={(event) => setOldVersion(event.target.value)}
        />
        <span>V1</span>
        <Input
          aria-label="New graph version"
          className="h-8 rounded-md border border-border bg-background px-2 font-mono"
          value={newVersion}
          onChange={(event) => setNewVersion(event.target.value)}
        />
        <div className="flex-1" />
        <StudioButton
          primary
          disabled={loading || oldVersion === newVersion}
          onClick={() => void compare()}
        >
          {zh ? '比较' : 'Compare'}
        </StudioButton>
      </div>
      <div className="flex flex-wrap items-center gap-5 border-b border-border px-3 py-2 text-[11px] text-muted-foreground">
        <span>
          <strong className="text-foreground">
            {diff?.nodes?.added?.length ?? 0}
          </strong>{' '}
          {zh ? '新增节点' : 'added nodes'}
        </span>
        <span>
          <strong className="text-foreground">
            {diff?.nodes?.removed?.length ?? 0}
          </strong>{' '}
          {zh ? '移除节点' : 'removed nodes'}
        </span>
        <span>
          <strong className="text-foreground">
            {diff?.edges?.changed?.length ?? 0}
          </strong>{' '}
          {zh ? '变化边' : 'changed edges'}
        </span>
        <span>
          <strong className="text-foreground">{totalChanges}</strong>{' '}
          {zh ? '总变化' : 'total changes'}
        </span>
      </div>
      <div className="grid min-h-0 place-items-center bg-card p-6 text-center text-xs text-muted-foreground">
        {error ? (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        ) : diff ? (
          <div>
            <strong className="block text-foreground">
              {zh ? '差异已加载' : 'Diff loaded'} · {diff.old_graph_version} →{' '}
              {diff.new_graph_version}
            </strong>
            <span className="mt-1 block">
              {zh
                ? '在图中打开可查看具体差异。'
                : 'Open in Graph to inspect the detailed diff.'}
            </span>
            <div className="mt-3 flex gap-2">
              <StudioButton primary onClick={onGraph}>
                {zh ? '在图中打开' : 'Open in Graph'}
              </StudioButton>
              <StudioButton onClick={onGround}>
                {zh ? '打开证据' : 'Open evidence'}
              </StudioButton>
            </div>
          </div>
        ) : (
          <span>
            {zh
              ? '选择两个已发布的版本并点击比较。'
              : 'Select two released versions and click Compare.'}
          </span>
        )}
      </div>
    </div>
  )
}

export function EvaluateMode({
  zh,
  runtimeIdentity,
}: {
  zh: boolean
  runtimeIdentity: StudioIdentity
}) {
  const mvlSummary = useContextGraphStudioStore(
    (state) => state.mvlWorkflowSummary,
  )
  const setMvlWorkflowSummary = useContextGraphStudioStore(
    (state) => state.setMvlWorkflowSummary,
  )
  const [v0RunRef, setV0RunRef] = useState(mvlSummary.v0RunRef ?? '')
  const [v1RunRef, setV1RunRef] = useState(mvlSummary.v1RunRef ?? '')
  const [gateResult, setGateResult] = useState<Record<string, any> | null>(null)
  const [gateError, setGateError] = useState<string | null>(null)
  const [gateLoading, setGateLoading] = useState(false)
  const learningDecision = gateResult?.decision ?? mvlSummary.learningDecision
  const evaluate = useCallback(async () => {
    if (!v0RunRef || !v1RunRef) return
    setGateLoading(true)
    setGateError(null)
    try {
      const response = await fetch(
        '/api/semantier-proxy/api/contextgraph/evaluation/learning-gate',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ v0_run_ref: v0RunRef, v1_run_ref: v1RunRef }),
        },
      )
      const payload = await response.json()
      if (!response.ok)
        throw new Error(
          String(
            payload.detail ?? payload.error ?? `evaluation:${response.status}`,
          ),
        )
      setGateResult(payload)
      setMvlWorkflowSummary({
        ...mvlSummary,
        v0RunRef,
        v1RunRef,
        learningDecision: payload.decision,
        evaluationRunId: v1RunRef,
      })
    } catch (error) {
      setGateResult(null)
      setGateError(
        error instanceof Error
          ? error.message
          : 'Unable to evaluate canonical runs',
      )
    } finally {
      setGateLoading(false)
    }
  }, [mvlSummary, setMvlWorkflowSummary, v0RunRef, v1RunRef])
  const decisionLabel =
    learningDecision === 'GO'
      ? 'GO'
      : learningDecision === 'STOP_REVISE'
        ? 'STOP_REVISE'
        : learningDecision === 'SPLIT_FIX'
          ? 'SPLIT_FIX'
          : zh
            ? '未计算'
            : 'Not yet computed'
  // CF-E26: GO must be qualified as a product-investment signal, not
  // graph/reasoning/governance certification.  The disclaimer surfaces
  // for every decision outcome so the user never confuses a product
  // signal with reasoning/governance certification.
  const disclaimer = zh
    ? 'GO/STOP_REVISE/SPLIT_FIX 是产品迭代投入信号，并非图谱 / 推理 / 治理认证。完整基准请打开 /evaluation。'
    : 'GO / STOP_REVISE / SPLIT_FIX is a product-investment signal, not graph / reasoning / governance certification. Open /evaluation for the full benchmark.'
  return (
    <div className="h-full overflow-auto bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-2.5 text-xs">
        <span>{zh ? '目标' : 'Target'}:</span>
        <strong>{runtimeIdentity.graphVersion}</strong>
        <span className="text-muted-foreground">
          corpus: tender-mvl · run: latest
        </span>
        <div className="flex-1" />
        <DsLink
          href="/evaluation"
          className="inline-flex h-8 items-center justify-center rounded-md border border-primary bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-blue)]"
          data-testid="evaluate-open-evaluation"
        >
          {zh ? '打开完整评估' : 'Open Evaluation'}
          <HugeiconsIcon
            icon={ArrowUpRight01Icon}
            size={14}
            strokeWidth={1.7}
            className="ml-1.5"
          />
        </DsLink>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-2.5 text-xs">
        <Input
          aria-label="V0 evaluation run"
          value={v0RunRef}
          onChange={(event) => setV0RunRef(event.target.value)}
          placeholder="V0 evaluation run ID"
          className="h-8 min-w-56 rounded-md border border-border bg-background px-2 font-mono"
        />
        <Input
          aria-label="V1 evaluation run"
          value={v1RunRef}
          onChange={(event) => setV1RunRef(event.target.value)}
          placeholder="V1 evaluation run ID"
          className="h-8 min-w-56 rounded-md border border-border bg-background px-2 font-mono"
        />
        <StudioButton
          primary
          disabled={gateLoading || !v0RunRef || !v1RunRef}
          onClick={() => void evaluate()}
        >
          {gateLoading ? '…' : zh ? '运行学习 Gate' : 'Run learning gate'}
        </StudioButton>
        {gateError ? (
          <span role="alert" className="text-destructive">
            {gateError}
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-1 border-b border-border md:grid-cols-3">
        <EvalSection
          title={zh ? '技术' : 'Technical'}
          rows={
            gateResult
              ? [
                  ['F1 delta', Number(gateResult.f1_delta).toFixed(3)],
                  [
                    'Precision delta',
                    Number(gateResult.precision_delta).toFixed(3),
                  ],
                  ['Recall delta', Number(gateResult.recall_delta).toFixed(3)],
                ]
              : []
          }
        />
        <EvalSection
          title="UX"
          rows={
            gateResult?.reviewer_minutes_delta_ratio == null
              ? []
              : [
                  [
                    'Reviewer time delta',
                    `${(Number(gateResult.reviewer_minutes_delta_ratio) * 100).toFixed(1)}%`,
                  ],
                ]
          }
        />
        <EvalSection
          title={zh ? '校准 / 证据' : 'Grounding / Evidence'}
          rows={
            gateResult
              ? [
                  ['Resolution', String(gateResult.canonical_resolution)],
                  ['Reason', String(gateResult.reason)],
                ]
              : []
          }
        />
      </div>
      <div className="border-b border-border px-3 py-3 text-xs text-muted-foreground">
        {zh
          ? '指标将从规范评估运行加载。当前页面不推断或显示浏览器提供的指标真值。'
          : 'Metrics are loaded from canonical evaluation runs. This screen never infers or displays browser-supplied metric truth.'}
      </div>
      <div className="p-4">
        <MiniLabel>
          {zh ? '失败 / 需复核 Gate' : 'Failed / review-required gates'}
        </MiniLabel>
        <Quote>
          {gateResult?.reason ??
            (zh
              ? '尚未加载规范 Gate 结果。'
              : 'Canonical gate results have not been loaded.')}
        </Quote>
      </div>
      <div className="flex flex-col gap-2 border-t border-border p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">
            {zh ? '循环决策' : 'Loop decision'}
          </div>
          <div
            data-testid="evaluate-loop-decision"
            className="text-3xl font-black"
          >
            {decisionLabel}
          </div>
        </div>
        <p
          data-testid="evaluate-decision-disclaimer"
          className="max-w-[420px] text-[11px] leading-5 text-muted-foreground"
        >
          {disclaimer}
        </p>
      </div>
    </div>
  )
}

function SourceDocument({
  zh,
  onClose,
  className = '',
  sourceLabel,
  blocks,
  loading,
  error,
}: {
  zh: boolean
  onClose?: () => void
  className?: string
  sourceLabel: string
  blocks: Array<{ block_id: string; block_type: string; content: string }>
  loading: boolean
  error: string | null
}) {
  return (
    <div className={`min-h-0 min-w-0 flex-col bg-card ${className}`}>
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-2.5 text-[11px] font-semibold">
        <span className="truncate">
          {zh ? '原始来源' : 'Original source'} · {sourceLabel}
        </span>
        {onClose ? (
          <StudioButton onClick={onClose}>{zh ? '关闭' : 'Close'}</StudioButton>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-5 text-xs leading-6 md:p-7">
        {loading ? (
          <p className="text-muted-foreground">
            {zh ? '正在加载规范来源块…' : 'Loading canonical source blocks…'}
          </p>
        ) : error ? (
          <p className="text-destructive" role="alert">
            {error}
          </p>
        ) : blocks.length === 0 ? (
          <p className="text-muted-foreground">
            {zh
              ? '当前候选未引用任何规范来源块。'
              : 'No canonical source blocks are referenced by the current candidate.'}
          </p>
        ) : (
          blocks.map((block) => (
            <div
              key={block.block_id}
              className="mb-4 border-l-2 border-border pl-3"
            >
              <div className="font-mono text-[10px] text-muted-foreground">
                {block.block_type} · {block.block_id.slice(0, 16)}…
              </div>
              <div className="mt-1 whitespace-pre-wrap text-foreground">
                {block.content || (zh ? '（空块）' : '(empty block)')}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function MiniLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-[.1em] text-muted-foreground">
      {children}
    </div>
  )
}
function Quote({
  children,
  compact = false,
}: {
  children: React.ReactNode
  compact?: boolean
}) {
  return (
    <div
      className={`rounded-r-md border-l-[3px] border-primary bg-muted/60 text-xs leading-5 ${compact ? 'px-2 py-1.5' : 'px-3 py-2.5'}`}
    >
      {children}
    </div>
  )
}
function Rail({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode
  title: string
  onClick?: () => void
}) {
  return (
    <Button
      type="button"
      title={title}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-md bg-card2 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-blue)]"
    >
      {children}
    </Button>
  )
}
function LegendRow({
  children,
  dot,
}: {
  children: React.ReactNode
  dot?: string
}) {
  return (
    <div className="mt-1.5 flex items-center gap-2">
      {dot ? <span className={`size-2.5 rounded-full ${dot}`} /> : null}
      <span>{children}</span>
    </div>
  )
}
function DiffCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-md border border-border bg-muted/45 p-3 text-xs">
      <strong>{title}</strong>
      <div className="mt-2 leading-5">{children}</div>
    </div>
  )
}
function EvalSection({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <section className="border-b border-border p-3.5 md:border-b-0 md:border-r md:last:border-r-0">
      <MiniLabel>{title}</MiniLabel>
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="grid grid-cols-[1fr_auto] gap-3 border-b border-border/70 py-2 text-xs last:border-b-0"
        >
          <span>{label}</span>
          <strong
            className={
              value === 'PASS' || value === 'improved' ? 'text-success' : ''
            }
          >
            {value}
          </strong>
        </div>
      ))}
    </section>
  )
}
