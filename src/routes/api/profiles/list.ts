import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import path from 'node:path'
import {
  getActiveProfileName,
  listProfiles,
} from '../../../server/profiles-browser'
import { resolveActiveWorkspaceRoot } from '../../../server/workspace-root'

export const Route = createFileRoute('/api/profiles/list')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const workspace = await resolveActiveWorkspaceRoot(request.headers)
          const hermesHome =
            workspace.hermesHome || path.join(workspace.path, '.hermes')
          return json({
            profiles: listProfiles(hermesHome),
            activeProfile: getActiveProfileName(hermesHome),
          })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to list profiles',
              profiles: [],
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
