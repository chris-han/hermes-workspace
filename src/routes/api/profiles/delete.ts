import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import path from 'node:path'
import { deleteProfile } from '../../../server/profiles-browser'
import { requireJsonContentType } from '../../../server/rate-limit'
import { resolveActiveWorkspaceRoot } from '../../../server/workspace-root'

export const Route = createFileRoute('/api/profiles/delete')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck
        try {
          const body = (await request.json()) as { name?: string }
          const workspace = await resolveActiveWorkspaceRoot(request.headers)
          const hermesHome =
            workspace.hermesHome || path.join(workspace.path, '.hermes')
          deleteProfile(body.name || '', hermesHome)
          return json({ ok: true })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to delete profile',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
