import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/form-controls'
import { Badge } from '@/components/ui/status'
import { cn } from '@/lib/utils'

type ViewerConfig =
  {
    configured: true
    provider: 'open-source-unified'
    engine: 'pdfjs-canonical-source-ir'
  }

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

type SourceEvidenceHighlight = {
  findingId: string
  label: string
  evidenceRef: string
  anchorRef: string
  relation: string
}

type SourceEvidenceDocumentAdapter = {
  documentKind: NonNullable<SourceEvidenceViewerProps['documentKind']>
  provider: 'open_source_unified' | 'canonical_source_ir' | 'unavailable'
  readOnly: true
  overlayStrategy:
    | 'document_coordinates'
    | 'canonical_anchor_projection'
    | 'unavailable'
  diagnosticCode?: 'unsupported_document_kind'
}

type DecisionKind = 'confirm' | 'change' | 'dismiss'

type SourceEvidenceDocumentKind = 'docx' | 'pdf' | 'canonical_source_ir' | 'unknown'

type SourceEvidenceViewerProps = {
  zh: boolean
  documentName?: string | null
  documentKind?: SourceEvidenceDocumentKind
  sourceDocumentHash?: string | null
  viewerConfig: ViewerConfig
  findings: SourceEvidenceFinding[]
  selectedFindingId?: string | null
  onSelectFinding?: (finding: SourceEvidenceFinding) => void
  onDecision?: (
    kind: DecisionKind,
    finding: SourceEvidenceFinding,
    justification: string,
  ) => void
}

const COPY = {
  en: {
    title: 'Source Evidence Viewer',
    readOnly: 'read-only source',
    noFinding: 'Select a finding to review its exact source evidence.',
    evidence: 'Evidence',
    provenance: 'Provenance',
    inspector: 'Inspector',
    concept: 'Concept',
    classification: 'Classification',
    applicability: 'Applicability',
    action: 'Action',
    path: 'Path',
    justification: 'Structured justification',
    confirm: 'Confirm',
    change: 'Change',
    dismiss: 'Dismiss',
  },
  zh: {
    title: '来源证据查看器',
    readOnly: '只读来源',
    noFinding: '选择发现项以审查精确来源证据。',
    evidence: '证据',
    provenance: '出处',
    inspector: '检查器',
    concept: '概念',
    classification: '分类',
    applicability: '适用性',
    action: '动作',
    path: '路径',
    justification: '结构化理由',
    confirm: '确认',
    change: '变更',
    dismiss: '忽略',
  },
}

function selectedLabel(finding: SourceEvidenceFinding | null): string {
  return (
    finding?.observed_expression ||
    finding?.matched_text ||
    finding?.finding_id ||
    ''
  )
}

function projectFindingsToHighlights(
  findings: SourceEvidenceFinding[],
): SourceEvidenceHighlight[] {
  return findings
    .map((finding) => ({
      findingId: finding.finding_id,
      label: selectedLabel(finding),
      evidenceRef: finding.target_evidence_ref ?? '',
      anchorRef: finding.target_anchor_ref ?? '',
      relation: finding.semantic_relation ?? 'relation:unknown',
    }))
    .filter((highlight) => highlight.findingId && highlight.label)
}

function inferSourceEvidenceDocumentKind(
  refs: Array<string | null | undefined>,
): SourceEvidenceDocumentKind {
  for (const ref of refs) {
    const value = ref?.trim().toLowerCase()
    if (!value) continue
    if (/\.(pdf)(?:$|[?#])/.test(value)) return 'pdf'
    if (/\.(docx?|docm)(?:$|[?#])/.test(value)) return 'docx'
    if (value.includes('canonical_source_ir')) return 'canonical_source_ir'
    if (value.includes('document_extraction') || value.endsWith('.json')) {
      return 'canonical_source_ir'
    }
  }
  return 'unknown'
}

function resolveSourceEvidenceDocumentAdapter(
  documentKind: SourceEvidenceViewerProps['documentKind'],
  viewerConfig: ViewerConfig,
): SourceEvidenceDocumentAdapter {
  const kind = documentKind ?? 'unknown'
  if (kind === 'canonical_source_ir') {
    return {
      documentKind: kind,
      provider: 'canonical_source_ir',
      readOnly: true,
      overlayStrategy: 'canonical_anchor_projection',
    }
  }
  if (kind === 'docx' || kind === 'pdf') {
    return {
      documentKind: kind,
      provider: 'open_source_unified',
      readOnly: true,
      overlayStrategy: 'document_coordinates',
    }
  }
  return {
    documentKind: kind,
    provider: 'unavailable',
    readOnly: true,
    overlayStrategy: 'unavailable',
    diagnosticCode: 'unsupported_document_kind',
  }
}

export function SourceEvidenceViewer({
  zh,
  documentName,
  documentKind = 'unknown',
  sourceDocumentHash,
  viewerConfig,
  findings,
  selectedFindingId,
  onSelectFinding,
  onDecision,
}: SourceEvidenceViewerProps) {
  const t = zh ? COPY.zh : COPY.en
  const [justification, setJustification] = useState('')
  const selectedFinding = useMemo(
    () =>
      findings.find((finding) => finding.finding_id === selectedFindingId) ??
      findings[0] ??
      null,
    [findings, selectedFindingId],
  )
  const highlights = useMemo(
    () => projectFindingsToHighlights(findings),
    [findings],
  )
  const adapter = useMemo(
    () => resolveSourceEvidenceDocumentAdapter(documentKind, viewerConfig),
    [documentKind, viewerConfig],
  )
  const canRecord = Boolean(selectedFinding && justification.trim())

  return (
    <section
      aria-label={t.title}
      lang={zh ? 'zh-CN' : 'en'}
      className="grid min-h-[420px] gap-3 rounded-lg border border-border bg-card p-3 text-xs lg:grid-cols-[minmax(260px,1fr)_minmax(260px,0.8fr)]"
      data-testid="source-evidence-viewer"
      data-document-kind={documentKind}
      data-document-adapter-provider={adapter.provider}
      data-overlay-strategy={adapter.overlayStrategy}
    >
      <div className="flex min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{t.title}</h3>
          <Badge tone="info">{t.readOnly}</Badge>
          <Badge tone={documentKind === 'unknown' ? 'warning' : 'neutral'}>
            {documentKind}
          </Badge>
        </div>
        <div
          role="region"
          aria-label={zh ? '开源统一文档画布' : 'Open-source unified document canvas'}
          className="grid min-h-56 flex-1 place-items-center rounded-lg border border-dashed border-border bg-background p-4 text-center text-muted-foreground"
          data-viewer-provider={viewerConfig.provider}
          data-viewer-engine={viewerConfig.engine}
          data-document-adapter-provider={adapter.provider}
          data-overlay-strategy={adapter.overlayStrategy}
        >
          Open-source {documentKind.toUpperCase()} adapter configured through{' '}
          {viewerConfig.engine}
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <strong>{t.evidence}</strong>
            <span className="truncate font-mono text-[10px] text-muted-foreground">
              {documentName ?? sourceDocumentHash ?? 'source'}
            </span>
          </div>
          <div className="min-h-14 rounded-md border border-border bg-card p-3 leading-5">
            {highlights.length ? (
              <div className="flex flex-wrap gap-1.5">
                {highlights.map((highlight) => {
                  const finding = findings.find(
                    (candidate) =>
                      candidate.finding_id === highlight.findingId,
                  )
                  const selected =
                    selectedFinding?.finding_id === highlight.findingId
                  return (
                    <Button
                      key={highlight.findingId}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'border border-transparent bg-[var(--theme-accent)] px-1 text-left text-[var(--theme-accent-foreground,#163300)]',
                        selected &&
                          'border-[var(--dark-green,#163300)] shadow-[0_0_0_2px_var(--theme-accent-subtle)]',
                      )}
                      data-testid="finding-highlight"
                      data-finding-id={highlight.findingId}
                      data-evidence-ref={highlight.evidenceRef}
                      data-anchor-ref={highlight.anchorRef}
                      data-semantic-relation={highlight.relation}
                      data-selected={selected ? 'true' : undefined}
                      onClick={() => finding && onSelectFinding?.(finding)}
                    >
                      <mark className="bg-transparent text-inherit">
                        {highlight.label}
                      </mark>
                    </Button>
                  )
                })}
              </div>
            ) : (
              <span className="text-muted-foreground">{t.noFinding}</span>
            )}
          </div>
        </div>
      </div>
      <aside
        aria-label={t.inspector}
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
            {[
              ['confirm', t.confirm],
              ['change', t.change],
              ['dismiss', t.dismiss],
            ].map(([kind, label]) => (
              <Button
                key={kind}
                type="button"
                disabled={!canRecord}
                data-testid={`finding-${kind}-action`}
                onClick={() =>
                  selectedFinding &&
                  onDecision?.(
                    kind as DecisionKind,
                    selectedFinding,
                    justification.trim(),
                  )
                }
                className="h-8 rounded-md px-3 text-xs"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </aside>
    </section>
  )
}

export { projectFindingsToHighlights }
export { resolveSourceEvidenceDocumentAdapter }
export { inferSourceEvidenceDocumentKind }
export type {
  SourceEvidenceDocumentKind,
  SourceEvidenceDocumentAdapter,
  SourceEvidenceFinding,
  SourceEvidenceHighlight,
  ViewerConfig,
}
