import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { isAuthenticated } from '../../server/auth-middleware'
import { requireJsonContentType } from '../../server/rate-limit'
import {
  createVibeSession,
  deleteVibeSession,
  listVibeSessions,
  toVibeSessionSummary,
  updateVibeSession,
} from '../../server/vibe-session-api'

export const Route = createFileRoute('/api/sessions')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const sessions = await listVibeSessions(request.headers, 50)
          return json({ sessions: sessions.map(toVibeSessionSummary) })
        } catch (err) {
          return json(
            { error: err instanceof Error ? err.message : String(err) },
            { status: 500 },
          )
        }
      },
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck

        try {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
          const label = typeof body.label === 'string' ? body.label.trim() : ''
          const session = await createVibeSession(request.headers, label || undefined)

          return json({
            ok: true,
            sessionKey: session.session_id,
            friendlyId: session.session_id,
            entry: toVibeSessionSummary(session),
            modelApplied: false,
          })
        } catch (err) {
          return json(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            { status: 500 },
          )
        }
      },
      PATCH: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck

        try {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
          const rawSessionKey = typeof body.sessionKey === 'string' ? body.sessionKey.trim() : ''
          const rawFriendlyId = typeof body.friendlyId === 'string' ? body.friendlyId.trim() : ''
          const label = typeof body.label === 'string' ? body.label.trim() : undefined
          const sessionKey = rawSessionKey || rawFriendlyId

          if (!sessionKey) {
            return json({ ok: false, error: 'sessionKey required' }, { status: 400 })
          }

          await updateVibeSession(request.headers, sessionKey, label)

          return json({
            ok: true,
            sessionKey,
            entry: {
              key: sessionKey,
              friendlyId: sessionKey,
              label: label || sessionKey,
              title: label || sessionKey,
              derivedTitle: label || sessionKey,
              updatedAt: Date.now(),
            },
          })
        } catch (err) {
          return json(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            { status: 500 },
          )
        }
      },
      DELETE: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const url = new URL(request.url)
          const rawSessionKey = url.searchParams.get('sessionKey') ?? ''
          const rawFriendlyId = url.searchParams.get('friendlyId') ?? ''
          const sessionKey = rawSessionKey.trim() || rawFriendlyId.trim()

          if (!sessionKey) {
            return json({ ok: false, error: 'sessionKey required' }, { status: 400 })
          }

          await deleteVibeSession(request.headers, sessionKey)
          return json({ ok: true, sessionKey })
        } catch (err) {
          return json(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
