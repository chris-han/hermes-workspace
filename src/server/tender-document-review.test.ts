import { afterEach, describe, expect, it } from 'vitest'

import {
  TENDER_DOCUMENT_REVIEW_COMPATIBILITY_ROUTE,
  TENDER_SENSITIVE_TERM_DETECTION_MODELING_DASHBOARD_CONTRACT,
  createTenderDetection,
  createTenderReport,
  findingHasAiAssistedSuggestion,
  recordTenderFindingDisposition,
  recordTenderFindingFeedback,
  recordTenderRunMissedFindingFeedback,
} from './tender-document-review'

describe('tender-document-review server adapter', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('consumes the versioned plugin contract through the compatibility facade only', () => {
    expect(TENDER_SENSITIVE_TERM_DETECTION_MODELING_DASHBOARD_CONTRACT).toBe(
      'tender_sensitive_term_detection_modeling.dashboard.v1',
    )
    expect(TENDER_DOCUMENT_REVIEW_COMPATIBILITY_ROUTE).toBe(
      '/api/tender-document-review',
    )
  })

  it('creates detection runs through governed backend routes', async () => {
    globalThis.fetch = async (input, init) => {
      expect(String(input)).toContain('/api/tender-document-review/detections')
      expect(init?.method).toBe('POST')
      return new Response(
        JSON.stringify({
          run: {
            run_id: 'tdr_1',
            tender_document_id: 'tdoc_1',
            source_document_hash: 'hash_1',
            findings: [
              {
                finding_id: 'tdf_1',
                issue_type: 'competition_restriction',
                matched_text: 'unique',
                judgment_basis: 'governed rationale',
                severity: 'high',
                confidence: 0.91,
                suggested_replacement:
                  'AI-assisted recommendation: remove or revise unique.',
                escalation_flag: false,
              },
            ],
            dispositions: [],
          },
        }),
        { status: 200 },
      )
    }

    const run = await createTenderDetection(new Headers(), {
      documentText: 'unique supplier',
    })
    expect(run.run_id).toBe('tdr_1')
    expect(findingHasAiAssistedSuggestion(run.findings[0])).toBe(true)
  })

  it('records user disposition separately from AI suggestions', async () => {
    globalThis.fetch = async (input, init) => {
      expect(String(input)).toContain('/disposition')
      expect(init?.method).toBe('POST')
      return new Response(
        JSON.stringify({
          disposition: {
            disposition_id: 'tdd_1',
            disposition: 'edited',
            edited_replacement: 'Use performance criteria.',
          },
          semantic_feedback_event: {
            schema_version: 'semantic_feedback_event.v1',
            feedback_id: 'sfe_1',
            action: 'change',
          },
        }),
        { status: 200 },
      )
    }

    const result = await recordTenderFindingDisposition(new Headers(), {
      runId: 'tdr_1',
      findingId: 'tdf_1',
      disposition: 'edited',
      editedReplacement: 'Use performance criteria.',
    })
    expect((result.disposition as Record<string, unknown>).disposition).toBe(
      'edited',
    )
    expect(
      (result.semantic_feedback_event as Record<string, unknown>).feedback_id,
    ).toBe('sfe_1')
  })

  it('creates final reports through governed backend routes', async () => {
    globalThis.fetch = async (input, init) => {
      expect(String(input)).toContain('/api/tender-document-review/runs/tdr_1/report')
      expect(init?.method).toBe('POST')
      return new Response(
        JSON.stringify({
          report: {
            report_id: 'tdrep_1',
            replay_binding_ref: 'tender_detection_report:tdrep_1',
          },
        }),
        { status: 200 },
      )
    }

    const report = await createTenderReport(new Headers(), 'tdr_1')
    expect(report.report_id).toBe('tdrep_1')
  })

  it('records runtime feedback and returns candidate graph deltas', async () => {
    globalThis.fetch = async (input, init) => {
      expect(String(input)).toContain('/api/tender-document-review/runs/tdr_1/findings/tdf_1/feedback')
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body)).feedbackType).toBe('false_positive')
      return new Response(
        JSON.stringify({
          feedback: {
            feedbackEvent: { feedback_event_id: 'rfe_1' },
            candidateDelta: { candidate_delta_id: 'rfcd_1', delta_kind: 'not_same_as' },
            discoveryRun: { discovery_run_id: 'kbd_1' },
          },
        }),
        { status: 200 },
      )
    }

    const feedback = await recordTenderFindingFeedback(new Headers(), {
      runId: 'tdr_1',
      findingId: 'tdf_1',
      feedbackType: 'false_positive',
      userDisposition: { disposition: 'rejected' },
      escalationOutcome: 'escalated',
      reviewerNotes: 'false friend',
    })
    expect((feedback.candidateDelta as Record<string, unknown>).delta_kind).toBe('not_same_as')
  })

  it('records a run-level missed finding with an exact source span', async () => {
    globalThis.fetch = async (input, init) => {
      expect(String(input)).toContain('/runs/tdr_1/feedback')
      const body = JSON.parse(String(init?.body))
      expect(body.feedbackType).toBe('false_negative')
      expect(body.sourceSpan).toEqual({ text: 'unique', startOffset: 0, endOffset: 6 })
      return new Response(JSON.stringify({ feedback: { candidateDelta: { candidate_delta_id: 'rfcd_2' } } }), { status: 200 })
    }
    const feedback = await recordTenderRunMissedFindingFeedback(new Headers(), {
      runId: 'tdr_1',
      sourceSpan: { text: 'unique', startOffset: 0, endOffset: 6 },
      reviewerNotes: 'Missed restriction.',
    })
    expect((feedback.candidateDelta as Record<string, unknown>).candidate_delta_id).toBe('rfcd_2')
  })
})
