import type { TemporalShowcaseAdapterResult } from '../adapters/temporal-showcase-adapter'

export function TemporalShowcaseView({ adapter }: { adapter: TemporalShowcaseAdapterResult }) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3" data-testid="temporal-showcase-view">
      {adapter.kind === 'timeline' ? (
        <section className="showcase-ref-panel p-3">
          <h3 className="font-mono text-sm font-semibold">Timeline</h3>
          <ul className="mt-2 space-y-1 text-xs">
            {adapter.events.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-3">
                <span>{event.label}</span>
                <span className="font-mono text-muted-foreground">{event.timestamp}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {adapter.kind === 'version-history' ? (
        <section className="showcase-ref-panel p-3">
          <h3 className="font-mono text-sm font-semibold">Version History</h3>
          <ul className="mt-2 space-y-1 text-xs">
            {adapter.versions.map((version) => (
              <li key={version.id} className="flex items-center justify-between gap-3">
                <span>{version.label}</span>
                <span className="font-mono text-muted-foreground">{version.timestamp}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {adapter.kind === 'temporal-dashboard' ? (
        <section className="showcase-ref-panel p-3">
          <h3 className="font-mono text-sm font-semibold">Dashboard</h3>
          <div className="mt-2 grid gap-2 text-xs md:grid-cols-3">
            {adapter.metrics.map((metric) => (
              <div key={metric.label} className="rounded border border-border bg-background/60 p-2">
                <div className="text-muted-foreground">{metric.label}</div>
                <div className="font-semibold">{metric.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-2 font-mono text-xs uppercase text-muted-foreground">Entities</div>
              <ul className="space-y-1 text-xs">
                {adapter.entities.map((entity) => (
                  <li key={entity.id}>{entity.label} · {entity.type}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-2 font-mono text-xs uppercase text-muted-foreground">Series</div>
              <ul className="space-y-1 text-xs">
                {adapter.metricsSeries?.map((series) => (
                  <li key={series.label}>{series.label}: {series.values.length} points</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      {adapter.kind === 'network-evolution' ? (
        <section className="showcase-ref-panel p-3">
          <h3 className="font-mono text-sm font-semibold">Network Evolution</h3>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-2 font-mono text-xs uppercase text-muted-foreground">Nodes</div>
              <ul className="space-y-1 text-xs">
                {adapter.nodes.map((node) => (
                  <li key={node.id}>{node.label} · {node.type}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-2 font-mono text-xs uppercase text-muted-foreground">Edges</div>
              <ul className="space-y-1 text-xs">
                {adapter.edges.map((edge) => (
                  <li key={edge.id}>{edge.source} → {edge.target} · {edge.type}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}
      <section className="showcase-ref-panel p-3">
        <div className="font-mono text-xs uppercase text-muted-foreground">Coverage</div>
        <div className="text-xs">Pinned Semantica notebook visualization cases</div>
      </section>
    </div>
  )
}
