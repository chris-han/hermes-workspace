import { describe, expect, it } from 'vitest'

import { translateVibeSessionStreamEvent } from './vibe-session-stream'

describe('translateVibeSessionStreamEvent', () => {
  it('maps agent text deltas into workspace chunk frames', () => {
    expect(
      translateVibeSessionStreamEvent('text_delta', { content: 'hello' }, 'run-1'),
    ).toEqual([{ event: 'chunk', data: { delta: 'hello' } }])
  })

  it('maps tool results into complete tool frames', () => {
    expect(
      translateVibeSessionStreamEvent(
        'tool_result',
        { tool: 'search_files', preview: '2 matches', status: 'ok' },
        'run-1',
      ),
    ).toEqual([
      {
        event: 'tool',
        data: {
          phase: 'complete',
          name: 'search_files',
          preview: '2 matches',
          result: '2 matches',
          status: 'ok',
          toolCallId: 'run-1:search_files',
        },
      },
    ])
  })

  it('maps failed attempts into terminal done events', () => {
    expect(
      translateVibeSessionStreamEvent('attempt.failed', { error: 'boom' }, 'run-1'),
    ).toEqual([{ event: 'done', data: { state: 'error', errorMessage: 'boom' } }])
  })
})
