import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { renameProfile } from '../../../server/profiles-browser'
import { requireJsonContentType } from '../../../server/rate-limit'
import {
  requireWorkspaceHermesHome,
  resolveActiveWorkspaceRoot,
} from '../../../server/workspace-root'

export const Route = createFileRoute('/api/profiles/rename')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck
        try {
          const body = (await request.json()) as {
            oldName?: string
            newName?: string
          }
          const workspace = await resolveActiveWorkspaceRoot(request.headers)
          const hermesHome = requireWorkspaceHermesHome(workspace)
          return json({
            ok: true,
            profile: renameProfile(body.oldName || '', body.newName || '', hermesHome),
          })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to rename profile',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
