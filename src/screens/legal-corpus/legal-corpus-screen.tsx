import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  CheckListIcon,
  Clock01Icon,
  Search01Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import {
  fetchLegalAcceptanceEvidence,
  fetchLegalAcceptanceEvidenceExports,
  fetchLegalCorpusDashboard,
  fetchLegalCorpusInventory,
  fetchLegalEvidenceContract,
  type LegalAcceptanceEvidenceExportRef,
  type LegalCorpusInventory,
  type LegalSemanticCandidate,
  type LegalSource,
  type LegalSourceArtifact,
  type LegalSourceSection,
  type LegalVersionEdge,
  type LegalSourceVersion,
} from '@/lib/legal-corpus'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/stores/workspace-store'

function shortRef(value?: string | null): string {
  if (!value) return 'not recorded'
  if (value.length <= 34) return value
  return `${value.slice(0, 16)}...${value.slice(-10)}`
}

function percent(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'n/a'
  return `${Math.round(value * 100)}%`
}

function metricValue(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'n/a'
  if (value <= 1 && value >= 0) return percent(value)
  return String(value)
}

function parseSpan(candidate: LegalSemanticCandidate): string {
  if (!candidate.source_span_json) return 'span not recorded'
  try {
    const span = JSON.parse(candidate.source_span_json) as Record<string, unknown>
    const locator = String(span.stable_locator ?? 'locator pending')
    const start = span.char_start
    const end = span.char_end
    return `${locator} ${start ?? '?'}-${end ?? '?'}`
  } catch {
    return 'span parse failed'
  }
}

function parseSectionSpan(section: LegalSourceSection): string {
  if (!section.anchor_json) return 'span pending'
  try {
    const anchor = JSON.parse(section.anchor_json) as Record<string, unknown>
    const start = anchor.char_start
    const end = anchor.char_end
    return `${start ?? '?'}-${end ?? '?'}`
  } catch {
    return 'span parse failed'
  }
}

function sourceVersions(
  inventory: LegalCorpusInventory | undefined,
  sourceId: string | undefined,
): Array<LegalSourceVersion> {
  if (!inventory || !sourceId) return []
  return inventory.versions.filter((version) => version.source_id === sourceId)
}

function latestVersion(versions: Array<LegalSourceVersion>) {
  return versions.at(-1)
}

type SourceBundle = {
  source?: LegalSource
  version?: LegalSourceVersion
  artifacts: Array<LegalSourceArtifact>
  sections: Array<LegalSourceSection>
  candidates: Array<LegalSemanticCandidate>
  versionEdges: Array<LegalVersionEdge>
}

function buildBundle(
  inventory: LegalCorpusInventory | undefined,
  selectedSourceId: string | undefined,
): SourceBundle {
  const source = inventory?.sources.find(
    (item) => item.source_id === selectedSourceId,
  )
  const version = latestVersion(sourceVersions(inventory, selectedSourceId))
  if (!inventory || !version) {
    return {
      source,
      version,
      artifacts: [],
      sections: [],
      candidates: [],
      versionEdges: [],
    }
  }
  return {
    source,
    version,
    artifacts: inventory.artifacts.filter(
      (artifact) => artifact.version_id === version.version_id,
    ),
    sections: inventory.sections.filter(
      (section) => section.version_id === version.version_id,
    ),
    candidates: inventory.semantic_candidates.filter(
      (candidate) => candidate.version_id === version.version_id,
    ),
    versionEdges: inventory.version_edges.filter(
      (edge) =>
        edge.from_version_id === version.version_id ||
        edge.to_version_id === version.version_id,
    ),
  }
}

export function LegalCorpusScreen() {
  const [selectedSourceId, setSelectedSourceId] = useState<string | undefined>()
  const [selectedCandidateId, setSelectedCandidateId] = useState<
    string | undefined
  >()
  const setChatPanelOpen = useWorkspaceStore((s) => s.setChatPanelOpen)
  const setLegalContext = useWorkspaceStore((s) => s.setLegalCorpusChatContext)

  const inventoryQuery = useQuery({
    queryKey: ['legal-corpus', 'inventory'],
    queryFn: fetchLegalCorpusInventory,
    staleTime: 10_000,
  })
  const dashboardQuery = useQuery({
    queryKey: ['legal-corpus', 'dashboard'],
    queryFn: fetchLegalCorpusDashboard,
    staleTime: 10_000,
  })
  const evidenceContractQuery = useQuery({
    queryKey: ['legal-corpus', 'pipeline2-evidence-contract'],
    queryFn: fetchLegalEvidenceContract,
    staleTime: 10_000,
  })
  const persistedExportsQuery = useQuery({
    queryKey: ['legal-corpus', 'acceptance-evidence-exports'],
    queryFn: fetchLegalAcceptanceEvidenceExports,
    staleTime: 10_000,
  })

  const inventory = inventoryQuery.data
  useEffect(() => {
    if (!selectedSourceId && inventory?.sources[0]) {
      setSelectedSourceId(inventory.sources[0].source_id)
    }
  }, [inventory, selectedSourceId])

  const bundle = useMemo(
    () => buildBundle(inventory, selectedSourceId),
    [inventory, selectedSourceId],
  )
  const selectedCandidate =
    bundle.candidates.find(
      (candidate) => candidate.candidate_id === selectedCandidateId,
    ) ?? bundle.candidates[0]

  const exportMutation = useMutation({
    mutationFn: () =>
      fetchLegalAcceptanceEvidence(`legal-corpus-${Date.now()}`),
    onSuccess: (payload) => {
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${payload.test_run_id || 'legal-corpus-evidence'}.json`
      link.click()
      URL.revokeObjectURL(url)
    },
  })

  function bindChatContext(actionType: string) {
    if (!bundle.source) return
    setLegalContext({
      sourceId: bundle.source.source_id,
      title: bundle.source.canonical_title || bundle.source.source_id,
      versionId: bundle.version?.version_id,
      lifecycleState: bundle.version?.lifecycle_state,
      authorityTier: bundle.source.authority_tier,
      candidateCount: bundle.candidates.length,
      anchorCount: bundle.sections.length,
    })
    setChatPanelOpen(true)
    return actionType
  }

  const metrics = dashboardQuery.data?.metrics ?? {}
  const lifecycleStates = [
    'ACTIVE',
    'CERTIFIED',
    'DRAFT',
    'CONSULTATION',
    'REGISTERED',
    'CHANGE_DETECTED',
    'SUPERSEDED',
    'REPEALED',
    'UNRESOLVED',
  ]

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="border-b border-border px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Legal Corpus</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Chinese tender authority substrate
            </p>
          </div>
          <button
            type="button"
            onClick={() => exportMutation.mutate()}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:bg-primary/10"
          >
            <HugeiconsIcon icon={Tick02Icon} size={15} strokeWidth={1.6} />
            Export evidence
          </button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)_300px]">
        <aside className="min-h-0 border-b border-border lg:border-b-0 lg:border-r">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <HugeiconsIcon icon={Search01Icon} size={15} strokeWidth={1.6} />
              Source inventory
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <Metric label="Sources" value={inventory?.metrics.source_count} />
              <Metric label="Versions" value={inventory?.metrics.version_count} />
              <Metric label="Claims" value={inventory?.metrics.semantic_candidate_count} />
            </div>
          </div>
          <div className="max-h-[34vh] overflow-y-auto p-2 lg:max-h-none">
            {inventoryQuery.isError ? (
              <EmptyState label="Legal corpus API unavailable" />
            ) : inventory?.sources.length ? (
              inventory.sources.map((source) => {
                const versions = sourceVersions(inventory, source.source_id)
                const current = latestVersion(versions)
                return (
                  <button
                    key={source.source_id}
                    type="button"
                    onClick={() => {
                      setSelectedSourceId(source.source_id)
                      setSelectedCandidateId(undefined)
                    }}
                    className={cn(
                      'mb-2 w-full rounded-md border p-3 text-left transition-colors',
                      selectedSourceId === source.source_id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/60 hover:bg-muted',
                    )}
                  >
                    <div className="line-clamp-2 text-sm font-semibold">
                      {source.canonical_title || source.source_id}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                      <Badge>{source.authority_tier || 'tier pending'}</Badge>
                      <Badge>{current?.lifecycle_state || 'unresolved'}</Badge>
                      <Badge>{versions.length} versions</Badge>
                    </div>
                  </button>
                )
              })
            ) : (
              <EmptyState label="No governed legal sources" />
            )}
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto p-4 sm:p-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
            <div className="rounded-md border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">
                    {bundle.source?.canonical_title || 'No source selected'}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {bundle.source?.issuer || 'issuer pending'} /{' '}
                    {bundle.source?.jurisdiction || 'jurisdiction pending'}
                  </p>
                </div>
                <Badge>{bundle.version?.lifecycle_state || 'unresolved'}</Badge>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Fact label="Authority" value={bundle.source?.authority_tier} />
                <Fact label="Version" value={bundle.version?.version_identity} />
                <Fact label="Effectivity" value={bundle.version?.effective_from} />
                <Fact label="Source hash" value={shortRef(bundle.version?.source_hash)} />
              </div>
            </div>

            <div className="rounded-md border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <HugeiconsIcon icon={Clock01Icon} size={15} strokeWidth={1.6} />
                Pipeline state
              </div>
              <div className="mt-3 space-y-2">
                {lifecycleStates.map((state) => (
                  <div
                    key={state}
                    className={cn(
                      'flex items-center justify-between rounded border px-2 py-1.5 text-xs',
                      bundle.version?.lifecycle_state === state
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border text-muted-foreground',
                    )}
                  >
                    <span>{state}</span>
                    <span>
                      {bundle.version?.lifecycle_state === state ? 'current' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <InspectorPanel title="Raw artifacts">
              {bundle.artifacts.length ? (
                bundle.artifacts.map((artifact) => (
                  <Row key={artifact.artifact_id}>
                    <div>
                      <div className="font-medium">
                        {artifact.artifact_kind || 'artifact'}
                      </div>
                      <div className="text-muted-foreground">
                        {artifact.mime_type || 'mime pending'} /{' '}
                        {shortRef(artifact.uri)}
                      </div>
                    </div>
                    <code>{shortRef(artifact.content_hash)}</code>
                  </Row>
                ))
              ) : (
                <EmptyState label="No raw artifact recorded" />
              )}
            </InspectorPanel>

            <InspectorPanel title="Article anchors">
              {bundle.sections.length ? (
                bundle.sections.slice(0, 8).map((section) => (
                  <Row key={section.section_id}>
                    <div>
                      <div className="font-medium">
                        {section.stable_locator || section.section_id}
                      </div>
                      <div className="text-muted-foreground">
                        {section.title || section.ordinal || 'heading pending'} /{' '}
                        {parseSectionSpan(section)}
                      </div>
                    </div>
                    <code>{shortRef(section.local_hash)}</code>
                  </Row>
                ))
              ) : (
                <EmptyState label="No article anchors recorded" />
              )}
            </InspectorPanel>

            <InspectorPanel title="Version lineage">
              {bundle.versionEdges.length ? (
                bundle.versionEdges.map((edge) => (
                  <Row key={edge.edge_id}>
                    <div>
                      <div className="font-medium">
                        {edge.edge_type || 'lineage'}
                      </div>
                      <div className="text-muted-foreground">
                        {shortRef(edge.from_version_id)} to{' '}
                        {shortRef(edge.to_version_id)}
                      </div>
                    </div>
                  </Row>
                ))
              ) : (
                <EmptyState label="No lineage edge recorded" />
              )}
            </InspectorPanel>
          </div>

          <div className="mt-4 rounded-md border border-border bg-card">
            <div className="border-b border-border px-4 py-3 text-sm font-semibold">
              Extracted claims and source spans
            </div>
            <div className="divide-y divide-border">
              {bundle.candidates.length ? (
                bundle.candidates.map((candidate) => (
                  <button
                    key={candidate.candidate_id}
                    type="button"
                    onClick={() => setSelectedCandidateId(candidate.candidate_id)}
                    className={cn(
                      'grid w-full gap-2 px-4 py-3 text-left text-sm transition-colors md:grid-cols-[140px_minmax(0,1fr)_180px]',
                      selectedCandidate?.candidate_id === candidate.candidate_id
                        ? 'bg-primary/10'
                        : 'hover:bg-muted',
                    )}
                  >
                    <span className="font-semibold">
                      {candidate.candidate_type || 'candidate'}
                    </span>
                    <span className="truncate">
                      {candidate.candidate_text || candidate.candidate_id}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {parseSpan(candidate)}
                    </span>
                  </button>
                ))
              ) : (
                <EmptyState label="No extracted claims recorded" />
              )}
            </div>
          </div>
        </section>

        <aside className="min-h-0 overflow-y-auto border-t border-border p-4 lg:border-l lg:border-t-0">
          <InspectorPanel title="Certified activation">
            <Fact
              label="Registry snapshot"
              value={shortRef(
                String(
                  evidenceContractQuery.data?.active_pins
                    ?.source_registry_snapshot_id ?? '',
                ),
              )}
            />
            <Fact
              label="K_v"
              value={shortRef(
                String(
                  evidenceContractQuery.data?.active_pins
                    ?.knowledge_context_version_id ?? '',
                ),
              )}
            />
            <Fact
              label="Authority bundle"
              value={shortRef(
                String(
                  evidenceContractQuery.data?.active_pins
                    ?.authority_bundle_version_id ?? '',
                ),
              )}
            />
            <Fact
              label="Activation"
              value={
                evidenceContractQuery.data?.active_pins?.activation_performed
                  ? 'activation_performed=true'
                  : 'not active'
              }
            />
          </InspectorPanel>

          <div className="mt-4 rounded-md border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <HugeiconsIcon icon={CheckListIcon} size={15} strokeWidth={1.6} />
              AI workflow actions
            </div>
            <div className="mt-3 grid gap-2">
              {[
                ['build_review_package', 'Build review package'],
                ['curate_source', 'Curate source'],
                ['promote_candidate', 'Promote candidate'],
                ['certify_source', 'Certify source'],
                ['activate_bundle', 'Activate bundle'],
                ['refresh_check', 'Run refresh check'],
              ].map(([actionType, label]) => (
                <button
                  key={actionType}
                  type="button"
                  data-legal-action-type={actionType}
                  onClick={() => bindChatContext(actionType)}
                  className="rounded-md border border-border px-3 py-2 text-left text-sm font-medium transition-colors hover:border-primary hover:bg-primary/10"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-md border border-border bg-card p-4">
            <div className="text-sm font-semibold">Dashboard metrics</div>
            <div className="mt-3 grid gap-2">
              {[
                'source_inventory_completion',
                'raw_artifact_coverage',
                'article_anchor_coverage',
                'claim_extraction_coverage',
                'open_change_candidates',
                'node_count',
                'edge_count',
              ].map((key) => (
                <Fact key={key} label={key} value={metricValue(metrics[key])} />
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-md border border-border bg-card p-4">
            <div className="text-sm font-semibold">Acceptance evidence</div>
            <div className="mt-3 space-y-2">
              {persistedExportsQuery.data?.length ? (
                persistedExportsQuery.data
                  .slice(0, 3)
                  .map((evidenceExport) => (
                    <PersistedExportRow
                      key={evidenceExport.acceptance_export_id}
                      evidenceExport={evidenceExport}
                    />
                  ))
              ) : (
                <EmptyState label="No signed export persisted" />
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}

function Metric({
  label,
  value,
}: {
  label: string
  value?: number | null
}) {
  return (
    <div className="rounded border border-border bg-card px-2 py-1.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{metricValue(value)}</div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0 rounded border border-border px-2 py-1.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-semibold">{value || 'not recorded'}</div>
    </div>
  )
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium">
      {children}
    </span>
  )
}

function InspectorPanel({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-md border border-border bg-card">
      <div className="border-b border-border px-4 py-3 text-sm font-semibold">
        {title}
      </div>
      <div className="space-y-2 p-3">{children}</div>
    </section>
  )
}

function Row({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 rounded border border-border px-3 py-2 text-xs">
      {children}
    </div>
  )
}

function PersistedExportRow({
  evidenceExport,
}: {
  evidenceExport: LegalAcceptanceEvidenceExportRef
}) {
  return (
    <div className="rounded border border-border px-3 py-2 text-xs">
      <div className="font-semibold">
        {evidenceExport.test_run_id || evidenceExport.acceptance_export_id}
      </div>
      <div className="mt-1 text-muted-foreground">
        export {shortRef(evidenceExport.acceptance_export_id)}
      </div>
      <div className="mt-1 text-muted-foreground">
        record {shortRef(evidenceExport.record_hash)}
      </div>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}
