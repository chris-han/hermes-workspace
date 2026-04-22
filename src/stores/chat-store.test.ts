import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useChatStore } from './chat-store'
import type { ChatMessage } from '../screens/chat/types'

function textOf(message: ChatMessage): string {
  if (!Array.isArray(message.content)) return ''
  return message.content
    .filter((part) => part.type === 'text')
    .map((part) => String((part as { text?: string }).text ?? ''))
    .join('')
}

function resetStoreState() {
  useChatStore.setState({
    connectionState: 'disconnected',
    lastError: null,
    realtimeMessages: new Map(),
    streamingState: new Map(),
    lastEventAt: 0,
    sendStreamRunIds: new Set(),
    waitingSessionKeys: new Set(),
    waitingSessionMeta: {},
  })
}

describe('chat-store mergeHistoryMessages', () => {
  beforeEach(() => {
    resetStoreState()
  })

  afterEach(() => {
    resetStoreState()
  })

  it('deduplicates assistant stream/history variants that differ only by run artifact footer', () => {
    const sessionKey = 's-1'
    const streamedAssistant: ChatMessage = {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Here is the table.\n\n| A | B |\n| - | - |\n| 1 | 2 |',
        },
      ],
    }

    useChatStore.setState({
      realtimeMessages: new Map([[sessionKey, [streamedAssistant]]]),
    })

    const historyAssistant: ChatMessage = {
      role: 'assistant',
      id: 'msg-history-1',
      content: [
        {
          type: 'text',
          text:
            'Here is the table.\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n[Full report](/runs/20260422_150534_27_ca822b)\n\nRun directory: /tmp/run/20260422_150534_27_ca822b',
        },
      ],
    }

    const merged = useChatStore
      .getState()
      .mergeHistoryMessages(sessionKey, [historyAssistant])

    expect(merged).toHaveLength(1)
    expect(textOf(merged[0])).toContain('[Full report](/runs/20260422_150534_27_ca822b)')
    expect(textOf(merged[0])).toContain('Run directory: /tmp/run/20260422_150534_27_ca822b')
  })
})
