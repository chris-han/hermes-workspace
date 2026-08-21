import { useCallback, useMemo, useState } from 'react'
import { Menu } from '@base-ui/react/menu'

import { UserAvatar } from '@/components/avatars'
import { SettingsDialog } from '@/components/settings-dialog'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { CaretDown, CheckCircle, Gear, Moon, Sun } from '@/components/ui/icon'
import { useResolvedAvatarUrl, useResolvedDisplayName } from '@/hooks/use-resolved-avatar'
import { applyTheme, useSettingsStore } from '@/hooks/use-settings'
import { getTheme, setTheme, type ThemeId } from '@/lib/theme'

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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const profileAvatarUrl = useResolvedAvatarUrl()
  const profileDisplayName = useResolvedDisplayName()
  const updateSettings = useSettingsStore((state) => state.updateSettings)
  const [activeTheme, setActiveTheme] = useState<ThemeId>(() => getTheme())
  const isDarkTheme = !activeTheme.endsWith('-light')

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
      className="asimov-minimalism semantica-showcase-reference flex h-full w-full flex-col overflow-hidden"
      data-testid="semantica-showcase-screen"
      aria-label="Semantica visualization showcase"
    >
      <Tabs
        value={mode}
        onValueChange={(next: string) => setMode(next as ShowcaseVisualizationMode)}
        className="showcase-ref-tabs flex-1 overflow-hidden"
      >
        <header className="showcase-ref-header flex h-14 shrink-0 items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-6">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="Semantier" className="h-8 w-8 shrink-0 object-contain" />
              <div className="leading-tight">
                <h1>Semantier</h1>
                <p>Semantica Showcase</p>
              </div>
            </div>
            <div className="showcase-ref-divider" />
            <div className="showcase-ref-meta-block">
              <span className="showcase-ref-meta-label">Workspace</span>
              <span className="showcase-ref-meta-value">{dataset.displayName}</span>
            </div>
            <div className="showcase-ref-divider" />
            <div className="showcase-ref-meta-block">
              <span className="showcase-ref-meta-label">System Status</span>
              <span className="showcase-ref-status"><i /> Offline · Synced</span>
            </div>
          </div>
          <div className="showcase-ref-header-right">
            <TabsList variant="line" className="showcase-ref-tabs-list">
              {MODES.map((m) => (
                <TabsTab key={m.mode} value={m.mode} data-testid={`showcase-tab-${m.mode}`}>
                  {m.label}
                </TabsTab>
              ))}
            </TabsList>
            <div className="showcase-ref-header-actions" aria-label="Workbench actions">
              <button type="button" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
                <Gear />
              </button>
              <button
                type="button"
                aria-label={isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode'}
                onClick={() => {
                  const next = toggleTheme(activeTheme)
                  const nextMode = next.endsWith('-light') ? 'light' : 'dark'
                  setTheme(next)
                  applyTheme(nextMode)
                  updateSettings({ theme: nextMode })
                  setActiveTheme(next)
                }}
              >
                {isDarkTheme ? <Sun /> : <Moon />}
              </button>
              <button
                type="button"
                aria-label={`User: ${profileDisplayName}`}
                className="showcase-ref-user-action"
                title={profileDisplayName}
              >
                <UserAvatar size={30} src={profileAvatarUrl} alt={profileDisplayName} />
              </button>
            </div>
          </div>
        </header>

        <TabsPanel value="knowledge-graph" className="showcase-ref-grid">
          <LeftInventory
            title="Dataset"
            datasetSelector={
              <DatasetSelector
                registry={registry}
                value={datasetId}
                onChange={handleDatasetChange}
              />
            }
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

        <TabsPanel value="ontology" className="showcase-ref-grid">
          <LeftInventory
            title="Ontology"
            datasetSelector={
              <DatasetSelector
                registry={registry}
                value={datasetId}
                onChange={handleDatasetChange}
              />
            }
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

        <TabsPanel value="embedding" className="showcase-ref-grid">
          <LeftInventory
            title="Embedding"
            datasetSelector={
              <DatasetSelector
                registry={registry}
                value={datasetId}
                onChange={handleDatasetChange}
              />
            }
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

        <TabsPanel value="semantic-network" className="showcase-ref-grid">
          <LeftInventory
            title="Semantic Network"
            datasetSelector={
              <DatasetSelector
                registry={registry}
                value={datasetId}
                onChange={handleDatasetChange}
              />
            }
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

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} initialSection="hermes" />

      <footer
        className="showcase-ref-statusbar flex flex-wrap items-center justify-between gap-2 px-3 font-mono text-[11px]"
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

function toggleTheme(theme: ThemeId): ThemeId {
  const pairs: Record<ThemeId, ThemeId> = {
    'hermes-nous': 'hermes-nous-light',
    'hermes-nous-light': 'hermes-nous',
    'hermes-official': 'hermes-official-light',
    'hermes-official-light': 'hermes-official',
    'hermes-classic': 'hermes-classic-light',
    'hermes-classic-light': 'hermes-classic',
    'hermes-slate': 'hermes-slate-light',
    'hermes-slate-light': 'hermes-slate',
    semantier: 'semantier-light',
    'semantier-light': 'semantier',
  }
  return pairs[theme]
}

function CenterPanel({ children }: { children: React.ReactNode }) {
  return (
    <section className="showcase-ref-panel showcase-ref-center relative flex min-h-0 flex-col overflow-hidden">
      <div className="showcase-ref-ruler" aria-hidden="true" />
      <div className="showcase-ref-grid-canvas" aria-hidden="true" />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col p-3 pt-5">{children}</div>
      <div className="showcase-ref-toolbar" aria-label="Visualization controls">
        <div className="showcase-ref-toolbar-group">
          <button type="button" aria-label="Reset view">↶</button>
          <button type="button" aria-label="Graph view" className="is-active">◇</button>
          <button type="button" aria-label="Fit view">⌗</button>
        </div>
        <span className="showcase-ref-toolbar-separator" />
        <div className="showcase-ref-toolbar-text">
          <span>Layout</span><strong>Force-Directed</strong><span>Hierarchical</span><span>Radial</span>
        </div>
      </div>
    </section>
  )
}

function LeftInventory({
  title,
  rows,
  datasetSelector,
  inventoryTitle,
  inventoryItems,
  summary,
}: {
  title: string
  rows: Array<{ label: string; value: string }>
  datasetSelector?: React.ReactNode
  inventoryTitle: string
  inventoryItems: Array<{ label: string; hint?: string; count?: number }>
  summary: Array<{ label: string; value: string }>
}) {
  return (
    <aside className="showcase-ref-left-rail flex min-h-0 flex-col gap-2 overflow-y-auto">
      <section className="showcase-ref-panel p-3">
        <div className="mb-2 flex items-start justify-between">
          <h2 className="showcase-ref-section-title">Workspace Overview</h2>
          <span className="showcase-ref-sync-badge">Synced</span>
        </div>
        <div className="showcase-ref-workspace-name">{rows[0]?.value ?? title}</div>
        {datasetSelector ? <div className="mt-3">{datasetSelector}</div> : null}
        <dl className="showcase-ref-overview-meta mt-3 space-y-1 font-mono">
          {rows.slice(1).map((row) => (
            <div key={row.label} className="flex justify-between gap-2">
              <dt>{row.label}</dt><dd className="truncate">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="showcase-ref-panel flex min-h-0 flex-1 flex-col p-3">
        <div className="showcase-ref-panel-heading">
          <h2>{inventoryTitle}</h2>
          <span>{inventoryItems.length} Categories</span>
        </div>
        <ul className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
          {inventoryItems.map((item, index) => (
            <li key={`${item.label}-${index}`} className="showcase-ref-entity-card">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-semibold uppercase">{item.label}</span>
                <span className="showcase-ref-swatch-row" aria-hidden="true"><i /><i /></span>
              </div>
              <div className="showcase-ref-entity-meta">
                <span>{item.hint ?? 'TYPE'}</span>
                <span>{item.count != null ? `${item.count} nodes` : '—'}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="showcase-ref-panel p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="showcase-ref-section-title">{title} Summary</h2>
          <span className="showcase-ref-mono-count">{summary.length} items</span>
        </div>
        <div className="space-y-1.5">
          {summary.map((row, index) => (
            <div key={row.label} className="showcase-ref-summary-row">
              <span><i className={index === 1 ? 'accent' : ''} />{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      </section>
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
    <aside className="showcase-ref-right-rail flex min-h-0 flex-col gap-2 overflow-hidden">
      <section className="showcase-ref-panel flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="showcase-ref-inspector-header">
          <h2>{title} Inspector</h2>
          <span>{fields[0]?.value ? `ID: ${String(fields[0].value).slice(0, 12)}` : 'No selection'}</span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <i className="showcase-ref-node-dot" />
              <h3 className="font-mono text-sm font-bold">{safeInspector.title || 'No selection'}</h3>
            </div>
            <p className="text-xs text-muted-foreground">{safeInspector.subtitle ?? safeInspector.emptyLabel}</p>
          </div>

          <dl className="grid grid-cols-2 gap-2" data-testid="metric-cards">
            {metrics.map((metric) => (
              <div key={metric.label} className="showcase-ref-metric-card">
                <dt>{metric.label}</dt>
                <dd>{metric.value}</dd>
                {metric.hint ? <small>{metric.hint}</small> : null}
              </div>
            ))}
          </dl>

          <div>
            <div className="showcase-ref-subheading"><h4>Properties</h4><span>{fields.length} keys</span></div>
            <dl className="showcase-ref-property-table" data-testid="inspector-fields">
              {fields.length === 0 ? (
                <div><dt>Selection</dt><dd>—</dd></div>
              ) : fields.map((field) => (
                <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="showcase-ref-panel h-64 shrink-0 overflow-hidden">
        <div className="showcase-ref-console-header">Fixture Provenance</div>
        <div className="showcase-ref-console-body">
          {statusRows.map((row) => (
            <div key={row.label}><span>{row.label}</span><strong>{row.value}</strong></div>
          ))}
        </div>
        <div className="showcase-ref-console-footer"><i /> Offline fixture ready <span>LOCAL</span></div>
      </section>
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
  const current = registry.datasets.find((entry) => entry.datasetId === value)
  return (
    <div className="showcase-ref-dataset text-xs">
      <span className="showcase-ref-dataset-label">Active Dataset</span>
      <Menu.Root>
        <Menu.Trigger
          className="showcase-ref-dataset-trigger"
          data-testid="dataset-selector"
          aria-label="Active Dataset"
        >
          <span>{current?.displayName ?? 'Select dataset'}</span>
          <CaretDown />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="start" className="showcase-ref-dataset-positioner">
            <Menu.Popup className="showcase-ref-dataset-menu">
              <Menu.RadioGroup value={value} onValueChange={onChange}>
                {registry.datasets.map((entry) => (
                  <Menu.RadioItem
                    key={entry.datasetId}
                    value={entry.datasetId}
                    className="showcase-ref-dataset-option"
                  >
                    <span>{entry.displayName}</span>
                    <Menu.RadioItemIndicator className="showcase-ref-dataset-check">
                      <CheckCircle />
                    </Menu.RadioItemIndicator>
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <div className="showcase-ref-dataset-id">
        <span>DS_ID:</span><strong>{value}</strong>
      </div>
    </div>
  )
}
