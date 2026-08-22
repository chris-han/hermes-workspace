import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Menu } from '@base-ui/react/menu'

import { UserAvatar } from '@/components/avatars'
import { SettingsDialog } from '@/components/settings-dialog'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { CaretDown, CheckCircle, Gear, Moon, Sun } from '@/components/ui/icon'
import { useResolvedAvatarUrl, useResolvedDisplayName } from '@/hooks/use-resolved-avatar'
import { applyTheme, useSettingsStore } from '@/hooks/use-settings'
import { getTheme, setTheme, type ThemeId } from '@/lib/theme'

import { adaptKgFixture } from './adapters/kg-showcase-adapter'
import { adaptAnalyticsFixture } from './adapters/analytics-showcase-adapter'
import { adaptOntologyFixture } from './adapters/ontology-showcase-adapter'
import { adaptEmbeddingFixture } from './adapters/embedding-showcase-adapter'
import { adaptTemporalFixture } from './adapters/temporal-showcase-adapter'
import { adaptSemanticNetworkFixture } from './adapters/semantic-network-showcase-adapter'
import { KgShowcaseView } from './renderers/kg-showcase-view'
import { AnalyticsShowcaseView } from './renderers/analytics-showcase-view'
import { OntologyShowcaseView } from './renderers/ontology-showcase-view'
import { EmbeddingShowcaseView } from './renderers/embedding-showcase-view'
import { TemporalShowcaseView } from './renderers/temporal-showcase-view'
import { SemanticNetworkShowcaseView } from './renderers/semantic-network-showcase-view'
import { getDataset, getDatasetRegistry } from './semantica-showcase-dataset'
import { SigmaControls } from './sigma-controls'
import {
  DEFAULT_SIGMA_CONTROLS,
  applySigmaPositionControls,
  type SigmaControlState,
} from './sigma-control-state'
import { describeProvenance, formatSourceLocation } from './semantica-showcase-provenance'
import {
  deriveShowcaseStats,
  rendererLabelsFor,
  statsToMetrics,
} from './showcase-stats'
import {
  SHOWCASE_ANALYTICS_SUBMODE_ORDER,
  SHOWCASE_LENS_ORDER,
  SHOWCASE_TEMPORAL_SUBMODE_ORDER,
  type ShowcaseInspectorField,
  type ShowcaseInspectorModel,
  type ShowcaseMetric,
  type ShowcaseProvenanceBadge,
  type ShowcaseVisualizationMode,
  type AnalyticsShowcaseSubmode,
  type TemporalShowcaseSubmode,
} from './semantica-showcase-types'
import { resolveShowcaseState } from './semantica-showcase-state'
import type { SigmaGraphReadonlySelection } from '../sigma-graph-readonly'
import type { SigmaGraphReadonlyViewportController } from '../sigma-graph-readonly'
import {
  computeGraphTopology,
  type GraphTopologyMode,
} from '../layouts/graph-topology-layouts'

const MODES: ReadonlyArray<{ mode: ShowcaseVisualizationMode; label: string }> = [
  { mode: 'knowledge-graph', label: 'Knowledge Graph' },
  { mode: 'ontology', label: 'Ontology' },
  { mode: 'embedding', label: 'Embedding' },
  { mode: 'semantic-network', label: 'Semantic Network' },
  { mode: 'temporal', label: 'Temporal' },
  { mode: 'analytics', label: 'Analytics' },
]

/**
 * §4.1.3 fallback: lens/submode ordering and state resolution live in
 * `semantica-showcase-types.ts` (canonical orders) and
 * `semantica-showcase-state.ts` (`resolveShowcaseState`). The screen must not
 * define local fallback orders; empty capability sets are a registry error.
 */

/**
 Format a short source-location string for the LeftInventory rows. Delegates
 to `formatSourceLocation` in semantica-showcase-provenance.ts which reads
 the v2 `sources[]` array and picks the most informative record.
 */
function formatSourceLine(provenance: ShowcaseProvenanceBadge): string {
  return `semantica@${provenance.semanticaCommit.slice(0, 7)}`
}

const EMPTY_INSPECTOR: ShowcaseInspectorModel = {
  title: 'No selection',
  emptyLabel: 'Click an item to inspect',
  fields: [],
}

function toDisplayZoom(cameraRatio: number): number {
  if (!Number.isFinite(cameraRatio) || cameraRatio <= 0) return 1
  return 1 / cameraRatio
}

export function SemanticaShowcaseScreen() {
  const registry = useMemo(() => getDatasetRegistry(), [])
  const initialDatasetId = registry.datasets[0]?.datasetId ?? ''
  const [datasetId, setDatasetId] = useState<string>(initialDatasetId)
  const dataset = useMemo(() => getDataset(datasetId), [datasetId])
  const registryEntry = useMemo(
    () => registry.datasets.find((entry) => entry.datasetId === datasetId),
    [registry, datasetId],
  )
  const supportedLenses = registryEntry?.supportedLenses ?? SHOWCASE_LENS_ORDER
  const supportedTemporalSubmodes = registryEntry?.supportedSubmodes?.temporal ?? []
  const supportedAnalyticsSubmodes = registryEntry?.supportedSubmodes?.analytics ?? []
  const initialResolved = useMemo(
    () =>
      resolveShowcaseState({
        supportedLenses,
        supportedSubmodes: registryEntry?.supportedSubmodes,
      }),
    // Only the first render's resolution seeds the useState initializers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const initialMode = initialResolved.lens
  const initialTemporalSubmode = initialResolved.temporalSubmode ?? 'timeline'
  const initialAnalyticsSubmode = initialResolved.analyticsSubmode ?? 'centrality'

  const [settingsOpen, setSettingsOpen] = useState(false)
  const profileAvatarUrl = useResolvedAvatarUrl()
  const profileDisplayName = useResolvedDisplayName()
  const updateSettings = useSettingsStore((state) => state.updateSettings)
  const [activeTheme, setActiveTheme] = useState<ThemeId>(() => getTheme())
  const isDarkTheme = !activeTheme.endsWith('-light')

  const [mode, setMode] = useState<ShowcaseVisualizationMode>(initialMode)
  const [temporalSubmode, setTemporalSubmode] = useState<TemporalShowcaseSubmode>(initialTemporalSubmode)
  const [analyticsSubmode, setAnalyticsSubmode] = useState<AnalyticsShowcaseSubmode>(initialAnalyticsSubmode)
  const [sigmaControls, setSigmaControls] = useState<SigmaControlState>(DEFAULT_SIGMA_CONTROLS)
  const [kgTopology, setKgTopology] = useState<GraphTopologyMode>('layout')
  const [ontologyTopology, setOntologyTopology] = useState<GraphTopologyMode>('hierarchical')
  const [embeddingTopology, setEmbeddingTopology] = useState<GraphTopologyMode>('layout')
  const [snTopology, setSnTopology] = useState<GraphTopologyMode>('layout')
  const [kgEdgeLabels, setKgEdgeLabels] = useState(true)
  const [ontologyEdgeLabels, setOntologyEdgeLabels] = useState(true)
  const [embeddingEdgeLabels, setEmbeddingEdgeLabels] = useState(false)
  const [snEdgeLabels, setSnEdgeLabels] = useState(false)
  const [kgNudgeCount, setKgNudgeCount] = useState(0)
  const [ontologyNudgeCount, setOntologyNudgeCount] = useState(0)
  const [embeddingNudgeCount, setEmbeddingNudgeCount] = useState(0)
  const [snNudgeCount, setSnNudgeCount] = useState(0)
  const [kgZoomRatio, setKgZoomRatio] = useState(1)
  const [ontologyZoomRatio, setOntologyZoomRatio] = useState(1)
  const [embeddingZoomRatio, setEmbeddingZoomRatio] = useState(1)
  const [snZoomRatio, setSnZoomRatio] = useState(1)
  const kgViewportRef = useRef<SigmaGraphReadonlyViewportController | null>(null)
  const ontologyViewportRef = useRef<SigmaGraphReadonlyViewportController | null>(null)
  const embeddingViewportRef = useRef<SigmaGraphReadonlyViewportController | null>(null)
  const snViewportRef = useRef<SigmaGraphReadonlyViewportController | null>(null)
  const [kgSelection, setKgSelection] = useState<SigmaGraphReadonlySelection>(null)
  const [snSelection, setSnSelection] = useState<SigmaGraphReadonlySelection>(null)
  const [embeddingSelection, setEmbeddingSelection] = useState<string | undefined>(undefined)
  const [ontologySelection, setOntologySelection] = useState<string | undefined>(undefined)

  const handleDatasetChange = useCallback(
    (next: string) => {
      setDatasetId(next)
      setKgSelection(null)
      setSnSelection(null)
      setEmbeddingSelection(undefined)
      setOntologySelection(undefined)
      // §4.1.3: resolve lens/submode against the new dataset through the
      // canonical state-resolution helper — preserve the current selection
      // iff supported, otherwise fall back in canonical order. We recompute
      // capabilities from the registry directly because the picker runs
      // before the post-switch render commit.
      const nextEntry = registry.datasets.find((entry) => entry.datasetId === next)
      const resolved = resolveShowcaseState(
        {
          supportedLenses: nextEntry?.supportedLenses ?? SHOWCASE_LENS_ORDER,
          supportedSubmodes: nextEntry?.supportedSubmodes,
        },
        { lens: mode, temporalSubmode, analyticsSubmode },
      )
      setMode(resolved.lens)
      if (resolved.temporalSubmode) setTemporalSubmode(resolved.temporalSubmode)
      if (resolved.analyticsSubmode) setAnalyticsSubmode(resolved.analyticsSubmode)
    },
    [analyticsSubmode, mode, registry, temporalSubmode],
  )

  // §4.1.3: when the active dataset changes and the current lens/submode is
  // no longer supported, fall back through the canonical state resolution.
  // The effect runs after the commit so we observe the post-switch dataset.
  useEffect(() => {
    const resolved = resolveShowcaseState(
      {
        supportedLenses,
        supportedSubmodes: registryEntry?.supportedSubmodes,
      },
      { lens: mode, temporalSubmode, analyticsSubmode },
    )
    if (resolved.lens !== mode) setMode(resolved.lens)
    if (resolved.temporalSubmode && resolved.temporalSubmode !== temporalSubmode) {
      setTemporalSubmode(resolved.temporalSubmode)
    }
    if (resolved.analyticsSubmode && resolved.analyticsSubmode !== analyticsSubmode) {
      setAnalyticsSubmode(resolved.analyticsSubmode)
    }
  }, [analyticsSubmode, mode, registryEntry, supportedLenses, temporalSubmode])

  // W4-03: each adapter is only called when its payload is present. When
  // unsupported, we keep an EMPTY_INSPECTOR + empty metrics + empty graph
  // model so the conditional TabsPanel below can render an "unsupported"
  // placeholder without crashing.
  const kgAdapter = useMemo(
    () => (dataset.kg ? adaptKgFixture(dataset.kg, kgSelection) : null),
    [dataset.kg, kgSelection],
  )
  const ontologyAdapter = useMemo(
    () => (dataset.ontology ? adaptOntologyFixture(dataset.ontology, ontologySelection) : null),
    [dataset.ontology, ontologySelection],
  )
  const embeddingAdapter = useMemo(
    () => (dataset.embedding ? adaptEmbeddingFixture(dataset.embedding, embeddingSelection) : null),
    [dataset.embedding, embeddingSelection],
  )
  const semanticNetworkAdapter = useMemo(
    () => (dataset.semanticNetwork ? adaptSemanticNetworkFixture(dataset.semanticNetwork, snSelection) : null),
    [dataset.semanticNetwork, snSelection],
  )
  const temporalAdapter = useMemo(
    () => (dataset.temporal ? adaptTemporalFixture(dataset.temporal, temporalSubmode) : null),
    [dataset.temporal, temporalSubmode],
  )
  const analyticsAdapter = useMemo(
    () => (dataset.analytics ? adaptAnalyticsFixture(dataset.analytics, analyticsSubmode) : null),
    [analyticsSubmode, dataset.analytics],
  )

  const provenance = useMemo(() => describeProvenance(dataset), [dataset])
  const stats = useMemo(() => deriveShowcaseStats(dataset), [dataset])
  const metrics = useMemo(() => statsToMetrics(stats), [stats])
  const activeTopology = mode === 'knowledge-graph'
    ? kgTopology
    : mode === 'ontology'
      ? ontologyTopology
      : mode === 'embedding'
        ? embeddingTopology
      : mode === 'semantic-network'
        ? snTopology
        : 'layout'
  const labels = useMemo(() => rendererLabelsFor(mode, activeTopology), [mode, activeTopology])
  const kgGraphInput = useMemo(
    () => ({
      nodes: kgAdapter?.renderer.model.nodes.map((node) => ({
        id: node.id,
        label: node.label,
        group: node.group,
      })) ?? [],
      edges: kgAdapter?.renderer.model.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
      })) ?? [],
    }),
    [kgAdapter],
  )
  const snGraphInput = useMemo(
    () => ({
      nodes: semanticNetworkAdapter?.renderer.model.nodes.map((node) => ({
        id: node.id,
        label: node.label,
        group: node.group,
      })) ?? [],
      edges: semanticNetworkAdapter?.renderer.model.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
      })) ?? [],
    }),
    [semanticNetworkAdapter],
  )
  const ontologyGraphInput = useMemo(
    () => ({
      nodes: ontologyAdapter?.renderer.model.nodes.map((node) => ({
        id: node.id,
        label: node.label ?? node.id,
        group: node.group,
      })) ?? [],
      edges: ontologyAdapter?.renderer.model.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })) ?? [],
    }),
    [ontologyAdapter],
  )
  const embeddingGraphInput = useMemo(
    () => ({
      nodes: embeddingAdapter?.renderer.model.nodes.map((node) => ({
        id: node.id,
        label: node.label ?? node.id,
        group: node.group,
      })) ?? [],
      edges: embeddingAdapter?.renderer.model.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })) ?? [],
    }),
    [embeddingAdapter],
  )
  const kgPositions = useMemo(() => {
    const positions = Object.fromEntries(Array.from(computeGraphTopology(kgGraphInput, kgTopology, {
      selectedRootId: kgSelection?.type === 'node' ? kgSelection.id : null,
      seed: `kg-${kgTopology}-${kgNudgeCount}`,
    }).positions.entries()))
    return applySigmaPositionControls(positions, kgTopology, sigmaControls, kgSelection)
  }, [kgGraphInput, kgTopology, kgSelection, kgNudgeCount, sigmaControls])
  const snPositions = useMemo(() => {
    const positions = Object.fromEntries(Array.from(computeGraphTopology(snGraphInput, snTopology, {
      selectedRootId: snSelection?.type === 'node' ? snSelection.id : null,
      seed: `sn-${snTopology}-${snNudgeCount}`,
    }).positions.entries()))
    return applySigmaPositionControls(positions, snTopology, sigmaControls, snSelection)
  }, [snGraphInput, snTopology, snSelection, snNudgeCount, sigmaControls])
  const ontologyPositions = useMemo(() => {
    const positions = Object.fromEntries(Array.from(computeGraphTopology(ontologyGraphInput, ontologyTopology, {
      selectedRootId: ontologySelection ?? null,
      seed: `ontology-${ontologyTopology}-${ontologyNudgeCount}`,
    }).positions.entries()))
    return applySigmaPositionControls(
      positions,
      ontologyTopology,
      sigmaControls,
      ontologySelection ? { type: 'node', id: ontologySelection } : null,
    )
  }, [ontologyGraphInput, ontologyNudgeCount, ontologySelection, ontologyTopology, sigmaControls])
  const embeddingPositions = useMemo(() => {
    const positions = Object.fromEntries(Array.from(computeGraphTopology(embeddingGraphInput, embeddingTopology, {
      selectedRootId: embeddingSelection ?? null,
      seed: `embedding-${embeddingTopology}-${embeddingNudgeCount}`,
    }).positions.entries()))
    return applySigmaPositionControls(
      positions,
      embeddingTopology,
      sigmaControls,
      embeddingSelection ? { type: 'node', id: embeddingSelection } : null,
    )
  }, [embeddingGraphInput, embeddingNudgeCount, embeddingSelection, embeddingTopology, sigmaControls])
  const footerMeta = useMemo(
    () => {
      const kgNodes = kgAdapter?.renderer.model.nodes.length ?? 0
      const kgEdges = kgAdapter?.renderer.model.edges.length ?? 0
      return {
        left: [
          { label: 'model', value: 'semantica@showcase' },
          { label: 'run', value: provenance.manifestSha256.slice(0, 8) },
          { label: 'lifecycle', value: 'offline' },
          { label: 'source', value: provenance.source },
          { label: 'dataset', value: `fixture:${dataset.datasetId}` },
        ],
        right: [
          { label: 'nodes', value: String(kgNodes) },
          { label: 'edges', value: String(kgEdges) },
          { label: 'lenses', value: String(supportedLenses.length) },
          { label: 'sha', value: provenance.manifestSha256.slice(0, 10) },
        ],
      }
    },
    [dataset.datasetId, kgAdapter, provenance, supportedLenses.length],
  )

  const handleKgSelect = useCallback((selection: SigmaGraphReadonlySelection) => {
    setKgSelection(selection)
  }, [])
  const handleSnSelect = useCallback((selection: SigmaGraphReadonlySelection) => {
    setSnSelection(selection)
  }, [])
  const handleEmbeddingSelect = useCallback((itemId: string) => {
    setEmbeddingSelection(itemId)
  }, [])

  const nudgeKgTopology = useCallback(() => {
    setKgNudgeCount((value) => value + 1)
  }, [])

  const nudgeSnTopology = useCallback(() => {
    setSnNudgeCount((value) => value + 1)
  }, [])

  const nudgeOntologyTopology = useCallback(() => {
    setOntologyNudgeCount((value) => value + 1)
  }, [])

  const nudgeEmbeddingTopology = useCallback(() => {
    setEmbeddingNudgeCount((value) => value + 1)
  }, [])

  const handleKgViewportReady = useCallback((controller: SigmaGraphReadonlyViewportController | null) => {
    kgViewportRef.current = controller
    setKgZoomRatio(toDisplayZoom(controller?.getZoomRatio() ?? 1))
  }, [])

  const handleKgCameraChange = useCallback((ratio: number) => {
    setKgZoomRatio(toDisplayZoom(ratio))
  }, [])

  const handleSnViewportReady = useCallback((controller: SigmaGraphReadonlyViewportController | null) => {
    snViewportRef.current = controller
    setSnZoomRatio(toDisplayZoom(controller?.getZoomRatio() ?? 1))
  }, [])

  const handleSnCameraChange = useCallback((ratio: number) => {
    setSnZoomRatio(toDisplayZoom(ratio))
  }, [])

  const handleOntologyViewportReady = useCallback((controller: SigmaGraphReadonlyViewportController | null) => {
    ontologyViewportRef.current = controller
    setOntologyZoomRatio(toDisplayZoom(controller?.getZoomRatio() ?? 1))
  }, [])

  const handleOntologyCameraChange = useCallback((ratio: number) => {
    setOntologyZoomRatio(toDisplayZoom(ratio))
  }, [])

  const handleEmbeddingViewportReady = useCallback((controller: SigmaGraphReadonlyViewportController | null) => {
    embeddingViewportRef.current = controller
    setEmbeddingZoomRatio(toDisplayZoom(controller?.getZoomRatio() ?? 1))
  }, [])

  const handleEmbeddingCameraChange = useCallback((ratio: number) => {
    setEmbeddingZoomRatio(toDisplayZoom(ratio))
  }, [])

  const handleZoomIn = useCallback(() => {
    if (mode === 'knowledge-graph') {
      const controller = kgViewportRef.current
      if (!controller) return
      controller.zoomIn()
      window.setTimeout(() => setKgZoomRatio(toDisplayZoom(controller.getZoomRatio())), 220)
      return
    }
    if (mode === 'semantic-network') {
      const controller = snViewportRef.current
      if (!controller) return
      controller.zoomIn()
      window.setTimeout(() => setSnZoomRatio(toDisplayZoom(controller.getZoomRatio())), 220)
      return
    }
    if (mode === 'ontology') {
      const controller = ontologyViewportRef.current
      if (!controller) return
      controller.zoomIn()
      window.setTimeout(() => setOntologyZoomRatio(toDisplayZoom(controller.getZoomRatio())), 220)
      return
    }
    if (mode === 'embedding') {
      const controller = embeddingViewportRef.current
      if (!controller) return
      controller.zoomIn()
      window.setTimeout(() => setEmbeddingZoomRatio(toDisplayZoom(controller.getZoomRatio())), 220)
    }
  }, [mode])

  const handleZoomOut = useCallback(() => {
    if (mode === 'knowledge-graph') {
      const controller = kgViewportRef.current
      if (!controller) return
      controller.zoomOut()
      window.setTimeout(() => setKgZoomRatio(toDisplayZoom(controller.getZoomRatio())), 220)
      return
    }
    if (mode === 'semantic-network') {
      const controller = snViewportRef.current
      if (!controller) return
      controller.zoomOut()
      window.setTimeout(() => setSnZoomRatio(toDisplayZoom(controller.getZoomRatio())), 220)
      return
    }
    if (mode === 'ontology') {
      const controller = ontologyViewportRef.current
      if (!controller) return
      controller.zoomOut()
      window.setTimeout(() => setOntologyZoomRatio(toDisplayZoom(controller.getZoomRatio())), 220)
      return
    }
    if (mode === 'embedding') {
      const controller = embeddingViewportRef.current
      if (!controller) return
      controller.zoomOut()
      window.setTimeout(() => setEmbeddingZoomRatio(toDisplayZoom(controller.getZoomRatio())), 220)
    }
  }, [mode])

  const handleFit = useCallback(() => {
    if (mode === 'knowledge-graph') {
      const controller = kgViewportRef.current
      if (!controller) return
      controller.fit()
      window.setTimeout(() => setKgZoomRatio(toDisplayZoom(controller.getZoomRatio())), 240)
      return
    }
    if (mode === 'semantic-network') {
      const controller = snViewportRef.current
      if (!controller) return
      controller.fit()
      window.setTimeout(() => setSnZoomRatio(toDisplayZoom(controller.getZoomRatio())), 240)
      return
    }
    if (mode === 'ontology') {
      const controller = ontologyViewportRef.current
      if (!controller) return
      controller.fit()
      window.setTimeout(() => setOntologyZoomRatio(toDisplayZoom(controller.getZoomRatio())), 240)
      return
    }
    if (mode === 'embedding') {
      const controller = embeddingViewportRef.current
      if (!controller) return
      controller.fit()
      window.setTimeout(() => setEmbeddingZoomRatio(toDisplayZoom(controller.getZoomRatio())), 240)
    }
  }, [mode])

  const activeZoomRatio = mode === 'semantic-network'
    ? snZoomRatio
    : mode === 'embedding'
      ? embeddingZoomRatio
    : mode === 'ontology'
      ? ontologyZoomRatio
      : kgZoomRatio
  const edgeLabelsEnabled = mode === 'semantic-network'
    ? snEdgeLabels
    : mode === 'embedding'
      ? embeddingEdgeLabels
      : mode === 'ontology'
        ? ontologyEdgeLabels
        : kgEdgeLabels
  const handleToggleEdgeLabels = useCallback(() => {
    if (mode === 'knowledge-graph') {
      setKgEdgeLabels((value) => !value)
      return
    }
    if (mode === 'ontology') {
      setOntologyEdgeLabels((value) => !value)
      return
    }
    if (mode === 'embedding') {
      setEmbeddingEdgeLabels((value) => !value)
      return
    }
    if (mode === 'semantic-network') {
      setSnEdgeLabels((value) => !value)
    }
  }, [mode])
  const temporalSubmodeButtons = (
    <div className="flex flex-wrap gap-2 px-4 pb-2 pt-3">
      {SHOWCASE_TEMPORAL_SUBMODE_ORDER.map((submode) => {
        const supported = supportedTemporalSubmodes.includes(submode)
        return (
          <button
            key={submode}
            type="button"
            className={submode === temporalSubmode ? 'is-active' : ''}
            aria-pressed={submode === temporalSubmode}
            disabled={!supported}
            onClick={() => setTemporalSubmode(submode)}
          >
            {submode === 'timeline' ? 'Timeline' : submode === 'version-history' ? 'Versions' : submode === 'temporal-dashboard' ? 'Dashboard' : 'Evolution'}
          </button>
        )
      })}
    </div>
  )
  const analyticsSubmodeButtons = (
    <div className="flex flex-wrap gap-2 px-4 pb-2 pt-3">
      {SHOWCASE_ANALYTICS_SUBMODE_ORDER.map((submode) => {
        const supported = supportedAnalyticsSubmodes.includes(submode)
        return (
          <button
            key={submode}
            type="button"
            className={submode === analyticsSubmode ? 'is-active' : ''}
            aria-pressed={submode === analyticsSubmode}
            disabled={!supported}
            onClick={() => setAnalyticsSubmode(submode)}
          >
            {submode === 'centrality' ? 'Centrality' : 'Communities'}
          </button>
        )
      })}
    </div>
  )
  const zoomEnabled = mode === 'knowledge-graph'
    ? Boolean(kgViewportRef.current)
    : mode === 'embedding'
      ? Boolean(embeddingViewportRef.current)
    : mode === 'ontology'
      ? Boolean(ontologyViewportRef.current)
    : mode === 'semantic-network'
      ? Boolean(snViewportRef.current)
      : false

  return (
    <section
      className="asimov-minimalism semantica-showcase-reference flex h-full w-full flex-col overflow-hidden"
      data-testid="semantica-showcase-screen"
      aria-label="Semantica visualization showcase"
    >
      <Tabs
        value={mode}
        onValueChange={(next: string) => {
          // W5-04: refuse to switch to a lens the active dataset does not support
          if (!supportedLenses.includes(next as ShowcaseVisualizationMode)) {
            return
          }
          setMode(next as ShowcaseVisualizationMode)
        }}
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
              {MODES.map((m) => {
                const supported = supportedLenses.includes(m.mode)
                return (
                  <TabsTab
                    key={m.mode}
                    value={m.mode}
                    data-testid={`showcase-tab-${m.mode}`}
                    disabled={!supported}
                    aria-disabled={!supported}
                    title={
                      supported
                        ? undefined
                        : `Not supported by ${dataset.displayName}`
                    }
                    className={
                      supported
                        ? undefined
                        : 'showcase-ref-tab-disabled opacity-50 cursor-not-allowed hover:bg-transparent'
                    }
                  >
                    {m.label}
                  </TabsTab>
                )
              })}
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

        {kgAdapter && (
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
                { label: 'source', value: formatSourceLocation(dataset) },
                { label: 'semantica pin', value: provenance.semanticaCommit.slice(0, 7) },
                { label: 'fixture sha', value: provenance.manifestSha256.slice(0, 12) },
              ]}
              inventoryTitle="Entity types"
              inventoryItems={Object.entries(
                (dataset.kg?.entities ?? []).reduce<Record<string, number>>((acc, e) => {
                  acc[e.type] = (acc[e.type] ?? 0) + 1
                  return acc
                }, {}),
              ).map(([label, count]) => ({ label, count }))}
              summary={[
                { label: 'Layout', value: labels.layout },
                { label: 'Selection', value: kgSelection ? kgSelection.id : '—' },
                { label: 'Renderer', value: labels.renderer },
              ]}
            />
            <CenterPanel
              topology={kgTopology}
              onTopologyChange={setKgTopology}
              supportsTopology={Boolean(dataset.kg)}
              onNudge={nudgeKgTopology}
              zoomLabel={`${activeZoomRatio.toFixed(1)}x`}
              zoomEnabled={zoomEnabled}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onFit={handleFit}
              edgeLabelsEnabled={edgeLabelsEnabled}
              onToggleEdgeLabels={handleToggleEdgeLabels}
              sigmaControls={sigmaControls}
              onSigmaControlsChange={setSigmaControls}
            >
              <KgShowcaseView
                input={kgAdapter.renderer}
                onSelect={handleKgSelect}
                selection={kgSelection}
                positions={kgPositions}
                sigmaControls={sigmaControls}
                onViewportReady={handleKgViewportReady}
                onCameraChange={handleKgCameraChange}
                renderEdgeLabels={kgEdgeLabels}
                showNodeDetail={sigmaControls.showProperties}
              />
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
        )}

        {ontologyAdapter && (
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
                { label: 'source', value: formatSourceLocation(dataset) },
                { label: 'derivation', value: 'deterministic' },
              ]}
              inventoryTitle="Classes"
              inventoryItems={(dataset.ontology?.classes ?? []).map((c) => ({
                label: c.label,
                hint: c.kind,
                count: c.instanceCount,
              }))}
              summary={[
                { label: 'Hierarchy depth', value: String(ontologyAdapter.maxDepth + 1) },
                { label: 'Properties', value: String(dataset.ontology?.properties.length ?? 0) },
                { label: 'Selection', value: ontologySelection ?? '—' },
              ]}
            />
            <CenterPanel
              topology={ontologyTopology}
              onTopologyChange={setOntologyTopology}
              supportsTopology={Boolean(dataset.ontology)}
              onNudge={nudgeOntologyTopology}
              zoomLabel={`${activeZoomRatio.toFixed(1)}x`}
              zoomEnabled={zoomEnabled}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onFit={handleFit}
              edgeLabelsEnabled={edgeLabelsEnabled}
              onToggleEdgeLabels={handleToggleEdgeLabels}
              sigmaControls={sigmaControls}
              onSigmaControlsChange={setSigmaControls}
            >
              <OntologyShowcaseView
                input={ontologyAdapter.renderer}
                hierarchy={ontologyAdapter.hierarchy}
                maxDepth={ontologyAdapter.maxDepth}
                selectedClassId={ontologySelection}
                onSelect={setOntologySelection}
                positions={ontologyPositions}
                sigmaControls={sigmaControls}
                onViewportReady={handleOntologyViewportReady}
                onCameraChange={handleOntologyCameraChange}
                renderEdgeLabels={ontologyEdgeLabels}
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
        )}

        {embeddingAdapter && (
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
                { label: 'source', value: formatSourceLocation(dataset) },
                { label: 'projection', value: 'deterministic 2D hash' },
              ]}
              inventoryTitle="Items"
              inventoryItems={(dataset.embedding?.items ?? []).map((item) => ({
                label: item.label,
                hint: item.text,
              }))}
              summary={[
                { label: 'Dimension', value: '2D' },
                { label: 'Method', value: 'deterministic hash' },
                { label: 'Selection', value: embeddingSelection ?? '—' },
              ]}
            />
            <CenterPanel
              topology={embeddingTopology}
              onTopologyChange={setEmbeddingTopology}
              supportsTopology={Boolean(dataset.embedding)}
              onNudge={nudgeEmbeddingTopology}
              zoomLabel={`${activeZoomRatio.toFixed(1)}x`}
              zoomEnabled={zoomEnabled}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onFit={handleFit}
              edgeLabelsEnabled={edgeLabelsEnabled}
              onToggleEdgeLabels={handleToggleEdgeLabels}
              sigmaControls={sigmaControls}
              onSigmaControlsChange={setSigmaControls}
            >
              <EmbeddingShowcaseView
                input={embeddingAdapter.renderer}
                positions={embeddingPositions}
                sigmaControls={sigmaControls}
                selectedItemId={embeddingSelection}
                onSelect={handleEmbeddingSelect}
                onViewportReady={handleEmbeddingViewportReady}
                onCameraChange={handleEmbeddingCameraChange}
                renderEdgeLabels={embeddingEdgeLabels}
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
        )}

        {semanticNetworkAdapter && (
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
                { label: 'source', value: formatSourceLocation(dataset) },
                { label: 'renderer', value: 'Sigma/Graphology (readonly core)' },
              ]}
              inventoryTitle="Node types"
              inventoryItems={semanticNetworkAdapter.distribution.nodeTypes.map((item) => ({
                label: item.label,
                count: item.count,
              }))}
              summary={[
                { label: 'Layout', value: labels.layout },
                { label: 'Edge types', value: String(semanticNetworkAdapter.distribution.edgeTypes.length) },
                { label: 'Selection', value: snSelection ? snSelection.id : '—' },
              ]}
            />
            <CenterPanel
              topology={snTopology}
              onTopologyChange={setSnTopology}
              supportsTopology={Boolean(dataset.semanticNetwork)}
              onNudge={nudgeSnTopology}
              zoomLabel={`${activeZoomRatio.toFixed(1)}x`}
              zoomEnabled={zoomEnabled}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onFit={handleFit}
              edgeLabelsEnabled={edgeLabelsEnabled}
              onToggleEdgeLabels={handleToggleEdgeLabels}
              sigmaControls={sigmaControls}
              onSigmaControlsChange={setSigmaControls}
            >
              <SemanticNetworkShowcaseView
                input={semanticNetworkAdapter.renderer}
                onSelect={handleSnSelect}
                selection={snSelection}
                positions={snPositions}
                sigmaControls={sigmaControls}
                onViewportReady={handleSnViewportReady}
                onCameraChange={handleSnCameraChange}
                renderEdgeLabels={snEdgeLabels}
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
        )}

        {temporalAdapter && (
          <TabsPanel value="temporal" className="showcase-ref-grid">
            <LeftInventory
              title="Temporal"
              datasetSelector={
                <DatasetSelector
                  registry={registry}
                  value={datasetId}
                  onChange={handleDatasetChange}
                />
              }
              rows={[
                { label: 'name', value: dataset.displayName },
                { label: 'source', value: formatSourceLocation(dataset) },
                { label: 'mode', value: temporalSubmode },
              ]}
              inventoryTitle={temporalAdapter.kind === 'version-history' ? 'Versions' : 'Events'}
              inventoryItems={
                temporalAdapter.kind === 'timeline'
                  ? temporalAdapter.events.map((event) => ({ label: event.label, hint: event.type }))
                  : temporalAdapter.kind === 'version-history'
                    ? temporalAdapter.versions.map((version) => ({ label: version.label, hint: version.changes }))
                    : temporalAdapter.kind === 'temporal-dashboard'
                      ? temporalAdapter.entities.map((entity) => ({ label: entity.label, hint: entity.type }))
                      : temporalAdapter.nodes.map((node) => ({ label: node.label, hint: node.type }))
              }
              summary={
                temporalAdapter.kind === 'timeline'
                  ? temporalAdapter.metrics.map((metric) => ({ label: metric.label, value: metric.value }))
                  : temporalAdapter.kind === 'version-history'
                    ? temporalAdapter.metrics.map((metric) => ({ label: metric.label, value: metric.value }))
                    : temporalAdapter.kind === 'temporal-dashboard'
                      ? temporalAdapter.metrics.map((metric) => ({ label: metric.label, value: metric.value }))
                      : temporalAdapter.metrics.map((metric) => ({ label: metric.label, value: metric.value }))
              }
            />
            <CenterPanel supportsTopology={false}>
              {temporalSubmodeButtons}
              <TemporalShowcaseView adapter={temporalAdapter} />
            </CenterPanel>
            <RightRail
              inspector={temporalAdapter.inspector}
              metrics={temporalAdapter.metrics}
              title="Temporal"
              statusRows={[
                { label: 'provenance', value: provenance.source },
                { label: 'fixture sha', value: provenance.manifestSha256.slice(0, 12) },
              ]}
            />
          </TabsPanel>
        )}

        {analyticsAdapter && (
          <TabsPanel value="analytics" className="showcase-ref-grid">
            <LeftInventory
              title="Analytics"
              datasetSelector={
                <DatasetSelector
                  registry={registry}
                  value={datasetId}
                  onChange={handleDatasetChange}
                />
              }
              rows={[
                { label: 'name', value: dataset.displayName },
                { label: 'source', value: formatSourceLocation(dataset) },
                { label: 'mode', value: analyticsSubmode },
              ]}
              inventoryTitle={analyticsAdapter.kind === 'centrality' ? 'Ranked nodes' : 'Communities'}
              inventoryItems={
                analyticsAdapter.kind === 'centrality'
                  ? analyticsAdapter.rankings.map((item) => ({ label: item.nodeId, hint: item.score.toFixed(3) }))
                  : analyticsAdapter.communities.map((community) => ({ label: String(community.id), hint: community.nodeIds.join(', ') }))
              }
              summary={analyticsAdapter.metrics.map((metric) => ({ label: metric.label, value: metric.value }))}
            />
            <CenterPanel supportsTopology={false}>
              {analyticsSubmodeButtons}
              <AnalyticsShowcaseView adapter={analyticsAdapter} />
            </CenterPanel>
            <RightRail
              inspector={analyticsAdapter.inspector}
              metrics={analyticsAdapter.metrics}
              title="Analytics"
              statusRows={[
                { label: 'provenance', value: provenance.source },
                { label: 'fixture sha', value: provenance.manifestSha256.slice(0, 12) },
              ]}
            />
          </TabsPanel>
        )}

        {/* W5-04 fallback: if no supported lens is active (impossible after
            W5-05 fallback, but defensive), surface an "unsupported" panel. */}
        {!kgAdapter && !ontologyAdapter && !embeddingAdapter && !semanticNetworkAdapter && !temporalAdapter && !analyticsAdapter && (
          <TabsPanel value={mode} className="showcase-ref-grid">
            <CenterPanel>
              <div
                className="flex h-full items-center justify-center font-mono text-sm text-muted-foreground"
                data-testid="showcase-unsupported-state"
              >
                No supported lenses for {dataset.displayName}.
              </div>
            </CenterPanel>
          </TabsPanel>
        )}
      </Tabs>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} initialSection="hermes" />

      <footer className="showcase-ref-statusbar" data-testid="showcase-status-bar">
        <div className="showcase-ref-status-group">
          {footerMeta.left.map((item) => (
            <span key={item.label} className="showcase-ref-status-item">
              {item.label} <strong>{item.value}</strong>
            </span>
          ))}
        </div>
        <div className="showcase-ref-status-group">
          {footerMeta.right.map((item) => (
            <span key={item.label} className="showcase-ref-status-item">
              {item.label} <strong>{item.value}</strong>
            </span>
          ))}
        </div>
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

function CenterPanel({
  children,
  topology = 'layout',
  onTopologyChange = () => undefined,
  supportsTopology = false,
  onNudge,
  zoomLabel = '1.0x',
  zoomEnabled = false,
  onZoomIn,
  onZoomOut,
  onFit,
  edgeLabelsEnabled = true,
  onToggleEdgeLabels,
  sigmaControls = DEFAULT_SIGMA_CONTROLS,
  onSigmaControlsChange = () => undefined,
}: {
  children: React.ReactNode
  topology?: GraphTopologyMode
  onTopologyChange?: (next: GraphTopologyMode) => void
  supportsTopology?: boolean
  onNudge?: () => void
  zoomLabel?: string
  zoomEnabled?: boolean
  onZoomIn?: () => void
  onZoomOut?: () => void
  onFit?: () => void
  edgeLabelsEnabled?: boolean
  onToggleEdgeLabels?: () => void
  sigmaControls?: SigmaControlState
  onSigmaControlsChange?: (next: SigmaControlState) => void
}) {
  const layoutModes: Array<{ value: GraphTopologyMode; label: string }> = [
    { value: 'force-directed', label: 'Force' },
    { value: 'hierarchical', label: 'Hierarchical' },
    { value: 'radial', label: 'Radial' },
    { value: 'circular', label: 'Circular' },
    { value: 'communities', label: 'Communities' },
  ]
  const activeLayout = topology === 'layout' ? 'force-directed' : topology

  return (
    <section className="showcase-ref-panel showcase-ref-center relative flex min-h-0 flex-col overflow-hidden">
      <div className="showcase-ref-ruler" aria-hidden="true" />
      <div className="showcase-ref-grid-canvas" aria-hidden="true" />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col p-3 pt-5">{children}</div>
      {supportsTopology ? (
        <div className="showcase-ref-canvas-footer" aria-label="Visualization controls">
          <div className="showcase-ref-canvas-group" role="radiogroup" aria-label="Graph topology controls">
            <span className="showcase-ref-canvas-label">LAYOUT</span>
            {layoutModes.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={activeLayout === item.value}
                className={activeLayout === item.value ? 'is-active' : ''}
                onClick={() => onTopologyChange(item.value)}
                data-testid={`topology-${item.value}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="showcase-ref-canvas-group" aria-label="Canvas mode controls">
            <span className="showcase-ref-canvas-label">MODE</span>
            <button type="button" className="is-active" aria-pressed="true">View</button>
            <button type="button">Select</button>
            <button type="button">Path</button>
            <span className="showcase-ref-canvas-separator" aria-hidden="true" />
            <span className="showcase-ref-canvas-label">ZOOM</span>
            <button type="button" className="showcase-ref-canvas-zoom" onClick={onZoomOut} disabled={!zoomEnabled}>-</button>
            <span className="showcase-ref-canvas-zoom-value">{zoomLabel}</span>
            <button type="button" className="showcase-ref-canvas-zoom" onClick={onZoomIn} disabled={!zoomEnabled}>+</button>
            <span className="showcase-ref-canvas-separator" aria-hidden="true" />
            <button type="button" className="is-caps" onClick={onFit} disabled={!zoomEnabled}>FIT</button>
            {onNudge ? <button type="button" className="is-caps" onClick={onNudge}>NUDGE</button> : null}
            {onToggleEdgeLabels ? (
              <>
                <span className="showcase-ref-canvas-separator" aria-hidden="true" />
                <span className="showcase-ref-canvas-label">EDGES</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={edgeLabelsEnabled}
                  aria-label="Toggle edge labels"
                  className="showcase-ref-edge-toggle"
                  onClick={onToggleEdgeLabels}
                  data-testid="edge-label-toggle"
                >
                  <span className="showcase-ref-edge-toggle-thumb" aria-hidden="true" />
                  <span className="showcase-ref-edge-toggle-label">
                    {edgeLabelsEnabled ? 'ON' : 'OFF'}
                  </span>
                </button>
              </>
            ) : null}
            <span className="showcase-ref-canvas-separator" aria-hidden="true" />
            <SigmaControls
              topology={topology}
              onTopologyChange={onTopologyChange}
              controls={sigmaControls}
              onControlsChange={onSigmaControlsChange}
            />
          </div>
        </div>
      ) : null}
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
