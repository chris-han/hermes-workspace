import { createFileRoute } from '@tanstack/react-router'

import { requireJsonContentType } from '../../server/rate-limit'
import { resolveSessionKey } from '../../server/session-utils'
import {
  SemantierSessionApiError,
  createSemantierSession,
  getSemantierSessionKey,
  openSemantierSessionChatStream,
} from '../../server/semantier-session-api'
import {
  appendRunText,
  createPersistedRun,
  markRunStatus,
  persistRunTrajectory,
  setRunThinking,
  upsertRunToolCall,
} from '../../server/run-store'
import {
  WorkspaceAuthRequiredError,
  resolveActiveWorkspaceRoot,
} from '../../server/workspace-root'
import type { WorkspaceStreamEvent } from '../../server/semantier-session-stream'

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

  return data ? { event: event || 'message', data } : null
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Extract a content delta without trimming internal whitespace.
 * Leading/trailing spaces in delta.content are significant — they act as
 * word separators between consecutive tokens. Using readString() (which
 * calls .trim()) drops leading spaces from deltas like " to", " would",
 * causing "readyto", "Whatwould" artefacts in the accumulated text.
 */
function readDelta(value: unknown): string {
  return typeof value === 'string' ? value : ''
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
            sessionKey = getSemantierSessionKey(session) || sessionKey
          }

          const requestedModel =
            typeof body.model === 'string' ? body.model.trim() : ''
          const requestedThinking =
            typeof body.thinking === 'string' ? body.thinking.trim() : ''
          const runId =
            (typeof body.idempotencyKey === 'string' &&
            body.idempotencyKey.trim().length > 0
              ? body.idempotencyKey.trim()
              : sessionKey) || sessionKey
          let workspaceRoot = ''
          try {
            const activeWorkspace = await resolveActiveWorkspaceRoot(
              request.headers,
            )
            workspaceRoot = activeWorkspace.path
            await createPersistedRun({
              workspaceRoot,
              runId,
              sessionKey,
              friendlyId: sessionKey,
              model: requestedModel || undefined,
            })
          } catch (error) {
            if (error instanceof WorkspaceAuthRequiredError) {
              return buildJsonError(error.message, 401)
            }
            return buildJsonError(asMessage(error), 500)
          }

          const markRun = async (
            status:
              | 'accepted'
              | 'active'
              | 'handoff'
              | 'stalled'
              | 'complete'
              | 'error',
            errorMessage?: string,
          ) => {
            if (!workspaceRoot) return
            await markRunStatus(
              workspaceRoot,
              sessionKey,
              runId,
              status,
              errorMessage,
            )
            if (status === 'complete') {
              await persistRunTrajectory(workspaceRoot, sessionKey, runId)
            }
          }

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
                const upstream = await openSemantierSessionChatStream(
                  request.headers,
                  sessionKey,
                  message,
                  {
                    model: requestedModel || undefined,
                    systemMessage: requestedThinking || undefined,
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
                let hasAssistantOutput = false

                while (!finished) {
                  const { done, value } = await reader.read()
                  if (done) break

                  buffer += decoder.decode(value, { stream: true })
                  const blocks = buffer.split('\n\n')
                  buffer = blocks.pop() ?? ''

                  for (const block of blocks) {
                    const frame = parseSseBlock(block)
                    if (!frame) continue

                    if (frame.data === '[DONE]') {
                      if (hasAssistantOutput) {
                        await markRun('complete')
                        push({
                          event: 'done',
                          data: {
                            state: 'complete',
                            runId,
                          },
                        })
                      } else {
                        const message = 'Run completed without assistant output'
                        await markRun('error', message)
                        push({
                          event: 'done',
                          data: {
                            state: 'error',
                            errorMessage: message,
                            runId,
                          },
                        })
                      }
                      finished = true
                      abortController.abort()
                      break
                    }

                    if (frame.event === 'hermes.tool.progress') {
                      let payload: Record<string, unknown> = {}
                      try {
                        payload = JSON.parse(frame.data) as Record<
                          string,
                          unknown
                        >
                      } catch {
                        continue
                      }
                      const status = readString(payload.status)
                      const phase =
                        status === 'completed'
                          ? 'complete'
                          : status === 'running'
                            ? 'start'
                            : 'progress'
                      if (workspaceRoot) {
                        await upsertRunToolCall(
                          workspaceRoot,
                          sessionKey,
                          runId,
                          {
                            id:
                              readString(payload.toolCallId) ||
                              readString(payload.tool) ||
                              'tool',
                            phase,
                            name: readString(payload.tool) || 'tool',
                            preview: readString(payload.label),
                          },
                        )
                      }
                      push({
                        event: 'tool',
                        data: {
                          phase,
                          name: readString(payload.tool) || 'tool',
                          preview: readString(payload.label),
                          toolCallId:
                            readString(payload.toolCallId) || undefined,
                        },
                      })
                      continue
                    }

                    let payload: Record<string, unknown> = {}
                    try {
                      payload = JSON.parse(frame.data) as Record<
                        string,
                        unknown
                      >
                    } catch {
                      continue
                    }

                    const choices = Array.isArray(payload.choices)
                      ? (payload.choices as Array<Record<string, unknown>>)
                      : []
                    const choice = choices[0] || {}
                    const delta =
                      choice.delta && typeof choice.delta === 'object'
                        ? (choice.delta as Record<string, unknown>)
                        : {}
                    const content = readDelta(delta.content)
                    const reasoning =
                      readString(delta.reasoning) ||
                      readString(delta.reasoning_content)
                    const finishReason = readString(choice.finish_reason)

                    if (reasoning) {
                      hasAssistantOutput = true
                      if (workspaceRoot) {
                        await setRunThinking(
                          workspaceRoot,
                          sessionKey,
                          runId,
                          reasoning,
                        )
                      }
                      push({
                        event: 'thinking',
                        data: { text: reasoning, runId },
                      })
                    }
                    if (content) {
                      hasAssistantOutput = true
                      if (workspaceRoot) {
                        await appendRunText(
                          workspaceRoot,
                          sessionKey,
                          runId,
                          content,
                        )
                      }
                      push({
                        event: 'chunk',
                        data: { delta: content, runId },
                      })
                    }

                    if (finishReason && finishReason !== 'error') {
                      if (hasAssistantOutput) {
                        await markRun('complete')
                        push({
                          event: 'done',
                          data: {
                            state: 'complete',
                            runId,
                          },
                        })
                      } else {
                        const message = 'Run completed without assistant output'
                        await markRun('error', message)
                        push({
                          event: 'done',
                          data: {
                            state: 'error',
                            errorMessage: message,
                            runId,
                          },
                        })
                      }
                      finished = true
                      abortController.abort()
                      break
                    }
                    if (finishReason === 'error') {
                      await markRun('error', 'Stream failed')
                      push({
                        event: 'done',
                        data: {
                          state: 'error',
                          errorMessage: 'Stream failed',
                          runId,
                        },
                      })
                      finished = true
                      abortController.abort()
                      break
                    }
                  }
                }
                if (!finished && !abortController.signal.aborted) {
                  if (hasAssistantOutput) {
                    await markRun('complete')
                  } else {
                    await markRun('error', 'Run completed without assistant output')
                  }
                }
              } catch (error) {
                if (!abortController.signal.aborted) {
                  await markRun('error', asMessage(error))
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
              void markRun('error', 'Stream canceled')
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
