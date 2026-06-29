import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { buildDataConnectionsSummary } from '../../../server/data-connections'
import {
  WorkspaceAuthRequiredError,
  resolveActiveWorkspaceRoot,
} from '../../../server/workspace-root'

export const Route = createFileRoute('/api/data-connections/summary')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await resolveActiveWorkspaceRoot(request.headers)
          return json({ ok: true, summary: buildDataConnectionsSummary() })
        } catch (error) {
          if (error instanceof WorkspaceAuthRequiredError) {
            return json({ ok: false, error: error.message }, { status: 401 })
          }
          return json(
            {
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to read data connections summary',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
