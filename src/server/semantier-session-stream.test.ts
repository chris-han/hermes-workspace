import { describe, expect, it } from 'vitest'

import { translateSemantierSessionStreamEvent } from './semantier-session-stream'

describe('translateSemantierSessionStreamEvent', () => {
  it('maps agent text deltas into workspace chunk frames', () => {
    expect(
      translateSemantierSessionStreamEvent(
        'text_delta',
        { content: 'hello' },
        'run-1',
      ),
    ).toEqual([{ event: 'chunk', data: { delta: 'hello' } }])
  })

  it('preserves leading/trailing spaces in text_delta content', () => {
    expect(
      translateSemantierSessionStreamEvent(
        'text_delta',
        { content: ' happy to help' },
        'run-1',
      ),
    ).toEqual([{ event: 'chunk', data: { delta: ' happy to help' } }])
  })

  it('falls back to text field when content is missing', () => {
    expect(
      translateSemantierSessionStreamEvent(
        'text_delta',
        { text: ' world' },
        'run-1',
      ),
    ).toEqual([{ event: 'chunk', data: { delta: ' world' } }])
  })

  it('maps tool results into complete tool frames', () => {
    expect(
      translateSemantierSessionStreamEvent(
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
      translateSemantierSessionStreamEvent(
        'attempt.failed',
        { error: 'boom' },
        'run-1',
      ),
    ).toEqual([
      { event: 'done', data: { state: 'error', errorMessage: 'boom' } },
    ])
  })

  it('maps completed attempts with run metadata into done events', () => {
    expect(
      translateSemantierSessionStreamEvent(
        'attempt.completed',
        {
          summary: 'Done',
          run_dir: '/tmp/workspaces/ws-1/runs/20260422_010101_abcd',
          has_run_artifact: true,
          metrics: { sharpe: 1.2 },
        },
        'run-1',
      ),
    ).toEqual([
      {
        event: 'done',
        data: {
          state: 'complete',
          runId: '20260422_010101_abcd',
          run_dir: '/tmp/workspaces/ws-1/runs/20260422_010101_abcd',
          has_run_artifact: true,
          summary: 'Done',
          metrics: { sharpe: 1.2 },
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Done' }],
          },
        },
      },
    ])
  })

  it('includes authoritative message payload when summary is present to prevent a2ui dedup failure', () => {
    // The backend strips ```a2ui…``` fences from the stored message but the
    // streaming buffer still contains the raw fence.  Without an authoritative
    // `message` field in the done payload the chat store falls back to
    // streaming.text (with the raw fence), which then fails the dedup check
    // against the history message (blank lines where the fence was), causing
    // both the realtime and the history message to render simultaneously.
    const events = translateSemantierSessionStreamEvent(
      'attempt.completed',
      {
        summary: 'Fill in the form.\n\n\n\nSubmit when ready.',
        run_dir: '/tmp/runs/20260424_123456_abc',
      },
      'run-2',
    )
    expect(events).toHaveLength(1)
    const done = events[0]
    expect(done.event).toBe('done')
    expect(done.data.message).toEqual({
      role: 'assistant',
      content: [{ type: 'text', text: 'Fill in the form.\n\n\n\nSubmit when ready.' }],
    })
  })

  it('omits message field when summary is absent', () => {
    const events = translateSemantierSessionStreamEvent(
      'attempt.completed',
      { run_dir: '/tmp/runs/20260424_123456_abc' },
      'run-3',
    )
    expect(events).toHaveLength(1)
    expect(events[0].data.message).toBeUndefined()
  })
})
