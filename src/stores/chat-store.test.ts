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
    lastEventAtBySession: new Map(),
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

  it('deduplicates when history message has raw <think> block but stream message does not (regression #double-reply)', () => {
    const sessionKey = 'session-think-test'
    const visibleText = "Hi! I'm ready to help. What would you like to work on?"

    // Streamed message has think blocks already stripped (as emitted by SSE)
    const streamedAssistant: ChatMessage = {
      role: 'assistant',
      content: [{ type: 'text', text: visibleText }],
    }

    useChatStore.setState({
      realtimeMessages: new Map([[sessionKey, [streamedAssistant]]]),
    })

    // History message has raw <think> block stored in content (as saved in session log)
    const historyAssistant: ChatMessage = {
      role: 'assistant',
      id: 'msg-history-think',
      content: [
        {
          type: 'text',
          text: `<think>\nsome internal reasoning\n</think>\n${visibleText}`,
        },
      ],
    }

    const merged = useChatStore
      .getState()
      .mergeHistoryMessages(sessionKey, [historyAssistant])

    // Should deduplicate — not show two messages
    expect(merged).toHaveLength(1)
    // The visible text should be present
    expect(textOf(merged[0])).toContain(visibleText)
  })

  it('collapses realtime assistant duplicates when done message is cleaned but prior message has raw a2ui fence', () => {
    const sessionKey = 'session-a2ui-dedup'
    const store = useChatStore.getState()

    store.processEvent({
      type: 'message',
      sessionKey,
      message: {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Please complete the form.\n\n```a2ui\n{"type":"form"}\n```\n\nSubmit when finished.',
          },
        ],
      },
    })

    store.processEvent({
      type: 'done',
      state: 'complete',
      sessionKey,
      message: {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Please complete the form.\n\nSubmit when finished.',
          },
        ],
      },
    })

    const realtimeMessages = useChatStore
      .getState()
      .getRealtimeMessages(sessionKey)
    expect(realtimeMessages).toHaveLength(1)
    expect(textOf(realtimeMessages[0])).toBe(
      'Please complete the form.\n\nSubmit when finished.',
    )
  })

  it('tracks event activity by session so unrelated sessions do not refresh active state', () => {
    const store = useChatStore.getState()

    store.processEvent({
      type: 'chunk',
      sessionKey: 'session-a',
      text: 'A',
    })

    const sessionAEventAt = useChatStore.getState().getLastEventAt('session-a')
    expect(sessionAEventAt).toBeGreaterThan(0)
    expect(useChatStore.getState().getLastEventAt('session-b')).toBe(0)

    store.processEvent({
      type: 'chunk',
      sessionKey: 'session-b',
      text: 'B',
    })

    expect(useChatStore.getState().getLastEventAt('session-a')).toBe(
      sessionAEventAt,
    )
    expect(useChatStore.getState().getLastEventAt('session-b')).toBeGreaterThan(
      0,
    )
  })
})
