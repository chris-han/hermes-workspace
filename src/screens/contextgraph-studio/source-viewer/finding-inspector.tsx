import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/form-controls'
import { cn } from '@/lib/utils'

type DecisionKind = 'confirm' | 'change' | 'dismiss'

type SourceEvidenceFinding = {
  finding_id: string
  matched_text?: string | null
  observed_expression?: string | null
  target_evidence_ref?: string | null
  target_anchor_ref?: string | null
  decision_status?: string | null
  detection_method?: string | null
  semantic_relation?: string | null
  confidence?: number | null
  issue_type?: string | null
}

const COPY = {
  en: {
    inspector: 'Inspector',
    concept: 'Concept',
    classification: 'Classification',
    applicability: 'Applicability',
    action: 'Action',
    path: 'Path',
    provenance: 'Provenance',
    justification: 'Structured justification',
    confirm: 'Confirm',
    change: 'Change',
    dismiss: 'Dismiss',
  },
  zh: {
    inspector: '检查器',
    concept: '概念',
    classification: '分类',
    applicability: '适用性',
    action: '动作',
    path: '路径',
    provenance: '出处',
    justification: '结构化理由',
    confirm: '确认',
    change: '变更',
    dismiss: '忽略',
  },
} as const

function selectedLabel(finding: SourceEvidenceFinding | null): string {
  return (
    finding?.observed_expression ||
    finding?.matched_text ||
    finding?.finding_id ||
    ''
  )
}

export type FindingInspectorProps = {
  zh: boolean
  findings: SourceEvidenceFinding[]
  selectedFinding: SourceEvidenceFinding | null
  sourceDocumentHash?: string | null
  onSelectFinding?: (finding: SourceEvidenceFinding) => void
  onDecision?: (
    kind: DecisionKind,
    finding: SourceEvidenceFinding,
    justification: string,
  ) => void
}

export function FindingInspector({
  zh,
  findings,
  selectedFinding,
  sourceDocumentHash,
  onSelectFinding,
  onDecision,
}: FindingInspectorProps) {
  const t = zh ? COPY.zh : COPY.en
  const [justification, setJustification] = useState('')
  const canRecord = Boolean(selectedFinding && justification.trim())

  return (
    <aside
      aria-label={t.inspector}
      lang={zh ? 'zh-CN' : 'en'}
      className="grid min-h-0 grid-rows-[auto_1fr_auto] gap-3 rounded-lg border border-border bg-background p-3"
      data-testid="finding-inspector"
    >
      <div>
        <strong>{t.inspector}</strong>
        <div className="mt-2 flex flex-wrap gap-1">
          {findings.map((finding) => (
            <Button
              key={finding.finding_id}
              type="button"
              variant="ghost"
              onClick={() => onSelectFinding?.(finding)}
              className={cn(
                'h-7 max-w-full rounded-md border border-border px-2 text-[11px]',
                selectedFinding?.finding_id === finding.finding_id &&
                  'border-[var(--theme-accent)] bg-[var(--theme-accent-subtle)]',
              )}
            >
              <span className="truncate">
                {selectedLabel(finding) || finding.finding_id}
              </span>
            </Button>
          ))}
        </div>
      </div>
      <dl className="min-h-0 space-y-2 overflow-auto text-[11px]">
        {[
          [t.concept, selectedLabel(selectedFinding)],
          [t.classification, selectedFinding?.issue_type ?? 'unknown'],
          [
            t.applicability,
            selectedFinding?.decision_status ?? 'applicability=unknown',
          ],
          [t.action, selectedFinding?.detection_method ?? 'review'],
          [
            t.path,
            selectedFinding?.target_anchor_ref ??
              selectedFinding?.target_evidence_ref ??
              'unresolved',
          ],
          [
            t.provenance,
            `${sourceDocumentHash ?? 'hash:unavailable'} / ${
              selectedFinding?.semantic_relation ?? 'relation:unknown'
            }`,
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="font-semibold text-muted-foreground">{label}</dt>
            <dd className="break-words font-mono text-foreground">
              {value || '—'}
            </dd>
          </div>
        ))}
      </dl>
      <div className="space-y-2">
        <label className="grid gap-1">
          <span className="font-semibold">{t.justification}</span>
          <Textarea
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
            className="min-h-20 rounded-md border border-border bg-card p-2"
            data-testid="finding-feedback-justification"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['confirm', t.confirm],
              ['change', t.change],
              ['dismiss', t.dismiss],
            ] as Array<[DecisionKind, string]>
          ).map(([kind, label]) => (
            <Button
              key={kind}
              type="button"
              disabled={!canRecord}
              data-testid={`finding-${kind}-action`}
              onClick={() =>
                selectedFinding &&
                onDecision?.(kind, selectedFinding, justification.trim())
              }
              className="h-8 rounded-md px-3 text-xs"
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
    </aside>
  )
}
