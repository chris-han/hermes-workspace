import { afterEach, describe, expect, it } from 'vitest'

import {
  createKnowledgeBuilderEvaluationDataset,
  rateKnowledgeBuilderEvaluationResult,
  runKnowledgeBuilderEvaluation,
} from './knowledge-builder-evaluation'

describe('knowledge-builder evaluation server adapter', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('creates evaluation datasets through governed backend routes', async () => {
    globalThis.fetch = async (input, init) => {
      expect(String(input)).toContain('/api/knowledge/builder/evaluation-datasets')
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body)).useTenderUatFixture).toBe(true)
      return new Response(
        JSON.stringify({
          evaluationDataset: {
            evaluation_dataset_id: 'kbed_1',
            examples: [{ case_type: 'positive' }],
          },
        }),
        { status: 200 },
      )
    }

    const dataset = await createKnowledgeBuilderEvaluationDataset(new Headers(), {
      discoveryRunId: 'kbd_1',
      useTenderUatFixture: true,
    })
    expect(dataset.evaluation_dataset_id).toBe('kbed_1')
  })

  it('runs evaluations and returns activation-gate metrics', async () => {
    globalThis.fetch = async (input, init) => {
      expect(String(input)).toContain('/api/knowledge/builder/evaluation-runs')
      expect(init?.method).toBe('POST')
      return new Response(
        JSON.stringify({
          evaluationRun: {
            evaluation_run_id: 'kber_1',
            metrics: { precision: 1, recall: 1 },
            authority_notice: 'evaluation results are non-authoritative',
          },
        }),
        { status: 200 },
      )
    }

    const run = await runKnowledgeBuilderEvaluation(new Headers(), {
      evaluationDatasetId: 'kbed_1',
      discoveryRunId: 'kbd_1',
    })
    expect(run.metrics).toEqual({ precision: 1, recall: 1 })
  })

  it('persists human ratings for evaluation results', async () => {
    globalThis.fetch = async (input, init) => {
      expect(String(input)).toContain('/api/knowledge/builder/evaluation-results/kberes_1/rating')
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body)).humanRating).toBe('pass')
      return new Response(
        JSON.stringify({
          evaluationResult: {
            evaluation_result_id: 'kberes_1',
            human_rating: 'pass',
          },
        }),
        { status: 200 },
      )
    }

    const result = await rateKnowledgeBuilderEvaluationResult(new Headers(), {
      resultId: 'kberes_1',
      humanRating: 'pass',
      explanationAcceptance: 'accepted',
    })
    expect(result.human_rating).toBe('pass')
  })
})
