import { describe, expect, it } from 'vitest'

import { normalizeSessionActivityPayload } from './inspector-panel'

describe('canonical Inspector Activity projection', () => {
  it('preserves semantic filter metadata and source references', () => {
    const [event] = normalizeSessionActivityPayload({
      events: [{
        type: 'KNOWLEDGE_ADMITTED',
        time: '2026-08-02T00:00:00Z',
        text: 'KNOWLEDGE_ADMITTED',
        input_refs: [{ ref_type: 'document_span', ref_id: 'doc_1' }],
        details: {
          sequence: 4,
          state_effect: 'admit',
          actor_ref: 'actor_a',
        },
      }],
    })

    expect(event).toMatchObject({
      type: 'KNOWLEDGE_ADMITTED',
      time: '2026-08-02T00:00:00Z',
      details: {
        sequence: 4,
        state_effect: 'admit',
        actor_ref: 'actor_a',
        input_refs: [{ ref_type: 'document_span', ref_id: 'doc_1' }],
      },
    })
  })
})
