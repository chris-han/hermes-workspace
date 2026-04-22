import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { resolveSessionKey } from '../../server/session-utils'
import {
  getSemantierSessionMessages,
  isSemantierSessionNotFoundError,
  listSemantierSessions,
  toSemantierChatMessage,
} from '../../server/semantier-session-api'
import { isAuthenticated } from '@/server/auth-middleware'

export const Route = createFileRoute('/api/history')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

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
            const sessions = await listSemantierSessions(request.headers, 1)
            if (sessions.length === 0) {
              return json({ sessionKey: 'new', sessionId: 'new', messages: [] })
            }
            sessionKey = sessions[0].session_id
          }

          let messages
          try {
            messages = await getSemantierSessionMessages(
              request.headers,
              sessionKey,
              limit,
            )
          } catch (error) {
            if (isSemantierSessionNotFoundError(error)) {
              return json({ sessionKey: 'new', sessionId: 'new', messages: [] })
            }
            throw error
          }
          const boundedMessages = limit > 0 ? messages.slice(-limit) : messages
          const filteredMessages =
            afterTs === null
              ? boundedMessages
              : boundedMessages.filter((message) => {
                  const createdAt = Date.parse(message.created_at)
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
          return json(
            {
              error: err instanceof Error ? err.message : String(err),
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
