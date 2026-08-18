import { Link as DsLink } from '@/components/ui/link'

import { Checkbox, Radio } from '@/components/ui/form-controls'

import { Table } from '@/components/ui/table'

import { NativeSelect } from '@/components/ui/form-controls'

import { Textarea } from '@/components/ui/form-controls'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DialogSurface } from '@/components/ui/dialog-surface'
import { UploadDropzone } from '@/components/ui/upload-dropzone'

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  AiScanIcon,
  Alert02Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
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
import {
  projectStudioWorkbenchContext,
} from './contextgraph-workbench-context'
import { LineagePanel } from './lineage/lineage-panel'

const ContextGraphSigmaViewer = lazy(() =>
  import('./graph/contextgraph-sigma-viewer').then((module) => ({
    default: module.ContextGraphSigmaViewer,
  })),
)

type StudioMode = 'sources' | 'extract' | 'ground' | 'graph' | 'inspect' | 'compare' | 'evaluate'

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
  normalized_assertion: { subject?: { text?: string } | null; predicate?: string | null; object?: { text?: string } | null }
}

type SourceRow = [string, string, string, string, string, string]

export function canonicalBodyFromCurationMarkdown(content: string): string {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  let index = 0
  if (lines[index]?.startsWith('# ')) index += 1
  while (index < lines.length && !lines[index]?.trim()) index += 1
  while (index < lines.length && lines[index]?.trim().startsWith('>')) index += 1
  while (index < lines.length && !lines[index]?.trim()) index += 1
  return lines.slice(index).join('\n').trim()
}

const KNOWLEDGE_BUILDER_API = '/api/semantier-proxy/api/knowledge/builder'

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
  const status = result.kind === 'staged_for_ingest' ? 'Waiting for ingest' : 'Ready'
  return [name, extension, status, '—', '—', '—']
}

function sourceNameKey(name: string): string {
  return name.trim().toLocaleLowerCase().replace(/\.(docx?|pdf|md)$/i, '')
}

function StatusPill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'candidate' | 'success' | 'warning' }) {
  const toneClass =
    tone === 'candidate'
      ? 'border-warning/30 bg-warning/10 text-warning'
      : tone === 'success'
        ? 'border-success/30 bg-success/10 text-success'
        : tone === 'warning'
          ? 'border-warning/30 bg-warning/10 text-warning'
          : 'border-border bg-muted/45 text-muted-foreground'
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${toneClass}`}>{children}</span>
}

function StudioButton({ children, primary = false, className = '', onClick, title, ariaLabel, disabled = false }: { children: React.ReactNode; primary?: boolean; className?: string; onClick?: () => void; title?: string; ariaLabel?: string; disabled?: boolean }) {
  return (
    <Button
      type="button"
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 items-center justify-center rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-blue)] ${
        disabled
          ? 'cursor-not-allowed opacity-60'
          : 'cursor-pointer'
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
  const setWorkbenchContext = useKnowledgeWorkbenchStore((state) => state.setContext)
  const applyWorkbenchResult = useKnowledgeWorkbenchStore(
    (state) => state.applyWorkbenchResult,
  )

  // Presentation state is owned by the Studio store (CORE-03).
  const mode = useContextGraphStudioStore((state) => state.mode)
  const sourceOpen = useContextGraphStudioStore((state) => state.sourceOpen)
  const legendOpen = useContextGraphStudioStore((state) => state.legendOpen)
  const selectedNodeId = useContextGraphStudioStore((state) => state.selectedNodeId)
  const selectedEdgeId = useContextGraphStudioStore((state) => state.selectedEdgeId)
  const selectedEvidenceRef = useContextGraphStudioStore(
    (state) => state.selectedEvidenceRef,
  )
  const mvlSummary = useContextGraphStudioStore((state) => state.mvlWorkflowSummary)
  const setMode = useContextGraphStudioStore((state) => state.setMode)
  const setSourceOpen = useContextGraphStudioStore((state) => state.setSourceOpen)
  const setLegendOpen = useContextGraphStudioStore((state) => state.setLegendOpen)
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

  const [runtimeIdentity, setRuntimeIdentity] = useState<StudioIdentity>(EMPTY_IDENTITY)
  const [extractionRunId, setExtractionRunId] = useState<string | null>(null)
  const [candidateGraphId, setCandidateGraphId] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<GroundCandidate[]>([])
  const [inspectRun, setInspectRun] = useState<Record<string, any> | null>(null)
  const [inspectFindingContext, setInspectFindingContext] = useState<Record<string, string | null> | null>(null)
  const handleExtractionRun = useCallback((run: ExtractionRun) => {
    setExtractionRunId(run.extraction_run_id)
    setCandidateGraphId(run.candidate_graph_id ?? null)
  }, [])
  // CF-E18: surfaces a visible error when the canonical runtime path is unavailable.
  const [runtimeProjectionError, setRuntimeProjectionError] =
    useState<'http_error' | 'invalid_transport' | 'network_error' | null>(null)
  const [viewModel, setViewModel] = useState<Awaited<RuntimeFetchResult> | null>(null)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
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
          properties?: { mvlV0RunRef?: string; mvlV1RunRef?: string; mvlEvaluationRunId?: string; mvlLearningDecision?: 'GO' | 'STOP_REVISE' | 'SPLIT_FIX' }
        }
        const p = props.properties ?? {}
        if (p.mvlV0RunRef || p.mvlV1RunRef || p.mvlEvaluationRunId || p.mvlLearningDecision) {
          setMvlWorkflowSummary({
            v0RunRef: p.mvlV0RunRef ?? null,
            v1RunRef: p.mvlV1RunRef ?? null,
            evaluationRunId: p.mvlEvaluationRunId ?? null,
            learningDecision: p.mvlLearningDecision ?? null,
          })
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [invalidateSelectionForIdentity, setLastIdentity, applyLargeGraphPerformance, setMvlWorkflowSummary])

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
      selectedEvidenceRefs: selectedEvidenceRef ? [selectedEvidenceRef] : (viewModel?.ok ? (viewModel.viewModel.sourceEvidenceRefs ?? []) : []),
      selectedEvidenceRef,
      selectedNodeId,
      selectedEdgeId,
      mvlSummary,
      findingContext: inspectFindingContext ? {
        targetEvidenceRef: inspectFindingContext.targetEvidenceRef,
        activeRuleVersionId: inspectFindingContext.activeRuleVersionId,
        graphRuleId: inspectFindingContext.graphRuleId,
        originEvidenceRef: inspectFindingContext.originEvidenceRef,
      } : null,
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
      const parsed = parseKnowledgeWorkbenchResult((event as CustomEvent<unknown>).detail)
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
    window.addEventListener('semantier:knowledge-workbench-result', onWorkbenchResult)
    return () => window.removeEventListener('semantier:knowledge-workbench-result', onWorkbenchResult)
  }, [viewModel, applyWorkbenchResult, selectEdge, selectNode, setMode, setSourceOpen])

  const contextSummary = useMemo(() => {
    if (mode === 'sources') return zh ? '来源上下文已同步到右侧对话' : 'Source context synced to right chat'
    if (mode === 'extract') return zh ? '抽取运行 + 候选 + 证据已同步' : 'Extraction + candidate + evidence synced'
    if (mode === 'ground') return zh ? '候选 + EvidenceRef + 图身份已同步' : 'Candidate + EvidenceRef + graph identity synced'
    if (mode === 'graph') return zh ? '图 + 节点 + EvidenceRef + 来源已同步' : 'Graph + node + EvidenceRef + source synced'
    if (mode === 'compare') return zh ? 'V1 比较侧 + 当前断言已同步' : 'Active V1 comparison side synced'
    return zh ? '评估目标图 + runMode 已同步' : 'Evaluation target graph + runMode synced'
  }, [mode, zh])

  return (
    <main
      data-testid="contextgraph-studio"
      lang={zh ? 'zh-CN' : 'en'}
      className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background text-foreground transition-[padding] duration-200 ${chatPanelOpen ? 'min-[1200px]:pr-[420px]' : ''}`}
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3.5">
        <h1 className="shrink-0 text-sm font-semibold">{zh ? 'ContextGraph Studio / 上下文图工作台' : 'ContextGraph Studio'}</h1>
        {(runtimeIdentity.graphRef || runtimeIdentity.graphVersion || runtimeIdentity.graphHash) ? (
          <div className="hidden min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground md:flex">
            {runtimeIdentity.graphRef ? (
              <span className="max-w-[220px] truncate">{runtimeIdentity.graphRef}</span>
            ) : null}
            <StatusPill tone={runtimeIdentity.authorityState === 'authoritative' ? 'success' : 'candidate'}>{runtimeIdentity.authorityState}</StatusPill>
            <span className="font-mono">
              {runtimeIdentity.graphVersion}
              {runtimeIdentity.graphHash ? ` · ${runtimeIdentity.graphHash.slice(0, 8)}…` : null}
            </span>
          </div>
        ) : null}
        <div className="min-w-0 flex-1" />
        <span className="hidden max-w-[300px] truncate text-[10px] text-muted-foreground xl:block">{contextSummary}</span>
        <Button
          type="button"
          aria-label={chatPanelOpen ? (zh ? '关闭右侧对话面板' : 'Close right chat panel') : (zh ? '打开右侧对话面板' : 'Open right chat panel')}
          title={chatPanelOpen ? (zh ? '关闭右侧对话面板' : 'Close right chat panel') : (zh ? '打开右侧对话面板' : 'Open right chat panel')}
          onClick={() => setChatPanelOpen(!chatPanelOpen)}
          className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-blue)]"
        >
          <HugeiconsIcon icon={chatPanelOpen ? PanelRightOpenIcon : PanelRightCloseIcon} size={17} strokeWidth={1.7} />
        </Button>
      </header>

      <nav aria-label="ContextGraph Studio modes" className="flex h-10 shrink-0 items-end gap-1 overflow-x-auto border-b border-border bg-card px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(['sources', 'extract', 'ground', 'graph', 'inspect', 'compare', 'evaluate'] as const).map((item) => (
          <Button
            key={item}
            type="button"
            aria-current={mode === item ? 'page' : undefined}
            onClick={() => setMode(item)}
            className={`h-9 shrink-0 cursor-pointer border-b-2 px-2.5 text-xs transition-colors ${mode === item ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {item === 'sources' ? (zh ? '来源' : 'Sources') : item === 'extract' ? (zh ? '抽取' : 'Extract') : item === 'ground' ? (zh ? '校准' : 'Ground') : item === 'graph' ? (zh ? '图谱' : 'Graph') : item === 'inspect' ? (zh ? '检查' : 'Inspect') : item === 'compare' ? (zh ? '比较' : 'Compare') : (zh ? '评估' : 'Evaluate')}
          </Button>
        ))}
      </nav>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        {mode === 'sources' ? <SourcesMode zh={zh} onNext={() => setMode('extract')} /> : null}
        {mode === 'extract' ? <ExtractMode zh={zh} extractionRunId={extractionRunId} onRun={handleExtractionRun} onNext={() => setMode('ground')} onCandidates={setCandidates} /> : null}
        {mode === 'ground' ? <GroundMode zh={zh} extractionRunId={extractionRunId} candidateGraphId={candidateGraphId} assertionCandidates={candidates} /> : null}
        {mode === 'inspect' ? <InspectMode zh={zh} run={inspectRun} onRun={setInspectRun} onFindingContext={setInspectFindingContext} onOpenGraph={(finding) => { setMode('graph'); selectNode(finding.source_graph_rule_id ?? null) }} /> : null}
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
            highlightedNodeIds={selectedEvidenceRef && viewModel?.ok ? viewModel.viewModel.nodes.filter((node) => (node.evidenceRefs ?? []).includes(selectedEvidenceRef)).map((node) => node.id) : []}
            highlightedEdgeIds={selectedEvidenceRef && viewModel?.ok ? viewModel.viewModel.edges.filter((edge) => (edge.evidenceRefs ?? []).includes(selectedEvidenceRef)).map((edge) => edge.id) : []}
            setSelectedNodeId={selectNode}
            setSelectedEdgeId={selectEdge}
            onSelectEvidenceRef={selectEvidenceRef}
            onGround={() => setMode('ground')}
            runtimeIdentity={runtimeIdentity}
            candidateGraphId={candidateGraphId}
          />
        ) : null}
        {mode === 'compare' ? <CompareMode zh={zh} runtimeIdentity={runtimeIdentity} onGraph={() => setMode('graph')} onGround={() => setMode('ground')} /> : null}
        {mode === 'evaluate' ? <EvaluateMode zh={zh} runtimeIdentity={runtimeIdentity} /> : null}
        </div>
        {runtimeProjectionError ? (
          <div
            data-testid="contextgraph-studio-runtime-error"
            role="status"
            className="pointer-events-auto flex items-start gap-2 border-t border-warning/40 bg-warning/10 px-4 py-2 text-[11px] text-warning"
          >
            <HugeiconsIcon icon={Alert02Icon} size={14} strokeWidth={1.7} className="mt-0.5 shrink-0" />
            <div className="flex-1 leading-5">
              <strong className="font-semibold">
                {zh ? '画布没有可用的规范图：' : 'No canonical graph is available: '}
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
      </section>
    </main>
  )
}

export function SourcesMode({ zh, onNext }: { zh: boolean; onNext: () => void }) {
  const [rows, setRows] = useState<SourceRow[]>([])
  const [pendingRows, setPendingRows] = useState<SourceRow[]>([])
  const [sourcePaths, setSourcePaths] = useState<Record<string, string>>({})
  const [sourcePreview, setSourcePreview] = useState<{ name: string; content: string } | null>(null)
  const [selectedSourceNames, setSelectedSourceNames] = useState<string[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const refreshSources = useCallback(async () => {
    setStatus('loading')
    const response = await fetch('/api/knowledge/list')
    if (!response.ok) throw new Error(`sources:${response.status}`)
    const payload = (await response.json()) as {
      pages?: Array<{ name?: string; title?: string; path?: string; updatedAt?: string }>
    }
    const nextPaths: Record<string, string> = {}
    const nextRows = (payload.pages ?? []).map((page): SourceRow => {
      const name = page.title ?? page.name ?? page.path ?? 'Unnamed source'
      if (page.path) nextPaths[name] = page.path
      const extension = page.path?.split('.').pop()?.toUpperCase() || 'SOURCE'
      return [name, extension, 'Ready', '—', '—', page.updatedAt ?? '—']
    })
    // Replace rows + sourcePaths wholesale (not merge) so deleted entries do not linger
    // and we never call /api/knowledge/read with a path that no longer exists on disk.
    const persistedKeys = new Set(nextRows.map((row) => sourceNameKey(row[0])))
    setRows(nextRows)
    setPendingRows((current) => current.filter((row) => !persistedKeys.has(sourceNameKey(row[0]))))
    setSourcePaths(nextPaths)
    setStatus('ready')
  }, [])

  useEffect(() => {
    void refreshSources().catch(() => setStatus('unavailable'))
  }, [refreshSources])

  const uploadSource = useCallback(async (file: File) => {
    setUploadError(null)
    setUploading(true)
    try {
      const form = new FormData()
      form.append('files', file)
      form.append('path', 'uploads')
      form.append('ingestMode', 'extract')
      form.append('session_id', 'knowledge-builder')
      const response = await fetch('/api/knowledge/upload', { method: 'POST', body: form })
      if (!response.ok) throw new Error(`upload:${response.status}`)
      const results = (await response.json()) as KnowledgeUploadResult[]
      const failures = results.filter((result) => result.ok === false)
      const uploadedRows = results
        .map(sourceRowFromUpload)
        .filter((row): row is SourceRow => row !== null)
      if (failures.length > 0) {
        setUploadError(
          failures
            .map((result) => result.message ?? `Upload failed: ${result.originalName ?? file.name}`)
            .join('; '),
        )
      }
      if (uploadedRows.length > 0) {
        const uploadedPaths: Record<string, string> = {}
        results.forEach((result) => {
          const name = result.storedName ?? result.originalName
          const path = result.path ?? result.targetWikiPath
          if (result.ok && name && path) uploadedPaths[name] = path
        })
        setSourcePaths((current) => ({ ...current, ...uploadedPaths }))
        setPendingRows((current) => [
          ...uploadedRows.filter((candidate) => !current.some((row) => row[0] === candidate[0])),
          ...current,
        ])

        for (const result of results) {
          if (result.kind !== 'staged_for_ingest' || !result.stagedUploadRef) continue
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
          const ingestPayload = (await ingestResponse.json().catch(() => ({}))) as {
            ok?: boolean
            message?: string
            error?: string
          }
          if (!ingestResponse.ok || ingestPayload.ok === false) {
            throw new Error(ingestPayload.message ?? ingestPayload.error ?? `ingest:${ingestResponse.status}`)
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
  }, [refreshSources, zh])

  const visibleRows = [
    ...pendingRows,
    ...rows.filter((row) => !pendingRows.some((pending) => pending[0] === row[0])),
  ]

  const openSource = useCallback(async (row: SourceRow) => {
    const path = sourcePaths[row[0]]
    if (!path) {
      setUploadError(zh ? '该来源尚未生成可打开的页面。' : 'This source has no readable page yet.')
      return
    }
    try {
      const response = await fetch(`/api/knowledge/read?path=${encodeURIComponent(path)}`)
      const payload = (await response.json()) as { content?: string; error?: string }
      if (!response.ok) throw new Error(payload.error ?? `source:${response.status}`)
      setSourcePreview({ name: row[0], content: payload.content ?? '' })
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : (zh ? '无法打开来源。' : 'Unable to open source.'))
    }
  }, [sourcePaths, zh])

  const extractSource = useCallback(async (row: SourceRow) => {
    const path = sourcePaths[row[0]]
    if (!path) throw new Error(zh ? '该来源尚未生成可抽取的页面。' : 'This source has no extractable page yet.')
    const sourceResponse = await fetch(`/api/knowledge/read?path=${encodeURIComponent(path)}`)
    const sourcePayload = (await sourceResponse.json().catch(() => ({}))) as { content?: string; error?: string }
    if (!sourceResponse.ok) throw new Error(sourcePayload.error ?? `source:${sourceResponse.status}`)

    const discoveryResponse = await fetch(`${KNOWLEDGE_BUILDER_API}/discovery-runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 'knowledge_builder_discovery_run_request.v1',
        sourceKind: 'text',
        sourceRef: path,
        sourceText: canonicalBodyFromCurationMarkdown(sourcePayload.content ?? ''),
      }),
    })
    const discoveryPayload = (await discoveryResponse.json().catch(() => ({}))) as { run?: { discovery_run_id?: string; source_id?: string }; detail?: string; error?: string }
    if (!discoveryResponse.ok || !discoveryPayload.run?.discovery_run_id || !discoveryPayload.run.source_id) {
      throw new Error(discoveryPayload.detail ?? discoveryPayload.error ?? `discovery:${discoveryResponse.status}`)
    }

    const packageResponse = await fetch(`${KNOWLEDGE_BUILDER_API}/tender-packages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 'knowledge_builder_tender_package_request.v1',
        discoveryRunId: discoveryPayload.run.discovery_run_id,
        documents: [{ sourceId: discoveryPayload.run.source_id, documentId: row[0], role: 'main_tender' }],
      }),
    })
    const packagePayload = (await packageResponse.json().catch(() => ({}))) as { tenderPackage?: { package_id?: string }; detail?: string; error?: string }
    if (!packageResponse.ok || !packagePayload.tenderPackage?.package_id) {
      throw new Error(packagePayload.detail ?? packagePayload.error ?? `package:${packageResponse.status}`)
    }

    const extractionResponse = await fetch(`${KNOWLEDGE_BUILDER_API}/extraction-runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 'knowledge_builder_extraction_run_request.v1',
        discoveryRunId: discoveryPayload.run.discovery_run_id,
        tenderPackageId: packagePayload.tenderPackage.package_id,
        sourceKind: 'text',
        sourceRef: path,
        sourceText: sourcePayload.content ?? '',
        documentId: row[0],
        provider: 'semantica',
        profile: 'tender_sensitive_v1',
      }),
    })
    const extractionPayload = (await extractionResponse.json().catch(() => ({}))) as { detail?: string; error?: string }
    if (!extractionResponse.ok) throw new Error(extractionPayload.detail ?? extractionPayload.error ?? `extraction:${extractionResponse.status}`)
  }, [sourcePaths, zh])

  const runBatchExtraction = useCallback(async () => {
    const selectedRows = visibleRows.filter((row) => selectedSourceNames.includes(row[0]))
    if (selectedRows.length === 0) return
    setExtracting(true)
    setUploadError(null)
    try {
      for (const row of selectedRows) await extractSource(row)
      setSelectedSourceNames([])
      onNext()
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : (zh ? '无法抽取来源。' : 'Unable to extract source.'))
    } finally {
      setExtracting(false)
    }
  }, [extractSource, onNext, selectedSourceNames, visibleRows, zh])

  const deleteSource = useCallback(async (row: SourceRow) => {
    const path = sourcePaths[row[0]]
    if (!path) {
      setUploadError(zh ? '该来源尚未生成可删除的页面。' : 'This source has no deletable page yet.')
      return
    }
    if (!window.confirm(zh ? `删除来源“${row[0]}”？` : `Delete source “${row[0]}”?`)) return
    // Optimistic update: remove the row from local state FIRST so the table refreshes immediately.
    // If the API call fails we restore the row and surface the error.
    const restoreRow = row
    setUploadError(null)
    setPendingRows((current) => current.filter((candidate) => candidate[0] !== row[0]))
    setRows((current) => current.filter((candidate) => candidate[0] !== row[0]))
    setSourcePaths((current) => {
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
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(payload.error ?? `delete:${response.status}`)
      // Re-sync with the server so the row stays gone even if the listing API returns a stale entry.
      await refreshSources().catch(() => {
        /* refresh failure shouldn't re-show the deleted file */
      })
    } catch (error) {
      // Restore the row so the user can retry, and surface the error message.
      setRows((current) => (current.some((candidate) => candidate[0] === restoreRow[0]) ? current : [restoreRow, ...current]))
      setSourcePaths((current) => (current[restoreRow[0]] ? current : { ...current, [restoreRow[0]]: path }))
      setUploadError(error instanceof Error ? error.message : (zh ? '无法删除来源。' : 'Unable to delete source.'))
    }
  }, [refreshSources, sourcePaths, zh])

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void uploadSource(file)
  }, [uploadSource])

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    if (file) void uploadSource(file)
  }, [uploadSource])

  const browseFiles = useCallback(() => fileInputRef.current?.click(), [])

  return (
    <div className="grid h-full grid-rows-[auto_auto_1fr_auto] bg-card">
      <div className="flex items-center gap-2 border-b border-border p-2.5">
        <Input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc" data-testid="source-file-input" className="hidden" onChange={handleFileChange} />
        <UploadDropzone
          onClick={browseFiles}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          className="flex min-h-10 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 text-xs text-muted-foreground hover:border-primary hover:bg-muted/30"
        >
          <HugeiconsIcon icon={FileUploadIcon} size={16} strokeWidth={1.6} />
          <span>{zh ? '拖入 PDF/DOCX，或浏览文件' : 'Drop PDF/DOCX here or browse files'}</span>
          {uploadError ? <span className="text-red-600">{uploadError}</span> : null}
        </UploadDropzone>
        <StudioButton primary onClick={browseFiles} disabled={uploading}>
          <HugeiconsIcon icon={FileUploadIcon} size={15} strokeWidth={1.7} className="mr-1.5" />
          {uploading ? (zh ? '正在上传…' : 'Uploading…') : (zh ? '上传来源' : 'Upload source')}
        </StudioButton>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-2.5"><Input placeholder={zh ? '搜索来源…' : 'Search sources…'} className="min-w-[220px] flex-1 md:max-w-[340px]" /><NativeSelect className="h-8 rounded-md border border-border bg-background px-2 text-xs"><option>{zh ? '全部状态' : 'All status'}</option></NativeSelect><div className="flex-1" /><StudioButton onClick={() => { void refreshSources().catch(() => setStatus('unavailable')) }}>{zh ? '刷新' : 'Refresh'}</StudioButton></div>
      <div className="min-h-0 overflow-auto">
        <Table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-muted text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="w-10 border-b border-border px-3 py-2.5" aria-label={zh ? '选择来源' : 'Select source'} />{[zh ? '文件 / 来源' : 'File / Source', zh ? '类型' : 'Type', zh ? '状态' : 'Status', zh ? '候选' : 'Candidates', zh ? '问题' : 'Issues', zh ? '最后运行' : 'Last run', zh ? '操作' : 'Actions'].map((h) => <th key={h} className="border-b border-border px-3 py-2.5 text-left font-semibold">{h}</th>)}</tr></thead>
          <tbody>{visibleRows.map((row, index) => <tr key={row[0]} className={index === 0 ? 'bg-primary/10' : 'hover:bg-muted/40'}><td className="border-b border-border px-3 py-3"><Checkbox checked={selectedSourceNames.includes(row[0])} onChange={() => setSelectedSourceNames((current) => current.includes(row[0]) ? current.filter((name) => name !== row[0]) : [...current, row[0]])} aria-label={zh ? `选择 ${row[0]}` : `Select ${row[0]}`} /></td>{row.map((value, i) => <td key={`${row[0]}-${i}`} className="border-b border-border px-3 py-3">{i === 0 ? <><strong>{value}</strong><div className="mt-0.5 font-mono text-[10px] text-muted-foreground">source_identity_ref</div></> : value}</td>)}<td className="border-b border-border px-3 py-3"><div className="flex items-center gap-1"><StudioButton className="size-8 p-0" onClick={() => void openSource(row)} disabled={!sourcePaths[row[0]] || extracting} title={zh ? '查看来源' : 'View source'} ariaLabel={zh ? '查看来源' : `View ${row[0]}`}><HugeiconsIcon icon={ViewIcon} size={15} strokeWidth={1.7} /></StudioButton><StudioButton className="size-8 p-0" onClick={() => { setExtracting(true); void extractSource(row).then(onNext).catch((error) => setUploadError(error instanceof Error ? error.message : 'Unable to extract source.')).finally(() => setExtracting(false)) }} disabled={!sourcePaths[row[0]] || extracting} title={zh ? '抽取来源' : 'Extract source'} ariaLabel={zh ? '抽取来源' : `Extract ${row[0]}`}><HugeiconsIcon icon={AiScanIcon} size={15} strokeWidth={1.7} /></StudioButton><StudioButton className="size-8 p-0 text-destructive" onClick={() => void deleteSource(row)} disabled={!sourcePaths[row[0]] || extracting} title={zh ? '删除来源' : 'Delete source'} ariaLabel={zh ? '删除来源' : `Delete ${row[0]}`}><HugeiconsIcon icon={Delete02Icon} size={15} strokeWidth={1.7} /></StudioButton></div></td></tr>)}{visibleRows.length === 0 && status === 'loading' ? <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">{zh ? '正在加载来源…' : 'Loading sources…'}</td></tr> : null}{visibleRows.length === 0 && status === 'unavailable' ? <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">{zh ? '来源 API 尚未启用' : 'Sources API is not enabled yet'}</td></tr> : null}</tbody>
        </Table>
      </div>
      {sourcePreview ? <DialogSurface aria-label={zh ? '来源预览' : 'Source preview'} onDismiss={() => setSourcePreview(null)} className="fixed inset-4 z-30 flex min-h-0 flex-col rounded-lg border border-border bg-card p-4 shadow-lg"><div className="flex items-center justify-between border-b border-border pb-2 text-xs font-semibold"><span>{sourcePreview.name}</span><StudioButton onClick={() => setSourcePreview(null)}>{zh ? '关闭' : 'Close'}</StudioButton></div><pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap py-3 text-xs leading-5">{sourcePreview.content}</pre></DialogSurface> : null}
      <div className="flex min-h-10 items-center gap-3 border-t border-border py-1 pl-3 pr-20 text-[11px] text-muted-foreground">
        <span>
          {zh ? '已选' : 'Selected'}: <strong className="text-foreground">{visibleRows[0]?.[0] ?? '—'}</strong>
        </span>
        <span className="font-mono">source_identity_ref · {visibleRows[0]?.[1] ?? '—'}</span>
        <span>AnyDoc structured</span>
        <span>
          <strong className="text-foreground">{rows[0]?.[4] ?? '0'}</strong> {zh ? '未解决' : 'unresolved'}
        </span>
        <div className="flex-1" />
        <StudioButton primary onClick={() => void runBatchExtraction()} disabled={selectedSourceNames.length === 0 || extracting} title={zh ? '批量抽取' : 'Batch extract'}>
          <HugeiconsIcon icon={AiScanIcon} size={14} strokeWidth={1.7} className="mr-1.5" />
          {extracting ? (zh ? '正在抽取…' : 'Extracting…') : (zh ? '批量抽取' : 'Batch extract')}
        </StudioButton>
      </div>
    </div>
  )
}

export function ExtractMode({ zh, extractionRunId, onRun, onNext, onCandidates }: { zh: boolean; extractionRunId: string | null; onRun: (run: ExtractionRun) => void; onNext: () => void; onCandidates?: (next: GroundCandidate[]) => void }) {
  const [runs, setRuns] = useState<ExtractionRun[]>([])
  const [candidates, setCandidates] = useState<AssertionCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const runsResponse = await fetch(`${KNOWLEDGE_BUILDER_API}/extraction-runs?limit=20`)
        if (!runsResponse.ok) throw new Error(`runs request failed (${runsResponse.status})`)
        const runsPayload = (await runsResponse.json()) as { extractionRuns?: ExtractionRun[] }
        const nextRuns = runsPayload.extractionRuns ?? []
        const latest = nextRuns[0]
        if (latest) {
          const candidatesResponse = await fetch(`${KNOWLEDGE_BUILDER_API}/assertion-candidates?extractionRunId=${encodeURIComponent(latest.extraction_run_id)}`)
          if (!candidatesResponse.ok) throw new Error(`candidate request failed (${candidatesResponse.status})`)
          const candidatePayload = (await candidatesResponse.json()) as { assertionCandidates?: AssertionCandidate[] }
          if (!cancelled) {
            const nextCandidates = candidatePayload.assertionCandidates ?? []
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
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load extraction runs')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [onCandidates, onRun])

  const selectedRun = runs.find((run) => run.extraction_run_id === extractionRunId) ?? runs[0]
  const labelFor = (candidate: AssertionCandidate) => candidate.normalized_assertion.subject?.text ?? candidate.normalized_assertion.object?.text ?? candidate.normalized_assertion.predicate ?? candidate.assertion_id
  return (
    <div className="grid h-full grid-rows-[auto_auto_1fr] bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-2.5 text-xs"><span className="text-muted-foreground">{zh ? '最近运行' : 'Latest run'}:</span><strong className="font-mono">{selectedRun?.extraction_run_id ?? (zh ? '暂无运行' : 'No extraction run')}</strong><StatusPill tone={selectedRun?.run_status === 'failed' ? 'warning' : selectedRun?.run_status === 'completed' ? 'success' : 'neutral'}>{selectedRun?.run_status ?? 'idle'}</StatusPill><span className="text-muted-foreground">{selectedRun?.provider_ref ?? 'semantica'}</span><div className="flex-1" /><StudioButton primary disabled={!selectedRun || selectedRun.run_status !== 'completed'} onClick={onNext}>{zh ? '校准候选' : 'Ground candidates'}</StudioButton></div>
      {selectedRun?.run_status === 'failed' ? <div role="alert" className="border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"><strong>{zh ? '抽取失败' : 'Extraction failed'}:</strong> {selectedRun.failure_reason ?? selectedRun.warnings[0] ?? (zh ? '提供方未返回原因' : 'provider did not return a reason')}</div> : null}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border px-3 py-2 text-[11px] text-muted-foreground"><span><strong className="text-foreground">{loading ? '…' : candidates.length}</strong> {zh ? '候选' : 'candidates'}</span><span>{selectedRun?.profile_ref ?? 'tender_sensitive_v1'}</span><div className="flex-1" /><Input placeholder={zh ? '搜索候选…' : 'Search candidates…'} /></div>
      <div className="grid min-h-0 grid-cols-1 md:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-h-0 overflow-auto border-r border-border">
          <Table className="w-full border-collapse text-xs"><thead className="sticky top-0 bg-muted text-[10px] uppercase tracking-wide text-muted-foreground"><tr>{[zh ? '候选 / 值' : 'Candidate / value', zh ? '置信度' : 'Confidence', zh ? '证据' : 'Evidence', zh ? '状态' : 'State'].map((h) => <th key={h} className="border-b border-border px-3 py-2.5 text-left">{h}</th>)}</tr></thead><tbody>{error ? <tr><td colSpan={4} className="p-4 text-destructive">{error}</td></tr> : candidates.map((candidate, index) => <tr key={candidate.assertion_id} className={index === 0 ? 'bg-primary/10' : 'hover:bg-muted/40'}><td className="border-b border-border px-3 py-3"><strong>{labelFor(candidate)}</strong><div className="font-mono text-[10px] text-muted-foreground">{candidate.assertion_id}</div></td><td className="border-b border-border px-3 py-3">{candidate.confidence.toFixed(2)}</td><td className="border-b border-border px-3 py-3">{candidate.evidence_refs?.length ?? 0}</td><td className="border-b border-border px-3 py-3">{candidate.grounding_state}</td></tr>)}</tbody></Table>
        </div>
        <aside className="hidden min-h-0 overflow-auto bg-card p-4 md:block"><h2 className="text-sm font-semibold">{selectedRun?.candidate_graph_id ?? (zh ? '候选图待运行' : 'Candidate graph pending')}</h2><div className="mt-2 flex gap-1.5"><StatusPill>{selectedRun?.provider_ref ?? 'semantica'}</StatusPill><StatusPill>{candidates[0]?.evidence_refs?.length ?? 0} evidence</StatusPill></div><MiniLabel>{zh ? '状态' : 'Run state'}</MiniLabel><p className="text-xs text-muted-foreground">{selectedRun?.run_status ?? 'idle'} · {selectedRun?.extraction_run_id ?? '—'}</p><MiniLabel>{zh ? '规范证据' : 'Canonical evidence'}</MiniLabel><div className="font-mono text-[10px] text-muted-foreground">{candidates[0]?.evidence_refs?.map((ref) => `${ref.evidence_ref} · ${ref.selector_hash}`).join('\n') ?? (zh ? '暂无证据' : 'No evidence')}</div></aside>
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
  normalized_assertion: { subject?: { text?: string } | null; predicate?: string | null; object?: { text?: string } | null }
  extraction_run_id?: string
}

type GroundDetail = {
  assertionCandidate: {
    assertion_id: string
    candidate_graph_id: string
    confidence: number
    grounding_state: string
    source_anchors: Array<{ anchor_id: string; exact_text?: string }>
  } | null
  learningEvents: Array<{ event_id: string; event_type: string; actor_ref: string | null; event_hash: string; occurred_at?: string }>
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
}: {
  zh: boolean
  extractionRunId: string | null
  candidateGraphId: string | null
  assertionCandidates: GroundCandidate[]
}) {
  const [pending, setPending] = useState<GroundCandidate[]>(
    assertionCandidates.filter((candidate) => candidate.grounding_state !== 'grounded'),
  )
  const [index, setIndex] = useState(0)
  const [detail, setDetail] = useState<GroundDetail | null>(null)
  const [run, setRun] = useState<Record<string, unknown> | null>(null)
  const [preview, setPreview] = useState<GroundPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewStale, setPreviewStale] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionPending, setActionPending] = useState(false)
  const [regroundOpen, setRegroundOpen] = useState(false)
  const [regroundBlockId, setRegroundBlockId] = useState('')
  const [acceptedRelease, setAcceptedRelease] = useState<Record<string, any> | null>(null)
  const [activationProjection, setActivationProjection] = useState<Record<string, any> | null>(null)

  const current = pending[index] ?? null

  useEffect(() => {
    setPending(assertionCandidates.filter((candidate) => candidate.grounding_state !== 'grounded'))
  }, [assertionCandidates])

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
        const [detailRes, previewRes, runRes] = await Promise.all([
          fetch(`${KNOWLEDGE_BUILDER_API}/assertion-candidates/${current.assertion_id}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`detail:${r.status}`)))),
          fetch(`${KNOWLEDGE_BUILDER_API}/assertion-candidates/${current.assertion_id}/graph-delta-preview`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`preview:${r.status}`)))),
          current.extraction_run_id
            ? fetch(`${KNOWLEDGE_BUILDER_API}/extraction-runs/${current.extraction_run_id}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`run:${r.status}`))))
            : Promise.resolve(null),
        ])
        if (cancelled) return
        setDetail(detailRes as GroundDetail)
        setPreview(previewRes as GroundPreview)
        if (runRes) setRun((runRes as { extractionRun?: Record<string, unknown> }).extractionRun ?? null)
      } catch (error) {
        if (cancelled) return
        setActionError(error instanceof Error ? error.message : 'Unable to load candidate')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [current?.assertion_id, current?.extraction_run_id])

  const refreshPreview = useCallback(async () => {
    if (!current) return
    setPreviewLoading(true)
    setPreviewStale(false)
    try {
      const next = await fetch(
        `${KNOWLEDGE_BUILDER_API}/assertion-candidates/${current.assertion_id}/graph-delta-preview`,
      ).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`preview:${r.status}`))))
      setPreview(next as GroundPreview)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to reload preview')
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
          justification: 'Reviewer decision recorded against the canonical source evidence.',
        }
        if (preview?.available && preview.previewHash && (decision === 'accept' || decision === 'edit')) {
          body.evidenceAnchorRefs = preview.evidenceAnchorRefs
          body.graphDelta = preview.graphDelta
          body.graphDeltaPreviewHash = preview.previewHash
        }
        if (decision === 'edit' && editedAssertion) {
          body.editedAssertion = editedAssertion
        }
        const result = await fetch(
          `${KNOWLEDGE_BUILDER_API}/assertion-candidates/${current.assertion_id}/grounding-events`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          },
        ).then(async (r) => ({ ok: r.ok, status: r.status, payload: await r.json().catch(() => ({})) }))
        if (!result.ok) {
          const detail = (result.payload as { detail?: string }).detail ?? `grounding:${result.status}`
          if (/stale/i.test(detail)) setPreviewStale(true)
          throw new Error(detail)
        }
        const learningEventId = (result.payload as { learningEvent?: { event_id?: string } }).learningEvent?.event_id
        if (decision === 'accept' && learningEventId) {
          const releasePayload = await fetch(
            `${KNOWLEDGE_BUILDER_API}/assertion-candidates/${current.assertion_id}/release`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                schemaVersion: 'accepted_graph_release_request.v1',
                humanEventId: learningEventId,
              }),
            },
          ).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`release:${r.status}`)))) as { graphRelease?: Record<string, any> }
          setAcceptedRelease(releasePayload.graphRelease ?? null)
          setActivationProjection(null)
          // R7-09: accepted release creation is separate from activation.
          // Learning-gate outcomes must never mutate the active snapshot.
        }
        setPending((candidates) => candidates.filter((candidate) => candidate.assertion_id !== current.assertion_id))
        setIndex(0)
      } catch (error) {
        setActionError(error instanceof Error ? error.message : 'Unable to record decision')
      } finally {
        setActionPending(false)
      }
    },
    [current?.assertion_id, preview],
  )

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
      if (!response.ok) throw new Error(String(payload.detail ?? `activation:${response.status}`))
      setActivationProjection(payload.projection ?? null)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to activate release')
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
      if (!evidenceRef) throw new Error('No canonical EvidenceRef bound to this candidate')
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
            structuralPath: [`block:paragraph`, `localContentHash:${regroundBlockId}`],
            sourceElementRef: regroundBlockId,
          },
          sourceBlockId: regroundBlockId,
        } satisfies Partial<GroundRegroundPayload>),
      }).then(async (r) => ({ ok: r.ok, status: r.status, payload: await r.json().catch(() => ({})) }))
      setRegroundOpen(false)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to reground')
    } finally {
      setActionPending(false)
    }
  }, [current, regroundBlockId])

  if (!current) {
    return (
      <div className="grid h-full place-items-center bg-card text-xs text-muted-foreground">
        {zh ? '当前抽取运行下没有待校准的候选。' : 'No pending candidates under the current extraction run.'}
      </div>
    )
  }

  const sourceBlocks = (detail?.assertionCandidate?.source_anchors ?? []).map((anchor) => ({
    block_id: anchor.anchor_id,
    block_type: 'source-anchor',
    content: anchor.exact_text ?? '',
  }))
  const label = detail?.assertionCandidate?.confidence !== undefined
    ? `${(detail.assertionCandidate.confidence * 100).toFixed(0)}% confidence`
    : ''

  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto] bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-2.5 text-xs">
        <strong>{zh ? '待校准' : 'Pending'} {pending.length}</strong>
        <span className="font-mono text-[10px] text-muted-foreground">{current.assertion_id}</span>
        <div className="flex-1" />
        <Button
          type="button"
          aria-label={zh ? '上一条' : 'Previous'}
          className="inline-flex h-8 items-center gap-1.5 px-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-blue)]"
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={15} strokeWidth={1.7} />
          {zh ? '上一条' : 'Previous'}
        </Button>
        <span className="min-w-[52px] text-center text-[11px] text-muted-foreground">
          {index + 1} / {pending.length}
        </span>
        <Button
          type="button"
          aria-label={zh ? '下一条' : 'Next'}
          className="inline-flex h-8 items-center gap-1.5 px-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-blue)]"
          onClick={() => setIndex((value) => Math.min(pending.length - 1, value + 1))}
        >
          {zh ? '下一条' : 'Next'}
          <HugeiconsIcon icon={ArrowRight01Icon} size={15} strokeWidth={1.7} />
        </Button>
      </div>
      <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[minmax(320px,.95fr)_minmax(340px,1.05fr)]">
        <SourceDocument
          zh={zh}
          className="hidden border-r border-border lg:flex"
          sourceLabel={run?.['source_identity_ref'] as string ?? current.assertion_id}
          blocks={sourceBlocks}
          loading={!detail && !actionError}
          error={actionError}
        />
        <div className="min-h-0 overflow-auto p-4 lg:p-5">
          <h2 className="text-lg font-semibold">
            {current.normalized_assertion.subject?.text ?? current.normalized_assertion.predicate ?? current.assertion_id}
          </h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusPill>{current.grounding_state}</StatusPill>
            {label ? <StatusPill>{label}</StatusPill> : null}
            <StatusPill tone="candidate">{candidateGraphId ?? '—'}</StatusPill>
            {preview?.available && preview.previewHash ? (
              <StatusPill tone="success">{zh ? '预览就绪' : 'Preview ready'}</StatusPill>
            ) : preview?.reason ? (
              <StatusPill tone="warning">{preview.reason}</StatusPill>
            ) : null}
          </div>
          <MiniLabel>{zh ? '证据' : 'Evidence'}</MiniLabel>
          <p className="font-mono text-[10px] text-muted-foreground">
            {(detail?.assertionCandidate?.source_anchors ?? []).map((a) => a.anchor_id).join('\n') || (zh ? '暂无证据' : 'No evidence yet')}
          </p>
          <MiniLabel>{zh ? '预览 hash' : 'Preview hash'}</MiniLabel>
          <div className="flex items-center gap-2">
            <code className="font-mono text-[10px] text-muted-foreground">
              {preview?.previewHash ?? (zh ? '尚无预览' : 'No preview yet')}
            </code>
            {previewLoading ? (
              <span className="text-[10px] text-muted-foreground">{zh ? '加载中…' : 'Loading…'}</span>
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
            <div role="alert" className="mt-2 rounded border border-warning/40 bg-warning/10 px-2 py-1 text-[11px] text-warning">
              {zh ? '预览已陈旧，请重新加载后再提交。' : 'Preview is stale; reload before submitting.'}
            </div>
          ) : null}
          <MiniLabel>Human Grounding</MiniLabel>
          <div className="flex flex-wrap gap-2">
            <StudioButton primary disabled={actionPending} onClick={() => void submitGrounding('accept')}>
              {zh ? '接受' : 'Accept'}
            </StudioButton>
            <StudioButton disabled={actionPending} onClick={() => void submitGrounding('edit', { subject_text: current.normalized_assertion.subject?.text ?? '' })}>
              {zh ? '编辑' : 'Edit'}
            </StudioButton>
            <StudioButton disabled={actionPending} className="text-destructive" onClick={() => void submitGrounding('reject')}>
              {zh ? '拒绝' : 'Reject'}
            </StudioButton>
            <StudioButton disabled={actionPending} onClick={() => void submitGrounding('uncertain')}>
              {zh ? '不确定' : 'Uncertain'}
            </StudioButton>
            <StudioButton disabled={actionPending} onClick={() => setRegroundOpen((open) => !open)}>
              {zh ? '重新定位' : 'Reground'}
            </StudioButton>
          </div>
          {acceptedRelease ? (
            <div className="mt-3 rounded border border-success/30 bg-success/10 p-2 text-[11px]" data-testid="ground-accepted-release">
              <div>AcceptedGraphRelease: <span className="font-mono">{acceptedRelease.graph_version}</span></div>
              {activationProjection ? (
                <div data-testid="ground-activation-snapshot">Activation snapshot: <span className="font-mono">{activationProjection.activation_set_snapshot_id ?? activationProjection.activationSetSnapshotId ?? 'activated'}</span></div>
              ) : (
                <StudioButton primary disabled={actionPending} onClick={() => void activateRelease()}>{zh ? '激活发布版本' : 'Activate release'}</StudioButton>
              )}
            </div>
          ) : null}
          {regroundOpen ? (
            <div className="mt-2 rounded border border-border bg-muted/40 p-2 text-[11px]">
              <label className="flex flex-col gap-1">
                <span>{zh ? '目标 source_block_id' : 'Target source_block_id'}</span>
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
              <li key={event.event_id} className="font-mono text-[10px] text-muted-foreground">
                {event.occurred_at ?? ''} · {event.event_type} · {event.actor_ref ?? '—'} · {event.event_hash.slice(0, 12)}…
              </li>
            ))}
            {(detail?.learningEvents ?? []).length === 0 ? (
              <li className="text-xs text-muted-foreground">
                {zh ? '尚无人工决策；写入前会对固定来源进行服务端重新校验。' : 'No prior human decision; the pinned source is revalidated server-side before write.'}
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

export function GraphMode({ zh, sourceOpen, setSourceOpen, legendOpen, setLegendOpen, viewModel, selectedNodeId, selectedEdgeId, highlightedNodeIds, highlightedEdgeIds, setSelectedNodeId, setSelectedEdgeId, onSelectEvidenceRef, onGround, runtimeIdentity, candidateGraphId }: { zh: boolean; sourceOpen: boolean; setSourceOpen: (open: boolean) => void; legendOpen: boolean; setLegendOpen: (open: boolean) => void; viewModel: GraphViewModel | null; selectedNodeId: string | null; selectedEdgeId: string | null; highlightedNodeIds: string[]; highlightedEdgeIds: string[]; setSelectedNodeId: (id: string | null) => void; setSelectedEdgeId: (id: string | null) => void; onSelectEvidenceRef: (id: string | null) => void; onGround: () => void; runtimeIdentity: StudioIdentity; candidateGraphId: string | null }) {
  const graphSearch = useContextGraphStudioStore((state) => state.graphSearch)
  const graphLayout = useContextGraphStudioStore((state) => state.graphLayout)
  const layoutRunning = useContextGraphStudioStore((state) => state.layoutRunning)
  const settingsOpen = useContextGraphStudioStore((state) => state.settingsOpen)
  const dragEnabled = useContextGraphStudioStore((state) => state.dragEnabled)
  const largeGraphPerformance = useContextGraphStudioStore((state) => state.largeGraphPerformance)
  const setGraphSearch = useContextGraphStudioStore((state) => state.setGraphSearch)
  const setGraphLayout = useContextGraphStudioStore((state) => state.setGraphLayout)
  const setLayoutRunning = useContextGraphStudioStore((state) => state.setLayoutRunning)
  const setSettingsOpen = useContextGraphStudioStore((state) => state.setSettingsOpen)
  const setDragEnabled = useContextGraphStudioStore((state) => state.setDragEnabled)
  const setCameraIntent = useContextGraphStudioStore((state) => state.setCameraIntent)
  const [rendererError, setRendererError] = useState<string | null>(null)
  const [controlCommand, setControlCommand] = useState<{ id: number; type: 'zoom-in' | 'zoom-out' | 'fit' | 'fullscreen' | 'reset-layout' } | null>(null)
  const selected = resolveValidSelection(viewModel, selectedNodeId, selectedEdgeId)
  const selectedNode = selected.node
  const selectedEdge = selected.edge
  const selectedSourceAnchors = selectedNode?.sourceAnchors ?? selectedEdge?.sourceAnchors ?? []
  const selectedEvidenceRefs = selectedNode?.evidenceRefs ?? selectedEdge?.evidenceRefs ?? []
  const selectedEvidenceDetails = selectedNode?.evidenceRefDetails ?? selectedEdge?.evidenceRefDetails ?? []
  const sourceBlocks = selectedSourceAnchors.map((anchor, index) => ({
    block_id: `${anchor.sourceRef}:${anchor.locator}:${index}`,
    block_type: anchor.locator,
    content: anchor.quote ?? '',
  }))
  const openEvidence = async () => {
    const ref = selectedEvidenceRefs[0]
    if (!ref) return
    onSelectEvidenceRef(ref)
    const detail = selectedEvidenceDetails.find((item) => item.evidenceRef === ref || item.evidence_ref === ref)
    const response = await resolveEvidenceRef(ref, detail)
    if (!response.ok) return
    setSourceOpen(true)
  }
  const semanticTypes = [...new Set((viewModel?.nodes ?? []).map((node) => node.semanticType ?? 'unknown'))].sort()
  const dynamicLayout = graphLayout === 'force-atlas' || graphLayout === 'force-directed'
  const layoutLabels: Record<LayoutAlgorithm, string> = { circular: 'Circular', circlepack: 'Circlepack', random: 'Random', noverlaps: 'Noverlaps', 'force-directed': 'Force Directed', 'force-atlas': 'Force Atlas' }
  const issueControl = (type: 'zoom-in' | 'zoom-out' | 'fit' | 'fullscreen' | 'reset-layout') => setControlCommand((previous) => ({ id: (previous?.id ?? 0) + 1, type }))
  return (
    <div className={`grid h-full min-h-0 transition-[grid-template-columns] duration-200 ${sourceOpen ? 'min-[1200px]:grid-cols-[minmax(260px,31%)_minmax(0,1fr)]' : 'grid-cols-[0_minmax(0,1fr)]'}`}>
      <div className={`min-h-0 min-w-0 overflow-hidden border-r border-border bg-card ${sourceOpen ? 'max-[1199px]:absolute max-[1199px]:inset-y-0 max-[1199px]:left-0 max-[1199px]:z-20 max-[1199px]:w-[min(420px,88vw)] max-[1199px]:shadow-sm' : 'pointer-events-none opacity-0'}`}><SourceDocument zh={zh} onClose={() => setSourceOpen(false)} className="flex h-full" sourceLabel={runtimeIdentity.graphRef} blocks={sourceBlocks} loading={false} error={null} /></div>
      <div className="relative min-h-0 min-w-0 overflow-hidden bg-background">
        {viewModel ? (
          <Suspense fallback={<div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">{zh ? '正在加载 Sigma 图渲染器…' : 'Loading Sigma graph renderer…'}</div>}>
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
              <strong className="block text-foreground">{zh ? '没有可渲染的规范图快照' : 'No canonical graph snapshot available'}</strong>
              <span className="mt-1 block">{zh ? 'Studio 不会用 SVG 或推测数据静默替代规范图。' : 'Studio will not silently substitute SVG or guessed graph data.'}</span>
            </div>
          </div>
        )}
        <div className="absolute left-3 top-3 z-10 flex w-[min(340px,calc(100%_-_24px))] items-center gap-1.5 rounded-md border border-border bg-card px-2 shadow-sm">
          <HugeiconsIcon icon={Search01Icon} size={15} strokeWidth={1.7} className="shrink-0 text-muted-foreground" />
          <Input
            value={graphSearch}
            onChange={(event) => setGraphSearch(event.target.value)}
            placeholder={zh ? '搜索标签或规范 ID…' : 'Search label or canonical ID…'}
            className="h-8 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
        </div>
        {!sourceOpen ? (
          <Button type="button" onClick={() => setSourceOpen(true)} className="absolute left-3 top-[54px] z-10 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] shadow-sm">
            <HugeiconsIcon icon={FileViewIcon} size={14} strokeWidth={1.7} />
            {zh ? '来源证据' : 'Source evidence'}
          </Button>
        ) : null}
        {selectedNode || selectedEdge ? <aside aria-label="Graph lineage inspector" className="absolute right-3 top-3 z-10 hidden w-[min(320px,calc(100%_-_24px))] max-h-[58%] overflow-auto rounded-lg border border-border bg-card p-3 shadow-sm md:block"><h2 className="text-sm font-semibold">{selectedNode?.label || selectedEdge?.relationshipType || (zh ? '图选择' : 'Graph selection')}</h2><div className="mt-1.5 flex flex-wrap gap-1.5"><StatusPill>{selectedNode ? selectedNode.semanticType : selectedEdge?.relationshipType}</StatusPill><StatusPill tone="candidate">{runtimeIdentity.authorityState}</StatusPill></div><MiniLabel>Graph identity</MiniLabel><div className="break-all font-mono text-[10px]">{viewModel?.graphRef} · {viewModel?.graphVersion}</div><MiniLabel>Lineage</MiniLabel><div className="space-y-1 text-[10px] text-muted-foreground"><div>SourceIdentity: {(selectedNode?.lineage?.sourceIdentityRefs ?? selectedEdge?.lineage?.sourceIdentityRefs ?? []).join(', ') || '—'}</div><div>ExtractionRun: {selectedNode?.lineage?.extractionRunRef ?? selectedEdge?.lineage?.extractionRunRef ?? '—'}</div><div>Candidate: {selectedNode?.lineage?.candidateGraphId ?? selectedEdge?.lineage?.candidateGraphId ?? '—'}</div><div>Accepted release: {selectedNode?.lineage?.acceptedReleaseId ?? selectedEdge?.lineage?.acceptedReleaseId ?? '—'} · {selectedNode?.lineage?.acceptedReleaseVersion ?? selectedEdge?.lineage?.acceptedReleaseVersion ?? '—'}</div></div><MiniLabel>Canonical ID</MiniLabel><div className="break-all font-mono text-[10px]">{selectedNode?.id || selectedEdge?.id}</div>{selectedEdge ? <><MiniLabel>{zh ? '方向' : 'Direction'}</MiniLabel><div className="font-mono text-[10px]">{selectedEdge.sourceId} → {selectedEdge.targetId}</div></> : null}<MiniLabel>{zh ? '校准状态' : 'Grounding'}</MiniLabel><div className="text-xs">{selectedNode?.groundingState || selectedEdge?.groundingState || 'pending'}</div><MiniLabel>EvidenceRef</MiniLabel><div className="text-xs text-muted-foreground">{selectedEvidenceRefs.length > 0 ? selectedEvidenceRefs.join(', ') : (zh ? '当前图对象未携带规范 EvidenceRef。' : 'No canonical EvidenceRef is attached to this graph object.')}</div><div className="mt-3 flex gap-2"><StudioButton primary onClick={() => void openEvidence()}>{zh ? '打开证据' : 'Open evidence'}</StudioButton><StudioButton onClick={onGround}>{zh ? '校准' : 'Ground'}</StudioButton></div></aside> : null}
        <div className="absolute bottom-10 left-3 z-10 flex items-end gap-2">
          <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-card p-1 shadow-sm">
            <Rail title={zh ? '布局' : 'Layout'}><HugeiconsIcon icon={Layout01Icon} size={16} strokeWidth={1.7} /></Rail>
            <Rail title={layoutRunning ? (zh ? '暂停布局' : 'Pause layout') : (zh ? '运行布局' : 'Run layout')} onClick={() => dynamicLayout && setLayoutRunning(!layoutRunning)}><HugeiconsIcon icon={layoutRunning ? PauseIcon : PlayIcon} size={16} strokeWidth={1.7} /></Rail>
            <Rail title={zh ? '重置布局' : 'Reset layout'} onClick={() => { setLayoutRunning(false); issueControl('reset-layout') }}><HugeiconsIcon icon={RefreshIcon} size={16} strokeWidth={1.7} /></Rail>
            <Rail title={zh ? '放大' : 'Zoom in'} onClick={() => issueControl('zoom-in')}><HugeiconsIcon icon={ZoomInAreaIcon} size={16} strokeWidth={1.7} /></Rail>
            <Rail title={zh ? '缩小' : 'Zoom out'} onClick={() => issueControl('zoom-out')}><HugeiconsIcon icon={ZoomOutAreaIcon} size={16} strokeWidth={1.7} /></Rail>
            <Rail title={zh ? '适配' : 'Fit'} onClick={() => issueControl('fit')}><HugeiconsIcon icon={FitToScreenIcon} size={16} strokeWidth={1.7} /></Rail>
            <Rail title={zh ? '全屏' : 'Fullscreen'} onClick={() => issueControl('fullscreen')}><HugeiconsIcon icon={FullScreenIcon} size={16} strokeWidth={1.7} /></Rail>
            <Rail title={zh ? '图例' : 'Legend'} onClick={() => setLegendOpen(!legendOpen)}><HugeiconsIcon icon={Layers01Icon} size={16} strokeWidth={1.7} /></Rail>
            <Rail title={zh ? '设置' : 'Settings'} onClick={() => setSettingsOpen(!settingsOpen)}><HugeiconsIcon icon={Settings01Icon} size={16} strokeWidth={1.7} /></Rail>
          </div>
          <NativeSelect aria-label={zh ? '图布局' : 'Graph layout'} value={graphLayout} onChange={(event) => { const next = event.target.value as LayoutAlgorithm; setLayoutRunning(false); setGraphLayout(next) }} className="h-8 rounded-md border border-border bg-card px-2 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-blue)]">
            {(Object.keys(layoutLabels) as LayoutAlgorithm[]).map((layout) => <option key={layout} value={layout}>{layoutLabels[layout]}</option>)}
          </NativeSelect>
        </div>
        {settingsOpen ? <div className="absolute bottom-10 left-[190px] z-10 w-56 rounded-lg border border-border bg-card p-3 text-[11px] shadow-sm"><strong>{zh ? '图设置' : 'Graph settings'}</strong><label className="mt-2 flex items-center justify-between gap-3"><span>{zh ? '允许拖动节点' : 'Enable node drag'}</span><Checkbox checked={dragEnabled} onChange={(event) => setDragEnabled(event.target.checked)} /></label><div className="mt-2 flex items-center justify-between gap-3 text-muted-foreground"><span>{zh ? '大图性能模式' : 'Large-graph mode'}</span><span>{largeGraphPerformance ? 'ON' : 'OFF'}</span></div></div> : null}
        {legendOpen ? <div className="absolute bottom-10 right-3 z-10 w-56 rounded-lg border border-border bg-card p-2.5 text-[11px] shadow-sm"><strong>{zh ? '图例' : 'Legend'}</strong>{semanticTypes.slice(0, 16).map((semanticType) => <div key={semanticType} className="mt-1.5 flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ backgroundColor: graphCategoryColor(semanticType) }} /><span className="truncate">{semanticType}</span></div>)}<LegendRow><HugeiconsIcon icon={ArrowRight01Icon} size={13} strokeWidth={1.7} /> Directed relation</LegendRow><LegendRow><HugeiconsIcon icon={Layers01Icon} size={13} strokeWidth={1.7} /> Parallel edges preserved</LegendRow></div> : null}
        {rendererError ? <div role="alert" className="absolute inset-x-3 top-14 z-20 rounded-md border border-warning/40 bg-card p-3 text-xs shadow-sm"><strong className="text-warning">{zh ? 'Sigma 渲染器不可用。' : 'Sigma renderer unavailable.'}</strong><span className="ml-1 text-muted-foreground">{rendererError}</span></div> : null}
        <div className="absolute inset-x-0 bottom-0 z-10 flex h-7 items-center gap-3 overflow-hidden border-t border-border bg-card px-3 text-[10px] text-muted-foreground"><span><strong className="text-foreground">{viewModel?.nodes.length ?? 0}</strong> nodes</span><span><strong className="text-foreground">{viewModel?.edges.length ?? 0}</strong> directed edges</span><span>multi-edge</span><span>{layoutLabels[graphLayout]}{layoutRunning ? ' · running' : ''}</span>{largeGraphPerformance ? <span>{zh ? '性能模式' : 'performance mode'}</span> : null}<span className="truncate">selected: <strong className="text-foreground">{selectedNode?.label || selectedEdge?.relationshipType || (zh ? '无' : 'none')}</strong></span><span className="font-mono">{runtimeIdentity.graphVersion}</span></div>
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

export function InspectMode({ zh, run, onRun, onFindingContext, onOpenGraph }: { zh: boolean; run: Record<string, any> | null; onRun: (run: Record<string, any>) => void; onFindingContext: (context: Record<string, string | null> | null) => void; onOpenGraph: (finding: Record<string, any>) => void }) {
  const [runId, setRunId] = useState(() => new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search).get('tender_run_id') ?? '')
  const [fileRef, setFileRef] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selectedFinding, setSelectedFinding] = useState<Record<string, any> | null>(null)
  const [lineageTrace, setLineageTrace] = useState<string[]>([])
  const [artifactResult, setArtifactResult] = useState<unknown>(null)
  const [candidateDeltaRef, setCandidateDeltaRef] = useState<string | null>(null)
  const [dispositionRecorded, setDispositionRecorded] = useState(false)
  const [dispositionKind, setDispositionKind] = useState<'accept' | 'reject'>('accept')
  const [actionBusy, setActionBusy] = useState(false)
  const selectFinding = (finding: Record<string, any>) => {
    setSelectedFinding(finding)
    onFindingContext({
      targetEvidenceRef: finding.target_evidence_ref ?? null,
      activeRuleVersionId: finding.triggered_rule_version_id ?? null,
      graphRuleId: finding.source_graph_rule_id ?? null,
      originEvidenceRef: finding.origin_evidence_ref ?? finding.resolver_evidence_ref ?? null,
    })
  }
  const load = async () => {
    if (!runId) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/tender-document-review/runs/${encodeURIComponent(runId)}`)
      const payload = await response.json()
      if (!response.ok) throw new Error(String(payload.detail || payload.error || 'Unable to load tender run'))
      onRun(payload.run); if (payload.run.findings?.[0]) selectFinding(payload.run.findings[0])
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load tender run') } finally { setBusy(false) }
  }
  const detect = async () => {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/tender-document-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'detect', fileRef, sessionId: 'knowledge-builder', requestedRuleFamilies: ['tender_compliance'] }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(String(payload.detail || payload.error || 'Detection failed'))
      onRun(payload.run); setRunId(payload.run.run_id); if (payload.run.findings?.[0]) selectFinding(payload.run.findings[0])
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Detection failed') } finally { setBusy(false) }
  }
  const disposition = async (value: 'accepted' | 'rejected' | 'edited' | 'deferred' | 'escalated') => {
    if (!run?.run_id || !selectedFinding?.finding_id) return
    const response = await fetch('/api/tender-document-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disposition', runId: run.run_id, findingId: selectedFinding.finding_id, disposition: value }) })
    const payload = await response.json()
    if (response.ok) { onRun({ ...run, dispositions: [...(run.dispositions ?? []), payload.disposition] }); setCandidateDeltaRef(null); setDispositionRecorded(value === 'accepted' || value === 'rejected'); setDispositionKind(value === 'rejected' ? 'reject' : 'accept') }
  }
  const traceToOrigin = async () => {
    if (!selectedFinding) return
    const refs = [selectedFinding.target_evidence_ref, selectedFinding.triggered_rule_version_id, selectedFinding.source_graph_release_hash, selectedFinding.source_graph_rule_id, selectedFinding.origin_evidence_ref ?? selectedFinding.resolver_evidence_ref].filter(Boolean).map(String)
    setLineageTrace(refs)
  }
  const resolveGraphFocus = async (finding = selectedFinding) => {
    if (!finding || !finding.source_graph_release_hash) return
    const response = await fetch('/api/tender-document-review/graph-focus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ finding, accepted_release_hash: finding.source_graph_release_hash }) })
    const payload = await response.json()
    if (!response.ok) { setError(String(payload.error ?? 'Graph release validation failed')); return }
      onOpenGraph(payload.focus)
  }
  const artifact = async (kind: 'report' | 'labeled-docx' | 'replay') => {
    if (!run?.run_id) return
    setActionBusy(true); setError('')
    try {
      const response = await fetch(`/api/tender-document-review/runs/${encodeURIComponent(run.run_id)}/${kind}`, { method: kind === 'replay' ? 'GET' : 'POST' })
      const payload = await response.json()
      if (!response.ok) throw new Error(String(payload.error ?? `Unable to load ${kind}`))
      setArtifactResult(payload.report ?? payload.derivative ?? payload.bundle ?? payload)
    } catch (cause) { setError(cause instanceof Error ? cause.message : `Unable to load ${kind}`) } finally { setActionBusy(false) }
  }
  const createCandidateDelta = async (kind: 'accept' | 'reject') => {
    if (!run?.run_id || !selectedFinding?.finding_id) return
    setActionBusy(true); setError('')
    try {
      const response = await fetch('/api/tender-document-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'feedback', runId: run.run_id, findingId: selectedFinding.finding_id, feedbackType: kind === 'accept' ? 'false_positive' : 'missing_control', userDisposition: { disposition: kind }, escalationOutcome: 'not_escalated' }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(String(payload.error ?? 'Unable to create candidate delta'))
      setCandidateDeltaRef(payload.feedback?.candidateDelta?.candidate_delta_ref ?? payload.feedback?.candidateDelta?.candidateDeltaRef ?? null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to create candidate delta') } finally { setActionBusy(false) }
  }
  return <div className="flex h-full min-h-0 flex-col overflow-auto bg-background p-4 text-xs">
    <div className="mx-auto w-full max-w-6xl space-y-3">
      <div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold">{zh ? 'Tender Inspect' : 'Tender Inspect'}</h2><StatusPill tone={run?.activation_set_snapshot_id ? 'success' : 'warning'}>{run?.activation_set_snapshot_id ? 'activated rules' : 'no activated rules'}</StatusPill><span className="text-muted-foreground">{run?.project_metadata?.source_graph_lineage?.[0]?.source_graph_release_hash ?? 'No accepted release loaded'}</span></div>
      <div className="rounded-lg border border-border bg-card p-3"><div className="font-medium">{zh ? '目标 DOCX / CanonicalSourceIR' : 'Target DOCX / CanonicalSourceIR'}</div><div className="mt-2 flex flex-wrap gap-2"><Input value={fileRef} onChange={e => setFileRef(e.target.value)} placeholder="artifacts/document_extraction/target.json" className="h-8 min-w-[320px] flex-1 rounded-md border border-border bg-background px-2" /><StudioButton primary disabled={busy || !fileRef} onClick={() => void detect()}>{busy ? '…' : 'Run inspection'}</StudioButton><Input value={runId} onChange={e => setRunId(e.target.value)} placeholder="tender_run_id" className="h-8 w-48 rounded-md border border-border bg-background px-2" /><StudioButton disabled={busy || !runId} onClick={() => void load()}>Load</StudioButton></div>{error ? <div role="alert" className="mt-2 text-destructive">{error}</div> : null}<div className="mt-2 text-[11px] text-muted-foreground">Activation snapshot: {run?.activation_set_snapshot_id ?? 'inspection blocked until an eligible activated context exists'} · resolver: {run?.activation_resolver_policy_version ?? '—'}</div></div>
      {run ? <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(260px,0.8fr)_minmax(340px,1.2fr)]"><div className="rounded-lg border border-border bg-card"><div className="border-b border-border p-3 font-medium">Findings ({run.findings?.length ?? 0})</div>{(run.findings ?? []).map((finding: Record<string, any>) => <div key={finding.finding_id} className={`border-b border-border p-3 hover:bg-muted/40 ${selectedFinding?.finding_id === finding.finding_id ? 'bg-primary/10' : ''}`}><Button type="button" onClick={() => selectFinding(finding)} className="block w-full text-left"><div className="flex justify-between gap-2"><strong>{finding.issue_type}</strong><StatusPill tone={finding.severity === 'high' ? 'warning' : 'neutral'}>{finding.severity}</StatusPill></div><div className="mt-1 font-mono text-[11px]">{finding.matched_text}</div><div className="mt-1 text-muted-foreground">{finding.target_evidence_ref ?? 'no target EvidenceRef'}</div></Button><div className="mt-2 flex gap-1"><StudioButton disabled={!finding.source_graph_rule_id} onClick={() => { selectFinding(finding); void resolveGraphFocus(finding) }}>Open in Graph</StudioButton><StudioButton disabled={!finding.target_evidence_ref} onClick={() => { selectFinding(finding); setLineageTrace([finding.target_evidence_ref, finding.triggered_rule_version_id, finding.source_graph_release_hash, finding.source_graph_rule_id, finding.origin_evidence_ref ?? finding.resolver_evidence_ref].filter(Boolean).map(String)) }}>Trace to origin</StudioButton></div></div>)}</div><div className="rounded-lg border border-border bg-card p-3">{selectedFinding ? <><h3 className="font-semibold">{selectedFinding.matched_text}</h3><div className="mt-2 grid gap-2 text-[11px]"><div><MiniLabel>Judgment basis</MiniLabel>{selectedFinding.judgment_basis}</div><div><MiniLabel>Target EvidenceRef / anchor</MiniLabel><span className="font-mono">{selectedFinding.target_evidence_ref ?? '—'} · {selectedFinding.target_anchor_ref ?? '—'}</span></div><div><MiniLabel>Activated rule</MiniLabel><span className="font-mono">{selectedFinding.triggered_rule_version_id ?? '—'}</span></div><div><MiniLabel>Graph lineage</MiniLabel><span className="font-mono">{selectedFinding.source_graph_release_hash ?? '—'} / {selectedFinding.source_graph_rule_id ?? '—'}</span></div><div><MiniLabel>Remediation</MiniLabel><Textarea defaultValue={selectedFinding.suggested_replacement ?? ''} className="mt-1 min-h-20 w-full rounded border border-border bg-background p-2" /></div></div><LineagePanel>{lineageTrace.length ? <div className="mt-3 rounded border border-border bg-muted/20 p-2 text-[10px]"><MiniLabel>Finding lineage trace</MiniLabel><div className="font-mono">{lineageTrace.join(' → ')}</div></div> : null}</LineagePanel><div className="mt-3 flex flex-wrap gap-2"><StudioButton primary onClick={() => void disposition('accepted')}>Accept</StudioButton><StudioButton onClick={() => void disposition('rejected')}>Reject</StudioButton><StudioButton onClick={() => void disposition('edited')}>Edit remediation</StudioButton><StudioButton onClick={() => void disposition('deferred')}>Defer</StudioButton><StudioButton onClick={() => void disposition('escalated')}>Escalate</StudioButton><StudioButton onClick={() => void resolveGraphFocus()}>Open in Graph</StudioButton><StudioButton onClick={() => void traceToOrigin()}>Trace to origin</StudioButton><StudioButton disabled={actionBusy || !run.run_id} onClick={() => void artifact('report')}>Persist Report</StudioButton><StudioButton disabled={actionBusy || !run.run_id} onClick={() => void artifact('labeled-docx')}>Generate Labeled DOCX</StudioButton><StudioButton disabled={actionBusy || !run.run_id} onClick={() => void artifact('replay')}>Open Replay</StudioButton>{dispositionRecorded ? <StudioButton disabled={actionBusy} onClick={() => void createCandidateDelta(dispositionKind)}>Create Candidate Delta</StudioButton> : null}</div>{candidateDeltaRef ? <div className="mt-3 rounded border border-success/30 bg-success/10 p-2 text-[11px]">candidate_delta_ref: <DsLink className="underline" href={`?mode=ground&candidate_id=${encodeURIComponent(candidateDeltaRef)}`}>{candidateDeltaRef}</DsLink></div> : null}{artifactResult ? <pre className="mt-3 max-h-48 overflow-auto rounded border border-border bg-muted/20 p-2 text-[10px]">{JSON.stringify(artifactResult, null, 2)}</pre> : null}</> : <div className="text-muted-foreground">Select a finding to inspect exact target evidence and lineage.</div>}</div></div> : null}
    </div></div>
}

export function CompareMode({ zh, runtimeIdentity, onGraph, onGround }: { zh: boolean; runtimeIdentity: StudioIdentity; onGraph: () => void; onGround: () => void }) {
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
        if (!response.ok) throw new Error(String(payload.detail ?? payload.error ?? `compare:${response.status}`))
        return payload
      })
      setDiff(result as CompareDiff)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to compare versions')
      setDiff(null)
    } finally {
      setLoading(false)
    }
  }, [oldVersion, newVersion])

  const totalChanges = diff
    ? (diff.nodes?.changed?.length ?? 0) + (diff.edges?.changed?.length ?? 0) + (diff.rules?.changed?.length ?? 0)
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
        <StudioButton primary disabled={loading || oldVersion === newVersion} onClick={() => void compare()}>
          {zh ? '比较' : 'Compare'}
        </StudioButton>
      </div>
      <div className="flex flex-wrap items-center gap-5 border-b border-border px-3 py-2 text-[11px] text-muted-foreground">
        <span>
          <strong className="text-foreground">{diff?.nodes?.added?.length ?? 0}</strong> {zh ? '新增节点' : 'added nodes'}
        </span>
        <span>
          <strong className="text-foreground">{diff?.nodes?.removed?.length ?? 0}</strong> {zh ? '移除节点' : 'removed nodes'}
        </span>
        <span>
          <strong className="text-foreground">{diff?.edges?.changed?.length ?? 0}</strong> {zh ? '变化边' : 'changed edges'}
        </span>
        <span>
          <strong className="text-foreground">{totalChanges}</strong> {zh ? '总变化' : 'total changes'}
        </span>
      </div>
      <div className="grid min-h-0 place-items-center bg-card p-6 text-center text-xs text-muted-foreground">
        {error ? (
          <p role="alert" className="text-destructive">{error}</p>
        ) : diff ? (
          <div>
            <strong className="block text-foreground">
              {zh ? '差异已加载' : 'Diff loaded'} · {diff.old_graph_version} → {diff.new_graph_version}
            </strong>
            <span className="mt-1 block">
              {zh ? '在图中打开可查看具体差异。' : 'Open in Graph to inspect the detailed diff.'}
            </span>
            <div className="mt-3 flex gap-2">
              <StudioButton primary onClick={onGraph}>{zh ? '在图中打开' : 'Open in Graph'}</StudioButton>
              <StudioButton onClick={onGround}>{zh ? '打开证据' : 'Open evidence'}</StudioButton>
            </div>
          </div>
        ) : (
          <span>{zh ? '选择两个已发布的版本并点击比较。' : 'Select two released versions and click Compare.'}</span>
        )}
      </div>
    </div>
  )
}

export function EvaluateMode({ zh, runtimeIdentity }: { zh: boolean; runtimeIdentity: StudioIdentity }) {
  const mvlSummary = useContextGraphStudioStore((state) => state.mvlWorkflowSummary)
  const setMvlWorkflowSummary = useContextGraphStudioStore((state) => state.setMvlWorkflowSummary)
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
      const response = await fetch('/api/semantier-proxy/api/contextgraph/evaluation/learning-gate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ v0_run_ref: v0RunRef, v1_run_ref: v1RunRef }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(String(payload.detail ?? payload.error ?? `evaluation:${response.status}`))
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
      setGateError(error instanceof Error ? error.message : 'Unable to evaluate canonical runs')
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
        <span className="text-muted-foreground">corpus: tender-mvl · run: latest</span>
        <div className="flex-1" />
        <DsLink
          href="/evaluation"
          className="inline-flex h-8 items-center justify-center rounded-md border border-primary bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-blue)]"
          data-testid="evaluate-open-evaluation"
        >
          {zh ? '打开完整评估' : 'Open Evaluation'}
          <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} strokeWidth={1.7} className="ml-1.5" />
        </DsLink>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-2.5 text-xs">
        <Input aria-label="V0 evaluation run" value={v0RunRef} onChange={(event) => setV0RunRef(event.target.value)} placeholder="V0 evaluation run ID" className="h-8 min-w-56 rounded-md border border-border bg-background px-2 font-mono" />
        <Input aria-label="V1 evaluation run" value={v1RunRef} onChange={(event) => setV1RunRef(event.target.value)} placeholder="V1 evaluation run ID" className="h-8 min-w-56 rounded-md border border-border bg-background px-2 font-mono" />
        <StudioButton primary disabled={gateLoading || !v0RunRef || !v1RunRef} onClick={() => void evaluate()}>{gateLoading ? '…' : (zh ? '运行学习 Gate' : 'Run learning gate')}</StudioButton>
        {gateError ? <span role="alert" className="text-destructive">{gateError}</span> : null}
      </div>
      <div className="grid grid-cols-1 border-b border-border md:grid-cols-3">
        <EvalSection title={zh ? '技术' : 'Technical'} rows={gateResult ? [['F1 delta', Number(gateResult.f1_delta).toFixed(3)], ['Precision delta', Number(gateResult.precision_delta).toFixed(3)], ['Recall delta', Number(gateResult.recall_delta).toFixed(3)]] : []} />
        <EvalSection title="UX" rows={gateResult?.reviewer_minutes_delta_ratio == null ? [] : [['Reviewer time delta', `${(Number(gateResult.reviewer_minutes_delta_ratio) * 100).toFixed(1)}%`]]} />
        <EvalSection title={zh ? '校准 / 证据' : 'Grounding / Evidence'} rows={gateResult ? [['Resolution', String(gateResult.canonical_resolution)], ['Reason', String(gateResult.reason)]] : []} />
      </div>
      <div className="border-b border-border px-3 py-3 text-xs text-muted-foreground">
        {zh ? '指标将从规范评估运行加载。当前页面不推断或显示浏览器提供的指标真值。' : 'Metrics are loaded from canonical evaluation runs. This screen never infers or displays browser-supplied metric truth.'}
      </div>
      <div className="p-4">
        <MiniLabel>{zh ? '失败 / 需复核 Gate' : 'Failed / review-required gates'}</MiniLabel>
          <Quote>{gateResult?.reason ?? (zh ? '尚未加载规范 Gate 结果。' : 'Canonical gate results have not been loaded.')}</Quote>
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
        <span className="truncate">{zh ? '原始来源' : 'Original source'} · {sourceLabel}</span>
        {onClose ? (
          <StudioButton onClick={onClose}>{zh ? '关闭' : 'Close'}</StudioButton>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-5 text-xs leading-6 md:p-7">
        {loading ? (
          <p className="text-muted-foreground">{zh ? '正在加载规范来源块…' : 'Loading canonical source blocks…'}</p>
        ) : error ? (
          <p className="text-destructive" role="alert">{error}</p>
        ) : blocks.length === 0 ? (
          <p className="text-muted-foreground">{zh ? '当前候选未引用任何规范来源块。' : 'No canonical source blocks are referenced by the current candidate.'}</p>
        ) : (
          blocks.map((block) => (
            <div key={block.block_id} className="mb-4 border-l-2 border-border pl-3">
              <div className="font-mono text-[10px] text-muted-foreground">{block.block_type} · {block.block_id.slice(0, 16)}…</div>
              <div className="mt-1 whitespace-pre-wrap text-foreground">{block.content || (zh ? '（空块）' : '(empty block)')}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function MiniLabel({ children }: { children: React.ReactNode }) { return <div className="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-[.1em] text-muted-foreground">{children}</div> }
function Quote({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) { return <div className={`rounded-r-md border-l-[3px] border-primary bg-muted/60 text-xs leading-5 ${compact ? 'px-2 py-1.5' : 'px-3 py-2.5'}`}>{children}</div> }
function Rail({ children, title, onClick }: { children: React.ReactNode; title: string; onClick?: () => void }) { return <Button type="button" title={title} onClick={onClick} className="grid size-8 place-items-center rounded-md text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-blue)]">{children}</Button> }
function LegendRow({ children, dot }: { children: React.ReactNode; dot?: string }) { return <div className="mt-1.5 flex items-center gap-2">{dot ? <span className={`size-2.5 rounded-full ${dot}`} /> : null}<span>{children}</span></div> }
function DiffCard({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-md border border-border bg-muted/45 p-3 text-xs"><strong>{title}</strong><div className="mt-2 leading-5">{children}</div></div> }
function EvalSection({ title, rows }: { title: string; rows: string[][] }) { return <section className="border-b border-border p-3.5 md:border-b-0 md:border-r md:last:border-r-0"><MiniLabel>{title}</MiniLabel>{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[1fr_auto] gap-3 border-b border-border/70 py-2 text-xs last:border-b-0"><span>{label}</span><strong className={value === 'PASS' || value === 'improved' ? 'text-success' : ''}>{value}</strong></div>)}</section> }
