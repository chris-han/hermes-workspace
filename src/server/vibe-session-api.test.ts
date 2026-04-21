import { describe, expect, it } from 'vitest'

import {
  VibeSessionApiError,
  isVibeSessionNotFoundError,
  toVibeChatMessage,
  toVibeSessionSummary,
} from './vibe-session-api'

describe('toVibeSessionSummary', () => {
  it('maps backend sessions into workspace sidebar summaries', () => {
    const summary = toVibeSessionSummary({
      session_id: 'sess-123',
      title: 'My Session',
      created_at: '2026-04-21T10:00:00Z',
      updated_at: '2026-04-21T10:05:00Z',
      status: 'idle',
    })

    expect(summary).toMatchObject({
      key: 'sess-123',
      friendlyId: 'sess-123',
      label: 'My Session',
      title: 'My Session',
      derivedTitle: 'My Session',
      status: 'idle',
    })
    expect(summary.updatedAt).toBe(Date.parse('2026-04-21T10:05:00Z'))
  })
})

describe('toVibeChatMessage', () => {
  it('maps backend messages into chat history items', () => {
    const message = toVibeChatMessage(
      {
        message_id: 'msg-1',
        session_id: 'sess-123',
        role: 'assistant',
        content: 'Hello',
        created_at: '2026-04-21T10:05:00Z',
      },
      3,
    )

    expect(message).toMatchObject({
      id: 'msg-msg-1',
      role: 'assistant',
      text: 'Hello',
      sessionKey: 'sess-123',
      __historyIndex: 3,
    })
    expect(message.content).toEqual([{ type: 'text', text: 'Hello' }])
  })
})

describe('isVibeSessionNotFoundError', () => {
  it('matches typed 404 errors from the agent session API', () => {
    const error = new VibeSessionApiError(
      '/sessions/sess-123/messages',
      404,
      'Session sess-123 not found',
    )

    expect(isVibeSessionNotFoundError(error)).toBe(true)
  })

  it('ignores non-404 API errors', () => {
    const error = new VibeSessionApiError(
      '/sessions/sess-123/messages',
      500,
      'Internal server error',
    )

    expect(isVibeSessionNotFoundError(error)).toBe(false)
  })
})