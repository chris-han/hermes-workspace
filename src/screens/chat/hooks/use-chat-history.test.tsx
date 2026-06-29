import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it } from 'vitest'

import { chatQueryKeys } from '../chat-queries'
import { getNewChatHistorySnapshot } from './use-chat-history'
import type { HistoryResponse } from '../types'

afterEach(() => {
  // no-op placeholder for consistency with other hook tests
})

describe('getNewChatHistorySnapshot', () => {
  it('returns the cached new-chat draft from the new/main history key', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    const cachedHistory: HistoryResponse = {
      sessionKey: 'main',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'draft message' }],
        },
      ],
    }

    queryClient.setQueryData(
      chatQueryKeys.history('new', 'main'),
      cachedHistory,
    )

    expect(
      getNewChatHistorySnapshot(
        queryClient,
        chatQueryKeys.history('new', 'main'),
        'main',
      ),
    ).toEqual(cachedHistory)
  })

  it('falls back to an empty main-session draft when no cache exists', () => {
    const queryClient = new QueryClient()

    expect(
      getNewChatHistorySnapshot(
        queryClient,
        chatQueryKeys.history('new', 'main'),
        'main',
      ),
    ).toEqual({
      sessionKey: 'main',
      messages: [],
    })
  })
})
