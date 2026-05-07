import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import {
  NEW_CHAT_HISTORY_QUERY_KEY,
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
