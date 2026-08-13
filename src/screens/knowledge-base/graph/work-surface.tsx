import { AlertCircle, Download, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { GraphCanvas } from './graph-canvas'
import { GraphConflictCompare } from './graph-conflict-compare'
import { GraphFiltersRail } from './graph-filters'
import { GraphGovernanceActions } from './graph-governance-actions'
import { GraphImpactPanel } from './graph-impact-panel'
import { GraphInspector } from './graph-inspector'
import { GRAPH_COPY, GraphLensTabs } from './graph-lenses'
import { GraphReplayPanel } from './graph-replay-panel'
import {
  materializeSemanticaRelease,
  resolveGovernedGraphProjection,
  submitSemanticaGrounding,
} from './graph-api-client'
import { defaultLensForEntry, useGraphSearch } from './use-graph-search'
import type { GraphFilters } from './use-graph-search'
import type {
  GovernedGraphDeepLink,
  GraphLens,
  GraphSelection,
} from './graph-types'
import { useSettingsStore } from '@/hooks/use-settings'
import { Button } from '@/components/ui/button'
import { useKnowledgeWorkbenchStore } from '@/stores/knowledge-workbench-store'

export function GovernedGraphWorkSurface({
  entryTab,
  deepLink,
}: {
  entryTab: 'legal' | 'governance'
  deepLink: GovernedGraphDeepLink
}) {
  const locale = useSettingsStore((state) => state.settings.locale)
  const copy = locale === 'zh' ? GRAPH_COPY.zh : GRAPH_COPY.en
  const entryLens = defaultLensForEntry(entryTab)
  const [lens, setLens] = useState<GraphLens>(deepLink.lens ?? entryLens)
  const [selection, setSelection] = useState<GraphSelection>({
    type: deepLink.assertionId ? 'edge' : 'node',
    id: deepLink.assertionId ?? deepLink.nodeId ?? 'assertion:qualification',
  })
  const [filters, setFilters] = useState<GraphFilters>({
    query: '',
    kind: 'all',
    tier: 'all',
    authorityRole: 'all',
    governanceState: 'all',
  })
  const setWorkbenchContext = useKnowledgeWorkbenchStore(
    (state) => state.setContext,
  )
  const workbenchPresentation = useKnowledgeWorkbenchStore(
    (state) => state.presentation,
  )
  const [semanticaEventId, setSemanticaEventId] = useState<string | null>(null)
  const [semanticaMessage, setSemanticaMessage] = useState('')

  const projectionQuery = useQuery({
    queryKey: ['governed-graph-projection', entryLens, deepLink],
    queryFn: () => resolveGovernedGraphProjection(deepLink, entryLens),
  })
  const projection = projectionQuery.data
  const matches = useGraphSearch(projection ?? emptyProjection, filters)
  const highlightedNodeId =
    matches.length === 1 && filters.query.trim() ? matches[0].id : undefined

  useEffect(() => {
    if (!projection) return
    const selectedNodeIds = selection.type === 'node' ? [selection.id] : []
    const selectedEdgeIds = selection.type === 'edge' ? [selection.id] : []
    setWorkbenchContext({
      candidateGraphId: projection.projectionId || null,
      acceptedReleaseId: null,
      acceptedReleaseVersion: null,
      selectedNodeIds,
      selectedEdgeIds,
      selectedRuleIds: [],
      sourceAnchors: projection.nodes.flatMap((node) =>
        node.sourceLocator && node.sourceHash
          ? [
              {
                sourceRef: node.sourceTitle || node.detailRef,
                sourceHash: node.sourceHash,
                locator: node.sourceLocator,
                quote: null,
              },
            ]
          : [],
      ),
      governanceState: 'candidate',
      hasAcceptedRelease: false,
      extractionRunId: null,
      providerRef: null,
      providerCommit: null,
    })
  }, [projection, selection, setWorkbenchContext])

  useEffect(() => {
    if (deepLink.lens) setLens(deepLink.lens)
  }, [deepLink.lens])

  const freshnessLabel = useMemo(() => {
    if (!projection) return ''
    return projection.freshness.status === 'fresh'
      ? copy.freshnessFresh
      : copy.freshnessBlocked
  }, [copy.freshnessBlocked, copy.freshnessFresh, projection])

  if (!projection) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-muted-foreground">
        {projectionQuery.isError
          ? 'graph_projection_unavailable'
          : 'Loading governed graph...'}
      </div>
    )
  }

  return (
    <main
      lang={locale === 'zh' ? 'zh-CN' : 'en'}
      className="flex h-full min-h-0 flex-col gap-4 bg-background p-4 text-foreground"
    >
      <header className="rounded-card border border-border bg-card px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-base font-semibold">{copy.title}</h1>
            <p className="text-xs text-muted-foreground">{copy.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md border border-border px-2 py-1">
              {copy.snapshot}: {projection.graphSnapshotRef}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1">
              <AlertCircle className="size-3" aria-hidden="true" />
              {freshnessLabel}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void projectionQuery.refetch()}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              refresh
            </Button>
            <Button
              size="sm"
              disabled={
                !projection.nodes.some((node) =>
                  node.capabilities.includes('export_evidence'),
                )
              }
            >
              <Download className="size-4" aria-hidden="true" />
              {copy.exportEvidence}
            </Button>
          </div>
        </div>
        <div className="mt-3">
          <GraphLensTabs lens={lens} copy={copy} onChange={setLens} />
        </div>
        {projection.omission.hiddenNodeCount > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {copy.hiddenOmission}: {projection.omission.hiddenNodeCount}{' '}
            {copy.nodesOmitted}; {projection.omission.minimizedLabelCount}{' '}
            {copy.labelsMinimized}.
          </p>
        ) : null}
      </header>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        <GraphFiltersRail
          projection={projection}
          copy={copy}
          filters={filters}
          matches={matches}
          onFiltersChange={setFilters}
          onSelect={setSelection}
        />
        <GraphCanvas
          projection={projection}
          lens={lens}
          selection={selection}
          highlightedNodeId={highlightedNodeId}
          highlightedNodeIds={workbenchPresentation.highlightedNodeIds}
          highlightedEdgeIds={workbenchPresentation.highlightedEdgeIds}
          dimOthers={workbenchPresentation.dimOthers}
          onSelect={setSelection}
        />
        <GraphInspector
          projection={projection}
          selection={selection}
          copy={copy}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <GraphConflictCompare projection={projection} copy={copy} />
        <GraphImpactPanel projection={projection} copy={copy} />
        <GraphReplayPanel projection={projection} copy={copy} />
      </div>
      <GraphGovernanceActions
        projection={projection}
        selection={selection}
        copy={copy}
        onCompleted={() => void projectionQuery.refetch()}
      />
      {deepLink.candidateId ? (
        <section className="rounded-card border border-border bg-card p-4" data-testid="semantica-review-actions">
          <h2 className="text-sm font-semibold">Semantica candidate grounding</h2>
          <p className="mt-1 text-xs text-muted-foreground">Candidate: {deepLink.candidateId}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              data-testid="semantica-accept-candidate"
              onClick={() => void (async () => {
                try {
                  const result = await submitSemanticaGrounding({
                    assertionId: deepLink.candidateId!,
                    decision: 'accept',
                    justification: 'Browser reviewer confirmed the source-grounded candidate.',
                  })
                  setSemanticaEventId(result.learningEvent.event_id)
                  setSemanticaMessage(`accepted:${result.learningEvent.event_id}`)
                } catch { setSemanticaMessage('grounding_failed') }
              })()}
            >Accept candidate</Button>
            <Button
              size="sm"
              variant="outline"
              data-testid="semantica-reject-candidate"
              onClick={() => void (async () => {
                try {
                  const result = await submitSemanticaGrounding({
                    assertionId: deepLink.candidateId!,
                    decision: 'reject',
                    justification: 'Browser reviewer rejected the candidate.',
                  })
                  setSemanticaEventId(result.learningEvent.event_id)
                  setSemanticaMessage(`rejected:${result.learningEvent.event_id}`)
                } catch { setSemanticaMessage('grounding_failed') }
              })()}
            >Reject candidate</Button>
            <Button
              size="sm"
              disabled={!semanticaEventId}
              data-testid="semantica-materialize-release"
              onClick={() => void (async () => {
                try {
                  const result = await materializeSemanticaRelease({
                    assertionId: deepLink.candidateId!,
                    humanEventId: semanticaEventId!,
                  })
                  setSemanticaMessage(`release:${result.graphRelease?.graph_version ?? 'created'}`)
                  setWorkbenchContext({
                    candidateGraphId: deepLink.candidateId!,
                    acceptedReleaseId: result.graphRelease?.release_id ?? result.graphRelease?.graph_version ?? null,
                    acceptedReleaseVersion: result.graphRelease?.graph_version ?? null,
                    selectedNodeIds: selection.type === 'node' ? [selection.id] : [],
                    selectedEdgeIds: selection.type === 'edge' ? [selection.id] : [],
                    selectedRuleIds: [], sourceAnchors: [], governanceState: 'active',
                    hasAcceptedRelease: true, extractionRunId: null, providerRef: null, providerCommit: null,
                  })
                } catch { setSemanticaMessage('materialization_failed') }
              })()}
            >Materialize accepted release</Button>
          </div>
          {semanticaMessage ? <p className="mt-2 text-xs text-muted-foreground" data-testid="semantica-review-status">{semanticaMessage}</p> : null}
        </section>
      ) : null}
    </main>
  )
}

const emptyProjection = {
  projectionId: '',
  asOf: '',
  authorizationContextRef: '',
  graphSnapshotRef: '',
  semanticProjectionHash: '',
  presentationHash: '',
  freshness: {
    status: 'fresh' as const,
    sourceRef: '',
    message: '',
  },
  warnings: [],
  nodes: [],
  edges: [],
  scenes: [
    {
      id: 'empty',
      lens: 'overview' as const,
      title: '',
      description: '',
      layoutProfile: 'evidence_chain' as const,
      focusNodeId: '',
      nodeIds: [],
      edgeIds: [],
    },
  ],
  omission: {
    hiddenNodeCount: 0,
    hiddenEdgeCount: 0,
    minimizedLabelCount: 0,
  },
  conflicts: [],
  impacts: [],
  events: [],
}
