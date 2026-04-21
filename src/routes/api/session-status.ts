import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { isSyntheticSessionKey } from '../../server/session-utils'
import {
  getSemantierSession,
  isSemantierSessionNotFoundError,
  listSemantierSessions,
} from '../../server/semantier-session-api'
import { isAuthenticated } from '@/server/auth-middleware'

function buildIdlePayload() {
  return {
    status: 'idle',
    sessionKey: 'new',
    sessionLabel: '',
    model: '',
    modelProvider: '',
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    sessions: [],
  }
}

export const Route = createFileRoute('/api/session-status')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const url = new URL(request.url)
          const requestedKey =
            url.searchParams.get('sessionKey')?.trim() ||
            url.searchParams.get('key')?.trim() ||
            ''
          let sessionKey = requestedKey || 'new'

          if (sessionKey === 'new') {
            return json({
              ok: true,
              payload: buildIdlePayload(),
            })
          }

          if (isSyntheticSessionKey(sessionKey)) {
            const sessions = await listSemantierSessions(request.headers, 1)
            if (sessions.length === 0) {
              return json({
                ok: true,
                payload: buildIdlePayload(),
              })
            }
            sessionKey = sessions[0].session_id
          }

          let session
          try {
            session = await getSemantierSession(request.headers, sessionKey)
          } catch (error) {
            if (isSemantierSessionNotFoundError(error)) {
              return json({
                ok: true,
                payload: buildIdlePayload(),
              })
            }
            throw error
          }
          const updatedAt =
            (session.updated_at ? Date.parse(session.updated_at) : undefined) ??
            (session.created_at ? Date.parse(session.created_at) : undefined) ??
            Date.now()

          return json({
            ok: true,
            payload: {
              status: session.status || 'idle',
              sessionKey: session.session_id,
              sessionLabel: session.title ?? '',
              model: '',
              modelProvider: '',
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              sessions: [
                {
                  key: session.session_id,
                  agentId: session.session_id,
                  label: session.title ?? session.session_id,
                  model: '',
                  modelProvider: '',
                  updatedAt,
                  usage: { input: 0, output: 0 },
                },
              ],
            },
          })
        } catch (err) {
          return json(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            { status: 503 },
          )
        }
      },
    },
  },
})
