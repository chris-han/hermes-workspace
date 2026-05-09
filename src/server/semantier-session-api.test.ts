import { describe, expect, it } from 'vitest'

import {
  SemantierSessionApiError,
  getSemantierSessionMessages,
  isSemantierSessionNotFoundError,
  openSemantierSessionChatStream,
  sendSemantierSessionMessage,
  toSemantierChatMessage,
  toSemantierSessionSummary,
} from './semantier-session-api'

describe('toSemantierSessionSummary', () => {
  it('maps backend sessions into workspace sidebar summaries', () => {
    const summary = toSemantierSessionSummary({
      key: 'sess-123',
      friendlyId: 'sess-123',
      label: 'My Session',
      title: 'My Session',
      createdAt: Date.parse('2026-04-21T10:00:00Z'),
      updatedAt: Date.parse('2026-04-21T10:05:00Z'),
      status: 'idle',
    })

    expect(summary).toMatchObject({
      key: 'sess-123',
      friendlyId: 'sess-123',
      label: 'My Session',
      title: 'My Session',
      derivedTitle: 'My Session',
      status: 'idle',
    })
    expect(summary.updatedAt).toBe(Date.parse('2026-04-21T10:05:00Z'))
  })
})

describe('toSemantierChatMessage', () => {
  it('maps backend messages into chat history items', () => {
    const message = toSemantierChatMessage(
      {
        messageId: 'msg-1',
        sessionKey: 'sess-123',
        role: 'assistant',
        content: 'Hello',
        createdAt: '2026-04-21T10:05:00Z',
      },
      3,
    )

    expect(message).toMatchObject({
      id: 'msg-msg-1',
      role: 'assistant',
      text: 'Hello',
      sessionKey: 'sess-123',
      __historyIndex: 3,
    })
    expect(message.content).toEqual([{ type: 'text', text: 'Hello' }])
  })

  it('projects metadata ui_schema as an a2ui content block', () => {
    const message = toSemantierChatMessage({
      messageId: 'msg-2',
      sessionKey: 'sess-123',
      role: 'assistant',
      content: '请填写信息',
      createdAt: '2026-04-21T10:06:00Z',
      metadata: {
        ui_schema: {
          version: '1.0',
          root: {
            component: 'schema_form',
            props: {
              fields: [{ key: 'topic', label: '会议主题', type: 'text' }],
            },
          },
        },
      },
    })

    expect(message.content).toEqual([
      { type: 'text', text: '请填写信息' },
      {
        type: 'a2ui',
        schema: {
          version: '1.0',
          root: {
            component: 'schema_form',
            props: {
              fields: [{ key: 'topic', label: '会议主题', type: 'text' }],
            },
          },
        },
      },
    ])
  })
})

describe('isSemantierSessionNotFoundError', () => {
  it('matches typed 404 errors from the agent session API', () => {
    const error = new SemantierSessionApiError(
      '/sessions/sess-123/messages',
      404,
      'Session sess-123 not found',
    )

    expect(isSemantierSessionNotFoundError(error)).toBe(true)
  })

  it('ignores non-404 API errors', () => {
    const error = new SemantierSessionApiError(
      '/sessions/sess-123/messages',
      500,
      'Internal server error',
    )

    expect(isSemantierSessionNotFoundError(error)).toBe(false)
  })
})

describe('getSemantierSessionMessages', () => {
  it('accepts wrapped Hermes message responses', async () => {
    const originalFetch = global.fetch
    global.fetch = async () =>
      new Response(
        JSON.stringify({
          session_id: 'sess-123',
          messages: [
            {
              message_id: 'msg-1',
              role: 'assistant',
              content: 'Hello',
              created_at: '2026-04-21T10:05:00Z',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      )

    try {
      const messages = await getSemantierSessionMessages(undefined, 'sess-123')
      expect(messages).toEqual([
        expect.objectContaining({
          messageId: 'msg-1',
          sessionKey: 'sess-123',
          role: 'assistant',
          content: 'Hello',
          createdAt: '2026-04-21T10:05:00Z',
        }),
      ])
    } finally {
      global.fetch = originalFetch
    }
  })
})

describe('sendSemantierSessionMessage', () => {
  it('posts to the semantier send endpoint and maps runId to attemptId', async () => {
    const originalFetch = global.fetch
    global.fetch = async (input, init) => {
      expect(String(input)).toContain('/api/sessions/sess-123/chat')
      expect(init?.method).toBe('POST')
      expect(init?.body).toBe(
        JSON.stringify({
          message: 'Hello',
        }),
      )
      return new Response(
        JSON.stringify({
          ok: true,
          sessionKey: 'sess-123',
          runId: 'run-abc',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      )
    }

    try {
      await expect(
        sendSemantierSessionMessage(undefined, 'sess-123', 'Hello'),
      ).resolves.toEqual({
        messageId: undefined,
        attemptId: 'run-abc',
      })
    } finally {
      global.fetch = originalFetch
    }
  })
})

describe('openSemantierSessionChatStream', () => {
  it('posts to the workspace chat stream endpoint', async () => {
    const originalFetch = global.fetch
    global.fetch = (async (input, init) => {
      expect(String(input)).toContain('/api/sessions/sess-123/chat/stream')
      expect(init?.method).toBe('POST')
      expect(init?.body).toBe(
        JSON.stringify({
          message: 'Hello',
          model: 'gpt-test',
          system_message: undefined,
        }),
      )
      return new Response('data: [DONE]\n\n', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      })
    }) as typeof fetch

    try {
      const response = await openSemantierSessionChatStream(
        undefined,
        'sess-123',
        'Hello',
        { model: 'gpt-test' },
      )
      expect(response.headers.get('content-type')).toContain(
        'text/event-stream',
      )
    } finally {
      global.fetch = originalFetch
    }
  })
})
