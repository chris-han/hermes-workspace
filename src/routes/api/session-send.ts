import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { requireJsonContentType } from '../../server/rate-limit'
import {
  createSemantierSession,
  isSemantierSessionNotFoundError,
  sendSemantierSessionMessage,
} from '../../server/semantier-session-api'

const SESSION_BOOTSTRAP_KEYS = new Set(['main', 'new'])

export const Route = createFileRoute('/api/session-send')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck

        try {
          const body = (await request.json()) as {
            sessionKey?: string
            message?: string
          }
          let sessionKey = (body.sessionKey || '').trim()
          const message = (body.message || '').trim()
          if (!sessionKey) {
            return json(
              { ok: false, error: 'sessionKey is required' },
              { status: 400 },
            )
          }
          if (!message) {
            return json(
              { ok: false, error: 'message is required' },
              { status: 400 },
            )
          }

          if (SESSION_BOOTSTRAP_KEYS.has(sessionKey)) {
            const session = await createSemantierSession(request.headers)
            sessionKey = session.session_id
          }

          let result
          try {
            result = await sendSemantierSessionMessage(
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
            result = await sendSemantierSessionMessage(
              request.headers,
              sessionKey,
              message,
            )
          }
          return json({
            ok: true,
            sessionKey,
            queued: true,
            attemptId: result.attempt_id,
          })
        } catch (error) {
          return json(
            {
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to queue message',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
