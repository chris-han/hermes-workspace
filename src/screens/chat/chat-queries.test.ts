import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import {
  NEW_CHAT_HISTORY_QUERY_KEY,
  branchSessionAtMessage,
  chatQueryKeys,
  resetNewChatHistory,
} from './chat-queries'

describe('resetNewChatHistory', () => {
  it('clears the cached draft under the new/main history key', () => {
    const queryClient = new QueryClient()

    queryClient.setQueryData(chatQueryKeys.history('new', 'main'), {
      sessionKey: 'main',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'stale' }] }],
    })

    queryClient.setQueryData(chatQueryKeys.history('new', 'new'), {
      sessionKey: 'new',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'wrong-key' }] },
      ],
    })

    resetNewChatHistory(queryClient)

    expect(queryClient.getQueryData(NEW_CHAT_HISTORY_QUERY_KEY)).toEqual({
      sessionKey: 'main',
      messages: [],
    })
    expect(
      queryClient.getQueryData(chatQueryKeys.history('new', 'new')),
    ).toEqual({
      sessionKey: 'new',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'wrong-key' }] },
      ],
    })
  })
})

describe('branchSessionAtMessage', () => {
  it('posts a stable cursor and idempotency key to the workspace adapter', async () => {
    const originalFetch = global.fetch
    global.fetch = (async (input, init) => {
      expect(String(input)).toBe('/api/sessions/source/branches')
      expect(init?.method).toBe('POST')
      expect(new Headers(init?.headers).get('Idempotency-Key')).toBe('idem-1')
      expect(init?.body).toBe(
        JSON.stringify({
          branchPoint: { messageId: 'msg-2', sequence: 2 },
          title: '⎇ Source',
          idempotencyKey: 'idem-1',
        }),
      )
      return new Response(
        JSON.stringify({ ok: true, session: { key: 'child' }, copied: {} }),
        { status: 200 },
      )
    }) as typeof fetch

    try {
      await expect(
        branchSessionAtMessage({
          sessionKey: 'source',
          messageId: 'msg-2',
          sequence: 2,
          title: '⎇ Source',
          idempotencyKey: 'idem-1',
        }),
      ).resolves.toMatchObject({ ok: true })
    } finally {
      global.fetch = originalFetch
    }
  })
})
