// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react'

import { FindingInspector } from './finding-inspector'

const sampleFinding = {
  finding_id: 'finding-1',
  matched_text: 'Cisco',
  observed_expression: 'Cisco Systems',
  issue_type: 'brand_review',
  decision_status: 'applicability=review',
  detection_method: 'rule',
  semantic_relation: 'class_member',
  target_evidence_ref: 'evidence:1',
  target_anchor_ref: 'paragraph:4',
  confidence: 0.91,
}

const sampleFindings = [sampleFinding]

describe('FindingInspector', () => {
  afterEach(() => cleanup())

  it('renders the inspector aside with all decision controls', () => {
    render(
      <FindingInspector
        zh={false}
        findings={sampleFindings}
        selectedFinding={sampleFinding}
        sourceDocumentHash="sha256:source"
        onSelectFinding={vi.fn()}
        onDecision={vi.fn()}
      />,
    )

    expect(screen.getByTestId('finding-inspector')).toBeTruthy()
    expect(screen.getByTestId('finding-feedback-justification')).toBeTruthy()
    expect(screen.getByTestId('finding-confirm-action')).toBeTruthy()
    expect(screen.getByTestId('finding-change-action')).toBeTruthy()
    expect(screen.getByTestId('finding-dismiss-action')).toBeTruthy()
  })

  it('disables the decision actions until a non-empty justification is entered', () => {
    render(
      <FindingInspector
        zh={false}
        findings={sampleFindings}
        selectedFinding={sampleFinding}
        onDecision={vi.fn()}
      />,
    )

    const confirm = screen.getByTestId('finding-confirm-action') as HTMLButtonElement
    expect(confirm.disabled).toBe(true)

    fireEvent.change(screen.getByTestId('finding-feedback-justification'), {
      target: { value: 'verified against the contract' },
    })
    expect(confirm.disabled).toBe(false)
  })

  it('invokes onDecision with the typed justification and the selected finding', () => {
    const onDecision = vi.fn()
    render(
      <FindingInspector
        zh={false}
        findings={sampleFindings}
        selectedFinding={sampleFinding}
        onDecision={onDecision}
      />,
    )

    fireEvent.change(screen.getByTestId('finding-feedback-justification'), {
      target: { value: 'confirmed' },
    })
    fireEvent.click(screen.getByTestId('finding-change-action'))

    expect(onDecision).toHaveBeenCalledTimes(1)
    expect(onDecision).toHaveBeenCalledWith(
      'change',
      sampleFinding,
      'confirmed',
    )
  })

  it('does not invoke onDecision when there is no selected finding', () => {
    const onDecision = vi.fn()
    render(
      <FindingInspector
        zh={false}
        findings={sampleFindings}
        selectedFinding={null}
        onDecision={onDecision}
      />,
    )

    fireEvent.change(screen.getByTestId('finding-feedback-justification'), {
      target: { value: 'should not fire' },
    })
    fireEvent.click(screen.getByTestId('finding-confirm-action'))

    expect(onDecision).not.toHaveBeenCalled()
  })

  it('invokes onSelectFinding when a finding button is clicked', () => {
    const onSelectFinding = vi.fn()
    const findings = [
      sampleFinding,
      {
        ...sampleFinding,
        finding_id: 'finding-2',
        matched_text: 'sole source',
        observed_expression: null,
      },
    ]
    render(
      <FindingInspector
        zh={false}
        findings={findings}
        selectedFinding={sampleFinding}
        onSelectFinding={onSelectFinding}
      />,
    )

    const buttons = screen.getAllByRole('button')
    const soleSourceButton = buttons.find((button) =>
      button.textContent?.includes('sole source'),
    )
    expect(soleSourceButton).toBeTruthy()
    fireEvent.click(soleSourceButton!)

    expect(onSelectFinding).toHaveBeenCalledTimes(1)
    expect(onSelectFinding).toHaveBeenCalledWith(findings[1])
  })

  it('renders the Chinese copy when zh is true', () => {
    render(
      <FindingInspector
        zh={true}
        findings={sampleFindings}
        selectedFinding={sampleFinding}
        sourceDocumentHash="sha256:source"
      />,
    )

    const aside = screen.getByTestId('finding-inspector')
    expect(aside.getAttribute('lang')).toBe('zh-CN')
    expect(aside.textContent).toContain('检查器')
    expect(aside.textContent).toContain('结构化理由')
  })
})
