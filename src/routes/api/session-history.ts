import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { isAuthenticated } from '@/server/auth-middleware'
import { resolveSessionKey } from '../../server/session-utils'
import {
  getVibeSessionMessages,
  isVibeSessionNotFoundError,
  toVibeChatMessage,
} from '../../server/vibe-session-api'

export const Route = createFileRoute('/api/session-history')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(request.url)
        const key =
          url.searchParams.get('key')?.trim() ||
          url.searchParams.get('sessionKey')?.trim() ||
          ''
        const limit = Number(url.searchParams.get('limit') || '200')

        if (!key) {
          return json({ ok: false, messages: [], error: 'key is required' })
        }

        try {
          const resolved = await resolveSessionKey({
            rawSessionKey: key,
            defaultKey: 'main',
          })
          let rows
          try {
            rows = await getVibeSessionMessages(
              request.headers,
              resolved.sessionKey,
              limit,
            )
          } catch (error) {
            if (isVibeSessionNotFoundError(error)) {
              return json({
                ok: true,
                messages: [],
                sessionKey: 'new',
                source: 'vibe',
              })
            }
            throw error
          }
          const trimmed = rows.slice(-limit)
          return json({
            ok: true,
            messages: trimmed.map((row, index) => toVibeChatMessage(row, index)),
            sessionKey: resolved.sessionKey,
            source: 'vibe',
          })
        } catch (error) {
          return json(
            {
              ok: false,
              messages: [],
              sessionKey: key,
              error:
                error instanceof Error ? error.message : 'Failed to load history',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
