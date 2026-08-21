import { useCallback, useMemo, useState } from 'react'

import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { DropdownSelect } from '@/components/ui/dropdown-select'

import { adaptKgFixture } from './adapters/kg-showcase-adapter'
import { adaptOntologyFixture } from './adapters/ontology-showcase-adapter'
import { adaptEmbeddingFixture } from './adapters/embedding-showcase-adapter'
import { adaptSemanticNetworkFixture } from './adapters/semantic-network-showcase-adapter'
import { KgShowcaseView } from './renderers/kg-showcase-view'
import { OntologyShowcaseView } from './renderers/ontology-showcase-view'
import { EmbeddingShowcaseView } from './renderers/embedding-showcase-view'
import { SemanticNetworkShowcaseView } from './renderers/semantic-network-showcase-view'
import { getDataset, getDatasetRegistry } from './semantica-showcase-dataset'
import { describeProvenance, formatProvenanceLine } from './semantica-showcase-provenance'
import type {
  ShowcaseInspectorField,
  ShowcaseInspectorModel,
  ShowcaseMetric,
  ShowcaseVisualizationMode,
} from './semantica-showcase-types'
import type { SigmaGraphReadonlySelection } from '../sigma-graph-readonly'

const MODES: ReadonlyArray<{ mode: ShowcaseVisualizationMode; label: string }> = [
  { mode: 'knowledge-graph', label: 'Knowledge Graph' },
  { mode: 'ontology', label: 'Ontology' },
  { mode: 'embedding', label: 'Embedding' },
  { mode: 'semantic-network', label: 'Semantic Network' },
]

const EMPTY_INSPECTOR: ShowcaseInspectorModel = {
  title: 'No selection',
  emptyLabel: 'Click an item to inspect',
  fields: [],
}

export function SemanticaShowcaseScreen() {
  const registry = useMemo(() => getDatasetRegistry(), [])
  const [datasetId, setDatasetId] = useState<string>(registry.datasets[0]?.datasetId ?? '')
  const dataset = useMemo(() => getDataset(datasetId), [datasetId])

  const [mode, setMode] = useState<ShowcaseVisualizationMode>('knowledge-graph')
  const [kgSelection, setKgSelection] = useState<SigmaGraphReadonlySelection>(null)
  const [snSelection, setSnSelection] = useState<SigmaGraphReadonlySelection>(null)
  const [embeddingSelection, setEmbeddingSelection] = useState<string | undefined>(undefined)
  const [ontologySelection, setOntologySelection] = useState<string | undefined>(undefined)

  const handleDatasetChange = useCallback((next: string) => {
    setDatasetId(next)
    setKgSelection(null)
    setSnSelection(null)
    setEmbeddingSelection(undefined)
    setOntologySelection(undefined)
  }, [])

  const kgAdapter = useMemo(() => adaptKgFixture(dataset.kg, kgSelection), [dataset, kgSelection])
  const ontologyAdapter = useMemo(
    () => adaptOntologyFixture(dataset.ontology, ontologySelection),
    [dataset, ontologySelection],
  )
  const embeddingAdapter = useMemo(
    () => adaptEmbeddingFixture(dataset.embedding, embeddingSelection),
    [dataset, embeddingSelection],
  )
  const semanticNetworkAdapter = useMemo(
    () => adaptSemanticNetworkFixture(dataset.semanticNetwork, snSelection),
    [dataset, snSelection],
  )

  const provenance = useMemo(() => describeProvenance(dataset), [dataset])
  const statusLine = useMemo(
    () => [
      formatProvenanceLine(dataset),
      `nodes ${kgAdapter.renderer.model.nodes.length} · edges ${kgAdapter.renderer.model.edges.length}`,
      `dataset ${provenance.fixtureId}`,
      `offline · ${provenance.source}`,
    ],
    [dataset, provenance, kgAdapter],
  )

  const handleKgSelect = useCallback((selection: SigmaGraphReadonlySelection) => {
    setKgSelection(selection)
  }, [])
  const handleSnSelect = useCallback((selection: SigmaGraphReadonlySelection) => {
    setSnSelection(selection)
  }, [])

  return (
    <section
      className="flex h-full w-full flex-col gap-3 p-4"
      data-testid="semantica-showcase-screen"
      aria-label="Semantica visualization showcase"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold leading-tight">Semantica Visualization Showcase</h1>
          <p className="text-xs text-muted-foreground">
            Four visualization classes from the Semantica introductory notebook, rendered fully
            offline from pinned JSON fixtures.
          </p>
        </div>
        <DatasetSelector
          registry={registry}
          value={datasetId}
          onChange={handleDatasetChange}
        />
      </header>

      <Tabs
        value={mode}
        onValueChange={(next: string) => setMode(next as ShowcaseVisualizationMode)}
        className="flex-1 overflow-hidden"
      >
        <TabsList variant="default" className="border-b border-border">
          {MODES.map((m) => (
            <TabsTab key={m.mode} value={m.mode} data-testid={`showcase-tab-${m.mode}`}>
              {m.label}
            </TabsTab>
          ))}
        </TabsList>

        <TabsPanel value="knowledge-graph" className="grid grid-cols-[260px_minmax(0,1fr)_280px] gap-3 pt-3">
          <LeftInventory
            title="Dataset"
            rows={[
              { label: 'name', value: dataset.displayName },
              { label: 'source', value: '16_Visualization.ipynb' },
              { label: 'semantica pin', value: provenance.semanticaCommit.slice(0, 7) },
              { label: 'fixture sha', value: provenance.manifestSha256.slice(0, 12) },
            ]}
            inventoryTitle="Entity types"
            inventoryItems={Object.entries(
              dataset.kg.entities.reduce<Record<string, number>>((acc, e) => {
                acc[e.type] = (acc[e.type] ?? 0) + 1
                return acc
              }, {}),
            ).map(([label, count]) => ({ label, count }))}
            summary={[
              { label: 'Layout', value: 'circular (semantic intent)' },
              { label: 'Selection', value: kgSelection ? kgSelection.id : '—' },
              { label: 'Renderer', value: 'Sigma/Graphology (readonly core)' },
            ]}
          />
          <CenterPanel>
            <KgShowcaseView input={kgAdapter.renderer} onSelect={handleKgSelect} />
          </CenterPanel>
          <RightRail
            inspector={kgAdapter.inspector}
            metrics={kgAdapter.metrics}
            title="Knowledge Graph"
            statusRows={[
              { label: 'provenance', value: provenance.source },
              { label: 'fixture sha', value: provenance.manifestSha256.slice(0, 12) },
            ]}
          />
        </TabsPanel>

        <TabsPanel value="ontology" className="grid grid-cols-[260px_minmax(0,1fr)_280px] gap-3 pt-3">
          <LeftInventory
            title="Ontology"
            rows={[
              { label: 'name', value: dataset.displayName },
              { label: 'source', value: '16_Visualization.ipynb · Step 2' },
              { label: 'derivation', value: 'deterministic' },
            ]}
            inventoryTitle="Classes"
            inventoryItems={dataset.ontology.classes.map((c) => ({
              label: c.label,
              hint: c.kind,
              count: c.instanceCount,
            }))}
            summary={[
              { label: 'Hierarchy depth', value: String(ontologyAdapter.maxDepth + 1) },
              { label: 'Properties', value: String(dataset.ontology.properties.length) },
              { label: 'Selection', value: ontologySelection ?? '—' },
            ]}
          />
          <CenterPanel>
            <OntologyShowcaseView
              input={ontologyAdapter.renderer}
              hierarchy={ontologyAdapter.hierarchy}
              maxDepth={ontologyAdapter.maxDepth}
              selectedClassId={ontologySelection}
              onSelect={setOntologySelection}
            />
          </CenterPanel>
          <RightRail
            inspector={ontologyAdapter.inspector}
            metrics={ontologyAdapter.metrics}
            title="Ontology"
            statusRows={[
              { label: 'provenance', value: provenance.source },
              { label: 'fixture sha', value: provenance.manifestSha256.slice(0, 12) },
            ]}
          />
        </TabsPanel>

        <TabsPanel value="embedding" className="grid grid-cols-[260px_minmax(0,1fr)_280px] gap-3 pt-3">
          <LeftInventory
            title="Embedding"
            rows={[
              { label: 'name', value: dataset.displayName },
              { label: 'source', value: '16_Visualization.ipynb · Step 3' },
              { label: 'projection', value: 'deterministic 2D hash' },
            ]}
            inventoryTitle="Items"
            inventoryItems={dataset.embedding.items.map((item) => ({
              label: item.label,
              hint: item.text,
            }))}
            summary={[
              { label: 'Dimension', value: '2D' },
              { label: 'Method', value: 'deterministic hash' },
              { label: 'Selection', value: embeddingSelection ?? '—' },
            ]}
          />
          <CenterPanel>
            <EmbeddingShowcaseView
              input={embeddingAdapter.renderer}
              selectedItemId={embeddingSelection}
              onSelect={setEmbeddingSelection}
            />
          </CenterPanel>
          <RightRail
            inspector={embeddingAdapter.inspector}
            metrics={embeddingAdapter.metrics}
            title="Embedding"
            statusRows={[
              { label: 'provenance', value: provenance.source },
              { label: 'fixture sha', value: provenance.manifestSha256.slice(0, 12) },
              { label: 'live provider', value: 'none' },
            ]}
          />
        </TabsPanel>

        <TabsPanel value="semantic-network" className="grid grid-cols-[260px_minmax(0,1fr)_280px] gap-3 pt-3">
          <LeftInventory
            title="Semantic Network"
            rows={[
              { label: 'name', value: dataset.displayName },
              { label: 'source', value: '16_Visualization.ipynb · Step 4' },
              { label: 'renderer', value: 'Sigma/Graphology (readonly core)' },
            ]}
            inventoryTitle="Node types"
            inventoryItems={semanticNetworkAdapter.distribution.nodeTypes.map((item) => ({
              label: item.label,
              count: item.count,
            }))}
            summary={[
              { label: 'Layout', value: 'circular (semantic intent)' },
              { label: 'Edge types', value: String(semanticNetworkAdapter.distribution.edgeTypes.length) },
              { label: 'Selection', value: snSelection ? snSelection.id : '—' },
            ]}
          />
          <CenterPanel>
            <SemanticNetworkShowcaseView
              input={semanticNetworkAdapter.renderer}
              distribution={semanticNetworkAdapter.distribution}
              onSelect={handleSnSelect}
            />
          </CenterPanel>
          <RightRail
            inspector={semanticNetworkAdapter.inspector}
            metrics={semanticNetworkAdapter.metrics}
            title="Semantic Network"
            statusRows={[
              { label: 'provenance', value: provenance.source },
              { label: 'fixture sha', value: provenance.manifestSha256.slice(0, 12) },
            ]}
          />
        </TabsPanel>
      </Tabs>

      <footer
        className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 font-mono text-[11px] text-muted-foreground"
        data-testid="showcase-status-bar"
      >
        <span>{statusLine[0]}</span>
        <span>{statusLine[1]}</span>
        <span>{statusLine[2]}</span>
        <span>{statusLine[3]}</span>
      </footer>
    </section>
  )
}

function CenterPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[520px] flex-col gap-2 rounded-md border border-border bg-background p-3">
      {children}
    </div>
  )
}

function LeftInventory({
  title,
  rows,
  inventoryTitle,
  inventoryItems,
  summary,
}: {
  title: string
  rows: Array<{ label: string; value: string }>
  inventoryTitle: string
  inventoryItems: Array<{ label: string; hint?: string; count?: number }>
  summary: Array<{ label: string; value: string }>
}) {
  return (
    <aside className="flex flex-col gap-3 rounded-md border border-border bg-card p-3 text-xs">
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{title}</div>
        <dl className="mt-1 space-y-1 font-mono">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="truncate">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {inventoryTitle}
        </div>
        <ul className="mt-1 space-y-1">
          {inventoryItems.map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between gap-2 rounded-sm bg-muted/40 px-2 py-1"
            >
              <span className="truncate">
                {item.label}
                {item.hint ? <span className="ml-1 text-[10px] text-muted-foreground">{item.hint}</span> : null}
              </span>
              {item.count != null ? (
                <span className="font-mono text-[11px] text-muted-foreground">{item.count}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Summary</div>
        <dl className="mt-1 space-y-1 font-mono">
          {summary.map((row) => (
            <div key={row.label} className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="truncate">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </aside>
  )
}

function RightRail({
  inspector,
  metrics,
  title,
  statusRows,
}: {
  inspector: ShowcaseInspectorModel
  metrics: ShowcaseMetric[]
  title: string
  statusRows: Array<{ label: string; value: string }>
}) {
  const safeInspector: ShowcaseInspectorModel = inspector ?? EMPTY_INSPECTOR
  const fields: ShowcaseInspectorField[] = safeInspector.fields
  return (
    <aside className="flex flex-col gap-3 rounded-md border border-border bg-card p-3 text-xs">
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{title} · Inspector</div>
        <div className="mt-1 font-mono text-sm">
          <div className="font-semibold">{safeInspector.title || 'No selection'}</div>
          {safeInspector.subtitle ? (
            <div className="text-muted-foreground">{safeInspector.subtitle}</div>
          ) : null}
        </div>
        {fields.length === 0 ? (
          <p className="mt-2 text-[11px] text-muted-foreground">{safeInspector.emptyLabel}</p>
        ) : (
          <dl className="mt-2 space-y-1 font-mono text-[11px]" data-testid="inspector-fields">
            {fields.map((field) => (
              <div key={field.label}>
                <dt className="inline text-muted-foreground">{field.label}: </dt>
                <dd className="inline">{field.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Metrics</div>
        <dl className="mt-1 grid grid-cols-2 gap-2" data-testid="metric-cards">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-sm border border-border bg-muted/30 px-2 py-1 font-mono"
            >
              <dt className="text-[10px] text-muted-foreground">{metric.label}</dt>
              <dd className="text-sm">{metric.value}</dd>
              {metric.hint ? (
                <div className="text-[10px] text-muted-foreground">{metric.hint}</div>
              ) : null}
            </div>
          ))}
        </dl>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Provenance</div>
        <dl className="mt-1 space-y-1 font-mono text-[11px]">
          {statusRows.map((row) => (
            <div key={row.label} className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="truncate">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </aside>
  )
}

function DatasetSelector({
  registry,
  value,
  onChange,
}: {
  registry: ReturnType<typeof getDatasetRegistry>
  value: string
  onChange: (next: string) => void
}) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">Active Dataset</span>
      <DropdownSelect
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        data-testid="dataset-selector"
        aria-label="Active Dataset"
      >
        {registry.datasets.map((entry) => (
          <option key={entry.datasetId} value={entry.datasetId}>
            {entry.displayName}
          </option>
        ))}
      </DropdownSelect>
    </label>
  )
}
