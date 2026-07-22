import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ShieldCheck,
  Copy,
  Eye,
  EyeOff,
  FileSearch,
  LockKeyhole,
  RotateCw,
} from 'lucide-react'
import { pushActivity } from '@/components/inspector/activity-store'
import {
  copySensitiveGovernanceSegment,
  replaySensitiveGovernanceRun,
  revealSensitiveGovernanceSegment,
} from '@/lib/sensitive-governance'
import type {
  GovernedResponse,
  GovernedResponseSegment,
  SensitiveGovernanceReplayResult,
  SensitiveGovernanceRevealDecision,
  SensitiveGovernanceDisplayAction,
} from '@/lib/sensitive-governance'
import { cn } from '@/lib/utils'

function actionLabel(action: SensitiveGovernanceDisplayAction): string {
  switch (action) {
    case 'SHOW':
      return 'Show'
    case 'MASK':
      return 'Masked'
    case 'TOKENIZE':
      return 'Tokenized'
    case 'REDACT':
      return 'Redacted'
    case 'NEVER_RENDER':
      return 'Never render'
  }
}

function segmentTone(action: SensitiveGovernanceDisplayAction): string {
  if (action === 'NEVER_RENDER') {
    return 'border-[color:color-mix(in_srgb,var(--theme-danger)_42%,var(--theme-border))] bg-[color:color-mix(in_srgb,var(--theme-danger)_8%,transparent)]'
  }
  if (action === 'REDACT') {
    return 'border-[color:color-mix(in_srgb,var(--theme-warning)_38%,var(--theme-border))] bg-[color:color-mix(in_srgb,var(--theme-warning)_8%,transparent)]'
  }
  if (action === 'TOKENIZE' || action === 'MASK') {
    return 'border-[color:color-mix(in_srgb,var(--theme-accent)_38%,var(--theme-border))] bg-[color:color-mix(in_srgb,var(--theme-accent)_8%,transparent)]'
  }
  return 'border-[var(--theme-border)] bg-transparent'
}

const ACTION_RANK: Record<SensitiveGovernanceDisplayAction, number> = {
  SHOW: 0,
  MASK: 1,
  TOKENIZE: 2,
  REDACT: 3,
  NEVER_RENDER: 4,
}

function segmentKindForAction(action: SensitiveGovernanceDisplayAction): string {
  switch (action) {
    case 'SHOW':
      return 'plain-text'
    case 'MASK':
    case 'TOKENIZE':
      return 'sensitive-text'
    case 'REDACT':
      return 'redacted-placeholder'
    case 'NEVER_RENDER':
      return 'never-render-notice'
  }
}

function segmentInspectorHref(runId: string, segmentId: string): string {
  return `#governance-run=${encodeURIComponent(runId)}&segment=${encodeURIComponent(segmentId)}`
}

export function sensitiveGovernanceRevealWatermark(
  runId: string,
  segmentId: string,
): string {
  return `REVEAL ${runId.slice(-8)} ${segmentId.slice(-8)}`
}

export function deriveRevealRenderState(
  decision: SensitiveGovernanceRevealDecision,
):
  | {
      state: 'revealed'
      clearValue: string
      expiresAt: number | null
      reasonCodes: Array<string>
    }
  | {
      state: 'denied' | 'expired'
      clearValue: null
      expiresAt: null
      reasonCodes: Array<string>
    } {
  if (decision.allowed && typeof decision.clear_value === 'string') {
    return {
      state: 'revealed',
      clearValue: decision.clear_value,
      expiresAt: decision.expires_at ? Date.parse(decision.expires_at) : null,
      reasonCodes: decision.reason_codes,
    }
  }
  return {
    state: decision.reason_codes.includes('REVEAL_LEASE_EXPIRED')
      ? 'expired'
      : 'denied',
    clearValue: null,
    expiresAt: null,
    reasonCodes: decision.reason_codes,
  }
}

export function buildGovernedResponseInspectorActivity(
  response: GovernedResponse,
  sessionKey?: string | null,
  replay?: SensitiveGovernanceReplayResult | null,
) {
  const summary = response.governance_summary || {}
  return {
    type: 'sensitive_governance_response',
    time: new Date(0).toISOString(),
    text: response.response_id,
    details: {
      event: 'sensitive_governance_response',
      sessionKey: sessionKey || null,
      runId: response.run_id,
      responseId: response.response_id,
      responseHash: response.response_hash,
      assessmentId:
        typeof summary.assessment_id === 'string' ? summary.assessment_id : null,
      displayJustificationRef:
        typeof summary.display_justification_ref === 'string'
          ? summary.display_justification_ref
          : null,
      displayAdmissibilityRef:
        typeof summary.display_admissibility_ref === 'string'
          ? summary.display_admissibility_ref
          : null,
      segmentCount: response.segments.length,
      displayActions: response.segments.map((segment) => segment.display_action),
      classifications: response.segments
        .map((segment) => segment.classification)
        .filter((classification): classification is string => !!classification),
      ontologyVersion: response.pins.ontology_version,
      authorityBundleVersion: response.pins.authority_bundle_version,
      policyBundleVersion: response.pins.policy_bundle_version,
      displayProfileVersion: response.pins.display_profile_version,
      replayPins: response.pins,
      replayStatus: replay ? (replay.matches ? 'matched' : 'mismatch') : null,
      replayedResponseHash: replay?.replayed_response_hash || null,
      replayGovernedResponseHash: replay?.governed_response_hash || null,
      replayPolicyOutcomesHash: replay?.policy_outcomes_hash || null,
    },
  }
}

function SegmentBadge({
  action,
}: {
  action: SensitiveGovernanceDisplayAction
}) {
  return (
    <span
      className="inline-flex h-5 items-center rounded px-1.5 text-[10px] font-semibold uppercase tracking-normal"
      style={{
        background:
          action === 'SHOW'
            ? 'var(--theme-card2)'
            : 'color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card2))',
        color:
          action === 'SHOW' ? 'var(--theme-muted)' : 'var(--dark-green)',
      }}
    >
      {actionLabel(action)}
    </span>
  )
}

function ClassificationBadge({ classification }: { classification: string }) {
  return (
    <span className="rounded border border-[var(--theme-border)] px-1.5 py-0.5">
      {classification}
    </span>
  )
}

function AuthorityEvidenceCard({
  segment,
}: {
  segment: GovernedResponseSegment
}) {
  const refs = segment.authority_refs || []
  if (refs.length === 0) return null
  return (
    <details className="group relative">
      <summary className="inline-flex h-6 cursor-pointer list-none items-center gap-1 rounded border border-[var(--theme-border)] px-1.5 text-[11px] text-[var(--theme-text)] transition-colors hover:bg-[var(--theme-card2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]">
        <FileSearch className="size-3" aria-hidden="true" />
        Evidence
      </summary>
      <div className="absolute z-20 mt-1 w-72 rounded-md border border-[var(--theme-border)] bg-[var(--theme-card)] p-2 shadow-lg">
        <div className="space-y-1.5">
          {refs.map((ref, index) => (
            <div
              key={`${segment.segment_id}-${ref.artifact_id || 'artifact'}-${ref.authority_ref || 'authority'}-${index}`}
              className="rounded border border-[var(--theme-border)] bg-[var(--theme-card2)] px-2 py-1.5"
            >
              <div className="text-[10px] font-semibold uppercase tracking-normal text-[var(--theme-muted)]">
                {ref.tier || 'T?'} {ref.authority_ref || ref.artifact_id || 'authority'}
              </div>
              {ref.display_name_zh ? (
                <div className="mt-0.5 text-[11px] leading-5 text-[var(--theme-text)]">
                  {ref.display_name_zh}
                </div>
              ) : null}
              {ref.artifact_id ? (
                <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--theme-muted)]">
                  {ref.artifact_id}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </details>
  )
}

function GovernedSegment({
  segment,
  responseId,
  runId,
}: {
  segment: GovernedResponseSegment
  responseId: string
  runId: string
}) {
  const [state, setState] = useState<
    'idle' | 'requesting' | 'revealed' | 'denied' | 'expired' | 'failed'
  >('idle')
  const [clearValue, setClearValue] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [reasonCodes, setReasonCodes] = useState<Array<string>>([])
  const inspectorHref = segmentInspectorHref(runId, segment.segment_id)
  const expiresInSeconds =
    expiresAt && state === 'revealed'
      ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
      : null
  const remask = useCallback((nextState: 'idle' | 'expired' = 'idle') => {
    setClearValue(null)
    setExpiresAt(null)
    setState(nextState)
  }, [])

  useEffect(() => {
    if (state !== 'revealed' || !expiresAt) return undefined
    const remaining = expiresAt - Date.now()
    if (remaining <= 0) {
      remask('expired')
      return undefined
    }
    const timer = window.setTimeout(() => remask('expired'), remaining)
    return () => window.clearTimeout(timer)
  }, [expiresAt, remask, state])

  useEffect(() => {
    if (state !== 'revealed') return undefined
    const hide = () => remask()
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') hide()
    }
    window.addEventListener('blur', hide)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('blur', hide)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [remask, state])

  const reveal = async () => {
    if (!segment.eligible_for_reveal) return
    setState('requesting')
    setReasonCodes([])
    try {
      const decision = await revealSensitiveGovernanceSegment(
        responseId,
        segment.segment_id,
        {
          idempotency_key: `${responseId}:${segment.segment_id}:reveal:${Date.now()}`,
          confirmation: true,
        },
      )
      const next = deriveRevealRenderState(decision)
      setClearValue(next.clearValue)
      setExpiresAt(next.expiresAt)
      setReasonCodes(next.reasonCodes)
      setState(next.state)
    } catch (error) {
      setClearValue(null)
      setExpiresAt(null)
      setReasonCodes([error instanceof Error ? error.message : 'Reveal failed'])
      setState('failed')
    }
  }

  const copyRequest = async () => {
    setReasonCodes([])
    try {
      const decision = await copySensitiveGovernanceSegment(
        responseId,
        segment.segment_id,
        {
          idempotency_key: `${responseId}:${segment.segment_id}:copy:${Date.now()}`,
          confirmation: true,
        },
      )
      setReasonCodes(decision.reason_codes)
      if (!decision.allowed) setState('denied')
    } catch (error) {
      setReasonCodes([error instanceof Error ? error.message : 'Copy failed'])
      setState('failed')
    }
  }

  return (
    <section
      className={cn(
        'rounded-md border px-2.5 py-2',
        segmentTone(segment.display_action),
      )}
      data-governed-segment-id={segment.segment_id}
      data-display-action={segment.display_action}
      data-segment-kind={segmentKindForAction(segment.display_action)}
      data-action-rank={ACTION_RANK[segment.display_action]}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--theme-text)]">
          {clearValue ?? segment.text}
        </p>
        <SegmentBadge action={segment.display_action} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] leading-5 text-[var(--theme-muted)]">
        {segment.classification ? (
          <ClassificationBadge classification={segment.classification} />
        ) : null}
        {segment.eligible_for_reveal ? (
          <button
            type="button"
            onClick={state === 'revealed' ? () => remask() : reveal}
            disabled={state === 'requesting'}
            className="inline-flex h-6 items-center gap-1 rounded border border-[var(--theme-border)] px-1.5 text-[11px] text-[var(--theme-text)] transition-colors hover:bg-[var(--theme-card2)] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
            aria-label={state === 'revealed' ? 'Remask segment' : 'Reveal segment'}
          >
            {state === 'revealed' ? (
              <EyeOff className="size-3" aria-hidden="true" />
            ) : (
              <Eye className="size-3" aria-hidden="true" />
            )}
            {state === 'requesting'
              ? 'Requesting'
              : state === 'revealed'
                ? `Remask${expiresInSeconds !== null ? ` ${expiresInSeconds}s` : ''}`
                : 'Reveal'}
          </button>
        ) : null}
        {segment.display_action !== 'NEVER_RENDER' ? (
          <button
            type="button"
            onClick={copyRequest}
            className="inline-flex h-6 items-center gap-1 rounded border border-[var(--theme-border)] px-1.5 text-[11px] text-[var(--theme-text)] transition-colors hover:bg-[var(--theme-card2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
            aria-label="Request governed copy"
          >
            <Copy className="size-3" aria-hidden="true" />
            Copy
          </button>
        ) : null}
        {segment.display_action === 'NEVER_RENDER' ? (
          <span className="inline-flex items-center gap-1 rounded border border-[color:color-mix(in_srgb,var(--theme-danger)_42%,var(--theme-border))] px-1.5 text-[var(--theme-danger)]">
            <LockKeyhole className="size-3" aria-hidden="true" />
            Never render
          </span>
        ) : null}
        <AuthorityEvidenceCard segment={segment} />
        <a
          href={inspectorHref}
          className="rounded border border-[var(--theme-border)] px-1.5 py-0.5 text-[11px] text-[var(--theme-text)] transition-colors hover:bg-[var(--theme-card2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
        >
          Inspector
        </a>
      </div>
      {state === 'denied' || state === 'expired' || state === 'failed' ? (
        <div className="mt-1.5 rounded border border-[var(--theme-border)] bg-[var(--theme-card2)] px-2 py-1 text-[11px] text-[var(--theme-muted)]">
          {state === 'expired' ? 'Reveal expired' : state === 'failed' ? 'Request failed' : 'Request denied'}
          {reasonCodes.length > 0 ? `: ${reasonCodes.join(', ')}` : null}
        </div>
      ) : null}
      {state === 'revealed' ? (
        <div
          className="mt-1.5 rounded border border-[var(--theme-border)] bg-[var(--theme-card2)] px-2 py-1 font-mono text-[10px] uppercase tracking-normal text-[var(--theme-muted)]"
          data-sensitive-governance-reveal-watermark="true"
        >
          {sensitiveGovernanceRevealWatermark(runId, segment.segment_id)}
        </div>
      ) : null}
    </section>
  )
}

export function GovernedResponseRenderer({
  response,
  sessionKey,
}: {
  response: GovernedResponse
  sessionKey?: string | null
}) {
  const summary = response.governance_summary || {}
  const [replay, setReplay] = useState<SensitiveGovernanceReplayResult | null>(null)
  const [replayState, setReplayState] = useState<
    'idle' | 'requesting' | 'matched' | 'mismatch' | 'failed'
  >('idle')
  const [replayError, setReplayError] = useState<string | null>(null)
  const actions = Array.isArray(summary.actions)
    ? summary.actions.filter((action): action is string => typeof action === 'string')
    : []
  const inspectorHref = `#governance-run=${encodeURIComponent(response.run_id)}`
  const inspectorActivity = useMemo(
    () => buildGovernedResponseInspectorActivity(response, sessionKey, replay),
    [response, sessionKey, replay],
  )

  useEffect(() => {
    pushActivity(inspectorActivity)
  }, [inspectorActivity])

  const requestReplay = async () => {
    setReplayState('requesting')
    setReplayError(null)
    try {
      const result = await replaySensitiveGovernanceRun(response.run_id, {
        idempotency_key: `${response.run_id}:replay:${Date.now()}`,
      })
      setReplay(result)
      setReplayState(result.matches ? 'matched' : 'mismatch')
    } catch (error) {
      setReplayError(error instanceof Error ? error.message : 'Replay failed')
      setReplayState('failed')
    }
  }

  return (
    <div
      className="flex w-full max-w-[44rem] flex-col gap-2"
      data-governed-response-id={response.response_id}
      data-governed-response-hash={response.response_hash}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--theme-border)] pb-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="size-4 shrink-0 text-[var(--theme-success)]" />
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-[var(--theme-text)]">
              Governance Summary
            </div>
            <div className="truncate font-mono text-[10px] text-[var(--theme-muted)]">
              {response.run_id} · {response.response_hash.slice(0, 12)}
            </div>
          </div>
        </div>
        <a
          href={inspectorHref}
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-[var(--theme-border)] px-2 text-[11px] font-medium text-[var(--theme-text)] transition-colors hover:bg-[var(--theme-card2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
        >
          <FileSearch className="size-3.5" aria-hidden="true" />
          Inspector
        </a>
        <button
          type="button"
          onClick={requestReplay}
          disabled={replayState === 'requesting'}
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-[var(--theme-border)] px-2 text-[11px] font-medium text-[var(--theme-text)] transition-colors hover:bg-[var(--theme-card2)] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]"
        >
          <RotateCw className="size-3.5" aria-hidden="true" />
          {replayState === 'requesting' ? 'Checking' : 'Replay'}
        </button>
      </div>
      {replayState !== 'idle' ? (
        <div
          className="rounded border border-[var(--theme-border)] bg-[var(--theme-card2)] px-2 py-1 text-[11px] text-[var(--theme-muted)]"
          data-sensitive-governance-replay-state={replayState}
        >
          {replayState === 'matched'
            ? `Replay matched ${replay?.replayed_response_hash.slice(0, 12) || ''}`
            : replayState === 'mismatch'
              ? 'Replay mismatch'
              : replayState === 'failed'
                ? `Replay failed${replayError ? `: ${replayError}` : ''}`
                : 'Replay check requested'}
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        {response.segments
          .slice()
          .sort((left, right) => left.sequence - right.sequence)
          .map((segment) => (
            <GovernedSegment
              key={segment.segment_id}
              segment={segment}
              responseId={response.response_id}
              runId={response.run_id}
            />
          ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--theme-muted)]">
        <span>{response.contract_version}</span>
        <span aria-hidden="true">·</span>
        <span>{response.pins.policy_bundle_version}</span>
        {actions.length > 0 ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{actions.join(', ')}</span>
          </>
        ) : null}
      </div>
    </div>
  )
}
