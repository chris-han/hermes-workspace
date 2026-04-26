import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getActiveRunForSession } from '../../../server/run-store'
import {
  WorkspaceAuthRequiredError,
  resolveActiveWorkspaceRoot,
} from '../../../server/workspace-root'

export const Route = createFileRoute('/api/sessions/$sessionKey/active-run')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const sessionKey = params.sessionKey?.trim()
        if (!sessionKey) {
          return json(
            { ok: false, error: 'sessionKey required' },
            { status: 400 },
          )
        }

        try {
          const activeWorkspace = await resolveActiveWorkspaceRoot(
            request.headers,
          )
          const run = await getActiveRunForSession(
            activeWorkspace.path,
            sessionKey,
          )
          return json({ ok: true, run })
        } catch (err) {
          if (err instanceof WorkspaceAuthRequiredError) {
            return json({ ok: false, error: err.message }, { status: 401 })
          }
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
