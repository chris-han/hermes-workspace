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
          text: 'Here is the table.\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n[Full report](/runs/20260422_150534_27_ca822b)\n\nRun directory: /tmp/run/20260422_150534_27_ca822b',
        },
      ],
    }

    const merged = useChatStore
      .getState()
      .mergeHistoryMessages(sessionKey, [historyAssistant])

    expect(merged).toHaveLength(1)
    expect(textOf(merged[0])).toContain(
      '[Full report](/runs/20260422_150534_27_ca822b)',
    )
    expect(textOf(merged[0])).toContain(
      'Run directory: /tmp/run/20260422_150534_27_ca822b',
    )
  })

  it('deduplicates assistant stream/history messages across workspace-prefixed session aliases', () => {
    const internalSessionKey = 'ws-123:session_abc'
    const externalSessionKey = 'session_abc'
    const assistantText =
      '你的公司是 **北京索阳科技有限公司**。\n\n这是当前 governed runtime context 中记录的你所属的活跃组织。'

    const streamedAssistant: ChatMessage = {
      role: 'assistant',
      content: [{ type: 'text', text: assistantText }],
    }

    useChatStore.setState({
      realtimeMessages: new Map([[internalSessionKey, [streamedAssistant]]]),
    })

    const historyAssistant: ChatMessage = {
      role: 'assistant',
      id: 'msg-history-1',
      content: [{ type: 'text', text: assistantText }],
    }

    const merged = useChatStore
      .getState()
      .mergeHistoryMessages(externalSessionKey, [historyAssistant])

    expect(merged).toHaveLength(1)
    expect(textOf(merged[0])).toBe(assistantText)
  })

  it('uses realtime messages from workspace-prefixed session aliases before history catches up', () => {
    const internalSessionKey = 'ws-123:session_abc'
    const externalSessionKey = 'session_abc'
    const streamedAssistant: ChatMessage = {
      role: 'assistant',
      content: [{ type: 'text', text: 'streamed reply' }],
    }

    useChatStore.setState({
      realtimeMessages: new Map([[internalSessionKey, [streamedAssistant]]]),
    })

    const merged = useChatStore
      .getState()
      .mergeHistoryMessages(externalSessionKey, [])

    expect(merged).toHaveLength(1)
    expect(textOf(merged[0])).toBe('streamed reply')
  })
})
