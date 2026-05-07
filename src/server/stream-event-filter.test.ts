import { describe, expect, it } from 'vitest'

import { isCurrentRunEvent, readAttemptId } from './stream-event-filter'

describe('readAttemptId', () => {
  it('returns empty string for null', () => {
    expect(readAttemptId(null)).toBe('')
  })

  it('returns empty string for non-object', () => {
    expect(readAttemptId('text')).toBe('')
    expect(readAttemptId(42)).toBe('')
  })

  it('returns empty string when attempt_id is missing', () => {
    expect(readAttemptId({ content: 'hello' })).toBe('')
  })

  it('returns trimmed attempt_id when present', () => {
    expect(readAttemptId({ attempt_id: '  run-abc  ' })).toBe('run-abc')
  })

  it('returns empty string when attempt_id is not a string', () => {
    expect(readAttemptId({ attempt_id: 123 })).toBe('')
  })
})

describe('isCurrentRunEvent', () => {
  const runId = 'run-current'

  it('allows non-stream events through regardless of attempt_id', () => {
    expect(
      isCurrentRunEvent('session.info', { attempt_id: 'run-old' }, runId),
    ).toBe(true)
    expect(isCurrentRunEvent('heartbeat', {}, runId)).toBe(true)
    expect(isCurrentRunEvent('error', { attempt_id: 'run-old' }, runId)).toBe(
      true,
    )
  })

  it('allows stream events with no attempt_id through (no filter applied)', () => {
    expect(isCurrentRunEvent('text_delta', { content: 'hi' }, runId)).toBe(true)
    expect(isCurrentRunEvent('tool_call', { tool: 'search' }, runId)).toBe(true)
  })

  it('allows stream events whose attempt_id matches the current runId', () => {
    expect(
      isCurrentRunEvent(
        'text_delta',
        { content: 'hi', attempt_id: runId },
        runId,
      ),
    ).toBe(true)
    expect(
      isCurrentRunEvent(
        'reasoning_delta',
        { content: 'thinking', attempt_id: runId },
        runId,
      ),
    ).toBe(true)
    expect(
      isCurrentRunEvent(
        'attempt.completed',
        { summary: 'done', attempt_id: runId },
        runId,
      ),
    ).toBe(true)
    expect(
      isCurrentRunEvent(
        'attempt.failed',
        { error: 'boom', attempt_id: runId },
        runId,
      ),
    ).toBe(true)
  })

  it('blocks stale replayed events whose attempt_id differs from the current runId', () => {
    expect(
      isCurrentRunEvent(
        'text_delta',
        { content: 'old text', attempt_id: 'run-old' },
        runId,
      ),
    ).toBe(false)
    expect(
      isCurrentRunEvent(
        'tool_result',
        { tool: 'x', attempt_id: 'run-old' },
        runId,
      ),
    ).toBe(false)
    expect(
      isCurrentRunEvent(
        'attempt.completed',
        { summary: 'old done', attempt_id: 'run-old' },
        runId,
      ),
    ).toBe(false)
  })

  it('covers all gated stream event types', () => {
    const streamTypes = [
      'text_delta',
      'reasoning_delta',
      'tool_call',
      'tool_progress',
      'tool_result',
      'attempt.completed',
      'attempt.failed',
    ]
    for (const type of streamTypes) {
      expect(isCurrentRunEvent(type, { attempt_id: 'run-old' }, runId)).toBe(
        false,
      )
      expect(isCurrentRunEvent(type, { attempt_id: runId }, runId)).toBe(true)
    }
  })
})
