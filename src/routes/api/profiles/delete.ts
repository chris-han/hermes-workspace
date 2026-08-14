import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  deleteProfile,
  isManagedProfile,
} from '../../../server/profiles-browser'
import { requireJsonContentType } from '../../../server/rate-limit'
import {
  requireWorkspaceHermesHome,
  resolveManagedHermesHome,
  resolveActiveWorkspaceRoot,
} from '../../../server/workspace-root'

export const Route = createFileRoute('/api/profiles/delete')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck
        try {
          const body = (await request.json()) as { name?: string }
          const workspace = await resolveActiveWorkspaceRoot(request.headers)
          const hermesHome = requireWorkspaceHermesHome(workspace)
          if (isManagedProfile(body.name || '', resolveManagedHermesHome())) {
            return json({ error: 'Managed profiles are read-only' }, { status: 403 })
          }
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
