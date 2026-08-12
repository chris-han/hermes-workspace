import { afterEach, describe, expect, it } from 'vitest'
import { knowledgeEvidenceLink, launchBenchmark, listBenchmarkOrchestrations } from './knowledge-evaluation'

describe('knowledge evaluation adapter', () => {
  const originalFetch = globalThis.fetch
  afterEach(() => { globalThis.fetch = originalFetch })
  it('lists tenant-scoped benchmark projections', async () => {
    globalThis.fetch = async (input) => { expect(String(input)).toContain('/benchmark-runs'); return new Response(JSON.stringify({ benchmarkOrchestrations: [{ benchmark_orchestration_id: 'o1' }] })) }
    expect((await listBenchmarkOrchestrations())[0].benchmark_orchestration_id).toBe('o1')
  })
  it('launches an explicit non-official execution mode', async () => {
    globalThis.fetch = async (_input, init) => { expect(JSON.parse(String(init?.body)).executionMode).toBe('recorded'); return new Response(JSON.stringify({ benchmarkOrchestration: { benchmark_orchestration_id: 'o2' } })) }
    expect((await launchBenchmark({ profileId: 'p', profileVersion: '1', layers: ['graph'], executionMode: 'recorded' })).benchmark_orchestration_id).toBe('o2')
  })
  it('deep-links to governed assertion evidence', () => { expect(knowledgeEvidenceLink('assertion:1')).toContain('assertion_id=assertion%3A1') })
})
