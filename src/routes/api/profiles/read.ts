import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import path from 'node:path'
import { readProfile } from '../../../server/profiles-browser'
import { resolveActiveWorkspaceRoot } from '../../../server/workspace-root'

export const Route = createFileRoute('/api/profiles/read')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const name = (url.searchParams.get('name') || '').trim() || 'default'
          const workspace = await resolveActiveWorkspaceRoot(request.headers)
          const hermesHome =
            workspace.hermesHome || path.join(workspace.path, '.hermes')
          return json({ profile: readProfile(name, hermesHome) })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to read profile',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
