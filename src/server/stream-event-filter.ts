/**
 * Helpers for filtering Semantier SSE frames by attempt ID.
 *
 * When a session stream is opened with replay_existing=true, the backend may
 * replay buffered events from previous attempts before delivering events for
 * the current run.  These utilities identify and discard those stale frames.
 */

export function readAttemptId(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const value = (payload as Record<string, unknown>).attempt_id
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Returns true if an SSE frame should be forwarded to the browser.
 *
 * Non-streaming event types (heartbeats, session.info, etc.) are always
 * allowed through.  Streaming event types are gated by attempt_id: if the
 * payload carries an attempt_id that does not match the current runId the
 * frame is from a previous attempt and must be dropped.
 */
export function isCurrentRunEvent(
  eventType: string,
  payload: unknown,
  runId: string,
): boolean {
  const streamEventTypes = new Set([
    'text_delta',
    'reasoning_delta',
    'tool_call',
    'tool_progress',
    'tool_result',
    'attempt.completed',
    'attempt.failed',
  ])

  if (!streamEventTypes.has(eventType)) return true
  const attemptId = readAttemptId(payload)
  if (!attemptId) return true
  return attemptId === runId
}
