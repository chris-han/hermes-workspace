import { Button } from '@/components/ui/button'

import { AlertCircle, CheckCircle2, Circle, FileText, KeyRound } from 'lucide-react'
import { useState } from 'react'

import type { GraphCopy } from './graph-lenses'
import { resolveGraphSelection } from './graph-selection'
import type {
  GovernedGraphProjection,
  GraphEdge,
  GraphNode,
  GraphSelection,
} from './graph-types'

type InspectorTab =
  | 'summary'
  | 'evidence'
  | 'authority'
  | 'lineage'
  | 'governance'
  | 'replay'

export function GraphInspector({
  projection,
  selection,
  copy,
}: {
  projection: GovernedGraphProjection
  selection: GraphSelection
  copy: GraphCopy
}) {
  const [tab, setTab] = useState<InspectorTab>('summary')
  const item = resolveGraphSelection(projection, selection)

  return (
    <aside className="min-h-0 rounded-card border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{copy.inspector}</h2>
        <p className="text-xs text-muted-foreground">
          {item ? objectTitle(item) : selection.id}
        </p>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-border px-3 py-2">
        {(['summary', 'evidence', 'authority', 'lineage', 'governance', 'replay'] as const).map(
          (value) => (
            <Button
              key={value}
              type="button"
              className="rounded-md px-2 py-1 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-blue)]"
              style={
                tab === value
                  ? {
                      background: 'var(--theme-accent)',
                      color: 'var(--theme-accent-foreground)',
                    }
                  : undefined
              }
              onClick={() => setTab(value)}
            >
              {copy[value === 'authority' ? 'authorityTab' : value]}
            </Button>
          ),
        )}
      </div>
      <div className="space-y-3 p-4 text-xs">
        {item ? <InspectorBody item={item} tab={tab} projection={projection} copy={copy} /> : null}
      </div>
    </aside>
  )
}

function InspectorBody({
  item,
  tab,
  projection,
  copy,
}: {
  item: GraphNode | GraphEdge
  tab: InspectorTab
  projection: GovernedGraphProjection
  copy: GraphCopy
}) {
  if ('predicateLabel' in item) {
    return (
      <>
        <StatusBadge state={item.governanceState} contextualOnly={item.contextualOnly} copy={copy} />
        <Fact label={copy.summary} value={item.predicateDescription} />
        <Fact label="predicate" value={item.predicate} />
        <Fact label={copy.authority} value={item.authorityRole} />
        <Fact label={copy.tier} value={item.semanticTier} />
        <Fact label="detail_ref" value={item.detailRef} />
      </>
    )
  }

  if (tab === 'evidence') {
    return (
      <>
        <Fact label={copy.sourceAnchor} value={item.sourceLocator ?? 'evidence_missing'} />
        <Fact label="source_title" value={item.sourceTitle ?? 'not recorded'} />
        <Fact label={copy.sourceHash} value={item.sourceHash ?? 'not recorded'} />
        <Fact label={copy.spanHash} value={item.localSpanHash ?? 'not recorded'} />
        <Fact label="detail_ref" value={item.detailRef} />
      </>
    )
  }

  if (tab === 'authority') {
    return (
      <>
        <StatusBadge state={item.governanceState} contextualOnly={item.contextualOnly} copy={copy} />
        <Fact label={copy.authority} value={item.authorityRole} />
        <Fact label={copy.tier} value={item.semanticTier} />
        <Fact label="jurisdiction" value={item.jurisdiction} />
        <Fact label="effective_from" value={item.effectiveFrom ?? 'not recorded'} />
        <Fact label="effective_to" value={item.effectiveTo ?? 'current'} />
      </>
    )
  }

  if (tab === 'lineage') {
    return (
      <>
        <Fact label={copy.pathExplanation} value={pathExplanation(projection, item.id)} />
        {projection.events
          .filter((event) => event.objectRef === item.id)
          .map((event) => (
            <Fact
              key={event.id}
              label={event.action}
              value={`${event.actorRole} · ${event.eventHash}`}
            />
          ))}
      </>
    )
  }

  if (tab === 'governance') {
    return (
      <>
        <Fact label="capabilities" value={item.capabilities.join(', ')} />
        <Fact label="semantic consequence" value="Commands create governed events; browser state does not mutate authority." />
      </>
    )
  }

  if (tab === 'replay') {
    return (
      <>
        <Fact label={copy.snapshot} value={projection.graphSnapshotRef} />
        <Fact label={copy.projectionHash} value={projection.semanticProjectionHash} />
        <Fact label={copy.presentationHash} value={projection.presentationHash} />
        <Fact label="authorization_context_ref" value={projection.authorizationContextRef} />
      </>
    )
  }

  return (
    <>
      <StatusBadge state={item.governanceState} contextualOnly={item.contextualOnly} copy={copy} />
      <Fact label={copy.summary} value={item.summary} />
      <Fact label="kind" value={item.kind} />
      <Fact label={copy.authority} value={item.authorityRole} />
      <Fact label={copy.tier} value={item.semanticTier} />
    </>
  )
}

function StatusBadge({
  state,
  contextualOnly,
  copy,
}: {
  state: string
  contextualOnly?: boolean
  copy: GraphCopy
}) {
  const Icon =
    state === 'active' ? CheckCircle2 : state === 'rejected' ? AlertCircle : Circle
  return (
    <div className="flex flex-wrap gap-2">
      <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-medium">
        <Icon className="size-3" aria-hidden="true" />
        {state}
      </span>
      {contextualOnly ? (
        <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[color:var(--theme-info)]">
          <KeyRound className="size-3" aria-hidden="true" />
          {copy.contextualWarning}
        </span>
      ) : null}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase text-muted-foreground">
        <FileText className="size-3" aria-hidden="true" />
        {label}
      </div>
      <div className="mt-1 break-words text-foreground">{value}</div>
    </div>
  )
}

function objectTitle(item: GraphNode | GraphEdge) {
  return 'predicateLabel' in item ? item.predicateLabel : item.label
}

function pathExplanation(projection: GovernedGraphProjection, selectedId: string) {
  const scene = projection.scenes[0]
  return scene.nodeIds
    .filter((nodeId) => nodeId === selectedId || nodeId.includes('clause') || nodeId.includes('law') || nodeId.includes('policy'))
    .map((nodeId) => projection.nodes.find((node) => node.id === nodeId)?.label)
    .filter(Boolean)
    .join(' -> ')
}

