import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { isSyntheticSessionKey } from '../../server/session-utils'
import {
  getSemantierSessionKey,
  getSemantierSession,
  isSemantierSessionNotFoundError,
  listSemantierSessions,
} from '../../server/semantier-session-api'
import {  } from '@/server/auth-middleware'

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
            sessionKey = getSemantierSessionKey(sessions[0]) || 'new'
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
          const resolvedSessionKey = getSemantierSessionKey(session) || sessionKey
          const updatedAt =
            (typeof session.updatedAt === 'number' ? session.updatedAt : undefined) ??
            (typeof session.createdAt === 'number' ? session.createdAt : undefined) ??
            Date.now()

          return json({
            ok: true,
            payload: {
              status: session.status || 'idle',
              sessionKey: resolvedSessionKey,
              sessionLabel: session.title ?? '',
              model: '',
              modelProvider: '',
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              sessions: [
                {
                  key: resolvedSessionKey,
                  agentId: resolvedSessionKey,
                  label: session.title ?? resolvedSessionKey,
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
