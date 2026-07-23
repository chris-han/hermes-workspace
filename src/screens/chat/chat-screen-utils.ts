import type { ChatAttachment, ChatMessage } from './types'

export type StickyStreamingTextState = {
  runId: string | null
  text: string
}

export function advanceStickyStreamingText(params: {
  isStreaming: boolean
  runId: string | null
  rawText: string
  smoothedText: string
  previousState: StickyStreamingTextState
}): StickyStreamingTextState {
  const { isStreaming, runId, rawText, smoothedText, previousState } = params

  if (!isStreaming) {
    return { runId: null, text: '' }
  }

  const nextRunId = runId ?? previousState.runId ?? 'streaming'
  const isNewRun = nextRunId !== previousState.runId
  const candidateText = smoothedText || rawText
  const nextText =
    candidateText.length > 0
      ? candidateText
      : isNewRun
        ? ''
        : previousState.text

  return {
    runId: nextRunId,
    text: nextText,
  }
}

export function shouldShowComposerStopControl(params: {
  effectiveSending: boolean
  effectiveWaitingForResponse: boolean
  isStreaming: boolean
  hasVisibleSensitiveGovernanceResult: boolean
}): boolean {
  const {
    effectiveSending,
    effectiveWaitingForResponse,
    isStreaming,
    hasVisibleSensitiveGovernanceResult,
  } = params

  if (hasVisibleSensitiveGovernanceResult) return false
  return effectiveSending || effectiveWaitingForResponse || isStreaming
}

type OptimisticMessagePayload = {
  clientId: string
  optimisticId: string
  optimisticMessage: ChatMessage
}

export function createOptimisticMessage(
  body: string,
  attachments: Array<ChatAttachment> = [],
): OptimisticMessagePayload {
  const clientId = crypto.randomUUID()
  const optimisticId = `opt-${clientId}`
  const timestamp = Date.now()
  const textContent =
    body.length > 0 ? [{ type: 'text' as const, text: body }] : []

  const optimisticMessage: ChatMessage = {
    role: 'user',
    content: textContent.length > 0 ? textContent : undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
    __optimisticId: optimisticId,
    __createdAt: timestamp,
    clientId,
    client_id: clientId,
    status: 'sending',
    timestamp,
  }

  return { clientId, optimisticId, optimisticMessage }
}

export function getChatMessageIdentity(message: ChatMessage): string | null {
  const raw = message as Record<string, unknown>
  const candidates = [
    message.__optimisticId,
    message.id,
    message.messageId,
    raw.clientId,
    raw.client_id,
    raw.uuid,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }

  return null
}

function textFromChatMessage(message: ChatMessage): string {
  if (Array.isArray(message.content)) {
    const text = message.content
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => ('text' in part ? part.text : ''))
      .join('\n')
      .trim()
    if (text.length > 0) return text
  }

  const raw = message as Record<string, unknown>
  for (const key of ['text', 'body', 'message']) {
    const value = raw[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }

  return ''
}

function normalizeAssistantStreamingText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function hasAssistantReplyAfterLastUser(params: {
  messages: Array<ChatMessage>
  streamingText: string
}): boolean {
  const { messages, streamingText } = params
  const lastUserIndex = messages.reduce(
    (lastIndex, message, index) =>
      message.role === 'user' ? index : lastIndex,
    -1,
  )
  if (lastUserIndex < 0) return false

  const normalizedStreamingText = normalizeAssistantStreamingText(streamingText)
  return messages.slice(lastUserIndex + 1).some((message) => {
    if (message.role !== 'assistant') return false
    if (message.__streamingStatus === 'streaming') return false
    const messageText = normalizeAssistantStreamingText(
      textFromChatMessage(message),
    )
    if (messageText.length === 0) return false
    if (normalizedStreamingText.length === 0) return true
    return (
      messageText === normalizedStreamingText ||
      normalizedStreamingText.startsWith(messageText) ||
      messageText.startsWith(normalizedStreamingText)
    )
  })
}

export function getStreamingPlaceholderMessageId(
  messages: Array<ChatMessage>,
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role !== 'assistant') continue
    if (message.__streamingStatus !== 'streaming') continue
    return getChatMessageIdentity(message)
  }

  return null
}
