export type WorkspaceStreamEvent = {
  event: string
  data: Record<string, unknown>
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function buildToolCallId(
  payload: Record<string, unknown>,
  runId?: string,
): string | undefined {
  const explicit = readString(payload.toolCallId) || readString(payload.tool_call_id)
  if (explicit) return explicit

  const toolName = readString(payload.tool) || 'tool'
  const attemptId = readString(payload.attempt_id) || runId || 'run'
  return `${attemptId}:${toolName}`
}

export function translateVibeSessionStreamEvent(
  eventType: string,
  payload: unknown,
  runId?: string,
): Array<WorkspaceStreamEvent> {
  const data =
    payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : {}

  switch (eventType) {
    case 'reasoning_delta': {
      const text = readString(data.content) || readString(data.text)
      return text ? [{ event: 'thinking', data: { text } }] : []
    }
    case 'text_delta': {
      const delta = readString(data.content) || readString(data.text)
      return delta ? [{ event: 'chunk', data: { delta } }] : []
    }
    case 'tool_call': {
      const name = readString(data.tool) || 'tool'
      return [
        {
          event: 'tool',
          data: {
            phase: 'start',
            name,
            args: data.args,
            toolCallId: buildToolCallId(data, runId),
          },
        },
      ]
    }
    case 'tool_progress': {
      const name = readString(data.tool) || 'tool'
      const preview = readString(data.preview)
      return [
        {
          event: 'tool',
          data: {
            phase: 'progress',
            name,
            preview,
            toolCallId: buildToolCallId(data, runId),
          },
        },
      ]
    }
    case 'tool_result': {
      const name = readString(data.tool) || 'tool'
      const preview = readString(data.preview)
      const isError = data.is_error === true || readString(data.status) === 'error'
      return [
        {
          event: 'tool',
          data: {
            phase: 'complete',
            name,
            preview,
            result: preview,
            status: isError ? 'error' : 'ok',
            toolCallId: buildToolCallId(data, runId),
          },
        },
      ]
    }
    case 'attempt.completed':
      return [{ event: 'done', data: { state: 'complete' } }]
    case 'attempt.failed': {
      const errorMessage = readString(data.error) || 'Request failed'
      return [{ event: 'done', data: { state: 'error', errorMessage } }]
    }
    default:
      return []
  }
}
