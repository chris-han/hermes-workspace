import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { isAuthenticated } from '@/server/auth-middleware'
import { resolveSessionKey } from '../../server/session-utils'
import {
  getVibeSessionMessages,
  isVibeSessionNotFoundError,
  listVibeSessions,
  toVibeChatMessage,
} from '../../server/vibe-session-api'

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
            const sessions = await listVibeSessions(request.headers, 1)
            if (sessions.length === 0) {
              return json({ sessionKey: 'new', sessionId: 'new', messages: [] })
            }
            sessionKey = sessions[0].session_id
          }

          let messages
          try {
            messages = await getVibeSessionMessages(request.headers, sessionKey, limit)
          } catch (error) {
            if (isVibeSessionNotFoundError(error)) {
              return json({ sessionKey: 'new', sessionId: 'new', messages: [] })
            }
            throw error
          }
          const boundedMessages = limit > 0 ? messages.slice(-limit) : messages

          return json({
            sessionKey,
            sessionId: sessionKey,
            messages: boundedMessages.map((message, index) =>
              toVibeChatMessage(message, index),
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
