import { describe, expect, it } from 'vitest'

import {
  buildDisplayEntries,
  buildPreparedChatRows,
  getPendingAssistantRowKey,
  normalizeStreamingToolCalls,
  selectPendingAssistantActivity,
} from './prepared-chat-rows'
import type {
  BuildPreparedChatRowsInput,
  DisplayEntry,
} from './prepared-chat-rows'
import type { ChatMessage } from '../types'

function textMessage(
  role: string,
  text: string,
  id = `${role}-${text.length}`,
): ChatMessage {
  return {
    id,
    role,
    content: [{ type: 'text', text }],
    timestamp: 1,
  }
}

function assistantMessage(
  overrides: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    content: [],
    timestamp: 2,
    ...overrides,
  }
}

function baseInput(
  entries: Array<DisplayEntry>,
  overrides: Partial<BuildPreparedChatRowsInput> = {},
): BuildPreparedChatRowsInput {
  let lastAssistantSourceIndex: number | undefined
  for (const entry of entries) {
    if (entry.message.role === 'assistant') {
      lastAssistantSourceIndex = entry.sourceIndex
    }
  }

  return {
    visibleEntries: entries,
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
  }
}

function prepareRows(
  messages: Array<ChatMessage>,
  overrides: Partial<BuildPreparedChatRowsInput> = {},
) {
  const entries = buildDisplayEntries(messages)
  return buildPreparedChatRows(baseInput(entries, overrides))
}

describe('prepared chat rows', () => {
  it('groups tool-only assistant and tool result messages onto the visible assistant row', () => {
    const toolOnlyAssistant: ChatMessage = {
      id: 'tool-call-holder',
      role: 'assistant',
      content: [{ type: 'toolCall', id: 'tc-1', name: 'web_search' }],
      timestamp: 2,
    }
    const toolResult: ChatMessage = {
      id: 'tool-result',
      role: 'toolResult',
      toolCallId: 'tc-1',
      toolName: 'web_search',
      content: [{ type: 'text', text: 'result' }],
      timestamp: 3,
    }
    const visibleAssistant = textMessage('assistant', 'done', 'assistant-final')

    const entries = buildDisplayEntries([
      textMessage('user', 'go', 'user-1'),
      toolOnlyAssistant,
      toolResult,
      visibleAssistant,
    ])

    expect(entries).toHaveLength(2)
    expect(entries[1]?.message.id).toBe('assistant-final')
    expect(entries[1]?.attachedToolMessages.map((message) => message.id)).toEqual(
      ['tool-call-holder', 'tool-result'],
    )
  })

  it('shows one assistant placeholder for an active pre-content assistant row', () => {
    const rows = prepareRows([assistantMessage()], {
      waitingForResponse: true,
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]?.assistantTurnContext).toBe('active')
    expect(rows[0]?.assistantActivity.showPlaceholder).toBe(true)
    expect(rows[0]?.assistantActivity.reason).toBe('waiting')
  })

  it('uses a pending assistant placeholder when no assistant row exists yet', () => {
    const activity = selectPendingAssistantActivity({
      showPreparedAssistantPlaceholder: false,
      legacyShowTypingIndicator: true,
      isCompacting: false,
      sending: true,
      isStreaming: false,
      waitingForResponse: false,
      thinkingGrace: false,
      streamingThinking: '',
      lifecycleEventCount: 0,
    })

    expect(activity?.showPlaceholder).toBe(true)
    expect(activity?.reason).toBe('sending')
    expect(
      getPendingAssistantRowKey({
        sessionKey: 'session-a',
        lastUserStableId: 'user-1',
      }),
    ).toBe('pending-assistant:session-a:user-1')
  })

  it('suppresses pending placeholder when a prepared assistant placeholder already owns the turn', () => {
    const activity = selectPendingAssistantActivity({
      showPreparedAssistantPlaceholder: true,
      legacyShowTypingIndicator: true,
      isCompacting: false,
      sending: true,
      isStreaming: false,
      waitingForResponse: false,
      thinkingGrace: false,
      streamingThinking: '',
      lifecycleEventCount: 0,
    })

    expect(activity).toBeNull()
  })

  it.each([
    [
      'text',
      assistantMessage({ content: [{ type: 'text', text: 'hello' }] }),
      'hasVisibleText',
    ],
    [
      'governed response',
      assistantMessage({
        content: [
          {
            type: 'governedResponse',
            featureGate: 'sensitiveGovernance',
            response: {},
          } as any,
        ],
      }),
      'hasGovernedResponse',
    ],
    [
      'sensitive-governance preview',
      assistantMessage({
        content: [
          {
            type: 'sensitiveGovernanceInputPreview',
            featureGate: 'sensitiveGovernance',
            assessment: {},
          } as any,
        ],
      }),
      'hasSensitiveGovernancePreview',
    ],
    [
      'a2ui',
      assistantMessage({
        content: [{ type: 'a2ui', schema: { nodes: [] } } as any],
      }),
      'hasA2UiContent',
    ],
    [
      'attachment',
      assistantMessage({
        attachments: [{ id: 'a-1', previewUrl: 'https://example.test/a.png' }],
      }),
      'hasVisibleAttachments',
    ],
    [
      'inline image',
      assistantMessage({
        content: [{ type: 'image', url: 'https://example.test/i.png' } as any],
      }),
      'hasVisibleInlineImages',
    ],
    [
      'thinking disclosure',
      assistantMessage({
        content: [{ type: 'thinking', thinking: 'reasoning trace' }],
      }),
      'hasVisibleThinkingDisclosure',
    ],
  ])('treats %s as substantive visible assistant content', (_name, message, flag) => {
    const rows = prepareRows([message], { waitingForResponse: true })
    const summary = rows[0]?.contentSummary as any

    expect(summary[flag]).toBe(true)
    expect(summary.hasSubstantiveVisibleAssistantContent).toBe(true)
    expect(rows[0]?.assistantActivity.showPlaceholder).toBe(false)
  })

  it('treats lifecycle and research timeline rows as substantive visible assistant content', () => {
    const streamingAssistant = assistantMessage({ id: 'assistant-stream' })
    const lifecycleRows = prepareRows([streamingAssistant], {
      isStreaming: true,
      streamingMessageId: 'assistant-stream',
      lifecycleEvents: [
        { text: 'Planning', emoji: '', timestamp: 1, isError: false },
      ],
    })
    const researchRows = prepareRows([assistantMessage()], {
      waitingForResponse: true,
      researchStepCount: 1,
    })

    expect(lifecycleRows[0]?.contentSummary.hasVisibleLifecycleContent).toBe(true)
    expect(lifecycleRows[0]?.assistantActivity.showPlaceholder).toBe(false)
    expect(researchRows[0]?.contentSummary.hasVisibleResearchTimeline).toBe(true)
    expect(researchRows[0]?.assistantActivity.showPlaceholder).toBe(false)
  })

  it('does not count raw non-renderable attachment or inline image data as visible content', () => {
    const rows = prepareRows([
      assistantMessage({
        attachments: [{ id: 'a-1', name: 'missing-url.png' }],
        content: [{ type: 'image', source: { type: 'base64', data: '' } } as any],
      }),
    ], {
      waitingForResponse: true,
    })

    expect(rows[0]?.contentSummary.hasSubstantiveVisibleAssistantContent).toBe(
      false,
    )
    expect(rows[0]?.assistantActivity.showPlaceholder).toBe(true)
  })

  it('enforces the assistant-to-tool transition invariant for streaming tool sections', () => {
    const emptyStreamRows = prepareRows([assistantMessage({ id: 'stream-1' })], {
      isStreaming: true,
      streamingMessageId: 'stream-1',
      streamingText: '',
    })
    const activeToolRows = prepareRows([assistantMessage({ id: 'stream-1' })], {
      isStreaming: true,
      streamingMessageId: 'stream-1',
      normalizedStreamingToolCalls: normalizeStreamingToolCalls([
        { id: 'tool-1', name: 'web_search', phase: 'running' },
      ]),
      activeToolCallCount: 1,
    })

    expect(emptyStreamRows[0]?.assistantActivity.showPlaceholder).toBe(true)
    expect(emptyStreamRows[0]?.contentSummary.hasVisibleToolSections).toBe(false)
    expect(activeToolRows[0]?.assistantActivity.showPlaceholder).toBe(false)
    expect(activeToolRows[0]?.contentSummary.hasVisibleToolSections).toBe(true)
  })

  it('keeps liveToolActivity outside prepared row authority', () => {
    const rows = prepareRows([assistantMessage()], {
      waitingForResponse: true,
      activeToolCallCount: 0,
      normalizedStreamingToolCalls: [],
    })

    expect(rows[0]?.assistantActivity.showPlaceholder).toBe(true)
    expect(rows[0]?.contentSummary.hasVisibleToolSections).toBe(false)
  })
})
