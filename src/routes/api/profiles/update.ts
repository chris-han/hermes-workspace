import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import path from 'node:path'
import { updateProfileConfig } from '../../../server/profiles-browser'
import { requireJsonContentType } from '../../../server/rate-limit'
import { resolveActiveWorkspaceRoot } from '../../../server/workspace-root'

export const Route = createFileRoute('/api/profiles/update')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck
        try {
          const body = (await request.json()) as {
            name?: string
            patch?: Record<string, unknown>
          }
          if (!body.patch || typeof body.patch !== 'object') {
            return json({ error: 'patch is required' }, { status: 400 })
          }
          const workspace = await resolveActiveWorkspaceRoot(request.headers)
          const hermesHome =
            workspace.hermesHome || path.join(workspace.path, '.hermes')
          const profile = updateProfileConfig(
            body.name || '',
            body.patch,
            hermesHome,
          )
          return json({ ok: true, profile })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to update profile',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
