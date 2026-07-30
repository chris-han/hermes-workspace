import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { resolveSessionKey } from '../../server/session-utils'
import {
  getSemantierSessionKey,
  getSemantierSessionMessages,
  isSemantierAuthError,
  isSemantierSessionNotFoundError,
  listSemantierSessions,
  SemantierSessionApiError,
  toSemantierChatMessage,
} from '../../server/semantier-session-api'

export const Route = createFileRoute('/api/history')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const limit = Number(url.searchParams.get('limit') || '200')
          const afterTsRaw = Number(url.searchParams.get('afterTs') || '')
          const afterTs =
            Number.isFinite(afterTsRaw) && afterTsRaw > 0 ? afterTsRaw : null
          const rawSessionKey = url.searchParams.get('sessionKey')?.trim()
          const friendlyId = url.searchParams.get('friendlyId')?.trim()
          let { sessionKey } = await resolveSessionKey({
            rawSessionKey,
            friendlyId,
            defaultKey: 'main',
          })

          if (sessionKey === 'new') {
            return json({ sessionKey: 'new', sessionId: 'new', messages: [] })
          }

          if (sessionKey === 'main') {
            let sessions: Awaited<ReturnType<typeof listSemantierSessions>>
            try {
              sessions = await listSemantierSessions(request.headers, 1)
            } catch (error) {
              if (isSemantierAuthError(error)) {
                return json({ sessionKey: 'new', sessionId: 'new', messages: [] })
              }
              throw error
            }
            if (sessions.length === 0) {
              return json({ sessionKey: 'new', sessionId: 'new', messages: [] })
            }
            sessionKey = getSemantierSessionKey(sessions[0]) || 'new'
          }

          let messages
          try {
            messages = await getSemantierSessionMessages(
              request.headers,
              sessionKey,
              limit,
            )
          } catch (error) {
            if (
              isSemantierSessionNotFoundError(error) ||
              isSemantierAuthError(error)
            ) {
              return json({ sessionKey: 'new', sessionId: 'new', messages: [] })
            }
            throw error
          }
          const boundedMessages = limit > 0 ? messages.slice(-limit) : messages
          const filteredMessages =
            afterTs === null
              ? boundedMessages
              : boundedMessages.filter((message) => {
                  const createdAt = Date.parse(message.createdAt || '')
                  if (!Number.isFinite(createdAt)) return false
                  return createdAt > afterTs
                })

          return json({
            sessionKey,
            sessionId: sessionKey,
            messages: filteredMessages.map((message, index) =>
              toSemantierChatMessage(message, index),
            ),
          })
        } catch (err) {
          const status =
            err instanceof SemantierSessionApiError &&
            (err.status === 401 || err.status === 403)
              ? err.status
              : 500
          return json(
            {
              error: err instanceof Error ? err.message : String(err),
            },
            { status },
          )
        }
      },
    },
  },
})
