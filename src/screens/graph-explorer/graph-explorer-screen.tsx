import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useSettingsStore } from '@/hooks/use-settings'
import { useKnowledgeWorkbenchStore } from '@/stores/knowledge-workbench-store'
import { useMvlWorkflowStore } from '@/stores/mvl-workflow-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { GraphViewModel } from '@/contracts/graph-view-model'
import { GraphWorkbench } from './graph/graph-workbench'
import { ContextGraphWorkbenchLayout } from './contextgraph-workbench-layout'
import { SourcePane } from './source-viewer/source-pane'
import { parseKnowledgeWorkbenchResult } from '@/lib/knowledge-workbench-result'
const ExtractionReviewPanel = lazy(() => import('./components/extraction-review-panel').then((m) => ({ default: m.ExtractionReviewPanel })))
const GraphBuilderPanel = lazy(() => import('./components/graph-builder-panel').then((m) => ({ default: m.GraphBuilderPanel })))
const InspectorPanel = lazy(() => import('./components/inspector-panel').then((m) => ({ default: m.InspectorPanel })))

type ContextGraphNode = {
  id: string
  content: string
  type: string
  sourceAnchors: Array<Record<string, unknown>>
}

type ContextGraphProjection = {
  schemaVersion: string
  graphRef: string
  graphVersion: string
  graphHash: string
  authorityState: 'candidate' | 'authoritative'
  runMode: string | null
  semanticaCommit: string
  nodes: ContextGraphNode[]
  edges: Array<{ id: string; source?: string; target?: string; relationshipType?: string; evidenceRefs?: string[] }>
  workflow: Record<string, unknown>
}

async function fetchContextGraph(): Promise<ContextGraphProjection> {
  const response = await fetch('/api/contextgraph/runtime')
  if (!response.ok) throw new Error(`ContextGraph unavailable (${response.status})`)
  return (await response.json()) as ContextGraphProjection
}

export function GraphExplorerScreen() {
  const locale = useSettingsStore((state) => state.settings.locale)
  const graphQuery = useQuery({
    queryKey: ['phase1-001', 'contextgraph-runtime'],
    queryFn: fetchContextGraph,
    retry: false,
  })
  const setContext = useKnowledgeWorkbenchStore((state) => state.setContext)
  const applyWorkbenchResult = useKnowledgeWorkbenchStore((state) => state.applyWorkbenchResult)
  const setServerWorkflowContext = useMvlWorkflowStore((state) => state.setServerContext)
  const chatPanelOpen = useWorkspaceStore((state) => state.chatPanelOpen)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [rawFilter, setRawFilter] = useState('')
  const [rawType, setRawType] = useState<'all' | 'concept' | 'rule'>('all')
  const [sourceOpen, setSourceOpen] = useState(true)
  const selected = useMemo(
    () => graphQuery.data?.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [graphQuery.data?.nodes, selectedNodeId],
  )
  const rawNodes = useMemo(() => {
    const query = rawFilter.trim().toLocaleLowerCase()
    return (graphQuery.data?.nodes ?? []).filter((node) => {
      if (rawType !== 'all' && node.type !== rawType) return false
      return !query || `${node.content} ${node.id}`.toLocaleLowerCase().includes(query)
    })
  }, [graphQuery.data?.nodes, rawFilter, rawType])
  const graphModel = useMemo<GraphViewModel | null>(() => {
    const graph = graphQuery.data
    if (!graph) return null
    return {
      schemaVersion: 'semantier.graph_view_model.v2', graphRef: graph.graphRef, graphVersion: graph.graphVersion, graphHash: graph.graphHash,
      authorityState: graph.authorityState, candidateGraphId: graph.graphRef, acceptedReleaseId: null,
      nodes: graph.nodes.map((node) => ({ id: node.id, semanticType: node.type, label: node.content || node.id, properties: {}, evidenceRefs: [], groundingState: 'pending' as const })),
      edges: graph.edges.flatMap((edge) => edge.source && edge.target ? [{ id: edge.id, sourceId: edge.source, targetId: edge.target, relationshipType: edge.relationshipType ?? 'related_to', weight: 1, properties: {}, evidenceRefs: edge.evidenceRefs ?? [], groundingState: 'pending' as const }] : []),
      sourceAnchors: [], sourceEvidenceRefs: [],
    }
  }, [graphQuery.data])

  useEffect(() => {
    const graph = graphQuery.data
    if (!graph) return
    setServerWorkflowContext(graph.workflow)
    setContext({
      graphRef: graph.graphRef,
      graphVersion: graph.graphVersion,
      graphHash: graph.graphHash,
      authorityState: graph.authorityState,
      runMode: graph.runMode === 'authoritative' ? 'authoritative' : 'evaluation_baseline',
      candidateGraphId: graph.graphRef,
      acceptedReleaseId: null,
      acceptedReleaseVersion: null,
      selectedNodeIds: selectedNodeId ? [selectedNodeId] : [],
      selectedEdgeIds: selectedEdgeId ? [selectedEdgeId] : [],
      selectedRuleIds: [],
      sourceAnchors: (selected?.sourceAnchors ?? []).flatMap((anchor) => {
        const sourceRef = typeof anchor.sourceRef === 'string' ? anchor.sourceRef : null
        const sourceHash = typeof anchor.sourceHash === 'string' ? anchor.sourceHash : null
        const locator = typeof anchor.locator === 'string' ? anchor.locator : null
        return sourceRef && sourceHash && locator
          ? [{ sourceRef, sourceHash, locator, quote: null }]
          : []
      }),
      governanceState: graph.authorityState === 'authoritative' ? 'active' : 'candidate',
      hasAcceptedRelease: graph.authorityState === 'authoritative',
      extractionRunId: null,
      providerRef: 'semantica',
      providerCommit: graph.semanticaCommit,
    })
  }, [graphQuery.data, selected, selectedEdgeId, selectedNodeId, setContext, setServerWorkflowContext])

  useEffect(() => {
    if (!graphModel) return
    const handleResult = (event: Event) => {
      const raw = (event as CustomEvent<unknown>).detail
      const result = parseKnowledgeWorkbenchResult(raw)
      if (!result) return
      if (applyWorkbenchResult(result, graphModel)) {
        setSelectedNodeId(result.focus.nodeIds[0] ?? null)
        setSelectedEdgeId(result.focus.edgeIds[0] ?? null)
      }
    }
    window.addEventListener('semantier:knowledge-workbench-result', handleResult)
    return () => window.removeEventListener('semantier:knowledge-workbench-result', handleResult)
  }, [applyWorkbenchResult, graphModel])

  const zh = locale === 'zh'
  return (
    <main className="flex h-full min-h-0 flex-col bg-background text-foreground" lang={zh ? 'zh-CN' : 'en'}>
      <header className="border-b border-border px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Phase1-001 MVL</p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-xl font-semibold">{zh ? '招标 ContextGraph Explorer' : 'Tender ContextGraph Explorer'}</h1>
          {graphQuery.data ? <span className="font-mono text-[11px] text-muted-foreground">{graphQuery.data.graphVersion}</span> : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          {['BUILD', 'GROUND', 'COMPARE V0/V1', 'REVIEW', 'DECISION'].map((stage) => (
            <span key={stage} className="rounded-full border border-border px-2 py-1">{stage}</span>
          ))}
        </div>
      </header>
      {graphQuery.isLoading ? <p className="p-5 text-sm text-muted-foreground">{zh ? '正在加载固定图制品…' : 'Loading pinned graph artifact…'}</p> : null}
      {graphQuery.isError ? <div role="alert" className="m-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">{zh ? 'ContextGraph 当前不可用。' : 'ContextGraph is unavailable.'}</div> : null}
      {graphQuery.data && graphModel ? (
        <Suspense fallback={<p className="p-5 text-sm text-muted-foreground">Loading review tools…</p>}><div className="grid gap-3 p-5 lg:grid-cols-[minmax(0,1fr)_280px]"><div className="space-y-3"><ExtractionReviewPanel items={graphQuery.data.nodes.map((node) => ({ id: node.id, text: node.content, mapping: node.type, confidence: 0.8, evidence: node.sourceAnchors[0] ? String(node.sourceAnchors[0].quote ?? node.sourceAnchors[0].locator ?? 'Pinned source anchor') : 'Pinned source anchor' }))} /><GraphBuilderPanel extractionReady={!graphQuery.isLoading} building={false} counts={{ nodes: graphQuery.data.nodes.length, edges: graphQuery.data.edges.length, constraints: 0 }} onBuild={() => undefined} onRollback={() => setSelectedNodeId(null)} /></div><InspectorPanel graphState={graphQuery.data.edges.length ? 'connected-graph' : 'extraction-only'} /></div></Suspense>
      ) : null}
      {graphQuery.data && graphModel ? (
        graphQuery.data.edges.length === 0 ? (
          <RawExtractionList
            nodes={rawNodes}
            filter={rawFilter}
            type={rawType}
            onFilterChange={setRawFilter}
            onTypeChange={setRawType}
            selectedNodeId={selectedNodeId}
            onSelect={setSelectedNodeId}
          />
        ) : (
          <ContextGraphWorkbenchLayout
            source={<SourcePane open={sourceOpen} onToggle={() => setSourceOpen(false)} mediaType="application/pdf" pages={[]} primary={null} />}
            chatOpen={chatPanelOpen}
            sourceOpen={sourceOpen}
            onSourceToggle={() => setSourceOpen(true)}
            graph={<GraphWorkbench model={graphModel} selectedNodeId={selectedNodeId} selectedEdgeId={selectedEdgeId} onSelectionChange={({ nodeId, edgeId }) => { setSelectedNodeId(nodeId); setSelectedEdgeId(edgeId) }} />}
          />
        )
      ) : null}
    </main>
  )
}

function RawExtractionList({
  nodes,
  filter,
  type,
  onFilterChange,
  onTypeChange,
  selectedNodeId,
  onSelect,
}: {
  nodes: ContextGraphNode[]
  filter: string
  type: 'all' | 'concept' | 'rule'
  onFilterChange: (value: string) => void
  onTypeChange: (value: 'all' | 'concept' | 'rule') => void
  selectedNodeId: string | null
  onSelect: (value: string) => void
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      <section aria-label="Raw extraction list" className="rounded-xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Raw extraction items</h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                This artifact contains lexical candidates, not a connected ontology graph. A graph view will appear after typed relations are available.
              </p>
            </div>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
              0 relations
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              value={filter}
              onChange={(event) => onFilterChange(event.target.value)}
              placeholder="Search text or node ID"
              aria-label="Search raw extraction items"
              className="h-9 min-w-[240px] flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            {(['all', 'concept', 'rule'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onTypeChange(value)}
                className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                  type === value
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {value === 'all' ? 'All' : value === 'concept' ? 'Concept candidates' : 'Rule candidates'}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
            <span><i className="mr-1.5 inline-block size-2 rounded-full bg-sky-400" />Concept candidate</span>
            <span><i className="mr-1.5 inline-block size-2 rounded-full bg-amber-400" />Rule candidate</span>
            <span>{nodes.length} shown</span>
          </div>
        </div>
        <div className="divide-y divide-border">
          {nodes.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelect(node.id)}
              className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 ${selectedNodeId === node.id ? 'bg-primary/10' : ''}`}
            >
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${node.type === 'rule' ? 'bg-amber-400' : 'bg-sky-400'}`} />
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm text-foreground">{node.content || node.id}</span>
                <span className="mt-1 block break-all font-mono text-[10px] text-muted-foreground">{node.id}</span>
              </span>
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{node.type}</span>
            </button>
          ))}
          {nodes.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No extraction items match the current filter.</p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
