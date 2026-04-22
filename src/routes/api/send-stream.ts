import { createFileRoute } from '@tanstack/react-router'

import { isAuthenticated } from '../../server/auth-middleware'
import { requireJsonContentType } from '../../server/rate-limit'
import { resolveSessionKey } from '../../server/session-utils'
import {
  SemantierSessionApiError,
  createSemantierSession,
  isSemantierSessionNotFoundError,
  openSemantierSessionEvents,
  sendSemantierSessionMessage,
} from '../../server/semantier-session-api'
import {
  
  translateSemantierSessionStreamEvent
} from '../../server/semantier-session-stream'
import type {WorkspaceStreamEvent} from '../../server/semantier-session-stream';

const SESSION_BOOTSTRAP_KEYS = new Set(['main', 'new'])

function buildJsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  if (!block.trim()) return null

  const lines = block.split('\n')
  let event = ''
  let data = ''

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      event = line.slice(7).trim()
      continue
    }
    if (line.startsWith('data: ')) {
      data += line.slice(6)
      continue
    }
    if (line.startsWith('data:')) {
      data += line.slice(5)
    }
  }

  return event && data ? { event, data } : null
}

function encodeSseFrame(event: WorkspaceStreamEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`
}

function asMessage(value: unknown): string {
  if (value instanceof Error) return value.message
  return String(value || 'Request failed')
}

function semantierErrorResponse(error: unknown): Response | null {
  if (!(error instanceof SemantierSessionApiError)) return null

  const status = error.status
  const message =
    status === 429
      ? 'Rate limit reached. Please retry in a moment.'
      : asMessage(error)

  return buildJsonError(message, status)
}

export const Route = createFileRoute('/api/send-stream')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return buildJsonError('Unauthorized', 401)
        }
        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck

        let body: Record<string, unknown> = {}
        try {
          body = (await request.json()) as Record<string, unknown>
        } catch {
          body = {}
        }

        const message =
          typeof body.message === 'string' ? body.message.trim() : ''
        const requestedFriendlyId =
          typeof body.friendlyId === 'string' ? body.friendlyId.trim() : ''
        const rawSessionKey =
          typeof body.sessionKey === 'string' ? body.sessionKey.trim() : ''

        if (!message) {
          return buildJsonError('message required', 400)
        }

        let sessionKey: string
        try {
          const resolved = await resolveSessionKey({
            rawSessionKey,
            friendlyId: requestedFriendlyId,
            defaultKey: 'new',
          })
          sessionKey = resolved.sessionKey
        } catch (error) {
          return buildJsonError(asMessage(error), 500)
        }

        try {
          if (SESSION_BOOTSTRAP_KEYS.has(sessionKey)) {
            const session = await createSemantierSession(request.headers)
            sessionKey = session.session_id
          }

          let sendResult
          try {
            sendResult = await sendSemantierSessionMessage(
              request.headers,
              sessionKey,
              message,
            )
          } catch (error) {
            if (!isSemantierSessionNotFoundError(error)) {
              throw error
            }
            const session = await createSemantierSession(request.headers)
            sessionKey = session.session_id
            sendResult = await sendSemantierSessionMessage(
              request.headers,
              sessionKey,
              message,
            )
          }
          const runId = sendResult.attempt_id || sendResult.message_id

          const encoder = new TextEncoder()
          const abortController = new AbortController()
          const responseStream = new ReadableStream({
            async start(controller) {
              const push = (event: WorkspaceStreamEvent) => {
                controller.enqueue(encoder.encode(encodeSseFrame(event)))
              }

              push({
                event: 'started',
                data: {
                  runId,
                  sessionKey,
                  friendlyId: sessionKey,
                },
              })

              try {
                const upstream = await openSemantierSessionEvents(
                  request.headers,
                  sessionKey,
                  {
                    replayExisting: true,
                    signal: abortController.signal,
                  },
                )
                const reader = upstream.body?.getReader()
                if (!reader) {
                  throw new Error('No response body')
                }

                const decoder = new TextDecoder()
                let buffer = ''
                let finished = false

                while (!finished) {
                  const { done, value } = await reader.read()
                  if (done) break

                  buffer += decoder.decode(value, { stream: true })
                  const blocks = buffer.split('\n\n')
                  buffer = blocks.pop() ?? ''

                  for (const block of blocks) {
                    const frame = parseSseBlock(block)
                    if (!frame) continue

                    let payload: unknown
                    try {
                      payload = JSON.parse(frame.data)
                    } catch {
                      continue
                    }

                    const translated = translateSemantierSessionStreamEvent(
                      frame.event,
                      payload,
                      runId,
                    )
                    for (const event of translated) {
                      push(event)
                      if (
                        event.event === 'done' ||
                        event.event === 'error' ||
                        event.event === 'complete'
                      ) {
                        finished = true
                      }
                    }

                    if (finished) {
                      abortController.abort()
                      break
                    }
                  }
                }
              } catch (error) {
                if (!abortController.signal.aborted) {
                  push({
                    event: 'done',
                    data: {
                      state: 'error',
                      errorMessage: asMessage(error),
                    },
                  })
                }
              } finally {
                try {
                  controller.close()
                } catch {
                  // ignore close races
                }
              }
            },
            cancel() {
              abortController.abort()
            },
          })

          return new Response(responseStream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
              'X-Accel-Buffering': 'no',
              'x-hermes-session-key': sessionKey,
              'x-hermes-friendly-id': sessionKey,
            },
          })
        } catch (error) {
          const upstream = semantierErrorResponse(error)
          if (upstream) return upstream
          return buildJsonError(asMessage(error), 500)
        }
      },
    },
  },
})
