import { describe, expect, it } from 'vitest'

import {
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