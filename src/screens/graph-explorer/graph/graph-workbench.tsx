import { useEffect, useMemo, useState } from 'react'
import type { GraphViewModel } from '@/contracts/graph-view-model'
import { projectGraphViewModel } from './graphology-projection'

export function GraphWorkbench({ model, selectedNodeId, selectedEdgeId, onSelectionChange }: { model: GraphViewModel; selectedNodeId: string | null; selectedEdgeId: string | null; onSelectionChange: (selection: { nodeId: string | null; edgeId: string | null }) => void }) {
  const graph = useMemo(() => projectGraphViewModel(model), [model])
  const [query, setQuery] = useState('')
  const visibleNodes = model.nodes.filter((node) => !query.trim() || `${node.label} ${node.id}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  useEffect(() => { if (selectedNodeId && !graph.hasNode(selectedNodeId)) onSelectionChange({ nodeId: null, edgeId: null }) }, [graph, onSelectionChange, selectedNodeId])
  return (
    <section
      aria-label="ContextGraph"
      data-testid="contextgraph-workbench"
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-card"
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border p-3">
        <h2 className="mr-auto text-sm font-semibold">ContextGraph / 上下文图</h2>
        <input
          aria-label="Search graph"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search / 搜索"
          className="h-8 w-44 rounded border border-border bg-background px-2 text-xs"
        />
        <button
          type="button"
          onClick={() => onSelectionChange({ nodeId: null, edgeId: null })}
          className="rounded border border-border px-2 py-1 text-xs"
        >
          Clear focus
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {visibleNodes.map((node) => (
            <div
              key={node.id}
              className={`rounded border p-3 ${selectedNodeId === node.id ? 'border-primary bg-primary/10' : 'border-border'}`}
            >
              <button
                type="button"
                onClick={() => onSelectionChange({ nodeId: node.id, edgeId: null })}
                className="w-full text-left"
              >
                <span className="block text-sm font-medium">{node.label || node.id}</span>
                <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                  {node.semanticType} · {node.id}
                </span>
              </button>
              {graph
                .outEdges(node.id)
                .map((edgeId) => {
                  const edge = model.edges.find((item) => item.id === edgeId)
                  if (!edge) return null
                  return (
                    <button
                      key={edgeId}
                      type="button"
                      onClick={() => onSelectionChange({ nodeId: null, edgeId })}
                      className={`mt-2 block w-full rounded border px-2 py-1 text-left text-[11px] ${selectedEdgeId === edgeId ? 'border-primary bg-primary/10' : 'border-border'}`}
                    >
                      <span className="font-medium">→ {edge.relationshipType}</span>
                      <span className="ml-1 text-muted-foreground">{edge.targetId}</span>
                    </button>
                  )
                })}
            </div>
          ))}
        </div>
      </div>
      <div className="shrink-0 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        {graph.order} nodes · {graph.size} directed edges · parallel edges preserved
      </div>
    </section>
  )
}
