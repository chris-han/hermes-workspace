import type { AnalyticsShowcaseAdapterResult } from '../adapters/analytics-showcase-adapter'

export function AnalyticsShowcaseView({ adapter }: { adapter: AnalyticsShowcaseAdapterResult }) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3" data-testid="analytics-showcase-view">
      {adapter.kind === 'centrality' ? (
        <section className="showcase-ref-panel p-3">
          <h3 className="font-mono text-sm font-semibold">Centrality</h3>
          <ul className="mt-2 space-y-1 text-xs">
            {adapter.rankings.map((ranking) => (
              <li key={ranking.nodeId} className="flex items-center justify-between gap-3">
                <span>{ranking.nodeId}</span>
                <span className="font-mono text-muted-foreground">{ranking.score.toFixed(3)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {adapter.kind === 'communities' ? (
        <section className="showcase-ref-panel p-3">
          <h3 className="font-mono text-sm font-semibold">Communities</h3>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-2 font-mono text-xs uppercase text-muted-foreground">Partition</div>
              <ul className="space-y-1 text-xs">
                {adapter.communities.map((community) => (
                  <li key={community.id}>{String(community.id)}: {community.nodeIds.join(', ')}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-2 font-mono text-xs uppercase text-muted-foreground">Assignments</div>
              <ul className="space-y-1 text-xs">
                {Object.entries(adapter.assignments).map(([nodeId, communityId]) => (
                  <li key={nodeId}>{nodeId} → {String(communityId)}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}
      <section className="showcase-ref-panel p-3" data-testid="analytics-coverage-disclosure">
        <div className="font-mono text-xs uppercase text-muted-foreground">Coverage</div>
        <div className="text-xs">Pinned Semantica notebook visualization cases</div>
        <div className="text-xs text-muted-foreground">Source-only Semantica visualization methods are not included in this showcase.</div>
      </section>
    </div>
  )
}
