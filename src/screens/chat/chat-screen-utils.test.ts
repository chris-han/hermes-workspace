import { describe, expect, it } from 'vitest'

import {
  advanceStickyStreamingText,
  getStreamingPlaceholderMessageId,
  hasAssistantReplyAfterLastUser,
} from './chat-screen-utils'

describe('advanceStickyStreamingText', () => {
  it('preserves the last non-empty streaming text when a tool phase temporarily reports empty text', () => {
    const afterText = advanceStickyStreamingText({
      isStreaming: true,
      runId: 'run-1',
      rawText: 'Working through the task',
      smoothedText: 'Working through the task',
      previousState: { runId: null, text: '' },
    })

    const afterToolPhase = advanceStickyStreamingText({
      isStreaming: true,
      runId: 'run-1',
      rawText: '',
      smoothedText: '',
      previousState: afterText,
    })

    expect(afterToolPhase).toEqual({
      runId: 'run-1',
      text: 'Working through the task',
    })
  })

  it('resets sticky text when a new run starts', () => {
    const next = advanceStickyStreamingText({
      isStreaming: true,
      runId: 'run-2',
      rawText: '',
      smoothedText: '',
      previousState: { runId: 'run-1', text: 'Old stream text' },
    })

    expect(next).toEqual({ runId: 'run-2', text: '' })
  })

  it('clears sticky text when streaming ends', () => {
    const next = advanceStickyStreamingText({
      isStreaming: false,
      runId: null,
      rawText: '',
      smoothedText: '',
      previousState: { runId: 'run-1', text: 'Old stream text' },
    })

    expect(next).toEqual({ runId: null, text: '' })
  })
})

describe('hasAssistantReplyAfterLastUser', () => {
  it('detects that the streamed reply has already materialized after the last user', () => {
    expect(
      hasAssistantReplyAfterLastUser({
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Summarize the run' }],
          },
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'The run completed successfully.' },
            ],
            id: 'assistant-1',
          },
        ],
        streamingText: 'The run completed successfully.',
      }),
    ).toBe(true)
  })

  it('ignores the synthetic streaming placeholder when checking for a real reply', () => {
    expect(
      hasAssistantReplyAfterLastUser({
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Summarize the run' }],
          },
          {
            role: 'assistant',
            content: [],
            __optimisticId: 'streaming-current',
            __streamingStatus: 'streaming',
            __streamingText: 'The run completed',
          },
        ],
        streamingText: 'The run completed',
      }),
    ).toBe(false)
  })

  it('returns false when the only assistant reply belongs to an earlier turn', () => {
    expect(
      hasAssistantReplyAfterLastUser({
        messages: [
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'Earlier answer.' }],
          },
          {
            role: 'user',
            content: [{ type: 'text', text: 'New question' }],
          },
        ],
        streamingText: 'Earlier answer.',
      }),
    ).toBe(false)
  })
})

describe('getStreamingPlaceholderMessageId', () => {
  it('returns the active synthetic streaming message identity instead of the final assistant identity', () => {
    expect(
      getStreamingPlaceholderMessageId([
        {
          role: 'user',
          content: [{ type: 'text', text: 'Question' }],
        },
        {
          role: 'assistant',
          content: [],
          __optimisticId: 'streaming-current',
          __streamingStatus: 'streaming',
        },
        {
          role: 'assistant',
          id: 'final-assistant',
          content: [{ type: 'text', text: 'Final answer.' }],
          __streamingStatus: 'complete',
        },
      ]),
    ).toBe('streaming-current')
  })
})
