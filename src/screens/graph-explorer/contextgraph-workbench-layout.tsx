import type { ReactNode } from 'react'

export function ContextGraphWorkbenchLayout({ source, graph, chatOpen, sourceOpen, onSourceToggle }: { source: ReactNode; graph: ReactNode; chatOpen: boolean; sourceOpen: boolean; onSourceToggle: () => void }) {
  return <div data-testid="contextgraph-layout" className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(240px,28%)_minmax(0,1fr)]" data-chat-open={chatOpen} data-source-open={sourceOpen}>
    {sourceOpen ? source : <button type="button" onClick={onSourceToggle} aria-label="Open source pane" className="absolute left-3 top-3 z-10 rounded border border-border bg-card px-2 py-1 text-xs shadow">Open source / 打开来源</button>}
    <div className="min-w-0 min-h-0">{graph}</div>
  </div>
}
