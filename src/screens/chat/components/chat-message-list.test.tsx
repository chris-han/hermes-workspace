import { describe, expect, it } from 'vitest'

import {
  buildDisplayEntries,
  buildPreparedChatRows,
  normalizeStreamingToolCalls,
  selectPendingAssistantActivity,
} from '../lib/prepared-chat-rows'
import type { BuildPreparedChatRowsInput } from '../lib/prepared-chat-rows'
import type { ChatMessage } from '../types'

function message(
  role: ChatMessage['role'],
  content: ChatMessage['content'],
  id: string,
): ChatMessage {
  return {
    id,
    role,
    content,
    timestamp: 1,
  }
}

function prepare(
  messages: Array<ChatMessage>,
  overrides: Partial<BuildPreparedChatRowsInput> = {},
) {
  const visibleEntries = buildDisplayEntries(messages)
  let lastAssistantSourceIndex: number | undefined
  for (const entry of visibleEntries) {
    if (entry.message.role === 'assistant') {
      lastAssistantSourceIndex = entry.sourceIndex
    }
  }

  return buildPreparedChatRows({
    visibleEntries,
    isStreaming: false,
    streamingMessageId: null,
    streamingText: '',
    streamingThinking: '',
    lifecycleEvents: [],
    normalizedStreamingToolCalls: [],
    activeToolCallCount: 0,
    lastAssistantSourceIndex,
    waitingForResponse: false,
    thinkingGrace: false,
    sending: false,
    isCompacting: false,
    researchStepCount: 0,
    signatureById: new Map(),
    streamingTargets: new Set(),
    ...overrides,
  })
}

describe('ChatMessageList lifecycle row preparation', () => {
  it('keeps one assistant-level placeholder on the active pre-content row', () => {
    const rows = prepare(
      [message('user', [{ type: 'text', text: 'search' }], 'user-1')],
      {
        waitingForResponse: true,
        sending: true,
      },
    )
    const pendingActivity = selectPendingAssistantActivity({
      showPreparedAssistantPlaceholder: rows.some(
        (row) => row.assistantActivity.showPlaceholder,
      ),
      legacyShowTypingIndicator: true,
      isCompacting: false,
      sending: true,
      isStreaming: false,
      waitingForResponse: true,
      thinkingGrace: false,
      streamingThinking: '',
      lifecycleEventCount: 0,
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]?.assistantActivity.showPlaceholder).toBe(false)
    expect(pendingActivity?.showPlaceholder).toBe(true)
    expect(pendingActivity?.reason).toBe('sending')
  })

  it('suppresses the assistant placeholder once an active visible tool section owns activity', () => {
    const rows = prepare(
      [
        message('assistant', [], 'assistant-1'),
      ],
      {
        isStreaming: true,
        streamingMessageId: 'assistant-1',
        normalizedStreamingToolCalls: normalizeStreamingToolCalls([
          { id: 'tc-1', name: 'web_search', phase: 'running' },
        ]),
        activeToolCallCount: 1,
      },
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]?.contentSummary.hasVisibleToolSections).toBe(true)
    expect(rows[0]?.assistantActivity.showPlaceholder).toBe(false)
  })

  it('keeps delayed live tool labels outside assistant placeholder authority', () => {
    const rows = prepare([message('assistant', [], 'assistant-1')], {
      isStreaming: false,
      waitingForResponse: false,
      normalizedStreamingToolCalls: normalizeStreamingToolCalls([]),
      activeToolCallCount: 0,
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]?.assistantActivity.showPlaceholder).toBe(false)
    expect(rows[0]?.assistantActivity.reason).toBe('historical')
  })
})
