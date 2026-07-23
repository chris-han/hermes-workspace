import {
  getToolCallsFromMessage,
  textFromMessage,
} from '../utils'
import {
  normalizeKnownToolPhase,
  selectAssistantActivityState,
} from './activity-state'
import { createAssistantContentSummary } from './assistant-content'
import type {
  AssistantActivityState,
  AssistantTurnContext,
  AssistantTurnPhase,
  NormalizedToolPhase,
} from './activity-state'
import type { AssistantContentSummary } from './assistant-content'
import type { ChatMessage } from '../types'

export type DisplayEntry = {
  message: ChatMessage
  sourceIndex: number
  attachedToolMessages: Array<ChatMessage>
}

export type PreparedStreamingToolCall = {
  id: string
  name: string
  phase: NormalizedToolPhase
}

export type PreparedChatRow = {
  entry: DisplayEntry
  entryIndex: number
  message: ChatMessage
  sourceIndex: number
  stableId: string
  signature: string | undefined
  messageIsStreaming: boolean
  simulateStreaming: boolean
  wrapperClassName: string
  forceActionsVisible: boolean
  hasToolCalls: boolean
  effectiveOnRetry: ((message: ChatMessage) => void) | undefined
  bubbleClassName: string | undefined
  isEmptyStreamingPlaceholder: boolean
  contentSummary: AssistantContentSummary
  assistantTurnPhase: AssistantTurnPhase
  assistantTurnContext: AssistantTurnContext
  assistantActivity: AssistantActivityState
}

export type MessageSearchRowState = {
  searchMatchIndex?: number
  activeSearchMatchIndex: number
}

export type BuildPreparedChatRowsInput = {
  visibleEntries: Array<DisplayEntry>
  isStreaming: boolean
  streamingMessageId?: string | null
  streamingText?: string
  streamingThinking?: string
  lifecycleEvents: Array<unknown>
  normalizedStreamingToolCalls: Array<PreparedStreamingToolCall>
  activeToolCallCount: number
  lastAssistantSourceIndex?: number
  waitingForResponse: boolean
  thinkingGrace: boolean
  sending: boolean
  isCompacting: boolean
  researchStepCount: number
  signatureById: Map<string, string>
  streamingTargets: Set<string>
  messageSearchStateById?: Map<string, MessageSearchRowState>
  onRetryMessage?: (message: ChatMessage) => void
}

export type PendingAssistantActivityInput = {
  showPreparedAssistantPlaceholder: boolean
  legacyShowTypingIndicator: boolean
  isCompacting: boolean
  sending: boolean
  isStreaming: boolean
  waitingForResponse: boolean
  thinkingGrace: boolean
  streamingThinking?: string
  lifecycleEventCount: number
}

function isAssistantToolCallOnlyMessage(message: ChatMessage): boolean {
  if (message.role !== 'assistant') return false
  const hasToolCalls = getToolCallsFromMessage(message).length > 0
  const text = textFromMessage(message)
  return hasToolCalls && text.trim().length === 0
}

export function buildDisplayEntries(
  displayMessages: Array<ChatMessage>,
): Array<DisplayEntry> {
  const entries: Array<DisplayEntry> = []
  let pendingAssistantToolMessages: Array<ChatMessage> = []

  displayMessages.forEach((message, index) => {
    if (isAssistantToolCallOnlyMessage(message)) {
      pendingAssistantToolMessages.push(message)
      return
    }

    if (message.role === 'tool' || message.role === 'toolResult') {
      if (
        entries.length > 0 &&
        entries[entries.length - 1].message.role === 'assistant'
      ) {
        const previousEntry = entries[entries.length - 1]
        previousEntry.attachedToolMessages.push(message)
      } else if (pendingAssistantToolMessages.length > 0) {
        pendingAssistantToolMessages.push(message)
      }
      return
    }

    const entry: DisplayEntry = {
      message,
      sourceIndex: index,
      attachedToolMessages: [],
    }

    if (
      message.role === 'assistant' &&
      pendingAssistantToolMessages.length > 0
    ) {
      entry.attachedToolMessages.push(...pendingAssistantToolMessages)
      pendingAssistantToolMessages = []
    }

    entries.push(entry)
  })

  if (pendingAssistantToolMessages.length > 0) {
    if (
      entries.length > 0 &&
      entries[entries.length - 1].message.role === 'assistant'
    ) {
      const previousEntry = entries[entries.length - 1]
      previousEntry.attachedToolMessages.push(...pendingAssistantToolMessages)
    }
  }

  return entries
}

export function normalizeStreamingToolCalls(
  activeToolCalls: Array<{ id: string; name: string; phase: string }>,
): Array<PreparedStreamingToolCall> {
  return activeToolCalls.map((toolCall) => ({
    id: toolCall.id,
    name: toolCall.name,
    phase: normalizeKnownToolPhase(toolCall.phase),
  }))
}

export function hasRenderableAttachmentSource(message: ChatMessage): boolean {
  const attachments = Array.isArray((message as any).attachments)
    ? ((message as any).attachments as Array<Record<string, unknown>>)
    : []
  return attachments.some((attachment) =>
    [attachment.previewUrl, attachment.dataUrl, attachment.url].some(
      (candidate) =>
        typeof candidate === 'string' && candidate.trim().length > 0,
    ),
  )
}

export function hasRenderableInlineImage(message: ChatMessage): boolean {
  const parts = Array.isArray(message.content) ? message.content : []
  return parts.some((part: any) => {
    if (part?.type !== 'image') return false
    const source = part.source
    if (typeof part.url === 'string' && part.url.trim().length > 0) return true
    if (source?.type === 'base64' && typeof source.data === 'string') {
      return source.data.trim().length > 0
    }
    return typeof source?.url === 'string' && source.url.trim().length > 0
  })
}

export function hasAssistantContentPart(
  message: ChatMessage,
  predicate: (part: any) => boolean,
): boolean {
  const parts = Array.isArray(message.content) ? message.content : []
  return parts.some(predicate)
}

export function getRawMessageTimestamp(message: ChatMessage): number | null {
  const candidates = [
    message.createdAt,
    message.timestamp,
    (message as Record<string, unknown>).time,
    (message as Record<string, unknown>).ts,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      if (candidate < 1_000_000_000_000) return candidate * 1000
      return candidate
    }
    if (typeof candidate === 'string') {
      const parsed = Date.parse(candidate)
      if (!Number.isNaN(parsed)) return parsed
    }
  }
  return null
}

export function getStableMessageId(
  message: ChatMessage,
  index: number,
): string {
  if (message.__optimisticId) return message.__optimisticId

  const idCandidates = ['id', 'messageId', 'uuid', 'clientId'] as const
  for (const key of idCandidates) {
    const value = (message as Record<string, unknown>)[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
  }

  const timestamp = getRawMessageTimestamp(message)
  if (timestamp) {
    return `${message.role ?? 'assistant'}-${timestamp}-${index}`
  }

  return `${message.role ?? 'assistant'}-${index}`
}

function isMessageStreaming(
  message: ChatMessage,
  streamingMessageId?: string | null,
): boolean {
  if (!streamingMessageId) return false
  const messageId = message.__optimisticId || (message as any).id
  if (typeof messageId === 'string' && messageId.trim().length > 0) {
    return messageId === streamingMessageId
  }
  return false
}

export function buildPreparedChatRows(
  input: BuildPreparedChatRowsInput,
): Array<PreparedChatRow> {
  return input.visibleEntries.map((entry, entryIndex) => {
    const chatMessage = entry.message
    const realIndex = entry.sourceIndex
    const messageIsStreaming = input.isStreaming
      ? isMessageStreaming(chatMessage, input.streamingMessageId)
      : false
    const stableId = getStableMessageId(chatMessage, realIndex)
    const signature = input.signatureById.get(stableId)
    const simulateStreaming = input.streamingTargets.has(stableId)
    const forceActionsVisible =
      typeof input.lastAssistantSourceIndex === 'number' &&
      realIndex === input.lastAssistantSourceIndex
    const hasToolCalls =
      chatMessage.role === 'assistant' &&
      (getToolCallsFromMessage(chatMessage).length > 0 ||
        entry.attachedToolMessages.length > 0)

    const searchState = input.messageSearchStateById?.get(stableId)
    const isSearchMatch = typeof searchState?.searchMatchIndex === 'number'
    const isActiveMatch =
      isSearchMatch &&
      searchState.searchMatchIndex === searchState.activeSearchMatchIndex

    const hasAssistantReply =
      chatMessage.role === 'user' &&
      entryIndex + 1 < input.visibleEntries.length &&
      input.visibleEntries[entryIndex + 1]?.message.role === 'assistant'
    const effectiveOnRetry = hasAssistantReply
      ? undefined
      : input.onRetryMessage
    const hasStreamingActivity =
      input.activeToolCallCount > 0 ||
      input.lifecycleEvents.length > 0 ||
      Boolean(
        input.streamingThinking && input.streamingThinking.trim().length > 0,
      )
    const isEmptyStreamingPlaceholder =
      messageIsStreaming &&
      (!input.streamingText || input.streamingText.trim().length === 0) &&
      !hasStreamingActivity
    const isAssistant = chatMessage.role === 'assistant'
    const hasVisibleText =
      isAssistant &&
      !isEmptyStreamingPlaceholder &&
      (messageIsStreaming
        ? Boolean(input.streamingText && input.streamingText.trim().length > 0)
        : textFromMessage(chatMessage).trim().length > 0)
    const hasThinkingDisclosure =
      isAssistant &&
      !hasVisibleText &&
      !hasToolCalls &&
      !isEmptyStreamingPlaceholder &&
      (messageIsStreaming
        ? Boolean(
            input.streamingThinking && input.streamingThinking.trim().length > 0,
          )
        : hasAssistantContentPart(
            chatMessage,
            (part) =>
              part?.type === 'thinking' &&
              typeof part.thinking === 'string' &&
              part.thinking.trim().length > 0,
          ))
    const contentSummary = createAssistantContentSummary({
      hasVisibleText,
      hasGovernedResponse:
        isAssistant &&
        hasAssistantContentPart(
          chatMessage,
          (part) => part?.type === 'governedResponse',
        ),
      hasSensitiveGovernancePreview:
        isAssistant &&
        hasAssistantContentPart(
          chatMessage,
          (part) => part?.type === 'sensitiveGovernanceInputPreview',
        ),
      hasA2UiContent:
        isAssistant &&
        hasAssistantContentPart(
          chatMessage,
          (part) => part?.type === 'a2ui' || part?.type === 'uiSchema',
        ),
      hasVisibleAttachments:
        isAssistant && hasRenderableAttachmentSource(chatMessage),
      hasVisibleInlineImages:
        isAssistant && hasRenderableInlineImage(chatMessage),
      hasVisibleToolSections:
        isAssistant &&
        !isEmptyStreamingPlaceholder &&
        (hasToolCalls ||
          (messageIsStreaming && input.normalizedStreamingToolCalls.length > 0)),
      hasVisibleLifecycleContent:
        isAssistant &&
        messageIsStreaming &&
        input.lifecycleEvents.length > 0 &&
        !hasToolCalls,
      hasVisibleThinkingDisclosure: hasThinkingDisclosure,
      hasVisibleResearchTimeline:
        isAssistant &&
        typeof input.lastAssistantSourceIndex === 'number' &&
        realIndex === input.lastAssistantSourceIndex &&
        input.researchStepCount > 0,
    })
    const assistantTurnContext: AssistantTurnContext =
      isAssistant &&
      (messageIsStreaming ||
        (typeof input.lastAssistantSourceIndex === 'number' &&
          realIndex === input.lastAssistantSourceIndex &&
          (input.waitingForResponse ||
            input.thinkingGrace ||
            input.sending ||
            input.isCompacting)))
        ? 'active'
        : 'historical'
    const assistantTurnPhase: AssistantTurnPhase =
      assistantTurnContext === 'historical'
        ? 'idle'
        : input.isCompacting
          ? 'compacting'
          : input.sending
            ? 'sending'
            : messageIsStreaming
              ? 'streaming'
              : input.waitingForResponse || input.thinkingGrace
                ? 'waiting'
                : 'idle'
    const assistantActivity = selectAssistantActivityState({
      assistantTurnPhase,
      assistantTurnContext,
      hasSubstantiveVisibleAssistantContent:
        contentSummary.hasSubstantiveVisibleAssistantContent,
      hasActiveToolSection:
        contentSummary.hasVisibleToolSections &&
        input.normalizedStreamingToolCalls.some(
          (toolCall) =>
            toolCall.phase === 'calling' || toolCall.phase === 'running',
        ),
      hasStreamingThinking: Boolean(
        input.streamingThinking && input.streamingThinking.trim().length > 0,
      ),
      hasLifecycleContent: input.lifecycleEvents.length > 0,
      thinkingGraceActive: input.thinkingGrace,
    })

    return {
      entry,
      entryIndex,
      message: chatMessage,
      sourceIndex: realIndex,
      stableId,
      signature,
      messageIsStreaming,
      simulateStreaming,
      wrapperClassName: '',
      forceActionsVisible,
      hasToolCalls,
      effectiveOnRetry,
      bubbleClassName: isActiveMatch
        ? 'ring-2 ring-amber-400 bg-amber-50/50'
        : isSearchMatch
          ? 'bg-amber-50/30'
          : undefined,
      isEmptyStreamingPlaceholder,
      contentSummary,
      assistantTurnPhase,
      assistantTurnContext,
      assistantActivity,
    }
  })
}

export function selectPendingAssistantActivity(
  input: PendingAssistantActivityInput,
): AssistantActivityState | null {
  if (input.showPreparedAssistantPlaceholder || !input.legacyShowTypingIndicator) {
    return null
  }

  const assistantTurnPhase: AssistantTurnPhase = input.isCompacting
    ? 'compacting'
    : input.sending
      ? 'sending'
      : input.isStreaming
        ? 'streaming'
        : input.waitingForResponse || input.thinkingGrace
          ? 'waiting'
          : 'idle'

  const activity = selectAssistantActivityState({
    assistantTurnPhase,
    assistantTurnContext: 'active',
    hasSubstantiveVisibleAssistantContent: false,
    hasActiveToolSection: false,
    hasStreamingThinking: Boolean(
      input.streamingThinking && input.streamingThinking.trim().length > 0,
    ),
    hasLifecycleContent: input.lifecycleEventCount > 0,
    thinkingGraceActive: input.thinkingGrace,
  })

  return activity.showPlaceholder ? activity : null
}

export function getPendingAssistantRowKey({
  sessionKey,
  streamingMessageId,
  lastUserStableId,
}: {
  sessionKey?: string
  streamingMessageId?: string | null
  lastUserStableId?: string
}): string {
  return [
    'pending-assistant',
    sessionKey ?? 'session',
    streamingMessageId ?? lastUserStableId ?? 'turn',
  ].join(':')
}
