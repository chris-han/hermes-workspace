export type WorkspaceStreamEvent = {
  event: string
  data: Record<string, unknown>
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readRunId(payload: Record<string, unknown>): string {
  const explicit = readString(payload.run_id) || readString(payload.runId)
  if (explicit) return explicit

  const runDir = readString(payload.run_dir) || readString(payload.runDir)
  if (!runDir) return ''

  const normalized = runDir.replace(/\\+/g, '/').replace(/\/+$/, '')
  if (!normalized) return ''
  const segments = normalized.split('/')
  return segments[segments.length - 1] || ''
}

function buildToolCallId(
  payload: Record<string, unknown>,
  runId?: string,
): string | undefined {
  const explicit =
    readString(payload.toolCallId) || readString(payload.tool_call_id)
  if (explicit) return explicit

  const toolName = readString(payload.tool) || 'tool'
  const attemptId = readString(payload.attempt_id) || runId || 'run'
  return `${attemptId}:${toolName}`
}

export function translateSemantierSessionStreamEvent(
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
      // Do NOT trim — leading/trailing spaces in streaming chunks are significant
      const text =
        (typeof data.content === 'string' ? data.content : null) ??
        (typeof data.text === 'string' ? data.text : null) ??
        ''
      return text ? [{ event: 'thinking', data: { text } }] : []
    }
    case 'text_delta': {
      // Do NOT trim — leading/trailing spaces in streaming chunks are significant
      const delta =
        (typeof data.content === 'string' ? data.content : null) ??
        (typeof data.text === 'string' ? data.text : null) ??
        ''
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
      const isError =
        data.is_error === true || readString(data.status) === 'error'
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
    case 'attempt.completed': {
      const donePayload: Record<string, unknown> = {
        state: 'complete',
      }
      const runId = readRunId(data)
      if (runId) donePayload.runId = runId

      const runDir = readString(data.run_dir) || readString(data.runDir)
      if (runDir) donePayload.run_dir = runDir

      if (typeof data.has_run_artifact === 'boolean') {
        donePayload.has_run_artifact = data.has_run_artifact
      }

      const summary = readString(data.summary)
      if (summary) donePayload.summary = summary

      if (data.metrics && typeof data.metrics === 'object') {
        donePayload.metrics = data.metrics
      }

      return [{ event: 'done', data: donePayload }]
    }
    case 'attempt.failed': {
      const errorMessage = readString(data.error) || 'Request failed'
      const donePayload: Record<string, unknown> = {
        state: 'error',
        errorMessage,
      }
      const runId = readRunId(data)
      if (runId) donePayload.runId = runId

      const runDir = readString(data.run_dir) || readString(data.runDir)
      if (runDir) donePayload.run_dir = runDir

      if (typeof data.has_run_artifact === 'boolean') {
        donePayload.has_run_artifact = data.has_run_artifact
      }

      if (data.metrics && typeof data.metrics === 'object') {
        donePayload.metrics = data.metrics
      }

      return [{ event: 'done', data: donePayload }]
    }
    default:
      return []
  }
}
