import { ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { GraphCopy } from './graph-lenses'
import { isAuthorityChangingBlocked, resolveGraphSelection } from './graph-selection'
import { submitGovernanceCommand } from './graph-api-client'
import type {
  GovernedGraphProjection,
  GraphObjectCapability,
  GraphSelection,
} from './graph-types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const ACTIONS: {
  capability: GraphObjectCapability
  action: string
  labelKey:
    | 'validate'
    | 'approve'
    | 'activate'
    | 'reject'
    | 'deprecate'
    | 'escalate'
    | 'proposeSupersession'
    | 'requestSourceCorrection'
}[] = [
  { capability: 'validate', action: 'validate', labelKey: 'validate' },
  { capability: 'approve', action: 'approve', labelKey: 'approve' },
  { capability: 'activate', action: 'activate', labelKey: 'activate' },
  { capability: 'reject', action: 'reject', labelKey: 'reject' },
  { capability: 'deprecate', action: 'deprecate', labelKey: 'deprecate' },
  { capability: 'escalate', action: 'escalate', labelKey: 'escalate' },
  {
    capability: 'propose_supersession',
    action: 'propose_supersession',
    labelKey: 'proposeSupersession',
  },
  {
    capability: 'request_source_correction',
    action: 'request_source_correction',
    labelKey: 'requestSourceCorrection',
  },
]

export function GraphGovernanceActions({
  projection,
  selection,
  copy,
  onCompleted,
}: {
  projection: GovernedGraphProjection
  selection: GraphSelection
  copy: GraphCopy
  onCompleted?: () => void
}) {
  const [justification, setJustification] = useState('')
  const [message, setMessage] = useState('')
  const item = resolveGraphSelection(projection, selection)
  const blocked = isAuthorityChangingBlocked(projection.freshness.status)
  const availableActions = useMemo(
    () =>
      item
        ? ACTIONS.filter((action) => item.capabilities.includes(action.capability))
        : [],
    [item],
  )

  async function runAction(action: string) {
    if (!item || blocked) {
      setMessage(copy.commandBlocked)
      return
    }
    try {
      await submitGovernanceCommand({
        projectionId: projection.projectionId,
        objectRef: selection.id,
        action,
        expectedGraphSnapshotRef: projection.graphSnapshotRef,
        justification,
      })
      setMessage('command_submitted_refresh_required')
      onCompleted?.()
    } catch {
      setMessage('governance_action_failed')
    }
  }

  return (
    <section className="rounded-card border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="size-4" aria-hidden="true" />
        {copy.governance}
      </h2>
      <label className="mt-3 grid gap-2 text-xs font-medium text-muted-foreground">
        {copy.justification}
        <Input
          nativeInput
          value={justification}
          onChange={(event) => setJustification(event.currentTarget.value)}
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {availableActions.length === 0 ? (
          <span className="text-xs text-muted-foreground">{copy.notPermitted}</span>
        ) : (
          availableActions.map((action) => (
            <Button
              key={action.action}
              size="sm"
              disabled={blocked || justification.trim().length === 0}
              onClick={() => void runAction(action.action)}
            >
              {copy[action.labelKey]}
            </Button>
          ))
        )}
      </div>
      {blocked ? (
        <p className="mt-3 text-xs text-[color:var(--theme-warning)]">
          {copy.freshnessBlocked}
        </p>
      ) : null}
      {message ? <p className="mt-3 text-xs text-muted-foreground">{message}</p> : null}
    </section>
  )
}
