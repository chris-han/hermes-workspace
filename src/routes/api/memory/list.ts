import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { listMemoryFiles } from '../../../server/memory-browser'
import {
  resolveActiveWorkspaceRoot,
  WorkspaceAuthRequiredError,
} from '../../../server/workspace-root'

export const Route = createFileRoute('/api/memory/list')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const activeWorkspace = await resolveActiveWorkspaceRoot(
            request.headers,
          )
          return json({ files: listMemoryFiles({ workspaceRoot: activeWorkspace.path }) })
        } catch (error) {
          if (error instanceof WorkspaceAuthRequiredError) {
            return json({ error: error.message }, { status: 401 })
          }
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to list memory files',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
