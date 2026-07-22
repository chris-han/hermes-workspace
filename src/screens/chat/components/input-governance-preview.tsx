import { useEffect, useMemo } from 'react'
import { FileSearch, ShieldCheck } from 'lucide-react'
import { pushActivity } from '@/components/inspector/activity-store'
import type { SensitiveGovernanceAssessment } from '@/lib/sensitive-governance'

type PreviewMetric = {
  label: string
  value: string
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function uniqueStrings(values: Array<unknown>): Array<string> {
  return Array.from(
    new Set(values.filter((value): value is string => typeof value === 'string')),
  )
}

export function buildSensitiveGovernanceEscalationActivity(
  assessment: SensitiveGovernanceAssessment,
  sessionKey?: string | null,
) {
  const governance = assessment.prepared_payload?.input_governance || {}
  const escalation = governance.escalation
  if (!escalation || typeof escalation !== 'object' || Array.isArray(escalation)) {
    return null
  }
  const record = escalation as Record<string, unknown>
  const escalationId = asString(record.escalation_id)
  const assignedRole = asString(record.assigned_role)
  const assignedPrincipal = asString(record.assigned_principal)
  const status = asString(record.initial_status)
  const reasonCodes = Array.isArray(record.reason_codes)
    ? uniqueStrings(record.reason_codes)
    : []
  if (!escalationId || !assignedRole || !status) return null
  return {
    type: 'sensitive_governance_escalation',
    time: new Date(0).toISOString(),
    text: escalationId,
    details: {
      event: 'sensitive_governance_escalation',
      sessionKey: sessionKey || null,
      assessmentId: assessment.assessment_id,
      assessmentHash: assessment.assessment_hash,
      escalationId,
      assignedRole,
      assignedPrincipal: assignedPrincipal || null,
      status,
      blocked: record.execution_blocked === true,
      reasonCodes,
    },
  }
}

export function SensitiveGovernanceInputPreview({
  assessment,
  sessionKey,
}: {
  assessment: SensitiveGovernanceAssessment
  sessionKey?: string | null
}) {
  const prepared = assessment.prepared_payload || {}
  const governance = prepared.input_governance || {}
  const intent = prepared.execution_intent || {}
  const comparison = prepared.agent_boundary_comparison || {}
  const decisions = Array.isArray(governance.decisions)
    ? governance.decisions
    : []
  const transformations = Array.isArray(governance.transformations)
    ? governance.transformations
    : []
  const blockedClasses = uniqueStrings(
    decisions
      .filter((decision) => decision.enforcement_action === 'BLOCK')
      .map((decision) => decision.finding_class),
  )
  const actionSet = uniqueStrings(
    decisions.map((decision) => decision.enforcement_action),
  )
  const detectedClasses = Array.isArray(comparison.raw_detected_classes)
    ? uniqueStrings(comparison.raw_detected_classes)
    : uniqueStrings(decisions.map((decision) => decision.finding_class))
  const comparisonActions = Array.isArray(comparison.transformation_actions)
    ? uniqueStrings(comparison.transformation_actions)
    : actionSet
  const rawRequestHash =
    asString(comparison.raw_request_hash) || assessment.request_hash
  const governedPayloadHash =
    asString(comparison.governed_payload_hash) ||
    asString(intent.transformed_input_hash)
  const restrictedRequestRef = asString(comparison.restricted_request_ref)
  const residualScanRef = asString(comparison.residual_scan_evidence_ref)
  const residualStatus =
    comparison.critical_residual_sensitive_data === false
      ? 'No critical residual'
      : comparison.critical_residual_sensitive_data === true
        ? 'Critical residual blocked'
        : 'Residual scan bound'
  const metrics: Array<PreviewMetric> = [
    {
      label: 'Findings',
      value: String(governance.finding_count ?? decisions.length),
    },
    {
      label: 'Destination',
      value: asString(governance.destination) || 'local_simulated_agent',
    },
    {
      label: 'Transforms',
      value: String(transformations.length),
    },
    {
      label: 'Policy',
      value: asString(governance.policy_bundle_version) || 'unbound',
    },
  ]
  const escalationActivity = useMemo(
    () => buildSensitiveGovernanceEscalationActivity(assessment, sessionKey),
    [assessment, sessionKey],
  )

  useEffect(() => {
    if (escalationActivity) pushActivity(escalationActivity)
  }, [escalationActivity])

  return (
    <section
      className="flex w-full max-w-[44rem] flex-col gap-2 rounded-md border border-[var(--theme-border)] bg-[var(--theme-card)] p-3"
      data-sensitive-governance-input-preview={assessment.assessment_id}
      data-assessment-hash={assessment.assessment_hash}
    >
      <div className="flex items-start justify-between gap-3 border-b border-[var(--theme-border)] pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="size-4 shrink-0 text-[var(--theme-success)]" />
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-[var(--theme-text)]">
              Input Governance
            </div>
            <div className="truncate font-mono text-[10px] text-[var(--theme-muted)]">
              {assessment.assessment_id} · {assessment.assessment_hash.slice(0, 12)}
            </div>
          </div>
        </div>
        <span className="inline-flex h-6 shrink-0 items-center rounded border border-[var(--theme-border)] px-2 text-[11px] font-semibold text-[var(--theme-text)]">
          {asString(governance.route) || assessment.state}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="min-w-0 rounded border border-[var(--theme-border)] bg-[var(--theme-card2)] px-2 py-1.5"
          >
            <div className="truncate text-[10px] font-semibold uppercase tracking-normal text-[var(--theme-muted)]">
              {metric.label}
            </div>
            <div className="truncate text-xs font-medium text-[var(--theme-text)]">
              {metric.value}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--theme-muted)]">
        {actionSet.map((action) => (
          <span
            key={action}
            className="rounded border border-[var(--theme-border)] px-1.5 py-0.5"
          >
            {action}
          </span>
        ))}
        {blockedClasses.map((blockedClass) => (
          <span
            key={blockedClass}
            className="rounded border border-[color:color-mix(in_srgb,var(--theme-danger)_42%,var(--theme-border))] px-1.5 py-0.5 text-[var(--theme-danger)]"
          >
            {blockedClass}
          </span>
        ))}
      </div>
      <div
        className="grid gap-2 rounded border border-[var(--theme-border)] bg-[var(--theme-card2)] p-2 text-[11px]"
        data-sensitive-governance-boundary-comparison="true"
        data-raw-request-hash={rawRequestHash}
        data-governed-payload-hash={governedPayloadHash}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="min-w-0">
            <div className="font-semibold uppercase tracking-normal text-[var(--theme-muted)]">
              Raw synthetic input
            </div>
            <div className="truncate font-mono text-[var(--theme-text)]">
              {rawRequestHash.slice(0, 16)}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {detectedClasses.map((classification) => (
                <span
                  key={classification}
                  className="rounded border border-[var(--theme-border)] px-1 py-0.5"
                >
                  {classification}
                </span>
              ))}
            </div>
          </div>
          <div className="min-w-0">
            <div className="font-semibold uppercase tracking-normal text-[var(--theme-muted)]">
              Governed agent payload
            </div>
            <div className="truncate font-mono text-[var(--theme-text)]">
              {governedPayloadHash.slice(0, 16)}
            </div>
            <div className="mt-1 truncate text-[var(--theme-muted)]">
              {restrictedRequestRef || 'restricted request ref pending'}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[var(--theme-muted)]">
          <span>{residualStatus}</span>
          {residualScanRef ? <span>{residualScanRef}</span> : null}
          {comparisonActions.map((action) => (
            <span
              key={action}
              className="rounded border border-[var(--theme-border)] px-1 py-0.5"
            >
              {action}
            </span>
          ))}
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-2 text-[11px] text-[var(--theme-muted)]">
        <FileSearch className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">
          {intent.agent_boundary || 'local_simulated_agent'} ·{' '}
          {String(intent.transformed_input_hash || '').slice(0, 12)}
        </span>
      </div>
    </section>
  )
}
