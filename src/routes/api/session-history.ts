import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { resolveSessionKey } from '../../server/session-utils'
import {
  getSemantierSessionMessages,
  isSemantierSessionNotFoundError,
  toSemantierChatMessage,
} from '../../server/semantier-session-api'
import {  } from '@/server/auth-middleware'

export const Route = createFileRoute('/api/session-history')({
  server: {
    handlers: {
      GET: async ({ request }) => {
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
            rows = await getSemantierSessionMessages(
              request.headers,
              resolved.sessionKey,
              limit,
            )
          } catch (error) {
            if (isSemantierSessionNotFoundError(error)) {
              return json({
                ok: true,
                messages: [],
                sessionKey: 'new',
                source: 'semantier',
              })
            }
            throw error
          }
          const trimmed = rows.slice(-limit)
          return json({
            ok: true,
            messages: trimmed.map((row, index) =>
              toSemantierChatMessage(row, index),
            ),
            sessionKey: resolved.sessionKey,
            source: 'semantier',
          })
        } catch (error) {
          return json(
            {
              ok: false,
              messages: [],
              sessionKey: key,
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to load history',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
