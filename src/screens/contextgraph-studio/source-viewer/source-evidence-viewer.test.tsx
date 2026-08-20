// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'

import {
  SourceEvidenceViewer,
  inferSourceEvidenceDocumentKind,
  projectFindingsToHighlights,
  resolveSourceEvidenceDocumentAdapter,
} from './source-evidence-viewer'

const viewerConfig = {
  configured: true,
  provider: 'open-source-unified',
  engine: 'pdfjs-canonical-source-ir',
} as const

describe('SourceEvidenceViewer', () => {
  afterEach(() => cleanup())

  it('renders read-only evidence with the open-source viewer', () => {
    render(
      <SourceEvidenceViewer
        zh={false}
        documentName="target.docx"
        documentKind="docx"
        sourceDocumentHash="sha256:source"
        viewerConfig={viewerConfig}
        selectedFindingId="finding-1"
        findings={[
          {
            finding_id: 'finding-1',
            matched_text: 'Cisco',
            issue_type: 'brand_review',
            target_evidence_ref: 'evidence:1',
            target_anchor_ref: 'paragraph:4',
            semantic_relation: 'class_member',
            confidence: 0.91,
          },
        ]}
      />,
    )

    expect(screen.getByTestId('source-evidence-viewer').getAttribute('data-document-kind')).toBe(
      'docx',
    )
    expect(screen.getByText('read-only source')).toBeTruthy()
    expect(screen.getByTestId('finding-highlight').textContent).toBe('Cisco')
    expect(screen.getByTestId('finding-highlight').getAttribute('data-evidence-ref')).toBe(
      'evidence:1',
    )
    expect(screen.getByText('paragraph:4')).toBeTruthy()
  })

  it('projects each persisted finding into a selectable highlight', () => {
    const onSelectFinding = vi.fn()
    render(
      <SourceEvidenceViewer
        zh={false}
        documentKind="canonical_source_ir"
        viewerConfig={viewerConfig}
        selectedFindingId="finding-2"
        onSelectFinding={onSelectFinding}
        findings={[
          {
            finding_id: 'finding-1',
            matched_text: 'Cisco',
            target_evidence_ref: 'evidence:1',
            target_anchor_ref: 'paragraph:4',
            semantic_relation: 'class_member',
          },
          {
            finding_id: 'finding-2',
            observed_expression: 'sole source',
            target_evidence_ref: 'evidence:2',
            target_anchor_ref: 'paragraph:9',
            semantic_relation: 'scope_constraint',
          },
        ]}
      />,
    )

    const highlights = screen.getAllByTestId('finding-highlight')
    expect(highlights.map((element) => element.textContent)).toEqual([
      'Cisco',
      'sole source',
    ])
    expect(highlights[1].getAttribute('data-selected')).toBe('true')
    expect(highlights[1].getAttribute('data-anchor-ref')).toBe('paragraph:9')

    fireEvent.click(highlights[0])
    expect(onSelectFinding).toHaveBeenCalledWith(
      expect.objectContaining({ finding_id: 'finding-1' }),
    )
  })

  it('exposes deterministic highlight projection for document overlay adapters', () => {
    expect(
      projectFindingsToHighlights([
        {
          finding_id: 'finding-1',
          matched_text: 'Cisco',
          target_evidence_ref: 'evidence:1',
          target_anchor_ref: 'paragraph:4',
          semantic_relation: 'class_member',
        },
        {
          finding_id: 'finding-empty',
        },
      ]),
    ).toEqual([
      {
        findingId: 'finding-1',
        label: 'Cisco',
        evidenceRef: 'evidence:1',
        anchorRef: 'paragraph:4',
        relation: 'class_member',
      },
      {
        findingId: 'finding-empty',
        label: 'finding-empty',
        evidenceRef: '',
        anchorRef: '',
        relation: 'relation:unknown',
      },
    ])
  })

  it('resolves DOCX and PDF to a read-only open-source document-coordinate adapter', () => {
    expect(
      resolveSourceEvidenceDocumentAdapter('docx', viewerConfig),
    ).toEqual({
      documentKind: 'docx',
      provider: 'open_source_unified',
      readOnly: true,
      overlayStrategy: 'document_coordinates',
    })
    expect(
      resolveSourceEvidenceDocumentAdapter('pdf', viewerConfig),
    ).toEqual({
      documentKind: 'pdf',
      provider: 'open_source_unified',
      readOnly: true,
      overlayStrategy: 'document_coordinates',
    })
  })

  it('infers document kind from governed source refs and artifact refs', () => {
    expect(
      inferSourceEvidenceDocumentKind([
        'workspaces/ws-1/uploads/runtime-source.pdf',
      ]),
    ).toBe('pdf')
    expect(
      inferSourceEvidenceDocumentKind([
        'repo://docs/tender-source.docx?version=1',
      ]),
    ).toBe('docx')
    expect(
      inferSourceEvidenceDocumentKind([
        'artifacts/document_extraction/runtime-source.json',
      ]),
    ).toBe('canonical_source_ir')
    expect(inferSourceEvidenceDocumentKind([null, ''])).toBe('unknown')
  })

  it('renders configured DOCX/PDF adapter attributes for overlay E2E hooks', () => {
    render(
      <SourceEvidenceViewer
        zh={false}
        documentName="target.pdf"
        documentKind="pdf"
        viewerConfig={viewerConfig}
        findings={[
          {
            finding_id: 'finding-1',
            matched_text: 'Cisco',
            target_evidence_ref: 'evidence:1',
            target_anchor_ref: 'page:1:rect:10,20,30,40',
          },
        ]}
      />,
    )

    const viewer = screen.getByTestId('source-evidence-viewer')
    expect(viewer.getAttribute('data-document-adapter-provider')).toBe('open_source_unified')
    expect(viewer.getAttribute('data-overlay-strategy')).toBe(
      'document_coordinates',
    )
    expect(screen.getByText(/Open-source PDF adapter configured through/)).toBeTruthy()
  })

  it('requires structured justification before Confirm Change Dismiss actions', () => {
    const onDecision = vi.fn()
    render(
      <SourceEvidenceViewer
        zh={false}
        documentKind="pdf"
        viewerConfig={viewerConfig}
        onDecision={onDecision}
        findings={[
          {
            finding_id: 'finding-1',
            observed_expression: 'restricted supplier',
            decision_status: 'applicability=unknown',
          },
        ]}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Confirm' }).hasAttribute('disabled'),
    ).toBe(true)
    fireEvent.change(screen.getByTestId('finding-feedback-justification'), {
      target: { value: 'Human review confirms this applies to the clause.' },
    })
    fireEvent.click(screen.getByTestId('finding-change-action'))

    expect(onDecision).toHaveBeenCalledWith(
      'change',
      expect.objectContaining({ finding_id: 'finding-1' }),
      'Human review confirms this applies to the clause.',
    )
    expect(within(screen.getByLabelText('Inspector')).getByText('applicability=unknown')).toBeTruthy()
  })
})
