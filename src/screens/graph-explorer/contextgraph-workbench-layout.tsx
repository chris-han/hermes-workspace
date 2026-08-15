import type { ReactNode } from 'react'

export function ContextGraphWorkbenchLayout({ source, graph, chatOpen, sourceOpen, onSourceToggle }: { source: ReactNode; graph: ReactNode; chatOpen: boolean; sourceOpen: boolean; onSourceToggle: () => void }) {
  return (
    <div
      data-testid="contextgraph-layout"
      data-chat-open={chatOpen}
      data-source-open={sourceOpen}
      className="grid h-full min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(240px,28%)_minmax(0,1fr)]"
    >
      {sourceOpen ? (
        <div className="min-h-0 min-w-0 overflow-hidden">{source}</div>
      ) : (
        <button
          type="button"
          onClick={onSourceToggle}
          aria-label="Open source pane"
          className="absolute left-3 top-3 z-10 rounded border border-border bg-card px-2 py-1 text-xs shadow"
        >
          Open source / 打开来源
        </button>
      )}
      <div className="min-h-0 min-w-0 overflow-hidden">{graph}</div>
    </div>
  )
}
