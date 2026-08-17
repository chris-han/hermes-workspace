import { useEffect, useMemo, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
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
} from '@hugeicons/core-free-icons'

import { useSettingsStore } from '@/hooks/use-settings'
import { parseKnowledgeWorkbenchResult } from '@/lib/knowledge-workbench-result'
import { useKnowledgeWorkbenchStore } from '@/stores/knowledge-workbench-store'
import { useWorkspaceStore } from '@/stores/workspace-store'

type StudioMode = 'sources' | 'extract' | 'ground' | 'graph' | 'compare' | 'evaluate'

type RuntimeIdentity = {
  graphRef: string
  graphVersion: string
  graphHash: string
  authorityState: 'candidate' | 'authoritative'
  semanticaCommit: string | null
}

type StudioNode = {
  id: string
  label: string
  kind: 'concept' | 'rule' | 'policy'
  x: number
  y: number
}

const SOURCE_REF = 'studio-source-poc-sensitive-terms'
const EXTRACTION_RUN = 'studio-extraction-run-v1'
const EVIDENCE_REF_ID = 'studio-evidence-table-enterprise-threshold'

const GRAPH_NODE_COLORS: Record<StudioNode['kind'], string> = {
  concept: '#91AD70',
  rule: '#9fe870',
  policy: '#c4b19f',
}

const GRAPH_EDGE_COLORS = {
  requires: '#669542',
  exception: '#a89482',
  derived: '#91AD70',
}

const FALLBACK_IDENTITY: RuntimeIdentity = {
  graphRef: 'contextgraph-studio-design-preview',
  graphVersion: 'graph_v12',
  graphHash: 'design-preview-a93f2c1',
  authorityState: 'candidate',
  semanticaCommit: null,
}

const nodes: StudioNode[] = [
  { id: 'rule-enterprise-scale-threshold', label: '企业规模门槛', kind: 'rule', x: 330, y: 335 },
  { id: 'concept-industry-leader', label: '行业龙头企业', kind: 'concept', x: 710, y: 335 },
  { id: 'concept-large-enterprise', label: '大型企业', kind: 'concept', x: 205, y: 555 },
  { id: 'concept-china-500', label: '中国500强', kind: 'concept', x: 855, y: 550 },
  { id: 'policy-procurement-qualification', label: '采购资格限制', kind: 'policy', x: 995, y: 315 },
]

const sourceRows = [
  ['POC敏感词汇总.docx', 'DOCX', 'Ready', '124', '3', '21:14'],
  ['招标文件A.pdf', 'PDF', 'Processing', '—', '—', 'now'],
  ['招标文件B.pdf', 'PDF', 'Failed', '—', '—', '20:51'],
  ['测试文件-03.docx', 'DOCX', 'Ready', '87', '0', '20:35'],
] as const

const candidates = [
  ['企业规模门槛', 'rule', '0.82', '2', 'exact'],
  ['大型企业', 'concept', '0.94', '2', 'exact'],
  ['央企', 'concept', '0.91', '1', 'exact'],
  ['行业龙头企业', 'rule', '0.72', '1', 'ambiguous'],
  ['世界500强', 'concept', '0.88', '1', 'exact'],
] as const

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

function StudioButton({ children, primary = false, className = '', onClick, title }: { children: React.ReactNode; primary?: boolean; className?: string; onClick?: () => void; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex h-8 items-center justify-center rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-blue)] ${
        primary
          ? 'border-primary bg-primary text-primary-foreground hover:brightness-95'
          : 'border-border bg-background text-foreground hover:bg-muted'
      } ${className}`}
    >
      {children}
    </button>
  )
}

function Input({ placeholder, className = '' }: { placeholder: string; className?: string }) {
  return <input placeholder={placeholder} className={`h-8 rounded-md border border-border bg-background px-2.5 text-xs outline-none placeholder:text-muted-foreground focus:border-primary ${className}`} />
}

export function ContextGraphStudioScreen() {
  const locale = useSettingsStore((state) => state.settings.locale)
  const zh = locale === 'zh'
  const chatPanelOpen = useWorkspaceStore((state) => state.chatPanelOpen)
  const setChatPanelOpen = useWorkspaceStore((state) => state.setChatPanelOpen)
  const setWorkbenchContext = useKnowledgeWorkbenchStore((state) => state.setContext)
  const [mode, setMode] = useState<StudioMode>('graph')
  const [sourceOpen, setSourceOpen] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState(nodes[0].id)
  const [runtimeIdentity, setRuntimeIdentity] = useState<RuntimeIdentity>(FALLBACK_IDENTITY)
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0]

  useEffect(() => {
    let cancelled = false
    void fetch('/api/contextgraph/runtime')
      .then(async (response) => {
        if (!response.ok) return null
        return (await response.json()) as Partial<RuntimeIdentity>
      })
      .then((value) => {
        if (cancelled || !value?.graphRef || !value.graphVersion || !value.graphHash) return
        setRuntimeIdentity({
          graphRef: value.graphRef,
          graphVersion: value.graphVersion,
          graphHash: value.graphHash,
          authorityState: value.authorityState === 'authoritative' ? 'authoritative' : 'candidate',
          semanticaCommit: typeof value.semanticaCommit === 'string' ? value.semanticaCommit : null,
        })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const selectedEvidenceRefs = ['extract', 'ground', 'graph', 'compare'].includes(mode) ? [EVIDENCE_REF_ID] : []
    const graphSelectionActive = mode === 'graph' || mode === 'compare'
    setWorkbenchContext({
      schemaVersion: 'knowledge_workbench_context.v2',
      graphRef: runtimeIdentity.graphRef,
      graphVersion: runtimeIdentity.graphVersion,
      graphHash: runtimeIdentity.graphHash,
      authorityState: runtimeIdentity.authorityState,
      runMode: mode === 'evaluate' ? 'evaluation_baseline' : null,
      candidateGraphId: runtimeIdentity.graphRef,
      acceptedReleaseId: null,
      acceptedReleaseVersion: null,
      selectedNodeIds: graphSelectionActive ? [selectedNodeId] : [],
      selectedEdgeIds: [],
      selectedRuleIds: graphSelectionActive && selectedNode.kind === 'rule' ? [selectedNodeId] : [],
      selectedCandidateId: ['extract', 'ground'].includes(mode) ? 'candidate-enterprise-scale-threshold' : null,
      selectedEvidenceRefs,
      activeSourceIdentityRef: ['sources', 'extract', 'ground', 'graph', 'compare'].includes(mode) ? SOURCE_REF : null,
      sourceAnchors: [],
      governanceState: 'candidate',
      hasAcceptedRelease: false,
      extractionRunId: ['extract', 'ground'].includes(mode) ? EXTRACTION_RUN : null,
      providerRef: 'semantica',
      providerCommit: runtimeIdentity.semanticaCommit,
    })
  }, [mode, runtimeIdentity, selectedNode.kind, selectedNodeId, setWorkbenchContext])

  useEffect(() => {
    const onWorkbenchResult = (event: Event) => {
      const parsed = parseKnowledgeWorkbenchResult((event as CustomEvent<unknown>).detail)
      if (!parsed) return
      const focusNode = parsed.focus.nodeIds.find((nodeId) => nodes.some((node) => node.id === nodeId))
      if (focusNode) {
        setSelectedNodeId(focusNode)
        setMode('graph')
      }
      if (parsed.focus.evidenceRefs.length > 0) {
        setSourceOpen(true)
      }
    }
    window.addEventListener('semantier:knowledge-workbench-result', onWorkbenchResult)
    return () => window.removeEventListener('semantier:knowledge-workbench-result', onWorkbenchResult)
  }, [])

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
        <div className="hidden min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground md:flex">
          <span className="max-w-[220px] truncate">POC敏感词汇总.docx</span>
          <StatusPill tone="candidate">candidate</StatusPill>
          <span className="font-mono">{runtimeIdentity.graphVersion} · {runtimeIdentity.graphHash.slice(0, 8)}…</span>
        </div>
        <div className="min-w-0 flex-1" />
        <span className="hidden max-w-[300px] truncate text-[10px] text-muted-foreground xl:block">{contextSummary}</span>
        <button
          type="button"
          onClick={() => setSourceOpen((open) => !open)}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-blue)]"
        >
          <HugeiconsIcon icon={FileViewIcon} size={15} strokeWidth={1.7} />
          <span>{zh ? '来源' : 'Source'}</span>
        </button>
        <button
          type="button"
          aria-label={chatPanelOpen ? (zh ? '关闭右侧对话面板' : 'Close right chat panel') : (zh ? '打开右侧对话面板' : 'Open right chat panel')}
          title={chatPanelOpen ? (zh ? '关闭右侧对话面板' : 'Close right chat panel') : (zh ? '打开右侧对话面板' : 'Open right chat panel')}
          onClick={() => setChatPanelOpen(!chatPanelOpen)}
          className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-blue)]"
        >
          <HugeiconsIcon icon={chatPanelOpen ? PanelRightOpenIcon : PanelRightCloseIcon} size={17} strokeWidth={1.7} />
        </button>
      </header>

      <nav className="flex h-10 shrink-0 items-end gap-1 overflow-x-auto border-b border-border bg-card px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(['sources', 'extract', 'ground', 'graph', 'compare', 'evaluate'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMode(item)}
            className={`h-9 shrink-0 border-b-2 px-2.5 text-xs transition-colors ${mode === item ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {item === 'sources' ? (zh ? '来源' : 'Sources') : item === 'extract' ? (zh ? '抽取' : 'Extract') : item === 'ground' ? (zh ? '校准' : 'Ground') : item === 'graph' ? (zh ? '图谱' : 'Graph') : item === 'compare' ? (zh ? '比较' : 'Compare') : (zh ? '评估' : 'Evaluate')}
          </button>
        ))}
      </nav>

      <section className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {mode === 'sources' ? <SourcesMode zh={zh} onNext={() => setMode('extract')} /> : null}
        {mode === 'extract' ? <ExtractMode zh={zh} onNext={() => setMode('ground')} /> : null}
        {mode === 'ground' ? <GroundMode zh={zh} /> : null}
        {mode === 'graph' ? (
          <GraphMode
            zh={zh}
            sourceOpen={sourceOpen}
            setSourceOpen={setSourceOpen}
            legendOpen={legendOpen}
            setLegendOpen={setLegendOpen}
            selectedNodeId={selectedNodeId}
            setSelectedNodeId={setSelectedNodeId}
            onGround={() => setMode('ground')}
            runtimeIdentity={runtimeIdentity}
          />
        ) : null}
        {mode === 'compare' ? <CompareMode zh={zh} onGraph={() => setMode('graph')} onGround={() => setMode('ground')} /> : null}
        {mode === 'evaluate' ? <EvaluateMode zh={zh} runtimeIdentity={runtimeIdentity} /> : null}
      </section>
    </main>
  )
}

function SourcesMode({ zh, onNext }: { zh: boolean; onNext: () => void }) {
  return (
    <div className="grid h-full grid-rows-[auto_auto_1fr_auto] bg-card">
      <div className="flex items-center gap-2 border-b border-border p-2.5">
        <div className="flex min-h-10 flex-1 items-center gap-2 rounded-lg border border-dashed border-border px-3 text-xs text-muted-foreground">
          <HugeiconsIcon icon={FileUploadIcon} size={16} strokeWidth={1.6} />
          {zh ? '拖入 PDF/DOCX，或浏览文件' : 'Drop PDF/DOCX here or browse files'}
        </div>
        <StudioButton primary>
          <HugeiconsIcon icon={FileUploadIcon} size={15} strokeWidth={1.7} className="mr-1.5" />
          {zh ? '上传来源' : 'Upload source'}
        </StudioButton>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-2.5"><Input placeholder={zh ? '搜索来源…' : 'Search sources…'} className="min-w-[220px] flex-1 md:max-w-[340px]" /><select className="h-8 rounded-md border border-border bg-background px-2 text-xs"><option>{zh ? '全部状态' : 'All status'}</option></select><div className="flex-1" /><StudioButton>{zh ? '刷新' : 'Refresh'}</StudioButton></div>
      <div className="min-h-0 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-muted text-[10px] uppercase tracking-wide text-muted-foreground"><tr>{[zh ? '文件 / 来源' : 'File / Source', zh ? '类型' : 'Type', zh ? '状态' : 'Status', zh ? '候选' : 'Candidates', zh ? '问题' : 'Issues', zh ? '最后运行' : 'Last run', zh ? '操作' : 'Actions'].map((h) => <th key={h} className="border-b border-border px-3 py-2.5 text-left font-semibold">{h}</th>)}</tr></thead>
          <tbody>{sourceRows.map((row, index) => <tr key={row[0]} className={index === 0 ? 'bg-primary/10' : 'hover:bg-muted/40'}>{row.map((value, i) => <td key={`${row[0]}-${i}`} className="border-b border-border px-3 py-3">{i === 0 ? <><strong>{value}</strong><div className="mt-0.5 font-mono text-[10px] text-muted-foreground">src_{index + 1}a93…</div></> : value}</td>)}<td className="border-b border-border px-3 py-3"><StudioButton>{index === 2 ? (zh ? '重试' : 'Retry') : (zh ? '打开' : 'Open')}</StudioButton></td></tr>)}</tbody>
        </table>
      </div>
      <div className="flex min-h-10 items-center gap-3 border-t border-border px-3 text-[11px] text-muted-foreground"><span>{zh ? '已选' : 'Selected'}: <strong className="text-foreground">POC敏感词汇总.docx</strong></span><span className="font-mono">sha256:a93f…2c1</span><span>AnyDoc structured</span><span>3 unresolved</span><div className="flex-1" /><StudioButton primary onClick={onNext}>{zh ? '抽取' : 'Extract'}<HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={1.7} className="ml-1.5" /></StudioButton></div>
    </div>
  )
}

function ExtractMode({ zh, onNext }: { zh: boolean; onNext: () => void }) {
  return (
    <div className="grid h-full grid-rows-[auto_auto_1fr] bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-2.5 text-xs"><span className="text-muted-foreground">{zh ? '来源' : 'Source'}:</span><strong>POC敏感词汇总.docx</strong><select className="h-8 rounded-md border border-border bg-background px-2"><option>Semantica</option></select><select className="h-8 rounded-md border border-border bg-background px-2"><option>{zh ? '默认方法' : 'Default method'}</option></select><StudioButton>{zh ? '实体类型 ▾' : 'Entity types ▾'}</StudioButton><StudioButton>{zh ? '关系类型 ▾' : 'Relationship types ▾'}</StudioButton><div className="flex-1" /><StudioButton primary>{zh ? '运行抽取' : 'Run extraction'}</StudioButton></div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border px-3 py-2 text-[11px] text-muted-foreground"><span><strong className="text-foreground">124</strong> {zh ? '实体' : 'entities'}</span><span><strong className="text-foreground">38</strong> {zh ? '关系' : 'relations'}</span><span><strong className="text-foreground">7</strong> {zh ? '低置信' : 'low confidence'}</span><span><strong className="text-foreground">3</strong> {zh ? '证据未解析' : 'unresolved evidence'}</span><div className="flex-1" /><Input placeholder={zh ? '搜索候选…' : 'Search candidates…'} /></div>
      <div className="grid min-h-0 grid-cols-1 md:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-h-0 overflow-auto border-r border-border">
          <table className="w-full border-collapse text-xs"><thead className="sticky top-0 bg-muted text-[10px] uppercase tracking-wide text-muted-foreground"><tr>{[zh ? '候选 / 值' : 'Candidate / value', zh ? '类型' : 'Type', zh ? '置信度' : 'Confidence', zh ? '证据' : 'Evidence', zh ? '解析' : 'Resolution'].map((h) => <th key={h} className="border-b border-border px-3 py-2.5 text-left">{h}</th>)}</tr></thead><tbody>{candidates.map((row, index) => <tr key={row[0]} className={index === 0 ? 'bg-primary/10' : 'hover:bg-muted/40'}>{row.map((value, i) => <td key={`${row[0]}-${i}`} className="border-b border-border px-3 py-3">{i === 0 ? <><strong>{value}</strong><div className="font-mono text-[10px] text-muted-foreground">candidate_{index + 27}</div></> : value}</td>)}</tr>)}</tbody></table>
        </div>
        <aside className="hidden min-h-0 overflow-auto bg-card p-4 md:block"><h2 className="text-sm font-semibold">企业规模门槛</h2><div className="mt-2 flex gap-1.5"><StatusPill>rule</StatusPill><StatusPill>confidence 0.82</StatusPill><StatusPill>2 evidence</StatusPill></div><MiniLabel>{zh ? '来源证据' : 'Source evidence'}</MiniLabel><Quote>投标人须为<span className="bg-primary/35 px-0.5">行业龙头企业</span> / 中国500强企业。</Quote><MiniLabel>Evidence refs</MiniLabel><div className="font-mono text-[10px] text-muted-foreground">ev_73bc…12a<br/>ev_1a90…d31</div><div className="mt-5"><StudioButton primary onClick={onNext}>{zh ? '校准候选' : 'Ground candidate'}<HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={1.7} className="ml-1.5" /></StudioButton></div></aside>
      </div>
    </div>
  )
}

function GroundMode({ zh }: { zh: boolean }) {
  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto] bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-2.5 text-xs"><strong>{zh ? '待处理 18 / 124' : 'Pending 18 / 124'}</strong><select className="h-8 rounded-md border border-border bg-background px-2"><option>{zh ? '待处理' : 'Pending'}</option></select><Input placeholder={zh ? '搜索候选…' : 'Search candidate…'} /><div className="flex-1" /><button type="button" className="inline-flex h-8 items-center gap-1.5 px-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-blue)]"><HugeiconsIcon icon={ArrowLeft01Icon} size={15} strokeWidth={1.7} />{zh ? '上一条' : 'Previous'}</button><span className="min-w-[52px] text-center text-[11px] text-muted-foreground">27 / 124</span><button type="button" className="inline-flex h-8 items-center gap-1.5 px-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-blue)]">{zh ? '下一条' : 'Next'}<HugeiconsIcon icon={ArrowRight01Icon} size={15} strokeWidth={1.7} /></button></div>
      <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[minmax(320px,.95fr)_minmax(340px,1.05fr)]">
        <SourceDocument zh={zh} className="hidden border-r border-border lg:flex" />
        <div className="min-h-0 overflow-auto p-4 lg:p-5"><h2 className="text-lg font-semibold">企业规模门槛</h2><div className="mt-2 flex flex-wrap gap-1.5"><StatusPill>rule</StatusPill><StatusPill>confidence 0.82</StatusPill><StatusPill tone="success">resolution exact</StatusPill><StatusPill tone="candidate">candidate only</StatusPill></div><MiniLabel>{zh ? '证据' : 'Evidence'}</MiniLabel><div className="mb-2 flex items-center gap-2"><button type="button" aria-label={zh ? '上一条证据' : 'Previous evidence'} className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><HugeiconsIcon icon={ArrowLeft01Icon} size={14} strokeWidth={1.7} /></button><span className="text-xs">Evidence 1 / 2</span><button type="button" aria-label={zh ? '下一条证据' : 'Next evidence'} className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={1.7} /></button></div><Quote>投标人须为<span className="bg-primary/35 px-0.5">行业龙头企业/中国500强企业</span></Quote><MiniLabel>{zh ? '关联图上下文' : 'Linked graph context'}</MiniLabel><div className="font-mono text-[10px] text-muted-foreground">concept: 行业龙头企业<br/>relationship: violates_scope_constraint</div><MiniLabel>Human Grounding</MiniLabel><div className="flex flex-wrap gap-2"><StudioButton primary>{zh ? '接受' : 'Accept'}</StudioButton><StudioButton>{zh ? '编辑' : 'Edit'}</StudioButton><StudioButton className="text-destructive">{zh ? '拒绝' : 'Reject'}</StudioButton><StudioButton>{zh ? '重新定位' : 'Reground'}</StudioButton></div><MiniLabel>{zh ? '历史' : 'History'}</MiniLabel><p className="text-xs leading-5 text-muted-foreground">{zh ? '尚无人工决策。写入前会对固定来源进行服务端重新校验。' : 'No prior human decision. The pinned source will be revalidated server-side before write.'}</p></div>
      </div>
      <div className="flex h-8 items-center border-t border-border px-3 text-[10px] text-muted-foreground">{zh ? '服务端证据校验：就绪 · 来源 hash 与固定身份一致' : 'Server evidence revalidation: ready · source hash matches pinned identity'}</div>
    </div>
  )
}

function GraphMode({ zh, sourceOpen, setSourceOpen, legendOpen, setLegendOpen, selectedNodeId, setSelectedNodeId, onGround, runtimeIdentity }: { zh: boolean; sourceOpen: boolean; setSourceOpen: (open: boolean) => void; legendOpen: boolean; setLegendOpen: (open: boolean) => void; selectedNodeId: string; setSelectedNodeId: (id: string) => void; onGround: () => void; runtimeIdentity: RuntimeIdentity }) {
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0]
  return (
    <div className={`grid h-full min-h-0 transition-[grid-template-columns] duration-200 ${sourceOpen ? 'min-[1200px]:grid-cols-[minmax(260px,31%)_minmax(0,1fr)]' : 'grid-cols-[0_minmax(0,1fr)]'}`}>
      <div className={`min-h-0 min-w-0 overflow-hidden border-r border-border bg-card ${sourceOpen ? 'max-[1199px]:absolute max-[1199px]:inset-y-0 max-[1199px]:left-0 max-[1199px]:z-20 max-[1199px]:w-[min(420px,88vw)] max-[1199px]:shadow-sm' : 'pointer-events-none opacity-0'}`}><SourceDocument zh={zh} onClose={() => setSourceOpen(false)} className="flex h-full" /></div>
      <div className="relative min-h-0 min-w-0 overflow-hidden bg-background">
        <svg viewBox="0 0 1200 720" className="absolute inset-0 h-full w-full" aria-label="ContextGraph Studio design preview">
          <defs>
            <marker id="studio-arrow-requires" viewBox="0 0 10 10" refX="8.6" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" style={{ fill: GRAPH_EDGE_COLORS.requires }} /></marker>
            <marker id="studio-arrow-exception" viewBox="0 0 10 10" refX="8.6" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" style={{ fill: GRAPH_EDGE_COLORS.exception }} /></marker>
            <marker id="studio-arrow-derived" viewBox="0 0 10 10" refX="8.6" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" style={{ fill: GRAPH_EDGE_COLORS.derived }} /></marker>
          </defs>
          <path id="edge-requires" d="M360 325C470 250 570 250 680 325" fill="none" strokeWidth="2.2" markerEnd="url(#studio-arrow-requires)" style={{ stroke: GRAPH_EDGE_COLORS.requires }} />
          <path id="edge-exception" d="M360 350C470 430 570 430 680 350" fill="none" strokeWidth="2.2" markerEnd="url(#studio-arrow-exception)" style={{ stroke: GRAPH_EDGE_COLORS.exception }} />
          <path id="edge-derived" d="M680 315C575 185 465 185 360 315" fill="none" strokeWidth="2.2" markerEnd="url(#studio-arrow-derived)" style={{ stroke: GRAPH_EDGE_COLORS.derived }} />
          <path id="edge-derived-label" d="M360 315C465 185 575 185 680 315" fill="none" stroke="none" />
          <text dy="-8" className="text-[11px]" style={{ fill: 'var(--theme-text)' }}><textPath href="#edge-requires" startOffset="50%" textAnchor="middle">requires</textPath></text>
          <text dy="16" className="text-[11px]" style={{ fill: 'var(--theme-text)' }}><textPath href="#edge-exception" startOffset="50%" textAnchor="middle">exception_of</textPath></text>
          <text dy="-8" className="text-[11px]" style={{ fill: 'var(--theme-text)' }}><textPath href="#edge-derived-label" startOffset="50%" textAnchor="middle">derived_from</textPath></text>
          <path d="M312 360C265 420 225 475 214 527" fill="none" strokeWidth="1.8" markerEnd="url(#studio-arrow-requires)" style={{ stroke: 'var(--theme-muted)' }} />
          <path d="M728 360C780 420 820 470 848 522" fill="none" strokeWidth="1.8" markerEnd="url(#studio-arrow-requires)" style={{ stroke: 'var(--theme-muted)' }} />
          <path d="M738 330C830 302 905 300 966 313" fill="none" strokeWidth="1.8" markerEnd="url(#studio-arrow-requires)" style={{ stroke: 'var(--theme-muted)' }} />
          {nodes.map((node) => <g key={node.id} transform={`translate(${node.x} ${node.y})`} onClick={() => setSelectedNodeId(node.id)} className="cursor-pointer"><circle r={node.id === selectedNodeId ? 32 : 29} style={{ fill: 'var(--theme-bg)', stroke: 'var(--theme-bg)' }} strokeWidth="6" /><circle r={node.id === selectedNodeId ? 27 : 24} style={{ fill: GRAPH_NODE_COLORS[node.kind], stroke: node.id === selectedNodeId ? 'var(--theme-text)' : GRAPH_NODE_COLORS[node.kind] }} strokeWidth="3" /><text y="49" textAnchor="middle" className="text-[11px] [paint-order:stroke]" style={{ fill: 'var(--theme-text)', stroke: 'var(--theme-bg)', strokeWidth: 5 }}>{node.label}</text></g>)}
        </svg>
        <div className="absolute left-3 top-3 z-10 flex w-[min(320px,calc(100%_-_24px))] gap-1.5">
          <Input placeholder={zh ? '搜索图谱…' : 'Search graph…'} className="min-w-0 flex-1 bg-card" />
          <StudioButton title={zh ? '搜索图谱' : 'Search graph'}>
            <HugeiconsIcon icon={Search01Icon} size={16} strokeWidth={1.7} />
          </StudioButton>
        </div>
        {!sourceOpen ? (
          <button type="button" onClick={() => setSourceOpen(true)} className="absolute left-3 top-[54px] z-10 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] shadow-sm">
            <HugeiconsIcon icon={FileViewIcon} size={14} strokeWidth={1.7} />
            {zh ? '来源证据' : 'Source evidence'}
          </button>
        ) : null}
        <aside className="absolute right-3 top-3 z-10 hidden w-[min(320px,calc(100%_-_24px))] max-h-[58%] overflow-auto rounded-lg border border-border bg-card p-3 shadow-sm md:block"><h2 className="text-sm font-semibold">{selectedNode.label}</h2><div className="mt-1.5 flex gap-1.5"><StatusPill>{selectedNode.kind}</StatusPill><StatusPill tone="candidate">candidate</StatusPill></div><MiniLabel>Canonical ID</MiniLabel><div className="font-mono text-[10px]">{selectedNode.id}</div><MiniLabel>{zh ? '校准状态' : 'Grounding'}</MiniLabel><div className="text-xs">pending · 2 EvidenceRefs</div><MiniLabel>{zh ? '来源证据' : 'Source evidence'}</MiniLabel><Quote compact>行业龙头企业 / 中国500强企业</Quote><div className="mt-3 flex gap-2"><StudioButton primary onClick={() => setSourceOpen(true)}>{zh ? '打开证据' : 'Open evidence'}</StudioButton><StudioButton onClick={onGround}>{zh ? '校准' : 'Ground'}</StudioButton></div></aside>
        <div className="absolute bottom-10 left-3 z-10 flex flex-col gap-0.5 rounded-xl border border-border bg-card p-1 shadow-sm">
          <Rail title={zh ? '布局' : 'Layout'}><HugeiconsIcon icon={Layout01Icon} size={16} strokeWidth={1.7} /></Rail>
          <Rail title={zh ? '放大' : 'Zoom in'}><HugeiconsIcon icon={ZoomInAreaIcon} size={16} strokeWidth={1.7} /></Rail>
          <Rail title={zh ? '缩小' : 'Zoom out'}><HugeiconsIcon icon={ZoomOutAreaIcon} size={16} strokeWidth={1.7} /></Rail>
          <Rail title={zh ? '适配' : 'Fit'}><HugeiconsIcon icon={FitToScreenIcon} size={16} strokeWidth={1.7} /></Rail>
          <Rail title={zh ? '全屏' : 'Fullscreen'}><HugeiconsIcon icon={FullScreenIcon} size={16} strokeWidth={1.7} /></Rail>
          <Rail title={zh ? '图例' : 'Legend'} onClick={() => setLegendOpen(!legendOpen)}><HugeiconsIcon icon={Layers01Icon} size={16} strokeWidth={1.7} /></Rail>
          <Rail title={zh ? '设置' : 'Settings'}><HugeiconsIcon icon={Settings01Icon} size={16} strokeWidth={1.7} /></Rail>
        </div>
        {legendOpen ? <div className="absolute bottom-10 right-3 z-10 w-52 rounded-lg border border-border bg-card p-2.5 text-[11px] shadow-sm"><strong>{zh ? '图例' : 'Legend'}</strong><LegendRow dot="bg-info">Concept</LegendRow><LegendRow dot="bg-primary">Rule candidate</LegendRow><LegendRow dot="bg-muted-foreground">Policy / constraint</LegendRow><LegendRow><HugeiconsIcon icon={ArrowRight01Icon} size={13} strokeWidth={1.7} /> Directed relation</LegendRow><LegendRow><HugeiconsIcon icon={Layers01Icon} size={13} strokeWidth={1.7} /> Parallel edges preserved</LegendRow></div> : null}
        <div className="absolute inset-x-0 bottom-0 z-10 flex h-7 items-center gap-3 overflow-hidden border-t border-border bg-card px-3 text-[10px] text-muted-foreground"><span><strong className="text-foreground">124</strong> nodes</span><span><strong className="text-foreground">38</strong> directed edges</span><span>multi-edge</span><span>ForceAtlas2</span><span className="truncate">selected: <strong className="text-foreground">{selectedNode.label}</strong></span><span className="font-mono">{runtimeIdentity.graphVersion}</span></div>
      </div>
    </div>
  )
}

function CompareMode({ zh, onGraph, onGround }: { zh: boolean; onGraph: () => void; onGround: () => void }) {
  return <div className="grid h-full grid-rows-[auto_auto_1fr] bg-card"><div className="flex flex-wrap items-center gap-2 border-b border-border p-2.5 text-xs"><span>V0</span><select className="h-8 rounded-md border border-border bg-background px-2"><option>graph_v11</option></select><span>V1</span><select className="h-8 rounded-md border border-border bg-background px-2"><option>graph_v12</option></select><div className="flex-1" /><StudioButton primary>{zh ? '比较' : 'Compare'}</StudioButton></div><div className="flex flex-wrap items-center gap-5 border-b border-border px-3 py-2 text-[11px] text-muted-foreground"><span><strong className="text-foreground">+3</strong> nodes</span><span><strong className="text-foreground">-1</strong> node</span><span><strong className="text-foreground">4</strong> changed edges</span><span><strong className="text-foreground">2</strong> evidence changes</span><div className="flex-1" /><Input placeholder={zh ? '搜索差异…' : 'Search diff…'} /></div><div className="grid min-h-0 grid-cols-1 md:grid-cols-[minmax(280px,.8fr)_minmax(360px,1.2fr)]"><div className="min-h-0 overflow-auto border-r border-border">{['企业规模门槛', 'A → requires → B', '中国500强', '采购资格限制'].map((item, index) => <button key={item} type="button" className={`block w-full border-b border-border px-3 py-3 text-left text-xs ${index === 0 ? 'bg-primary/10' : 'hover:bg-muted/40'}`}><strong>{item}</strong><div className="mt-0.5 text-[11px] text-muted-foreground">{index === 0 ? 'evidence changed · semantic edit' : 'relation changed'}</div></button>)}</div><div className="hidden min-h-0 overflow-auto p-4 md:block"><h2 className="text-sm font-semibold">企业规模门槛</h2><div className="mt-2 flex gap-1.5"><StatusPill>semantic edit</StatusPill><StatusPill>evidence changed</StatusPill></div><MiniLabel>{zh ? '前后比较' : 'Before → After'}</MiniLabel><div className="grid grid-cols-2 gap-2"><DiffCard title="V0">行业龙头企业作为企业规模门槛。<div className="mt-2 font-mono text-[10px] text-muted-foreground">EvidenceRef e21</div></DiffCard><DiffCard title="V1">行业龙头企业属于需要审查的资格限制候选规则。<div className="mt-2 font-mono text-[10px] text-muted-foreground">EvidenceRef e31</div></DiffCard></div><MiniLabel>{zh ? '修正理由' : 'Correction rationale'}</MiniLabel><Quote>Human reground selected table-cell evidence and changed the semantic relation from classification to constraint candidate.</Quote><div className="mt-3 flex gap-2"><StudioButton primary onClick={onGraph}>{zh ? '在图中打开' : 'Open in Graph'}</StudioButton><StudioButton onClick={onGround}>{zh ? '打开证据' : 'Open evidence'}</StudioButton></div></div></div></div>
}

function EvaluateMode({ zh, runtimeIdentity }: { zh: boolean; runtimeIdentity: RuntimeIdentity }) {
  return <div className="h-full overflow-auto bg-card"><div className="flex flex-wrap items-center gap-2 border-b border-border p-2.5 text-xs"><span>{zh ? '目标' : 'Target'}:</span><strong>{runtimeIdentity.graphVersion}</strong><span className="text-muted-foreground">corpus: tender-mvl · run: latest</span><div className="flex-1" /><StudioButton primary>{zh ? '运行评估' : 'Run evaluation'}</StudioButton></div><div className="grid grid-cols-1 border-b border-border md:grid-cols-3"><EvalSection title={zh ? '技术' : 'Technical'} rows={[[zh ? '有向边' : 'Directed edges', 'PASS'], [zh ? '平行边' : 'Parallel edges', 'PASS'], [zh ? '来源同步' : 'Source sync', 'PASS'], [zh ? '陈旧上下文拒绝' : 'Stale context rejection', 'PASS']]} /><EvalSection title="UX" rows={[[zh ? '图 → 来源' : 'Graph → source', '1.8s'], [zh ? '对话聚焦' : 'Chat focus', '2.1s'], ['Reground', '7.4s'], [zh ? '面板恢复' : 'Pane recovery', '0.7s']]} /><EvalSection title={zh ? '校准 / 证据' : 'Grounding / Evidence'} rows={[[zh ? '精确解析' : 'Exact resolution', '96%'], [zh ? '未解析' : 'Unresolved', '2%'], [zh ? '歧义' : 'Ambiguous', '2%'], [zh ? '校准负担' : 'Grounding burden', 'improved']]} /></div><div className="flex flex-wrap gap-5 border-b border-border px-3 py-2 text-[11px] text-muted-foreground"><strong className="text-foreground">V0 → V1 delta</strong><span>exact +8%</span><span>unresolved −3</span><span>graph/source −1.2s</span><span>corrections −2</span></div><div className="p-4"><MiniLabel>{zh ? '失败 / 需复核 Gate' : 'Failed / review-required gates'}</MiniLabel><Quote>{zh ? '无阻塞技术 Gate。保留一个歧义证据 fixture 用于人工 reground 复核。' : 'No blocking technical gate. One ambiguous evidence fixture remains for manual reground review.'}</Quote></div><div className="flex items-center justify-between border-t border-border p-4"><div><div className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">Loop decision</div><div className="text-3xl font-black">GO</div></div><StudioButton>{zh ? '打开完整评估' : 'Open Evaluation'}<HugeiconsIcon icon={ArrowUpRight01Icon} size={14} strokeWidth={1.7} className="ml-1.5" /></StudioButton></div></div>
}

function SourceDocument({ zh, onClose, className = '' }: { zh: boolean; onClose?: () => void; className?: string }) {
  return <div className={`min-h-0 min-w-0 flex-col bg-card ${className}`}><div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-2.5 text-[11px] font-semibold"><span>{zh ? '原始 DOCX · POC敏感词汇总.docx' : 'Original DOCX · POC敏感词汇总.docx'}</span>{onClose ? <StudioButton onClick={onClose}>{zh ? '关闭' : 'Close'}</StudioButton> : null}</div><div className="min-h-0 flex-1 overflow-auto p-5 text-xs leading-6 md:p-7"><h3 className="text-sm font-semibold">一、敏感词分类检测表（参考）</h3><p className="text-muted-foreground">1. 企业规模门槛</p><table className="my-3 w-full border-collapse"><tbody><tr><th className="border border-border bg-muted px-2 py-1.5 text-left">场景分类</th><th className="border border-border bg-muted px-2 py-1.5 text-left">违规敏感词</th><th className="border border-border bg-muted px-2 py-1.5 text-left">违规示例</th></tr><tr><td className="border border-border px-2 py-2">通用全场景</td><td className="border border-border px-2 py-2">大型企业、央企、国企、上市公司、世界500强、中国500强、行业前十、百强企业、龙头企业</td><td className="border border-border px-2 py-2">投标人须为<span className="rounded bg-primary/35 px-0.5">行业龙头企业/中国500强企业</span></td></tr></tbody></table><p>{zh ? '该类限制可能构成不合理资格条件，应结合适用制度进一步判断。' : 'This restriction may represent an unreasonable qualification condition and should be reviewed against the applicable institutional rules.'}</p><p className="font-mono text-[10px] text-muted-foreground">EvidenceRef: {EVIDENCE_REF_ID}</p></div></div>
}

function MiniLabel({ children }: { children: React.ReactNode }) { return <div className="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-[.1em] text-muted-foreground">{children}</div> }
function Quote({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) { return <div className={`rounded-r-md border-l-[3px] border-primary bg-muted/60 text-xs leading-5 ${compact ? 'px-2 py-1.5' : 'px-3 py-2.5'}`}>{children}</div> }
function Rail({ children, title, onClick }: { children: React.ReactNode; title: string; onClick?: () => void }) { return <button type="button" title={title} onClick={onClick} className="grid size-8 place-items-center rounded-md text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-blue)]">{children}</button> }
function LegendRow({ children, dot }: { children: React.ReactNode; dot?: string }) { return <div className="mt-1.5 flex items-center gap-2">{dot ? <span className={`size-2.5 rounded-full ${dot}`} /> : null}<span>{children}</span></div> }
function DiffCard({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-md border border-border bg-muted/45 p-3 text-xs"><strong>{title}</strong><div className="mt-2 leading-5">{children}</div></div> }
function EvalSection({ title, rows }: { title: string; rows: string[][] }) { return <section className="border-b border-border p-3.5 md:border-b-0 md:border-r md:last:border-r-0"><MiniLabel>{title}</MiniLabel>{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[1fr_auto] gap-3 border-b border-border/70 py-2 text-xs last:border-b-0"><span>{label}</span><strong className={value === 'PASS' || value === 'improved' ? 'text-success' : ''}>{value}</strong></div>)}</section> }
