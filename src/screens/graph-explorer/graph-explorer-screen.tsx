import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useSettingsStore } from '@/hooks/use-settings'
import { useKnowledgeWorkbenchStore } from '@/stores/knowledge-workbench-store'
import { useMvlWorkflowStore } from '@/stores/mvl-workflow-store'
import { GraphWorkspace } from '@semantica-explorer/workspaces/GraphWorkspace/GraphWorkspace'

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
  edges: Array<{ id: string; source?: string; target?: string }>
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
  const setServerWorkflowContext = useMvlWorkflowStore((state) => state.setServerContext)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const selected = useMemo(
    () => graphQuery.data?.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [graphQuery.data?.nodes, selectedNodeId],
  )

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
      {graphQuery.data ? (
        <div className="min-h-0 flex-1 p-5">
          <section aria-label="GraphWorkspace" className="h-full min-h-0 overflow-hidden rounded-xl border border-border bg-card">
            <GraphWorkspace
              externalFocusNodeId={selectedNodeId ?? undefined}
              externalFocusToken={selectedNodeId ? 1 : undefined}
              onSelectionChange={({ nodeId, edgeId }) => {
                setSelectedNodeId(nodeId || null)
                setSelectedEdgeId(edgeId || null)
              }}
            />
          </section>
        </div>
      ) : null}
    </main>
  )
}
